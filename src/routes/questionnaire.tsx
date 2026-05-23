import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { OnboardingProgress } from "@/components/OnboardingProgress";
import { useAuth } from "@/hooks/use-auth";
import { Q_WEIGHTS, SCORE_TO_PCT, QUESTION_META, computeRT, type Questionnaire } from "@/lib/fhs";

export const Route = createFileRoute("/questionnaire")({ component: QPage });

// Index 0 = most aggressive (score 5) → index 4 = most conservative (score 1)
const QUESTION_OPTIONS: Record<keyof Questionnaire, string[]> = {
  q1: ["Under 45 years old", "45 – 55 years old", "56 – 65 years old", "66 – 75 years old", "Older than 75"],
  q2: [
    "At least 20 years from now",
    "In 10 – 20 years",
    "In 5 – 10 years",
    "Not yet, but within the next 5 years",
    "Immediately",
  ],
  q3: [
    "Aggressive growth — I accept large volatility",
    "Significant growth",
    "Moderate growth",
    "Cautious growth",
    "Preserve capital — do not lose money",
  ],
  q4: [
    "Match the broader stock-market return",
    "Slightly trail the market but earn solid profit",
    "Moderate growth",
    "Cautious growth",
    "Largely insulated from equity-market moves",
  ],
  q5: [
    "Accept a loss in a poor decade",
    "Earn almost nothing / break even",
    "Still produce a small gain",
    "Produce a modest gain",
    "Almost unaffected by equity drawdowns",
  ],
  q6: [
    "I don't mind if the portfolio loses value",
    "I can tolerate a loss",
    "I can tolerate a small loss",
    "A loss would be hard to deal with",
    "I need at least to preserve capital",
  ],
  q7: [
    "A few months means nothing to me",
    "I would not worry about short-term losses",
    "A loss greater than 10% would concern me",
    "I can only stomach very small short-term losses",
    "Any short-term loss is very hard to accept",
  ],
};

const SECTION_LABELS: Record<string, string> = {
  "Time horizon": "⏱ Time horizon",
  "Goals": "🎯 Goals",
  "Short-term": "📅 Short-term",
};

const SCORE_LABEL: Record<number, string> = {
  5: "Most aggressive",
  4: "Aggressive",
  3: "Neutral",
  2: "Conservative",
  1: "Most conservative",
};

function QPage() {
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [ans, setAns] = useState<Questionnaire>({ q1: 3, q2: 3, q3: 3, q4: 3, q5: 3, q6: 3, q7: 3 });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) { nav({ to: "/login" }); return; }
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("questionnaire_responses")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setAns({ q1: data.q1, q2: data.q2, q3: data.q3, q4: data.q4, q5: data.q5, q6: data.q6, q7: data.q7 });
    })();
  }, [user, authLoading, nav]);

  const rtPreview = useMemo(() => computeRT(ans), [ans]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true); setMsg(null);
    const { error } = await supabase.from("questionnaire_responses").upsert({
      user_id: user.id, ...ans, updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) setMsg(error.message);
    else nav({ to: "/dashboard" });
  }

  const sections = Array.from(new Set(QUESTION_META.map((m) => m.section)));

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        <OnboardingProgress current={2} />

        <h1 className="font-display text-4xl">Risk <span className="gold-text">Survey</span></h1>
        <p className="text-muted-foreground mt-2">
          Seven weighted questions used to compute your Risk Tolerance (RT) score, which combines with FHS to determine your Risk Capacity.
        </p>

        {/* Live RT preview */}
        <div className="lux-card p-6 mt-6">
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Current Risk Tolerance (RT)</div>
            <div>
              <span className="font-display text-3xl gold-text">{rtPreview.toFixed(1)}</span>
              <span className="text-sm text-muted-foreground ml-1">/ 100 · live</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="h-2 rounded-full bg-[oklch(0.16_0.02_250)] overflow-hidden">
              <div className="h-full bg-[var(--gold)] transition-all" style={{ width: `${rtPreview}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>Conservative</span>
              <span>Aggressive</span>
            </div>
          </div>
        </div>

        {/* Weight explanation */}
        <div className="lux-card p-5 mt-4">
          <h4 className="text-sm font-medium">Question weights</h4>
          <div className="flex flex-wrap gap-2 mt-3">
            {QUESTION_META.map((m) => (
              <span key={m.id} className="text-[11px] px-2 py-1 rounded-full border border-border bg-[oklch(0.14_0.02_250)]">
                <span className="text-[var(--gold)] font-semibold">{m.id.toUpperCase()}</span>
                <span className="text-muted-foreground ml-1.5">{m.label}</span>
                <span className="ml-1.5">{(Q_WEIGHTS[m.id] * 100).toFixed(0)}%</span>
              </span>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            Q6 (3-year loss tolerance) carries the highest weight (20%) because it is the strongest behavioural predictor.
          </p>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-8">
          {sections.map((section) => {
            const sectionQuestions = QUESTION_META.filter((m) => m.section === section);
            return (
              <div key={section}>
                <h2 className="font-display text-xl mb-3">{SECTION_LABELS[section] ?? section}</h2>
                <div className="space-y-4">
                  {sectionQuestions.map((meta) => {
                    const qIdx = QUESTION_META.indexOf(meta);
                    const options = QUESTION_OPTIONS[meta.id];
                    const weight = Q_WEIGHTS[meta.id];
                    return (
                      <div key={meta.id} className="lux-card p-6">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--gold)]">
                            Q{qIdx + 1} · Weight {(weight * 100).toFixed(0)}%
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--gold)]/40 text-[var(--gold)]">
                            {SCORE_LABEL[ans[meta.id]]}
                          </span>
                        </div>
                        <h3 className="font-display text-lg mt-1">{meta.label}</h3>
                        <div className="mt-4 space-y-2">
                          {options.map((opt, i) => {
                            const score = 5 - i;
                            const checked = ans[meta.id] === score;
                            const contribution = weight * SCORE_TO_PCT[score];
                            return (
                              <label key={i} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                                checked ? "border-[var(--gold)] bg-[var(--gold)]/10" : "border-border hover:bg-accent"
                              }`}>
                                <input
                                  type="radio"
                                  className="accent-[var(--gold)]"
                                  name={meta.id}
                                  checked={checked}
                                  onChange={() => setAns((a) => ({ ...a, [meta.id]: score }))}
                                />
                                <span className="text-sm flex-1">{opt}</span>
                                <span className="text-xs text-muted-foreground tabular-nums">{contribution.toFixed(1)} pts</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {msg && <div className="text-sm text-[var(--danger)]">{msg}</div>}

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm text-muted-foreground">
              Expected RT: <span className="gold-text font-semibold">{rtPreview.toFixed(1)}</span> / 100
            </div>
            <button disabled={saving} className="btn-gold">
              {saving ? "Saving..." : "Save & view Dashboard →"}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
