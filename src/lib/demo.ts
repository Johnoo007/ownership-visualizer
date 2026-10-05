import type { CityState, Contribution } from "./types";

/**
 * Sample city — every number is made up, not anyone's portfolio.
 * Lets the app open straight onto a city instead of an empty form asking for 15 holdings.
 * The UI must always label it as a sample (state.isDemo).
 */
export function demoCity(): CityState {
  return {
    isDemo: true,
    fxRate: 33.3,
    holdings: [
      d("VOO", "Vanguard S&P 500", 12, 480, 512),
      d("SPYM", "SPDR Portfolio S&P 500", 34, 88, 94.2),
      d("GOOGL", "Alphabet", 5, 172, 205),
      d("META", "Meta Platforms", 3, 610, 548),
      d("NVDA", "Nvidia", 6, 118, 141),
      d("AMZN", "Amazon", 4, 186, 202),
      d("SCHG", "Schwab US Large-Cap Growth", 9, 104, 112),
      d("IEMG", "iShares Core MSCI EM", 14, 56, 58.4),
      d("SPCX", "Space Exploration Technologies", 1, 150.27, 161.1),
      d("MSFT", "Microsoft", 0.6, 430, 446),
      d("PLTR", "Palantir", 2.4, 61, 74),
      d("TMDX", "TransMedics", 0.4, 118, 62),
      // A free holding — zero cost so no %, but it must still show up in the city
      { ...d("GLD", "SPDR Gold Shares", 0.5, 0, 234.8), avgCost: 0 },
      // Second district, priced in baht
      d("SCB", "SCB X", 100, 128, 131, "THB", "goldengoose"),
      d("PTT", "PTT", 200, 31.5, 30.25, "THB", "goldengoose"),
    ],
    // Sample DCA rounds — so tower tallies and cranes are visible on first open
    contributions: demoContributions(),
  };
}

function d(
  ticker: string,
  name: string,
  shares: number,
  avgCost: number,
  currentPrice: number,
  currency: "USD" | "THB" = "USD",
  district: "mission" | "goldengoose" = "mission",
) {
  return {
    id: `demo-${ticker}`,
    ticker,
    name,
    shares,
    avgCost,
    currentPrice,
    currency,
    district,
  };
}

export function emptyCity(): CityState {
  return { holdings: [], fxRate: 33.3, isDemo: false };
}

/**
 * Contribution history for the sample city — DCA walked backwards from today.
 * Uses real dates so the latest round always falls in the "just built" window, whenever it's opened.
 */
function demoContributions(): Contribution[] {
  const day = (n: number) =>
    new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

  const plan: Array<[string, number, number]> = [
    // [ticker, rounds, baht per round]
    ["SPYM", 11, 4000],
    ["VOO", 6, 5000],
    ["GOOGL", 5, 5000],
    ["SCHG", 4, 3000],
    ["IEMG", 3, 2000],
  ];

  const out: Contribution[] = [];
  for (const [ticker, rounds, amountTHB] of plan) {
    for (let i = 0; i < rounds; i++) {
      out.push({ at: day((rounds - 1 - i) * 30 + 2), ticker, amountTHB });
    }
  }
  // This week's round — makes the crane and gold band show up
  out.push({ at: day(1), ticker: "SPYM", amountTHB: 4000 });
  return out.sort((a, b) => a.at.localeCompare(b.at));
}
