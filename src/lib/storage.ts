import type { CityState, Holding } from "./types";
import { demoCity } from "./demo";

const KEY = "ownership-visualizer:city:v1";
const BACKUP_KEY = "ownership-visualizer:city:v1:backup";

function isHolding(value: unknown): value is Holding {
  if (typeof value !== "object" || value === null) return false;
  const h = value as Record<string, unknown>;
  return (
    typeof h.id === "string" &&
    typeof h.ticker === "string" &&
    typeof h.shares === "number" &&
    typeof h.avgCost === "number" &&
    typeof h.currentPrice === "number" &&
    (h.currency === "USD" || h.currency === "THB") &&
    (h.district === "mission" || h.district === "goldengoose")
  );
}

/** Take JSON of unknown origin (old localStorage / imported file) and return usable state */
export function parseCity(raw: unknown): CityState | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.holdings)) return null;

  const holdings = obj.holdings.filter(isHolding).map((h) => ({
    ...h,
    name: typeof h.name === "string" ? h.name : h.ticker,
    costTHB:
      typeof h.costTHB === "number" && h.costTHB >= 0 ? h.costTHB : undefined,
  }));

  const fxRate = typeof obj.fxRate === "number" && obj.fxRate > 0 ? obj.fxRate : 33.3;

  const rawCash = obj.cash as { usd?: unknown; thb?: unknown } | undefined;
  const num = (v: unknown) => (typeof v === "number" && v >= 0 ? v : 0);
  const cash =
    rawCash && typeof rawCash === "object"
      ? { usd: num(rawCash.usd), thb: num(rawCash.thb) }
      : undefined;

  const contributions = Array.isArray(obj.contributions)
    ? (obj.contributions as unknown[]).filter(
        (c): c is { at: string; ticker: string; amountTHB: number } =>
          typeof c === "object" &&
          c !== null &&
          typeof (c as Record<string, unknown>).at === "string" &&
          typeof (c as Record<string, unknown>).ticker === "string" &&
          typeof (c as Record<string, unknown>).amountTHB === "number",
      )
    : undefined;

  const rawReserve = obj.reserve as
    | { amountTHB?: unknown; monthlyBurnTHB?: unknown; history?: unknown }
    | undefined;
  const reserve =
    rawReserve && typeof rawReserve === "object"
      ? {
          amountTHB: num(rawReserve.amountTHB),
          monthlyBurnTHB: num(rawReserve.monthlyBurnTHB),
          /**
           * ⚠️ Deltas can be negative (withdrawals), so `num` (which clamps to ≥ 0) can't be used.
           * Get this wrong and every crack becomes 0 and silently disappears on refresh.
           */
          history: Array.isArray(rawReserve.history)
            ? (rawReserve.history as unknown[]).filter(
                (e): e is { at: string; amountTHB: number } =>
                  typeof e === "object" &&
                  e !== null &&
                  typeof (e as Record<string, unknown>).at === "string" &&
                  typeof (e as Record<string, unknown>).amountTHB === "number",
              )
            : undefined,
        }
      : undefined;

  return {
    holdings,
    cash,
    reserve,
    contributions,
    deposits:
      typeof obj.deposits === "number" && obj.deposits > 0 ? obj.deposits : undefined,
    fxRate,
    isDemo: obj.isDemo === true,
    pricesUpdatedAt:
      typeof obj.pricesUpdatedAt === "string" ? obj.pricesUpdatedAt : undefined,
  };
}

export function loadCity(): CityState {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return demoCity();
    const parsed = parseCity(JSON.parse(raw));
    return parsed ?? demoCity();
  } catch {
    // Private mode / blocked site data — the app must still open
    return demoCity();
  }
}

export function saveCity(state: CityState): void {
  try {
    // The city is about to become empty after having towers → keep a copy first
    // (an empty state once overwrote real data during dev — lost for good)
    if (state.holdings.length === 0) {
      const prev = parseCity(JSON.parse(window.localStorage.getItem(KEY) ?? "null"));
      if (prev && prev.holdings.length > 0 && !prev.isDemo) {
        window.localStorage.setItem(BACKUP_KEY, JSON.stringify(prev));
      }
    }
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Can't write? Let it go — the data stays on the page until refresh
  }
}

/** The last real city before it was cleared — null if there's nothing to restore */
export function loadBackup(): CityState | null {
  try {
    const raw = window.localStorage.getItem(BACKUP_KEY);
    if (!raw) return null;
    const parsed = parseCity(JSON.parse(raw));
    return parsed && parsed.holdings.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function clearBackup(): void {
  try {
    window.localStorage.removeItem(BACKUP_KEY);
  } catch {
    // Not critical
  }
}

export function exportCity(state: CityState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ownership-city-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importCity(file: File): Promise<CityState | null> {
  try {
    return parseCity(JSON.parse(await file.text()));
  } catch {
    return null;
  }
}
