import Link from "next/link";

export function AppNav({ current }: { current: string }) {
  const items = [
    { href: "/app", label: "Inicio" },
    { href: "/app/conexiones", label: "Conexiones" },
    { href: "/app/dashboard", label: "Análisis" },
    { href: "/app/metas", label: "Metas" },
    { href: "/app/asistente", label: "Asistente" },
  ];

  return (
    <nav className="nav" aria-label="Aplicación">
      <Link href="/">
        <strong>AI Connector</strong>
      </Link>
      {items.map((item) =>
        item.label === current ? (
          <span key={item.href} aria-current="page">
            {item.label}
          </span>
        ) : (
          <Link key={item.href} href={item.href}>
            {item.label}
          </Link>
        ),
      )}
    </nav>
  );
}
