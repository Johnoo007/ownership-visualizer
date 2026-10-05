import type { Currency, DistrictId, Holding } from "./types";

export type ParsedRow =
  | { ok: true; holding: Holding }
  | { ok: false; line: number; text: string; reason: string };

// Thai words kept on purpose — this parses the owner's spreadsheet, whose headers are
// in Thai. It's input data, not UI text, so it isn't translated with the interface.
const HEADER_WORDS = ["ticker", "symbol", "shares", "หุ้น", "ต้นทุน"];

/**
 * Parse a table copied from a sheet/spreadsheet.
 * Format: ticker, shares, cost per share [, current price] [, currency] [, district] [, baht actually paid]
 *
 * Accepts commas or tabs (pasting from Google Sheets gives tabs).
 * Rows that can't be parsed are reported one by one instead of failing the whole batch.
 */
export function parseHoldingsTable(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];

  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .forEach((line, i) => {
      if (!line) return;

      const cols = line
        .split(/\t|,|;/)
        .map((c) => c.trim().replace(/^"|"$/g, ""));

      // Skip the header row
      if (
        i === 0 &&
        HEADER_WORDS.some((w) => cols[0]?.toLowerCase().includes(w))
      ) {
        return;
      }

      const [rawTicker, rawShares, rawCost, rawPrice, rawCcy, rawDistrict, rawCostTHB] =
        cols;

      if (!rawTicker) {
        rows.push({ ok: false, line: i + 1, text: line, reason: "no ticker" });
        return;
      }

      const shares = Number(String(rawShares ?? "").replace(/,/g, ""));
      const avgCost = Number(String(rawCost ?? "").replace(/,/g, ""));

      if (!Number.isFinite(shares) || shares <= 0) {
        rows.push({
          ok: false,
          line: i + 1,
          text: line,
          reason: "invalid share count",
        });
        return;
      }
      if (!Number.isFinite(avgCost) || avgCost < 0) {
        rows.push({
          ok: false,
          line: i + 1,
          text: line,
          reason: "invalid cost (use 0 for free holdings)",
        });
        return;
      }

      const parsedPrice = Number(String(rawPrice ?? "").replace(/,/g, ""));
      const currentPrice =
        Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : avgCost;

      const ccy = (rawCcy ?? "").toUpperCase();
      const currency: Currency = ccy === "THB" ? "THB" : "USD";

      const d = (rawDistrict ?? "").toLowerCase();
      const district: DistrictId =
        d.includes("golden") || d.includes("goose") || d.includes("ปันผล")
          ? "goldengoose"
          : "mission";

      // Column 7 (optional) = total baht actually paid — used instead of today's FX
      const parsedCostTHB = Number(String(rawCostTHB ?? "").replace(/,/g, ""));
      const costTHB =
        Number.isFinite(parsedCostTHB) && parsedCostTHB >= 0 && rawCostTHB
          ? parsedCostTHB
          : undefined;

      const ticker = rawTicker.toUpperCase();
      rows.push({
        ok: true,
        holding: {
          id: `${ticker}-${Date.now()}-${i}`,
          ticker,
          name: ticker,
          shares,
          avgCost,
          currentPrice,
          currency,
          district,
          ...(costTHB !== undefined ? { costTHB } : {}),
        },
      });
    });

  return rows;
}

export const SAMPLE_TABLE = `VOO, 12, 480, 512, USD, mission
GOOGL, 5, 172, 205, USD, mission
SCB, 100, 128, 131, THB, goldengoose`;
