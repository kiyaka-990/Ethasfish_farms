// Fish-stock domain: harvest -> farm stock -> distribution to outlets ->
// sales at each outlet.
//
// A harvest comes from a *source*: a numbered cage, a numbered pond, or
// the hatchery. Every harvest is counted in pieces AND weighed in kg, so
// a single record captures both dimensions of the same fish.
//
// Balances are never stored - they are always derived from the three
// event tables, so a missed write can never leave a stale counter behind:
//   farm stock   = harvests - distributions
//   outlet stock = distributions - sales
//
// This file is the single place those numbers are computed and validated.
// Both the REST routes (/api/admin/stock/*) and the stockist agent's tool
// calls go through it, so the chat can never record something the forms
// would have rejected. Every write lands in the audit trail.
import { prisma } from './prisma';
import { logActivity, type ActorType } from './audit';

export const DEFAULT_OUTLETS = ['Kisumu', 'Nairobi'];

/** Where fish come from. Cages and ponds are numbered; the hatchery is a single source. */
export const SOURCE_TYPES = ['cage', 'pond', 'hatchery'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCE_LABELS: Record<SourceType, string> = {
  cage: 'Cage',
  pond: 'Pond',
  hatchery: 'Hatchery'
};

/** Context in which a stock record is written (a signed-in staff member or an agent). */
export interface StockActor {
  type: ActorType;
  id?: string | null;
  name: string;
}

export type StockResult<T> = { ok: true; record: T } | { ok: false; error: string };

export interface SourceStock {
  sourceType: SourceType;
  sourceNumber: string;
  label: string; // "Cage 3", "Pond P2", "Hatchery"
  pieces: number;
  kg: number;
  harvests: number;
  avgWeightKg: number;
}

export interface OutletStock {
  id: string;
  name: string;
  distributedPieces: number;
  distributedKg: number;
  soldPieces: number;
  soldKg: number;
  revenueKsh: number;
  salesCount: number;
  pieces: number; // in stock at the outlet
  kg: number;
  lowStockPieces: number; // alert threshold (0 = off)
  lowStockKg: number; // alert threshold (0 = off)
  isLow: boolean; // at/below either active threshold
}

export interface StockSnapshot {
  harvested: { pieces: number; kg: number; count: number };
  distributed: { pieces: number; kg: number; count: number };
  sold: { pieces: number; kg: number; amountKsh: number; count: number };
  farm: { pieces: number; kg: number }; // still on the farm, undistributed
  /** Average weight of a food-fish piece, from cage + pond harvests only. */
  avgWeightKg: number;
  today: { harvests: number; pieces: number; kg: number };
  sources: SourceStock[];
  byType: Record<SourceType, { pieces: number; kg: number; units: number; harvests: number }>;
  outlets: OutletStock[];
  /** Outlets currently at/below their low-stock thresholds - the alert list. */
  lowStock: { count: number; outlets: OutletStock[] };
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const r1 = (n: number) => Math.round(n * 10) / 10;
const nonNeg = (n: number) => (n > 0 ? r2(n) : 0);

export function sourceLabel(sourceType: string, sourceNumber: string) {
  if (sourceType === 'hatchery') return 'Hatchery';
  return `${SOURCE_LABELS[sourceType as SourceType] ?? sourceType} ${sourceNumber}`;
}

/** The two standing outlets - cheap idempotent create so an already-provisioned DB has them. */
export async function ensureDefaultOutlets() {
  for (const name of DEFAULT_OUTLETS) {
    await prisma.outlet.upsert({ where: { name }, update: {}, create: { name } }).catch(() => {});
  }
}

export async function findOutlet(name: string) {
  const q = (name || '').trim();
  if (!q) return null;
  const exact = await prisma.outlet.findFirst({ where: { name: { equals: q, mode: 'insensitive' } } });
  if (exact) return exact;
  return prisma.outlet.findFirst({ where: { name: { contains: q, mode: 'insensitive' }, active: true } });
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getStockSnapshot(): Promise<StockSnapshot> {
  const [outlets, harvestAgg, distAgg, saleAgg, sourceGroups, distByOutlet, saleByOutlet, todayAgg] = await Promise.all([
    prisma.outlet.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.harvest.aggregate({ _sum: { pieces: true, weightKg: true }, _count: true }),
    prisma.stockDistribution.aggregate({ _sum: { pieces: true, weightKg: true }, _count: true }),
    prisma.outletSale.aggregate({ _sum: { pieces: true, weightKg: true, amountKsh: true }, _count: true }),
    prisma.harvest.groupBy({
      by: ['sourceType', 'sourceNumber'],
      _sum: { pieces: true, weightKg: true },
      _count: true
    }),
    prisma.stockDistribution.groupBy({ by: ['outletId'], _sum: { pieces: true, weightKg: true } }),
    prisma.outletSale.groupBy({ by: ['outletId'], _sum: { pieces: true, weightKg: true, amountKsh: true }, _count: true }),
    prisma.harvest.aggregate({ where: { createdAt: { gte: startOfToday() } }, _sum: { pieces: true, weightKg: true }, _count: true })
  ]);

  const harvestedPieces = harvestAgg._sum.pieces ?? 0;
  const harvestedKg = r2(harvestAgg._sum.weightKg ?? 0);
  const distributedPieces = distAgg._sum.pieces ?? 0;
  const distributedKg = r2(distAgg._sum.weightKg ?? 0);
  const soldPieces = saleAgg._sum.pieces ?? 0;
  const soldKg = r2(saleAgg._sum.weightKg ?? 0);

  const sources: SourceStock[] = sourceGroups
    .map((g) => {
      const pieces = g._sum.pieces ?? 0;
      const kg = r2(g._sum.weightKg ?? 0);
      return {
        sourceType: g.sourceType as SourceType,
        sourceNumber: g.sourceNumber,
        label: sourceLabel(g.sourceType, g.sourceNumber),
        pieces,
        kg,
        harvests: g._count,
        avgWeightKg: pieces > 0 ? r2(kg / pieces) : 0
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  // Average weight used to convert between pieces and kg. Hatchery
  // harvests are fingerlings - a few grams each - so including them would
  // wreck the average for the food fish that actually go to outlets.
  const foodPieces = sources
    .filter((s) => s.sourceType === 'cage' || s.sourceType === 'pond')
    .reduce((n, s) => n + s.pieces, 0);
  const foodKg = sources
    .filter((s) => s.sourceType === 'cage' || s.sourceType === 'pond')
    .reduce((n, s) => n + s.kg, 0);
  const avgWeightKg = foodPieces > 0 ? r2(foodKg / foodPieces) : 0;

  const byType = { cage: { pieces: 0, kg: 0, units: 0, harvests: 0 }, pond: { pieces: 0, kg: 0, units: 0, harvests: 0 }, hatchery: { pieces: 0, kg: 0, units: 0, harvests: 0 } } as StockSnapshot['byType'];
  for (const s of sources) {
    const b = byType[s.sourceType] ?? (byType.cage = { pieces: 0, kg: 0, units: 0, harvests: 0 });
    b.pieces += s.pieces;
    b.kg = r2(b.kg + s.kg);
    b.units += 1;
    b.harvests += s.harvests;
  }

  const outletRows: OutletStock[] = outlets.map((o) => {
    const d = distByOutlet.find((x) => x.outletId === o.id)?._sum;
    const s = saleByOutlet.find((x) => x.outletId === o.id);
    const sSum = s?._sum;
    const distPieces = d?.pieces ?? 0;
    const distKg = r2(d?.weightKg ?? 0);
    const outPieces = sSum?.pieces ?? 0;
    const outKg = r2(sSum?.weightKg ?? 0);
    const pieces = Math.max(0, distPieces - outPieces);
    const kg = nonNeg(distKg - outKg);
    const lowPieces = o.lowStockPieces > 0 && pieces <= o.lowStockPieces;
    const lowKg = o.lowStockKg > 0 && kg <= o.lowStockKg;
    // Only an outlet that has actually received stock can be "low" - one
    // that has never been distributed to is unstocked, not depleted, and
    // alerting on it from day one would just be noise.
    const everStocked = distPieces > 0 || distKg > 0;
    return {
      id: o.id,
      name: o.name,
      distributedPieces: distPieces,
      distributedKg: distKg,
      soldPieces: outPieces,
      soldKg: outKg,
      revenueKsh: sSum?.amountKsh ?? 0,
      salesCount: s?._count ?? 0,
      pieces,
      kg,
      lowStockPieces: o.lowStockPieces,
      lowStockKg: o.lowStockKg,
      isLow: everStocked && (lowPieces || lowKg)
    };
  });

  const lowOutlets = outletRows.filter((o) => o.isLow);

  return {
    harvested: { pieces: harvestedPieces, kg: harvestedKg, count: harvestAgg._count },
    distributed: { pieces: distributedPieces, kg: distributedKg, count: distAgg._count },
    sold: { pieces: soldPieces, kg: soldKg, amountKsh: saleAgg._sum.amountKsh ?? 0, count: saleAgg._count },
    farm: {
      pieces: Math.max(0, harvestedPieces - distributedPieces),
      kg: nonNeg(harvestedKg - distributedKg)
    },
    avgWeightKg,
    today: {
      harvests: todayAgg._count,
      pieces: todayAgg._sum.pieces ?? 0,
      kg: r2(todayAgg._sum.weightKg ?? 0)
    },
    sources,
    byType,
    outlets: outletRows,
    lowStock: { count: lowOutlets.length, outlets: lowOutlets }
  };
}

/**
 * Fills in the dimension the user didn't type, using the prevailing
 * average weight, so both the piece and the kg balance stay in step when
 * staff record only one of the two. Returns whether a value was derived.
 */
function deriveMissing(pieces: number, weightKg: number, avgWeight: number) {
  let p = Math.max(0, Math.round(pieces));
  let kg = Math.max(0, r2(weightKg));
  let estimated = false;
  if (p > 0 && kg <= 0 && avgWeight > 0) {
    kg = r1(p * avgWeight);
    estimated = true;
  } else if (kg > 0 && p <= 0 && avgWeight > 0) {
    p = Math.max(1, Math.round(kg / avgWeight));
    estimated = true;
  }
  return { pieces: p, weightKg: kg, estimated };
}

// ===================== WRITES =====================
// Each returns { ok, record } or { ok:false, error } with a human-readable
// message, and writes one AuditLog row. Validation happens against live
// balances at write time (stock can't go negative).

export async function recordHarvest(
  input: { sourceType?: string; sourceNumber?: string; pieces: number; weightKg: number; note?: string | null },
  actor: StockActor
): Promise<StockResult<{ id: string; sourceType: SourceType; sourceNumber: string; label: string; pieces: number; weightKg: number }>> {
  const sourceType = ((input.sourceType || 'cage') as string).toLowerCase() as SourceType;
  if (!SOURCE_TYPES.includes(sourceType)) return { ok: false, error: 'Source must be cage, pond or hatchery.' };

  const sourceNumber = sourceType === 'hatchery' ? '1' : (input.sourceNumber || '').trim();
  if (sourceType !== 'hatchery' && !sourceNumber)
    return { ok: false, error: `A ${sourceType} number is required (e.g. 3 or P2).` };

  const pieces = Math.round(Number(input.pieces));
  const weightKg = r2(Number(input.weightKg));
  if (!Number.isFinite(pieces) || pieces <= 0) return { ok: false, error: 'Pieces must be a whole number greater than 0.' };
  if (!Number.isFinite(weightKg) || weightKg <= 0) return { ok: false, error: 'Weight in kg must be greater than 0.' };

  const harvest = await prisma.harvest.create({
    data: { sourceType, sourceNumber, pieces, weightKg, note: input.note?.trim() || null, recordedBy: actor.name }
  });
  const label = sourceLabel(sourceType, sourceNumber);
  await logActivity({
    actorType: actor.type,
    actorId: actor.id ?? null,
    actorName: actor.name,
    action: 'stock.harvest',
    entityType: 'Harvest',
    entityId: harvest.id,
    summary: `harvested ${pieces} pieces (${weightKg} kg) from ${label}`
  });
  return { ok: true, record: { id: harvest.id, sourceType, sourceNumber, label, pieces, weightKg } };
}

export async function recordDistribution(
  input: { outletId?: string; outlet?: string; pieces: number; weightKg: number; note?: string | null },
  actor: StockActor
): Promise<StockResult<{ id: string; pieces: number; weightKg: number; estimated: boolean; outletName: string }>> {
  const outlet = input.outletId
    ? await prisma.outlet.findUnique({ where: { id: input.outletId } })
    : await findOutlet(input.outlet || '');
  if (!outlet) return { ok: false, error: 'Outlet not found - pick one of the existing outlets.' };
  if (!outlet.active) return { ok: false, error: `Outlet "${outlet.name}" is inactive.` };

  const snapshot = await getStockSnapshot();
  const declaredPieces = Math.max(0, Math.round(Number(input.pieces) || 0));
  const declaredKg = Math.max(0, r2(Number(input.weightKg) || 0));
  if (declaredPieces <= 0 && declaredKg <= 0) return { ok: false, error: 'Enter the pieces and/or the weight being sent.' };

  const { pieces, weightKg, estimated } = deriveMissing(declaredPieces, declaredKg, snapshot.avgWeightKg);
  if (pieces <= 0 || weightKg <= 0)
    return { ok: false, error: 'Could not determine both pieces and weight - enter them explicitly.' };

  // Explicit dimensions may not overdraw farm stock; the derived one is
  // informational and never blocks a legitimate write.
  if (declaredPieces > snapshot.farm.pieces)
    return { ok: false, error: `Only ${snapshot.farm.pieces} pieces are left on the farm.` };
  if (declaredKg > snapshot.farm.kg) return { ok: false, error: `Only ${snapshot.farm.kg} kg are left on the farm.` };

  const dist = await prisma.stockDistribution.create({
    data: { outletId: outlet.id, pieces, weightKg, estimated, note: input.note?.trim() || null, recordedBy: actor.name }
  });
  await logActivity({
    actorType: actor.type,
    actorId: actor.id ?? null,
    actorName: actor.name,
    action: 'stock.distribute',
    entityType: 'StockDistribution',
    entityId: dist.id,
    summary: `sent ${pieces} pieces (${weightKg} kg) to the ${outlet.name} outlet`
  });
  return { ok: true, record: { id: dist.id, pieces, weightKg, estimated, outletName: outlet.name } };
}

export async function recordSale(
  input: {
    outletId?: string;
    outlet?: string;
    pieces: number;
    weightKg: number;
    amountKsh?: number;
    channel?: string;
    note?: string | null;
  },
  actor: StockActor
): Promise<
  StockResult<{ id: string; pieces: number; weightKg: number; estimated: boolean; amountKsh: number; outletName: string }>
> {
  const outlet = input.outletId
    ? await prisma.outlet.findUnique({ where: { id: input.outletId } })
    : await findOutlet(input.outlet || '');
  if (!outlet) return { ok: false, error: 'Outlet not found - pick one of the existing outlets.' };
  if (!outlet.active) return { ok: false, error: `Outlet "${outlet.name}" is inactive.` };

  const declaredPieces = Math.max(0, Math.round(Number(input.pieces) || 0));
  const declaredKg = Math.max(0, r2(Number(input.weightKg) || 0));
  const amountKsh = Math.max(0, Math.round(Number(input.amountKsh) || 0));
  if (declaredPieces <= 0 && declaredKg <= 0) return { ok: false, error: 'Enter the pieces and/or the weight sold.' };

  const snapshot = await getStockSnapshot();
  const outletStock = snapshot.outlets.find((o) => o.id === outlet.id);
  if (!outletStock)
    return { ok: false, error: `The ${outlet.name} outlet has no stock yet - distribute fish to it first.` };

  const { pieces, weightKg, estimated } = deriveMissing(declaredPieces, declaredKg, snapshot.avgWeightKg);
  if (pieces <= 0 || weightKg <= 0)
    return { ok: false, error: 'Could not determine both pieces and weight - enter them explicitly.' };

  if (declaredPieces > outletStock.pieces)
    return { ok: false, error: `Only ${outletStock.pieces} pieces are at the ${outlet.name} outlet.` };
  if (declaredKg > outletStock.kg)
    return { ok: false, error: `Only ${outletStock.kg} kg are at the ${outlet.name} outlet.` };

  const channel = (input.channel || 'counter').trim();
  const sale = await prisma.outletSale.create({
    data: {
      outletId: outlet.id,
      pieces,
      weightKg,
      estimated,
      amountKsh,
      channel,
      note: input.note?.trim() || null,
      recordedBy: actor.name
    }
  });
  await logActivity({
    actorType: actor.type,
    actorId: actor.id ?? null,
    actorName: actor.name,
    action: 'stock.sale',
    entityType: 'OutletSale',
    entityId: sale.id,
    summary: `sold ${pieces} pieces (${weightKg} kg) at the ${outlet.name} outlet for KSh ${amountKsh.toLocaleString('en-KE')}`
  });
  return { ok: true, record: { id: sale.id, pieces, weightKg, estimated, amountKsh, outletName: outlet.name } };
}

export async function createOutlet(name: string, actor: StockActor): Promise<StockResult<{ id: string; name: string }>> {
  const clean = (name || '').trim();
  if (!clean) return { ok: false, error: 'Outlet name is required.' };
  const existing = await findOutlet(clean);
  if (existing) return { ok: false, error: `An outlet called "${existing.name}" already exists.` };
  const outlet = await prisma.outlet.create({ data: { name: clean } });
  await logActivity({
    actorType: actor.type,
    actorId: actor.id ?? null,
    actorName: actor.name,
    action: 'stock.outlet_create',
    entityType: 'Outlet',
    entityId: outlet.id,
    summary: `added the ${outlet.name} outlet`
  });
  return { ok: true, record: outlet };
}

/**
 * Admin-only tuning of one outlet's low-stock alert thresholds.
 * A threshold of 0 turns that dimension's alert off (useful for an outlet
 * that trades purely by weight or purely by count).
 */
export async function updateOutletThresholds(
  input: { outletId: string; lowStockPieces: number; lowStockKg: number },
  actor: StockActor
): Promise<StockResult<{ id: string; name: string; lowStockPieces: number; lowStockKg: number }>> {
  const outlet = await prisma.outlet.findUnique({ where: { id: input.outletId } });
  if (!outlet) return { ok: false, error: 'Outlet not found.' };

  const pieces = Math.round(Number(input.lowStockPieces));
  const kg = r2(Number(input.lowStockKg));
  if (!Number.isFinite(pieces) || pieces < 0) return { ok: false, error: 'Piece threshold must be 0 or more.' };
  if (!Number.isFinite(kg) || kg < 0) return { ok: false, error: 'Kg threshold must be 0 or more.' };

  const updated = await prisma.outlet.update({
    where: { id: outlet.id },
    data: { lowStockPieces: pieces, lowStockKg: kg }
  });
  await logActivity({
    actorType: actor.type,
    actorId: actor.id ?? null,
    actorName: actor.name,
    action: 'stock.outlet_thresholds',
    entityType: 'Outlet',
    entityId: outlet.id,
    summary: `set low-stock alerts for the ${outlet.name} outlet at ${pieces} pcs / ${kg} kg`
  });
  return { ok: true, record: { id: updated.id, name: updated.name, lowStockPieces: pieces, lowStockKg: kg } };
}
