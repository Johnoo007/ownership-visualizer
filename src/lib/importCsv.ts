import type { Currency, DistrictId, Holding } from "./types";

export type ParsedRow =
  | { ok: true; holding: Holding }
  | { ok: false; line: number; text: string; reason: string };

const HEADER_WORDS = ["ticker", "symbol", "shares", "หุ้น", "ต้นทุน"];

/**
 * อ่านตารางที่คัดลอกมาจากชีต/สเปรดชีต
 * รูปแบบ: ticker, จำนวนหุ้น, ต้นทุนต่อหุ้น [, ราคาปัจจุบัน] [, สกุลเงิน] [, เขต] [, บาทที่จ่ายจริง]
 *
 * รับทั้ง comma และ tab (วางจาก Google Sheets จะมาเป็น tab)
 * แถวที่อ่านไม่ได้จะถูกรายงานกลับทีละแถว ไม่ทำให้ทั้งชุดล้ม
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

      // ข้ามหัวตาราง
      if (
        i === 0 &&
        HEADER_WORDS.some((w) => cols[0]?.toLowerCase().includes(w))
      ) {
        return;
      }

      const [rawTicker, rawShares, rawCost, rawPrice, rawCcy, rawDistrict, rawCostTHB] =
        cols;

      if (!rawTicker) {
        rows.push({ ok: false, line: i + 1, text: line, reason: "ไม่มี ticker" });
        return;
      }

      const shares = Number(String(rawShares ?? "").replace(/,/g, ""));
      const avgCost = Number(String(rawCost ?? "").replace(/,/g, ""));

      if (!Number.isFinite(shares) || shares <= 0) {
        rows.push({
          ok: false,
          line: i + 1,
          text: line,
          reason: "จำนวนหุ้นไม่ถูกต้อง",
        });
        return;
      }
      if (!Number.isFinite(avgCost) || avgCost < 0) {
        rows.push({
          ok: false,
          line: i + 1,
          text: line,
          reason: "ต้นทุนไม่ถูกต้อง (ของฟรีใส่ 0)",
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

      // ช่องที่ 7 (ถ้ามี) = บาทที่จ่ายจริงทั้งก้อน — ใช้แทนการคูณค่าเงินวันนี้
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
