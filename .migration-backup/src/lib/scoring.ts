import type { IntakeAnswers, QualificationTags } from "./types";

// Qualification score, 0–100. Weights per the handoff spec:
//   ICP fit ≤40 · Coachability ≤25 · Authority ≤20 · Urgency ≤15
// Threshold 70 = qualified. Soft disqualify: low scores still book, flagged low-fit.

export const QUALIFIED_THRESHOLD = 70;

const likertPoints: Record<string, number> = { "1": 0, "2": 2, "3": 4, "4": 6, "5": 8 };

export function computeScore(a: IntakeAnswers): number {
  let s = 0;

  // ICP fit — max 40
  if (["$1M–$3M", "$3M–$10M", "$10M+"].includes(a.revenue ?? "")) s += 15;
  else if (a.revenue === "$500K–$1M") s += 8;
  if (["11–25", "26–50", "50+"].includes(a.employees ?? "")) s += 10;
  else if (a.employees === "4–10") s += 6;
  if (
    ["Trades / home services", "Construction", "Professional services", "Manufacturing"].includes(
      a.industry ?? ""
    )
  )
    s += 8;
  if (["3–10 years", "10+ years"].includes(a.years ?? "")) s += 7;

  // Authority — max 20
  if (a.role === "Owner / Founder") s += 20;
  else if (a.role === "CEO / President") s += 16;
  else if (a.ownerJoin === "Yes") s += 10;
  else s += 2;

  // Coachability — max 25
  s += likertPoints[a.coachAdmit ?? ""] ?? 0;
  s += likertPoints[a.coachOpen ?? ""] ?? 0;
  if ((a.tried ?? "").length > 20) s += 4;
  if ((a.leastControl ?? []).length >= 2) s += 3;
  if (a.coachHistory === "Yes, currently" || a.coachHistory === "Have in the past") s += 2;

  // Urgency — max 15
  if (a.urgency === "Now — this quarter") s += 15;
  else if (a.urgency === "In the next 6 months") s += 9;
  else if (a.urgency === "Just exploring") s += 3;

  return Math.min(100, s);
}

export function qualificationTags(score: number): QualificationTags {
  return {
    coachable: score >= 70,
    icpFit: score >= 75,
    hot: score >= 85,
    lowFit: score < 70,
  };
}

export function tagList(score: number): string[] {
  const t = qualificationTags(score);
  const tags = [t.coachable && "Coachable", t.icpFit && "ICP-fit", t.hot && "Hot"].filter(
    Boolean
  ) as string[];
  return tags.length ? tags : ["Low-fit"];
}

export function isQualified(score: number): boolean {
  return score >= QUALIFIED_THRESHOLD;
}
