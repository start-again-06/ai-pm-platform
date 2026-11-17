import { describe, expect, it } from "vitest";
import { parseExtractedProblems } from "./prompts";

const feedback = `Customer A: "Exporting reports takes forever and I lose my filters every time."
Customer B: We love the dashboard, but onboarding was confusing.`;

describe("parseExtractedProblems (anti-fabrication guard)", () => {
  it("keeps quotes that appear verbatim in the source text", () => {
    const raw = JSON.stringify({
      problems: [
        {
          segment: "Analysts",
          statement: "Report export is too slow",
          evidence: ["Exporting reports takes forever"],
          frequency: 4,
          severity: 4,
          businessImpact: "Churn risk",
          confidence: "medium",
          nextAction: "Interview three analysts",
        },
      ],
    });
    const [p] = parseExtractedProblems(raw, feedback);
    expect(p.evidence).toEqual(["Exporting reports takes forever"]);
    expect(p.rejectedQuotes).toBe(0);
    expect(p.confidence).toBe("medium");
  });

  it("drops quotes the model invented and downgrades confidence when none remain", () => {
    const raw = JSON.stringify({
      problems: [
        {
          segment: "Admins",
          statement: "SSO is missing",
          evidence: ["We really need SSO for our enterprise plan"],
          frequency: 5,
          severity: 5,
          businessImpact: "Lost deals",
          confidence: "high",
          nextAction: "Validate",
        },
      ],
    });
    const [p] = parseExtractedProblems(raw, feedback);
    expect(p.evidence).toEqual([]);
    expect(p.rejectedQuotes).toBe(1);
    expect(p.confidence).toBe("low");
  });

  it("matches quotes tolerant of case and whitespace differences", () => {
    const raw = JSON.stringify({
      problems: [{ segment: "x", statement: "y", evidence: ["  onboarding   WAS confusing. "], frequency: 2, severity: 2, confidence: "high" }],
    });
    const [p] = parseExtractedProblems(raw, feedback);
    expect(p.evidence).toHaveLength(1);
  });

  it("clamps out-of-range scores to the 1–5 scale", () => {
    const raw = JSON.stringify({ problems: [{ statement: "z", evidence: [], frequency: 99, severity: -3 }] });
    const [p] = parseExtractedProblems(raw, feedback);
    expect(p.frequency).toBe(5);
    expect(p.severity).toBe(1);
  });

  it("extracts JSON even when the model wraps it in prose", () => {
    const raw = 'Here you go:\n{"problems":[]}\nThanks.';
    expect(parseExtractedProblems(raw, feedback)).toEqual([]);
  });

  it("throws a clear error when there is no JSON", () => {
    expect(() => parseExtractedProblems("sorry, I cannot help", feedback)).toThrow(/did not contain JSON/);
  });
});
