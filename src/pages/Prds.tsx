import { useMemo, useState, type FormEvent } from "react";
import { Badge, Button, Card, EmptyState, Field, Notice, PageHeader, type Tone } from "../components/ui";
import { askAI } from "../lib/ai";
import { opportunityBrief, PRD_SECTIONS, PRD_SYSTEM } from "../lib/prompts";
import { nowIso, uid, useStore } from "../lib/store";
import type { Prd, PrdStatus } from "../lib/types";

const STATUS_TONE: Record<PrdStatus, Tone> = { draft: "neutral", in_review: "info", approved: "good" };

export const PRD_TEMPLATE = PRD_SECTIONS.map((s) => `## ${s}\n\nTBD\n`).join("\n");

/** Line-level comparison: lines only in the newer version are "added", lines only in the older are "removed". */
export function lineDiff(older: string, newer: string): { added: string[]; removed: string[] } {
  const a = older.split("\n");
  const b = newer.split("\n");
  const aSet = new Set(a);
  const bSet = new Set(b);
  return {
    added: b.filter((l) => l.trim() && !aSet.has(l)),
    removed: a.filter((l) => l.trim() && !bSet.has(l)),
  };
}

export function Prds() {
  const { data, update } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const selected = data.prds.find((p) => p.id === selectedId) ?? null;

  function createPrd(e: FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const now = nowIso();
    const prd: Prd = {
      id: uid(),
      title: newTitle.trim(),
      status: "draft",
      body: `# ${newTitle.trim()}\n\n${PRD_TEMPLATE}`,
      versions: [],
      createdAt: now,
      updatedAt: now,
    };
    update((d) => ({ ...d, prds: [prd, ...d.prds] }));
    setSelectedId(prd.id);
    setNewTitle("");
    setCreating(false);
  }

  return (
    <>
      <PageHeader
        title="PRDs & Documentation"
        description="Versioned requirements documents with an approval step. AI drafts are never saved until you save them."
        actions={<Button onClick={() => setCreating((c) => !c)}>{creating ? "Cancel" : "New PRD"}</Button>}
      />

      {creating && (
        <Card title="New PRD">
          <form onSubmit={createPrd} className="row">
            <input className="input" placeholder="PRD title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} aria-label="PRD title" />
            <Button type="submit" disabled={!newTitle.trim()}>Create</Button>
          </form>
        </Card>
      )}

      <div className="grid" style={{ gridTemplateColumns: "minmax(220px, 280px) 1fr", alignItems: "start" }}>
        <Card title="Documents">
          {data.prds.length === 0 && <EmptyState title="No PRDs yet." />}
          <div className="stack">
            {data.prds.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className="item"
                style={{ textAlign: "left", cursor: "pointer", background: p.id === selectedId ? "#e7ecff" : undefined }}
                aria-current={p.id === selectedId}
              >
                <div className="item-title">{p.title}</div>
                <div className="row" style={{ marginTop: "0.25rem" }}>
                  <Badge tone={STATUS_TONE[p.status]}>{p.status.replace("_", " ")}</Badge>
                  <span className="small muted">v{p.versions.length}</span>
                </div>
              </button>
            ))}
          </div>
        </Card>

        {selected ? <Editor key={selected.id} prd={selected} /> : (
          <Card>
            <EmptyState title="Select a document or create a new PRD." />
          </Card>
        )}
      </div>
    </>
  );
}

