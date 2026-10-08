"use client";

import { useState, useRef, useEffect } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      setMessages([...next, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages([...next, { role: "assistant", content: "Connection error." }]);
    }
    setLoading(false);
  }

  return (
    <div className="flex h-dvh flex-col bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 px-4 py-3 font-semibold">
        Sales Expert <span className="text-xs text-neutral-500">(test data)</span>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-neutral-500">
            Ask about a product: cost, price, stock, margin...
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            dir="auto"
            className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 ${
              m.role === "user"
                ? "ml-auto bg-blue-600"
                : "mr-auto bg-neutral-800"
            }`}
          >
            {m.content}
          </div>
        ))}
        {loading && <p className="text-neutral-500">...</p>}
        <div ref={endRef} />
      </div>

      <div className="flex gap-2 border-t border-neutral-800 p-3">
        <input
          dir="auto"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Message..."
          className="flex-1 rounded-full bg-neutral-800 px-4 py-2 outline-none"
        />
        <button
          onClick={send}
          disabled={loading}
          className="rounded-full bg-blue-600 px-5 py-2 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}