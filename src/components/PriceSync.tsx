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
      setError("ดึงราคาไม่สำเร็จ — ลองใหม่อีกครั้ง (ราคาเดิมยังอยู่ครบ)");
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
            ราคาตลาด
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
          {busy ? "กำลังดึง…" : "ดึงราคาล่าสุด"}
        </button>
      </div>

      {/* ห้ามเอาราคาจริงมาทับต้นทุนสมมติ — จะได้กำไร/ขาดทุนที่อ่านผิดโดยดูเหมือนจริง */}
      {state.isDemo ? (
        <p className="mt-2 text-[10.5px] leading-relaxed text-[var(--label-dim)]">
          เมืองตัวอย่างใช้ตัวเลขสมมติทั้งหมด — กด “เริ่มพอร์ตจริง” ก่อนถึงจะดึงราคาตลาดได้
        </p>
      ) : (
        stale &&
        !busy && (
          <p className="mt-2 text-[10.5px] leading-relaxed text-[var(--label-dim)]">
            {age === null
              ? "ราคาที่แสดงเป็นค่าที่กรอกเอง — กำไร/ขาดทุนและระดับไฟจะยังไม่ตรงกับตลาดจริง"
              : "ราคาเก่าเกิน 2 วันแล้ว ตัวเลขกำไร/ขาดทุนเชื่อไม่ได้เต็มที่"}
          </p>
        )
      )}

      {error && <p className="mt-2 text-[10.5px] text-[var(--loss)]">{error}</p>}

      {result && !error && (
        <div className="mt-2 space-y-1 text-[10.5px] text-[var(--label-dim)]">
          <p>
            อัปเดตแล้ว{" "}
            <span className="text-[var(--gain)]">{result.updated.length} ตัว</span>
            {result.fxRate && ` · ค่าเงิน ${result.fxRate.toFixed(2)}`}
          </p>
          {result.failed.length > 0 && (
            <p className="text-[var(--free)]">
              ดึงไม่ได้ {result.failed.length} ตัว ({result.failed.join(", ")}) —
              ยังใช้ราคาเดิมที่กรอกไว้
            </p>
          )}
          <p className="opacity-70">ที่มา: Yahoo Finance · หน่วง ~15 นาที</p>
        </div>
      )}
    </section>
  );
}
