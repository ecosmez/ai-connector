"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { MeResponse, apiRequest, readToken } from "@/lib/api";

type Thread = { id: string; title: string; updatedAt: string };
type ChatMessage = {
  id: string;
  role: string;
  content: string;
  toolName?: string | null;
};

export default function AsistentePage() {
  const [token, setToken] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("¿Cómo van las ventas y las metas?");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<string>("");

  const loadThread = useCallback(
    async (tok: string, organizationId: string, id: string) => {
      const detail = await apiRequest<{ messages: ChatMessage[] }>(
        `/organizations/${organizationId}/assistant/threads/${id}`,
        { token: tok },
      );
      setThreadId(id);
      setMessages(
        detail.messages.filter(
          (m) => m.role === "user" || m.role === "assistant",
        ),
      );
    },
    [],
  );

  const refreshThreads = useCallback(
    async (tok: string, organizationId: string) => {
      const list = await apiRequest<Thread[]>(
        `/organizations/${organizationId}/assistant/threads`,
        { token: tok },
      );
      setThreads(list);
      return list;
    },
    [],
  );

  useEffect(() => {
    const tok = readToken();
    if (!tok) {
      setError("Sesión no encontrada. Inicia sesión.");
      return;
    }
    setToken(tok);
    apiRequest<MeResponse>("/auth/me", { token: tok })
      .then(async (me) => {
        const first = me.memberships[0];
        if (!first) {
          setError("No hay membresías activas.");
          return;
        }
        setOrgId(first.organizationId);
        await apiRequest("/sessions/context", {
          method: "POST",
          token: tok,
          body: {
            organizationId: first.organizationId,
            companyId: first.companyId,
          },
        });
        const status = await apiRequest<{ mode: string }>(
          "/assistant/status",
          { token: tok },
        );
        setProvider(status.mode);
        const list = await refreshThreads(tok, first.organizationId);
        if (list[0]) {
          await loadThread(tok, first.organizationId, list[0].id);
        }
      })
      .catch((err: Error) => setError(err.message));
  }, [loadThread, refreshThreads]);

  async function ensureThread() {
    if (!token || !orgId) return null;
    if (threadId) return threadId;
    const created = await apiRequest<Thread>(
      `/organizations/${orgId}/assistant/threads`,
      {
        method: "POST",
        token,
        body: { title: "Consulta" },
      },
    );
    setThreadId(created.id);
    await refreshThreads(token, orgId);
    return created.id;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token || !orgId || !input.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const id = await ensureThread();
      if (!id) return;
      const turn = await apiRequest<{
        message: ChatMessage;
        provider: string;
        toolsUsed: string[];
      }>(`/organizations/${orgId}/assistant/threads/${id}/messages`, {
        method: "POST",
        token,
        body: { content: input.trim() },
      });
      setProvider(turn.provider);
      setInput("");
      await loadThread(token, orgId, id);
      await refreshThreads(token, orgId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function newThread() {
    if (!token || !orgId) return;
    setBusy(true);
    try {
      const created = await apiRequest<Thread>(
        `/organizations/${orgId}/assistant/threads`,
        {
          method: "POST",
          token,
          body: { title: "Nueva consulta" },
        },
      );
      setMessages([]);
      setThreadId(created.id);
      await refreshThreads(token, orgId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <AppNav current="Asistente" />
      <h1 className="brand">Asistente</h1>
      <p className="lead">
        Consulta KPIs, frescura y metas con herramientas de solo lectura
        {provider ? ` · proveedor ${provider}` : ""}.
      </p>

      {error && <p className="error">{error}</p>}

      <div className="assistant-layout">
        <aside className="assistant-threads">
          <button
            type="button"
            className="button button-secondary"
            onClick={newThread}
            disabled={busy}
          >
            Nueva consulta
          </button>
          <ul>
            {threads.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className={t.id === threadId ? "active" : ""}
                  onClick={() =>
                    token &&
                    orgId &&
                    loadThread(token, orgId, t.id).catch((err: Error) =>
                      setError(err.message),
                    )
                  }
                >
                  {t.title}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="assistant-chat">
          <div className="assistant-messages">
            {messages.length === 0 && (
              <p className="status">
                Pregunta por ventas, inventario o metas para activar las
                herramientas.
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`bubble bubble-${m.role === "user" ? "user" : "assistant"}`}
              >
                <strong>{m.role === "user" ? "Tú" : "Asistente"}</strong>
                <pre>{m.content}</pre>
              </div>
            ))}
          </div>

          <form className="assistant-form" onSubmit={onSubmit}>
            <label>
              Mensaje
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={3}
                required
              />
            </label>
            <button
              className="button button-primary"
              type="submit"
              disabled={busy}
            >
              Enviar
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
