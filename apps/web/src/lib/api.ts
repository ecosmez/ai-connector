const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export { API_URL };

export async function apiRequest<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string | null;
    headers?: Record<string, string>;
  } = {},
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 304) {
    return undefined as T;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof data === "object" && data && "message" in data
        ? String((data as { message: string }).message)
        : "Error de API",
    );
  }
  return data as T;
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  token?: string,
): Promise<T> {
  return apiRequest<T>(path, { method: "POST", body, token });
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

export type Membership = {
  organizationId: string;
  organizationName: string;
  companyId: string | null;
  companyName: string | null;
};

export type MeResponse = {
  user: { name: string; email: string };
  memberships: Membership[];
};
