"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import {
  MeResponse,
  apiRequest,
  readToken,
} from "@/lib/api";

type Connection = {
  id: string;
  name: string;
  provider: string;
  status: string;
  lastSyncedAt: string | null;
  organizationId: string;
};

export default function ConexionesPage() {
  const [token, setToken] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string>("");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [name, setName] = useState("Conector de prueba");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async (tok: string, organizationId: string) => {
    const list = await apiRequest<Connection[]>(
      `/organizations/${organizationId}/connections`,
      { token: tok },
    );
    setConnections(list);
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
        setOrgName(first.organizationName);
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

  async function createConnection(e: FormEvent) {
    e.preventDefault();
    if (!token || !orgId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiRequest(`/organizations/${orgId}/connections`, {
        method: "POST",
        token,
        body: { name },
      });
      setMessage("Conexión creada. Se programó la sincronización diaria a las 00:00 (zona de la organización).");
      await refresh(token, orgId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function syncNow(connectionId: string) {
    if (!token || !orgId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const key = `manual-${connectionId}-${Date.now()}`;
      const run = await apiRequest<{ status: string; id: string }>(
        `/organizations/${orgId}/connections/${connectionId}/sync`,
        {
          method: "POST",
          token,
          headers: { "Idempotency-Key": key },
        },
      );
      setMessage(
        run.status === "succeeded"
          ? "Sincronización completada."
          : `Sincronización: ${run.status}`,
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
      <AppNav current="Conexiones" />
      <h1 className="brand">Conexiones</h1>
      <p className="lead">
        Conector de prueba (mock) para {orgName || "tu organización"}. La
        sincronización diaria corre a las 00:00 en la zona horaria de la
        organización o compañía.
      </p>

      {error && <p className="error">{error}</p>}
      {message && <p className="status ok">{message}</p>}

      <form className="form" onSubmit={createConnection}>
        <label>
          Nombre
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <button className="button button-primary" type="submit" disabled={busy}>
          Crear conector mock
        </button>
      </form>

      <div className="panel" style={{ marginTop: 32 }}>
        {connections.length === 0 && (
          <section>
            <h2>Sin conexiones</h2>
            <p>Crea un conector de prueba para generar el primer snapshot.</p>
          </section>
        )}
        {connections.map((c) => (
          <section key={c.id}>
            <h2>{c.name}</h2>
            <p>
              Proveedor: {c.provider} · Estado: {c.status}
              <br />
              Última sync:{" "}
              {c.lastSyncedAt
                ? new Date(c.lastSyncedAt).toLocaleString("es-PR")
                : "nunca"}
            </p>
            <div className="actions" style={{ marginTop: 12 }}>
              <button
                className="button button-secondary"
                type="button"
                disabled={busy}
                onClick={() => syncNow(c.id)}
              >
                Sincronizar ahora
              </button>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
