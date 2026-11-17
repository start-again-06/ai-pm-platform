import { useState, type FormEvent } from "react";
import { Badge, Button, Card, EmptyState, Field, Notice, PageHeader, type Tone } from "../components/ui";
import { priorityFor, type PrioritizationMethod } from "../lib/scoring";
import { nowIso, uid, useStore } from "../lib/store";
import type { Opportunity, OpportunityStatus } from "../lib/types";

type Tab = "backlog" | "prioritize";
type Draft = Omit<Opportunity, "id" | "createdAt">;

const STATUS_TONE: Record<OpportunityStatus, Tone> = {
  backlog: "neutral",
  validating: "info",
  validated: "good",
  rejected: "bad",
  building: "warn",
};
const STATUSES: OpportunityStatus[] = ["backlog", "validating", "validated", "building", "rejected"];

const EMPTY_DRAFT: Draft = {
  title: "",
  problem: "",
  targetUser: "",
  jobsToBeDone: "",
  evidence: "",
  alternatives: "",
  proposedSolution: "",
  differentiation: "",
  businessImpact: "",
  risks: "",
  validationExperiment: "",
  status: "backlog",
  linkedProblemId: undefined,
  reach: 0,
  impact: 5,
  confidence: 50,
  effort: 1,
  ease: 5,
};

const TEXT_FIELDS: Array<{ key: keyof Draft; label: string; wide?: boolean; hint?: string }> = [
  { key: "title", label: "Title" },
  { key: "targetUser", label: "Target user" },
  { key: "problem", label: "Problem statement", wide: true },
  { key: "jobsToBeDone", label: "Jobs to be done", wide: true },
  { key: "evidence", label: "Evidence", wide: true, hint: "Interview IDs, data, links. Required to count toward health." },
  { key: "alternatives", label: "Existing alternatives", wide: true },
  { key: "proposedSolution", label: "Proposed solution", wide: true },
  { key: "differentiation", label: "Differentiation", wide: true },
  { key: "businessImpact", label: "Business impact", wide: true },
  { key: "risks", label: "Risks and uncertainties", wide: true },
  { key: "validationExperiment", label: "Validation experiment", wide: true, hint: "Required to count toward health." },
];

export function Opportunities() {
  const [tab, setTab] = useState<Tab>("backlog");
  return (
    <>
      <PageHeader title="Opportunities" description="An evidence-backed backlog of product opportunities, and the scoring that ranks them." />
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "backlog"} className="tab" onClick={() => setTab("backlog")}>Backlog</button>
        <button role="tab" aria-selected={tab === "prioritize"} className="tab" onClick={() => setTab("prioritize")}>Prioritise</button>
      </div>
      {tab === "backlog" ? <Backlog /> : <Prioritise />}
    </>
  );
}

