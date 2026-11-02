import { describe, expect, it } from "vitest";
import {
  evaluateGoal,
  resolveKpis,
  resolveMetricValue,
} from "../../src/semantic/kpi-resolve";

const payload = {
  source: "mock",
  metrics: [
    { key: "ventas_dia", label: "Ventas del día", value: 21, unit: "uds" },
    { key: "leads", label: "Leads", value: 9 },
  ],
  rows: [
    { unidades: 2 },
    { unidades: 5 },
    { unidades: 3 },
  ],
};

describe("kpi-resolve", () => {
  it("resolves metrics.<key>", () => {
    expect(resolveMetricValue(payload, "metrics.ventas_dia", "latest")).toBe(21);
  });

  it("sums rows.*.field", () => {
    expect(resolveMetricValue(payload, "rows.*.unidades", "sum")).toBe(10);
  });

  it("maps metric definitions to KPIs", () => {
    const kpis = resolveKpis(payload, [
      {
        key: "ventas_dia",
        label: "Ventas",
        sourcePath: "metrics.ventas_dia",
        aggregation: "latest",
        unit: "uds",
        format: "number",
        sortOrder: 0,
      },
    ]);
    expect(kpis[0]?.value).toBe(21);
  });

  it("evaluates goals", () => {
    expect(evaluateGoal(21, 15, "gte")).toBe("on_track");
    expect(evaluateGoal(10, 15, "gte")).toBe("off_track");
    expect(evaluateGoal(null, 15, "gte")).toBe("no_data");
    expect(evaluateGoal(8, 10, "lte")).toBe("on_track");
  });
});
