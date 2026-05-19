import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => { if (!loading && user) nav({ to: "/dashboard" }); }, [user, loading, nav]);

  return (
    <AppShell>
      <section className="grid lg:grid-cols-2 gap-12 items-center py-10">
        <div>
          <span className="inline-block text-xs tracking-[0.25em] uppercase text-[var(--gold)] mb-6">
            AI Portfolio · Vietnam
          </span>
          <h1 className="font-display text-5xl md:text-6xl leading-[1.05]">
            Quản lý <span className="gold-text">tài sản</span> như một
            <br /> private bank.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl">
            Tài Mệnh đánh giá sức khỏe tài chính, khả năng chấp nhận rủi ro và đề
            xuất phân bổ danh mục đầu tư tối ưu theo mô hình FHS — được thiết kế
            riêng cho hành vi tài chính Việt Nam.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/signup" className="btn-gold">Bắt đầu miễn phí</Link>
            <Link to="/login" className="btn-ghost">Đăng nhập</Link>
          </div>
          <div className="mt-10 grid grid-cols-3 gap-4 max-w-md">
            {[
              ["FHS", "Sức khỏe tài chính"],
              ["RC", "Khả năng rủi ro"],
              ["AI", "Phân bổ tối ưu"],
            ].map(([k, v]) => (
              <div key={k} className="stat-card text-center">
                <div className="font-display text-2xl gold-text">{k}</div>
                <div className="text-xs text-muted-foreground mt-1">{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="lux-card p-8 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-[var(--gold)] opacity-10 blur-3xl" />
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Portfolio Snapshot</div>
          <div className="mt-2 font-display text-4xl">2,847,000,000 ₫</div>
          <div className="text-sm text-[var(--success)] mt-1">▲ 12.4% YTD</div>
          <div className="mt-8 space-y-3">
            {[
              ["Stocks", 55, "var(--chart-1)"],
              ["Bonds & Funds", 25, "var(--chart-2)"],
              ["Gold", 12, "var(--chart-3)"],
              ["Cash", 8, "var(--chart-4)"],
            ].map(([label, pct, color]) => (
              <div key={label as string}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">{label}</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-[oklch(0.16_0.02_250)] overflow-hidden">
                  <div style={{ width: `${pct}%`, background: color as string }} className="h-full rounded-full" />
                </div>
              </div>
            ))}
          </div>
          <div className="divider-gold my-6" />
          <div className="text-xs text-muted-foreground">AI Recommended · Moderate-High Growth</div>
        </div>
      </section>

      <section className="mt-20 grid md:grid-cols-3 gap-6">
        {[
          { t: "Financial Health Score", d: "Saving Rate, DTI, Emergency Fund, and Asset Ratio — combined into a single FHS score from 0–100." },
          { t: "Risk Capacity Engine", d: "7-question behavioural survey × financial capacity, hard-capped and mapped to 5 risk profiles." },
          { t: "AI Allocation", d: "Automatic Cash / Gold / Stock / Bond & Fund split, calibrated for Vietnamese investors." },
        ].map((x) => (
          <div key={x.t} className="lux-card p-7">
            <div className="w-10 h-10 rounded-xl bg-[var(--gold)]/15 flex items-center justify-center mb-4">
              <span className="w-2 h-2 rounded-full bg-[var(--gold)]" />
            </div>
            <h3 className="font-display text-xl">{x.t}</h3>
            <p className="text-sm text-muted-foreground mt-2">{x.d}</p>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
