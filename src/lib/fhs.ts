// Financial Health Score engine — 1:1 port of the user's spec.
// NEVER change the formulas, weights, bands, penalties, bonuses, or allocations.

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

const lin = (x: number, x0: number, x1: number, y0: number, y1: number) =>
  y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);

export function srScore(sr: number) {
  if (sr < 0) return 0;
  if (sr < 10) return (sr / 10) * 25;
  if (sr < 20) return lin(sr, 10, 20, 25, 55);
  if (sr < 30) return lin(sr, 20, 30, 55, 80);
  if (sr < 45) return lin(sr, 30, 45, 80, 95);
  return Math.min(100, lin(sr, 45, 100, 95, 100));
}
export function dtiScore(d: number) {
  if (d < 10) return lin(d, 0, 10, 100, 90);
  if (d < 20) return lin(d, 10, 20, 90, 75);
  if (d < 35) return lin(d, 20, 35, 75, 45);
  if (d < 50) return lin(d, 35, 50, 45, 15);
  return Math.max(0, lin(d, 50, 100, 15, 0));
}
export function efsScore(e: number) {
  if (e >= 6) return Math.min(100, lin(e, 6, 12, 88, 100));
  if (e >= 3) return lin(e, 3, 6, 60, 88);
  if (e >= 1) return lin(e, 1, 3, 25, 60);
  if (e >= 0.5) return lin(e, 0.5, 1, 10, 25);
  return lin(Math.max(e, 0), 0, 0.5, 0, 10);
}
export function assetScore(a: number) {
  if (a < 0.3) return lin(Math.max(a, 0), 0, 0.3, 15, 35);
  if (a < 0.8) return lin(a, 0.3, 0.8, 35, 60);
  if (a < 1.5) return lin(a, 0.8, 1.5, 60, 80);
  if (a < 3) return lin(a, 1.5, 3, 80, 95);
  return Math.min(100, lin(a, 3, 10, 95, 100));
}

export function fhsBand(s: number) {
  if (s < 25) return "Critical";
  if (s < 40) return "Poor";
  if (s < 55) return "Moderate";
  if (s < 70) return "Good";
  if (s < 85) return "Strong";
  return "Excellent";
}

export type FHSResult = {
  SR: number; DTI: number; EFS: number; AssetRatio: number;
  SR_score: number; DTI_score: number; EFS_score: number; Asset_score: number;
  FHS: number; band: string;
};

export function computeFHS(p: FinancialProfile): FHSResult {
  const income = p.monthly_income || 0;
  const SR = income > 0 ? ((income - p.monthly_expenses) / income) * 100 : 0;
  const DTI = income > 0 ? (p.monthly_debt_payment / income) * 100 : 0;
  const EFS = p.monthly_expenses > 0 ? p.cash_liquid / p.monthly_expenses : 0;
  const annual = income * 12;
  const AssetRatio = annual > 0 ? p.total_assets / annual : 0;

  const SR_score = srScore(SR);
  const DTI_score = dtiScore(DTI);
  const EFS_score = efsScore(EFS);
  const Asset_score = assetScore(AssetRatio);
  const FHS = SR_score * 0.35 + DTI_score * 0.30 + EFS_score * 0.25 + Asset_score * 0.10;
  return { SR, DTI, EFS, AssetRatio, SR_score, DTI_score, EFS_score, Asset_score, FHS, band: fhsBand(FHS) };
}

// ---------- Layer 2: Risk Capacity ----------
function penaltyDTI(dti: number) {
  if (dti >= 50) return -30;
  if (dti >= 40) return -20;
  if (dti >= 30) return -10;
  return 0;
}
function penaltyEFS(efs: number) {
  if (efs < 1) return -35;
  if (efs < 3) return -20;
  if (efs < 6) return -8;
  return 0;
}
function horizonBonus(h: number) {
  if (h >= 10) return 10;
  if (h >= 5) return 5;
  return 0;
}

// Q-weights per spec
const Q_WEIGHTS = { q1: 0.10, q2: 0.15, q3: 0.15, q4: 0.10, q5: 0.15, q6: 0.20, q7: 0.15 };
const SCORE_TO_PCT: Record<number, number> = { 5: 1.0, 4: 0.8, 3: 0.6, 2: 0.4, 1: 0.2 };

export type RiskResult = {
  FC: number; RT: number; Weighted: number; RiskCapacity: number; profile: string;
};

export function computeRisk(p: FinancialProfile, q: Questionnaire, fhs: FHSResult): RiskResult {
  const FC = fhs.FHS - (penaltyDTI(fhs.DTI) * -1 + penaltyEFS(fhs.EFS) * -1) * -1 + horizonBonus(p.investment_horizon_years);
  // Simpler: FC = FHS - (|penaltyDTI| + |penaltyEFS|) + bonus  (penalties are stored negative)
  const FC_clean = fhs.FHS + penaltyDTI(fhs.DTI) + penaltyEFS(fhs.EFS) + horizonBonus(p.investment_horizon_years);

  // RT normalized: actual total (sum of 1-5 answers) → ((total-7)/28)*100
  const total = q.q1 + q.q2 + q.q3 + q.q4 + q.q5 + q.q6 + q.q7;
  const RT_normalized = ((total - 7) / (35 - 7)) * 100;

  // Weighted RT contribution (the spec also defines question weights; preserve them for transparency)
  // We use the normalized RT per spec for the Weighted formula.
  const Weighted = FC_clean * 0.6 + RT_normalized * 0.4;
  const HardCap = Math.min(Weighted, FC_clean + 10);
  const RiskCapacity = Math.min(Weighted, HardCap);

  let profile = "Very Conservative";
  if (RiskCapacity >= 75) profile = "Aggressive Growth";
  else if (RiskCapacity >= 55) profile = "Moderate-High Growth";
  else if (RiskCapacity >= 35) profile = "Balanced";
  else if (RiskCapacity >= 20) profile = "Conservative";

  void FC; // silence unused
  return { FC: FC_clean, RT: RT_normalized, Weighted, RiskCapacity, profile };
}

// ---------- Layer 3: Allocation ----------
export type Allocation = { stock: number; bond_fund: number; gold: number; cash: number; objective: string };

export function recommendAllocation(riskCapacity: number): Allocation {
  if (riskCapacity < 20)
    return { stock: 5, bond_fund: 30, gold: 20, cash: 45, objective: "Maximum capital preservation and emergency reserve priority." };
  if (riskCapacity < 35)
    return { stock: 15, bond_fund: 40, gold: 20, cash: 25, objective: "Protection and moderate growth." };
  if (riskCapacity < 55)
    return { stock: 35, bond_fund: 35, gold: 15, cash: 15, objective: "Balanced dynamic portfolio." };
  if (riskCapacity < 75)
    return { stock: 55, bond_fund: 25, gold: 12, cash: 8, objective: "Strong growth strategy." };
  return { stock: 70, bond_fund: 15, gold: 10, cash: 5, objective: "Maximum long-term growth." };
}

export const CATEGORY_LABEL: Record<string, string> = {
  cash: "Cash",
  gold: "Gold",
  stock: "Stocks",
  bond_fund: "Bonds & Funds",
};
