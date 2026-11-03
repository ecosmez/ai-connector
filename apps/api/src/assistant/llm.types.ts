export type LlmToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type LlmMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; toolCalls?: LlmToolCall[] }
  | { role: "tool"; toolCallId: string; name: string; content: string };

export type LlmToolCall = {
  id: string;
  name: string;
  argumentsJson: string;
};

export type LlmCompletion = {
  content: string | null;
  toolCalls: LlmToolCall[];
  provider: string;
  model: string;
};

export interface LlmProvider {
  readonly name: string;
  complete(input: {
    messages: LlmMessage[];
    tools: LlmToolDefinition[];
  }): Promise<LlmCompletion>;
}
