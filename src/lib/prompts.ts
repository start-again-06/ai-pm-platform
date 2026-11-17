import type { AppData, CustomerProblem, Opportunity } from "./types";

/** Spec §B, §C and §6: the assistant must not invent facts and must label what kind of claim it is making. */
export const GOVERNANCE = `You are the AI Product Manager inside a product management platform.
Rules you must follow:
- Never invent facts, competitor features, market sizes, prices or financial figures.
- Label each substantive claim as VERIFIED (only if it is in the company context below, cite its source), HYPOTHESIS, ASSUMPTION, or RECOMMENDATION.
- If information is missing, say so plainly and list what is needed.
- Challenge unsupported assumptions in the user's question rather than simply agreeing.
- Never claim causation from correlation alone.
- Be concise and decision-oriented.`;

export const PRD_SECTIONS = [
  "Problem statement",
  "Background and context",
  "Business objectives",
  "Target users",
  "User journeys",
  "Proposed solution",
  "Scope and exclusions",
  "Functional requirements",
  "Non-functional requirements",
  "User stories",
  "Acceptance criteria",
  "Success metrics",
  "Dependencies",
  "Risks",
  "Open questions",
] as const;

export const PRD_SYSTEM = `${GOVERNANCE}

Write a Product Requirements Document in Markdown. Use these level-2 headings, in this exact order:
${PRD_SECTIONS.map((s) => `## ${s}`).join("\n")}
Write "TBD" wherever the context does not contain the information, and list those gaps under "Open questions".`;

export const PROBLEM_EXTRACTION_SYSTEM = `${GOVERNANCE}

You will receive raw customer feedback. Extract the underlying customer PROBLEMS, not feature requests.
Rank by pain (severity and business impact), not by how often a feature is mentioned.
Respond with ONLY a JSON object, no prose, in this shape:
{"problems":[{"segment":"string","statement":"string","evidence":["verbatim quote copied exactly from the input"],"frequency":1,"severity":1,"businessImpact":"string","confidence":"low|medium|high","nextAction":"string"}]}
frequency and severity are integers from 1 to 5. Every evidence quote must be an exact substring of the input.`;

const MAX_CONTEXT_CHARS = 12_000;

function truncate(s: string, max = MAX_CONTEXT_CHARS): string {
  return s.length <= max ? s : `${s.slice(0, max)}\n[context truncated]`;
}

/** Organisational memory: compile the knowledge the assistant is allowed to rely on. */
export function companyContext(data: AppData): string {
  const p = data.profile;
  const lines: string[] = [];

  lines.push("## Company profile (kind: verified company input)");
  const profileFields: Array<[string, string]> = [
    ["Name", p.name],
    ["Mission", p.mission],
    ["Vision", p.vision],
    ["Business model", p.businessModel],
    ["Pricing", p.pricing],
    ["Target customers", p.targetCustomers],
    ["Competitors (as entered by user)", p.competitors],
    ["Technical constraints", p.techConstraints],
    ["Team", p.team],
  ];
  for (const [label, value] of profileFields) {
    if (value.trim()) lines.push(`- ${label}: ${value.trim()}`);
  }
  if (p.strategicObjectives.length) {
    lines.push(`- Strategic objectives: ${p.strategicObjectives.join("; ")}`);
  }

  if (data.knowledge.length) {
    lines.push("\n## Knowledge items");
    for (const k of data.knowledge) {
      lines.push(`- [${k.kind}] (${k.category}) ${k.text}${k.source ? ` — source: ${k.source}` : ""}`);
    }
  }

  const reviewedProblems = data.problems.filter((x) => x.reviewed);
  if (reviewedProblems.length) {
    lines.push("\n## Reviewed customer problems");
    for (const pr of reviewedProblems) {
      lines.push(
        `- [${pr.segment}] ${pr.statement} (frequency ${pr.frequency}/5, severity ${pr.severity}/5, confidence ${pr.confidence})`,
      );
    }
  }

  if (data.opportunities.length) {
    lines.push("\n## Opportunities");
    for (const o of data.opportunities) {
      lines.push(`- ${o.title} [${o.status}]: ${o.problem || "no problem statement"}`);
    }
  }

  if (data.roadmap.length) {
    lines.push("\n## Roadmap");
    for (const r of data.roadmap) {
      lines.push(`- (${r.bucket}/${r.status}) ${r.title} — objective: ${r.objective}; metric: ${r.successMetric}`);
    }
  }

  return truncate(lines.join("\n") || "No company context has been entered yet.");
}

export function opportunityBrief(o: Opportunity): string {
  return [
    `Title: ${o.title}`,
    `Problem: ${o.problem}`,
    `Target user: ${o.targetUser}`,
    `Jobs to be done: ${o.jobsToBeDone}`,
    `Evidence: ${o.evidence}`,
    `Existing alternatives: ${o.alternatives}`,
    `Proposed solution: ${o.proposedSolution}`,
    `Differentiation: ${o.differentiation}`,
    `Business impact: ${o.businessImpact}`,
    `Risks: ${o.risks}`,
    `Validation experiment: ${o.validationExperiment}`,
  ].join("\n");
}

/** Normalise text so quote verification is tolerant of whitespace and case. */
const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

export interface ExtractedProblem {
  segment: string;
  statement: string;
  evidence: string[];
  frequency: number;
  severity: number;
  businessImpact: string;
  confidence: CustomerProblem["confidence"];
  nextAction: string;
  /** Quotes the model returned that were NOT found in the input. These are dropped, never shown as evidence. */
  rejectedQuotes: number;
}

/**
 * Parse and verify the model's JSON. Quotes that do not appear in the source text are removed,
 * and a problem with no verified quote is downgraded to low confidence. This is the anti-fabrication guard.
 */
export function parseExtractedProblems(raw: string, sourceText: string): ExtractedProblem[] {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("The AI response did not contain JSON. Try again with shorter feedback.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw new Error("The AI response was not valid JSON. Try again.");
  }
  const list = (parsed as { problems?: unknown }).problems;
  if (!Array.isArray(list)) throw new Error("The AI response had no problems list.");

  const haystack = norm(sourceText);
  const toScale = (n: unknown) => {
    const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : 3;
    return Math.min(5, Math.max(1, v));
  };
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  return list.slice(0, 20).map((item) => {
    const r = (item ?? {}) as Record<string, unknown>;
    const quotes = Array.isArray(r.evidence) ? r.evidence.filter((q): q is string => typeof q === "string") : [];
    const verified = quotes.filter((q) => q.trim().length > 0 && haystack.includes(norm(q)));
    const rejectedQuotes = quotes.length - verified.length;
    const claimedConfidence = r.confidence === "high" || r.confidence === "medium" ? r.confidence : "low";
    return {
      segment: str(r.segment) || "Unspecified",
      statement: str(r.statement),
      evidence: verified,
      frequency: toScale(r.frequency),
      severity: toScale(r.severity),
      businessImpact: str(r.businessImpact),
      confidence: verified.length === 0 ? "low" : claimedConfidence,
      nextAction: str(r.nextAction),
      rejectedQuotes,
    };
  });
}
