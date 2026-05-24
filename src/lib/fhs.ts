// ============================================================
// FHS Engine v2.0 — Financial Health Score + Risk Capacity + Allocation
// Fixes:
//   [FIX 1] Q_WEIGHTS now ACTUALLY used in computeRisk()
//   [FIX 2] RT uses weighted dot-product, not equal-weight sum
//   [FIX 3] RiskResult exposes per-question breakdown for UI
//   [FIX 4] FHSResult exposes pillar interpretations for UI
//   [FIX 5] Allocation exposes per-asset advice strings
//   [FIX 6] computeRebalanceGaps() exposes drift/action/urgency/VND
// All formulas are deterministic (rule-based scoring), NOT ML predictions.
// ============================================================

// ─── INPUT TYPES ────────────────────────────────────────────
export type FinancialProfile = {
  monthly_income: number;
  monthly_expenses: number;
  monthly_debt_payment: number;
  total_assets: number;
  emergency_fund: number;
  cash_liquid: number;
  investment_horizon_years: number;
};

export type Questionnaire = {
  q1: number; q2: number; q3: number; q4: number; q5: number; q6: number; q7: number;
};

// ─── OUTPUT TYPES ───────────────────────────────────────────
export type PillarStatus = "excellent" | "good" | "moderate" | "poor" | "critical";

export type PillarInterpretation = {
  label: string;
  value: string;
  score: number;
  status: PillarStatus;
  advice: string;
};

export type FHSResult = {
  SR: number; DTI: number; EFS: number; AssetRatio: number;
  SR_score: number; DTI_score: number; EFS_score: number; Asset_score: number;
  FHS: number;
  band: string;
  pillars: PillarInterpretation[];
};

export type QuestionBreakdown = {
  id: keyof Questionnaire;
  label: string;
  section: string;
  weight: number;
  rawScore: number;
  weightedScore: number;
};

export type RiskResult = {
  FC: number;
  RT: number;
  Weighted: number;
  RiskCapacity: number;
  profile: string;
  penalties: { dti: number; efs: number; horizon: number };
  questionBreakdown: QuestionBreakdown[];
};

export type AssetKey = "stock" | "bond_fund" | "gold" | "cash";

export type AllocationBand = {
  stock: number;
  bond_fund: number;
  gold: number;
  cash: number;
  objective: string;
  advice: Record<AssetKey, string>;
};

// ─── CONSTANTS ──────────────────────────────────────────────
export const CATEGORY_LABEL: Record<string, string> = {
  cash: "Cash",
  gold: "Gold",
  stock: "Stocks",
  bond_fund: "Bonds & Funds",
};

export const Q_WEIGHTS: Record<keyof Questionnaire, number> = {
  q1: 0.10, q2: 0.15, q3: 0.15, q4: 0.10, q5: 0.15, q6: 0.20, q7: 0.15,
};

export const SCORE_TO_PCT: Record<number, number> = {
  5: 100, 4: 80, 3: 60, 2: 40, 1: 20,
};

export const QUESTION_META: Array<{ id: keyof Questionnaire; label: string; section: string }> = [
  { id: "q1", label: "Current age",                       section: "Time horizon" },
  { id: "q2", label: "Expected drawdown timing",          section: "Time horizon" },
  { id: "q3", label: "Investment goal",                   section: "Goals" },
  { id: "q4", label: "Normal-market expectation",         section: "Goals" },
  { id: "q5", label: "Bear-market expectation",           section: "Goals" },
  { id: "q6", label: "3-year loss tolerance",             section: "Short-term" },
  { id: "q7", label: "Short-term loss tolerance",         section: "Short-term" },
];

// ─── HELPERS ────────────────────────────────────────────────
const lin = (x: number, x0: number, x1: number, y0: number, y1: number): number =>
  y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);

function pillarStatus(score: number): PillarStatus {
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  if (score >= 40) return "moderate";
  if (score >= 20) return "poor";
  return "critical";
}

