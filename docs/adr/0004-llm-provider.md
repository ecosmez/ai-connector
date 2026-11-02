# ADR 0004 — LLM provider

**Status:** Accepted (centralized); provider named for planning  
**Decision class:** Was PENDIENTE (D6); now CONFIRMADO by accepting defaults.

## Context

Spec forbids customer BYOK in initial scope. AI wizard/assistant arrive in S3.

## Decision

- **Mode:** single centrally managed provider for AI Connector (no customer API keys).
- **Initial provider:** OpenAI (chat + tool calling).
- **Safety (from day of AI work):** tool allowlist, schema validation, tenant-scoped tools, confirmation for sensitive actions; never auto-activate automations.

## Consequences

- S0 does not call any LLM.
- S3 introduces an AI orchestrator module behind feature flags with prompt-injection defenses for external docs/data.
- Provider swap remains possible via adapter interface; cost/rate limits are platform-owned.
