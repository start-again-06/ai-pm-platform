// Domain model for the AI Product Manager. Everything persisted in the browser follows these shapes.

/** Spec §A: every knowledge item is labelled so verified facts are never confused with guesses. */
export type KnowledgeKind = "verified" | "hypothesis" | "assumption" | "recommendation";

export interface KnowledgeItem {
  id: string;
  kind: KnowledgeKind;
  category: string;
  text: string;
  /** Where this came from. Required for `verified` items. */
  source: string;
  createdAt: string;
}

export interface CompanyProfile {
  name: string;
  mission: string;
  vision: string;
  businessModel: string;
  pricing: string;
  targetCustomers: string;
  competitors: string;
  techConstraints: string;
  team: string;
  strategicObjectives: string[];
}

export type Confidence = "low" | "medium" | "high";

export interface CustomerProblem {
  id: string;
  segment: string;
  statement: string;
  /** Verbatim quotes that support the problem. */
  evidence: string[];
  /** 1 (rare) to 5 (constant). */
  frequency: number;
  /** 1 (minor annoyance) to 5 (blocks the job or causes churn). */
  severity: number;
  businessImpact: string;
  confidence: Confidence;
  nextAction: string;
  source: "manual" | "ai-extracted";
  /** A human has checked the evidence. Unreviewed AI output should not drive prioritisation. */
  reviewed: boolean;
  createdAt: string;
}

export type OpportunityStatus = "backlog" | "validating" | "validated" | "rejected" | "building";

export interface Opportunity {
  id: string;
  title: string;
  problem: string;
  targetUser: string;
  jobsToBeDone: string;
  evidence: string;
  alternatives: string;
  proposedSolution: string;
  differentiation: string;
  businessImpact: string;
  risks: string;
  validationExperiment: string;
  status: OpportunityStatus;
  linkedProblemId?: string;
  /** RICE inputs. Reach = users affected per quarter. */
  reach: number;
  /** Impact on a 1–10 scale (used by both RICE and ICE). */
  impact: number;
  /** Confidence as a percentage, 0–100. */
  confidence: number;
  /** Effort in person-weeks (RICE denominator). */
  effort: number;
  /** Ease / technical feasibility on a 1–10 scale (ICE). */
  ease: number;
  /** Strategic override of the computed score. The rationale is always shown beside it. */
  override?: { score: number; rationale: string };
  createdAt: string;
}

export type RoadmapBucket = "now" | "next" | "later";
export type RoadmapStatus = "planned" | "in_progress" | "shipped" | "paused";

export interface RoadmapItem {
  id: string;
  title: string;
  bucket: RoadmapBucket;
  status: RoadmapStatus;
  /** Spec §E: every roadmap item must link to a customer problem or opportunity, an objective and a metric. */
  linkedProblemId?: string;
  linkedOpportunityId?: string;
  objective: string;
  successMetric: string;
  createdAt: string;
}

export type PrdStatus = "draft" | "in_review" | "approved";

export interface PrdVersion {
  version: number;
  savedAt: string;
  body: string;
  note: string;
}

export interface Prd {
  id: string;
  title: string;
  status: PrdStatus;
  linkedOpportunityId?: string;
  body: string;
  versions: PrdVersion[];
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DecisionEntry {
  id: string;
  date: string;
  title: string;
  decision: string;
  context: string;
  alternatives: string;
  tradeoffs: string;
  expectedImpact: string;
  confidence: Confidence;
  owner: string;
  outcome?: string;
  outcomeRecordedAt?: string;
  createdAt: string;
}

export interface AppData {
  schemaVersion: 1;
  profile: CompanyProfile;
  knowledge: KnowledgeItem[];
  problems: CustomerProblem[];
  opportunities: Opportunity[];
  roadmap: RoadmapItem[];
  prds: Prd[];
  decisions: DecisionEntry[];
}