// ─── LAYER 1: FHS PILLAR SCORES ─────────────────────────────
export function srScore(sr: number): number {
  if (sr < 0)  return 0;
  if (sr < 10) return (sr / 10) * 25;
  if (sr < 20) return lin(sr, 10, 20, 25, 55);
  if (sr < 30) return lin(sr, 20, 30, 55, 80);
  if (sr < 45) return lin(sr, 30, 45, 80, 95);
  return Math.min(100, lin(sr, 45, 100, 95, 100));
}
export function dtiScore(d: number): number {
  if (d < 10) return lin(d, 0, 10, 100, 90);
  if (d < 20) return lin(d, 10, 20, 90, 75);
  if (d < 35) return lin(d, 20, 35, 75, 45);
  if (d < 50) return lin(d, 35, 50, 45, 15);
  return Math.max(0, lin(d, 50, 100, 15, 0));
}
export function efsScore(e: number): number {
  if (e >= 6)   return Math.min(100, lin(e, 6, 12, 88, 100));
  if (e >= 3)   return lin(e, 3, 6, 60, 88);
  if (e >= 1)   return lin(e, 1, 3, 25, 60);
  if (e >= 0.5) return lin(e, 0.5, 1, 10, 25);
  return lin(Math.max(e, 0), 0, 0.5, 0, 10);
}
export function assetScore(a: number): number {
  if (a < 0.3) return lin(Math.max(a, 0), 0, 0.3, 15, 35);
  if (a < 0.8) return lin(a, 0.3, 0.8, 35, 60);
  if (a < 1.5) return lin(a, 0.8, 1.5, 60, 80);
  if (a < 3)   return lin(a, 1.5, 3, 80, 95);
  return Math.min(100, lin(a, 3, 10, 95, 100));
}

export function fhsBand(s: number): string {
  if (s < 25) return "Critical";
  if (s < 40) return "Poor";
  if (s < 55) return "Moderate";
  if (s < 70) return "Good";
  if (s < 85) return "Strong";
  return "Excellent";
}

function buildPillars(
  SR: number, DTI: number, EFS: number, AssetRatio: number,
  SR_score: number, DTI_score: number, EFS_score: number, Asset_score: number,
): PillarInterpretation[] {
  return [
    {
      label: "Saving Rate",
      value: `${SR.toFixed(1)}%`,
      score: SR_score,
      status: pillarStatus(SR_score),
      advice:
        SR < 0    ? "Income does not cover expenses — cut discretionary spending immediately." :
        SR < 10   ? "Saving below 10% — target at least 15% of monthly income." :
        SR < 20   ? "Decent saving rate. Aim for 20–30% to accelerate wealth building." :
        SR < 30   ? "Strong saving. Consider investing the surplus instead of leaving it in cash." :
                    "Excellent saving rate. Focus on portfolio optimisation for higher yield.",
    },
    {
      label: "Debt-to-Income (DTI)",
      value: `${DTI.toFixed(1)}%`,
      score: DTI_score,
      status: pillarStatus(DTI_score),
      advice:
        DTI >= 50 ? "Dangerous DTI — pay down high-interest debt first; avoid new loans." :
        DTI >= 35 ? "High DTI — prioritise debt repayment before increasing investments." :
        DTI >= 20 ? "Moderate DTI. Avoid taking on new debt." :
        DTI >= 10 ? "Healthy DTI. You have room to invest or pre-pay debt." :
                    "Very low DTI — financially robust foundation.",
    },
    {
      label: "Emergency Fund",
      value: `${EFS.toFixed(1)} months`,
      score: EFS_score,
      status: pillarStatus(EFS_score),
      advice:
        EFS < 1   ? "No emergency cushion — extreme risk. Build 1 month of expenses immediately." :
        EFS < 3   ? "Insufficient emergency fund. Target at least 3 months of expenses." :
        EFS < 6   ? "Building a solid buffer. Continue up to 6 months." :
        EFS < 12  ? "Strong emergency cushion — start investing the surplus." :
                    "Excess liquidity — consider moving surplus into yield-bearing assets.",
    },
    {
      label: "Asset / Income Ratio",
      value: `${AssetRatio.toFixed(2)}×`,
      score: Asset_score,
      status: pillarStatus(Asset_score),
      advice:
        AssetRatio < 0.3 ? "Very low assets vs income. Start building accumulated wealth." :
        AssetRatio < 0.8 ? "Assets are forming. Maintain consistent investing." :
        AssetRatio < 1.5 ? "Stable assets. Diversify to reduce concentration risk." :
        AssetRatio < 3   ? "Healthy assets. Optimise portfolio to risk profile." :
                           "Abundant assets. Focus on preservation and tax efficiency.",
    },
  ];
}

