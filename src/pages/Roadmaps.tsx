import { useState, type FormEvent } from "react";
import { Badge, Button, Card, EmptyState, Field, Notice, PageHeader, type Tone } from "../components/ui";
import { nowIso, uid, useStore } from "../lib/store";
import type { AppData, RoadmapBucket, RoadmapItem, RoadmapStatus } from "../lib/types";

const BUCKETS: Array<{ key: RoadmapBucket; label: string; help: string }> = [
  { key: "now", label: "Now", help: "In progress or committed this cycle." },
  { key: "next", label: "Next", help: "Well understood, scheduled after Now." },
  { key: "later", label: "Later", help: "Directional. Needs more evidence." },
];
const STATUS_TONE: Record<RoadmapStatus, Tone> = { planned: "neutral", in_progress: "info", shipped: "good", paused: "warn" };
const STATUSES: RoadmapStatus[] = ["planned", "in_progress", "shipped", "paused"];

interface Draft {
  title: string;
  bucket: RoadmapBucket;
  status: RoadmapStatus;
  /** Encoded as "p:<id>" for a customer problem or "o:<id>" for an opportunity. */
  link: string;
  objective: string;
  successMetric: string;
}

const EMPTY: Draft = { title: "", bucket: "next", status: "planned", link: "", objective: "", successMetric: "" };

function linkLabel(data: AppData, item: RoadmapItem): string {
  if (item.linkedProblemId) {
    const p = data.problems.find((x) => x.id === item.linkedProblemId);
    return p ? `Problem: ${p.statement}` : "Problem (deleted)";
  }
  if (item.linkedOpportunityId) {
    const o = data.opportunities.find((x) => x.id === item.linkedOpportunityId);
    return o ? `Opportunity: ${o.title}` : "Opportunity (deleted)";
  }
  return "Unlinked";
}

export function Roadmaps() {
  const { data, update } = useStore();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const hasLinkTargets = data.problems.length > 0 || data.opportunities.length > 0;

  function add(e: FormEvent) {
    e.preventDefault();
    // Spec §E: every roadmap item must connect to a customer problem, a business objective and a measurable outcome.
    if (!draft.title.trim()) return setError("Give the roadmap item a title.");
    if (!draft.link) return setError("Link this item to a customer problem or opportunity. Roadmap items must trace to customer evidence.");
    if (!draft.objective.trim()) return setError("State the business objective this item serves.");
    if (!draft.successMetric.trim()) return setError("Define a measurable success metric.");
    const [kind, id] = draft.link.split(":");
    const item: RoadmapItem = {
      id: uid(),
      title: draft.title.trim(),
      bucket: draft.bucket,
      status: draft.status,
      linkedProblemId: kind === "p" ? id : undefined,
      linkedOpportunityId: kind === "o" ? id : undefined,
      objective: draft.objective.trim(),
      successMetric: draft.successMetric.trim(),
      createdAt: nowIso(),
    };
    update((d) => ({ ...d, roadmap: [item, ...d.roadmap] }));
    setDraft(EMPTY);
    setError(null);
    setShowForm(false);
  }

  function patch(id: string, changes: Partial<RoadmapItem>) {
    update((d) => ({ ...d, roadmap: d.roadmap.map((r) => (r.id === id ? { ...r, ...changes } : r)) }));
  }

  function remove(id: string) {
    update((d) => ({ ...d, roadmap: d.roadmap.filter((r) => r.id !== id) }));
  }

  return (
    <>
      <PageHeader
        title="Roadmaps"
        description="Now, Next and Later. Every item traces to a customer problem or opportunity, a business objective and a measurable outcome."
        actions={<Button onClick={() => setShowForm((s) => !s)}>{showForm ? "Close" : "New roadmap item"}</Button>}
      />

      {showForm && (
        <Card title="New roadmap item">
          {!hasLinkTargets && (
            <Notice tone="warn">
              There are no customer problems or opportunities yet. Add one first, because roadmap items must link to one.
            </Notice>
          )}
          <form onSubmit={add} className="form-grid">
            <Field label="Title" wide>
              <input className="input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </Field>
            <Field label="Bucket" hint={BUCKETS.find((b) => b.key === draft.bucket)?.help}>
              <select className="select" value={draft.bucket} onChange={(e) => setDraft({ ...draft, bucket: e.target.value as RoadmapBucket })}>
                {BUCKETS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className="select" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as RoadmapStatus })}>
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </Field>
            <Field label="Linked customer problem or opportunity (required)" wide>
              <select className="select" value={draft.link} onChange={(e) => setDraft({ ...draft, link: e.target.value })}>
                <option value="">Select…</option>
                {data.problems.length > 0 && (
                  <optgroup label="Customer problems">
                    {data.problems.map((p) => <option key={p.id} value={`p:${p.id}`}>{p.statement.slice(0, 90)}</option>)}
                  </optgroup>
                )}
                {data.opportunities.length > 0 && (
                  <optgroup label="Opportunities">
                    {data.opportunities.map((o) => <option key={o.id} value={`o:${o.id}`}>{o.title}</option>)}
                  </optgroup>
                )}
              </select>
            </Field>
            <Field label="Business objective (required)" hint="Pick from your strategic objectives or write one." wide>
              <input
                className="input"
                list="objectives"
                value={draft.objective}
                onChange={(e) => setDraft({ ...draft, objective: e.target.value })}
              />
              <datalist id="objectives">
                {data.profile.strategicObjectives.map((s) => <option key={s} value={s} />)}
              </datalist>
            </Field>
            <Field label="Measurable success metric (required)" hint="e.g. 'Activation rate from 32% to 40% within 60 days'" wide>
              <input className="input" value={draft.successMetric} onChange={(e) => setDraft({ ...draft, successMetric: e.target.value })} />
            </Field>
            <div className="field-wide">
              {error && <Notice tone="bad">{error}</Notice>}
              <Button type="submit">Add to roadmap</Button>
            </div>
          </form>
        </Card>
      )}

      {data.roadmap.length === 0 ? (
        <Card>
          <EmptyState title="The roadmap is empty.">Add an item to start planning Now, Next and Later.</EmptyState>
        </Card>
      ) : (
        <div className="columns">
          {BUCKETS.map((b) => {
            const items = data.roadmap.filter((r) => r.bucket === b.key);
            return (
              <Card key={b.key} title={`${b.label} (${items.length})`} subtitle={b.help}>
                {items.length === 0 && <p className="small muted">Nothing here yet.</p>}
                {items.map((r) => (
                  <div key={r.id} className="item">
                    <div className="row spread">
                      <span className="item-title">{r.title}</span>
                      <Badge tone={STATUS_TONE[r.status]}>{r.status.replace("_", " ")}</Badge>
                    </div>
                    <p className="small muted">{linkLabel(data, r)}</p>
                    <p className="small"><strong>Objective:</strong> {r.objective}</p>
                    <p className="small"><strong>Metric:</strong> {r.successMetric}</p>
                    <div className="row" style={{ marginTop: "0.4rem" }}>
                      <select className="select input-sm" aria-label="Bucket" value={r.bucket} onChange={(e) => patch(r.id, { bucket: e.target.value as RoadmapBucket })}>
                        {BUCKETS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
                      </select>
                      <select className="select input-sm" aria-label="Status" value={r.status} onChange={(e) => patch(r.id, { status: e.target.value as RoadmapStatus })}>
                        {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                      </select>
                      <Button variant="ghost" className="btn-sm" onClick={() => remove(r.id)} aria-label={`Delete ${r.title}`}>Delete</Button>
                    </div>
                  </div>
                ))}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
