"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readToken } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type MeResponse = {
  user: { name: string; email: string };
  memberships: Array<{
    organizationId: string;
    organizationName: string;
    companyId: string | null;
    companyName: string | null;
  }>;
};

export default function AppHomePage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = readToken();
    if (!token) {
      setError("Sesión no encontrada. Inicia sesión.");
      return;
    }
    fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Sesión inválida");
        return res.json();
      })
      .then(setMe)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <main>
      <nav className="nav">
        <Link href="/">
          <strong>AI Connector</strong>
        </Link>
        <span>Inicio</span>
      </nav>
      <h1 className="brand">Inicio</h1>
      {error && <p className="error">{error}</p>}
      {me && (
        <>
          <p className="lead">
            Hola, {me.user.name}. Membresías activas:
          </p>
          <div className="panel">
            {me.memberships.length === 0 && (
              <section>
                <h2>Sin organización</h2>
                <p>
                  Crea una organización desde la API o el próximo wizard (S1/S3).
                </p>
              </section>
            )}
            {me.memberships.map((m) => (
              <section key={`${m.organizationId}-${m.companyId ?? "org"}`}>
                <h2>{m.organizationName}</h2>
                <p>
                  {m.companyName
                    ? `Compañía: ${m.companyName}`
                    : "Acceso a nivel organización"}
                </p>
              </section>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
