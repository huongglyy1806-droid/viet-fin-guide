import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setErr(error.message);
    else nav({ to: "/dashboard" });
  }

  return (
    <AppShell>
      <div className="max-w-md mx-auto lux-card p-10 mt-10">
        <h1 className="font-display text-3xl">Welcome back</h1>
        <p className="text-sm text-muted-foreground mt-1">Sign in to your Aurum account.</p>
        <form onSubmit={submit} className="mt-8 space-y-5">
          <div>
            <label className="lux-label">Email</label>
            <input className="lux-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="lux-label">Password</label>
            <input className="lux-input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {err && <div className="text-sm text-[var(--danger)]">{err}</div>}
          <button disabled={loading} className="btn-gold w-full">{loading ? "Signing in..." : "Sign in"}</button>
        </form>
        <div className="mt-6 text-sm text-muted-foreground text-center">
          New here? <Link to="/signup" className="text-[var(--gold)]">Create an account</Link>
        </div>
      </div>
    </AppShell>
  );
}
