import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { computeFHS, computeRisk, recommendAllocation, CATEGORY_LABEL, type FinancialProfile, type Questionnaire } from "@/lib/fhs";

export const Route = createFileRoute("/dashboard")({ component: DashboardPage });

const fmtVND = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " ₫";
const ALLOC_COLORS: Record<string, string> = {
  stock: "var(--chart-1)", bond_fund: "var(--chart-2)", gold: "var(--chart-3)", cash: "var(--chart-4)",
};

function Ring({ value, max = 100, label, sub }: { value: number; max?: number; label: string; sub?: string }) {
  const pct = Math.max(0, Math.min(1, value / max));
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

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span>{value.toFixed(1)}</span>
      </div>
      <div className="h-2 rounded-full bg-[oklch(0.16_0.02_250)] overflow-hidden">
        <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} className="h-full rounded-full transition-all duration-700" />
      </div>
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

function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [fp, setFp] = useState<FinancialProfile | null>(null);
  const [q, setQ] = useState<Questionnaire | null>(null);
  const [holdings, setHoldings] = useState<Array<{ category: string; amount: number }>>([]);
  const [loading, setLoading] = useState(true);

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
    return { sums, total, pct: total > 0 ? {
      cash: sums.cash/total*100, gold: sums.gold/total*100, stock: sums.stock/total*100, bond_fund: sums.bond_fund/total*100,
    } : { cash: 0, gold: 0, stock: 0, bond_fund: 0 } };
  }, [holdings]);

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

  return (
    <AppShell>
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-4xl">Financial <span className="gold-text">Dashboard</span></h1>
          <p className="text-muted-foreground mt-2">Your live FHS, Risk Capacity, and AI-recommended portfolio.</p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">FHS Band</div>
          <div className="font-display text-2xl gold-text">{fhs!.band}</div>
        </div>
      </div>

      <section className="grid lg:grid-cols-3 gap-6 mt-8">
        <div className="lux-card p-8 flex flex-col items-center justify-center">
          <Ring value={fhs!.FHS} label="Financial Health Score" sub="/ 100" />
        </div>
        <div className="lux-card p-8 flex flex-col items-center justify-center">
          <Ring value={Math.max(0, risk.RiskCapacity)} label="Risk Capacity" sub={risk.profile} />
        </div>
        <div className="lux-card p-8">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Pillar Scores</div>
          <div className="space-y-4 mt-5">
            <Bar label="Saving Rate" value={fhs!.SR_score} color="var(--chart-1)" />
            <Bar label="DTI" value={fhs!.DTI_score} color="var(--chart-2)" />
            <Bar label="Emergency Fund" value={fhs!.EFS_score} color="var(--chart-3)" />
            <Bar label="Asset Score" value={fhs!.Asset_score} color="var(--chart-4)" />
          </div>
        </div>
      </section>

      <section className="grid md:grid-cols-4 gap-4 mt-6">
        {[
          ["Saving Rate", `${fhs!.SR.toFixed(1)}%`],
          ["DTI", `${fhs!.DTI.toFixed(1)}%`],
          ["Emergency Fund", `${fhs!.EFS.toFixed(2)}×`],
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
    </AppShell>
  );
}
