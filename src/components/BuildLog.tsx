"use client";

import { RECENT_DAYS, summarize } from "@/lib/contributions";
import { formatTHB } from "@/lib/portfolio";
import type { CityState } from "@/lib/types";
import { plural } from "@/lib/text";

/**
 * Build report — answers "what did I just do?"
 *
 * The other stats only answer "where am I now?", where a ฿4,000 top-up shows
 * up as roughly 1% every time. This one deliberately counts a different unit:
 * number of times you acted, which never gets diluted as the portfolio grows.
 */
export function BuildLog({ state }: { state: CityState }) {
  const s = summarize(state.contributions);

  if (s.rounds === 0) {
    return (
      <section className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--panel)] px-3 py-2.5 text-xs text-[var(--label-dim)]">
        🏗️ <span className="font-semibold text-[var(--label)]">No rounds recorded yet</span>{" "}
        — your next buy will be counted automatically
      </section>
    );
  }

  const building = s.recentTHB > 0;

  return (
    <section
      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border px-3 py-2.5 text-xs"
      style={{
        borderColor: building ? "var(--warn-border)" : "var(--border)",
        background: building ? "var(--warn)" : "var(--panel)",
      }}
    >
      {building ? (
        <span className="font-semibold" style={{ color: "var(--warn-fg)" }}>
          🏗️ Under construction — {formatTHB(s.recentTHB)} added to{" "}
          {s.recentTickers.join(" · ")} in the last {RECENT_DAYS} days
        </span>
      ) : (
        <span className="font-semibold text-[var(--label)]">
          🧱 You have built this city over {plural(s.rounds, "round")}
        </span>
      )}

      <Stat label="All rounds" value={`${s.rounds}`} />
      <Stat label="This year" value={`${s.thisYearRounds} · ${formatTHB(s.thisYearTHB)}`} />
      <Stat label="Total added" value={formatTHB(s.totalTHB)} />

      <span className="ml-auto text-[10px] text-[var(--label-dim)]">
        Click a tower for its rounds
      </span>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-[var(--label-dim)]">
      {label}{" "}
      <span className="font-semibold text-[var(--label)] tabular-nums">{value}</span>
    </span>
  );
}
