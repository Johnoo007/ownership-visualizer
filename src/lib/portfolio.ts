import { CASH_ZONE, type CityState, type Currency, type DistrictId, type Holding, type Structure } from "./types";

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

/** เงินสดรวมเป็นบาท */
export function cashTHB(state: CityState): number {
  if (!state.cash) return 0;
  return state.cash.usd * state.fxRate + state.cash.thb;
}

export type PortfolioSummary = Totals & {
  /** เงินสดรวม (บาท) */
  cash: number;
  /** มูลค่าทั้งพอร์ตแบบที่ชีตนับ = หุ้น + เงินสด */
  marketTotal: number;
  /** ตัวส่วนของผลตอบแทน — เงินเติมสะสมถ้ามี ไม่งั้นถอยไปใช้ต้นทุนหุ้น */
  returnBase: number;
  usingDeposits: boolean;
  /** ผลตอบแทนรวมแบบชีต: (เงินสด + มูลค่าหุ้น) ÷ เงินเติมสะสม − 1 */
  totalReturn: number | null;
};

/**
 * ยอดรวมทั้งพอร์ตแบบเดียวกับที่ชีตรายงาน — นับเงินสดเข้าไปด้วย
 *
 * จงใจแยกจาก totals(): totals คือ "เมือง" (เฉพาะเงินที่กลายเป็นตึกแล้ว)
 * ส่วนตัวนี้คือ "พอร์ตทั้งก้อน" ซึ่งรวมเงินที่ยังรอลงทุนอยู่ด้วย
 */
export function portfolioSummary(state: CityState): PortfolioSummary {
  const t = totals(state);
  const cash = cashTHB(state);
  const marketTotal = t.marketValue + cash;

  const usingDeposits = typeof state.deposits === "number" && state.deposits > 0;
  const returnBase = usingDeposits ? state.deposits! : t.invested;

  return {
    ...t,
    cash,
    marketTotal,
    returnBase,
    usingDeposits,
    totalReturn: returnBase > 0 ? marketTotal / returnBase - 1 : null,
  };
}

/** Holding[] → Structure[] — สะพานเดียวที่ renderer ใช้ (Kingdom ต่อยอดตรงนี้) */
export function toStructures(state: CityState): Structure[] {
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
  }));

  /**
   * เงินสด = ไซต์ก่อสร้างที่รอกลายเป็นตึก อยู่โซนแยกนอกเมือง
   *
   * ใส่ค่าเงินไว้ที่ invested เพื่อให้ไซต์ "ใหญ่ตามเงินจริง" ด้วยสเกลเดียวกับตึก
   * ปลอดภัยเพราะ totals()/topConcentration() คิดจาก holdings ไม่ได้อ่าน structures
   * ⇒ ตัวเลข "เงินที่ลงไปแล้ว" จึงไม่ขยับตามเงินสด (มีเทสต์ล็อกไว้)
   */
  const sites: Structure[] = [];
  const pushSite = (id: string, label: string, value: number) => {
    if (value <= 0) return;
    sites.push({
      id,
      kind: "site",
      label,
      sublabel: "เงินสดรอลงทุน",
      invested: value,
      units: 0,
      health: null,
      isFree: false,
      district: CASH_ZONE,
      marketValue: value,
    });
  };

  if (state.cash) {
    pushSite("cash-usd", "USD", state.cash.usd * state.fxRate);
    pushSite("cash-thb", "THB", state.cash.thb);
  }

  return [...towers, ...sites];
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
