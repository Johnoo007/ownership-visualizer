"use client";

import { RECENT_DAYS, summarize } from "@/lib/contributions";
import { formatTHB } from "@/lib/portfolio";
import type { CityState } from "@/lib/types";

/**
 * รายงานการก่อสร้าง — ตอบคำถาม "ฉันเพิ่งทำอะไรลงไป"
 *
 * แผงสถิติที่เหลือตอบแต่ "ตอนนี้เป็นยังไง" ซึ่งเป็นตัวเลขที่ ฿4,000 ไปโผล่
 * เป็นแค่ 1.15% เสมอ · ตัวนี้จงใจวัดคนละหน่วย: *จำนวนครั้งที่ลงมือ*
 * ซึ่งไม่ถูกเจือจางเมื่อพอร์ตโตขึ้น — เดือนหน้ายังเป็น "อีกหนึ่งไม้" เท่าเดิม
 */
export function BuildLog({ state }: { state: CityState }) {
  const s = summarize(state.contributions);

  if (s.rounds === 0) {
    return (
      <section className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--panel)] px-3 py-2.5 text-xs text-[var(--label-dim)]">
        🏗️ <span className="font-semibold text-[var(--label)]">ยังไม่มีไม้ที่บันทึกไว้</span>{" "}
        — ครั้งหน้าที่อัปเดตพอร์ตหลังซื้อเพิ่ม แอปจะนับให้เองเป็น 1 ไม้
        แล้วขึ้นขีดที่มุมตึกนั้น
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
          🏗️ กำลังก่อสร้าง — {RECENT_DAYS} วันนี้เติม{" "}
          {formatTHB(s.recentTHB)} เข้า {s.recentTickers.join(" · ")}
        </span>
      ) : (
        <span className="font-semibold text-[var(--label)]">
          🧱 เมืองนี้สร้างด้วยมือนายมาแล้ว {s.rounds} ไม้
        </span>
      )}

      <Stat label="ไม้ทั้งหมด" value={`${s.rounds} ไม้`} />
      <Stat label="ปีนี้" value={`${s.thisYearRounds} ไม้ · ${formatTHB(s.thisYearTHB)}`} />
      <Stat label="รวมที่เติมเข้าตึก" value={formatTHB(s.totalTHB)} />

      <span className="ml-auto text-[10px] text-[var(--label-dim)]">
        1 ขีดที่มุมตึก = 1 ไม้
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
