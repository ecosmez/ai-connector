"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { MeResponse, apiRequest, readToken } from "@/lib/api";

type SsoConfig = {
  enabled: boolean;
  provider: string;
  jitProvisioning: boolean;
  issuer: string | null;
  clientId: string | null;
  configured: boolean;
};

export default function SsoSettingsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [config, setConfig] = useState<SsoConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (tok: string, organizationId: string) => {
    const cfg = await apiRequest<SsoConfig>(
      `/organizations/${organizationId}/sso`,
      { token: tok },
    );
    setConfig(cfg);
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

  async function onToggle(event: FormEvent) {
    event.preventDefault();
    if (!token || !orgId) return;
    setSaving(true);
    setError(null);
    try {
      const form = new FormData(event.currentTarget as HTMLFormElement);
      const enabled = form.get("enabled") === "on";
      const jitProvisioning = form.get("jit") === "on";
      const cfg = await apiRequest<SsoConfig>(`/organizations/${orgId}/sso`, {
        method: "PUT",
        token,
        body: { enabled, provider: "mock", jitProvisioning },
      });
      setConfig(cfg);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main>
      <AppNav current="SSO" />
      <h1 className="brand">SSO</h1>
      <p className="lead">
        Inicio de sesión empresarial (S9): OIDC con IdP mock para local/CI. SCIM
        sigue diferido.
      </p>

      {error && <p className="error">{error}</p>}

      {config && orgId && (
        <div className="panel" style={{ marginTop: 28 }}>
          <section>
            <h2>Configuración</h2>
            <form className="form" onSubmit={onToggle}>
              <label>
                <input
                  name="enabled"
                  type="checkbox"
                  defaultChecked={config.enabled}
                />{" "}
                Habilitar SSO (mock)
              </label>
              <label>
                <input
                  name="jit"
                  type="checkbox"
                  defaultChecked={config.jitProvisioning}
                />{" "}
                Provisionamiento JIT de miembros
              </label>
              <button
                className="button button-primary"
                type="submit"
                disabled={saving}
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </form>
            {config.configured && (
              <p style={{ marginTop: 16 }}>
                Issuer: <code>{config.issuer}</code>
                <br />
                Client ID: <code>{config.clientId}</code>
                <br />
                Org ID (login): <code>{orgId}</code>
              </p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
