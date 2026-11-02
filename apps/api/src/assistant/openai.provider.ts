import OpenAI from "openai";
import {
  LlmCompletion,
  LlmMessage,
  LlmProvider,
  LlmToolDefinition,
} from "./llm.types";

export class OpenAiLlmProvider implements LlmProvider {
  readonly name = "openai";
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(apiKey: string, model = "gpt-4o-mini") {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async complete(input: {
    messages: LlmMessage[];
    tools: LlmToolDefinition[];
  }): Promise<LlmCompletion> {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
      input.messages.map((m) => {
        if (m.role === "tool") {
          return {
            role: "tool",
            tool_call_id: m.toolCallId,
            content: m.content,
          };
        }
        if (m.role === "assistant") {
          return {
            role: "assistant",
            content: m.content,
            ...(m.toolCalls?.length
              ? {
                  tool_calls: m.toolCalls.map((t) => ({
                    id: t.id,
                    type: "function" as const,
                    function: {
                      name: t.name,
                      arguments: t.argumentsJson,
                    },
                  })),
                }
              : {}),
          };
        }
        return { role: m.role, content: m.content };
      });

    const tools: OpenAI.Chat.Completions.ChatCompletionTool[] =
      input.tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));

    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages,
      tools: tools.length ? tools : undefined,
      tool_choice: tools.length ? "auto" : undefined,
      temperature: 0.2,
    });

    const choice = completion.choices[0]?.message;
    const toolCalls =
      choice?.tool_calls
        ?.filter((c) => c.type === "function")
        .map((c) => ({
          id: c.id,
          name: c.function.name,
          argumentsJson: c.function.arguments || "{}",
        })) ?? [];

    return {
      content: choice?.content ?? null,
      toolCalls,
      provider: this.name,
      model: this.model,
    };
  }
}
