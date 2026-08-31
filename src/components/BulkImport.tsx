"use client";

import { useMemo, useState } from "react";
import { parseHoldingsTable, SAMPLE_TABLE } from "@/lib/importCsv";
import { formatTHB, investedTHB } from "@/lib/portfolio";
import type { CityState, Holding } from "@/lib/types";

/** Paste table from sheetทีเดียวจบ — ไม่ต้องกรอกทีละตัว 15 รอบ */
export function BulkImport({
  state,
  onImport,
}: {
  state: CityState;
  onImport: (holdings: Holding[], replace: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [replace, setReplace] = useState(true);

  const rows = useMemo(() => (text.trim() ? parseHoldingsTable(text) : []), [text]);
  const good = rows.filter((r) => r.ok);
  const bad = rows.filter((r) => !r.ok);

  const preview = good.map((r) => r.holding);
  const previewTotal = preview.reduce(
    (sum, h) => sum + investedTHB(h, state.fxRate),
    0,
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--label-dim)] transition hover:border-[var(--accent)] hover:text-[var(--label)]"
      >
        Paste table from sheet
      </button>
    );
  }

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3">
      <div className="flex items-center gap-2">
        <h2 className="text-[10px] font-semibold tracking-wide text-[var(--label-dim)] uppercase">
          Paste table from sheet
        </h2>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setText("");
          }}
          className="ml-auto rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--label-dim)]"
        >
          Close
        </button>
      </div>

      <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--label-dim)]">
        One per line:{" "}
        <span className="text-[var(--label)]">
          ticker, shares, cost/share, price now, currency, district
        </span>
        <br />
        First three are required, the rest are optional (defaults: USD · Mission)
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={SAMPLE_TABLE}
        rows={6}
        className="mt-2 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--input)] p-2 font-mono text-[11px] text-[var(--label)] placeholder:text-[var(--label-dim)]/45"
      />

      {rows.length > 0 && (
        <div className="mt-2 space-y-1 text-[10.5px]">
          <p className="text-[var(--label-dim)]">
            Parsed <span className="text-[var(--gain)]">{good.length} towers</span>
            {good.length > 0 && ` · ${formatTHB(previewTotal)} invested`}
          </p>
          {bad.map((r) =>
            r.ok ? null : (
              <p key={r.line} className="text-[var(--loss)]">
                Line {r.line}: {r.reason} — “{r.text.slice(0, 40)}”
              </p>
            ),
          )}
        </div>
      )}

      <label className="mt-2 flex items-center gap-2 text-[10.5px] text-[var(--label-dim)]">
        <input
          type="checkbox"
          checked={replace}
          onChange={(e) => setReplace(e.target.checked)}
          className="accent-[var(--accent)]"
        />
        Replace all existing towers (unchecked = append)
      </label>

      <button
        type="button"
        disabled={good.length === 0}
        onClick={() => {
          onImport(preview, replace);
          setText("");
          setOpen(false);
        }}
        className="mt-2 w-full rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-medium text-[var(--accent-fg)] transition disabled:cursor-not-allowed disabled:opacity-40"
      >
        Build {good.length} towers
      </button>
    </section>
  );
}