function Editor({ prd }: { prd: Prd }) {
  const { data, update } = useStore();
  const [body, setBody] = useState(prd.body);
  const [note, setNote] = useState("");
  const [opportunityId, setOpportunityId] = useState(prd.linkedOpportunityId ?? "");
  const [compareVersion, setCompareVersion] = useState<number | null>(
    prd.versions.length > 0 ? prd.versions[prd.versions.length - 1].version : null,
  );
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approver, setApprover] = useState("");
  const dirty = body !== prd.body;

  const linkedOpp = data.opportunities.find((o) => o.id === opportunityId);

  const diff = useMemo(() => {
    const v = prd.versions.find((x) => x.version === compareVersion);
    return v ? lineDiff(v.body, body) : null;
  }, [prd.versions, compareVersion, body]);

  function save() {
    update((d) => ({
      ...d,
      prds: d.prds.map((p) => {
        if (p.id !== prd.id) return p;
        const changed = body !== p.body;
        const nextVersion = p.versions.length + 1;
        const versions = changed
          ? [...p.versions, { version: nextVersion, savedAt: nowIso(), body: p.body, note: note.trim() || "Saved edit" }]
          : p.versions;
        // Editing an approved PRD resets it to draft so the change must be approved again.
        const status: PrdStatus = changed && p.status === "approved" ? "draft" : p.status;
        return {
          ...p,
          body,
          versions,
          status,
          linkedOpportunityId: opportunityId || undefined,
          approvedBy: changed && p.status === "approved" ? undefined : p.approvedBy,
          approvedAt: changed && p.status === "approved" ? undefined : p.approvedAt,
          updatedAt: nowIso(),
        };
      }),
    }));
    setNote("");
    setError(null);
  }

  function setStatus(status: PrdStatus) {
    update((d) => ({ ...d, prds: d.prds.map((p) => (p.id === prd.id ? { ...p, status, updatedAt: nowIso() } : p)) }));
  }

  function approve() {
    if (!approver.trim()) return setError("Enter the approver's name. Approvals must be attributable.");
    update((d) => ({
      ...d,
      prds: d.prds.map((p) =>
        p.id === prd.id ? { ...p, status: "approved", approvedBy: approver.trim(), approvedAt: nowIso(), updatedAt: nowIso() } : p,
      ),
    }));
    setApprover("");
    setError(null);
  }

  function restore(version: number) {
    const v = prd.versions.find((x) => x.version === version);
    if (!v) return;
    if (dirty && !window.confirm("Replace unsaved edits with this version?")) return;
    setBody(v.body);
  }

  async function draftWithAI() {
    if (dirty && !window.confirm("Replace the current text with an AI draft? Unsaved edits will be lost.")) return;
    setDrafting(true);
    setError(null);
    try {
      const context = linkedOpp
        ? opportunityBrief(linkedOpp)
        : "No opportunity linked. Write the PRD from the title only and mark every unknown as TBD.";
      const text = await askAI({
        system: PRD_SYSTEM,
        messages: [{ role: "user", content: `PRD title: ${prd.title}\n\nOpportunity context:\n${context}` }],
        maxTokens: 3500,
      });
      setBody(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Drafting failed.");
    } finally {
      setDrafting(false);
    }
  }

  return (
    <div className="stack">
      <Card
        title={prd.title}
        subtitle={`v${prd.versions.length + 1} · last updated ${new Date(prd.updatedAt).toLocaleString()}`}
        actions={<Badge tone={STATUS_TONE[prd.status]}>{prd.status.replace("_", " ")}</Badge>}
      >
        <div className="form-grid" style={{ marginBottom: "0.75rem" }}>
          <Field label="Linked opportunity">
            <select className="select" value={opportunityId} onChange={(e) => setOpportunityId(e.target.value)}>
              <option value="">None</option>
              {data.opportunities.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
            </select>
          </Field>
          <Field label="Version note" hint="Describe what changed.">
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Added pricing constraints" />
          </Field>
        </div>

        <label className="field" style={{ marginBottom: "0.5rem" }}>
          <span className="field-label">Document (Markdown)</span>
          <textarea className="textarea mono" value={body} onChange={(e) => setBody(e.target.value)} />
        </label>

        {error && <Notice tone="bad">{error}</Notice>}
        <div className="row">
          <Button onClick={save} disabled={!dirty}>Save version</Button>
          <Button variant="secondary" onClick={() => void draftWithAI()} disabled={drafting}>
            {drafting ? (<><span className="spinner" aria-hidden="true" />Drafting…</>) : "Draft with AI"}
          </Button>
          {dirty && <span className="small muted">Unsaved changes</span>}
        </div>
        <p className="small muted" style={{ marginTop: "0.5rem" }}>
          AI drafts fill the editor only. They are not saved until you click Save version, and every assumption should be checked against the linked opportunity.
        </p>
      </Card>

      <Card title="Review and approval">
        {prd.status === "approved" ? (
          <p className="small">Approved by <strong>{prd.approvedBy}</strong> on {prd.approvedAt && new Date(prd.approvedAt).toLocaleString()}. Any saved edit returns this PRD to draft.</p>
        ) : (
          <div className="row">
            {prd.status === "draft" && <Button variant="secondary" onClick={() => setStatus("in_review")}>Request review</Button>}
            {prd.status === "in_review" && <Button variant="secondary" onClick={() => setStatus("draft")}>Return to draft</Button>}
            <input className="input" style={{ maxWidth: 220 }} placeholder="Approver name" value={approver} onChange={(e) => setApprover(e.target.value)} aria-label="Approver name" />
            <Button onClick={approve} disabled={prd.status !== "in_review"}>Approve</Button>
          </div>
        )}
      </Card>

      <Card title="Version history" subtitle="Compare the current text with a saved version. Lines only in the current text are added; lines only in the saved version are removed.">
        {prd.versions.length === 0 ? (
          <EmptyState title="No saved versions yet." />
        ) : (
          <>
            <div className="row" style={{ marginBottom: "0.5rem" }}>
              <select className="select input-sm" aria-label="Compare with version" value={compareVersion ?? ""} onChange={(e) => setCompareVersion(Number(e.target.value))}>
                {prd.versions.map((v) => (
                  <option key={v.version} value={v.version}>v{v.version} — {v.note}</option>
                ))}
              </select>
            </div>
            {diff && (
              <div className="small" style={{ marginBottom: "0.75rem" }}>
                <div style={{ color: "var(--good)" }}>+ {diff.added.length} line(s) added in the current text</div>
                <div style={{ color: "var(--bad)" }}>− {diff.removed.length} line(s) removed from that version</div>
              </div>
            )}
            <div className="stack">
              {[...prd.versions].reverse().map((v) => (
                <div key={v.version} className="item row spread">
                  <span className="small">v{v.version} · {new Date(v.savedAt).toLocaleString()} · {v.note}</span>
                  <Button variant="ghost" className="btn-sm" onClick={() => restore(v.version)}>Load into editor</Button>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
