import { LlmProvider } from "./llm.types";
import { MockLlmProvider } from "./mock.provider";
import { OpenAiLlmProvider } from "./openai.provider";

export function createLlmProvider(): LlmProvider {
  const mode = (process.env.AI_PROVIDER ?? "").toLowerCase();
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (mode === "mock" || !apiKey) {
    return new MockLlmProvider();
  }
  return new OpenAiLlmProvider(
    apiKey,
    process.env.AI_MODEL?.trim() || "gpt-4o-mini",
  );
}

export function isAssistantEnabled(): boolean {
  if (process.env.AI_ENABLED === "0" || process.env.AI_ENABLED === "false") {
    return false;
  }
  // Enabled by default in S3; mock provider covers missing keys.
  return true;
}
