/**
 * OpenRouter LLM 客户端
 * 通过 OpenRouter API 调用各种大语言模型
 */

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  content: string;
}

/**
 * 调用 OpenRouter API 完成聊天
 */
export async function chatCompletion(
  messages: LLMMessage[],
  options?: { jsonMode?: boolean }
): Promise<LLMResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const model = process.env.LLM_MODEL || "google/gemini-2.5-flash";

  const body: Record<string, unknown> = {
    model,
    messages,
  };

  if (options?.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenRouter API error (${response.status}): ${errorText}`
    );
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("OpenRouter API returned empty response");
  }

  return { content };
}
