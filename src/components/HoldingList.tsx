"use client";

import {
  formatPercent,
  formatShares,
  formatTHB,
  investedTHB,
  isFreeHolding,
  pnlRatio,
} from "@/lib/portfolio";
import type { CityState, Holding } from "@/lib/types";

export function HoldingList({
  state,
  selectedId,
  onSelect,
  onEdit,
  onRemove,
}: {
  state: CityState;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onEdit: (h: Holding) => void;
  onRemove: (id: string) => void;
}) {
  const rows = [...state.holdings].sort(
    (a, b) => investedTHB(b, state.fxRate) - investedTHB(a, state.fxRate),
  );

  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-[var(--label-dim)]">
        ยังไม่มีตึก — เพิ่มตัวแรกด้านบน
      </p>
    );
  }

  return (
    <ul className="divide-y divide-[var(--border)]">
      {rows.map((h) => {
        const ratio = pnlRatio(h, state.fxRate);
        const free = isFreeHolding(h);
        const selected = h.id === selectedId;

        return (
          <li
            key={h.id}
            onClick={() => onSelect(selected ? null : h.id)}
            className={`cursor-pointer px-2 py-2 transition ${
              selected ? "bg-[var(--accent)]/10" : "hover:bg-[var(--panel-hover)]"
            }`}
          >
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-sm font-semibold text-[var(--label)]">
                {h.ticker}
              </span>
              <span className="truncate text-[11px] text-[var(--label-dim)]">
                {h.name}
              </span>
              <span
                className="ml-auto font-mono text-xs"
                style={{
                  color: free
                    ? "var(--free)"
                    : (ratio ?? 0) >= 0
                      ? "var(--gain)"
                      : "var(--loss)",
                }}
              >
                {free ? "FREE" : formatPercent(ratio)}
              </span>
            </div>

            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--label-dim)]">
              <span className="font-mono">{formatTHB(investedTHB(h, state.fxRate))}</span>
              <span>·</span>
              <span>{formatShares(h.shares)} หุ้น</span>

              {selected && (
                <span className="ml-auto flex gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(h);
                    }}
                    className="text-[var(--accent)] hover:underline"
                  >
                    แก้
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(h.id);
                    }}
                    className="text-[var(--loss)] hover:underline"
                  >
                    ลบ
                  </button>
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
