"use client";

import { useState, type FormEvent } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function textOf(message: UIMessage): string {
  return message.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("");
}

export default function ResumeChatInterface({
  companyId,
  companyName,
  initialMessages,
}: {
  companyId: string;
  companyName: string;
  initialMessages: UIMessage[];
}) {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: `/api/practice/companies/${companyId}/resume-chat/chat`,
    }),
  });

  const busy = status === "submitted" || status === "streaming";

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    sendMessage({ text });
    setInput("");
  }

  return (
    <div className="flex h-[70vh] flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-1">
        {messages.length === 0 && (
          <div className="card p-6 text-center text-sm text-muted">
            Ask anything — your weak points, what to study, what concepts
            matter most for {companyName}.
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={
                m.role === "user"
                  ? "max-w-[80%] rounded-2xl bg-brand px-4 py-2.5 text-sm text-primary-foreground"
                  : "card max-w-[80%] px-4 py-3 text-sm text-ink"
              }
            >
              {m.role === "user" ? (
                textOf(m)
              ) : (
                <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-p:text-ink prose-li:text-ink prose-strong:text-ink">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {textOf(m)}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="card px-4 py-3 text-sm text-muted">Thinking…</div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your weak points, what to study…"
          className="flex-1 rounded-lg border border-line bg-card px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand"
        />
        <button
          type="submit"
          disabled={!input.trim() || busy}
          className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-60"
        >
          Send
        </button>
      </form>
    </div>
  );
}
