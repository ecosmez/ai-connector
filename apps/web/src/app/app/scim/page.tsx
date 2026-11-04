"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { MeResponse, apiRequest, readToken } from "@/lib/api";

type TokenRow = {
  id: string;
  name: string;
  tokenPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export default function ScimPage() {
  const [token, setToken] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [items, setItems] = useState<TokenRow[]>([]);
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (tok: string, organizationId: string) => {
    const res = await apiRequest<{ items: TokenRow[] }>(
      `/organizations/${organizationId}/scim/tokens`,
      { token: tok },
    );
    setItems(res.items);
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
          setError("Sin organización activa.");
          return;
        }
        setOrgId(first.organizationId);
        await load(tok, first.organizationId);
      })
      .catch((err: Error) => setError(err.message));
  }, [load]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!token || !orgId) return;
    setBusy(true);
    setError(null);
    setFreshToken(null);
    try {
      const form = new FormData(event.currentTarget as HTMLFormElement);
      const name = String(form.get("name") || "SCIM").trim();
      const created = await apiRequest<{ token: string }>(
        `/organizations/${orgId}/scim/tokens`,
        { method: "POST", token, body: { name } },
      );
      setFreshToken(created.token);
      await load(token, orgId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear");
    } finally {
      setBusy(false);
    }
  }

  async function onRevoke(id: string) {
    if (!token || !orgId) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest(
        `/organizations/${orgId}/scim/tokens/${id}/revoke`,
        { method: "POST", token, body: {} },
      );
      await load(token, orgId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo revocar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <AppNav current="SCIM" />
      <h1 className="brand">SCIM</h1>
      <p className="lead">
        Provisionamiento de usuarios (S10): tokens bearer para IdP. Grupos y
        bulk siguen diferidos.
      </p>

      {error && <p className="error">{error}</p>}

      {orgId && (
        <div className="panel" style={{ marginTop: 28 }}>
          <section>
            <h2>Nuevo token</h2>
            <form className="form" onSubmit={onCreate}>
              <label>
                Nombre
                <input name="name" defaultValue="Entra SCIM" />
              </label>
              <button
                className="button button-primary"
                type="submit"
                disabled={busy}
              >
                {busy ? "Creando…" : "Generar token"}
              </button>
            </form>
            {freshToken && (
              <p style={{ marginTop: 16 }}>
                Copia ahora (solo se muestra una vez):
                <br />
                <code style={{ wordBreak: "break-all" }}>{freshToken}</code>
              </p>
            )}
            <p style={{ marginTop: 12 }}>
              Base SCIM: <code>/scim/v2/Users</code>
              <br />
              Org: <code>{orgId}</code>
            </p>
          </section>
        </div>
      )}

      <h2 className="section-title" style={{ marginTop: 36 }}>
        Tokens
      </h2>
      <div className="panel">
        {items.length === 0 && !error && (
          <section>
            <h2>Sin tokens</h2>
            <p>Genera un token para conectar tu IdP.</p>
          </section>
        )}
        {items.map((t) => (
          <section key={t.id}>
            <h2>{t.name}</h2>
            <p>
              Prefijo <code>{t.tokenPrefix}…</code>
              {t.revokedAt ? " · Revocado" : " · Activo"}
              {t.lastUsedAt
                ? ` · Último uso ${new Date(t.lastUsedAt).toLocaleString()}`
                : ""}
            </p>
            {!t.revokedAt && (
              <button
                className="button"
                type="button"
                disabled={busy}
                onClick={() => onRevoke(t.id)}
              >
                Revocar
              </button>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
