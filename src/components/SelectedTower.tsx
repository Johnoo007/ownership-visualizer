"use client";

import {
  formatPercent,
  formatShares,
  formatTHB,
  hasRealTHBCost,
  investedTHB,
  isFreeHolding,
  marketValueTHB,
  pnlRatio,
  totals,
} from "@/lib/portfolio";
import { contributionsFor } from "@/lib/contributions";
import { DISTRICTS, type CityState, type Contribution, type Holding } from "@/lib/types";
import { plural, pluralize } from "@/lib/text";

/** Summary card for the selected tower — appears at the top of the right panel */
export function SelectedTower({
  state,
  holding,
  onEdit,
  onRemove,
  onClose,
}: {
  state: CityState;
  holding: Holding;
  onEdit: (h: Holding) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}) {
  const invested = investedTHB(holding, state.fxRate);
  const market = marketValueTHB(holding, state.fxRate);
  const ratio = pnlRatio(holding);
  const free = isFreeHolding(holding);
  const cityInvested = totals(state).invested;
  const share = cityInvested > 0 ? invested / cityInvested : 0;
  const meta = DISTRICTS[holding.district];

  const tone = free
    ? "var(--free)"
    : (ratio ?? 0) >= 0
      ? "var(--gain)"
      : "var(--loss)";

  return (
    <section
      className="glow-panel rounded-xl bg-[var(--panel)] p-3"
      style={{ borderTop: `2px solid ${tone}` }}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] tracking-wide text-[var(--label-dim)] uppercase">
            Selected tower
          </p>
          <div className="flex items-baseline gap-2">
            <h2 className="font-mono text-lg font-bold text-[var(--label)]">
              {holding.ticker}
            </h2>
            <span className="truncate text-[11px] text-[var(--label-dim)]">
              {holding.name}
            </span>
          </div>
          <p className="mt-0.5 text-[10px] text-[var(--label-dim)]">
            {meta?.label} · {holding.currency}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--label-dim)] transition hover:border-[var(--accent)] hover:text-[var(--label)]"
        >
          Close
        </button>
      </div>

      <div className="mt-2.5 rounded-lg border border-[var(--border)] bg-[var(--panel-raised)] p-2.5">
        <p className="text-[10px] text-[var(--label-dim)]">This tower&rsquo;s height comes from</p>
        <p className="font-mono text-xl font-semibold text-[var(--label)]">
          {formatTHB(invested)}
        </p>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--input)]">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.max(2, share * 100).toFixed(1)}%`,
              background: "var(--accent)",
            }}
          />
        </div>
        <p className="mt-1 text-[10px] text-[var(--label-dim)]">
          {(share * 100).toFixed(1)}% of the whole city
        </p>
        {/* Make it clear whether this is the baht actually paid, or an estimate at today's FX */}
        <p className="mt-1 text-[10px]" style={{ color: hasRealTHBCost(holding) ? "var(--gain)" : "var(--free)" }}>
          {hasRealTHBCost(holding)
            ? "✓ actual baht paid"
            : holding.currency === "USD"
              ? `≈ converted from USD at ${state.fxRate}`
              : "baht directly"}
        </p>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
        <Row label="Floors" value={`${formatShares(holding.shares)} ${pluralize(holding.shares, "share")}`} />
        <Row
          label={`Light level (${holding.currency})`}
          value={free ? "free" : formatPercent(ratio)}
          color={tone}
        />
        <Row label="Market value" value={formatTHB(market)} />
        <Row
          label="Gain / loss"
          value={`${market - invested >= 0 ? "+" : "−"}${formatTHB(Math.abs(market - invested)).slice(1)}`}
          color={tone}
        />
        <Row
          label="Avg cost"
          value={free ? "0 (free)" : `${holding.avgCost} ${holding.currency}`}
        />
        <Row
          label="Price now"
          value={`${holding.currentPrice} ${holding.currency}`}
        />
      </dl>

      <BuildHistory
        list={contributionsFor(state.contributions, holding.ticker)}
        invested={invested}
      />

      <div className="mt-2.5 flex gap-2">
        <button
          type="button"
          onClick={() => onEdit(holding)}
          className="flex-1 rounded-lg border border-[var(--border-bright)] px-3 py-1.5 text-xs text-[var(--label)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          Edit this tower
        </button>
        <button
          type="button"
          onClick={() => onRemove(holding.id)}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--loss)] transition hover:border-[var(--loss)]"
        >
          Demolish
        </button>
      </div>
    </section>
  );
}

/**
 * DCA history for this tower — only shown when the tower is clicked.
 *
 * Deliberately not drawn in the city: a tally stuck to the side of each tower was
 * tried and didn't work — a chart in the wrong world, and it looked like the floor
 * lines (= share count). In a data panel a chart belongs, and dates/amounts fit.
 */
function BuildHistory({
  list,
  invested,
}: {
  list: Contribution[];
  invested: number;
}) {
  if (list.length === 0) {
    return (
      <p className="mt-2.5 rounded-lg border border-dashed border-[var(--border)] px-2.5 py-2 text-[10px] text-[var(--label-dim)]">
        🧱 No rounds recorded for this one yet — the next buy will be counted automatically
      </p>
    );
  }

  // Newest first — reading top to bottom goes back in time
  const rows = [...list].reverse();
  const shown = rows.slice(0, 8);
  const max = Math.max(...list.map((c) => c.amountTHB));
  const total = list.reduce((a, c) => a + c.amountTHB, 0);

  return (
    <div className="mt-2.5 rounded-lg border border-[var(--border)] bg-[var(--panel-raised)] p-2.5">
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] text-[var(--label-dim)]">Rounds put into this one</p>
        <p className="font-mono text-[11px] font-semibold text-[var(--label)]">
          {plural(list.length, "round")} · {formatTHB(total)}
        </p>
      </div>

      <ul className="mt-1.5 space-y-1">
        {shown.map((c, i) => (
          <li key={`${c.at}-${i}`} className="flex items-center gap-2 text-[10px]">
            <span className="w-16 shrink-0 font-mono text-[var(--label-dim)]">
              {formatThaiDate(c.at)}
            </span>
            <span className="h-2 flex-1 overflow-hidden rounded-sm bg-[var(--input)]">
              <span
                className="block h-full rounded-sm"
                style={{
                  width: `${Math.max(6, (c.amountTHB / max) * 100).toFixed(0)}%`,
                  background: i === 0 ? "var(--free)" : "var(--accent)",
                }}
              />
            </span>
            <span className="w-16 shrink-0 text-right font-mono tabular-nums text-[var(--label)]">
              {formatTHB(c.amountTHB)}
            </span>
          </li>
        ))}
      </ul>

      {rows.length > shown.length && (
        <p className="mt-1.5 text-[10px] text-[var(--label-dim)]">
          + {plural(rows.length - shown.length, "earlier round")}
        </p>
      )}

      {/* The part that existed before tracking started — not zero, just no history */}
      {invested > total + 1 && (
        <p className="mt-1.5 border-t border-[var(--border)] pt-1.5 text-[10px] text-[var(--label-dim)]">
          {formatTHB(invested - total)} more was already there before tracking started
        </p>
      )}
    </div>
  );
}

function formatThaiDate(at: string): string {
  const d = new Date(`${at}T00:00:00`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });
}

function Row({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-[var(--label-dim)]">{label}</dt>
      <dd
        className="truncate font-mono text-[11px]"
        style={{ color: color ?? "var(--label)" }}
      >
        {value}
      </dd>
    </div>
  );
}
