"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { MeResponse, apiRequest, readToken } from "@/lib/api";

type Workflow = {
  id: string;
  name: string;
  description: string | null;
  steps: unknown;
  scheduleEnabled?: boolean;
  scheduleCron?: string | null;
};

type Run = {
  id: string;
  status: string;
  dryRun: boolean;
  definition?: { name: string };
  createdAt: string;
};

type Approval = {
  id: string;
  status: string;
  note: string | null;
  run: { id: string; definition: { name: string } };
};

const DEFAULT_STEPS = [
  {
    key: "check_ventas",
    type: "check_goal",
    config: { metricKey: "ventas_dia", requireOnTrack: true },
  },
  {
    key: "notify_ops",
    type: "notify",
    config: { message: "Meta de ventas en curso" },
  },
  {
    key: "approve_close",
    type: "wait_approval",
    config: { prompt: "¿Cerrar el ciclo?" },
  },
];

export default function AutomatizacionesPage() {
  const [token, setToken] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [name, setName] = useState("Alerta de ventas");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (tok: string, organizationId: string) => {
    const [wfs, runList, approvalList] = await Promise.all([
      apiRequest<Workflow[]>(`/organizations/${organizationId}/workflows`, {
        token: tok,
      }),
      apiRequest<Run[]>(`/organizations/${organizationId}/workflow-runs`, {
        token: tok,
      }),
      apiRequest<Approval[]>(
        `/organizations/${organizationId}/approvals?status=pending`,
        { token: tok },
      ),
    ]);
    setWorkflows(wfs);
    setRuns(runList);
    setApprovals(approvalList);
  }, []);

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

  async function createWorkflow(e: FormEvent) {
    e.preventDefault();
    if (!token || !orgId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiRequest(`/organizations/${orgId}/workflows`, {
        method: "POST",
        token,
        body: {
          name,
          description: "check_goal → notify → wait_approval",
          steps: DEFAULT_STEPS,
        },
      });
      setMessage("Automatización creada.");
      await refresh(token, orgId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function startRun(workflowId: string, dryRun: boolean) {
    if (!token || !orgId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const run = await apiRequest<Run>(
        `/organizations/${orgId}/workflows/${workflowId}/runs`,
        {
          method: "POST",
          token,
          headers: {
            "Idempotency-Key": `ui-${workflowId}-${dryRun}-${Date.now()}`,
          },
          body: { dryRun },
        },
      );
      setMessage(
        dryRun
          ? `Dry-run: ${run.status}`
          : `Ejecución: ${run.status}`,
      );
      await refresh(token, orgId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function toggleSchedule(workflow: Workflow, enabled: boolean) {
    if (!token || !orgId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiRequest(
        `/organizations/${orgId}/workflows/${workflow.id}/schedule`,
        {
          method: "POST",
          token,
          body: {
            enabled,
            cron: "0 8 * * *",
            timezone: "America/Puerto_Rico",
          },
        },
      );
      setMessage(
        enabled
          ? "Programación diaria 08:00 activada."
          : "Programación desactivada.",
      );
      await refresh(token, orgId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function decide(approvalId: string, decision: "approved" | "rejected") {
    if (!token || !orgId) return;
    setBusy(true);
    try {
      await apiRequest(
        `/organizations/${orgId}/approvals/${approvalId}/decide`,
        {
          method: "POST",
          token,
          body: { decision },
        },
      );
      setMessage(
        decision === "approved" ? "Aprobación concedida." : "Aprobación rechazada.",
      );
      await refresh(token, orgId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <AppNav current="Automatizaciones" />
      <h1 className="brand">Automatizaciones</h1>
      <p className="lead">
        Flujos lineales (BullMQ): verificar meta, notificar al centro de avisos y
        pedir aprobación humana. Dry-run simula sin efectos; programa ejecuciones
        diarias.
      </p>

      {error && <p className="error">{error}</p>}
      {message && <p className="status ok">{message}</p>}

      <form className="form" onSubmit={createWorkflow}>
        <label>
          Nombre
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <button className="button button-primary" type="submit" disabled={busy}>
          Crear flujo estándar
        </button>
      </form>

      <div className="panel" style={{ marginTop: 28 }}>
        {workflows.length === 0 && (
          <section>
            <h2>Sin automatizaciones</h2>
            <p>Crea un flujo para empezar (check_goal → notify → approval).</p>
          </section>
        )}
        {workflows.map((w) => (
          <section key={w.id}>
            <h2>{w.name}</h2>
            <p>{w.description ?? "Sin descripción"}</p>
            <p>
              {w.scheduleEnabled
                ? `Programada · ${w.scheduleCron ?? "cron"}`
                : "Sin programación"}
            </p>
            <div className="actions" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="button button-secondary"
                disabled={busy}
                onClick={() => startRun(w.id, true)}
              >
                Dry-run
              </button>
              <button
                type="button"
                className="button button-primary"
                disabled={busy}
                onClick={() => startRun(w.id, false)}
              >
                Ejecutar
              </button>
              <button
                type="button"
                className="button button-secondary"
                disabled={busy}
                onClick={() => toggleSchedule(w, !w.scheduleEnabled)}
              >
                {w.scheduleEnabled ? "Quitar horario" : "Programar 08:00"}
              </button>
            </div>
          </section>
        ))}
      </div>

      <h2 className="section-title" style={{ marginTop: 36 }}>
        Aprobaciones pendientes
      </h2>
      <div className="panel">
        {approvals.length === 0 && (
          <section>
            <h2>Nada pendiente</h2>
            <p>Las ejecuciones reales con wait_approval aparecerán aquí.</p>
          </section>
        )}
        {approvals.map((a) => (
          <section key={a.id}>
            <h2>{a.run.definition.name}</h2>
            <p>{a.note ?? "Se requiere decisión"}</p>
            <div className="actions" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="button button-primary"
                disabled={busy}
                onClick={() => decide(a.id, "approved")}
              >
                Aprobar
              </button>
              <button
                type="button"
                className="button button-secondary"
                disabled={busy}
                onClick={() => decide(a.id, "rejected")}
              >
                Rechazar
              </button>
            </div>
          </section>
        ))}
      </div>

      <h2 className="section-title" style={{ marginTop: 36 }}>
        Ejecuciones recientes
      </h2>
      <div className="panel">
        {runs.length === 0 && (
          <section>
            <h2>Sin ejecuciones</h2>
            <p>Lanza un dry-run o una ejecución real.</p>
          </section>
        )}
        {runs.map((r) => (
          <section key={r.id}>
            <h2>{r.definition?.name ?? "Flujo"}</h2>
            <p>
              Estado: {r.status}
              {r.dryRun ? " · dry-run" : ""} ·{" "}
              {new Date(r.createdAt).toLocaleString("es-PR")}
            </p>
          </section>
        ))}
      </div>
    </main>
  );
}
