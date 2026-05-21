import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/transactions")({ component: TxPage });

type Tx = {
  id: string;
  ticker: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  fee: number;
  tax: number;
  notes: string | null;
  traded_at: string;
};
type Stock = { ticker: string; name: string; sector: string };

const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " ₫";
const fmtQty = (n: number) => new Intl.NumberFormat("vi-VN").format(n);

function TxPage() {
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);

  const [ticker, setTicker] = useState("VCB");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [fee, setFee] = useState("0");
  const [tax, setTax] = useState("0");
  const [notes, setNotes] = useState("");

  async function load() {
    if (!user) return;
    const [s, t] = await Promise.all([
      supabase.from("stocks").select("*").order("ticker"),
      supabase.from("transactions").select("*").eq("user_id", user.id).order("traded_at", { ascending: false }),
    ]);
    setStocks((s.data ?? []) as Stock[]);
    setTxs((t.data ?? []) as Tx[]);
    setLoading(false);
  }

  useEffect(() => {
    if (!authLoading && !user) { nav({ to: "/login" }); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const q = Number(qty), p = Number(price);
    if (!(q > 0) || !(p > 0)) return;
    const { error } = await supabase.from("transactions").insert({
      user_id: user.id, ticker, side, quantity: q, price: p,
      fee: Number(fee) || 0, tax: Number(tax) || 0, notes: notes.trim() || null,
    });
    if (!error) { setQty(""); setPrice(""); setNotes(""); load(); }
  }
  async function remove(id: string) {
    await supabase.from("transactions").delete().eq("id", id);
    load();
  }

  // Positions aggregation (average cost)
  const positions = useMemo(() => {
    const map = new Map<string, { qty: number; cost: number; realized: number }>();
    [...txs].reverse().forEach((tx) => {
      const cur = map.get(tx.ticker) ?? { qty: 0, cost: 0, realized: 0 };
      if (tx.side === "buy") {
        cur.qty += Number(tx.quantity);
        cur.cost += Number(tx.quantity) * Number(tx.price) + Number(tx.fee) + Number(tx.tax);
      } else {
        const avg = cur.qty > 0 ? cur.cost / cur.qty : 0;
        const sellQty = Number(tx.quantity);
        cur.realized += sellQty * (Number(tx.price) - avg) - Number(tx.fee) - Number(tx.tax);
        cur.qty -= sellQty;
        cur.cost = Math.max(0, cur.qty) * avg;
      }
      map.set(tx.ticker, cur);
    });
    return Array.from(map.entries())
      .map(([t, v]) => ({ ticker: t, ...v, avg: v.qty > 0 ? v.cost / v.qty : 0 }))
      .filter((p) => p.qty > 0 || p.realized !== 0)
      .sort((a, b) => b.cost - a.cost);
  }, [txs]);

  const totals = useMemo(() => {
    const invested = positions.reduce((s, p) => s + p.cost, 0);
    const realized = positions.reduce((s, p) => s + p.realized, 0);
    return { invested, realized, count: txs.length };
  }, [positions, txs]);

  if (loading) return <AppShell><div className="p-10 text-muted-foreground">Loading...</div></AppShell>;

  return (
    <AppShell>
      <h1 className="font-display text-4xl">Trading <span className="gold-text">Transactions</span></h1>
      <p className="text-muted-foreground mt-2">Log buys & sells on Vietnamese tickers. Average cost, realized P&L, and tax/fee included.</p>

      <section className="grid md:grid-cols-3 gap-4 mt-8">
        <div className="stat-card">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Capital Invested</div>
          <div className="font-display text-2xl mt-2">{fmt(totals.invested)}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Realized P&L</div>
          <div className={`font-display text-2xl mt-2 ${totals.realized >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
            {totals.realized >= 0 ? "+" : ""}{fmt(totals.realized)}
          </div>
        </div>
        <div className="stat-card">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Trades</div>
          <div className="font-display text-2xl mt-2">{totals.count}</div>
        </div>
      </section>

      <section className="grid lg:grid-cols-5 gap-6 mt-6">
        <div className="lux-card p-7 lg:col-span-2">
          <h2 className="font-display text-xl">New transaction</h2>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="lux-label">Ticker</label>
                <select className="lux-input" value={ticker} onChange={(e) => setTicker(e.target.value)}>
                  {stocks.map((s) => <option key={s.ticker} value={s.ticker}>{s.ticker} — {s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="lux-label">Side</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setSide("buy")}
                    className={`px-3 py-2 rounded-xl text-sm border ${side === "buy" ? "border-[var(--success)] bg-[var(--success)]/10 text-[var(--success)]" : "border-border"}`}>Buy</button>
                  <button type="button" onClick={() => setSide("sell")}
                    className={`px-3 py-2 rounded-xl text-sm border ${side === "sell" ? "border-[var(--danger)] bg-[var(--danger)]/10 text-[var(--danger)]" : "border-border"}`}>Sell</button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="lux-label">Quantity</label>
                <input className="lux-input" type="number" min={0} step="any" value={qty} onChange={(e) => setQty(e.target.value)} required /></div>
              <div><label className="lux-label">Price (₫)</label>
                <input className="lux-input" type="number" min={0} step="any" value={price} onChange={(e) => setPrice(e.target.value)} required /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="lux-label">Fee (₫)</label>
                <input className="lux-input" type="number" min={0} step="any" value={fee} onChange={(e) => setFee(e.target.value)} /></div>
              <div><label className="lux-label">Tax (₫)</label>
                <input className="lux-input" type="number" min={0} step="any" value={tax} onChange={(e) => setTax(e.target.value)} /></div>
            </div>
            <div><label className="lux-label">Notes</label>
              <input className="lux-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" /></div>
            <button className="btn-gold w-full">Record transaction</button>
          </form>
        </div>

        <div className="lux-card p-7 lg:col-span-3">
          <h2 className="font-display text-xl">Open positions</h2>
          {positions.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-3">No positions yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-widest text-muted-foreground">
                    <th className="py-3 pr-4">Ticker</th>
                    <th className="py-3 pr-4 text-right">Quantity</th>
                    <th className="py-3 pr-4 text-right">Avg Cost</th>
                    <th className="py-3 pr-4 text-right">Invested</th>
                    <th className="py-3 pr-4 text-right">Realized</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => (
                    <tr key={p.ticker} className="border-t border-border/50">
                      <td className="py-3 pr-4 font-medium">{p.ticker}</td>
                      <td className="py-3 pr-4 text-right">{fmtQty(p.qty)}</td>
                      <td className="py-3 pr-4 text-right">{fmt(p.avg)}</td>
                      <td className="py-3 pr-4 text-right">{fmt(p.cost)}</td>
                      <td className={`py-3 pr-4 text-right ${p.realized >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                        {p.realized >= 0 ? "+" : ""}{fmt(p.realized)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="lux-card p-7 mt-6">
        <h2 className="font-display text-xl">Trade history</h2>
        {txs.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-3">No trades recorded.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-widest text-muted-foreground">
                  <th className="py-3 pr-4">Date</th>
                  <th className="py-3 pr-4">Ticker</th>
                  <th className="py-3 pr-4">Side</th>
                  <th className="py-3 pr-4 text-right">Qty</th>
                  <th className="py-3 pr-4 text-right">Price</th>
                  <th className="py-3 pr-4 text-right">Fee+Tax</th>
                  <th className="py-3 pr-4 text-right">Value</th>
                  <th className="py-3 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {txs.map((t) => (
                  <tr key={t.id} className="border-t border-border/50">
                    <td className="py-3 pr-4 text-muted-foreground">{new Date(t.traded_at).toLocaleDateString("vi-VN")}</td>
                    <td className="py-3 pr-4 font-medium">{t.ticker}</td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${t.side === "buy" ? "bg-[var(--success)]/10 text-[var(--success)]" : "bg-[var(--danger)]/10 text-[var(--danger)]"}`}>
                        {t.side.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right">{fmtQty(Number(t.quantity))}</td>
                    <td className="py-3 pr-4 text-right">{fmt(Number(t.price))}</td>
                    <td className="py-3 pr-4 text-right text-muted-foreground">{fmt(Number(t.fee) + Number(t.tax))}</td>
                    <td className="py-3 pr-4 text-right">{fmt(Number(t.quantity) * Number(t.price))}</td>
                    <td className="py-3 pr-4 text-right">
                      <button className="btn-ghost text-xs hover:!border-[var(--danger)] hover:!text-[var(--danger)]" onClick={() => remove(t.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
