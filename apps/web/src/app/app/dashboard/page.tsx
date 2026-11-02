"use client";

import { useCallback, useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { MeResponse, apiRequest, readToken } from "@/lib/api";

type DashboardView = {
  id: string;
  name: string;
  freshness: "fresh" | "stale" | "never";
  freshnessLabel: string;
  lastSyncedAt: string | null;
  connection: { name: string; provider: string };
  snapshot: {
    version: number;
    rowCount: number;
    payload: {
      metrics?: Array<{
        key: string;
        label: string;
        value: number;
        unit?: string;
      }>;
    };
  } | null;
};

export default function DashboardPage() {
  const [dashboards, setDashboards] = useState<DashboardView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");

  const load = useCallback(async () => {
    const token = readToken();
    if (!token) {
      setError("Sesión no encontrada. Inicia sesión.");
      return;
    }
    const me = await apiRequest<MeResponse>("/auth/me", { token });
    const first = me.memberships[0];
    if (!first) {
      setError("No hay membresías activas.");
      return;
    }
    setOrgName(first.organizationName);
    await apiRequest("/sessions/context", {
      method: "POST",
      token,
      body: {
        organizationId: first.organizationId,
        companyId: first.companyId,
      },
    });
    const list = await apiRequest<DashboardView[]>(
      `/organizations/${first.organizationId}/dashboards`,
      { token },
    );
    setDashboards(list);
  }, []);

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, [load]);

  return (
    <main>
      <AppNav current="Análisis" />
      <h1 className="brand">Dashboard</h1>
      <p className="lead">
        Panel persistente de frescura de datos
        {orgName ? ` · ${orgName}` : ""}.
      </p>

      {error && <p className="error">{error}</p>}

      <div className="panel">
        {dashboards.length === 0 && !error && (
          <section>
            <h2>Sin paneles</h2>
            <p>
              Crea un conector en Conexiones; se genera automáticamente un panel
              de frescura.
            </p>
          </section>
        )}
        {dashboards.map((d) => (
          <section key={d.id} className={`freshness-${d.freshness}`}>
            <h2>{d.name}</h2>
            <p>
              Conexión: {d.connection.name} ({d.connection.provider})
            </p>
            <p className={`freshness-badge freshness-${d.freshness}`}>
              {d.freshnessLabel}
            </p>
            <p>
              Última sincronización:{" "}
              {d.lastSyncedAt
                ? new Date(d.lastSyncedAt).toLocaleString("es-PR")
                : "—"}
            </p>
            {d.snapshot?.payload?.metrics && (
              <ul className="metric-list">
                {d.snapshot.payload.metrics.map((m) => (
                  <li key={m.key}>
                    <strong>{m.label}</strong>
                    <span>
                      {m.value.toLocaleString("es-PR")}
                      {m.unit ? ` ${m.unit}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {d.snapshot && (
              <p className="status">
                Snapshot v{d.snapshot.version} · {d.snapshot.rowCount} filas
              </p>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
