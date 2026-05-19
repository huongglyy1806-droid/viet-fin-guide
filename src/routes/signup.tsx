import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/signup")({ component: SignupPage });

function SignupPage() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null); setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        data: { display_name: name },
      },
    });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    if (data.user) {
      // Best-effort profile insert (RLS will permit only own row)
      await supabase.from("profiles").upsert({ user_id: data.user.id, display_name: name });
    }
    if (data.session) nav({ to: "/profile" });
    else setMsg("Check your email to confirm your account, then sign in.");
  }

  return (
    <AppShell>
      <div className="max-w-md mx-auto lux-card p-10 mt-10">
        <h1 className="font-display text-3xl">Create your account</h1>
        <p className="text-sm text-muted-foreground mt-1">Start managing your portfolio in minutes.</p>
        <form onSubmit={submit} className="mt-8 space-y-5">
          <div><label className="lux-label">Display name</label>
            <input className="lux-input" required value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><label className="lux-label">Email</label>
            <input className="lux-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><label className="lux-label">Password</label>
            <input className="lux-input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          {err && <div className="text-sm text-[var(--danger)]">{err}</div>}
          {msg && <div className="text-sm text-[var(--success)]">{msg}</div>}
          <button disabled={loading} className="btn-gold w-full">{loading ? "Creating..." : "Create account"}</button>
        </form>
        <div className="mt-6 text-sm text-muted-foreground text-center">
          Already a member? <Link to="/login" className="text-[var(--gold)]">Sign in</Link>
        </div>
      </div>
    </AppShell>
  );
}
