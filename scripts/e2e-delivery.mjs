// End-to-end test harness for the delivery feature.
//
//   node scripts/e2e-delivery.mjs setup   -> throwaway staff + Clerk user + test order
//                                             (writes .e2e-state.json)
//   node scripts/e2e-delivery.mjs run      -> full HTTP assertion suite against the
//                                             running server (mints its own session)
//   node scripts/e2e-delivery.mjs clean    -> removes every row + identity it created
//
// Auth: this is a Clerk *development* instance, whose middleware refuses cookie
// auth without a `__clerk_db_jwt` dev-browser token (reason "dev-browser-missing").
// That check in @clerk/backend is presence-only (`!!devBrowserToken`), so `run`
// mints a real Backend-API session token for the throwaway user and pairs it with
// a placeholder dev-browser cookie - no browser or password sign-in needed.
// (`__client_uat` must be current or Clerk treats the cookie as stale.)
import { config } from 'dotenv';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
config({ path: '.env.local' });
const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');

const BASE = process.argv[3] && process.argv[3].startsWith('http') ? process.argv[3] : 'http://127.0.0.1:3001';
const CLERK_KEY = process.env.CLERK_SECRET_KEY;
const STATE_FILE = new URL('../.e2e-state.json', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const TEST_TAG = 'TEST-DO-NOT-DELIVER';
const MODE = process.argv[2];
const p = new PrismaClient();

let results = [], failed = false;
const ok = (name, cond, detail = '') => {
  results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!cond) failed = true;
};

const clerkHeaders = { authorization: `Bearer ${CLERK_KEY}`, 'content-type': 'application/json' };
const clerk = (path, method = 'GET', body) =>
  fetch(`https://api.clerk.com/v1${path}`, { method, headers: clerkHeaders, body: body ? JSON.stringify(body) : undefined });

// Short-lived session token (60s) for the throwaway user + the cookie set the
// Clerk middleware accepts on a development instance.
async function mintCookie(userId) {
  const s = await clerk('/sessions', 'POST', { user_id: userId });
  if (!s.ok) throw new Error(`session create failed: ${s.status} ${await s.text()}`);
  const session = await s.json();
  const t = await clerk(`/sessions/${session.id}/tokens`, 'POST', {});
  if (!t.ok) throw new Error(`token create failed: ${t.status}`);
  const tj = await t.json();
  const jwt = tj.jwt || tj.token;
  if (!jwt) throw new Error(`unexpected token response: ${JSON.stringify(tj)}`);
  return `__session=${jwt}; __client_uat=${Math.floor(Date.now() / 1000)}; __clerk_db_jwt=e2e-dev-browser`;
}

