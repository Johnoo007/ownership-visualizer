import type { CityState } from "./types";

/**
 * เมืองตัวอย่าง — ตัวเลขสมมติทั้งหมด ไม่ใช่พอร์ตของใคร
 * มีไว้ให้เปิดแอปครั้งแรกแล้วเห็นเมืองเลย ไม่ใช่หน้าว่างที่ต้องกรอก 15 ตัวก่อน
 * UI ต้องติดป้ายว่าเป็นตัวอย่างเสมอ (state.isDemo)
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
      // ของที่ได้มาฟรี — ต้นทุน 0 คิด % ไม่ได้ ต้องยังโผล่ในเมือง
      { ...d("GLD", "SPDR Gold Shares", 0.5, 0, 234.8), avgCost: 0 },
      // เขตที่ 2 สกุลบาท
      d("SCB", "SCB X", 100, 128, 131, "THB", "goldengoose"),
      d("PTT", "PTT", 200, 31.5, 30.25, "THB", "goldengoose"),
    ],
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
