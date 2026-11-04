"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { MeResponse, apiRequest, readToken } from "@/lib/api";

type MfaStatus = { enabled: boolean; pendingSetup: boolean; type: string | null };
type SetupPayload = { secret: string; otpauthUrl: string };

type SecurityPolicy = { organizationId: string; requireMfa: boolean };

export default function SeguridadPage() {
  const [token, setToken] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [policy, setPolicy] = useState<SecurityPolicy | null>(null);
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [setup, setSetup] = useState<SetupPayload | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (tok: string, organizationId?: string) => {
    const s = await apiRequest<MfaStatus>("/auth/mfa", { token: tok });
    setStatus(s);
    if (organizationId) {
      const p = await apiRequest<SecurityPolicy>(
        `/organizations/${organizationId}/security-policy`,
        { token: tok },
      );
      setPolicy(p);
    }
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
        if (first) setOrgId(first.organizationId);
        await refresh(tok, first?.organizationId);
      })
      .catch((err: Error) => setError(err.message));
  }, [refresh]);

  async function savePolicy(e: FormEvent) {
    e.preventDefault();
    if (!token || !orgId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const form = new FormData(e.currentTarget as HTMLFormElement);
      const requireMfa = form.get("requireMfa") === "on";
      const p = await apiRequest<SecurityPolicy>(
        `/organizations/${orgId}/security-policy`,
        { method: "PUT", token, body: { requireMfa } },
      );
      setPolicy(p);
      setMessage(
        requireMfa
          ? "La organización ahora exige MFA para contraseña."
          : "Exigencia de MFA desactivada.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function startSetup() {
    if (!token) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const payload = await apiRequest<SetupPayload>("/auth/mfa/setup", {
        method: "POST",
        token,
      });
      setSetup(payload);
      setMessage("Escanea el secreto en tu app autenticadora y confirma el código.");
      await refresh(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function enable(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest("/auth/mfa/enable", {
        method: "POST",
        token,
        body: { code },
      });
      setSetup(null);
      setCode("");
      setMessage("MFA activado.");
      await refresh(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function disable(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest("/auth/mfa/disable", {
        method: "POST",
        token,
        body: { password, code },
      });
      setPassword("");
      setCode("");
      setMessage("MFA desactivado.");
      await refresh(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <AppNav current="Seguridad" />
      <h1 className="brand">Seguridad</h1>
      <p className="lead">
        MFA personal (TOTP) y política de organización (S11). SSO queda
        exento de esta exigencia.
      </p>

      {error && <p className="error">{error}</p>}
      {message && <p className="status ok">{message}</p>}

      <div className="panel" style={{ marginTop: 28 }}>
        <section>
          <h2>Estado MFA</h2>
          <p>
            {status?.enabled
              ? "Activo (TOTP)"
              : status?.pendingSetup
                ? "Configuración pendiente de confirmación"
                : "Inactivo"}
          </p>
          {!status?.enabled && (
            <div className="actions" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="button button-primary"
                disabled={busy}
                onClick={startSetup}
              >
                Configurar autenticador
              </button>
            </div>
          )}
        </section>
      </div>

      {setup && !status?.enabled && (
        <form className="form" onSubmit={enable} style={{ marginTop: 28 }}>
          <h2 className="section-title">Confirmar código</h2>
          <p>
            Secreto: <code>{setup.secret}</code>
          </p>
          <p style={{ wordBreak: "break-all", fontSize: 12 }}>
            {setup.otpauthUrl}
          </p>
          <label>
            Código de 6 dígitos
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              pattern="[0-9]{6}"
              required
              autoComplete="one-time-code"
            />
          </label>
          <button className="button button-primary" type="submit" disabled={busy}>
            Activar MFA
          </button>
        </form>
      )}

      {orgId && policy && (
        <div className="panel" style={{ marginTop: 28 }}>
          <section>
            <h2>Política de organización</h2>
            <form className="form" onSubmit={savePolicy}>
              <label>
                <input
                  name="requireMfa"
                  type="checkbox"
                  defaultChecked={policy.requireMfa}
                  key={String(policy.requireMfa)}
                />{" "}
                Exigir MFA para inicio con contraseña
              </label>
              <p style={{ fontSize: 14, opacity: 0.8 }}>
                Activa MFA personal antes de exigirla. Sesiones SSO no aplican.
              </p>
              <button
                className="button button-primary"
                type="submit"
                disabled={busy}
              >
                Guardar política
              </button>
            </form>
          </section>
        </div>
      )}

      {status?.enabled && (
        <form className="form" onSubmit={disable} style={{ marginTop: 28 }}>
          <h2 className="section-title">Desactivar MFA</h2>
          <label>
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          <label>
            Código actual
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              pattern="[0-9]{6}"
              required
              autoComplete="one-time-code"
            />
          </label>
          <button className="button button-secondary" type="submit" disabled={busy}>
            Desactivar
          </button>
        </form>
      )}
    </main>
  );
}
