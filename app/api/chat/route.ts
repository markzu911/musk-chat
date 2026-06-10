import { MUSK_SYSTEM_PROMPT } from "@/lib/musk-system-prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ClientMessage = {
  role: "user" | "assistant";
  content: string;
};

type ZhipuDeltaPayload = {
  choices?: Array<{
    delta?: {
      content?: unknown;
      reasoning_content?: unknown;
    };
    message?: {
      content?: unknown;
    };
  }>;
};

const DEFAULT_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";

export async function POST(request: Request) {
  const apiKey = process.env.ZHIPU_API_KEY;

  if (!apiKey || apiKey === "your_zhipu_api_key_here") {
    return Response.json(
      { error: "请先在 .env 中配置 ZHIPU_API_KEY。" },
      { status: 500 }
    );
  }

  const payload = await request.json().catch(() => null);
  const messages = sanitizeMessages(payload?.messages);

  if (messages.length === 0) {
    return Response.json({ error: "消息不能为空。" }, { status: 400 });
  }

  const baseUrl = normalizeBaseUrl(process.env.ZHIPU_BASE_URL ?? DEFAULT_BASE_URL);
  const model = process.env.ZHIPU_MODEL ?? "glm-5.1";
  const thinkingType = process.env.ZHIPU_THINKING_TYPE ?? "disabled";
  const temperature = readNumberEnv("ZHIPU_TEMPERATURE", 0.72);
  const maxTokens = readNumberEnv("ZHIPU_MAX_TOKENS", 1800);

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: MUSK_SYSTEM_PROMPT },
        ...messages
      ],
      thinking: {
        type: thinkingType
      },
      stream: true,
      temperature,
      max_tokens: maxTokens
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    return Response.json(
      { error: `智谱接口调用失败：${errorText || response.statusText}` },
      { status: response.status }
    );
  }

  if (!response.body) {
    return Response.json({ error: "智谱接口没有返回流式响应。" }, { status: 502 });
  }

  return streamZhipuResponse(response.body);
}

function streamZhipuResponse(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const rawLine of lines) {
            const line = rawLine.trim();

            if (!line.startsWith("data:")) {
              continue;
            }

            const data = line.slice(5).trim();

            if (!data || data === "[DONE]") {
              continue;
            }

            const content = extractContent(data);

            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
        }
      } catch (error) {
        controller.error(error);
      } finally {
        controller.close();
        reader.releaseLock();
      }
    },
    async cancel() {
      await reader.cancel();
    }
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Accel-Buffering": "no"
    }
  });
}

function extractContent(data: string) {
  try {
    const payload = JSON.parse(data) as ZhipuDeltaPayload;
    const choice = payload.choices?.[0];
    const content = choice?.delta?.content ?? choice?.message?.content;

    if (typeof content === "string") {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (typeof part === "string") {
            return part;
          }

          if (
            part &&
            typeof part === "object" &&
            "text" in part &&
            typeof part.text === "string"
          ) {
            return part.text;
          }

          return "";
        })
        .join("");
    }
  } catch {
    return "";
  }

  return "";
}

function sanitizeMessages(messages: unknown): ClientMessage[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .map((message) => {
      if (!message || typeof message !== "object") {
        return null;
      }

      const role = "role" in message ? message.role : undefined;
      const content = "content" in message ? message.content : undefined;

      if (
        role !== "user" &&
        role !== "assistant"
      ) {
        return null;
      }

      if (typeof content !== "string" || !content.trim()) {
        return null;
      }

      return {
        role,
        content: content.slice(0, 8000)
      };
    })
    .filter((message): message is ClientMessage => message !== null)
    .slice(-24);
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function readNumberEnv(name: string, fallback: number) {
  const rawValue = process.env[name];

  if (!rawValue) {
    return fallback;
  }

  const value = Number(rawValue);
  return Number.isFinite(value) ? value : fallback;
}