async function req(path, { method = 'GET', body, cookie } = {}) {
  const res = await fetch(BASE + path, {
    method,
    redirect: 'manual',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let json = null;
  try { json = await res.json(); } catch { /* HTML (redirect etc.) */ }
  return { status: res.status, json, location: res.headers.get('location') };
}

function saveState(s) { writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); }
function loadState() { return existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : null; }

// ---------------- setup ----------------
async function setup() {
  if (!CLERK_KEY) throw new Error('CLERK_SECRET_KEY missing from .env.local');
  const email = `e2e-dispatch-${Date.now()}@example.com`;
  const password = 'e2e-only-pw-92731!';

  // 1. Staff row, exactly the way Admin > Staff provisions one (pending link).
  const staff = await p.staffProfile.create({
    data: { email, name: 'E2E Dispatcher', role: 'admin', clerkUserId: `pending:${email}:${Date.now()}` }
  });

  // 2. Throwaway Clerk user (this instance's API wants email_address as an ARRAY).
  const uRes = await clerk('/users', 'POST', { email_address: [email], password });
  if (!uRes.ok) throw new Error(`Clerk user create failed: ${uRes.status} ${await uRes.text()}`);
  const user = await uRes.json();

  // 3. Test order (or reuse a leftover one).
  let order = await p.order.findFirst({ where: { customerName: TEST_TAG }, orderBy: { createdAt: 'desc' } });
  if (!order) {
    const v = await p.productVariant.findFirst({ where: { active: true, product: { active: true } }, include: { product: true } });
    if (!v) throw new Error('no active variant to build a test order from');
    order = await p.order.create({
      data: {
        orderNumber: `EF-TEST-${Date.now().toString(36).toUpperCase()}`,
        customerName: TEST_TAG, customerPhone: '0700000000',
        deliveryAddress: 'Milimani Road, Kisumu',
        subtotal: v.priceKsh, total: v.priceKsh, status: 'paid', paymentStatus: 'paid',
        channel: 'online',
        items: { create: { productId: v.productId, variantId: v.id, productName: v.product.name, variantLabel: v.label, unitPrice: v.priceKsh, quantity: 1, lineTotal: v.priceKsh } }
      }
    });
  }

  // 4. Test rider, temporarily linked to the test staff so /driver + ping work.
  let rider = await p.driver.findFirst({ where: { phone: '0700000000' } });
  const state = {
    email, password, staffId: staff.id, clerkUserId: user.id,
    orderIds: [order.id], orderNumber: order.orderNumber,
    riderId: null, createdRider: false, originalRiderStaff: null
  };
  if (rider) {
    state.originalRiderStaff = rider.staffId;
    await p.driver.update({ where: { id: rider.id }, data: { staffId: staff.id } });
    state.riderId = rider.id;
  } else {
    rider = await p.driver.create({
      data: { name: 'Test Rider', phone: '0700000000', plate: 'KTEST01', vehicle: 'motorcycle', staffId: staff.id }
    });
    state.riderId = rider.id;
    state.createdRider = true;
  }

  saveState(state);
  console.log(JSON.stringify({ email, password, orderNumber: order.orderNumber, orderId: order.id, riderId: rider.id }, null, 2));
  console.log('\nNext: node scripts/e2e-delivery.mjs run');
}

// ---------------- assertion suite ----------------
async function run() {
  const state = loadState();
  if (!state) throw new Error('no .e2e-state.json - run setup first');
  const { staffId, riderId, orderIds, orderNumber } = state;
  const cookie = await mintCookie(state.clerkUserId);
  const auth = { cookie };
  const testOrderId = orderIds[0];
  const live = () => req(`/api/orders/live?order=${encodeURIComponent(orderNumber)}`);

  // First authenticated request also links the pending staff row to the user.
  const who = await req('/api/admin/deliveries', auth);
  if (who.status !== 200) {
    ok('authenticated session accepted', false, `status ${who.status} - session mint rejected`);
    return;
  }

  // 1. Dispatch board
  ok('dispatch board returns 200', who.status === 200, `status ${who.status}`);
  ok('test order sits in the unassigned queue', who.json?.queue?.some((o) => o.id === testOrderId) === true);
  ok('test rider listed on the board', who.json?.drivers?.some((d) => d.id === riderId) === true);
  const staff = await p.staffProfile.findUnique({ where: { id: staffId } });
  ok('pending staff row linked on first sign-in', !staff.clerkUserId.startsWith('pending:'), staff.clerkUserId);

  // 2. Assign
  const assign = await req('/api/admin/deliveries', { method: 'POST', cookie, body: { orderId: testOrderId, driverId: riderId } });
  ok('assign driver succeeds', assign.status === 200, assign.json?.error || '');
  const deliveryId = assign.json?.delivery?.id;
  ok('delivery row created', Boolean(deliveryId));
  if (!deliveryId) return;
  // Geocoding can miss (odd address / offline) - dispatch then drops a pin by
  // hand. Either way the destination must exist before the customer sees an ETA.
  let destRow = await p.delivery.findUnique({ where: { id: deliveryId } });
  const geocoded = destRow?.destLat != null;
  if (!geocoded) {
    const fix = await req('/api/admin/deliveries', { method: 'PATCH', cookie, body: { deliveryId, lat: -0.094, lng: 34.765 } });
    ok('dispatcher pin fallback when geocode misses', fix.status === 200, JSON.stringify(fix.json?.error));
    destRow = await p.delivery.findUnique({ where: { id: deliveryId } });
  }
  ok('destination known after assignment', destRow?.destLat != null, geocoded ? 'geocoded' : 'pinned manually');
  ok('assigned order moved to preparing', (await p.order.findUnique({ where: { id: testOrderId } })).status === 'preparing');

  // 3. Driver app
  const driverApp = await req('/api/driver', auth);
  ok('driver app returns my job', driverApp.status === 200 && driverApp.json?.jobs?.some((j) => j.id === deliveryId), driverApp.json?.error || '');

  // 4. Ping guards + first ping
  const bad = await req('/api/driver/ping', { method: 'POST', cookie, body: { lat: 999, lng: 0 } });
  ok('invalid coordinates rejected', bad.status === 400, `status ${bad.status}`);
  const ping1 = await req('/api/driver/ping', { method: 'POST', cookie, body: { lat: -0.0917, lng: 34.768, speedKph: 22 } });
  ok('GPS ping accepted', ping1.status === 200 && ping1.json?.ok === true, JSON.stringify(ping1.json));

  // 5. Before pickup the customer sees stage but no rider position
  const before = await live();
  ok('live: assigned stage, no position yet', before.status === 200 && before.json?.delivery?.stage === 'assigned' && !before.json?.delivery?.position, JSON.stringify(before.json?.delivery));

  // 6. Out-of-order guard
  const early = await req('/api/driver', { method: 'PATCH', cookie, body: { deliveryId, action: 'delivered' } });
  ok('delivered-before-pickup rejected', early.status === 400, `status ${early.status}`);

  // 7. Pickup -> live rider
  const pickup = await req('/api/driver', { method: 'PATCH', cookie, body: { deliveryId, action: 'picked_up' } });
  ok('driver marks picked up', pickup.status === 200, pickup.json?.error || '');
  ok('order moved to out_for_delivery', (await p.order.findUnique({ where: { id: testOrderId } })).status === 'out_for_delivery');

  const riding = await live();
  const pos1 = riding.json?.delivery?.position;
  ok('live: rider position revealed while riding', riding.status === 200 && pos1?.lat === -0.0917, JSON.stringify(pos1));
  ok('live: ETA computed', typeof riding.json?.delivery?.etaMin === 'number', String(riding.json?.delivery?.etaMin));
  ok('live: first name + vehicle only', riding.json?.delivery?.driverName === 'Test' && riding.json?.delivery?.driverVehicle === 'motorcycle');
  const liveRaw = JSON.stringify(riding.json);
  ok('live: no phone numbers leak', !liveRaw.includes('0700000000') && !liveRaw.includes('customerPhone'));
  ok('live: map center provided', riding.json?.delivery?.mapCenter != null);

  // 8. Second ping after the 3s server throttle
  await new Promise((r) => setTimeout(r, 3500));
  const ping2 = await req('/api/driver/ping', { method: 'POST', cookie, body: { lat: -0.0955, lng: 34.7705, speedKph: 18 } });
  ok('second ping accepted', ping2.json?.ok === true, JSON.stringify(ping2.json));
  const riding2 = await live();
  ok('live: position advanced', riding2.json?.delivery?.position?.lat === -0.0955, JSON.stringify(riding2.json?.delivery?.position));

  // 9. Dispatch overrides
  const board2 = await req('/api/admin/deliveries', auth);
  ok('active delivery shown on the board', board2.json?.deliveries?.some((d) => d.id === deliveryId) === true);
  const unassign = await req('/api/admin/deliveries', { method: 'PATCH', cookie, body: { deliveryId, action: 'unassign' } });
  ok('unassign after pickup rejected', unassign.status === 400, `status ${unassign.status}`);
  const pin = await req('/api/admin/deliveries', { method: 'PATCH', cookie, body: { deliveryId, lat: -0.1, lng: 34.76 } });
  ok('dispatcher can move the destination pin', pin.status === 200 && pin.json?.delivery?.destLat === -0.1, JSON.stringify(pin.json?.error));

  // 10. Deliver
  const drop = await req('/api/driver', { method: 'PATCH', cookie, body: { deliveryId, action: 'delivered' } });
  ok('driver marks delivered', drop.status === 200, drop.json?.error || '');
  ok('order moved to delivered', (await p.order.findUnique({ where: { id: testOrderId } })).status === 'delivered');
  const after = await live();
  ok('live: rider hidden after delivery', after.json?.delivery?.stage === 'delivered' && !after.json?.delivery?.position);
  const board3 = await req('/api/admin/deliveries', auth);
  ok('delivered ride leaves the active board', board3.json?.deliveries?.every((d) => d.id !== deliveryId));
  const history = await req('/api/driver', auth);
  ok('ride lands in driver history', history.json?.history?.some((h) => h.id === deliveryId) === true);

  // 11. Reports
  const rep = await req('/api/admin/deliveries/reports?days=7', auth);
  ok('reports return 200', rep.status === 200, rep.json?.error || '');
  ok('report counts the delivery', (rep.json?.totals?.delivered ?? 0) >= 1, JSON.stringify(rep.json?.totals));
  ok('7-day series returned', Array.isArray(rep.json?.series) && rep.json.series.length === 7);
  const league = rep.json?.driverStats?.find((s) => s.driverId === riderId);
  ok('driver league table includes the rider', !!league && league.delivered >= 1, JSON.stringify(league));

  // 12. Roster
  const roster = await req('/api/admin/drivers', auth);
  ok('driver roster returns 200', roster.status === 200 && roster.json?.drivers?.some((d) => d.id === riderId));

  // 13. Public pages
  const trackPage = await fetch(`${BASE}/track?order=${encodeURIComponent(orderNumber)}`, { redirect: 'manual' });
  const trackHtml = await trackPage.text();
  ok('/track renders for the order', trackPage.status === 200 && trackHtml.length > 500, `status ${trackPage.status}, ${trackHtml.length}B`);
  const anonBoard = await fetch(`${BASE}/api/admin/deliveries`, { redirect: 'manual' });
  ok('dispatch API still 401 for guests', anonBoard.status === 401, `status ${anonBoard.status}`);

  // 14. The middleware-gated HTML pages themselves: proxy must bounce guests
  // to /sign-in and serve the board + driver app to a signed-in session.
  const anonPage = await fetch(`${BASE}/admin/deliveries`, { redirect: 'manual' });
  ok('guest bounced off the dispatch board page',
    anonPage.status >= 300 && anonPage.status < 400 && (anonPage.headers.get('location') || '').includes('/sign-in'),
    `status ${anonPage.status} -> ${anonPage.headers.get('location')}`);
  const boardRes = await fetch(`${BASE}/admin/deliveries`, { redirect: 'manual', headers: { cookie } });
  const boardHtml = await boardRes.text();
  ok('dispatch board page serves to staff', boardRes.status === 200 && boardHtml.length > 1000, `status ${boardRes.status}, ${boardHtml.length}B`);
  const driverRes = await fetch(`${BASE}/driver`, { redirect: 'manual', headers: { cookie } });
  const driverHtml = await driverRes.text();
  ok('driver app page serves to the rider', driverRes.status === 200 && driverHtml.length > 500, `status ${driverRes.status}, ${driverHtml.length}B`);
}

// ---------------- clean ----------------
async function clean() {
  const state = loadState();
  if (!state) { console.log('nothing to clean (no .e2e-state.json)'); return; }
  try {
    if (state.clerkUserId) await clerk(`/sessions?user_id=${state.clerkUserId}`, 'DELETE').catch(() => {});
    if (state.clerkUserId) await clerk(`/users/${state.clerkUserId}`, 'DELETE').catch(() => {});
    await p.staffProfile.delete({ where: { id: state.staffId } }).catch(() => {});
    if (state.riderId) {
      if (state.createdRider) await p.driver.delete({ where: { id: state.riderId } }).catch(() => {});
      else await p.driver.update({ where: { id: state.riderId }, data: { staffId: state.originalRiderStaff } }).catch(() => {});
    }
    for (const orderId of state.orderIds || []) {
      const d = await p.delivery.findUnique({ where: { orderId } });
      if (d) {
        await p.driverPosition.deleteMany({ where: { deliveryId: d.id } });
        await p.delivery.delete({ where: { id: d.id } });
      }
      await p.order.delete({ where: { id: orderId } }).catch(() => {});
    }
    // Any stray test orders from interrupted runs.
    const strays = await p.order.findMany({ where: { customerName: TEST_TAG }, select: { id: true } });
    for (const o of strays) {
      const d = await p.delivery.findUnique({ where: { orderId: o.id } });
      if (d) {
        await p.driverPosition.deleteMany({ where: { deliveryId: d.id } });
        await p.delivery.delete({ where: { id: d.id } });
      }
      await p.order.delete({ where: { id: o.id } });
    }
    unlinkSync(STATE_FILE);
    console.log('clean: removed test order(s), delivery, rider (restored), staff row, Clerk user + sessions');
  } catch (e) {
    console.error('cleanup problem:', e.message);
  }
}

// ---------------- main ----------------
try {
  if (MODE === 'setup') await setup();
  else if (MODE === 'run') {
    await run();
    console.log(results.join('\n'));
    const passed = results.filter((r) => r.startsWith('PASS')).length;
    console.log(`\n${passed}/${results.length} checks passed`);
    process.exitCode = failed ? 1 : 0;
  } else if (MODE === 'clean') await clean();
  else console.log('usage: setup | run | clean');
} catch (e) {
  console.error('ERROR', e.message);
  if (MODE === 'run') { console.log(results.join('\n')); process.exitCode = 1; }
  else process.exitCode = 1;
} finally {
  await p.$disconnect();
}
