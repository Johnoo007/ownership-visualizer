import type { CityState, Holding } from "./types";

/** สัญลักษณ์ฝั่ง Yahoo — หุ้นไทยต้องเติม .BK, FX ใช้ THB=X */
export function yahooSymbol(h: Holding): string {
  return h.currency === "THB" ? `${h.ticker}.BK` : h.ticker;
}

export const FX_SYMBOL = "THB=X";

export type SyncResult = {
  updated: string[];
  failed: string[];
  fxRate: number | null;
  fetchedAt: string;
};

/**
 * ดึงราคาล่าสุดมาทับ currentPrice — คืน state ใหม่โดยไม่แตะ shares/avgCost
 * (ราคาตลาดเปลี่ยนได้ แต่ "เงินที่ลงไปแล้ว" ห้ามถูกแก้โดยอัตโนมัติเด็ดขาด)
 */
export async function syncPrices(
  state: CityState,
): Promise<{ next: CityState; result: SyncResult }> {
  const symbols = [...new Set(state.holdings.map(yahooSymbol)), FX_SYMBOL];

  const res = await fetch(`/api/prices?symbols=${encodeURIComponent(symbols.join(","))}`);
  if (!res.ok) throw new Error("Could not fetch prices");

  const data = (await res.json()) as {
    quotes: Record<string, { price: number; currency: string }>;
    failed: string[];
    fetchedAt: string;
  };

  const updated: string[] = [];
  const failed: string[] = [];

  const holdings = state.holdings.map((h) => {
    const q = data.quotes[yahooSymbol(h)];
    // ราคาที่ได้มาต้องเป็นสกุลเดียวกับที่บันทึกไว้ ไม่งั้นตัวเลขจะเพี้ยนเงียบๆ
    if (!q || q.currency !== h.currency) {
      failed.push(h.ticker);
      return h;
    }
    updated.push(h.ticker);
    return { ...h, currentPrice: q.price };
  });

  const fx = data.quotes[FX_SYMBOL];
  const fxRate = fx && fx.price > 0 ? fx.price : null;

  return {
    next: {
      ...state,
      holdings,
      fxRate: fxRate ?? state.fxRate,
      pricesUpdatedAt: data.fetchedAt,
    },
    result: { updated, failed, fxRate, fetchedAt: data.fetchedAt },
  };
}

/** อายุของราคาเป็นชั่วโมง — null ถ้าไม่เคยอัปเดตเลย */
export function priceAgeHours(state: CityState): number | null {
  if (!state.pricesUpdatedAt) return null;
  const t = Date.parse(state.pricesUpdatedAt);
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / 3_600_000;
}

export function formatAge(hours: number | null): string {
  if (hours === null) return "never updated";
  if (hours < 1) {
    const mins = Math.max(1, Math.round(hours * 60));
    return `${mins} min ago`;
  }
  if (hours < 24) {
    const hrs = Math.round(hours);
    return `${hrs} ${hrs === 1 ? "hr" : "hrs"} ago`;
  }
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

/** เกินนี้ถือว่าเก่าจนตัวเลขกำไร/ขาดทุนเชื่อไม่ได้แล้ว */
export const STALE_HOURS = 48;
