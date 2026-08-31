"use client";

import { useState } from "react";
import {
  formatAge,
  priceAgeHours,
  STALE_HOURS,
  syncPrices,
  type SyncResult,
} from "@/lib/quotes";
import type { CityState } from "@/lib/types";

/**
 * แถบความสดของราคา + ปุ่มดึงราคาล่าสุด
 * เหตุผลที่ต้องมี: ถ้าไม่โชว์อายุของข้อมูล ราคาที่ค้างมา 3 เดือนจะทำให้
 * ไฟหน้าต่างและกำไร/ขาดทุนผิดทั้งหมดโดยหน้าจอยังดูปกติดี
 */
export function PriceSync({
  state,
  onSynced,
}: {
  state: CityState;
  onSynced: (next: CityState) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const age = priceAgeHours(state);
  const stale = age === null || age > STALE_HOURS;

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const { next, result: r } = await syncPrices(state);
      onSynced(next);
      setResult(r);
    } catch {
      setError("Could not fetch prices — try again (existing prices are untouched)");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3">
      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: stale ? "var(--loss)" : "var(--gain)" }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] tracking-wide text-[var(--label-dim)] uppercase">
            Market prices
          </p>
          <p
            className="truncate text-xs"
            style={{ color: stale ? "var(--loss)" : "var(--label)" }}
          >
            {formatAge(age)}
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={busy || state.holdings.length === 0 || state.isDemo}
          className="rounded-lg border border-[var(--accent)] px-2.5 py-1.5 text-xs font-medium text-[var(--accent)] transition hover:bg-[var(--accent)]/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Fetching…" : "Fetch latest"}
        </button>
      </div>

      {/* ห้ามเอาราคาจริงมาทับต้นทุนสมมติ — จะได้กำไร/ขาดทุนที่อ่านผิดโดยดูเหมือนจริง */}
      {state.isDemo ? (
        <p className="mt-2 text-[10.5px] leading-relaxed text-[var(--label-dim)]">
          The sample city uses made-up numbers — hit “Start real portfolio” before fetching live prices
        </p>
      ) : (
        stale &&
        !busy && (
          <p className="mt-2 text-[10.5px] leading-relaxed text-[var(--label-dim)]">
            {age === null
              ? "Prices are hand-entered — gain/loss and window lights will not match the real market"
              : "Prices are over 2 days old — gain/loss is not fully trustworthy"}
          </p>
        )
      )}

      {error && <p className="mt-2 text-[10.5px] text-[var(--loss)]">{error}</p>}

      {result && !error && (
        <div className="mt-2 space-y-1 text-[10.5px] text-[var(--label-dim)]">
          <p>
            Updated{" "}
            <span className="text-[var(--gain)]">{result.updated.length}</span>
            {result.fxRate && ` · FX ${result.fxRate.toFixed(2)}`}
          </p>
          {result.failed.length > 0 && (
            <p className="text-[var(--free)]">
              {result.failed.length} failed ({result.failed.join(", ")}) —
              still using the prices you entered
            </p>
          )}
          <p className="opacity-70">Source: Yahoo Finance · ~15 min delayed</p>
        </div>
      )}
    </section>
  );
}
