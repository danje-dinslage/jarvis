// lib/constitution.ts
// Shared types and utilities for constitutional analysis. Added v1.10.
// Kept separate from route files so Next.js doesn't treat exports as route handlers.

export type ConstitutionAnalysis = {
  missionAlignment: "high" | "medium" | "low";
  scopeDrift: "none" | "possible" | "high";
  evidenceLevel: "verified" | "user_reported" | "inferred" | "assumption" | "unknown";
  governanceProfile: {
    projectType: string;
    riskLevel: "low" | "medium" | "high";
    tighten: string[];
    loosen: string[];
  };
  notices: {
    missionConflict: boolean;
    scopeWarning: boolean;
    evidenceWarning: boolean;
  };
  attentionScore: number;
  reasoning: string;
};

// attentionScoreFromAnalysis — weighted blend of constitutional signals → 0–100
// Weights: missionAlignment 35%, scopeDrift 30%, evidenceLevel 20%, riskLevel 15%
export function attentionScoreFromAnalysis(a: Omit<ConstitutionAnalysis, "attentionScore">): number {
  const mission = a.missionAlignment === "low" ? 100 : a.missionAlignment === "medium" ? 50 : 10;
  const scope = a.scopeDrift === "high" ? 100 : a.scopeDrift === "possible" ? 50 : 0;
  const evidence = a.evidenceLevel === "assumption" ? 80
    : a.evidenceLevel === "unknown" ? 70
    : a.evidenceLevel === "inferred" ? 50
    : a.evidenceLevel === "user_reported" ? 30
    : 5;
  const risk = a.governanceProfile.riskLevel === "high" ? 80
    : a.governanceProfile.riskLevel === "medium" ? 40
    : 10;
  return Math.round(mission * 0.35 + scope * 0.30 + evidence * 0.20 + risk * 0.15);
}
