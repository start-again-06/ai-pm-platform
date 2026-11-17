import type { AppData, Opportunity } from "./types";

export type PrioritizationMethod = "RICE" | "ICE";

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * RICE = (Reach × Impact × Confidence) ÷ Effort
 * Reach: users per quarter. Impact: 1–10. Confidence: 0–100 %. Effort: person-weeks.
 * Returns null when effort is not positive, because the score is undefined.
 */
export function riceScore(o: Pick<Opportunity, "reach" | "impact" | "confidence" | "effort">): number | null {
  if (!(o.effort > 0)) return null;
  return round2((o.reach * o.impact * (o.confidence / 100)) / o.effort);
}

/**
 * ICE = Impact × Confidence × Ease. Each factor is 1–10, so confidence % is divided by 10.
 */
export function iceScore(o: Pick<Opportunity, "impact" | "confidence" | "ease">): number {
  return round2(o.impact * (o.confidence / 10) * o.ease);
}

export interface PriorityResult {
  computed: number | null;
  final: number | null;
  overridden: boolean;
}

/** Spec §E: do not blindly apply formulas. A strategic override replaces the computed score and is flagged. */
export function priorityFor(o: Opportunity, method: PrioritizationMethod): PriorityResult {
  const computed = method === "RICE" ? riceScore(o) : iceScore(o);
  if (o.override) {
    return { computed, final: o.override.score, overridden: true };
  }
  return { computed, final: computed, overridden: false };
}

export interface HealthComponent {
  key: "strategy" | "evidence" | "problems" | "traceability";
  label: string;
  /** 0–100, or null when there is nothing to measure yet. Null components are excluded from the average. */
  value: number | null;
  numerator: number;
  denominator: number;
  formula: string;
}

export interface HealthResult {
  score: number | null;
  components: HealthComponent[];
}

const pct = (num: number, den: number): number | null => (den === 0 ? null : Math.round((num / den) * 100));

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Product health score. The formula is deliberately simple and shown to the user.
 * Score = mean of the components that have data.
 */
export function healthScore(data: AppData, now: Date = new Date()): HealthResult {
  // 1. Strategy alignment: roadmap items with a link, an objective and a metric.
  const aligned = data.roadmap.filter(
    (r) => (r.linkedProblemId || r.linkedOpportunityId) && r.objective.trim() && r.successMetric.trim(),
  ).length;

  // 2. Evidence coverage: opportunities with evidence and a validation experiment.
  const evidenced = data.opportunities.filter((o) => o.evidence.trim() && o.validationExperiment.trim()).length;

  // 3. Problem quality: problems a human has reviewed and rated medium or high confidence.
  const trusted = data.problems.filter((p) => p.reviewed && p.confidence !== "low").length;

  // 4. Decision traceability: decisions older than 30 days that have a recorded outcome.
  const mature = data.decisions.filter((d) => now.getTime() - new Date(d.createdAt).getTime() >= 30 * DAY_MS);
  const withOutcome = mature.filter((d) => d.outcome && d.outcome.trim()).length;

  const components: HealthComponent[] = [
    {
      key: "strategy",
      label: "Strategy alignment",
      value: pct(aligned, data.roadmap.length),
      numerator: aligned,
      denominator: data.roadmap.length,
      formula: "Roadmap items with a problem/opportunity link, objective and metric ÷ all roadmap items",
    },
    {
      key: "evidence",
      label: "Evidence coverage",
      value: pct(evidenced, data.opportunities.length),
      numerator: evidenced,
      denominator: data.opportunities.length,
      formula: "Opportunities with evidence and a validation experiment ÷ all opportunities",
    },
    {
      key: "problems",
      label: "Reviewed problem confidence",
      value: pct(trusted, data.problems.length),
      numerator: trusted,
      denominator: data.problems.length,
      formula: "Problems reviewed by a human with medium/high confidence ÷ all problems",
    },
    {
      key: "traceability",
      label: "Decision traceability",
      value: pct(withOutcome, mature.length),
      numerator: withOutcome,
      denominator: mature.length,
      formula: "Decisions older than 30 days with a recorded outcome ÷ decisions older than 30 days",
    },
  ];

  const measured = components.map((c) => c.value).filter((v): v is number => v !== null);
  const score = measured.length === 0 ? null : Math.round(measured.reduce((a, b) => a + b, 0) / measured.length);

  return { score, components };
}
