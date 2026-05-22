import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import {
  computeFHS, computeRisk, recommendAllocation, computeRebalanceGaps,
  CATEGORY_LABEL,
  type FinancialProfile, type Questionnaire,
  type PillarInterpretation, type QuestionBreakdown, type RebalanceGap,
} from "@/lib/fhs";

export const Route = createFileRoute("/dashboard")({ component: DashboardPage });

const fmtVND = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " ₫";
const fmtPct = (n: number, d = 1) => `${n.toFixed(d)}%`;

const ALLOC_COLORS: Record<string, string> = {
  stock: "var(--chart-1)", bond_fund: "var(--chart-2)", gold: "var(--chart-3)", cash: "var(--chart-4)",
};
const STATUS_COLORS: Record<string, string> = {
  excellent: "var(--success)",
  good: "var(--chart-1)",
  moderate: "var(--warning)",
  poor: "var(--danger)",
  critical: "oklch(0.45 0.25 15)",
};
const URGENCY_BG: Record<string, string> = {
  high: "color-mix(in oklab, var(--danger) 14%, transparent)",
  medium: "color-mix(in oklab, var(--warning) 14%, transparent)",
  low: "transparent",
};

function Ring({ value, label, sub }: { value: number; label: string; sub?: string }) {
  const pct = Math.max(0, Math.min(1, value / 100));
  const R = 56, C = 2 * Math.PI * R;
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-40 h-40">
        <svg viewBox="0 0 140 140" className="w-full h-full ring-meter">
          <circle cx="70" cy="70" r={R} stroke="oklch(0.3 0.025 250)" strokeWidth="10" fill="none" />
          <circle cx="70" cy="70" r={R} stroke="url(#g)" strokeWidth="10" fill="none" strokeLinecap="round"
            strokeDasharray={`${C * pct} ${C}`} />
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="oklch(0.88 0.08 85)" />
              <stop offset="100%" stopColor="oklch(0.72 0.14 85)" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-display text-4xl gold-text">{value.toFixed(0)}</div>
          {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
        </div>
      </div>
      <div className="text-sm mt-3 text-muted-foreground tracking-wide uppercase text-[11px]">{label}</div>
    </div>
  );
}

function PillarRow({ p }: { p: PillarInterpretation }) {
  const color = STATUS_COLORS[p.status];
  return (
    <div className="p-5 rounded-2xl border border-border bg-[oklch(0.16_0.02_250)]">
      <div className="flex items-center justify-between">
        <div className="font-display text-lg">{p.label}</div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{p.value}</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: `${color}20`, color }}>
            {p.score.toFixed(0)} · {p.status}
          </span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-[oklch(0.12_0.02_250)] overflow-hidden mt-3">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, p.score)}%`, background: color }} />
      </div>
      <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{p.advice}</p>
    </div>
  );
}

function QuestionRadar({ breakdown }: { breakdown: QuestionBreakdown[] }) {
  const cx = 120, cy = 120, r = 90;
  const n = breakdown.length;
  const step = (2 * Math.PI) / n;
  const axes = breakdown.map((_, i) => {
    const a = i * step - Math.PI / 2;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
  const points = breakdown.map((b, i) => {
    const ratio = b.weightedScore / (b.weight * 100);
    const a = i * step - Math.PI / 2;
    return { x: cx + r * ratio * Math.cos(a), y: cy + r * ratio * Math.sin(a) };
  });
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 240 240" className="w-64 h-64">
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <polygon key={t}
            points={axes.map((a) => `${cx + (a.x - cx) * t},${cy + (a.y - cy) * t}`).join(" ")}
            fill="none" stroke="oklch(0.3 0.02 250)" strokeWidth="0.5" />
        ))}
        {axes.map((a, i) => (
          <line key={i} x1={cx} y1={cy} x2={a.x} y2={a.y} stroke="oklch(0.3 0.02 250)" strokeWidth="0.5" />
        ))}
        <polygon points={points.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="oklch(0.82 0.13 85 / 0.25)" stroke="oklch(0.82 0.13 85)" strokeWidth="1.5" />
        {breakdown.map((_, i) => {
          const a = i * step - Math.PI / 2;
          const lx = cx + (r + 16) * Math.cos(a);
          const ly = cy + (r + 16) * Math.sin(a);
          return (
            <text key={i} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
              className="fill-muted-foreground" style={{ fontSize: 10 }}>
              Q{i + 1}
            </text>
          );
        })}
      </svg>
      <div className="text-xs text-muted-foreground mt-2">Weighted risk-tolerance distribution</div>
    </div>
  );
}

