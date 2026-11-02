export type MockMetric = {
  key: string;
  label: string;
  value: number;
  unit?: string;
};

export type MockSnapshotPayload = {
  source: "mock";
  generatedAt: string;
  seed: number;
  metrics: MockMetric[];
  rows: Array<Record<string, string | number>>;
};

/** Deterministic-ish mock ERP/CRM extract for S1 demos and tests. */
export function fetchMockConnectorData(
  connectionId: string,
  config: Record<string, unknown> = {},
): MockSnapshotPayload {
  const now = new Date();
  const daySeed =
    now.getUTCFullYear() * 10000 +
    (now.getUTCMonth() + 1) * 100 +
    now.getUTCDate();
  const hash = [...connectionId].reduce(
    (acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0,
    daySeed,
  );
  const multiplier =
    typeof config.volumeMultiplier === "number" ? config.volumeMultiplier : 1;

  const ventas = Math.round((20 + (hash % 40)) * multiplier);
  const inventario = Math.round((60 + (hash % 80)) * multiplier);
  const leads = Math.round((8 + (hash % 25)) * multiplier);
  const ticket = Math.round(18000 + (hash % 12000));

  const rows = Array.from({ length: 5 }, (_, i) => ({
    sku: `MOCK-${(hash + i) % 1000}`.padStart(8, "0"),
    modelo: ["Sedán", "SUV", "Pickup", "Hatchback", "Van"][i % 5],
    unidades: Math.max(1, (inventario + i * 3) % 17),
    precio: ticket - i * 500,
  }));

  return {
    source: "mock",
    generatedAt: now.toISOString(),
    seed: hash,
    metrics: [
      { key: "ventas_dia", label: "Ventas del día", value: ventas, unit: "uds" },
      {
        key: "inventario",
        label: "Inventario disponible",
        value: inventario,
        unit: "uds",
      },
      { key: "leads", label: "Leads abiertos", value: leads, unit: "leads" },
      {
        key: "ticket_promedio",
        label: "Ticket promedio",
        value: ticket,
        unit: "USD",
      },
    ],
    rows,
  };
}
