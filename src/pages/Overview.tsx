import { Link } from "react-router-dom";
import { Badge, Card, EmptyState, PageHeader, Stat, type Tone } from "../components/ui";
import { useStore, daysBetween } from "../lib/store";
import { healthScore, priorityFor } from "../lib/scoring";
import type { AppData } from "../lib/types";

interface Recommendation {
  tone: Tone;
  text: string;
  to: string;
}

/**
 * Rule-based checks. These are deterministic, explainable and do not call the AI.
 * They surface gaps in the product system itself.
 */
export function buildRecommendations(data: AppData, now: Date = new Date()): Recommendation[] {
  const out: Recommendation[] = [];
  const p = data.profile;

  if (!p.mission.trim() || p.strategicObjectives.length === 0) {
    out.push({
      tone: "warn",
      text: "Add a mission and strategic objectives. Roadmap items cannot be traced to company goals without them.",
      to: "/company",
    });
  }

  const unreviewed = data.problems.filter((x) => !x.reviewed).length;
  if (unreviewed > 0) {
    out.push({
      tone: "warn",
      text: `${unreviewed} customer problem(s) await human review. Unreviewed AI output is excluded from health scoring.`,
      to: "/customers",
    });
  }

  const noExperiment = data.opportunities.filter((o) => !o.validationExperiment.trim()).length;
  if (noExperiment > 0) {
    out.push({
      tone: "info",
      text: `${noExperiment} opportunit${noExperiment === 1 ? "y has" : "ies have"} no validation experiment defined.`,
      to: "/opportunities",
    });
  }

  const unlinkedBacklog = data.opportunities.filter((o) => o.status === "backlog" && !o.linkedProblemId).length;
  if (unlinkedBacklog > 0) {
    out.push({
      tone: "info",
      text: `${unlinkedBacklog} backlog opportunit${unlinkedBacklog === 1 ? "y is" : "ies are"} not linked to a customer problem.`,
      to: "/opportunities",
    });
  }

  const incompleteRoadmap = data.roadmap.filter(
    (r) => !(r.linkedProblemId || r.linkedOpportunityId) || !r.objective.trim() || !r.successMetric.trim(),
  ).length;
  if (incompleteRoadmap > 0) {
    out.push({
      tone: "bad",
      text: `${incompleteRoadmap} roadmap item(s) lack a problem link, objective or success metric.`,
      to: "/roadmaps",
    });
  }

  const staleKnowledge = data.knowledge.filter((k) => daysBetween(k.createdAt, now) > 180).length;
  if (staleKnowledge > 0) {
    out.push({
      tone: "warn",
      text: `${staleKnowledge} knowledge item(s) are older than 180 days and may be stale.`,
      to: "/company",
    });
  }

  const overdueDecisions = data.decisions.filter(
    (d) => !d.outcome?.trim() && daysBetween(d.createdAt, now) >= 30,
  ).length;
  if (overdueDecisions > 0) {
    out.push({
      tone: "info",
      text: `${overdueDecisions} decision(s) are at least 30 days old with no recorded outcome.`,
      to: "/strategy",
    });
  }

  const reviewPrds = data.prds.filter((x) => x.status === "in_review").length;
  if (reviewPrds > 0) {
    out.push({ tone: "info", text: `${reviewPrds} PRD(s) are waiting for approval.`, to: "/prds" });
  }

  return out;
}

export function Overview() {
  const { data } = useStore();
  const health = healthScore(data);
  const recs = buildRecommendations(data);

  const topOpps = data.opportunities
    .map((o) => ({ o, p: priorityFor(o, "RICE") }))
    .filter((x) => x.p.final !== null)
    .sort((a, b) => (b.p.final ?? 0) - (a.p.final ?? 0))
    .slice(0, 5);

  const bucketCounts = { now: 0, next: 0, later: 0 };
  data.roadmap.forEach((r) => {
    bucketCounts[r.bucket] += 1;
  });

  const isEmpty =
    data.problems.length + data.opportunities.length + data.roadmap.length + data.prds.length + data.decisions.length === 0;

  return (
    <>
      <PageHeader
        title="Overview"
        description={data.profile.name ? `Product command centre for ${data.profile.name}.` : "Product command centre."}
        actions={
          <>
            <Link className="btn btn-secondary" to="/assistant">Ask the AI PM</Link>
            <Link className="btn btn-primary" to="/opportunities">Add opportunity</Link>
          </>
        }
      />

      <div className="stats">
        <Stat label="Customer problems" value={data.problems.length} hint={`${data.problems.filter((p) => p.reviewed).length} reviewed`} />
        <Stat label="Opportunities" value={data.opportunities.length} hint={`${data.opportunities.filter((o) => o.status === "validated").length} validated`} />
        <Stat label="Roadmap items" value={data.roadmap.length} hint={`${bucketCounts.now} now · ${bucketCounts.next} next · ${bucketCounts.later} later`} />
        <Stat label="PRDs" value={data.prds.length} hint={`${data.prds.filter((p) => p.status === "approved").length} approved`} />
        <Stat label="Decisions logged" value={data.decisions.length} />
      </div>

      {isEmpty && (
        <Card title="Start here">
          <EmptyState title="No product data yet.">
            Begin with Company Intelligence to set your mission and objectives, then add customer feedback in Customer Insights.
          </EmptyState>
        </Card>
      )}

      <div className="grid grid-2">
        <Card
          title="Product health"
          subtitle="A simple average of the components that have data. Components without data are excluded, not counted as zero."
        >
          <div className="row" style={{ alignItems: "flex-end", gap: "1rem" }}>
            <div className="health-score">{health.score ?? "—"}</div>
            <span className="muted small">{health.score === null ? "No measurable data yet" : "out of 100"}</span>
          </div>
          <div className="stack" style={{ marginTop: "1rem" }}>
            {health.components.map((c) => (
              <div key={c.key}>
                <div className="row spread">
                  <strong className="small">{c.label}</strong>
                  <span className="small muted">
                    {c.value === null ? "no data" : `${c.value}% (${c.numerator}/${c.denominator})`}
                  </span>
                </div>
                {c.value !== null && (
                  <div className="meter" aria-hidden="true">
                    <span style={{ width: `${c.value}%` }} />
                  </div>
                )}
                <div className="small muted">{c.formula}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Recommendations" subtitle="Rule-based checks on your product system. Not AI judgement.">
          {recs.length === 0 ? (
            <EmptyState title="No gaps detected by the current checks." />
          ) : (
            <div className="stack">
              {recs.map((r) => (
                <div key={r.text} className="item row spread">
                  <span className="small">{r.text}</span>
                  <div className="row">
                    <Badge tone={r.tone}>{r.tone === "bad" ? "fix" : "review"}</Badge>
                    <Link to={r.to} className="btn btn-ghost btn-sm">Open</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Top opportunities by RICE" subtitle="Computed scores. A strategic override, if set, is shown in Opportunities.">
        {topOpps.length === 0 ? (
          <EmptyState title="No scored opportunities yet.">
            RICE needs reach, impact, confidence and effort. Add them in Opportunities.
          </EmptyState>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Opportunity</th>
                <th>Status</th>
                <th>RICE</th>
              </tr>
            </thead>
            <tbody>
              {topOpps.map(({ o, p }) => (
                <tr key={o.id}>
                  <td>{o.title}</td>
                  <td><Badge>{o.status}</Badge></td>
                  <td>{p.final}{p.overridden && <Badge tone="warn">override</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
