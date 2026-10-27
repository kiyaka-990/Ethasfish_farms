// Metric metadata shared by the server (rules, ingest, advisor) and the
// client dashboard. Deliberately free of Prisma/server imports - the
// Farm Intelligence page imports this directly.

export interface MetricMeta {
  label: string;
  unit: string;
  decimals: number;
}

// Agreed metric names. Devices may report others (they are stored and
// charted generically) - these are the ones we format nicely.
export const METRICS: Record<string, MetricMeta> = {
  temperature_c: { label: 'Water temperature', unit: '°C', decimals: 1 },
  water_level_pct: { label: 'Water level', unit: '%', decimals: 0 },
  ph: { label: 'pH', unit: '', decimals: 2 },
  dissolved_oxygen: { label: 'Dissolved oxygen', unit: 'mg/L', decimals: 2 },
  humidity: { label: 'Humidity', unit: '%', decimals: 0 }
};

export function metricMeta(metric: string): MetricMeta {
  return METRICS[metric] || { label: metric.replace(/_/g, ' '), unit: '', decimals: 2 };
}

export function formatValue(metric: string, value: number): string {
  const m = metricMeta(metric);
  return `${value.toFixed(m.decimals)}${m.unit ? ' ' + m.unit : ''}`;
}

export const ACTUATOR_COMMANDS = ['pump_on', 'pump_off', 'aerator_on', 'aerator_off'] as const;
export type ActuatorCommand = (typeof ACTUATOR_COMMANDS)[number];

// Normalize Kenyan formats to WhatsApp's 254... form:
// 0722... -> 254722..., +254.../spaces/dashes -> digits only.
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return null;
  if (digits.startsWith('254')) return digits;
  if (digits.startsWith('0')) return '254' + digits.slice(1);
  if (digits.startsWith('7') || digits.startsWith('1')) return '254' + digits;
  return digits;
}

export function parseRecipients(csv: string | null | undefined): string[] {
  if (!csv) return [];
  return [...new Set(csv.split(',').map(normalizePhone).filter((p): p is string => !!p))];
}
