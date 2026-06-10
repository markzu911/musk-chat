"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { ArrowUp, Blocks, Gauge, Sparkles, UserRound, Zap } from "lucide-react";

type Role = "user" | "assistant";

type Message = {
  id: string;
  role: Role;
  content: string;
};

type ToolContext = {
  userId: string;
  toolId: string;
};

type LaunchState = {
  userName: string;
  enterprise: string;
  integral: number | null;
  cost: number | null;
};

const introMessage: Message = {
  id: "intro",
  role: "assistant",
  content:
    "我以马斯克视角和你聊，基于公开言论推断，非本人观点。\n\n先把问题拆到第一性原理：成本、物理极限、瓶颈、迭代速度。给我一个具体问题。"
};

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([introMessage]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [toolContext, setToolContext] = useState<ToolContext | null>(null);
  const [launchState, setLaunchState] = useState<LaunchState | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const initialContext = createToolContext({
      userId: searchParams.get("userId"),
      toolId: searchParams.get("toolId")
    });

    if (initialContext) {
      setToolContext(initialContext);
    }

    function handleMessage(event: MessageEvent) {
      const data = event.data;

      if (!data || typeof data !== "object" || data.type !== "SAAS_INIT") {
        return;
      }

      const nextContext = createToolContext({
        userId: data.userId,
        toolId: data.toolId
      });

      if (nextContext) {
        setToolContext(nextContext);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    if (!toolContext) {
      return;
    }

    let cancelled = false;

    async function launchTool() {
      try {
        const response = await fetch("/api/tool/launch", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(toolContext)
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok || !isSuccessPayload(payload)) {
          throw new Error(readApiMessage(payload, "积分初始化失败。"));
        }

        if (!cancelled) {
          setLaunchState(readLaunchState(payload));
        }
      } catch (caughtError) {
        if (!cancelled) {
          const message =
            caughtError instanceof Error
              ? caughtError.message
              : "积分初始化失败。";
          setError(message);
        }
      }
    }

    void launchTool();

    return () => {
      cancelled = true;
    };
  }, [toolContext]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

  async function sendMessage(nextInput?: string) {
    const text = (nextInput ?? input).trim();

    if (!text || isLoading) {
      return;
    }

    const userMessage: Message = {
      id: createId(),
      role: "user",
      content: text
    };
    const assistantId = createId();
    const assistantMessage: Message = {
      id: assistantId,
      role: "assistant",
      content: ""
    };
    const nextMessages = [...messages, userMessage, assistantMessage];

    setMessages(nextMessages);
    setInput("");
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...toolContext,
          messages: [...messages, userMessage].map(({ role, content }) => ({
            role,
            content
          }))
        })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "请求失败，请检查服务端配置。");
      }

      if (!response.body) {
        throw new Error("没有收到模型响应流。");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        assistantText += decoder.decode(value, { stream: true });

        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? { ...message, content: assistantText }
              : message
          )
        );
      }

      if (!assistantText.trim()) {
        throw new Error("模型返回为空。");
      }

      if (toolContext) {
        void refreshLaunchState(toolContext, setLaunchState);
      }
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "未知错误。";
      setError(message);
      setMessages((current) =>
        current.filter((message) => message.id !== assistantId)
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  return (
    <main className="app-shell">
      <aside className="decor-panel" aria-label="Musk OS profile">
        <div className="brand-row">
          <span className="brand-mark" aria-hidden="true">
            <Sparkles size={19} />
          </span>
          <span>Musk OS</span>
        </div>

        <div className="decor-title">
          <p>First Principles</p>
          <h1>第一性原理对话</h1>
        </div>

        <div className="signal-list">
          <div>
            <Gauge size={18} aria-hidden="true" />
            <span>白痴指数</span>
          </div>
          <div>
            <Zap size={18} aria-hidden="true" />
            <span>快速迭代</span>
          </div>
          <div>
            <Blocks size={18} aria-hidden="true" />
            <span>垂直整合</span>
          </div>
        </div>
      </aside>

      <section className="chat-panel" aria-label="AI chat">
        <header className="chat-header">
          <div className="chat-title-row">
            <span className="header-avatar" aria-hidden="true">
              <img src="/ai-avatar.jpg" alt="" />
            </span>
            <div>
              <h2>Musk OS</h2>
              <p>第一性原理 AI 对话</p>
            </div>
          </div>
          {launchState ? (
            <div className="credit-status" aria-label="积分状态">
              <span>{launchState.userName || "用户"}</span>
              {launchState.integral !== null ? (
                <strong>{launchState.integral} 积分</strong>
              ) : null}
              {launchState.cost !== null ? (
                <span>本次 {launchState.cost}</span>
              ) : null}
            </div>
          ) : null}
        </header>

        <div className="message-list" aria-live="polite">
          {messages.map((message) => (
            <article
              className={`message ${message.role}`}
              key={message.id}
              aria-label={message.role === "user" ? "用户消息" : "AI 消息"}
            >
              <div className={`avatar ${message.role}`} aria-hidden="true">
                {message.role === "assistant" ? (
                  <img src="/ai-avatar.jpg" alt="" />
                ) : (
                  <UserRound size={20} strokeWidth={2.2} />
                )}
              </div>
              <div className="bubble">
                <div className="message-content">
                  {message.content || (
                    <span className="typing">
                      <span />
                      <span />
                      <span />
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}
          <div ref={bottomRef} />
        </div>

        {error ? (
          <div className="error-banner" role="alert">
            {error}
          </div>
        ) : null}

        <form className="composer" onSubmit={handleSubmit}>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入一个具体问题..."
            aria-label="输入消息"
            disabled={isLoading}
            rows={2}
          />
          <button
            className="send-button"
            type="submit"
            title="发送"
            aria-label="发送"
            disabled={!input.trim() || isLoading}
          >
            <ArrowUp size={20} />
          </button>
        </form>
      </section>
    </main>
  );
}

function createToolContext(input: { userId: unknown; toolId: unknown }) {
  const userId = sanitizeId(input.userId);
  const toolId = sanitizeId(input.toolId);

  if (!userId || !toolId) {
    return null;
  }

  return { userId, toolId };
}

function sanitizeId(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim();

  if (
    !normalized ||
    normalized === "null" ||
    normalized === "undefined"
  ) {
    return "";
  }

  return normalized;
}

function isSuccessPayload(payload: unknown) {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      ("success" in payload && payload.success === true)
  );
}

function readApiMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    if ("message" in payload && typeof payload.message === "string") {
      return payload.message;
    }

    if ("error" in payload && typeof payload.error === "string") {
      return payload.error;
    }
  }

  return fallback;
}

function readLaunchState(payload: unknown): LaunchState {
  const data =
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    payload.data &&
    typeof payload.data === "object"
      ? payload.data
      : null;
  const user =
    data && "user" in data && data.user && typeof data.user === "object"
      ? data.user
      : null;
  const tool =
    data && "tool" in data && data.tool && typeof data.tool === "object"
      ? data.tool
      : null;

  return {
    userName: readString(user, "name"),
    enterprise: readString(user, "enterprise"),
    integral: readNumber(user, "integral"),
    cost: readNumber(tool, "integral")
  };
}

function readString(source: unknown, key: string) {
  if (source && typeof source === "object" && key in source) {
    const value = source[key as keyof typeof source];
    return typeof value === "string" ? value : "";
  }

  return "";
}

function readNumber(source: unknown, key: string) {
  if (source && typeof source === "object" && key in source) {
    const value = source[key as keyof typeof source];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  return null;
}

async function refreshLaunchState(
  toolContext: ToolContext,
  setLaunchState: (value: LaunchState | null) => void
) {
  const response = await fetch("/api/tool/launch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(toolContext)
  });
  const payload = await response.json().catch(() => null);

  if (response.ok && isSuccessPayload(payload)) {
    setLaunchState(readLaunchState(payload));
  }
}
