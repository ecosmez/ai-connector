"use client";

import { useCallback, useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { MeResponse, apiRequest, readToken } from "@/lib/api";

type Kpi = {
  key: string;
  label: string;
  value: number | null;
  unit: string | null;
  format: string;
};

type GoalView = {
  id: string;
  name: string;
  metricLabel: string;
  targetValue: number;
  actualValue: number | null;
  unit: string | null;
  status: string;
  statusLabel: string;
  progressPercent: number | null;
};

type DashboardView = {
  id: string;
  name: string;
  freshness: "fresh" | "stale" | "never";
  freshnessLabel: string;
  lastSyncedAt: string | null;
  connection: { name: string; provider: string };
  semanticModelId: string | null;
  kpis: Kpi[];
  goals: GoalView[];
  snapshot: { version: number; rowCount: number } | null;
};

function formatValue(kpi: Pick<Kpi, "value" | "unit" | "format">) {
  if (kpi.value == null) return "—";
  const formatted =
    kpi.format === "currency"
      ? kpi.value.toLocaleString("es-PR", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        })
      : kpi.value.toLocaleString("es-PR");
  if (kpi.format === "currency") return formatted;
  return `${formatted}${kpi.unit ? ` ${kpi.unit}` : ""}`;
}

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
      <h1 className="brand">Análisis</h1>
      <p className="lead">
        KPIs del modelo semántico, metas y frescura de datos
        {orgName ? ` · ${orgName}` : ""}.
      </p>

      {error && <p className="error">{error}</p>}

      <div className="panel">
        {dashboards.length === 0 && !error && (
          <section>
            <h2>Sin paneles</h2>
            <p>
              Crea un conector en Conexiones; se generan el modelo semántico, el
              panel y una meta inicial.
            </p>
          </section>
        )}
        {dashboards.map((d) => (
          <section key={d.id} className={`freshness-${d.freshness}`}>
            <h2>{d.name}</h2>
            <p>
              Conexión: {d.connection.name} ({d.connection.provider})
              {d.semanticModelId ? " · modelo semántico activo" : ""}
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

            {d.kpis.length > 0 && (
              <>
                <h3 className="section-title">KPIs</h3>
                <ul className="metric-list">
                  {d.kpis.map((m) => (
                    <li key={m.key}>
                      <strong>{m.label}</strong>
                      <span>{formatValue(m)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {d.goals.length > 0 && (
              <>
                <h3 className="section-title">Metas</h3>
                <ul className="goal-list">
                  {d.goals.map((g) => (
                    <li key={g.id}>
                      <div className="goal-head">
                        <strong>{g.name}</strong>
                        <span className={`goal-status goal-${g.status}`}>
                          {g.statusLabel}
                        </span>
                      </div>
                      <p>
                        {g.metricLabel}:{" "}
                        {formatValue({
                          value: g.actualValue,
                          unit: g.unit,
                          format: "number",
                        })}{" "}
                        / meta {g.targetValue.toLocaleString("es-PR")}
                        {g.unit ? ` ${g.unit}` : ""}
                      </p>
                      <div
                        className="goal-bar"
                        aria-hidden={g.progressPercent == null}
                      >
                        <div
                          className={`goal-bar-fill goal-${g.status}`}
                          style={{
                            width: `${Math.max(0, Math.min(100, g.progressPercent ?? 0))}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </>
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
