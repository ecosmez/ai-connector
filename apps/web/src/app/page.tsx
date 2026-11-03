import Link from "next/link";
import { ApiStatus } from "@/components/api-status";

export default function HomePage() {
  return (
    <main>
      <nav className="nav" aria-label="Principal">
        <strong>AI Connector</strong>
        <span>Inicio</span>
        <span>Análisis</span>
        <span>Automatizaciones</span>
        <span>Conexiones</span>
        <span>Configuración</span>
      </nav>

      <h1 className="brand">AI Connector</h1>
      <p className="lead">
        Plataforma multi-tenant de inteligencia de negocios y automatización.
        Sincroniza un conector de prueba y mira la frescura de tus datos.
      </p>

      <div className="actions">
        <Link className="button button-primary" href="/login">
          Iniciar sesión
        </Link>
        <Link className="button button-secondary" href="/register">
          Crear cuenta
        </Link>
      </div>

      <div className="panel">
        <section>
          <h2>Sync + frescura</h2>
          <p>
            Conector mock, sync manual o diario a las 00:00 (zona org) y panel
            con estado fresco u obsoleto.
          </p>
        </section>
        <section>
          <h2>Asistente con herramientas</h2>
          <p>
            Pregunta en español por KPIs y metas; el asistente solo lee datos de
            tu organización (mock u OpenAI).
          </p>
        </section>
      </div>

      <ApiStatus />
    </main>
  );
}
