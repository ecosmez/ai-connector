"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL, apiPost, saveToken } from "@/lib/api";

type LoginResponse =
  | { token: string; mfaRequired?: false }
  | { mfaRequired: true; mfaToken: string };

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [ssoLoading, setSsoLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      if (mfaToken) {
        const result = await apiPost<{ token: string }>("/auth/mfa/verify", {
          mfaToken,
          code: String(form.get("code")),
        });
        saveToken(result.token);
        router.push("/app");
        return;
      }

      const result = await apiPost<LoginResponse>("/auth/login", {
        email: String(form.get("email")),
        password: String(form.get("password")),
      });
      if ("mfaRequired" in result && result.mfaRequired) {
        setMfaToken(result.mfaToken);
        return;
      }
      saveToken(result.token);
      router.push("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  async function onSso(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSsoLoading(true);
    const form = new FormData(event.currentTarget);
    const organizationId = String(form.get("organizationId")).trim();
    try {
      const res = await fetch(
        `${API_URL}/auth/sso/start?organizationId=${encodeURIComponent(organizationId)}`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data === "object" && data && "message" in data
            ? String((data as { message: string }).message)
            : "No se pudo iniciar SSO",
        );
      }
      window.location.href = (data as { authorizeUrl: string }).authorizeUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar SSO");
      setSsoLoading(false);
    }
  }

  return (
    <main>
      <nav className="nav">
        <Link href="/">
          <strong>AI Connector</strong>
        </Link>
      </nav>
      <h1 className="brand">Iniciar sesión</h1>
      <p className="lead">
        {mfaToken
          ? "Introduce el código de tu autenticador (MFA)."
          : "Accede con tu cuenta local o SSO de organización."}
      </p>
      <form className="form" onSubmit={onSubmit}>
        {!mfaToken ? (
          <>
            <label>
              Correo
              <input name="email" type="email" required autoComplete="email" />
            </label>
            <label>
              Contraseña
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </label>
          </>
        ) : (
          <label>
            Código MFA
            <input
              name="code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              required
              autoComplete="one-time-code"
              autoFocus
            />
          </label>
        )}
        {error && <p className="error">{error}</p>}
        <button className="button button-primary" type="submit" disabled={loading}>
          {loading ? "Entrando…" : mfaToken ? "Verificar" : "Entrar"}
        </button>
      </form>

      {!mfaToken && (
        <form className="form" style={{ marginTop: 36 }} onSubmit={onSso}>
          <h2 className="section-title">SSO</h2>
          <label>
            ID de organización
            <input name="organizationId" required placeholder="seed_org_a" />
          </label>
          <button
            className="button"
            type="submit"
            disabled={ssoLoading}
          >
            {ssoLoading ? "Redirigiendo…" : "Continuar con SSO"}
          </button>
        </form>
      )}
    </main>
  );
}
