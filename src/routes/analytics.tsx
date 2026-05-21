import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/analytics")({ component: AnalyticsPage });

type Holding = { category: "cash" | "gold" | "stock" | "bond_fund"; amount: number; created_at: string; name: string };
type Tx = { ticker: string; side: "buy" | "sell"; quantity: number; price: number; fee: number; tax: number; traded_at: string };
type Metric = { ticker: string; sharpe: number | null; strategy_return: number | null; buyhold_return: number | null; alpha: number | null; direction_accuracy: number | null; max_drawdown: number | null };

const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " ₫";
const CATS = ["stock", "bond_fund", "gold", "cash"] as const;
const CAT_LABEL: Record<string, string> = { cash: "Cash", gold: "Gold", stock: "Stocks", bond_fund: "Bonds & Funds" };
const COLORS: Record<string, string> = { stock: "var(--chart-1)", bond_fund: "var(--chart-2)", gold: "var(--chart-3)", cash: "var(--chart-4)" };

function AnalyticsPage() {
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) { nav({ to: "/login" }); return; }
    if (!user) return;
    (async () => {
      const [h, t, m] = await Promise.all([
        supabase.from("holdings").select("category, amount, created_at, name").eq("user_id", user.id),
        supabase.from("transactions").select("*").eq("user_id", user.id).order("traded_at"),
        supabase.from("ai_metrics").select("*"),
      ]);
      setHoldings((h.data ?? []) as Holding[]);
      setTxs((t.data ?? []) as Tx[]);
      setMetrics((m.data ?? []) as Metric[]);
      setLoading(false);
    })();
  }, [user, authLoading, nav]);

  const allocation = useMemo(() => {
    const sums: Record<string, number> = { cash: 0, gold: 0, stock: 0, bond_fund: 0 };
    holdings.forEach((h) => { sums[h.category] += Number(h.amount); });
    const total = CATS.reduce((s, c) => s + sums[c], 0);
    return { sums, total };
  }, [holdings]);

  // Portfolio capital curve from transactions (cumulative invested over time)
  const capitalCurve = useMemo(() => {
    let cum = 0;
    return txs.map((t) => {
      const v = Number(t.quantity) * Number(t.price) + Number(t.fee) + Number(t.tax);
      cum += t.side === "buy" ? v : -v;
      return { date: t.traded_at.slice(0, 10), value: cum };
    });
  }, [txs]);

  // Sector exposure from buy txs (proxy via tickers user holds)
  const tickerExposure = useMemo(() => {
    const map = new Map<string, number>();
    txs.forEach((t) => {
      const v = Number(t.quantity) * Number(t.price);
      map.set(t.ticker, (map.get(t.ticker) ?? 0) + (t.side === "buy" ? v : -v));
    });
    return Array.from(map.entries()).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  }, [txs]);

  // Aggregate AI portfolio outlook for held tickers
  const aiOutlook = useMemo(() => {
    if (!tickerExposure.length || !metrics.length) return null;
    const mMap = new Map(metrics.map((m) => [m.ticker, m]));
    let wSum = 0, wSharpe = 0, wAlpha = 0, wDir = 0, wDD = 0;
    for (const [t, w] of tickerExposure) {
      const m = mMap.get(t);
      if (!m) continue;
      wSum += w;
      wSharpe += (Number(m.sharpe) || 0) * w;
      wAlpha += (Number(m.alpha) || 0) * w;
      wDir += (Number(m.direction_accuracy) || 0) * w;
      wDD += (Number(m.max_drawdown) || 0) * w;
    }
    if (wSum === 0) return null;
    return { sharpe: wSharpe / wSum, alpha: wAlpha / wSum, dir: wDir / wSum, dd: wDD / wSum };
  }, [tickerExposure, metrics]);

  const topAI = useMemo(() => {
    return [...metrics]
      .sort((a, b) => (Number(b.sharpe) || 0) - (Number(a.sharpe) || 0))
      .slice(0, 8);
  }, [metrics]);

  if (loading) return <AppShell><div className="p-10 text-muted-foreground">Loading analytics...</div></AppShell>;

  return (
    <AppShell>
      <h1 className="font-display text-4xl">Portfolio <span className="gold-text">Analytics</span></h1>
      <p className="text-muted-foreground mt-2">Capital flow, asset distribution, sector exposure, and AI-derived portfolio quality.</p>

      <section className="grid md:grid-cols-4 gap-4 mt-8">
        <div className="stat-card">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Total assets</div>
          <div className="font-display text-2xl mt-2">{fmt(allocation.total)}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">AI Portfolio Sharpe</div>
          <div className="font-display text-2xl mt-2">{aiOutlook ? aiOutlook.sharpe.toFixed(2) : "—"}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">AI Alpha vs B&H</div>
          <div className={`font-display text-2xl mt-2 ${aiOutlook && aiOutlook.alpha >= 0 ? "text-[var(--success)]" : aiOutlook ? "text-[var(--danger)]" : ""}`}>
            {aiOutlook ? `${aiOutlook.alpha >= 0 ? "+" : ""}${(aiOutlook.alpha * 100).toFixed(2)}%` : "—"}
          </div>
        </div>
        <div className="stat-card">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Max Drawdown</div>
          <div className="font-display text-2xl mt-2">{aiOutlook ? `${(aiOutlook.dd * 100).toFixed(1)}%` : "—"}</div>
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-6 mt-6">
        <div className="lux-card p-7">
          <h2 className="font-display text-xl">Asset distribution</h2>
          <div className="mt-5 space-y-4">
            {CATS.map((c) => {
              const v = allocation.sums[c] || 0;
              const p = allocation.total > 0 ? (v / allocation.total) * 100 : 0;
              return (
                <div key={c}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{CAT_LABEL[c]}</span>
                    <span className="text-muted-foreground"><span className="text-foreground">{fmt(v)}</span> · {p.toFixed(1)}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-[oklch(0.16_0.02_250)] overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, p)}%`, background: COLORS[c] }} />
                  </div>
                </div>
              );
            })}
            {allocation.total === 0 && <p className="text-sm text-muted-foreground">Add holdings in Portfolio to see distribution.</p>}
          </div>
        </div>

        <div className="lux-card p-7">
          <h2 className="font-display text-xl">Capital curve</h2>
          <p className="text-xs text-muted-foreground">Cumulative invested capital over time.</p>
          {capitalCurve.length < 2 ? (
            <p className="text-sm text-muted-foreground mt-4">Record at least two transactions to see the curve.</p>
          ) : (() => {
            const vals = capitalCurve.map((p) => p.value);
            const min = Math.min(...vals, 0), max = Math.max(...vals, 1);
            const range = (max - min) || 1;
            const W = 520, H = 180;
            const pts = capitalCurve.map((p, i) => `${(i / (capitalCurve.length - 1)) * W},${H - ((p.value - min) / range) * H}`).join(" ");
            return (
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-48 mt-4">
                <defs>
                  <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polygon points={`0,${H} ${pts} ${W},${H}`} fill="url(#cg)" />
                <polyline points={pts} fill="none" stroke="var(--gold)" strokeWidth="2.5" />
              </svg>
            );
          })()}
          <div className="text-xs text-muted-foreground mt-2">Latest: {capitalCurve.length ? fmt(capitalCurve[capitalCurve.length - 1].value) : "—"}</div>
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-6 mt-6">
        <div className="lux-card p-7">
          <h2 className="font-display text-xl">Ticker exposure</h2>
          {tickerExposure.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-3">No trade exposure yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {tickerExposure.slice(0, 10).map(([t, v]) => {
                const total = tickerExposure.reduce((s, [, x]) => s + x, 0);
                const p = (v / total) * 100;
                return (
                  <div key={t}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{t}</span>
                      <span className="text-muted-foreground">{fmt(v)} · {p.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-[oklch(0.16_0.02_250)] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${p}%`, background: "var(--chart-1)" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lux-card p-7">
          <h2 className="font-display text-xl">AI top picks (by Sharpe)</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-widest text-muted-foreground">
                  <th className="py-2 pr-3">Ticker</th>
                  <th className="py-2 pr-3 text-right">Sharpe</th>
                  <th className="py-2 pr-3 text-right">Alpha</th>
                  <th className="py-2 pr-3 text-right">Dir Acc</th>
                </tr>
              </thead>
              <tbody>
                {topAI.map((m) => (
                  <tr key={m.ticker} className="border-t border-border/40">
                    <td className="py-2 pr-3 font-medium">{m.ticker}</td>
                    <td className="py-2 pr-3 text-right">{m.sharpe?.toFixed(2) ?? "—"}</td>
                    <td className={`py-2 pr-3 text-right ${(Number(m.alpha) || 0) >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                      {m.alpha != null ? `${Number(m.alpha) >= 0 ? "+" : ""}${(Number(m.alpha) * 100).toFixed(2)}%` : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right">{m.direction_accuracy != null ? `${(Number(m.direction_accuracy) * 100).toFixed(1)}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="text-xs text-muted-foreground mt-6">⚠️ Dự báo chỉ mang tính tham khảo, không phải khuyến nghị đầu tư. Quyết định đầu tư là trách nhiệm của cá nhân.</div>
    </AppShell>
  );
}