function DonutChart({ data }: { data: Array<{ key: string; value: number }> }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let acc = 0;
  const R = 70, r = 45;
  return (
    <svg viewBox="-100 -100 200 200" className="w-56 h-56">
      {data.map((d) => {
        const start = (acc / total) * Math.PI * 2;
        acc += d.value;
        const end = (acc / total) * Math.PI * 2;
        const large = end - start > Math.PI ? 1 : 0;
        const x1 = R * Math.cos(start), y1 = R * Math.sin(start);
        const x2 = R * Math.cos(end), y2 = R * Math.sin(end);
        const x3 = r * Math.cos(end), y3 = r * Math.sin(end);
        const x4 = r * Math.cos(start), y4 = r * Math.sin(start);
        const path = `M${x1},${y1} A${R},${R} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${r},${r} 0 ${large} 0 ${x4},${y4} Z`;
        return <path key={d.key} d={path} fill={ALLOC_COLORS[d.key]} stroke="var(--background)" strokeWidth="1" />;
      })}
    </svg>
  );
}

function RebalanceRow({ gap }: { gap: RebalanceGap }) {
  return (
    <div className="p-4 rounded-2xl border border-border flex items-center gap-4"
      style={{ background: URGENCY_BG[gap.urgency] }}>
      <span className="w-3 h-3 rounded-full" style={{ background: ALLOC_COLORS[gap.key] }} />
      <div className="flex-1">
        <div className="text-sm font-medium">{gap.label}</div>
        <div className="text-xs text-muted-foreground">
          {fmtPct(gap.actual)} → target {fmtPct(gap.target)} ·{" "}
          <span className={gap.drift > 0 ? "text-[var(--danger)]" : gap.drift < 0 ? "text-[var(--success)]" : ""}>
            drift {gap.drift >= 0 ? "+" : ""}{fmtPct(gap.drift)}
          </span>
        </div>
      </div>
      <div className="text-right">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">{gap.urgency} urgency</div>
        <div className="font-display text-lg" style={{
          color: gap.action === "Buy More" ? "var(--success)" : gap.action === "Reduce" ? "var(--danger)" : "var(--muted-foreground)",
        }}>
          {gap.action === "Hold" ? "✓ Hold" : `${gap.action} ${fmtVND(gap.amountVND)}`}
        </div>
      </div>
    </div>
  );
}

