"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { saveToken } from "@/lib/api";

function CompleteInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setError("Falta el token SSO.");
      return;
    }
    saveToken(token);
    router.replace("/app");
  }, [params, router]);

  return (
    <>
      <h1 className="brand">SSO</h1>
      <p className="lead">{error ?? "Completando inicio de sesión…"}</p>
      {error && (
        <p>
          <Link href="/login">Volver al login</Link>
        </p>
      )}
    </>
  );
}

export default function SsoCompletePage() {
  return (
    <main>
      <nav className="nav">
        <Link href="/">
          <strong>AI Connector</strong>
        </Link>
      </nav>
      <Suspense fallback={<p className="lead">Completando inicio de sesión…</p>}>
        <CompleteInner />
      </Suspense>
    </main>
  );
}
