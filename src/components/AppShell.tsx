import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/profile", label: "Financial Profile" },
  { to: "/questionnaire", label: "Risk Survey" },
  { to: "/portfolio", label: "Portfolio" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/60 backdrop-blur-xl bg-background/70">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="inline-block w-8 h-8 rounded-full bg-gradient-to-br from-[oklch(0.88_0.08_85)] to-[oklch(0.72_0.14_85)] shadow-[0_0_20px_oklch(0.82_0.13_85/0.5)]" />
            <span className="font-display text-xl tracking-wide">
              Tài <span className="gold-text">Mệnh</span>
            </span>
          </Link>
          {user && (
            <nav className="hidden md:flex items-center gap-1">
              {NAV.map((n) => {
                const active = path === n.to;
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    className={`px-4 py-2 rounded-full text-sm transition-colors ${
                      active ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {n.label}
                  </Link>
                );
              })}
            </nav>
          )}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <span className="hidden sm:block text-xs text-muted-foreground truncate max-w-[180px]">{user.email}</span>
                <button onClick={async () => { await signOut(); nav({ to: "/login" }); }} className="btn-ghost text-sm">
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-ghost text-sm">Sign in</Link>
                <Link to="/signup" className="btn-gold text-sm">Get started</Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-10">{children}</main>
      <footer className="mx-auto max-w-7xl px-6 py-10 text-xs text-muted-foreground border-t border-border/40 mt-12">
        Tài Mệnh — AI Financial Portfolio Management for Vietnam. Built on the FHS, Risk Capacity, and AI Allocation framework.
      </footer>
    </div>
  );
}
