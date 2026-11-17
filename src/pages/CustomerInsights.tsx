import { useState } from "react";
import { Badge, Button, Card, EmptyState, Field, Notice, PageHeader, type Tone } from "../components/ui";
import { askAI } from "../lib/ai";
import { parseExtractedProblems, PROBLEM_EXTRACTION_SYSTEM, type ExtractedProblem } from "../lib/prompts";
import { nowIso, uid, useStore } from "../lib/store";
import type { Confidence, CustomerProblem } from "../lib/types";

const CONFIDENCE_TONE: Record<Confidence, Tone> = { low: "warn", medium: "info", high: "good" };
const MAX_INPUT = 30_000;

export function CustomerInsights() {
  const { data, update } = useStore();
  const [feedback, setFeedback] = useState("");
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedProblem[] | null>(null);

  async function extract() {
    setBusy(true);
    setError(null);
    setExtracted(null);
    try {
      const raw = await askAI({
        system: PROBLEM_EXTRACTION_SYSTEM,
        messages: [{ role: "user", content: `Source: ${source || "unspecified"}\n\n---\n${feedback}` }],
        maxTokens: 2500,
      });
      setExtracted(parseExtractedProblems(raw, feedback));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed.");
    } finally {
      setBusy(false);
    }
  }

  function acceptProblem(p: ExtractedProblem) {
    const problem: CustomerProblem = {
      id: uid(),
      segment: p.segment,
      statement: p.statement,
      evidence: p.evidence,
      frequency: p.frequency,
      severity: p.severity,
      businessImpact: p.businessImpact,
      confidence: p.confidence,
      nextAction: p.nextAction,
      source: "ai-extracted",
      reviewed: false,
      createdAt: nowIso(),
    };
    update((d) => ({ ...d, problems: [problem, ...d.problems] }));
    setExtracted((list) => list?.filter((x) => x !== p) ?? null);
  }

  function toggleReviewed(id: string) {
    update((d) => ({
      ...d,
      problems: d.problems.map((p) => (p.id === id ? { ...p, reviewed: !p.reviewed } : p)),
    }));
  }

  function setConfidence(id: string, confidence: Confidence) {
    update((d) => ({ ...d, problems: d.problems.map((p) => (p.id === id ? { ...p, confidence } : p)) }));
  }

  function removeProblem(id: string) {
    update((d) => ({ ...d, problems: d.problems.filter((p) => p.id !== id) }));
  }

  const sorted = [...data.problems].sort((a, b) => b.severity * 10 + b.frequency - (a.severity * 10 + a.frequency));

  return (
    <>
      <PageHeader
        title="Customer Insights"
        description="Turn raw feedback into customer problems. Severity and business impact outrank how often a feature is requested."
      />

      <Card title="Extract problems from feedback" subtitle="Paste interview notes, support tickets, reviews or survey comments. The AI proposes problems; only quotes found in your text are kept.">
        <div className="form-grid">
          <Field label="Source label" hint="e.g. 'Interviews Q3' or 'Support tickets Oct'">
            <input className="input" value={source} onChange={(e) => setSource(e.target.value)} />
          </Field>
          <Field label="Feedback text" hint={`${feedback.length.toLocaleString()} / ${MAX_INPUT.toLocaleString()} characters`} wide>
            <textarea
              className="textarea"
              style={{ minHeight: 160 }}
              value={feedback}
              maxLength={MAX_INPUT}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Paste raw customer feedback here…"
            />
          </Field>
        </div>
        <div className="row" style={{ marginTop: "0.75rem" }}>
          <Button onClick={() => void extract()} disabled={busy || feedback.trim().length < 20}>
            {busy ? (<><span className="spinner" aria-hidden="true" />Extracting…</>) : "Extract problems with AI"}
          </Button>
        </div>
        {error && <Notice tone="bad">{error}</Notice>}

        {extracted && (
          <div className="stack" style={{ marginTop: "1rem" }}>
            <h3 className="small" style={{ margin: 0 }}>Review proposed problems ({extracted.length})</h3>
            {extracted.length === 0 && <EmptyState title="No problems found in this text." />}
            {extracted.map((p, i) => (
              <div key={`${p.statement}-${i}`} className="item">
                <div className="row spread">
                  <div className="row">
                    <Badge tone={CONFIDENCE_TONE[p.confidence]}>{p.confidence} confidence</Badge>
                    <Badge>{p.segment}</Badge>
                    <Badge>severity {p.severity}/5</Badge>
                    <Badge>frequency {p.frequency}/5</Badge>
                  </div>
                  <div className="row">
                    <Button className="btn-sm" onClick={() => acceptProblem(p)}>Accept (unreviewed)</Button>
                    <Button variant="ghost" className="btn-sm" onClick={() => setExtracted((l) => l?.filter((x) => x !== p) ?? null)}>Discard</Button>
                  </div>
                </div>
                <p className="item-title">{p.statement}</p>
                {p.businessImpact && <p className="small"><strong>Business impact:</strong> {p.businessImpact}</p>}
                {p.nextAction && <p className="small"><strong>Next action:</strong> {p.nextAction}</p>}
                {p.evidence.map((q) => (
                  <p key={q} className="quote">“{q}”</p>
                ))}
                {p.evidence.length === 0 && <p className="small muted">No verifiable quote supports this. Confidence set to low.</p>}
                {p.rejectedQuotes > 0 && (
                  <p className="small" style={{ color: "var(--warn)" }}>
                    {p.rejectedQuotes} quote(s) returned by the AI were not found in your text and were removed.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Customer problems" subtitle="Sorted by severity, then frequency. Only human-reviewed problems count toward health scores.">
        {sorted.length === 0 ? (
          <EmptyState title="No customer problems yet.">Extract problems above or accept them from your feedback.</EmptyState>
        ) : (
          <div className="stack">
            {sorted.map((p) => (
              <div key={p.id} className="item">
                <div className="row spread">
                  <div className="row">
                    <Badge>{p.segment}</Badge>
                    <Badge tone="warn">severity {p.severity}</Badge>
                    <Badge>frequency {p.frequency}</Badge>
                    <Badge tone={p.source === "ai-extracted" ? "info" : "neutral"}>{p.source}</Badge>
                    {p.reviewed ? <Badge tone="good">reviewed</Badge> : <Badge tone="warn">unreviewed</Badge>}
                  </div>
                  <div className="row">
                    <select
                      className="select input-sm"
                      aria-label="Confidence"
                      value={p.confidence}
                      onChange={(e) => setConfidence(p.id, e.target.value as Confidence)}
                    >
                      <option value="low">low</option>
                      <option value="medium">medium</option>
                      <option value="high">high</option>
                    </select>
                    <Button variant="secondary" className="btn-sm" onClick={() => toggleReviewed(p.id)}>
                      {p.reviewed ? "Mark unreviewed" : "Mark reviewed"}
                    </Button>
                    <Button variant="ghost" className="btn-sm" onClick={() => removeProblem(p.id)} aria-label={`Delete problem: ${p.statement}`}>
                      Delete
                    </Button>
                  </div>
                </div>
                <p className="item-title">{p.statement}</p>
                {p.businessImpact && <p className="small"><strong>Business impact:</strong> {p.businessImpact}</p>}
                {p.nextAction && <p className="small"><strong>Next action:</strong> {p.nextAction}</p>}
                {p.evidence.map((q) => (
                  <p key={q} className="quote">“{q}”</p>
                ))}
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
