import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
export async function synthesize<T extends z.ZodType>(
  schema: T,
  system: string,
  input: unknown,
): Promise<z.infer<T>> {
  if (!process.env.ANTHROPIC_API_KEY)
    throw new Error("ANTHROPIC_API_KEY is missing");
  const client = new Anthropic({ timeout: 180000, maxRetries: 1 });
  const response = await client.messages.parse({
    model: process.env.SYNTHESIS_MODEL || "claude-opus-5-5",
    max_tokens: 10000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: zodOutputFormat(schema) },
    system,
    messages: [{ role: "user", content: JSON.stringify(input) }],
  });
  if (!response.parsed_output)
    throw new Error("Synthesis returned no structured output");
  return response.parsed_output;
}
