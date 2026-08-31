"use client";

import {
  cashTHB,
  formatPercent,
  formatTHB,
  portfolioSummary,
  topConcentration,
  totals,
} from "@/lib/portfolio";
import type { CityState, DistrictId } from "@/lib/types";
import type { CityView } from "./Sidebar";
import { plural } from "@/lib/text";

/** แถบสถิติด้านบน — การ์ดเรียงแนวนอนเต็มความกว้าง */
export function StatsPanel({
  state,
  view,
}: {
  state: CityState;
  view: CityView;
}) {
  const district = view === "all" ? undefined : (view as DistrictId);
  const t = totals(state, district);
  const top = topConcentration(state, district);

  // ยอดรวมทั้งพอร์ต (รวมเงินสด) ใช้ได้เฉพาะตอนดูทั้งเมือง
  // ถ้ากรองเฉพาะเขต เงินสดจะไม่ได้เป็นของเขตนั้น
  const all = view === "all" ? portfolioSummary(state) : null;
  const shownMarket = all ? all.marketTotal : t.marketValue;
  const shownReturn = all ? all.totalReturn : t.pnlRatio;
  const shownPnl = all ? all.marketTotal - all.returnBase : t.pnl;

  return (
    <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
      {/*
        นับเงินสดด้วย — เงินที่โอนเข้าพอร์ตแล้วแต่ยังไม่ได้ซื้อหุ้น ก็คือเงินที่
        เก็บมาได้แล้วเหมือนกัน การยังไม่กลายเป็นหุ้นเป็นเรื่องจังหวะ ไม่ใช่ว่ายังไม่มี
      */}
      <Card
        icon="🧱"
        label="Money in"
        value={formatTHB(all ? all.returnBase : t.invested)}
        note={
          all?.usingDeposits
            ? "Every baht in · incl. cash"
            : all
              ? "Stock cost + cash"
              : "Stock cost in this district"
        }
        tone="accent"
      />
      <Card
        icon="📈"
        label="Portfolio value"
        value={formatTHB(shownMarket)}
        note={all ? "Stocks + cash" : "This district only"}
      />
      <Card
        icon={shownPnl >= 0 ? "☀️" : "🌙"}
        label="Gain / loss (฿)"
        value={formatPercent(shownReturn)}
        note={`${shownPnl >= 0 ? "+" : "−"}${formatTHB(Math.abs(shownPnl)).slice(1)} · ${
          all?.usingDeposits ? "vs total deposits" : "vs stock cost"
        }`}
        tone={shownPnl >= 0 ? "gain" : "loss"}
      />
      <Card
        icon="🏢"
        label="Towers"
        value={String(t.towerCount)}
        note={
          t.landCount > 0
            ? `+ ${plural(t.landCount, "free plot")} · ${plural(t.towerCount + t.landCount, "holding")}`
            : `${plural(t.towerCount, "holding")} you own`
        }
      />
      <Card
        icon="🚧"
        label="Cash on hand"
        value={formatTHB(cashTHB(state))}
        note="Build sites · not height"
      />
      <Card
        icon="🗼"
        label="Biggest tower"
        value={top ? `${top.label} ${(top.share * 100).toFixed(0)}%` : "—"}
        note="Share of the whole city"
        tone="free"
      />
    </section>
  );
}

const TONE: Record<string, string> = {
  accent: "var(--accent)",
  gain: "var(--gain)",
  loss: "var(--loss)",
  free: "var(--free)",
};

function Card({
  icon,
  label,
  value,
  note,
  tone,
}: {
  icon: string;
  label: string;
  value: string;
  note?: string;
  tone?: keyof typeof TONE;
}) {
  const color = tone ? TONE[tone] : "var(--label)";

  return (
    <div
      className="glow-panel relative overflow-hidden rounded-xl bg-[var(--panel)] p-3"
      style={{ borderTop: `2px solid ${color}` }}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-xs">{icon}</span>
        <p className="truncate text-[10px] tracking-wide text-[var(--label-dim)] uppercase">
          {label}
        </p>
      </div>
      <p
        className="mt-1 font-mono text-xl leading-tight font-semibold"
        style={{ color }}
      >
        {value}
      </p>
      {note && (
        <p className="mt-0.5 truncate text-[10px] text-[var(--label-dim)]">{note}</p>
      )}
    </div>
  );
}
