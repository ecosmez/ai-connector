"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function ApiStatus() {
  const [status, setStatus] = useState<"checking" | "ok" | "down">("checking");

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/health`)
      .then((res) => {
        if (!cancelled) setStatus(res.ok ? "ok" : "down");
      })
      .catch(() => {
        if (!cancelled) setStatus("down");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <p className="status">
      API:{" "}
      {status === "checking" && "comprobando…"}
      {status === "ok" && <span style={{ color: "var(--ok)" }}>en línea</span>}
      {status === "down" && (
        <span style={{ color: "var(--danger)" }}>no disponible</span>
      )}
    </p>
  );
}