function Backlog() {
  const { data, update } = useStore();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const numberField = (key: "reach" | "impact" | "confidence" | "effort" | "ease", label: string, min: number, max: number, hint: string) => (
    <Field label={label} hint={hint}>
      <input
        className="input"
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step="any"
        value={draft[key]}
        onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })}
      />
    </Field>
  );

  function save(e: FormEvent) {
    e.preventDefault();
    if (!draft.title.trim()) return setFormError("Give the opportunity a title.");
    if (!draft.problem.trim()) return setFormError("State the problem this opportunity addresses.");
    for (const [label, v, lo, hi] of [
      ["Impact", draft.impact, 1, 10],
      ["Confidence", draft.confidence, 0, 100],
      ["Ease", draft.ease, 1, 10],
      ["Reach", draft.reach, 0, Number.MAX_SAFE_INTEGER],
      ["Effort", draft.effort, 0, Number.MAX_SAFE_INTEGER],
    ] as const) {
      if (!Number.isFinite(v) || v < lo || v > hi) return setFormError(`${label} must be between ${lo} and ${hi}.`);
    }
    setFormError(null);
    if (editingId) {
      update((d) => ({
        ...d,
        opportunities: d.opportunities.map((o) => (o.id === editingId ? { ...o, ...draft } : o)),
      }));
    } else {
      const opp: Opportunity = { ...draft, id: uid(), createdAt: nowIso() };
      update((d) => ({ ...d, opportunities: [opp, ...d.opportunities] }));
    }
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
    setShowForm(false);
  }

  function edit(o: Opportunity) {
    const { id: _id, createdAt: _c, ...rest } = o;
    setDraft(rest);
    setEditingId(o.id);
    setShowForm(true);
  }

  function setStatus(id: string, status: OpportunityStatus) {
    update((d) => ({ ...d, opportunities: d.opportunities.map((o) => (o.id === id ? { ...o, status } : o)) }));
  }

  function remove(id: string) {
    update((d) => ({ ...d, opportunities: d.opportunities.filter((o) => o.id !== id) }));
  }

  return (
    <>
      <div className="row spread" style={{ marginBottom: "0.75rem" }}>
        <span className="muted small">{data.opportunities.length} opportunit{data.opportunities.length === 1 ? "y" : "ies"}</span>
        <Button onClick={() => { setDraft(EMPTY_DRAFT); setEditingId(null); setShowForm((s) => !s); }}>
          {showForm && !editingId ? "Close form" : "New opportunity"}
        </Button>
      </div>

      {showForm && (
        <Card title={editingId ? "Edit opportunity" : "New opportunity"}>
          <form onSubmit={save} className="form-grid">
            {TEXT_FIELDS.map((f) => (
              <Field key={f.key} label={f.label} hint={f.hint} wide={f.wide}>
                {f.wide ? (
                  <textarea className="textarea" value={String(draft[f.key] ?? "")} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} />
                ) : (
                  <input className="input" value={String(draft[f.key] ?? "")} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} />
                )}
              </Field>
            ))}
            <Field label="Status">
              <select className="select" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as OpportunityStatus })}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Linked customer problem" hint="Unlinked opportunities are flagged on the Overview.">
              <select className="select" value={draft.linkedProblemId ?? ""} onChange={(e) => setDraft({ ...draft, linkedProblemId: e.target.value || undefined })}>
                <option value="">None</option>
                {data.problems.map((p) => <option key={p.id} value={p.id}>{p.statement.slice(0, 70)}</option>)}
              </select>
            </Field>
            {numberField("reach", "Reach (users per quarter)", 0, Number.MAX_SAFE_INTEGER, "RICE. How many users this affects each quarter.")}
            {numberField("impact", "Impact (1–10)", 1, 10, "RICE and ICE. Your estimate, with reasoning in the rationale.")}
            {numberField("confidence", "Confidence (%)", 0, 100, "How sure you are of the reach and impact estimates.")}
            {numberField("effort", "Effort (person-weeks)", 0, Number.MAX_SAFE_INTEGER, "RICE denominator. Must be above zero to score.")}
            {numberField("ease", "Ease / feasibility (1–10)", 1, 10, "ICE. Higher means easier or more feasible.")}
            <div className="field-wide">
              {formError && <Notice tone="bad">{formError}</Notice>}
              <div className="row">
                <Button type="submit">{editingId ? "Save changes" : "Add opportunity"}</Button>
                <Button variant="secondary" type="button" onClick={() => { setDraft(EMPTY_DRAFT); setEditingId(null); setShowForm(false); }}>Cancel</Button>
              </div>
            </div>
          </form>
        </Card>
      )}

      {data.opportunities.length === 0 ? (
        <Card>
          <EmptyState title="The backlog is empty.">
            Add an opportunity, ideally linked to a reviewed customer problem.
          </EmptyState>
        </Card>
      ) : (
        <div className="stack">
          {data.opportunities.map((o) => {
            const linked = data.problems.find((p) => p.id === o.linkedProblemId);
            const missingEvidence = !o.evidence.trim() || !o.validationExperiment.trim();
            return (
              <Card key={o.id} className="">
                <div className="row spread">
                  <div className="row">
                    <h2>{o.title || "Untitled"}</h2>
                    <Badge tone={STATUS_TONE[o.status]}>{o.status}</Badge>
                    {missingEvidence && <Badge tone="warn">missing evidence or experiment</Badge>}
                  </div>
                  <div className="row">
                    <select className="select input-sm" aria-label="Status" value={o.status} onChange={(e) => setStatus(o.id, e.target.value as OpportunityStatus)}>
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <Button variant="secondary" className="btn-sm" onClick={() => edit(o)}>Edit</Button>
                    <Button variant="ghost" className="btn-sm" onClick={() => remove(o.id)} aria-label={`Delete opportunity ${o.title}`}>Delete</Button>
                  </div>
                </div>
                <p>{o.problem}</p>
                <dl className="kv">
                  {o.targetUser && (<><dt>Target user</dt><dd>{o.targetUser}</dd></>)}
                  {linked && (<><dt>Linked problem</dt><dd>{linked.statement}</dd></>)}
                  {o.evidence && (<><dt>Evidence</dt><dd>{o.evidence}</dd></>)}
                  {o.validationExperiment && (<><dt>Experiment</dt><dd>{o.validationExperiment}</dd></>)}
                  {o.risks && (<><dt>Risks</dt><dd>{o.risks}</dd></>)}
                </dl>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

function Prioritise() {
  const { data, update } = useStore();
  const [method, setMethod] = useState<PrioritizationMethod>("RICE");
  const [rationaleFor, setRationaleFor] = useState<string | null>(null);

  const rows = data.opportunities
    .map((o) => ({ o, p: priorityFor(o, method) }))
    .sort((a, b) => (b.p.final ?? -Infinity) - (a.p.final ?? -Infinity));

  function setOverride(id: string, score: number | null, rationale: string) {
    update((d) => ({
      ...d,
      opportunities: d.opportunities.map((o) => {
        if (o.id !== id) return o;
        if (score === null || !Number.isFinite(score)) {
          const { override: _removed, ...rest } = o;
          return rest;
        }
        return { ...o, override: { score, rationale } };
      }),
    }));
  }

  if (data.opportunities.length === 0) {
    return (
      <Card>
        <EmptyState title="Nothing to prioritise yet.">Add opportunities in the Backlog tab first.</EmptyState>
      </Card>
    );
  }

  return (
    <>
      <Card title="Scoring method" subtitle="Assumptions are the inputs in each opportunity. Scores are only as good as those inputs.">
        <div className="row">
          <Field label="Method">
            <select className="select input-sm" value={method} onChange={(e) => setMethod(e.target.value as PrioritizationMethod)}>
              <option value="RICE">RICE = Reach × Impact × Confidence ÷ Effort</option>
              <option value="ICE">ICE = Impact × Confidence ÷ 10 × Ease</option>
            </select>
          </Field>
        </div>
        <p className="small muted">
          Strategic overrides replace the computed score. They always show their rationale and are flagged. Opportunities with zero effort have no RICE score.
        </p>
      </Card>

      <Card>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Opportunity</th>
                <th>Reach</th>
                <th>Impact</th>
                <th>Conf. %</th>
                <th>Effort</th>
                <th>Ease</th>
                <th>Computed</th>
                <th>Override</th>
                <th>Final</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ o, p }, i) => (
                <tr key={o.id}>
                  <td>{i + 1}</td>
                  <td>
                    <strong>{o.title}</strong>
                    <div className="small muted">{o.status}</div>
                    {(rationaleFor === o.id || o.override) && (
                      <input
                        className="input small"
                        style={{ marginTop: "0.35rem" }}
                        placeholder="Rationale for override"
                        aria-label={`Override rationale for ${o.title}`}
                        value={o.override?.rationale ?? ""}
                        onChange={(e) => setOverride(o.id, o.override?.score ?? null, e.target.value)}
                      />
                    )}
                  </td>
                  <td>{o.reach}</td>
                  <td>{o.impact}</td>
                  <td>{o.confidence}</td>
                  <td>{o.effort}</td>
                  <td>{o.ease}</td>
                  <td>{p.computed ?? <span className="muted">n/a</span>}</td>
                  <td>
                    <input
                      className="input input-sm"
                      type="number"
                      step="any"
                      aria-label={`Override score for ${o.title}`}
                      placeholder="none"
                      value={o.override?.score ?? ""}
                      onFocus={() => setRationaleFor(o.id)}
                      onChange={(e) => {
                        const v = e.target.value === "" ? null : Number(e.target.value);
                        setOverride(o.id, v, o.override?.rationale ?? "");
                      }}
                      style={{ width: 90 }}
                    />
                  </td>
                  <td>
                    <strong>{p.final ?? "n/a"}</strong>
                    {p.overridden && <div><Badge tone="warn">overridden</Badge></div>}
                    {p.overridden && !o.override?.rationale.trim() && (
                      <div><Badge tone="bad">rationale required</Badge></div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
