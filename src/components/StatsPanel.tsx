"use client";

import {
  formatPercent,
  formatTHB,
  topConcentration,
  totals,
} from "@/lib/portfolio";
import type { CityState, DistrictId } from "@/lib/types";
import type { CityView } from "./Sidebar";

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

  return (
    <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
      <Card
        icon="🧱"
        label="เงินที่ลงไปแล้ว"
        value={formatTHB(t.invested)}
        note="ความสูงรวมของเมือง"
        tone="accent"
      />
      <Card
        icon="📈"
        label="มูลค่าตลาดตอนนี้"
        value={formatTHB(t.marketValue)}
        note="ขยับทุกวัน"
      />
      <Card
        icon={t.pnl >= 0 ? "☀️" : "🌙"}
        label="กำไร / ขาดทุน (฿)"
        value={formatPercent(t.pnlRatio)}
        note={`${t.pnl >= 0 ? "+" : "−"}${formatTHB(Math.abs(t.pnl)).slice(1)} · รวมค่าเงิน`}
        tone={t.pnl >= 0 ? "gain" : "loss"}
      />
      <Card
        icon="🏢"
        label="ตึกในเมือง"
        value={String(t.towerCount)}
        note="บริษัทที่เป็นเจ้าของ"
      />
      <Card
        icon="🗼"
        label="ตึกที่ใหญ่ที่สุด"
        value={top ? `${top.label} ${(top.share * 100).toFixed(0)}%` : "—"}
        note="กินพื้นที่เมืองเท่านี้"
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
