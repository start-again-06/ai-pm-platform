import { useState, type FormEvent } from "react";
import { Badge, Button, Card, EmptyState, Field, PageHeader, KIND_TONE } from "../components/ui";
import { daysBetween, nowIso, uid, useStore } from "../lib/store";
import type { CompanyProfile, KnowledgeItem, KnowledgeKind } from "../lib/types";

const PROFILE_FIELDS: Array<{ key: Exclude<keyof CompanyProfile, "strategicObjectives">; label: string; hint: string; multi?: boolean }> = [
  { key: "name", label: "Company or product name", hint: "" },
  { key: "mission", label: "Mission", hint: "Why the company exists." },
  { key: "vision", label: "Vision", hint: "Where the company is going." },
  { key: "businessModel", label: "Business model", hint: "How value is captured.", multi: true },
  { key: "pricing", label: "Pricing", hint: "Current plans and prices. Leave blank if unknown.", multi: true },
  { key: "targetCustomers", label: "Target customers", hint: "Segments and personas.", multi: true },
  { key: "competitors", label: "Competitors", hint: "Names you know. The AI will not invent features for them.", multi: true },
  { key: "techConstraints", label: "Technical constraints", hint: "Stack, compliance, integrations.", multi: true },
  { key: "team", label: "Team and capacity", hint: "Roles and available engineering capacity.", multi: true },
];

const KINDS: Array<{ value: KnowledgeKind; help: string }> = [
  { value: "verified", help: "Confirmed fact with a source (e.g. a dashboard, contract or interview transcript)." },
  { value: "hypothesis", help: "Something to test. Not yet proven." },
  { value: "assumption", help: "Something taken as true for planning. Should be challenged." },
  { value: "recommendation", help: "A proposed course of action." },
];

export function CompanyIntel() {
  const { data, update } = useStore();
  const [draft, setDraft] = useState(data.profile);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [objectivesText, setObjectivesText] = useState(data.profile.strategicObjectives.join("\n"));

  const [kind, setKind] = useState<KnowledgeKind>("hypothesis");
  const [category, setCategory] = useState("");
  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  function saveProfile(e: FormEvent) {
    e.preventDefault();
    const objectives = objectivesText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    update((d) => ({ ...d, profile: { ...draft, strategicObjectives: objectives } }));
    setSavedAt(nowIso());
  }

  function addKnowledge(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return setFormError("Describe the knowledge item.");
    if (kind === "verified" && !source.trim()) {
      return setFormError("Verified facts need a source (where this was confirmed), so they can be checked later.");
    }
    const item: KnowledgeItem = {
      id: uid(),
      kind,
      category: category.trim() || "General",
      text: text.trim(),
      source: source.trim(),
      createdAt: nowIso(),
    };
    update((d) => ({ ...d, knowledge: [item, ...d.knowledge] }));
    setText("");
    setSource("");
    setFormError(null);
  }

  function removeKnowledge(id: string) {
    update((d) => ({ ...d, knowledge: d.knowledge.filter((k) => k.id !== id) }));
  }

  const kindHelp = KINDS.find((k) => k.value === kind)?.help;

  return (
    <>
      <PageHeader
        title="Company Intelligence"
        description="The persistent context every AI answer relies on. Keep it accurate: the assistant only knows what is written here."
      />

      <Card
        title="Company profile"
        actions={savedAt && <Badge tone="good">saved</Badge>}
      >
        <form onSubmit={saveProfile} className="stack">
          <div className="form-grid">
            {PROFILE_FIELDS.map((f) => (
              <Field key={f.key} label={f.label} hint={f.hint || undefined} wide={f.multi}>
                {f.multi ? (
                  <textarea
                    className="textarea"
                    value={draft[f.key]}
                    onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                  />
                ) : (
                  <input
                    className="input"
                    value={draft[f.key]}
                    onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                  />
                )}
              </Field>
            ))}
            <Field label="Strategic objectives" hint="One per line. Roadmap items link to these." wide>
              <textarea className="textarea" value={objectivesText} onChange={(e) => setObjectivesText(e.target.value)} />
            </Field>
          </div>
          <div>
            <Button type="submit">Save profile</Button>
          </div>
        </form>
      </Card>

      <Card
        title="Knowledge items"
        subtitle="Every item is labelled. Verified items need a source. Items older than 180 days are flagged as possibly stale."
      >
        <form onSubmit={addKnowledge} className="form-grid" style={{ marginBottom: "1rem" }}>
          <Field label="Kind">
            <select className="select" value={kind} onChange={(e) => setKind(e.target.value as KnowledgeKind)}>
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.value}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Category">
            <input className="input" placeholder="Pricing, churn, market…" value={category} onChange={(e) => setCategory(e.target.value)} />
          </Field>
          <Field label={kind === "verified" ? "Source (required)" : "Source (optional)"} hint={kindHelp}>
            <input className="input" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Link, document name or interview ID" />
          </Field>
          <Field label="Statement" wide>
            <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <div className="field-wide">
            {formError && <p className="small" style={{ color: "var(--bad)" }}>{formError}</p>}
            <Button type="submit">Add item</Button>
          </div>
        </form>

        {data.knowledge.length === 0 ? (
          <EmptyState title="No knowledge items yet.">Add verified facts, hypotheses and assumptions with their sources.</EmptyState>
        ) : (
          <div className="stack">
            {data.knowledge.map((k) => {
              const age = daysBetween(k.createdAt);
              return (
                <div key={k.id} className="item">
                  <div className="row spread">
                    <div className="row">
                      <Badge tone={KIND_TONE[k.kind]}>{k.kind}</Badge>
                      <Badge>{k.category}</Badge>
                      {age > 180 && <Badge tone="warn">possibly stale · {age}d</Badge>}
                    </div>
                    <Button variant="ghost" className="btn-sm" onClick={() => removeKnowledge(k.id)} aria-label={`Delete item: ${k.text}`}>
                      Delete
                    </Button>
                  </div>
                  <p>{k.text}</p>
                  {k.source && <p className="small muted">Source: {k.source}</p>}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
