import type { CityState } from "./types";
import { totals } from "./portfolio";

const KEY = "ownership-visualizer:history:v1";
const MAX_SNAPSHOTS = 60;

export type Snapshot = {
  /** ISO timestamp of when it was saved */
  at: string;
  state: CityState;
};

export function loadHistory(): Snapshot[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s) =>
        s &&
        typeof s.at === "string" &&
        s.state &&
        Array.isArray(s.state.holdings),
    );
  } catch {
    return [];
  }
}

function save(list: Snapshot[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX_SNAPSHOTS)));
  } catch {
    // Can't write? Let it go — history isn't primary data
  }
}

/** Save today's city — same day overwrites, so repeated clicks don't bloat history */
export function pushSnapshot(state: CityState): Snapshot[] {
  if (state.isDemo || state.holdings.length === 0) return loadHistory();

  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const list = loadHistory().filter((s) => s.at.slice(0, 10) !== today);

  list.push({ at: now, state: structuredClone(state) });
  list.sort((a, b) => a.at.localeCompare(b.at));
  save(list);
  return list;
}

export function clearHistory(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Not critical
  }
}

export type Growth = {
  investedDelta: number;
  /** Towers that went up after that snapshot */
  newTowers: string[];
  /** Towers that grew (more money invested) */
  grownTowers: string[];
  days: number;
};

/** Compare today with a past snapshot — measured in money invested, not market value */
export function compare(past: Snapshot, present: CityState): Growth {
  const pastTotals = totals(past.state);
  const nowTotals = totals(present);

  const pastByTicker = new Map(
    past.state.holdings.map((h) => [h.ticker, h.shares * h.avgCost]),
  );

  const newTowers: string[] = [];
  const grownTowers: string[] = [];

  for (const h of present.holdings) {
    const before = pastByTicker.get(h.ticker);
    const cost = h.shares * h.avgCost;
    if (before === undefined) newTowers.push(h.ticker);
    else if (cost > before + 0.01) grownTowers.push(h.ticker);
  }

  const days = Math.max(
    0,
    Math.round((Date.now() - Date.parse(past.at)) / 86_400_000),
  );

  return {
    investedDelta: nowTotals.invested - pastTotals.invested,
    newTowers,
    grownTowers,
    days,
  };
}

export function formatSnapshotDate(at: string): string {
  const d = new Date(at);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}
