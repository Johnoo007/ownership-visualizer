"use client";

import { useEffect, useState } from "react";
import {
  compare,
  formatSnapshotDate,
  loadHistory,
  pushSnapshot,
  type Snapshot,
} from "@/lib/history";
import { formatTHB } from "@/lib/portfolio";
import type { CityState } from "@/lib/types";

/**
 * ความทรงจำของเมือง — เก็บภาพพอร์ตตามเวลาแล้วเทียบกับวันนี้
 * เทียบที่ "เงินที่ลงไป" ล้วน ไม่ใช่มูลค่าตลาด เพราะสิ่งที่อยากให้เห็นคือ
 * เมืองที่ตัวเองสร้างขึ้นมา ไม่ใช่ตลาดขึ้นลง
 */
export function TimeMachine({
  state,
  viewingPast,
  onViewPast,
}: {
  state: CityState;
  viewingPast: Snapshot | null;
  onViewPast: (s: Snapshot | null) => void;
}) {
  const [history, setHistory] = useState<Snapshot[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  if (state.isDemo) return null;

  const past = history.filter((s) => s.at !== viewingPast?.at);
  const oldest = history[0];
  const growth = oldest ? compare(oldest, state) : null;

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3">
      <div className="flex items-center gap-2">
        <h2 className="text-[10px] font-semibold tracking-wide text-[var(--label-dim)] uppercase">
          City memory
        </h2>
        <button
          type="button"
          onClick={() => setHistory(pushSnapshot(state))}
          disabled={state.holdings.length === 0}
          className="ml-auto rounded-md border border-[var(--border-bright)] px-2 py-1 text-[10.5px] text-[var(--label)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40"
        >
          Save today’s snapshot
        </button>
      </div>

      {history.length === 0 ? (
        <p className="mt-2 text-[10.5px] leading-relaxed text-[var(--label-dim)]">
          No past snapshots yet — save one today and in a few months you will see how far the city grew
        </p>
      ) : (
        <>
          {growth && growth.days > 0 && (
            <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--panel-raised)] p-2.5">
              <p className="text-[10px] text-[var(--label-dim)]">
                vs {growth.days} {growth.days === 1 ? "day" : "days"} ago
              </p>
              <p className="font-mono text-base font-semibold text-[var(--gain)]">
                +{formatTHB(growth.investedDelta).slice(1)}
              </p>
              <p className="text-[10px] text-[var(--label-dim)]">
                that you built yourself
                {growth.newTowers.length > 0 &&
                  ` · ${growth.newTowers.length} new towers`}
                {growth.grownTowers.length > 0 &&
                  ` · ${growth.grownTowers.length} grew taller`}
              </p>
            </div>
          )}

          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onViewPast(null)}
              className={`rounded-md border px-2 py-1 text-[10.5px] transition ${
                viewingPast === null
                  ? "border-[var(--accent)] text-[var(--accent)]"
                  : "border-[var(--border)] text-[var(--label-dim)] hover:border-[var(--border-bright)]"
              }`}
            >
              Today
            </button>
            {past.slice(-6).map((s) => (
              <button
                key={s.at}
                type="button"
                onClick={() => onViewPast(s)}
                className="rounded-md border border-[var(--border)] px-2 py-1 text-[10.5px] text-[var(--label-dim)] transition hover:border-[var(--border-bright)] hover:text-[var(--label)]"
              >
                {formatSnapshotDate(s.at)}
              </button>
            ))}
            {viewingPast && (
              <button
                type="button"
                onClick={() => onViewPast(viewingPast)}
                className="rounded-md border border-[var(--accent)] px-2 py-1 text-[10.5px] text-[var(--accent)]"
              >
                {formatSnapshotDate(viewingPast.at)}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
