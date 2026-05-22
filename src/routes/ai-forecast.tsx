import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/ai-forecast")({ component: AIForecastPage });

type Stock = { ticker: string; name: string; sector: string };
type Forecast = {
  ticker: string;
  current_price: number;
  predicted_price: number;
  change_pct: number;
  confidence: number;
  signal: string;
  horizon_days: number;
  forecast_path: number[] | { day: number; price: number }[] | unknown;
  generated_at: string;
};
type Metric = {
  ticker: string;
  rmse: number | null; mae: number | null; mape: number | null;
  direction_accuracy: number | null; sharpe: number | null;
  strategy_return: number | null; buyhold_return: number | null;
  alpha: number | null; max_drawdown: number | null;
};
type Xai = { ticker: string; feature: string; importance: number; method: string };
type Hist = { date: string; close: number; rsi: number | null; ema20: number | null };

const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " ₫";
const pct = (n: number | null | undefined, digits = 2) =>
  n == null ? "—" : `${n >= 0 ? "+" : ""}${(n * 100).toFixed(digits)}%`;
const pctRaw = (n: number | null | undefined, digits = 2) =>
  n == null ? "—" : `${(n).toFixed(digits)}%`;

function SignalChip({ s }: { s: string }) {
  const color = s === "BUY" ? "var(--success)" : s === "CAUTION" ? "var(--danger)" : "var(--warning)";
  return <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wider"
    style={{ background: `color-mix(in oklab, ${color} 18%, transparent)`, color }}>{s}</span>;
}

function Sparkline({ data, color = "var(--gold)" }: { data: number[]; color?: string }) {
  if (!data?.length) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const W = 220, H = 60;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * H}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

function PriceChart({ hist, forecast }: { hist: Hist[]; forecast: number[] }) {
  if (!hist.length) return null;
  const histPrices = hist.map((h) => Number(h.close));
  const all = [...histPrices, ...forecast];
  const min = Math.min(...all), max = Math.max(...all);
  const range = (max - min) || 1;
  const W = 760, H = 240;
  const total = histPrices.length + forecast.length;
  const x = (i: number) => (i / (total - 1)) * W;
  const y = (v: number) => H - ((v - min) / range) * H;
  const histPts = histPrices.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const fcPts = forecast.map((v, i) => `${x(histPrices.length - 1 + i)},${y(v)}`).join(" ");
  const splitX = x(histPrices.length - 1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-60">
      <line x1={splitX} y1="0" x2={splitX} y2={H} stroke="oklch(0.4 0.04 250 / 0.4)" strokeDasharray="4 4" />
      <polyline points={histPts} fill="none" stroke="var(--chart-2)" strokeWidth="2" />
      <polyline points={fcPts} fill="none" stroke="var(--gold)" strokeWidth="2.5" strokeDasharray="6 4" />
    </svg>
  );
}

function parsePath(p: unknown): number[] {
  if (Array.isArray(p)) {
    if (p.length && typeof p[0] === "object" && p[0] !== null && "price" in (p[0] as object)) {
      return (p as { price: number }[]).map((x) => Number(x.price));
    }
    return (p as unknown[]).map(Number);
  }
  return [];
}

