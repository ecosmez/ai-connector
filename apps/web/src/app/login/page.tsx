"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost, saveToken } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      const result = await apiPost<{ token: string }>("/auth/login", {
        email: String(form.get("email")),
        password: String(form.get("password")),
      });
      saveToken(result.token);
      router.push("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
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
      <p className="lead">Accede con tu cuenta local (S0).</p>
      <form className="form" onSubmit={onSubmit}>
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
        {error && <p className="error">{error}</p>}
        <button className="button button-primary" type="submit" disabled={loading}>
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
