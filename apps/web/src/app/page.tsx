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
          <h2>Conector de prueba</h2>
          <p>
            Crea una conexión mock, lanza sync manual o espera la corrida diaria
            a las 00:00 en la zona de tu organización.
          </p>
        </section>
        <section>
          <h2>Dashboard con frescura</h2>
          <p>
            Un panel persistente muestra métricas del último snapshot y si los
            datos están frescos u obsoletos.
          </p>
        </section>
      </div>

      <ApiStatus />
    </main>
  );
}
