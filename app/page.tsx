"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { ArrowUp, Blocks, Gauge, Sparkles, Zap } from "lucide-react";

type Role = "user" | "assistant";

type Message = {
  id: string;
  role: Role;
  content: string;
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
  const bottomRef = useRef<HTMLDivElement | null>(null);

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

        <div className="model-status">
          <span>GLM</span>
          <span>thinking off</span>
        </div>
      </aside>

      <section className="chat-panel" aria-label="AI chat">
        <header className="chat-header">
          <div>
            <h2>Musk OS</h2>
            <p>第一性原理 AI 对话</p>
          </div>
        </header>

        <div className="message-list" aria-live="polite">
          {messages.map((message) => (
            <article
              className={`message ${message.role}`}
              key={message.id}
              aria-label={message.role === "user" ? "用户消息" : "AI 消息"}
            >
              <div className="message-role">
                {message.role === "user" ? "You" : "Musk OS"}
              </div>
              <div className="message-content">
                {message.content || (
                  <span className="typing">
                    <span />
                    <span />
                    <span />
                  </span>
                )}
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
