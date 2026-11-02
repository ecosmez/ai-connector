export type ResolvedKpi = {
  key: string;
  label: string;
  value: number | null;
  unit: string | null;
  format: string;
  sourcePath: string;
};

type MetricLike = {
  key: string;
  label: string;
  sourcePath: string;
  aggregation: string;
  unit: string | null;
  format: string;
  sortOrder: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

/** Resolve `metrics.<key>` or `rows.*.<field>` (sum/avg/count/latest) from snapshot payload. */
export function resolveMetricValue(
  payload: unknown,
  sourcePath: string,
  aggregation: string,
): number | null {
  const root = asRecord(payload);
  if (!root) return null;

  if (sourcePath.startsWith("metrics.")) {
    const metricKey = sourcePath.slice("metrics.".length);
    const metrics = root.metrics;
    if (!Array.isArray(metrics)) return null;
    const hit = metrics.find(
      (m) => asRecord(m)?.key === metricKey || asRecord(m)?.label === metricKey,
    );
    return toNumber(asRecord(hit)?.value);
  }

  if (sourcePath.startsWith("rows.*.")) {
    const field = sourcePath.slice("rows.*.".length);
    const rows = root.rows;
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const values = rows
      .map((row) => toNumber(asRecord(row)?.[field]))
      .filter((n): n is number => n != null);
    if (values.length === 0) return null;
    switch (aggregation) {
      case "sum":
        return values.reduce((a, b) => a + b, 0);
      case "avg":
        return values.reduce((a, b) => a + b, 0) / values.length;
      case "count":
        return values.length;
      case "latest":
      default:
        return values[values.length - 1] ?? null;
    }
  }

  // Dotted path fallback on root object
  const parts = sourcePath.split(".");
  let cur: unknown = root;
  for (const part of parts) {
    const rec = asRecord(cur);
    if (!rec) return null;
    cur = rec[part];
  }
  return toNumber(cur);
}

export function resolveKpis(
  payload: unknown,
  metrics: MetricLike[],
): ResolvedKpi[] {
  return [...metrics]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((m) => ({
      key: m.key,
      label: m.label,
      value: resolveMetricValue(payload, m.sourcePath, m.aggregation),
      unit: m.unit,
      format: m.format,
      sourcePath: m.sourcePath,
    }));
}

export type GoalStatus = "on_track" | "off_track" | "no_data";

export function evaluateGoal(
  actual: number | null,
  target: number,
  comparator: string,
): GoalStatus {
  if (actual == null) return "no_data";
  if (comparator === "lte") {
    return actual <= target ? "on_track" : "off_track";
  }
  return actual >= target ? "on_track" : "off_track";
}

export function goalStatusLabelEs(status: GoalStatus): string {
  switch (status) {
    case "on_track":
      return "En meta";
    case "off_track":
      return "Fuera de meta";
    case "no_data":
      return "Sin dato";
  }
}

export const MOCK_METRIC_BOOTSTRAP: Array<{
  key: string;
  label: string;
  sourcePath: string;
  unit: string;
  format: string;
  sortOrder: number;
  aggregation?: string;
}> = [
  {
    key: "ventas_dia",
    label: "Ventas del día",
    sourcePath: "metrics.ventas_dia",
    unit: "uds",
    format: "number",
    sortOrder: 0,
  },
  {
    key: "inventario",
    label: "Inventario disponible",
    sourcePath: "metrics.inventario",
    unit: "uds",
    format: "number",
    sortOrder: 1,
  },
  {
    key: "leads",
    label: "Leads abiertos",
    sourcePath: "metrics.leads",
    unit: "leads",
    format: "number",
    sortOrder: 2,
  },
  {
    key: "ticket_promedio",
    label: "Ticket promedio",
    sourcePath: "metrics.ticket_promedio",
    unit: "USD",
    format: "currency",
    sortOrder: 3,
  },
  {
    key: "unidades_en_piso",
    label: "Unidades en piso (filas)",
    sourcePath: "rows.*.unidades",
    unit: "uds",
    format: "number",
    sortOrder: 4,
    aggregation: "sum",
  },
];
