"use client";

import { useCallback, useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { MeResponse, apiRequest, readToken } from "@/lib/api";

type Overview = {
  organizations: number;
  users: number;
  companies: number;
  connections: number;
  workflowDefinitions: number;
  workflowRuns: number;
  platformAdmins: number;
};

type OrgRow = {
  id: string;
  name: string;
  timezone: string;
  createdAt: string;
  memberCount: number;
  companyCount: number;
  connectionCount: number;
};

type Health = {
  status: string;
  database: string;
  redis: string;
};

export default function PlataformaPage() {
  const [token, setToken] = useState<string | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (tok: string) => {
    const [ov, orgList, h] = await Promise.all([
      apiRequest<Overview>("/platform/overview", { token: tok }),
      apiRequest<{ items: OrgRow[] }>("/platform/organizations", {
        token: tok,
      }),
      apiRequest<Health>("/platform/health", { token: tok }),
    ]);
    setOverview(ov);
    setOrgs(orgList.items);
    setHealth(h);
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
        if (!me.user.isPlatformAdmin) {
          setError(
            "Se requiere administrador de plataforma (isPlatformAdmin).",
          );
          return;
        }
        await load(tok);
      })
      .catch((err: Error) => setError(err.message));
  }, [load]);

  return (
    <main>
      <AppNav current="Plataforma" />
      <h1 className="brand">Plataforma</h1>
      <p className="lead">
        Consola de operaciones (S8): directorio y conteos. No expone payloads de
        tenants.
      </p>

      {error && <p className="error">{error}</p>}

      {overview && (
        <div className="panel" style={{ marginTop: 28 }}>
          <section>
            <h2>Resumen</h2>
            <p>
              Orgs {overview.organizations} · Usuarios {overview.users} ·
              Compañías {overview.companies} · Conexiones {overview.connections}
            </p>
            <p>
              Flujos {overview.workflowDefinitions} · Ejecuciones{" "}
              {overview.workflowRuns} · Admins plataforma{" "}
              {overview.platformAdmins}
            </p>
          </section>
          {health && (
            <section>
              <h2>Salud</h2>
              <p>
                API {health.status} · DB {health.database} · Redis{" "}
                {health.redis}
              </p>
            </section>
          )}
        </div>
      )}

      <h2 className="section-title" style={{ marginTop: 36 }}>
        Organizaciones
      </h2>
      <div className="panel">
        {orgs.length === 0 && !error && (
          <section>
            <h2>Sin datos</h2>
            <p>No hay organizaciones visibles.</p>
          </section>
        )}
        {orgs.map((o) => (
          <section key={o.id}>
            <h2>{o.name}</h2>
            <p>
              {o.timezone} · miembros {o.memberCount} · compañías{" "}
              {o.companyCount} · conexiones {o.connectionCount}
            </p>
            <p style={{ fontSize: 12, opacity: 0.7 }}>
              {new Date(o.createdAt).toLocaleString("es-PR")}
            </p>
          </section>
        ))}
      </div>
      {!token && null}
    </main>
  );
}
