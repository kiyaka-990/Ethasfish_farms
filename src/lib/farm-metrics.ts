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
