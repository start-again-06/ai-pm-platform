import { useRef, useState, type FormEvent } from "react";
import { Button, Card, EmptyState, Notice, PageHeader } from "../components/ui";
import { askAI, type AIMessage } from "../lib/ai";
import { companyContext, GOVERNANCE } from "../lib/prompts";
import { useStore } from "../lib/store";

const QUICK_PROMPTS = [
  "What should we build next, and why?",
  "Which opportunities should we validate first?",
  "Find gaps in our roadmap traceability.",
  "What evidence am I missing before a pricing decision?",
];

const MAX_HISTORY = 12;

export function Assistant() {
  const { data } = useStore();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const next: AIMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const system = `${GOVERNANCE}\n\nCOMPANY CONTEXT (use only this; cite the section when you rely on it):\n${companyContext(data)}`;
      const reply = await askAI({ system, messages: next.slice(-MAX_HISTORY), maxTokens: 1200 });
      setMessages((m) => [...m, { role: "assistant", content: reply || "(empty response)" }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  return (
    <>
      <PageHeader
        title="AI Product Manager"
        description="Ask questions grounded in your company context. Answers label what is verified, a hypothesis, an assumption or a recommendation."
      />
      <Notice tone="info">
        The assistant only sees what you have entered in Company Intelligence, Customer Insights, Opportunities and Roadmaps. Verify AI output before acting on it.
      </Notice>

      <Card>
        <div className="row" style={{ marginBottom: "0.75rem" }}>
          {QUICK_PROMPTS.map((q) => (
            <Button key={q} variant="secondary" className="btn-sm" disabled={busy} onClick={() => void send(q)}>
              {q}
            </Button>
          ))}
        </div>

        <div className="chat" aria-live="polite">
          {messages.length === 0 && (
            <EmptyState title="No messages yet.">Ask a question, or pick a prompt above.</EmptyState>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`bubble bubble-${m.role}`}>
              {m.content}
            </div>
          ))}
          {busy && (
            <div className="bubble bubble-assistant muted">
              <span className="spinner" aria-hidden="true" />
              Thinking…
            </div>
          )}
          <div ref={endRef} />
        </div>

        {error && <Notice tone="bad">{error}</Notice>}

        <form onSubmit={onSubmit} className="row" style={{ marginTop: "0.75rem", alignItems: "stretch" }}>
          <textarea
            className="textarea"
            style={{ flex: 1, minHeight: 60 }}
            placeholder="Ask about strategy, customers, priorities or metrics…"
            value={input}
            maxLength={4000}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            aria-label="Message to the AI product manager"
          />
          <Button type="submit" disabled={busy || !input.trim()}>
            Send
          </Button>
        </form>
      </Card>
    </>
  );
}
