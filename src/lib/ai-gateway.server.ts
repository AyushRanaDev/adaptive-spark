/**
 * Minimal server-only helper for the Lovable AI Gateway Responses API.
 * Always streams (reasoning models can run for minutes) and accumulates the
 * final text server-side.
 */

type JsonSchema = Record<string, unknown>;

export async function generateJson<T>({
  system,
  prompt,
  schemaName,
  schema,
  effort = "low",
}: {
  system: string;
  prompt: string;
  schemaName: string;
  schema: JsonSchema;
  effort?: "low" | "medium" | "high";
}): Promise<T> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-5.6-sol",
      stream: true,
      instructions: system,
      input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
      reasoning: { effort, summary: "auto" },
      text: {
        format: {
          type: "json_schema",
          name: schemaName,
          strict: true,
          schema,
        },
      },
    }),
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("The AI tutor is busy right now. Try again in a moment.");
    if (res.status === 402)
      throw new Error("AI credits are exhausted for this workspace. Add credits in Lovable to continue.");
    throw new Error(`AI request failed (${res.status}). ${detail.slice(0, 300)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const evt = JSON.parse(payload);
        if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
          text += evt.delta;
        } else if (evt.type === "response.completed" && !text) {
          const out = evt.response?.output_text;
          if (typeof out === "string") text = out;
        }
      } catch {
        /* ignore partial frames */
      }
    }
  }

  if (!text.trim()) throw new Error("The AI tutor returned an empty response. Please retry.");
  return JSON.parse(text) as T;
}

export const obj = (properties: Record<string, unknown>): JsonSchema => ({
  type: "object",
  additionalProperties: false,
  properties,
  required: Object.keys(properties),
});

export const arr = (items: unknown): JsonSchema => ({ type: "array", items });
export const str = (description?: string): JsonSchema => ({ type: "string", ...(description ? { description } : {}) });
export const num = (description?: string): JsonSchema => ({ type: "number", ...(description ? { description } : {}) });

/** Plain-text generation with optional image inputs (vision OCR). Streams, returns full text. */
export async function generateText({
  system,
  input,
  effort = "low",
}: {
  system: string;
  input: Array<{ role: "user" | "assistant"; content: Array<{ type: "input_text"; text: string } | { type: "input_image"; image_url: string }> }>;
  effort?: "low" | "medium" | "high";
}): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-5.6-sol",
      stream: true,
      instructions: system,
      input,
      reasoning: { effort, summary: "auto" },
    }),
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("The AI tutor is busy right now. Try again in a moment.");
    if (res.status === 402)
      throw new Error("AI credits are exhausted for this workspace. Add credits in Lovable to continue.");
    throw new Error(`AI request failed (${res.status}). ${detail.slice(0, 300)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const evt = JSON.parse(payload);
        if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") text += evt.delta;
      } catch {
        /* ignore partial frames */
      }
    }
  }

  if (!text.trim()) throw new Error("The AI tutor returned an empty response. Please retry.");
  return text;
}
