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

/** Stat strip at the top — cards laid out horizontally across the full width */
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

  // Whole-portfolio totals (including cash) only make sense for the whole city —
  // when filtered to one district, the cash doesn't belong to that district
  const all = view === "all" ? portfolioSummary(state) : null;
  const shownMarket = all ? all.marketTotal : t.marketValue;
  const shownReturn = all ? all.totalReturn : t.pnlRatio;
  const shownPnl = all ? all.marketTotal - all.returnBase : t.pnl;

  return (
    <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
      {/*
        Includes cash — money already moved into the portfolio but not yet invested has
        still been saved. Not being shares yet is a matter of timing, not of not having it.
      */}
      <Card
        icon="🧱"
        label="Money in"
        value={formatTHB(all ? all.returnBase : t.invested)}
        note={
          all?.usingDeposits
            ? "incl. cash"
            : all
              ? "stock cost + cash"
              : "stock cost here"
        }
        tone="accent"
      />
      <Card
        icon="📈"
        label="Portfolio value"
        value={formatTHB(shownMarket)}
      />
      <Card
        icon={shownPnl >= 0 ? "☀️" : "🌙"}
        label="Gain / loss (฿)"
        value={formatPercent(shownReturn)}
        note={`${shownPnl >= 0 ? "+" : "−"}${formatTHB(Math.abs(shownPnl)).slice(1)} · ${
          all?.usingDeposits ? "vs deposits" : "vs cost"
        }`}
        tone={shownPnl >= 0 ? "gain" : "loss"}
      />
      <Card
        icon="🏢"
        label="Towers"
        value={String(t.towerCount)}
        note={
          t.landCount > 0
            ? `+ ${plural(t.landCount, "free plot")}`
            : "companies you own"
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
