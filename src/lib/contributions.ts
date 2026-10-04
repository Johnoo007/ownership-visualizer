import type { CityState, Contribution, Holding } from "./types";

/** ตึกยังนับว่า "กำลังก่อสร้าง" กี่วันหลังเติมเงิน */
export const RECENT_DAYS = 7;

/** เล็กกว่านี้ถือเป็นเศษปัดเศษ ไม่ใช่การเติมเงินจริง */
const MIN_AMOUNT = 1;

/**
 * ต้นทุนในสกุลของตัวมันเอง — ใช้ตรวจจับการเติมเงิน
 *
 * ⚠️ ห้ามเทียบด้วยยอดบาท: ถ้า John แก้ค่าเงินอย่างเดียวโดยไม่ได้ซื้ออะไรเลย
 * ยอดบาทของทุกตัวจะขยับพร้อมกัน แล้วระบบจะบันทึกว่าเติมเงินทั้งพอร์ต
 * ซึ่งเป็นการปลอมประวัติ · ราคาตลาดไม่กระทบตัวนี้ (avgCost ไม่ขยับตามราคา)
 */
function nativeCost(h: Holding): number {
  return h.shares * h.avgCost;
}

function todayISO(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * เทียบเมืองก่อน/หลัง แล้วคืน "ไม้ที่เพิ่งเติม" — ไม่รวมของที่มีอยู่แล้ว
 *
 * ขายออก (shares ลด) → ต้นทุนลด → ไม่นับเป็นการเติม และไม่ลบขีดเก่าทิ้ง
 * เพราะไม้ที่เคยลงแรงไปมันเกิดขึ้นจริงแล้ว ขายทีหลังไม่ได้ลบอดีต
 */
export function detectContributions(
  prev: CityState,
  next: CityState,
  now: Date = new Date(),
): Contribution[] {
  if (next.isDemo) return [];

  const before = new Map(prev.holdings.map((h) => [h.ticker, h]));
  const at = todayISO(now);
  const found: Contribution[] = [];

  for (const h of next.holdings) {
    const old = before.get(h.ticker);
    const nativeDelta = nativeCost(h) - (old ? nativeCost(old) : 0);
    if (nativeDelta <= 0) continue;

    /**
     * ถ้ามีบาทที่จ่ายจริงทั้งสองฝั่ง ใช้ส่วนต่างของมันตรงๆ (แม่นที่สุด)
     * ไม่งั้นแปลงส่วนต่างสกุลเดิมด้วยค่าเงินวันนี้
     */
    const bahtDelta =
      typeof h.costTHB === "number" && typeof old?.costTHB === "number"
        ? h.costTHB - old.costTHB
        : nativeDelta * (h.currency === "USD" ? next.fxRate : 1);

    if (bahtDelta < MIN_AMOUNT) continue;
    found.push({ at, ticker: h.ticker, amountTHB: bahtDelta });
  }

  return found;
}

/** ต่อไม้ใหม่เข้าประวัติ — วันเดียวกัน ตัวเดียวกัน รวมเป็นไม้เดียว */
export function appendContributions(
  existing: Contribution[] | undefined,
  added: Contribution[],
): Contribution[] {
  if (added.length === 0) return existing ?? [];

  const list = [...(existing ?? [])];
  for (const c of added) {
    const same = list.findIndex((x) => x.at === c.at && x.ticker === c.ticker);
    if (same >= 0) list[same] = { ...list[same], amountTHB: list[same].amountTHB + c.amountTHB };
    else list.push(c);
  }
  return list.sort((a, b) => a.at.localeCompare(b.at));
}

export function contributionsFor(
  contributions: Contribution[] | undefined,
  ticker: string,
): Contribution[] {
  return (contributions ?? []).filter((c) => c.ticker === ticker);
}

/**
 * อยู่ในกรอบ "เพิ่งเติม" ไหม
 *
 * ใช้ร่วมกับกำแพงเมืองด้วย (อิฐเรืองแสง/รอยร้าว) — กรอบเวลาเดียวกันทั้งแอป
 * เพื่อไม่ให้ "เพิ่งทำ" แปลว่าคนละอย่างกันในสองที่
 *
 * ต้องกันวันที่ในอนาคตด้วย ไม่ใช่แค่เช็คว่าใหม่พอ — ไฟล์ที่ import เข้ามา
 * หรือนาฬิกาเครื่องที่ตั้งผิด ทำให้ทุกตึกขึ้นเครนพร้อมกันทั้งเมืองได้
 * (เจอตอนจำลองอนาคต: ไม้ 12 ไม้ลงวันข้างหน้า → เมืองกลายเป็นไซต์ก่อสร้างทั้งเมือง)
 */
export function inRecentWindow(at: string, now: Date): boolean {
  const t = Date.parse(`${at}T00:00:00Z`);
  if (Number.isNaN(t)) return false;
  const end = now.getTime() + 86_400_000; // เผื่อเขตเวลา 1 วัน
  return t >= now.getTime() - RECENT_DAYS * 86_400_000 && t <= end;
}

/** บาทที่เติมเข้าตัวนี้ในช่วง RECENT_DAYS วันหลังสุด — null = ไม่มีของใหม่ */
export function recentAddFor(
  contributions: Contribution[] | undefined,
  ticker: string,
  now: Date = new Date(),
): number | null {
  const sum = contributionsFor(contributions, ticker)
    .filter((c) => inRecentWindow(c.at, now))
    .reduce((acc, c) => acc + c.amountTHB, 0);
  return sum > 0 ? sum : null;
}

export type ContributionSummary = {
  /** จำนวนไม้ทั้งหมดที่เคยลง */
  rounds: number;
  totalTHB: number;
  /** ไม้ในรอบ RECENT_DAYS วันล่าสุด */
  recentTHB: number;
  recentTickers: string[];
  /** ปีปัจจุบัน */
  thisYearTHB: number;
  thisYearRounds: number;
};

export function summarize(
  contributions: Contribution[] | undefined,
  now: Date = new Date(),
): ContributionSummary {
  const list = contributions ?? [];
  const year = todayISO(now).slice(0, 4);
  const recent = list.filter((c) => inRecentWindow(c.at, now));
  const thisYear = list.filter((c) => c.at.startsWith(year));

  return {
    rounds: list.length,
    totalTHB: list.reduce((a, c) => a + c.amountTHB, 0),
    recentTHB: recent.reduce((a, c) => a + c.amountTHB, 0),
    recentTickers: [...new Set(recent.map((c) => c.ticker))],
    thisYearTHB: thisYear.reduce((a, c) => a + c.amountTHB, 0),
    thisYearRounds: thisYear.length,
  };
}
