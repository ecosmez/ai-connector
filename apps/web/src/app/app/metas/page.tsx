"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { MeResponse, apiRequest, readToken } from "@/lib/api";

type Goal = {
  id: string;
  name: string;
  metricKey: string;
  targetValue: number;
  comparator: string;
  status: string;
};

type DashboardView = {
  id: string;
  name: string;
  kpis: Array<{ key: string; label: string }>;
};

export default function MetasPage() {
  const [token, setToken] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [dashboards, setDashboards] = useState<DashboardView[]>([]);
  const [name, setName] = useState("Nueva meta");
  const [metricKey, setMetricKey] = useState("ventas_dia");
  const [targetValue, setTargetValue] = useState("20");
  const [dashboardId, setDashboardId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (tok: string, organizationId: string) => {
    const [goalList, dashList] = await Promise.all([
      apiRequest<Goal[]>(`/organizations/${organizationId}/goals`, {
        token: tok,
      }),
      apiRequest<DashboardView[]>(
        `/organizations/${organizationId}/dashboards`,
        { token: tok },
      ),
    ]);
    setGoals(goalList);
    setDashboards(dashList);
    if (!dashboardId && dashList[0]) setDashboardId(dashList[0].id);
    if (dashList[0]?.kpis[0] && metricKey === "ventas_dia") {
      setMetricKey(dashList[0].kpis[0].key);
    }
  }, [dashboardId, metricKey]);

  useEffect(() => {
    const tok = readToken();
    if (!tok) {
      setError("Sesión no encontrada. Inicia sesión.");
      return;
    }
    setToken(tok);
    apiRequest<MeResponse>("/auth/me", { token: tok })
      .then(async (me) => {
        const first = me.memberships[0];
        if (!first) {
          setError("No hay membresías activas.");
          return;
        }
        setOrgId(first.organizationId);
        await apiRequest("/sessions/context", {
          method: "POST",
          token: tok,
          body: {
            organizationId: first.organizationId,
            companyId: first.companyId,
          },
        });
        await refresh(tok, first.organizationId);
      })
      .catch((err: Error) => setError(err.message));
  }, [refresh]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token || !orgId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiRequest(`/organizations/${orgId}/goals`, {
        method: "POST",
        token,
        body: {
          name,
          metricKey,
          targetValue: Number(targetValue),
          comparator: "gte",
          dashboardId: dashboardId || undefined,
        },
      });
      setMessage("Meta creada.");
      await refresh(token, orgId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  const metricOptions =
    dashboards.find((d) => d.id === dashboardId)?.kpis ??
    dashboards[0]?.kpis ??
    [];

  return (
    <main>
      <AppNav current="Metas" />
      <h1 className="brand">Metas</h1>
      <p className="lead">
        Define objetivos sobre KPIs del modelo semántico. El progreso se evalúa
        con el último snapshot.
      </p>

      {error && <p className="error">{error}</p>}
      {message && <p className="status ok">{message}</p>}

      <form className="form" onSubmit={onSubmit}>
        <label>
          Nombre
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Dashboard
          <select
            value={dashboardId}
            onChange={(e) => setDashboardId(e.target.value)}
          >
            {dashboards.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          KPI
          <select
            value={metricKey}
            onChange={(e) => setMetricKey(e.target.value)}
          >
            {metricOptions.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
            {metricOptions.length === 0 && (
              <option value="ventas_dia">ventas_dia</option>
            )}
          </select>
        </label>
        <label>
          Valor objetivo
          <input
            type="number"
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            required
          />
        </label>
        <button className="button button-primary" type="submit" disabled={busy}>
          Crear meta
        </button>
      </form>

      <div className="panel" style={{ marginTop: 32 }}>
        {goals.length === 0 && (
          <section>
            <h2>Sin metas</h2>
            <p>Crea la primera meta o sincroniza un conector con bootstrap S2.</p>
          </section>
        )}
        {goals.map((g) => (
          <section key={g.id}>
            <h2>{g.name}</h2>
            <p>
              KPI: {g.metricKey} · Objetivo:{" "}
              {g.targetValue.toLocaleString("es-PR")} ({g.comparator})
            </p>
          </section>
        ))}
      </div>
    </main>
  );
}
