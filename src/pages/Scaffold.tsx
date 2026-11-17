import { Badge, Card, PageHeader } from "../components/ui";

/**
 * Modules from the product spec that are NOT yet functional. They are honest placeholders:
 * they state what the spec requires and what is needed to build them. No fake data, no dead buttons.
 */
export type ScaffoldId =
  | "market"
  | "design"
  | "engineering"
  | "analytics"
  | "experiments"
  | "finance"
  | "reports"
  | "integrations"
  | "agents";

interface ScaffoldDef {
  title: string;
  phase: string;
  summary: string;
  spec: string[];
  needs: string[];
}

export const SCAFFOLDS: Record<ScaffoldId, ScaffoldDef> = {
  market: {
    title: "Market Research & Competitive Intelligence",
    phase: "Phase 4 — Advanced intelligence",
    summary: "Source-backed market research, competitor matrices and positioning maps.",
    spec: [
      "TAM / SAM / SOM analysis, PESTLE, SWOT and Porter's Five Forces",
      "Competitor feature, pricing and positioning comparison",
      "Every external claim carries a source, date and link",
    ],
    needs: [
      "A web research connector with source capture (search and fetch)",
      "A schema for sourced claims (claim, source URL, retrieved date)",
      "Rules that block competitor or market figures without a source",
    ],
  },
  design: {
    title: "Design & Prototyping",
    phase: "Phase 4 — Advanced intelligence",
    summary: "Usability review, user flows, information architecture and design briefs.",
    spec: ["User flows and information architecture", "Usability and accessibility review", "Figma connector"],
    needs: ["Figma API credentials (OAuth) through the connector flow", "A design-review rubric tied to usability principles"],
  },
  engineering: {
    title: "Engineering & Development Collaboration",
    phase: "Phase 3 — Agentic execution",
    summary: "Read Jira, Linear and GitHub status and prepare proposed backlog changes.",
    spec: [
      "Epic and ticket breakdown with acceptance criteria",
      "Blocker and scope-creep tracking",
      "Proposed changes only: no merges, deploys or config changes without explicit approval",
    ],
    needs: ["Jira / Linear / GitHub OAuth connectors", "An approval queue for proposed backlog writes"],
  },
  analytics: {
    title: "Product Analytics & Data Intelligence",
    phase: "Phase 2 — Product decision intelligence",
    summary: "Monitor product metrics, detect anomalies and investigate root causes.",
    spec: [
      "DAU/MAU, activation, retention, churn, funnel drop-offs, cohorts",
      "Anomaly detection and root-cause hypothesis ranking",
      "Every analysis states data source, timeframe, comparison group and confidence",
    ],
    needs: ["An analytics connector (Amplitude, Mixpanel, PostHog or a SQL warehouse)", "Read-only credentials", "Metric definitions agreed with the team"],
  },
  experiments: {
    title: "Experimentation & Validation",
    phase: "Phase 2 — Product decision intelligence",
    summary: "Hypotheses, experiment plans, significance checks and an experiment repository.",
    spec: [
      "Hypothesis formulation, sample size and primary and guardrail metrics",
      "Significance calculations where appropriate",
      "Launch, iterate or abandon recommendations",
    ],
    needs: ["Experiment results data (from your experimentation tool or analytics)", "Agreement on significance thresholds"],
  },
  finance: {
    title: "Business & Financial Intelligence",
    phase: "Phase 4 — Advanced intelligence",
    summary: "Unit economics, LTV/CAC, payback and business cases for initiatives.",
    spec: [
      "LTV/CAC, gross and contribution margin, payback period",
      "Business cases that separate actual financial data from modelled estimates",
    ],
    needs: ["Actual financial data (Stripe or a finance export) or manual entry", "Explicit labels for every modelled assumption"],
  },
  reports: {
    title: "Reports & Stakeholder Operations",
    phase: "Phase 3 — Agentic execution",
    summary: "Weekly updates, monthly and quarterly reviews, leadership summaries.",
    spec: ["Weekly product updates and QBR/MBR packs", "Reporting formats for founders, executives, engineering, sales and customers"],
    needs: ["Phase 1 and 2 data (in progress)", "Report templates agreed with stakeholders"],
  },
  integrations: {
    title: "Integrations",
    phase: "Phase 3 — Agentic execution",
    summary: "Unified connector layer with permissions, sync status and error handling.",
    spec: [
      "Google Workspace, Slack, Notion, Confluence, Jira, Linear, GitHub, GitLab, Figma",
      "Analytics: Amplitude, Mixpanel, PostHog, Google Analytics",
      "CRM and support: HubSpot, Salesforce, Intercom, Zendesk",
      "Payments and data: Stripe, SQL databases, data warehouses",
    ],
    needs: [
      "Each connector needs its own OAuth or API credentials, set by the account owner",
      "Nothing is shown as connected until a real credential check succeeds",
    ],
  },
  agents: {
    title: "Agent Management",
    phase: "Phase 3 — Agentic execution",
    summary: "The specialist agent roster and graduated autonomy controls.",
    spec: [
      "14 specialist agents coordinated by a CPO agent (strategy, research, PRD, analytics, finance, governance and others)",
      "Graduated autonomy: Level 1 recommend, Level 2 draft for approval, Level 3 reversible actions, Level 4 approved recurring workflows",
      "Audit trail and approval for consequential actions",
    ],
    needs: ["Scheduled job runner and durable queue (server-side)", "Approval workflow and audit log tables"],
  },
};

export function Scaffold({ id }: { id: ScaffoldId }) {
  const def = SCAFFOLDS[id];
  return (
    <>
      <PageHeader
        title={def.title}
        description={def.summary}
        badge={<Badge tone="warn">not yet functional</Badge>}
      />
      <div className="grid grid-2">
        <Card title="What the spec requires">
          <ul className="scaffold-list">
            {def.spec.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <p className="small muted">Planned for: {def.phase}</p>
        </Card>
        <Card title="What is needed to build it">
          <ul className="scaffold-list">
            {def.needs.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
