import { Link } from "@tanstack/react-router";

type Step = { id: number; label: string; to: string };
const STEPS: Step[] = [
  { id: 1, label: "Financial Profile", to: "/profile" },
  { id: 2, label: "Risk Survey", to: "/questionnaire" },
  { id: 3, label: "Dashboard", to: "/dashboard" },
];

export function OnboardingProgress({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div className="lux-card p-5 mb-8">
      <div className="flex items-center justify-between gap-4">
        {STEPS.map((s, i) => {
          const done = current > s.id;
          const active = current === s.id;
          return (
            <div key={s.id} className="flex items-center flex-1">
              <Link
                to={s.to}
                className={`flex items-center gap-3 ${active ? "" : "opacity-90"}`}
              >
                <span
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-display border transition-colors ${
                    done
                      ? "bg-[var(--gold)]/20 border-[var(--gold)] text-[var(--gold)]"
                      : active
                      ? "bg-[var(--gold)] border-[var(--gold)] text-background"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {done ? "✓" : s.id}
                </span>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Step {s.id} / 3</div>
                  <div className={`text-sm ${active ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</div>
                </div>
              </Link>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-4 ${current > s.id ? "bg-[var(--gold)]/60" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