export function computeFHS(p: FinancialProfile): FHSResult {
  const income = p.monthly_income || 0;
  const SR       = income > 0 ? ((income - p.monthly_expenses) / income) * 100 : 0;
  const DTI      = income > 0 ? (p.monthly_debt_payment / income) * 100 : 0;
  const EFS      = p.monthly_expenses > 0 ? p.emergency_fund / p.monthly_expenses : 0;
  const annual   = income * 12;
  const AssetRatio = annual > 0 ? p.total_assets / annual : 0;

  const SR_score    = srScore(SR);
  const DTI_score   = dtiScore(DTI);
  const EFS_score   = efsScore(EFS);
  const Asset_score = assetScore(AssetRatio);

  const FHS = SR_score * 0.35 + DTI_score * 0.30 + EFS_score * 0.25 + Asset_score * 0.10;

  return {
    SR, DTI, EFS, AssetRatio,
    SR_score, DTI_score, EFS_score, Asset_score,
    FHS,
    band: fhsBand(FHS),
    pillars: buildPillars(SR, DTI, EFS, AssetRatio, SR_score, DTI_score, EFS_score, Asset_score),
  };
}

// ─── LAYER 2: RISK CAPACITY ─────────────────────────────────
function penaltyDTI(dti: number): number {
  if (dti >= 50) return -30;
  if (dti >= 40) return -20;
  if (dti >= 30) return -10;
  return 0;
}
function penaltyEFS(efs: number): number {
  if (efs < 1) return -35;
  if (efs < 3) return -20;
  if (efs < 6) return -8;
  return 0;
}
function horizonBonus(h: number): number {
  if (h >= 10) return 10;
  if (h >= 5)  return 5;
  return 0;
}

function buildQuestionBreakdown(q: Questionnaire): QuestionBreakdown[] {
  return QUESTION_META.map((meta) => {
    const rawScore = q[meta.id];
    const weight = Q_WEIGHTS[meta.id];
    const weightedScore = weight * SCORE_TO_PCT[rawScore];
    return { id: meta.id, label: meta.label, section: meta.section, weight, rawScore, weightedScore };
  });
}

function riskProfile(rc: number): string {
  if (rc >= 75) return "Aggressive Growth";
  if (rc >= 55) return "Moderate-High Growth";
  if (rc >= 35) return "Balanced";
  if (rc >= 20) return "Conservative";
  return "Very Conservative";
}

/**
 * Pure helper — compute weighted RT live (used by questionnaire preview)
 * RT = Σ Q_WEIGHTS[qi] × SCORE_TO_PCT[qi]   ∈ [20, 100]
 */
export function computeRT(q: Questionnaire): number {
  return (Object.keys(Q_WEIGHTS) as Array<keyof Questionnaire>).reduce(
    (sum, k) => sum + Q_WEIGHTS[k] * SCORE_TO_PCT[q[k]],
    0,
  );
}

export function computeRisk(p: FinancialProfile, q: Questionnaire, fhs: FHSResult): RiskResult {
  const dtiPen = penaltyDTI(fhs.DTI);
  const efsPen = penaltyEFS(fhs.EFS);
  const horBon = horizonBonus(p.investment_horizon_years);

  const FC = fhs.FHS + dtiPen + efsPen + horBon;

  // [FIX 1 & 2] Weighted RT using Q_WEIGHTS (was equal-weight ((sum-7)/28)*100)
  const RT = computeRT(q);

  const Weighted = FC * 0.6 + RT * 0.4;
  const HardCap = FC + 10;
  const RiskCapacity = Math.min(Weighted, HardCap);

  return {
    FC, RT, Weighted, RiskCapacity,
    profile: riskProfile(RiskCapacity),
    penalties: { dti: dtiPen, efs: efsPen, horizon: horBon },
    questionBreakdown: buildQuestionBreakdown(q),
  };
}