function AIForecastPage() {
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [fcs, setFcs] = useState<Forecast[]>([]);
  const [metrics, setMetrics] = useState<Map<string, Metric>>(new Map());
  const [xai, setXai] = useState<Xai[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSignal, setFilterSignal] = useState<string>("ALL");
  const [filterSector, setFilterSector] = useState<string>("ALL");
  const [selected, setSelected] = useState<string | null>(null);
  const [hist, setHist] = useState<Hist[]>([]);

  useEffect(() => {
    if (!authLoading && !user) { nav({ to: "/login" }); return; }
    (async () => {
      const [s, f, m, x] = await Promise.all([
        supabase.from("stocks").select("*").order("ticker"),
        supabase.from("ai_forecasts").select("*"),
        supabase.from("ai_metrics").select("*"),
        supabase.from("xai_explanations").select("*"),
      ]);
      setStocks((s.data ?? []) as Stock[]);
      setFcs((f.data ?? []) as Forecast[]);
      const mp = new Map<string, Metric>();
      (m.data ?? []).forEach((row) => mp.set((row as Metric).ticker, row as Metric));
      setMetrics(mp);
      setXai((x.data ?? []) as Xai[]);
      setLoading(false);
    })();
  }, [user, authLoading, nav]);

  const sectors = useMemo(() => Array.from(new Set(stocks.map((s) => s.sector))).sort(), [stocks]);
  const stockMap = useMemo(() => new Map(stocks.map((s) => [s.ticker, s])), [stocks]);

  const rows = useMemo(() => {
    return fcs
      .map((f) => ({ ...f, stock: stockMap.get(f.ticker), metric: metrics.get(f.ticker) }))
      .filter((r) => filterSignal === "ALL" || r.signal === filterSignal)
      .filter((r) => filterSector === "ALL" || r.stock?.sector === filterSector)
      .sort((a, b) => Number(b.change_pct) - Number(a.change_pct));
  }, [fcs, stockMap, metrics, filterSignal, filterSector]);

  async function openDetail(ticker: string) {
    setSelected(ticker);
    const { data } = await supabase
      .from("historical_prices")
      .select("date, close, rsi, ema20")
      .eq("ticker", ticker)
      .order("date", { ascending: true })
      .limit(120);
    setHist((data ?? []).slice(-90) as Hist[]);
  }

  const selectedFc = fcs.find((f) => f.ticker === selected);
  const selectedMetric = selected ? metrics.get(selected) : null;
  const selectedXai = useMemo(() => xai.filter((x) => x.ticker === selected).sort((a, b) => Math.abs(Number(b.importance)) - Math.abs(Number(a.importance))), [xai, selected]);
  const selectedPath = selectedFc ? parsePath(selectedFc.forecast_path) : [];

  if (loading) return <AppShell><div className="p-10 text-muted-foreground">Loading AI engine...</div></AppShell>;

  return (
    <AppShell>
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-4xl">AI <span className="gold-text">Stock Forecast</span></h1>
          <p className="text-muted-foreground mt-2">7-day price predictions, model performance, and SHAP/LIME explainability for 30 Vietnamese tickers.</p>
        </div>
        <div className="text-xs text-muted-foreground">Pipeline: ARIMA trend (train-window only) + Ridge regression over 20-day sliding windows · Walk-forward validation · Permutation-based feature importance (SHAP/LIME proxy). Synthetic OHLCV data; no look-ahead leakage.</div>
      </div>

      <div className="mt-3 lux-card p-4 text-xs text-[var(--warning)] border-[var(--warning)]/40">
        ⚠️ Dự báo chỉ mang tính tham khảo, không phải khuyến nghị đầu tư. Quyết định đầu tư là trách nhiệm của cá nhân.
      </div>

      <section className="grid md:grid-cols-4 gap-4 mt-6">
        {(["ALL","BUY","WATCH","CAUTION"] as const).map((s) => {
          const count = s === "ALL" ? fcs.length : fcs.filter((f) => f.signal === s).length;
          const active = filterSignal === s;
          return (
            <button key={s} onClick={() => setFilterSignal(s)}
              className={`stat-card text-left transition ${active ? "ring-1 ring-[var(--gold)]" : ""}`}>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">{s === "ALL" ? "All Forecasts" : s + " signals"}</div>
              <div className="font-display text-2xl mt-2">{count}</div>
            </button>
          );
        })}
      </section>

      <div className="flex items-center gap-3 mt-6 flex-wrap">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">Sector</span>
        <select className="lux-input max-w-xs" value={filterSector} onChange={(e) => setFilterSector(e.target.value)}>
          <option value="ALL">All sectors</option>
          {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <section className="grid lg:grid-cols-2 xl:grid-cols-3 gap-5 mt-5">
        {rows.map((r) => {
          const path = parsePath(r.forecast_path);
          const up = Number(r.change_pct) >= 0;
          return (
            <button key={r.ticker} onClick={() => openDetail(r.ticker)} className="lux-card p-6 text-left hover:border-[var(--gold)] transition">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-display text-2xl">{r.ticker}</div>
                  <div className="text-xs text-muted-foreground">{r.stock?.name} · {r.stock?.sector}</div>
                </div>
                <SignalChip s={r.signal} />
              </div>
              <div className="mt-4 flex items-baseline gap-3">
                <div className="text-lg">{fmt(Number(r.current_price))}</div>
                <div className="text-muted-foreground text-sm">→ {fmt(Number(r.predicted_price))}</div>
              </div>
              <div className={`text-sm font-medium ${up ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                {up ? "+" : ""}{(Number(r.change_pct) * 100).toFixed(2)}% · 7-day
              </div>
              <div className="mt-3"><Sparkline data={path} color={up ? "var(--success)" : "var(--danger)"} /></div>
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>Confidence {(Number(r.confidence) * 100).toFixed(0)}%</span>
                <span>Dir Acc {r.metric?.direction_accuracy != null ? (Number(r.metric.direction_accuracy) * 100).toFixed(1) + "%" : "—"}</span>
              </div>
            </button>
          );
        })}
      </section>

      {selected && selectedFc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="lux-card max-w-5xl w-full max-h-[92vh] overflow-y-auto p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start">
              <div>
                <div className="font-display text-3xl">{selected} <SignalChip s={selectedFc.signal} /></div>
                <div className="text-muted-foreground text-sm">{stockMap.get(selected)?.name} · {stockMap.get(selected)?.sector}</div>
              </div>
              <button onClick={() => setSelected(null)} className="btn-ghost text-sm">Close</button>
            </div>

            <div className="grid md:grid-cols-4 gap-3 mt-5">
              <div className="stat-card"><div className="text-xs uppercase text-muted-foreground tracking-widest">Current</div><div className="font-display text-xl mt-1">{fmt(Number(selectedFc.current_price))}</div></div>
              <div className="stat-card"><div className="text-xs uppercase text-muted-foreground tracking-widest">7-day target</div><div className="font-display text-xl mt-1">{fmt(Number(selectedFc.predicted_price))}</div></div>
              <div className="stat-card"><div className="text-xs uppercase text-muted-foreground tracking-widest">Expected return</div>
                <div className={`font-display text-xl mt-1 ${Number(selectedFc.change_pct) >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>{(Number(selectedFc.change_pct) * 100).toFixed(2)}%</div>
              </div>
              <div className="stat-card"><div className="text-xs uppercase text-muted-foreground tracking-widest">Confidence</div><div className="font-display text-xl mt-1">{(Number(selectedFc.confidence) * 100).toFixed(0)}%</div></div>
            </div>

            <div className="lux-card p-5 mt-5">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">90-day history → 7-day forecast</div>
              <PriceChart hist={hist} forecast={selectedPath} />
              <div className="flex gap-4 text-xs text-muted-foreground mt-2">
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[var(--chart-2)]"/>History</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[var(--gold)]" style={{ borderTop: "2px dashed var(--gold)" }} />Forecast</span>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-5 mt-5">
              <div className="lux-card p-5">
                <h3 className="font-display text-lg">Model Performance</h3>
                {selectedMetric ? (
                  <div className="mt-3 space-y-2 text-sm">
                    <Row k="RMSE" v={selectedMetric.rmse?.toFixed(4) ?? "—"} />
                    <Row k="MAE" v={selectedMetric.mae?.toFixed(4) ?? "—"} />
                    <Row k="MAPE" v={pctRaw(selectedMetric.mape)} />
                    <Row k="Direction Accuracy" v={pct(selectedMetric.direction_accuracy, 1)} />
                    <Row k="Sharpe Ratio" v={selectedMetric.sharpe?.toFixed(2) ?? "—"} />
                    <Row k="Strategy Return" v={pct(selectedMetric.strategy_return)} />
                    <Row k="Buy & Hold Return" v={pct(selectedMetric.buyhold_return)} />
                    <Row k="Alpha (vs B&H)" v={pct(selectedMetric.alpha)} />
                    <Row k="Max Drawdown" v={pct(selectedMetric.max_drawdown)} />
                  </div>
                ) : <p className="text-sm text-muted-foreground mt-2">No metrics.</p>}
              </div>

              <div className="lux-card p-5">
                <h3 className="font-display text-lg">XAI · Feature Importance</h3>
                <p className="text-xs text-muted-foreground mt-1">SHAP/LIME proxy via permutation importance.</p>
                <div className="mt-4 space-y-3">
                  {selectedXai.map((x) => {
                    const imp = Number(x.importance);
                    const max = Math.max(...selectedXai.map((v) => Math.abs(Number(v.importance))), 1e-9);
                    const w = (Math.abs(imp) / max) * 100;
                    return (
                      <div key={x.feature}>
                        <div className="flex justify-between text-sm">
                          <span className="uppercase tracking-wide text-xs">{x.feature}</span>
                          <span className="text-muted-foreground text-xs">{imp.toFixed(4)} · {x.method}</span>
                        </div>
                        <div className="h-2 rounded-full bg-[oklch(0.16_0.02_250)] mt-1 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${w}%`, background: imp >= 0 ? "var(--success)" : "var(--danger)" }} />
                        </div>
                      </div>
                    );
                  })}
                  {selectedXai.length === 0 && <p className="text-sm text-muted-foreground">No XAI data.</p>}
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-5">⚠️ Dự báo chỉ mang tính tham khảo, không phải khuyến nghị đầu tư. Quyết định đầu tư là trách nhiệm của cá nhân.</p>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-border/40 pb-1.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
