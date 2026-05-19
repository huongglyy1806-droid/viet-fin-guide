import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/questionnaire")({ component: QPage });

type Q = { id: keyof Answers; title: string; section: string; options: string[] };
type Answers = { q1: number; q2: number; q3: number; q4: number; q5: number; q6: number; q7: number };

// Options are written so index 0 = score 5 (most aggressive), index 4 = score 1
const QUESTIONS: Q[] = [
  { id: "q1", section: "Time horizon", title: "What is your current age?",
    options: ["Less than 45", "45 to 55", "56 to 65", "66 to 75", "Older than 75"] },
  { id: "q2", section: "Time horizon", title: "When do you expect to start drawing income?",
    options: ["Not for at least 20 years", "In 10 to 20 years", "In 5 to 10 years", "Not now, but within 5 years", "Immediately"] },
  { id: "q3", section: "Goals", title: "What is your goal for this investment?",
    options: ["To grow aggressively", "To grow significantly", "To grow moderately", "To grow with caution", "To avoid losing value"] },
  { id: "q4", section: "Goals", title: "Under normal market conditions, what would you expect?",
    options: ["To generally keep pace with the stock market", "To slightly trail the stock market and make good profits", "To grow moderately", "To grow with caution", "To avoid losing value"] },
  { id: "q5", section: "Goals", title: "If stocks perform very poorly over the next decade, what would you expect?",
    options: ["To lose value", "To make very little or nothing", "To make a small gain", "To make a modest gain", "To be affected little by the stock market"] },
  { id: "q6", section: "Short-term", title: "Your attitude about the next three years' performance?",
    options: ["I don't mind if I lose value", "I can tolerate a loss", "I can tolerate a small loss", "I'd have a hard time dealing with a loss", "I need to see at least a little return"] },
  { id: "q7", section: "Short-term", title: "Your attitude about the next few months' performance?",
    options: ["Three months means nothing to me", "I wouldn't worry about losses in that time frame", "A loss of more than 10% would concern me", "I can only tolerate small short-term losses", "I would have a hard time stomaching any losses"] },
];

function QPage() {
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [ans, setAns] = useState<Answers>({ q1: 3, q2: 3, q3: 3, q4: 3, q5: 3, q6: 3, q7: 3 });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) { nav({ to: "/login" }); return; }
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("questionnaire_responses").select("*").eq("user_id", user.id).maybeSingle();
      if (data) setAns({ q1: data.q1, q2: data.q2, q3: data.q3, q4: data.q4, q5: data.q5, q6: data.q6, q7: data.q7 });
    })();
  }, [user, authLoading, nav]);

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

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        <h1 className="font-display text-4xl">Risk <span className="gold-text">Survey</span></h1>
        <p className="text-muted-foreground mt-2">Seven questions. Used to compute your Risk Tolerance score.</p>
        <form onSubmit={submit} className="mt-8 space-y-5">
          {QUESTIONS.map((q, idx) => (
            <div key={q.id} className="lux-card p-6">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--gold)]">{q.section} · Q{idx + 1}</div>
              <h3 className="font-display text-xl mt-1">{q.title}</h3>
              <div className="mt-4 space-y-2">
                {q.options.map((opt, i) => {
                  const score = 5 - i;
                  const checked = ans[q.id] === score;
                  return (
                    <label key={i} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      checked ? "border-[var(--gold)] bg-[var(--gold)]/10" : "border-border hover:bg-accent"
                    }`}>
                      <input type="radio" className="accent-[var(--gold)]" name={q.id} checked={checked}
                        onChange={() => setAns((a) => ({ ...a, [q.id]: score }))} />
                      <span className="text-sm flex-1">{opt}</span>
                      <span className="text-xs text-muted-foreground">score {score}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
          {msg && <div className="text-sm text-[var(--danger)]">{msg}</div>}
          <div className="flex justify-end">
            <button disabled={saving} className="btn-gold">{saving ? "Submitting..." : "Submit & view dashboard"}</button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
