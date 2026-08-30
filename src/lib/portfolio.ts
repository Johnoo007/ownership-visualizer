import type { CityState, Currency, DistrictId, Holding, Structure } from "./types";

/** แปลงจำนวนเงินในสกุลใดก็ได้ให้เป็นบาท */
export function toTHB(amount: number, currency: Currency, fxRate: number): number {
  return currency === "USD" ? amount * fxRate : amount;
}

/**
 * เงินที่ลงไปจริง (บาท) — ตัวนี้คือไม้บรรทัด ไม่ขยับตามราคาตลาด
 *
 * ถ้ามีบาทที่จ่ายจริงบันทึกไว้ ใช้ตัวนั้นเสมอ ไม่ต้องคูณค่าเงินวันนี้
 * (ค่าเงินตอนแลกกับวันนี้ไม่เท่ากัน — การคูณย้อนหลังทำให้ตัวเลขเพี้ยนจากที่จ่ายจริง)
 */
export function investedTHB(h: Holding, fxRate: number): number {
  if (typeof h.costTHB === "number" && h.costTHB >= 0) return h.costTHB;
  return toTHB(h.shares * h.avgCost, h.currency, fxRate);
}

/** true = ตัวเลขเงินที่ลงเป็นบาทจริงที่จ่าย ไม่ใช่การตีราคาด้วยค่าเงินวันนี้ */
export function hasRealTHBCost(h: Holding): boolean {
  return typeof h.costTHB === "number" && h.costTHB >= 0;
}

/** มูลค่าตลาดตอนนี้ (บาท) — ขยับทุกวัน ใช้แค่บอกสภาพ ไม่ใช้กำหนดขนาดตึก */
export function marketValueTHB(h: Holding, fxRate: number): number {
  return toTHB(h.shares * h.currentPrice, h.currency, fxRate);
}

/**
 * กำไร/ขาดทุนเป็นสัดส่วน · คืน null เมื่อต้นทุนเป็น 0
 * (ของที่ได้มาฟรีคิด % ไม่ได้ — ไม่ใช่บั๊ก ห้ามหารศูนย์แล้วโชว์ ∞%)
 */
/**
 * กำไร/ขาดทุนรายตัว — คิด "ในสกุลของหุ้นตัวนั้น" เสมอ (USD สำหรับหุ้น US)
 *
 * จงใจไม่แปลงเป็นบาท เพราะระดับรายตัวคือการวัด **ผลตอบแทนตลาดล้วน**
 * ถ้าเอาค่าเงินมาปนตรงนี้ จะแยกไม่ออกว่าตึกดวงไฟหรี่เพราะบริษัทแย่ หรือเพราะบาทแข็ง
 * ส่วนผลกระทบค่าเงินไปโผล่ที่ระดับพอร์ตรวม (ดู totals) ซึ่งเป็นฐานบาท
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
  /** สัดส่วนกำไร/ขาดทุน เทียบเฉพาะส่วนที่มีต้นทุนจริง */
  pnlRatio: number | null;
  towerCount: number;
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
    towerCount: rows.length,
    shareCount,
  };
}

/**
 * ตึกที่กินพื้นที่เมืองมากที่สุด + สัดส่วนของมัน
 *
 * ⚠️ จงใจไม่รายงาน "ผลรวมจำนวนหุ้นทุกตัว" เป็นตัวชี้วัด — บวก 12 หุ้น VOO (฿16,000/หุ้น)
 * กับ 200 หุ้น PTT (฿31/หุ้น) เข้าด้วยกันแล้วได้ตัวเลขที่ไม่ได้แปลว่าอะไร
 * (กับดักหน่วยวัดตัวเดียวกับที่ทำให้ "ความสูง = จำนวนหุ้น" ผิด)
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

/** Holding[] → Structure[] — สะพานเดียวที่ renderer ใช้ (Kingdom ต่อยอดตรงนี้) */
export function toStructures(state: CityState): Structure[] {
  return state.holdings.map((h) => ({
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
  }));
}

const bahtFormatter = new Intl.NumberFormat("th-TH", {
  maximumFractionDigits: 0,
});

export function formatTHB(amount: number): string {
  return `฿${bahtFormatter.format(Math.round(amount))}`;
}

export function formatShares(shares: number): string {
  // เศษหุ้นต้องเห็นว่าเป็นเศษ ไม่ปัดทิ้งจนดูเหมือนถือเต็มหุ้น
  return Number.isInteger(shares) ? String(shares) : shares.toFixed(4).replace(/0+$/, "");
}

export function formatPercent(ratio: number | null): string {
  if (ratio === null) return "—";
  const sign = ratio >= 0 ? "+" : "";
  return `${sign}${(ratio * 100).toFixed(1)}%`;
}
