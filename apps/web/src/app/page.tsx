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
        Esta base (S0) ofrece identidad, organizaciones, compañías y auditoría.
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
          <h2>Fundación lista</h2>
          <p>
            Autenticación local, aislamiento por organización y eventos de
            auditoría append-only.
          </p>
        </section>
        <section>
          <h2>Siguiente incremento</h2>
          <p>
            S1: conector de prueba, sincronización diaria (00:00 zona org) y un
            dashboard persistente con frescura de datos.
          </p>
        </section>
      </div>

      <ApiStatus />
    </main>
  );
}
