import type { CityState, Contribution, Holding } from "./types";

/** How many days a tower still counts as "under construction" after a top-up */
export const RECENT_DAYS = 7;

/** Smaller than this is rounding noise, not a real top-up */
const MIN_AMOUNT = 1;

/**
 * Cost in the holding's own currency — used to detect top-ups.
 *
 * ⚠️ Never compare baht totals: changing only the FX rate, without buying anything,
 * moves every holding's baht value at once and would record a top-up across the
 * whole portfolio — fake history. Market prices don't affect this (avgCost doesn't move).
 */
function nativeCost(h: Holding): number {
  return h.shares * h.avgCost;
}

function todayISO(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Compare the city before/after and return the rounds just added — not existing ones.
 *
 * Selling (fewer shares) → lower cost → not a top-up, and old tallies are never removed:
 * a round that was put in really happened, and selling later doesn't erase the past.
 */
export function detectContributions(
  prev: CityState,
  next: CityState,
  now: Date = new Date(),
): Contribution[] {
  if (next.isDemo) return [];

  const before = new Map(prev.holdings.map((h) => [h.ticker, h]));
  const at = todayISO(now);
  const found: Contribution[] = [];

  for (const h of next.holdings) {
    const old = before.get(h.ticker);
    const nativeDelta = nativeCost(h) - (old ? nativeCost(old) : 0);
    if (nativeDelta <= 0) continue;

    /**
     * If both sides have baht actually paid, use that difference directly (most accurate);
     * otherwise convert the native-currency difference at today's FX.
     */
    const bahtDelta =
      typeof h.costTHB === "number" && typeof old?.costTHB === "number"
        ? h.costTHB - old.costTHB
        : nativeDelta * (h.currency === "USD" ? next.fxRate : 1);

    if (bahtDelta < MIN_AMOUNT) continue;
    found.push({ at, ticker: h.ticker, amountTHB: bahtDelta });
  }

  return found;
}

/** Append new rounds to history — same day, same ticker merges into one round */
export function appendContributions(
  existing: Contribution[] | undefined,
  added: Contribution[],
): Contribution[] {
  if (added.length === 0) return existing ?? [];

  const list = [...(existing ?? [])];
  for (const c of added) {
    const same = list.findIndex((x) => x.at === c.at && x.ticker === c.ticker);
    if (same >= 0) list[same] = { ...list[same], amountTHB: list[same].amountTHB + c.amountTHB };
    else list.push(c);
  }
  return list.sort((a, b) => a.at.localeCompare(b.at));
}

export function contributionsFor(
  contributions: Contribution[] | undefined,
  ticker: string,
): Contribution[] {
  return (contributions ?? []).filter((c) => c.ticker === ticker);
}

/**
 * Is this inside the "just added" window?
 *
 * Shared with the city wall too (glowing bricks/cracks) — one time window across the app,
 * so "just happened" never means two different things in two places.
 *
 * Future dates must be excluded too, not just checked for being recent enough — an imported
 * file or a wrong system clock could otherwise put cranes on every tower at once
 * (found while simulating the future: 12 rounds dated ahead → the whole city became a building site).
 */
export function inRecentWindow(at: string, now: Date): boolean {
  const t = Date.parse(`${at}T00:00:00Z`);
  if (Number.isNaN(t)) return false;
  const end = now.getTime() + 86_400_000; // one day of slack for time zones
  return t >= now.getTime() - RECENT_DAYS * 86_400_000 && t <= end;
}

/** Baht added to this holding in the last RECENT_DAYS days — null = nothing new */
export function recentAddFor(
  contributions: Contribution[] | undefined,
  ticker: string,
  now: Date = new Date(),
): number | null {
  const sum = contributionsFor(contributions, ticker)
    .filter((c) => inRecentWindow(c.at, now))
    .reduce((acc, c) => acc + c.amountTHB, 0);
  return sum > 0 ? sum : null;
}

export type ContributionSummary = {
  /** Total rounds ever made */
  rounds: number;
  totalTHB: number;
  /** Rounds within the last RECENT_DAYS days */
  recentTHB: number;
  recentTickers: string[];
  /** Current year */
  thisYearTHB: number;
  thisYearRounds: number;
};

export function summarize(
  contributions: Contribution[] | undefined,
  now: Date = new Date(),
): ContributionSummary {
  const list = contributions ?? [];
  const year = todayISO(now).slice(0, 4);
  const recent = list.filter((c) => inRecentWindow(c.at, now));
  const thisYear = list.filter((c) => c.at.startsWith(year));

  return {
    rounds: list.length,
    totalTHB: list.reduce((a, c) => a + c.amountTHB, 0),
    recentTHB: recent.reduce((a, c) => a + c.amountTHB, 0),
    recentTickers: [...new Set(recent.map((c) => c.ticker))],
    thisYearTHB: thisYear.reduce((a, c) => a + c.amountTHB, 0),
    thisYearRounds: thisYear.length,
  };
}
