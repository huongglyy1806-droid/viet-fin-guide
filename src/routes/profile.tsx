import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/profile")({ component: ProfilePage });

type Form = {
  monthly_income: string; monthly_expenses: string; monthly_debt_payment: string;
  total_assets: string; emergency_fund: string; cash_liquid: string; investment_horizon_years: string;
};
const EMPTY: Form = {
  monthly_income: "", monthly_expenses: "", monthly_debt_payment: "",
  total_assets: "", emergency_fund: "", cash_liquid: "", investment_horizon_years: "5",
};

function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState<Form>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) { nav({ to: "/login" }); return; }
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("financial_profiles").select("*").eq("user_id", user.id).maybeSingle();
      if (data) {
        setForm({
          monthly_income: String(data.monthly_income ?? ""),
          monthly_expenses: String(data.monthly_expenses ?? ""),
          monthly_debt_payment: String(data.monthly_debt_payment ?? ""),
          total_assets: String(data.total_assets ?? ""),
          emergency_fund: String(data.emergency_fund ?? ""),
          cash_liquid: String(data.cash_liquid ?? ""),
          investment_horizon_years: String(data.investment_horizon_years ?? 5),
        });
      }
      setLoading(false);
    })();
  }, [user, authLoading, nav]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true); setMsg(null);
    const payload = {
      user_id: user.id,
      monthly_income: Number(form.monthly_income) || 0,
      monthly_expenses: Number(form.monthly_expenses) || 0,
      monthly_debt_payment: Number(form.monthly_debt_payment) || 0,
      total_assets: Number(form.total_assets) || 0,
      emergency_fund: Number(form.emergency_fund) || 0,
      cash_liquid: Number(form.cash_liquid) || 0,
      investment_horizon_years: Number(form.investment_horizon_years) || 0,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("financial_profiles").upsert(payload);
    setSaving(false);
    if (error) setMsg(error.message);
    else { setMsg("Saved."); setTimeout(() => nav({ to: "/questionnaire" }), 500); }
  }

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  if (loading) return <AppShell><div className="p-10 text-muted-foreground">Loading...</div></AppShell>;

  const FIELDS: Array<[keyof Form, string, string]> = [
    ["monthly_income", "Monthly Income", "₫ / month"],
    ["monthly_expenses", "Monthly Expenses", "₫ / month"],
    ["monthly_debt_payment", "Monthly Debt Payment", "₫ / month"],
    ["total_assets", "Total Assets", "₫"],
    ["emergency_fund", "Emergency Fund", "₫"],
    ["cash_liquid", "Cash & Liquid Assets", "₫"],
    ["investment_horizon_years", "Investment Horizon", "years"],
  ];

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto">
        <h1 className="font-display text-4xl">Financial <span className="gold-text">Profile</span></h1>
        <p className="text-muted-foreground mt-2 max-w-xl">
          Inputs feed directly into your Financial Health Score and AI portfolio recommendation. All amounts in Vietnamese Dong.
        </p>
        <form onSubmit={save} className="lux-card p-8 mt-8 grid md:grid-cols-2 gap-6">
          {FIELDS.map(([k, label, unit]) => (
            <div key={k}>
              <label className="lux-label">{label} <span className="text-[var(--muted-foreground)] normal-case tracking-normal">({unit})</span></label>
              <input className="lux-input" type="number" min={0} step="any" value={form[k]} onChange={set(k)} required />
            </div>
          ))}
          <div className="md:col-span-2 flex items-center justify-between pt-2">
            {msg && <div className="text-sm text-[var(--gold)]">{msg}</div>}
            <button disabled={saving} className="btn-gold ml-auto">{saving ? "Saving..." : "Save & continue"}</button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
