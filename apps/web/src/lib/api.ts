const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function apiPost<T>(
  path: string,
  body: unknown,
  token?: string,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message ?? "Error de API");
  }
  return data as T;
}

export function saveToken(token: string) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem("ai_connector_token", token);
  }
}

export function readToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("ai_connector_token");
}
