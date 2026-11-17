import { useState, type FormEvent } from "react";
import { Badge, Button, Card, EmptyState, Field, Notice, PageHeader, type Tone } from "../components/ui";
import { daysBetween, nowIso, uid, useStore } from "../lib/store";
import type { Confidence, DecisionEntry } from "../lib/types";

const CONFIDENCE_TONE: Record<Confidence, Tone> = { low: "warn", medium: "info", high: "good" };

const EMPTY = {
  date: new Date().toISOString().slice(0, 10),
  title: "",
  decision: "",
  context: "",
  alternatives: "",
  tradeoffs: "",
  expectedImpact: "",
  confidence: "medium" as Confidence,
  owner: "",
};

/**
 * Product Strategy: the permanent decision log (spec §5) and a holding area for strategy modules still to come.
 * The log records why a decision was made so future decisions can learn from outcomes.
 */
export function Strategy() {
  const { data, update } = useStore();
  const [draft, setDraft] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [outcomeDrafts, setOutcomeDrafts] = useState<Record<string, string>>({});

  function add(e: FormEvent) {
    e.preventDefault();
    if (!draft.title.trim() || !draft.decision.trim()) return setError("A decision needs a title and the decision itself.");
    if (!draft.context.trim()) return setError("Record the context. Future readers need to know why this decision was made.");
    if (!draft.owner.trim()) return setError("Name the owner accountable for this decision.");
    const entry: DecisionEntry = { ...draft, title: draft.title.trim(), id: uid(), createdAt: nowIso() };
    update((d) => ({ ...d, decisions: [entry, ...d.decisions] }));
    setDraft(EMPTY);
    setError(null);
  }

  function recordOutcome(id: string) {
    const text = (outcomeDrafts[id] ?? "").trim();
    if (!text) return;
    update((d) => ({
      ...d,
      decisions: d.decisions.map((x) => (x.id === id ? { ...x, outcome: text, outcomeRecordedAt: nowIso() } : x)),
    }));
    setOutcomeDrafts((s) => ({ ...s, [id]: "" }));
  }

  function remove(id: string) {
    if (!window.confirm("Delete this decision? The decision log is meant to be permanent. Consider recording an outcome instead.")) return;
    update((d) => ({ ...d, decisions: d.decisions.filter((x) => x.id !== id) }));
  }

  return (
    <>
      <PageHeader
        title="Product Strategy"
        description="Decision log: a permanent record of why decisions were made, what was expected, and what actually happened."
      />

      <Card title="Record a decision">
        <form onSubmit={add} className="form-grid">
          <Field label="Title">
            <input className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </Field>
          <Field label="Date">
            <input className="input" type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
          </Field>
          <Field label="Decision" wide>
            <textarea className="textarea" value={draft.decision} onChange={(e) => setDraft({ ...draft, decision: e.target.value })} />
          </Field>
          <Field label="Context (why now)" wide>
            <textarea className="textarea" value={draft.context} onChange={(e) => setDraft({ ...draft, context: e.target.value })} />
          </Field>
          <Field label="Alternatives considered" wide>
            <textarea className="textarea" value={draft.alternatives} onChange={(e) => setDraft({ ...draft, alternatives: e.target.value })} />
          </Field>
          <Field label="Trade-offs" wide>
            <textarea className="textarea" value={draft.tradeoffs} onChange={(e) => setDraft({ ...draft, tradeoffs: e.target.value })} />
          </Field>
          <Field label="Expected impact" wide>
            <textarea className="textarea" value={draft.expectedImpact} onChange={(e) => setDraft({ ...draft, expectedImpact: e.target.value })} />
          </Field>
          <Field label="Confidence">
            <select className="select" value={draft.confidence} onChange={(e) => setDraft({ ...draft, confidence: e.target.value as Confidence })}>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </Field>
          <Field label="Owner">
            <input className="input" value={draft.owner} onChange={(e) => setDraft({ ...draft, owner: e.target.value })} />
          </Field>
          <div className="field-wide">
            {error && <Notice tone="bad">{error}</Notice>}
            <Button type="submit">Add to decision log</Button>
          </div>
        </form>
      </Card>

      <Card title={`Decision log (${data.decisions.length})`}>
        {data.decisions.length === 0 ? (
          <EmptyState title="No decisions recorded yet." />
        ) : (
          <div className="stack">
            {data.decisions.map((d) => {
              const age = daysBetween(d.createdAt);
              return (
                <div key={d.id} className="item">
                  <div className="row spread">
                    <div className="row">
                      <span className="item-title">{d.title}</span>
                      <Badge tone={CONFIDENCE_TONE[d.confidence]}>{d.confidence} confidence</Badge>
                      <Badge>{d.date}</Badge>
                      <Badge>owner: {d.owner}</Badge>
                      {d.outcome ? <Badge tone="good">outcome recorded</Badge> : age >= 30 ? <Badge tone="warn">outcome overdue</Badge> : null}
                    </div>
                    <Button variant="ghost" className="btn-sm" onClick={() => remove(d.id)} aria-label={`Delete decision ${d.title}`}>Delete</Button>
                  </div>
                  <dl className="kv" style={{ marginTop: "0.5rem" }}>
                    <dt>Decision</dt><dd>{d.decision}</dd>
                    <dt>Context</dt><dd>{d.context}</dd>
                    {d.alternatives && (<><dt>Alternatives</dt><dd>{d.alternatives}</dd></>)}
                    {d.tradeoffs && (<><dt>Trade-offs</dt><dd>{d.tradeoffs}</dd></>)}
                    {d.expectedImpact && (<><dt>Expected</dt><dd>{d.expectedImpact}</dd></>)}
                    {d.outcome && (<><dt>Outcome</dt><dd>{d.outcome}</dd></>)}
                  </dl>
                  {!d.outcome && (
                    <div className="row" style={{ marginTop: "0.6rem" }}>
                      <input
                        className="input"
                        placeholder="What actually happened?"
                        aria-label={`Outcome for ${d.title}`}
                        value={outcomeDrafts[d.id] ?? ""}
                        onChange={(e) => setOutcomeDrafts((s) => ({ ...s, [d.id]: e.target.value }))}
                      />
                      <Button variant="secondary" className="btn-sm" onClick={() => recordOutcome(d.id)}>Record outcome</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
