import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { CATEGORY_LABEL, computeFHS, computeRisk, recommendAllocation, type FinancialProfile, type Questionnaire } from "@/lib/fhs";

export const Route = createFileRoute("/portfolio")({ component: PortfolioPage });

type Holding = { id: string; category: "cash" | "gold" | "stock" | "bond_fund"; name: string; amount: number; created_at: string };
const CATS: Array<Holding["category"]> = ["cash", "gold", "stock", "bond_fund"];
const COLORS: Record<string, string> = { stock: "var(--chart-1)", bond_fund: "var(--chart-2)", gold: "var(--chart-3)", cash: "var(--chart-4)" };
const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " ₫";

function PortfolioPage() {
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [fp, setFp] = useState<FinancialProfile | null>(null);
  const [q, setQ] = useState<Questionnaire | null>(null);
  const [loading, setLoading] = useState(true);

  // form state (add)
  const [category, setCategory] = useState<Holding["category"]>("stock");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

  // edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");

  async function load() {
    if (!user) return;
    const [hRes, fpRes, qRes] = await Promise.all([
      supabase.from("holdings").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("financial_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("questionnaire_responses").select("*").eq("user_id", user.id).maybeSingle(),
    ]);
    setHoldings((hRes.data ?? []) as Holding[]);
    if (fpRes.data) setFp(fpRes.data as FinancialProfile);
    if (qRes.data) setQ(qRes.data as Questionnaire);
    setLoading(false);
  }

  useEffect(() => {
    if (!authLoading && !user) { nav({ to: "/login" }); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  async function addHolding(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const amt = Number(amount);
    if (!name.trim() || !(amt >= 0)) return;
    const { error } = await supabase.from("holdings").insert({
      user_id: user.id, category, name: name.trim(), amount: amt,
    });
    if (!error) { setName(""); setAmount(""); load(); }
  }
  async function saveEdit(id: string) {
    const amt = Number(editAmount);
    await supabase.from("holdings").update({ name: editName.trim(), amount: amt }).eq("id", id);
    setEditId(null); load();
  }
  async function remove(id: string) {
    await supabase.from("holdings").delete().eq("id", id);
    load();
  }

  const actual = useMemo(() => {
    const sums: Record<string, number> = { cash: 0, gold: 0, stock: 0, bond_fund: 0 };
    holdings.forEach((h) => { sums[h.category] += Number(h.amount); });
    const total = CATS.reduce((s, c) => s + sums[c], 0);
    const pct: Record<string, number> = {};
    CATS.forEach((c) => pct[c] = total > 0 ? (sums[c] / total) * 100 : 0);
    return { sums, total, pct };
  }, [holdings]);

  const fhs = useMemo(() => fp ? computeFHS(fp) : null, [fp]);
  const risk = useMemo(() => (fp && q && fhs) ? computeRisk(fp, q, fhs) : null, [fp, q, fhs]);
  const recAlloc = useMemo(() => risk ? recommendAllocation(risk.RiskCapacity) : null, [risk]);
  const recMap = recAlloc ? { stock: recAlloc.stock, bond_fund: recAlloc.bond_fund, gold: recAlloc.gold, cash: recAlloc.cash } : null;

  if (loading) return <AppShell><div className="p-10 text-muted-foreground">Loading...</div></AppShell>;

  return (
    <AppShell>
      <h1 className="font-display text-4xl">Portfolio <span className="gold-text">Management</span></h1>
      <p className="text-muted-foreground mt-2">Track Cash · Gold · Stocks · Bonds & Funds. Compare with AI-recommended allocation.</p>

      <section className="grid lg:grid-cols-4 gap-4 mt-8">
        {CATS.map((c) => (
          <div key={c} className="stat-card">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[c] }} />
              <div className="text-xs uppercase tracking-widest text-muted-foreground">{CATEGORY_LABEL[c]}</div>
            </div>
            <div className="font-display text-xl mt-2">{fmt(actual.sums[c])}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {actual.pct[c].toFixed(1)}%{recMap ? ` · target ${recMap[c]}%` : ""}
            </div>
          </div>
        ))}
      </section>

      <section className="grid lg:grid-cols-5 gap-6 mt-6">
        <div className="lux-card p-7 lg:col-span-2">
          <h2 className="font-display text-xl">Add an asset</h2>
          <form onSubmit={addHolding} className="mt-5 space-y-4">
            <div>
              <label className="lux-label">Category</label>
              <div className="grid grid-cols-2 gap-2">
                {CATS.map((c) => (
                  <button type="button" key={c} onClick={() => setCategory(c)}
                    className={`px-3 py-2 rounded-xl text-sm border transition-colors ${
                      category === c ? "border-[var(--gold)] bg-[var(--gold)]/10" : "border-border hover:bg-accent"
                    }`}>
                    {CATEGORY_LABEL[c]}
                  </button>
                ))}
              </div>
            </div>
            <div><label className="lux-label">Asset name</label>
              <input className="lux-input" placeholder="e.g. VCB, SJC gold, TCBF fund" value={name} onChange={(e) => setName(e.target.value)} required /></div>
            <div><label className="lux-label">Amount (₫)</label>
              <input className="lux-input" type="number" min={0} step="any" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
            <button className="btn-gold w-full">Add to portfolio</button>
          </form>
        </div>

        <div className="lux-card p-7 lg:col-span-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xl">Allocation vs AI target</h2>
            <div className="text-sm text-muted-foreground">Total: <span className="text-foreground">{fmt(actual.total)}</span></div>
          </div>
          {!recMap && <p className="text-sm text-muted-foreground mt-4">Complete your profile and survey to see AI targets.</p>}
          <div className="mt-5 space-y-4">
            {CATS.map((c) => {
              const a = actual.pct[c] || 0;
              const r = recMap ? recMap[c] : 0;
              const drift = a - r;
              return (
                <div key={c}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{CATEGORY_LABEL[c]}</span>
                    <span className="text-muted-foreground">
                      <span className="text-foreground">{a.toFixed(1)}%</span>
                      {recMap && <> · target {r}% · <span className={drift >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}>{drift >= 0 ? "+" : ""}{drift.toFixed(1)}%</span></>}
                    </span>
                  </div>
                  <div className="relative h-2.5 rounded-full bg-[oklch(0.16_0.02_250)] overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, a)}%`, background: COLORS[c] }} />
                    {recMap && <div className="absolute top-0 bottom-0 w-0.5 bg-[var(--gold)]" style={{ left: `${r}%` }} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="lux-card p-7 mt-6">
        <h2 className="font-display text-xl">Holdings & history</h2>
        {holdings.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-3">No holdings yet. Add your first asset above.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-widest text-muted-foreground">
                  <th className="py-3 pr-4">Date</th>
                  <th className="py-3 pr-4">Category</th>
                  <th className="py-3 pr-4">Name</th>
                  <th className="py-3 pr-4 text-right">Amount</th>
                  <th className="py-3 pr-4 text-right">% of portfolio</th>
                  <th className="py-3 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => {
                  const pct = actual.total > 0 ? (Number(h.amount) / actual.total) * 100 : 0;
                  const isEdit = editId === h.id;
                  return (
                    <tr key={h.id} className="border-t border-border/50">
                      <td className="py-3 pr-4 text-muted-foreground">{new Date(h.created_at).toLocaleDateString("vi-VN")}</td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: COLORS[h.category] }} />
                          {CATEGORY_LABEL[h.category]}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        {isEdit
                          ? <input className="lux-input" value={editName} onChange={(e) => setEditName(e.target.value)} />
                          : h.name}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        {isEdit
                          ? <input className="lux-input text-right" type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
                          : fmt(Number(h.amount))}
                      </td>
                      <td className="py-3 pr-4 text-right text-muted-foreground">{pct.toFixed(1)}%</td>
                      <td className="py-3 pr-4 text-right">
                        {isEdit ? (
                          <div className="flex gap-2 justify-end">
                            <button className="btn-gold text-xs" onClick={() => saveEdit(h.id)}>Save</button>
                            <button className="btn-ghost text-xs" onClick={() => setEditId(null)}>Cancel</button>
                          </div>
                        ) : (
                          <div className="flex gap-2 justify-end">
                            <button className="btn-ghost text-xs" onClick={() => { setEditId(h.id); setEditName(h.name); setEditAmount(String(h.amount)); }}>Edit</button>
                            <button className="btn-ghost text-xs hover:!border-[var(--danger)] hover:!text-[var(--danger)]" onClick={() => remove(h.id)}>Delete</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