// ─── LAYER 3: ALLOCATION ────────────────────────────────────
const ADVICE_TEXT: Record<AssetKey, (pct: number, profile: string) => string> = {
  stock: (pct, profile) =>
    pct === 0   ? "Avoid equities at this stage." :
    pct <= 15   ? `${pct}% equities suits a ${profile} profile. Favour VN30 blue-chips.` :
    pct <= 35   ? `${pct}% equities — balanced between growth and safety. Diversify across sectors.` :
    pct <= 55   ? `${pct}% equities — growth strategy. Mix VN30 with selected mid-caps.` :
                  `${pct}% equities — aggressive growth. Maintain diversification and risk controls.`,
  bond_fund: (pct) =>
    pct >= 40 ? `${pct}% bonds/funds — stable foundation. Favour government bonds and funds like TCBF, VCBF.` :
    pct >= 25 ? `${pct}% bonds/funds — reduces portfolio volatility. Add reputable corporate bonds.` :
    pct >= 15 ? `${pct}% bonds/funds — stabilising base. Consider bond ETFs.` :
                `${pct}% bonds/funds — low allocation suitable for long-horizon investing.`,
  gold: (pct) =>
    pct >= 20 ? `${pct}% gold — strong store of value. Favour SJC gold or gold ETFs.` :
    pct >= 12 ? `${pct}% gold — inflation hedge appropriate for the VN market.` :
    pct >= 10 ? `${pct}% gold — minimum prudent allocation for Vietnamese investors.` :
                `${pct}% gold — minimal hedge.`,
  cash: (pct) =>
    pct >= 45 ? `${pct}% cash — absolute safety priority. Use short-term high-yield deposits.` :
    pct >= 25 ? `${pct}% cash — maintain high liquidity. 1–3 month term deposits.` :
    pct >= 15 ? `${pct}% cash — adequate liquidity. Invest the rest.` :
                `${pct}% cash — bare minimum for day-to-day liquidity.`,
};

export function recommendAllocation(riskCapacity: number): AllocationBand {
  let pcts: Pick<AllocationBand, AssetKey>;
  let objective: string;
  let profile: string;

  if (riskCapacity < 20) {
    pcts = { stock: 5, bond_fund: 30, gold: 20, cash: 45 };
    objective = "Maximum capital preservation. Prioritise emergency reserves and safe assets.";
    profile = "Very Conservative";
  } else if (riskCapacity < 35) {
    pcts = { stock: 15, bond_fund: 40, gold: 20, cash: 25 };
    objective = "Capital protection with modest growth. Minimise volatility.";
    profile = "Conservative";
  } else if (riskCapacity < 55) {
    pcts = { stock: 35, bond_fund: 35, gold: 15, cash: 15 };
    objective = "Balanced dynamic portfolio. Combines growth and stability.";
    profile = "Balanced";
  } else if (riskCapacity < 75) {
    pcts = { stock: 55, bond_fund: 25, gold: 12, cash: 8 };
    objective = "Strong growth. Accept short-term volatility for long-term returns.";
    profile = "Growth";
  } else {
    pcts = { stock: 70, bond_fund: 15, gold: 10, cash: 5 };
    objective = "Maximum long-term growth. Concentrated in risk-on, high-return assets.";
    profile = "Aggressive Growth";
  }

  return {
    ...pcts,
    objective,
    advice: {
      stock:     ADVICE_TEXT.stock(pcts.stock, profile),
      bond_fund: ADVICE_TEXT.bond_fund(pcts.bond_fund, profile),
      gold:      ADVICE_TEXT.gold(pcts.gold, profile),
      cash:      ADVICE_TEXT.cash(pcts.cash, profile),
    },
  };
}

// ─── REBALANCING GAP ANALYSIS ───────────────────────────────
export type RebalanceGap = {
  key: AssetKey;
  label: string;
  actual: number;
  target: number;
  drift: number;
  action: "Buy More" | "Reduce" | "Hold";
  urgency: "high" | "medium" | "low";
  amountVND: number;
};

export function computeRebalanceGaps(
  holdings: Record<AssetKey, number>,
  alloc: AllocationBand,
  totalPortfolio: number,
): RebalanceGap[] {
  const KEYS: AssetKey[] = ["stock", "bond_fund", "gold", "cash"];
  return KEYS.map((key) => {
    const actualVND = holdings[key] || 0;
    const actualPct = totalPortfolio > 0 ? (actualVND / totalPortfolio) * 100 : 0;
    const targetPct = alloc[key];
    const drift = actualPct - targetPct;
    const absDrift = Math.abs(drift);
    const action: RebalanceGap["action"] =
      drift < -1 ? "Buy More" : drift > 1 ? "Reduce" : "Hold";
    const urgency: RebalanceGap["urgency"] =
      absDrift > 10 ? "high" : absDrift > 5 ? "medium" : "low";
    const amountVND = Math.abs((drift / 100) * totalPortfolio);
    return { key, label: CATEGORY_LABEL[key], actual: actualPct, target: targetPct, drift, action, urgency, amountVND };
  });
}
