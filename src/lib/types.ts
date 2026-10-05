export type Currency = "USD" | "THB";

export type DistrictId = "mission" | "goldengoose";

/** One holding — stores price per share because that's the number brokerage apps show */
export type Holding = {
  id: string;
  ticker: string;
  name: string;
  shares: number;
  /** Average cost per share, in its own currency — may be 0 (a free holding) */
  avgCost: number;
  /** Current price per share, in its own currency */
  currentPrice: number;
  currency: Currency;
  district: DistrictId;
  /**
   * Baht actually paid at purchase (whole position) — if present, used as "money invested" instead.
   *
   * Why: converting the USD cost at today's FX gives a different answer from the baht
   * actually paid, because the rate at exchange time differs (it can be tens of thousands of baht),
   * and baht is the currency the goals are measured in, so the real figure must be recordable.
   */
  costTHB?: number;
};

/**
 * Cash not yet invested — deliberately separate from holdings, because it doesn't own anything yet.
 * Never counted in "money invested", which is the city's height.
 */
export type Cash = {
  usd: number;
  thb: number;
};

/**
 * One top-up into a single holding — one "DCA round".
 *
 * Kept separately from avgCost, because average cost only says "how much is in, in total"
 * and erases *how many times* money was added — which is the thing worth being proud of.
 * ฿4,000 on a ฿300,000 portfolio is always 1.3%, however it's drawn — but "one more round"
 * is always a full 1, so it needs a unit that isn't diluted by portfolio size.
 */
export type Contribution = {
  /** Date of the top-up (YYYY-MM-DD) */
  at: string;
  ticker: string;
  /** Baht added to that holding this round */
  amountTHB: number;
};

/**
 * Emergency fund — drawn as the city wall.
 *
 * ⚠️ Hard rule set by the owner: **never add it to portfolio value**.
 * The reasoning: otherwise it would look like the goal was already reached. An emergency fund isn't wealth
 * that grows — it's money that sits ready to use ⇒ measured as "months covered",
 * not "baht", and it never appears on the same scoreboard as the towers.
 *
 * In the city: not a tower (towers = money that has become ownership)
 * but a **wall around the city** — it doesn't make the city bigger, it keeps the city from falling.
 */
export type Reserve = {
  /** Reserve amount (baht) */
  amountTHB: number;
  /** Monthly expenses used as the divisor — the wall is measured in months, not baht */
  monthlyBurnTHB: number;
  /** Laid/withdrawn history, oldest → newest — append only */
  history?: ReserveEvent[];
};

/**
 * One change to the reserve — positive = bricks laid · negative = withdrawn (the wall cracks).
 *
 * Why it exists: `reserve` used to store only the balance ⇒ adding ฿4,000 just moved
 * the screen from "24.0 → 24.8 months" and that was it · **the same feedback gap**
 * the app solves for towers (DCA rounds), left in the place that needed feedback most.
 *
 * ⚠️ Counted in "times", like DCA rounds, not baht — ฿4,000 is always a sliver of the target,
 * but "one more time you acted" is a full 1 however long the wall is.
 *
 * ⚠️ And *correcting a number* must never become an event — otherwise one typo
 * cracks the wall when nobody withdrew anything (a history that lies is worse than none).
 */
export type ReserveEvent = {
  /** Date (YYYY-MM-DD) */
  at: string;
  /** Baht moved — positive = laid · negative = withdrawn */
  amountTHB: number;
};

export type CityState = {
  holdings: Holding[];
  /** City wall — never counted in portfolio value (locked by a test) */
  reserve?: Reserve;
  cash?: Cash;
  /** Per-holding top-up history, oldest → newest — append only, never rewritten */
  contributions?: Contribution[];
  /**
   * Total deposits (baht) — every baht moved into the portfolio since the start, including uninvested cash.
   *
   * Unlike stock cost, this doesn't change on buy/sell — only when new money is added.
   * Used as the denominator of total return, the same way the spreadsheet does it.
   * ⚠️ Never use it for city height — height is only money that has become shares.
   */
  deposits?: number;
  /** USD → THB */
  fxRate: number;
  /** true = sample city, not a real portfolio yet */
  isDemo: boolean;
  /**
   * When market prices were last fetched (ISO) — missing = prices were entered by hand.
   * Must always be shown, or stale prices make gain/loss silently wrong.
   */
  pricesUpdatedAt?: string;
};

/**
 * Generic structure the renderer understands — deliberately has no notion of "stock",
 * so new kinds (walls, roads) can be added without rewriting the renderer.
 */
export type Structure = {
  id: string;
  kind: StructureKind;
  label: string;
  sublabel: string;
  /** Money actually put in (THB) → height · only grows, not tied to market price */
  invested: number;
  /** Units accumulated → floor lines */
  units: number;
  /** Condition (gain/loss ratio) → window brightness · null = can't be measured */
  health: number | null;
  /** Obtained free (zero cost) — no % possible, not a bug */
  isFree: boolean;
  district: string;
  /** Current market value (THB) — shown as a number, never used for size */
  marketValue: number;
  /** How many times money was added → tally on the building */
  contributionCount: number;
  /** Baht added in the last few days — null = nothing new */
  recentAdd: number | null;
};

export type StructureKind = "tower" | "site";
// "site" = construction site, representing cash waiting to become a tower
// Future: "wall" = emergency fund · "road" = bills paid on time · "district"

/** The cash zone — not a holding district, so it isn't in DistrictId */
export const CASH_ZONE = "cash";

export const DISTRICTS: Record<string, { label: string; note: string }> = {
  mission: {
    label: "Mission To The Moon",
    note: "Growth district — US equities",
  },
  goldengoose: {
    label: "Golden Goose",
    note: "Cash-flow district — dividends",
  },
  [CASH_ZONE]: {
    label: "Cash on hand",
    note: "Construction yards outside the city",
  },
};
