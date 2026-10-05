import { RECENT_DAYS, inRecentWindow } from "./contributions";
import type { CityState, Reserve, ReserveEvent } from "./types";

/**
 * Wall target = 6 months.
 *
 * Thailand's central bank suggests 3–6 months of normal expenses — the upper bound is used
 * because a "finished" wall should mean genuinely safe, not just past the minimum.
 * (Source: Bank of Thailand financial literacy survey 2024 — only 23.7% reach 6 months.)
 */
export const TARGET_MONTHS = 6;

/** Moves smaller than this are rounding noise, not a real deposit/withdrawal */
const MIN_EVENT = 1;

export type ReserveStatus = {
  /** Months covered — null = monthly expenses not entered yet, so it can't be computed */
  months: number | null;
  /** Fraction of the wall ring built, 0..1 */
  coverage: number;
  /**
   * Coverage RECENT_DAYS days ago — used to find "just built" and "just broken" sections.
   *
   * Greater than coverage = money was just withdrawn (wall shrank → cracks).
   * Less than coverage = bricks were just laid (the difference glows).
   */
  priorCoverage: number;
  /** Baht still missing to reach the target */
  gapTHB: number;
  complete: boolean;
  amountTHB: number;
  monthlyBurnTHB: number;
  /** Baht laid in within the last RECENT_DAYS days */
  recentAddTHB: number;
  /** Baht withdrawn within the last RECENT_DAYS days (as a positive number) */
  recentWithdrawTHB: number;
  /** Total times bricks were laid — a unit that doesn't get diluted as the wall grows */
  rounds: number;
  /** Times bricks were laid within the last RECENT_DAYS days */
  recentRounds: number;
};

function coverageOf(amountTHB: number, monthlyBurnTHB: number): number {
  if (monthlyBurnTHB <= 0) return 0;
  const months = Math.max(0, amountTHB) / monthlyBurnTHB;
  return Math.max(0, Math.min(1, months / TARGET_MONTHS));
}

export function reserveStatus(
  reserve: Reserve | undefined,
  now: Date = new Date(),
): ReserveStatus {
  const amountTHB = reserve && reserve.amountTHB > 0 ? reserve.amountTHB : 0;
  const monthlyBurnTHB =
    reserve && reserve.monthlyBurnTHB > 0 ? reserve.monthlyBurnTHB : 0;

  const recent = (reserve?.history ?? []).filter((e) => inRecentWindow(e.at, now));
  const recentAddTHB = recent
    .filter((e) => e.amountTHB > 0)
    .reduce((a, e) => a + e.amountTHB, 0);
  const recentWithdrawTHB = recent
    .filter((e) => e.amountTHB < 0)
    .reduce((a, e) => a - e.amountTHB, 0);

  const rounds = (reserve?.history ?? []).filter((e) => e.amountTHB > 0).length;
  const recentRounds = recent.filter((e) => e.amountTHB > 0).length;

  /**
   * Previous amount = today's amount rolled back by the *net* of events in the window
   * (not split into + and −, because the wall has one length — laying 4,000 then withdrawing
   *  20,000 in the same week must read as "net shrink", not glowing and cracked at once)
   */
  const priorAmountTHB = amountTHB - (recentAddTHB - recentWithdrawTHB);

  // Unknown expenses = can't say how many months it covers · never guess, or the wall lies
  if (monthlyBurnTHB <= 0) {
    return {
      months: null,
      coverage: 0,
      priorCoverage: 0,
      gapTHB: 0,
      complete: false,
      amountTHB,
      monthlyBurnTHB: 0,
      recentAddTHB,
      recentWithdrawTHB,
      rounds,
      recentRounds,
    };
  }

  const months = amountTHB / monthlyBurnTHB;
  const target = TARGET_MONTHS * monthlyBurnTHB;

  return {
    months,
    coverage: coverageOf(amountTHB, monthlyBurnTHB),
    priorCoverage: coverageOf(priorAmountTHB, monthlyBurnTHB),
    gapTHB: Math.max(0, target - amountTHB),
    complete: months >= TARGET_MONTHS,
    amountTHB,
    monthlyBurnTHB,
    recentAddTHB,
    recentWithdrawTHB,
    rounds,
    recentRounds,
  };
}

function todayISO(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Lay bricks (delta > 0) or withdraw (delta < 0) and return the new reserve.
 *
 * Deliberately takes a **delta**, not a total, because a total can't tell
 * "really withdrew money" from "fixed a typo" — and the latter must never crack the wall.
 *
 * Withdrawing more than there is leaves 0 (never negative), and only what could actually be withdrawn is recorded.
 */
export function applyReserveEvent(
  reserve: Reserve | undefined,
  deltaTHB: number,
  now: Date = new Date(),
): Reserve {
  const base: Reserve = {
    amountTHB: 0,
    monthlyBurnTHB: 0,
    ...reserve,
  };

  if (!Number.isFinite(deltaTHB) || Math.abs(deltaTHB) < MIN_EVENT) return base;

  // Withdraw at most what exists — the wall can't have negative length
  const applied = Math.max(deltaTHB, -base.amountTHB);
  if (Math.abs(applied) < MIN_EVENT) return base;

  return {
    ...base,
    amountTHB: base.amountTHB + applied,
    history: appendReserveEvent(base.history, {
      at: todayISO(now),
      amountTHB: applied,
    }),
  };
}

/**
 * Append an event to history — same day *and same direction* merge into one entry.
 *
 * ⚠️ Directions must stay separate, or a day with +฿5,000 and −฿5,000 would net to 0
 * and vanish from history even though two real events happened.
 */
export function appendReserveEvent(
  existing: ReserveEvent[] | undefined,
  added: ReserveEvent,
): ReserveEvent[] {
  const list = [...(existing ?? [])];
  const same = list.findIndex(
    (e) => e.at === added.at && Math.sign(e.amountTHB) === Math.sign(added.amountTHB),
  );
  if (same >= 0) list[same] = { ...list[same], amountTHB: list[same].amountTHB + added.amountTHB };
  else list.push(added);
  return list.sort((a, b) => a.at.localeCompare(b.at));
}

/**
 * ⚠️ A reminder helper, not a calculation: the reserve is never part of any portfolio total.
 * If anyone ever wants to add it in, read the reasoning in types.ts first.
 */
export function reserveTHB(state: CityState): number {
  return reserveStatus(state.reserve).amountTHB;
}

export { RECENT_DAYS };
