import { useEffect, useRef, useState } from "react";
import { Badge, Button, Card, Notice, PageHeader } from "../components/ui";
import { getAccessToken, getAIStatus, setAccessToken, type AIStatus } from "../lib/ai";
import { emptyData, normaliseData, useStore } from "../lib/store";
import type { AppData } from "../lib/types";

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export function Settings() {
  const { data, replace, reset } = useStore();
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [token, setToken] = useState(getAccessToken());
  const [tokenSaved, setTokenSaved] = useState(false);
  const [message, setMessage] = useState<{ tone: "good" | "bad" | "info"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void getAIStatus().then(setStatus);
  }, []);

  function saveToken() {
    setAccessToken(token.trim());
    setTokenSaved(true);
    setTimeout(() => setTokenSaved(false), 2000);
    void getAIStatus().then(setStatus);
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-pm-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setMessage({ tone: "good", text: "Export downloaded." });
  }

  async function importData(file: File) {
    if (file.size > MAX_IMPORT_BYTES) {
      setMessage({ tone: "bad", text: "That file is larger than 5 MB and was not imported." });
      return;
    }
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!parsed || typeof parsed !== "object" || !("opportunities" in parsed)) {
        setMessage({ tone: "bad", text: "That file does not look like an export from this app." });
        return;
      }
      if (!window.confirm("Importing replaces all current data in this browser. Continue?")) return;
      replace(normaliseData(parsed as AppData));
      setMessage({ tone: "good", text: "Import complete." });
    } catch {
      setMessage({ tone: "bad", text: "The file is not valid JSON." });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function clearAll() {
    if (!window.confirm("Delete all product data stored in this browser? Export first if you need a copy.")) return;
    reset();
    setMessage({ tone: "info", text: "All data cleared." });
  }

  const counts = {
    knowledge: data.knowledge.length,
    problems: data.problems.length,
    opportunities: data.opportunities.length,
    roadmap: data.roadmap.length,
    prds: data.prds.length,
    decisions: data.decisions.length,
  };
  const hasData = JSON.stringify(data) !== JSON.stringify(emptyData);

  return (
    <>
      <PageHeader title="Settings" description="AI connection, access control and your data." />

      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <Card title="AI connection">
        {status === null ? (
          <p className="muted small">Checking…</p>
        ) : status.configured ? (
          <p>
            <Badge tone="good">connected</Badge> The server has an API key. Model: <code>{status.model}</code>
          </p>
        ) : (
          <Notice tone="warn">
            AI is not configured on the server. Add <code>ANTHROPIC_API_KEY</code> in Netlify environment variables, then redeploy.
            Everything except AI features works without it.
          </Notice>
        )}
        <p className="small muted">The API key is never sent to the browser. Requests go through the server function.</p>
      </Card>

      <Card title="Access token" subtitle="If the server sets APP_ACCESS_TOKEN, enter the same value here. It is stored only in this browser.">
        <div className="row">
          <input
            className="input"
            type="password"
            autoComplete="off"
            style={{ maxWidth: 360 }}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            aria-label="Access token"
          />
          <Button onClick={saveToken}>{tokenSaved ? "Saved" : "Save token"}</Button>
        </div>
        <p className="small muted">
          This is a shared secret, not user login. For a private deployment, also enable Netlify site protection.
        </p>
      </Card>

      <Card title="Your data" subtitle={`Stored in this browser only. ${hasData ? "" : "Nothing saved yet."}`}>
        <dl className="kv" style={{ marginBottom: "1rem" }}>
          <dt>Knowledge items</dt><dd>{counts.knowledge}</dd>
          <dt>Customer problems</dt><dd>{counts.problems}</dd>
          <dt>Opportunities</dt><dd>{counts.opportunities}</dd>
          <dt>Roadmap items</dt><dd>{counts.roadmap}</dd>
          <dt>PRDs</dt><dd>{counts.prds}</dd>
          <dt>Decisions</dt><dd>{counts.decisions}</dd>
        </dl>
        <div className="row">
          <Button variant="secondary" onClick={exportData}>Export JSON</Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>Import JSON</Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importData(f);
            }}
          />
          <Button variant="danger" onClick={clearAll}>Clear all data</Button>
        </div>
        <p className="small muted" style={{ marginTop: "0.75rem" }}>
          Browser storage can be cleared by the browser or lost on a new device. Export regularly. Multi-user and server-side storage are not yet built.
        </p>
      </Card>
    </>
  );
}
