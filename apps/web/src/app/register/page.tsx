"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost, saveToken } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      const result = await apiPost<{ token: string }>("/auth/register", {
        email: String(form.get("email")),
        password: String(form.get("password")),
        name: String(form.get("name")),
      });
      saveToken(result.token);
      router.push("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar");
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
      <h1 className="brand">Crear cuenta</h1>
      <p className="lead">Registro local para el entorno de desarrollo.</p>
      <form className="form" onSubmit={onSubmit}>
        <label>
          Nombre
          <input name="name" required autoComplete="name" />
        </label>
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
            minLength={8}
            autoComplete="new-password"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="button button-primary" type="submit" disabled={loading}>
          {loading ? "Creando…" : "Crear cuenta"}
        </button>
      </form>
    </main>
  );
}
