"use client";

import { useCallback, useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { MeResponse, apiRequest, readToken } from "@/lib/api";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  sourceType: string | null;
};

export default function NotificacionesPage() {
  const [token, setToken] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (tok: string, organizationId: string) => {
    const list = await apiRequest<NotificationItem[]>(
      `/organizations/${organizationId}/notifications`,
      { token: tok },
    );
    setItems(list);
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

  async function markRead(id: string) {
    if (!token || !orgId) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest(
        `/organizations/${orgId}/notifications/${id}/read`,
        { method: "POST", token },
      );
      setMessage("Marcada como leída.");
      await refresh(token, orgId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <AppNav current="Notificaciones" />
      <h1 className="brand">Notificaciones</h1>
      <p className="lead">
        Centro de avisos in-app generados por automatizaciones (paso notify).
      </p>

      {error && <p className="error">{error}</p>}
      {message && <p className="status ok">{message}</p>}

      <div className="panel" style={{ marginTop: 28 }}>
        {items.length === 0 && (
          <section>
            <h2>Bandeja vacía</h2>
            <p>
              Ejecuta una automatización con notify (sin dry-run) para ver avisos
              aquí.
            </p>
          </section>
        )}
        {items.map((n) => (
          <section key={n.id}>
            <h2>{n.title}</h2>
            <p>{n.body}</p>
            <p>
              {n.readAt ? "Leída" : "Sin leer"} ·{" "}
              {new Date(n.createdAt).toLocaleString("es-PR")}
              {n.sourceType ? ` · ${n.sourceType}` : ""}
            </p>
            {!n.readAt && (
              <div className="actions" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={busy}
                  onClick={() => markRead(n.id)}
                >
                  Marcar leída
                </button>
              </div>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
