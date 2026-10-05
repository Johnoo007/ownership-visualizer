import { CASH_ZONE, type CityState, type Currency, type DistrictId, type Holding, type Structure } from "./types";
import { towerHeights } from "./iso";
import { contributionsFor, recentAddFor } from "./contributions";

/** Convert an amount in any currency to baht */
export function toTHB(amount: number, currency: Currency, fxRate: number): number {
  return currency === "USD" ? amount * fxRate : amount;
}

/**
 * Money actually invested (baht) — this is the ruler; it doesn't move with market prices.
 *
 * If the baht actually paid was recorded, always use it rather than today's FX,
 * (the rate when exchanged differs from today's — converting backwards drifts from what was paid).
 */
export function investedTHB(h: Holding, fxRate: number): number {
  if (typeof h.costTHB === "number" && h.costTHB >= 0) return h.costTHB;
  return toTHB(h.shares * h.avgCost, h.currency, fxRate);
}

/** true = invested amount is the baht actually paid, not an estimate at today's FX */
export function hasRealTHBCost(h: Holding): boolean {
  return typeof h.costTHB === "number" && h.costTHB >= 0;
}

/** Current market value (baht) — moves daily; shows condition, never sets tower size */
export function marketValueTHB(h: Holding, fxRate: number): number {
  return toTHB(h.shares * h.currentPrice, h.currency, fxRate);
}

/**
 * Per-holding gain/loss — always in the holding's own currency (USD for US stocks).
 *
 * Deliberately not converted to baht, because per holding we measure **pure market return**.
 * Mixing FX in here would make it impossible to tell whether a tower's lights dimmed because
 * the company did badly or because the baht strengthened. FX effects show at the portfolio level (see totals), in baht.
 */
export function pnlRatio(h: Holding): number | null {
  const cost = h.shares * h.avgCost;
  if (cost <= 0) return null;
  return (h.shares * h.currentPrice) / cost - 1;
}

export function isFreeHolding(h: Holding): boolean {
  const cost = typeof h.costTHB === "number" ? h.costTHB : h.shares * h.avgCost;
  return cost <= 0 && h.shares > 0;
}

export type Totals = {
  invested: number;
  marketValue: number;
  pnl: number;
  /** Gain/loss ratio, measured only against holdings with a real cost */
  pnlRatio: number | null;
  /**
   * Towers *actually standing in the city* — not the number of holdings.
   *
   * Differs in two ways: (1) free holdings (zero cost) are drawn as bare land + a gold pile,
   * not towers, so they don't count; (2) holdings over the height cap split into several towers, counting more than 1.
   * ⇒ this must match what you can count by eye in the city, or the sidebar contradicts the picture.
   */
  towerCount: number;
  /** Free holdings — they have value but no tower */
  landCount: number;
  shareCount: number;
};

export function totals(state: CityState, district?: DistrictId): Totals {
  const rows = district
    ? state.holdings.filter((h) => h.district === district)
    : state.holdings;

  let invested = 0;
  let marketValue = 0;
  let shareCount = 0;

  for (const h of rows) {
    invested += investedTHB(h, state.fxRate);
    marketValue += marketValueTHB(h, state.fxRate);
    shareCount += h.shares;
  }

  const pnl = marketValue - invested;

  return {
    invested,
    marketValue,
    pnl,
    pnlRatio: invested > 0 ? marketValue / invested - 1 : null,
    towerCount: rows.reduce(
      (n, h) => n + (investedTHB(h, state.fxRate) > 0 ? towerHeights(investedTHB(h, state.fxRate)).length : 0),
      0,
    ),
    landCount: rows.filter((h) => investedTHB(h, state.fxRate) <= 0).length,
    shareCount,
  };
}

/**
 * The tower taking up the most of the city + its share.
 *
 * ⚠️ Deliberately never reports "total shares across holdings" — adding 12 VOO shares (฿16,000 each)
 * to 200 PTT shares (฿31 each) gives a number that means nothing
 * (the same unit trap that made "height = share count" wrong).
 */