function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [fp, setFp] = useState<FinancialProfile | null>(null);
  const [q, setQ] = useState<Questionnaire | null>(null);
  const [holdings, setHoldings] = useState<Array<{ category: string; amount: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "pillars" | "risk" | "rebalance">("overview");

  useEffect(() => {
    if (!authLoading && !user) { nav({ to: "/login" }); return; }
    if (!user) return;
    (async () => {
      const [fpRes, qRes, hRes] = await Promise.all([
        supabase.from("financial_profiles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("questionnaire_responses").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("holdings").select("category, amount").eq("user_id", user.id),
      ]);
      if (fpRes.data) setFp(fpRes.data as FinancialProfile);
      if (qRes.data) setQ(qRes.data as Questionnaire);
      setHoldings(hRes.data ?? []);
      setLoading(false);
    })();
  }, [user, authLoading, nav]);

  const fhs = useMemo(() => fp ? computeFHS(fp) : null, [fp]);
  const risk = useMemo(() => (fp && q && fhs) ? computeRisk(fp, q, fhs) : null, [fp, q, fhs]);
  const alloc = useMemo(() => risk ? recommendAllocation(risk.RiskCapacity) : null, [risk]);

  const actual = useMemo(() => {
    const sums: Record<string, number> = { cash: 0, gold: 0, stock: 0, bond_fund: 0 };
    holdings.forEach((h) => { sums[h.category] = (sums[h.category] || 0) + Number(h.amount); });
    const total = sums.cash + sums.gold + sums.stock + sums.bond_fund;
    return {
      sums, total,
      pct: total > 0 ? {
        cash: sums.cash/total*100, gold: sums.gold/total*100, stock: sums.stock/total*100, bond_fund: sums.bond_fund/total*100,
      } : { cash: 0, gold: 0, stock: 0, bond_fund: 0 },
    };
  }, [holdings]);

  const rebalanceGaps = useMemo(() => {
    if (!alloc || actual.total === 0) return [];
    return computeRebalanceGaps(
      { stock: actual.sums.stock, bond_fund: actual.sums.bond_fund, gold: actual.sums.gold, cash: actual.sums.cash },
      alloc, actual.total,
    );
  }, [alloc, actual]);

  if (loading) return <AppShell><div className="p-10 text-muted-foreground">Loading dashboard...</div></AppShell>;

  if (!fp) return (
    <AppShell>
      <div className="lux-card p-10 max-w-xl">
        <h2 className="font-display text-2xl">Complete your financial profile</h2>
        <p className="text-muted-foreground mt-2 text-sm">We need a few numbers to compute your FHS.</p>
        <Link to="/profile" className="btn-gold inline-block mt-6">Enter profile</Link>
      </div>
    </AppShell>
  );

  if (!q || !risk || !alloc) return (
    <AppShell>
      <div className="lux-card p-10 max-w-xl">
        <h2 className="font-display text-2xl">Take the 7-question risk survey</h2>
        <p className="text-muted-foreground mt-2 text-sm">Required for AI portfolio recommendation.</p>
        <Link to="/questionnaire" className="btn-gold inline-block mt-6">Start survey</Link>
      </div>
    </AppShell>
  );

  const allocData = [
    { key: "stock", value: alloc.stock },
    { key: "bond_fund", value: alloc.bond_fund },
    { key: "gold", value: alloc.gold },
    { key: "cash", value: alloc.cash },
  ];

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "pillars", label: "FHS Pillars" },
    { id: "risk", label: "Risk Capacity" },
    { id: "rebalance", label: "Rebalancing" },
  ] as const;

  return (
    <AppShell>
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-4xl">Financial <span className="gold-text">Dashboard</span></h1>
          <p className="text-muted-foreground mt-2">Live FHS, risk capacity, and AI-recommended portfolio allocation.</p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">FHS Band</div>
          <div className="font-display text-2xl gold-text">{fhs!.band}</div>
        </div>
      </div>

      <section className="grid md:grid-cols-4 gap-4 mt-6">
        {[
          ["FHS", fhs!.FHS.toFixed(0), "/ 100"],
          ["Risk Capacity", risk.RiskCapacity.toFixed(0), "/ 100"],
          ["Financial Capacity (FC)", risk.FC.toFixed(0), "pts"],
          ["Risk Tolerance (RT)", risk.RT.toFixed(0), "pts"],
        ].map(([k, v, unit]) => (
          <div key={k} className="stat-card">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">{k}</div>
            <div className="font-display text-2xl mt-2">{v}</div>
            <div className="text-[10px] text-muted-foreground mt-1">{unit}</div>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap gap-2 mt-8 mb-6">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-5 py-2 rounded-full text-sm transition-colors border ${
              tab === t.id
                ? "border-[var(--gold)] bg-[var(--gold)]/10 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <section className="grid lg:grid-cols-3 gap-6">
            <div className="lux-card p-8 flex items-center justify-center"><Ring value={fhs!.FHS} label="Financial Health Score" sub="/ 100" /></div>
            <div className="lux-card p-8 flex items-center justify-center"><Ring value={Math.max(0, risk.RiskCapacity)} label="Risk Capacity" sub={risk.profile} /></div>
            <div className="lux-card p-8">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Pillar Scores</div>
              <div className="space-y-4 mt-5">
                {fhs!.pillars.map((p) => (
                  <div key={p.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{p.label}</span>
                      <span>{p.score.toFixed(0)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-[oklch(0.16_0.02_250)] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, p.score)}%`, background: STATUS_COLORS[p.status] }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid md:grid-cols-4 gap-4 mt-6">
            {[
              ["Saving Rate", `${fhs!.SR.toFixed(1)}%`],
              ["DTI", `${fhs!.DTI.toFixed(1)}%`],
              ["Emergency Fund", `${fhs!.EFS.toFixed(2)} mo`],
              ["Asset Ratio", `${fhs!.AssetRatio.toFixed(2)}×`],
            ].map(([k, v]) => (
              <div key={k} className="stat-card">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">{k}</div>
                <div className="font-display text-2xl mt-2">{v}</div>
              </div>
            ))}
          </section>

          <section className="grid lg:grid-cols-2 gap-6 mt-8">
            <div className="lux-card p-8">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">AI Recommended Allocation</div>
              <div className="font-display text-2xl mt-1">{risk.profile}</div>
              <p className="text-sm text-muted-foreground mt-1">{alloc.objective}</p>
              <div className="flex items-center gap-8 mt-6">
                <DonutChart data={allocData} />
                <div className="flex-1 space-y-3">
                  {allocData.map((d) => (
                    <div key={d.key} className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full" style={{ background: ALLOC_COLORS[d.key] }} />
                      <span className="text-sm flex-1">{CATEGORY_LABEL[d.key]}</span>
                      <span className="text-sm font-medium">{d.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="lux-card p-8">
              <div className="flex justify-between items-baseline">
                <div>
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">Actual vs Recommended</div>
                  <div className="font-display text-2xl mt-1">Portfolio Drift</div>
                </div>
                <Link to="/portfolio" className="btn-ghost text-sm">Manage</Link>
              </div>
              <div className="mt-6 space-y-4">
                {(["stock","bond_fund","gold","cash"] as const).map((k) => {
                  const aPct = actual.pct[k] || 0;
                  const rPct = allocData.find((d) => d.key === k)!.value;
                  const drift = aPct - rPct;
                  return (
                    <div key={k}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{CATEGORY_LABEL[k]}</span>
                        <span className="text-muted-foreground">
                          <span className="text-foreground">{aPct.toFixed(1)}%</span> · target {rPct}% ·
                          <span className={drift >= 0 ? " text-[var(--success)]" : " text-[var(--danger)]"}> {drift >= 0 ? "+" : ""}{drift.toFixed(1)}%</span>
                        </span>
                      </div>
                      <div className="relative h-2 rounded-full bg-[oklch(0.16_0.02_250)] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, aPct)}%`, background: ALLOC_COLORS[k] }} />
                        <div className="absolute top-0 bottom-0 w-px bg-[var(--gold)]" style={{ left: `${rPct}%` }} />
                      </div>
                    </div>
                  );
                })}
                <div className="text-xs text-muted-foreground mt-4">Gold marker = AI target. Total portfolio: <span className="text-foreground">{fmtVND(actual.total)}</span></div>
              </div>
            </div>
          </section>
        </>
      )}

      {tab === "pillars" && (
        <section className="grid lg:grid-cols-2 gap-6">
          <div className="lux-card p-8 space-y-4">
            <h2 className="font-display text-2xl">Four FHS Pillars</h2>
            <p className="text-xs text-muted-foreground">FHS = SR × 35% + DTI × 30% + Emergency × 25% + Assets × 10% — rule-based scoring, not ML.</p>
            {fhs!.pillars.map((p) => <PillarRow key={p.label} p={p} />)}
          </div>
          <div className="lux-card p-8">
            <h3 className="font-display text-xl">Composite Calculation</h3>
            <div className="mt-4 text-sm">
              <div className="grid grid-cols-3 gap-2 py-2 border-b border-border text-xs uppercase tracking-widest text-muted-foreground">
                <span>Pillar</span><span className="text-right">Score × Weight</span><span className="text-right">Contribution</span>
              </div>
              {[
                ["Saving Rate (35%)", fhs!.SR_score, 0.35],
                ["DTI (30%)", fhs!.DTI_score, 0.30],
                ["Emergency Fund (25%)", fhs!.EFS_score, 0.25],
                ["Assets (10%)", fhs!.Asset_score, 0.10],
              ].map(([label, score, w]) => (
                <div key={label as string} className="grid grid-cols-3 gap-2 py-2 border-b border-border/50 text-sm">
                  <span>{label as string}</span>
                  <span className="text-right text-muted-foreground">{(score as number).toFixed(1)} × {w as number}</span>
                  <span className="text-right">{((score as number) * (w as number)).toFixed(1)}</span>
                </div>
              ))}
              <div className="grid grid-cols-3 gap-2 py-3 mt-2 font-display text-lg">
                <span>FHS Total</span><span></span><span className="text-right gold-text">{fhs!.FHS.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {tab === "risk" && (
        <section className="grid lg:grid-cols-2 gap-6">
          <div className="lux-card p-8">
            <h2 className="font-display text-2xl">Financial Capacity (FC)</h2>
            <p className="text-xs text-muted-foreground mt-1">FC = FHS + acute risk adjustments + horizon bonus</p>
            <div className="mt-5 space-y-2 text-sm">
              {[
                ["Base FHS", `+${fhs!.FHS.toFixed(1)}`, ""],
                ["High-DTI penalty", risk.penalties.dti === 0 ? "0" : risk.penalties.dti.toString(), risk.penalties.dti < 0 ? "text-[var(--danger)]" : ""],
                ["Low-emergency penalty", risk.penalties.efs === 0 ? "0" : risk.penalties.efs.toString(), risk.penalties.efs < 0 ? "text-[var(--danger)]" : ""],
                ["Horizon bonus", `+${risk.penalties.horizon}`, risk.penalties.horizon > 0 ? "text-[var(--success)]" : "text-muted-foreground"],
              ].map(([l, v, cls]) => (
                <div key={l as string} className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">{l as string}</span>
                  <span className={cls as string}>{v as string}</span>
                </div>
              ))}
              <div className="flex justify-between py-3 font-display text-lg">
                <span>FC</span><span className="gold-text">{risk.FC.toFixed(1)}</span>
              </div>
            </div>

            <h3 className="font-display text-lg mt-6">Composite Risk Capacity</h3>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-border/50"><span className="text-muted-foreground">FC × 0.6</span><span>+{(risk.FC * 0.6).toFixed(1)}</span></div>
              <div className="flex justify-between py-2 border-b border-border/50"><span className="text-muted-foreground">RT × 0.4 (weighted)</span><span>+{(risk.RT * 0.4).toFixed(1)}</span></div>
              <div className="flex justify-between py-2 border-b border-border/50"><span className="text-muted-foreground">Weighted sum</span><span>{risk.Weighted.toFixed(1)}</span></div>
              <div className="flex justify-between py-2 border-b border-border/50"><span className="text-muted-foreground">Hard cap (FC + 10)</span><span>{(risk.FC + 10).toFixed(1)}</span></div>
              <div className="flex justify-between py-3 font-display text-lg">
                <span>Risk Capacity</span><span className="gold-text">{risk.RiskCapacity.toFixed(1)} · {risk.profile}</span>
              </div>
            </div>
          </div>

          <div className="lux-card p-8">
            <h2 className="font-display text-2xl">Risk Tolerance (RT)</h2>
            <p className="text-xs text-muted-foreground mt-1">RT = Σ (question weight × normalised score). Weights reflect behavioural predictiveness.</p>
            <div className="flex justify-center mt-4"><QuestionRadar breakdown={risk.questionBreakdown} /></div>
            <div className="mt-4 space-y-2 text-sm">
              {risk.questionBreakdown.map((b) => (
                <div key={b.id} className="grid grid-cols-12 gap-2 items-center py-2 border-b border-border/50">
                  <span className="col-span-1 text-[var(--gold)] font-display">{b.id.toUpperCase()}</span>
                  <span className="col-span-5 text-muted-foreground">{b.label}</span>
                  <span className="col-span-2 text-xs px-2 py-0.5 rounded-full border border-border text-center">w={fmtPct(b.weight * 100, 0)}</span>
                  <div className="col-span-3 h-1.5 rounded-full bg-[oklch(0.16_0.02_250)] overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--gold)]" style={{ width: `${b.weightedScore / (b.weight * 100) * 100}%` }} />
                  </div>
                  <span className="col-span-1 text-right">{b.weightedScore.toFixed(1)}</span>
                </div>
              ))}
              <div className="flex justify-between py-3 font-display text-lg">
                <span>RT Total</span><span className="gold-text">{risk.RT.toFixed(1)} / 100</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {tab === "rebalance" && (
        <section className="grid lg:grid-cols-2 gap-6">
          <div className="lux-card p-8">
            <h2 className="font-display text-2xl">Rebalancing Plan</h2>
            <p className="text-xs text-muted-foreground mt-1">Compare actual holdings to AI target and compute the VND delta per asset class.</p>
            <div className="mt-5 space-y-3">
              {rebalanceGaps.length === 0 ? (
                <p className="text-muted-foreground text-sm">Add holdings on the Portfolio page to see your rebalancing plan.</p>
              ) : (
                <>
                  {rebalanceGaps.map((g) => <RebalanceRow key={g.key} gap={g} />)}
                  <p className="text-xs text-muted-foreground mt-4">⚠️ Indicative only. Account for taxes and transaction fees before executing trades.</p>
                </>
              )}
            </div>
          </div>
          <div className="lux-card p-8">
            <h2 className="font-display text-2xl">Per-Asset Guidance</h2>
            <p className="text-xs text-muted-foreground mt-1">Based on risk profile: <span className="text-foreground">{risk.profile}</span></p>
            <div className="mt-5 space-y-3">
              {(["stock","bond_fund","gold","cash"] as const).map((k) => (
                <div key={k} className="p-4 rounded-2xl border border-border">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full" style={{ background: ALLOC_COLORS[k] }} />
                    <span className="font-medium flex-1">{CATEGORY_LABEL[k]}</span>
                    <span className="text-sm text-[var(--gold)]">{alloc[k]}%</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{alloc.advice[k]}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </AppShell>
  );
}
