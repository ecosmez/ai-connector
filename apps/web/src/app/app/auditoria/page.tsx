"use client";

import { useCallback, useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { MeResponse, apiRequest, readToken } from "@/lib/api";

type AuditEvent = {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  eventHash: string | null;
  createdAt: string;
};

type VerifyResult = {
  valid: boolean;
  eventsChecked: number;
  totalEvents: number;
  firstInvalidId: string | null;
};

export default function AuditoriaPage() {
  const [token, setToken] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [items, setItems] = useState<AuditEvent[]>([]);
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (tok: string, organizationId: string) => {
    const [list, status] = await Promise.all([
      apiRequest<{ items: AuditEvent[] }>(
        `/organizations/${organizationId}/audit-events`,
        { token: tok },
      ),
      apiRequest<VerifyResult>(
        `/organizations/${organizationId}/audit-events/verify`,
        { token: tok },
      ),
    ]);
    setItems(list.items);
    setVerify(status);
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

  async function downloadExport() {
    if (!token || !orgId) return;
    setBusy(true);
    setError(null);
    try {
      const payload = await apiRequest<unknown>(
        `/organizations/${orgId}/audit-events/export`,
        { token },
      );
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `auditoria-${orgId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage("Exportación descargada.");
      await refresh(token, orgId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <AppNav current="Auditoría" />
      <h1 className="brand">Auditoría</h1>
      <p className="lead">
        Eventos append-only con cadena hash (S7). Exporta JSON para evidencia
        externa.
      </p>

      {error && <p className="error">{error}</p>}
      {message && <p className="status ok">{message}</p>}

      <div className="panel" style={{ marginTop: 28 }}>
        <section>
          <h2>Integridad de cadena</h2>
          <p>
            {verify
              ? verify.valid
                ? `Válida · ${verify.eventsChecked} eventos verificados`
                : `Inválida · primer fallo: ${verify.firstInvalidId}`
              : "Cargando…"}
          </p>
          <div className="actions" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="button button-primary"
              disabled={busy || !token}
              onClick={downloadExport}
            >
              Exportar JSON
            </button>
          </div>
        </section>
      </div>

      <h2 className="section-title" style={{ marginTop: 36 }}>
        Eventos recientes
      </h2>
      <div className="panel">
        {items.length === 0 && (
          <section>
            <h2>Sin eventos</h2>
            <p>Las acciones sensibles aparecerán aquí.</p>
          </section>
        )}
        {items.map((ev) => (
          <section key={ev.id}>
            <h2>{ev.action}</h2>
            <p>
              {ev.resourceType}
              {ev.resourceId ? ` · ${ev.resourceId}` : ""} ·{" "}
              {new Date(ev.createdAt).toLocaleString("es-PR")}
            </p>
            <p style={{ fontSize: 12, wordBreak: "break-all", opacity: 0.7 }}>
              {ev.eventHash ?? "sin hash (legado)"}
            </p>
          </section>
        ))}
      </div>
    </main>
  );
}