export function topConcentration(
  state: CityState,
  district?: DistrictId,
): { label: string; share: number } | null {
  const rows = district
    ? state.holdings.filter((h) => h.district === district)
    : state.holdings;

  const totalInvested = rows.reduce((sum, h) => sum + investedTHB(h, state.fxRate), 0);
  if (totalInvested <= 0) return null;

  let top: Holding | null = null;
  let max = -1;
  for (const h of rows) {
    const v = investedTHB(h, state.fxRate);
    if (v > max) {
      max = v;
      top = h;
    }
  }

  return top ? { label: top.ticker, share: max / totalInvested } : null;
}

/** Total cash in baht */
export function cashTHB(state: CityState): number {
  if (!state.cash) return 0;
  return state.cash.usd * state.fxRate + state.cash.thb;
}

export type PortfolioSummary = Totals & {
  /** Total cash (baht) */
  cash: number;
  /** Whole-portfolio value as the spreadsheet counts it = stocks + cash */
  marketTotal: number;
  /** All money put into the portfolio — total deposits if known, otherwise stock cost + cash */
  returnBase: number;
  usingDeposits: boolean;
  /** Total return as the spreadsheet computes it: (cash + stock value) ÷ total deposits − 1 */
  totalReturn: number | null;
};

/**
 * Whole-portfolio totals the way the spreadsheet reports them — cash included.
 *
 * Deliberately separate from totals(): totals is "the city" (only money that became towers),
 * this is "the whole portfolio", including money still waiting to be invested.
 */
export function portfolioSummary(state: CityState): PortfolioSummary {
  const t = totals(state);
  const cash = cashTHB(state);
  const marketTotal = t.marketValue + cash;

  const usingDeposits = typeof state.deposits === "number" && state.deposits > 0;
  // Without total deposits, cash still has to count — money moved into the portfolio
  // but not yet spent on shares has still been saved
  const returnBase = usingDeposits ? state.deposits! : t.invested + cash;

  return {
    ...t,
    cash,
    marketTotal,
    returnBase,
    usingDeposits,
    totalReturn: returnBase > 0 ? marketTotal / returnBase - 1 : null,
  };
}

/** Holding[] → Structure[] — the only bridge the renderer uses */
export function toStructures(state: CityState, now: Date = new Date()): Structure[] {
  const towers: Structure[] = state.holdings.map((h) => ({
    id: h.id,
    kind: "tower" as const,
    label: h.ticker,
    sublabel: h.name,
    invested: investedTHB(h, state.fxRate),
    units: h.shares,
    health: pnlRatio(h),
    isFree: isFreeHolding(h),
    district: h.district,
    marketValue: marketValueTHB(h, state.fxRate),
    contributionCount: contributionsFor(state.contributions, h.ticker).length,
    recentAdd: recentAddFor(state.contributions, h.ticker, now),
  }));

  /**
   * Cash = a construction site waiting to become a tower, in its own zone outside the city.
   *
   * The amount goes into `invested` so the site is "as big as the money" on the same scale as towers.
   * Safe because totals()/topConcentration() read holdings, never structures
   * ⇒ "money invested" doesn't move with cash (locked by a test).
   */
  const sites: Structure[] = [];
  const pushSite = (id: string, label: string, value: number) => {
    if (value <= 0) return;
    sites.push({
      id,
      kind: "site",
      label,
      sublabel: "Waiting to be invested",
      invested: value,
      units: 0,
      health: null,
      isFree: false,
      district: CASH_ZONE,
      marketValue: value,
      // Cash hasn't chosen which tower to become, so it has no DCA rounds of its own
      contributionCount: 0,
      recentAdd: null,
    });
  };

  if (state.cash) {
    pushSite("cash-usd", "USD", state.cash.usd * state.fxRate);
    pushSite("cash-thb", "THB", state.cash.thb);
  }

  return [...towers, ...sites];
}

const bahtFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

export function formatTHB(amount: number): string {
  return `฿${bahtFormatter.format(Math.round(amount))}`;
}

export function formatShares(shares: number): string {
  // Fractional shares must look fractional, not rounded into looking like whole shares
  return Number.isInteger(shares) ? String(shares) : shares.toFixed(4).replace(/0+$/, "");
}

export function formatPercent(ratio: number | null): string {
  if (ratio === null) return "—";
  const sign = ratio >= 0 ? "+" : "";
  return `${sign}${(ratio * 100).toFixed(1)}%`;
}
