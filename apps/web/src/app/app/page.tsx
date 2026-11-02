"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { MeResponse, apiRequest, readToken } from "@/lib/api";

export default function AppHomePage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = readToken();
    if (!token) {
      setError("Sesión no encontrada. Inicia sesión.");
      return;
    }
    apiRequest<MeResponse>("/auth/me", { token })
      .then(setMe)
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <main>
      <AppNav current="Inicio" />
      <h1 className="brand">Inicio</h1>
      {error && <p className="error">{error}</p>}
      {me && (
        <>
          <p className="lead">
            Hola, {me.user.name}. Elige una conexión o revisa la frescura del
            panel.
          </p>
          <div className="actions">
            <Link className="button button-primary" href="/app/conexiones">
              Conexiones
            </Link>
            <Link className="button button-secondary" href="/app/dashboard">
              Ver dashboard
            </Link>
          </div>
          <div className="panel">
            {me.memberships.length === 0 && (
              <section>
                <h2>Sin organización</h2>
                <p>Crea una organización desde la API para comenzar.</p>
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
