import { describe, expect, it } from "vitest";
import { healthScore, iceScore, priorityFor, riceScore } from "./scoring";
import type { AppData, Opportunity } from "./types";

const baseOpp: Opportunity = {
  id: "o1",
  title: "t",
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
  reach: 1000,
  impact: 2,
  confidence: 50,
  effort: 4,
  ease: 6,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const emptyData: AppData = {
  schemaVersion: 1,
  profile: {
    name: "",
    mission: "",
    vision: "",
    businessModel: "",
    pricing: "",
    targetCustomers: "",
    competitors: "",
    techConstraints: "",
    team: "",
    strategicObjectives: [],
  },
  knowledge: [],
  problems: [],
  opportunities: [],
  roadmap: [],
  prds: [],
  decisions: [],
};

describe("RICE and ICE", () => {
  it("computes RICE as reach × impact × confidence ÷ effort", () => {
    // 1000 × 2 × 0.5 ÷ 4 = 250
    expect(riceScore(baseOpp)).toBe(250);
  });

  it("returns null for RICE when effort is zero so the score is not invented", () => {
    expect(riceScore({ ...baseOpp, effort: 0 })).toBeNull();
  });

  it("computes ICE as impact × (confidence ÷ 10) × ease", () => {
    // 2 × 5 × 6 = 60
    expect(iceScore(baseOpp)).toBe(60);
  });

  it("lets a strategic override replace the computed score and flags it", () => {
    const result = priorityFor({ ...baseOpp, override: { score: 999, rationale: "Board commitment" } }, "RICE");
    expect(result).toEqual({ computed: 250, final: 999, overridden: true });
  });
});

describe("healthScore", () => {
  it("returns null overall when there is no data, rather than a misleading zero", () => {
    const result = healthScore(emptyData, new Date("2026-06-01"));
    expect(result.score).toBeNull();
    expect(result.components.every((c) => c.value === null)).toBe(true);
  });

  it("averages only the components that have data", () => {
    const data: AppData = {
      ...emptyData,
      opportunities: [
        { ...baseOpp, id: "a", evidence: "interviews", validationExperiment: "fake door" },
        { ...baseOpp, id: "b", evidence: "", validationExperiment: "" },
      ],
    };
    const result = healthScore(data, new Date("2026-06-01"));
    const evidence = result.components.find((c) => c.key === "evidence");
    expect(evidence?.value).toBe(50);
    expect(result.score).toBe(50);
  });

  it("excludes decisions younger than 30 days from traceability", () => {
    const data: AppData = {
      ...emptyData,
      decisions: [
        {
          id: "d1",
          date: "2026-06-01",
          title: "x",
          decision: "x",
          context: "",
          alternatives: "",
          tradeoffs: "",
          expectedImpact: "",
          confidence: "medium",
          owner: "",
          createdAt: "2026-05-25T00:00:00.000Z",
        },
      ],
    };
    const trace = healthScore(data, new Date("2026-06-01")).components.find((c) => c.key === "traceability");
    expect(trace?.denominator).toBe(0);
    expect(trace?.value).toBeNull();
  });
});
