import type { CityState, Reserve } from "./types";

/**
 * เป้าหมายกำแพง = 6 เดือน
 *
 * ธปท. แนะนำ 3–6 เดือนของรายจ่ายปกติ — เลือกขอบบนเพราะกำแพงที่ "เสร็จแล้ว"
 * ควรหมายถึงปลอดภัยจริง ไม่ใช่แค่ผ่านเกณฑ์ขั้นต่ำ
 * (อ้างอิง: สำรวจทักษะทางการเงินคนไทย ปี 2567 — มีเพียง 23.7% ที่ไปถึง 6 เดือน)
 */
export const TARGET_MONTHS = 6;

export type ReserveStatus = {
  /** กันได้กี่เดือน — null = ยังไม่ได้กรอกรายจ่าย จึงคำนวณไม่ได้ */
  months: number | null;
  /** สัดส่วนความยาวกำแพงที่สร้างแล้ว 0..1 */
  coverage: number;
  /** ยังขาดอีกกี่บาทถึงจะครบเป้า */
  gapTHB: number;
  complete: boolean;
  amountTHB: number;
  monthlyBurnTHB: number;
};

export function reserveStatus(reserve: Reserve | undefined): ReserveStatus {
  const amountTHB = reserve && reserve.amountTHB > 0 ? reserve.amountTHB : 0;
  const monthlyBurnTHB =
    reserve && reserve.monthlyBurnTHB > 0 ? reserve.monthlyBurnTHB : 0;

  // ไม่รู้รายจ่าย = บอกไม่ได้ว่ากันได้กี่เดือน · ห้ามเดาแทน ไม่งั้นกำแพงจะโกหก
  if (monthlyBurnTHB <= 0) {
    return {
      months: null,
      coverage: 0,
      gapTHB: 0,
      complete: false,
      amountTHB,
      monthlyBurnTHB: 0,
    };
  }

  const months = amountTHB / monthlyBurnTHB;
  const target = TARGET_MONTHS * monthlyBurnTHB;

  return {
    months,
    coverage: Math.max(0, Math.min(1, months / TARGET_MONTHS)),
    gapTHB: Math.max(0, target - amountTHB),
    complete: months >= TARGET_MONTHS,
    amountTHB,
    monthlyBurnTHB,
  };
}

/**
 * ⚠️ ตัวช่วยเตือนความจำ ไม่ใช่ตัวคำนวณ: เงินสำรองไม่เคยเข้าไปอยู่ในยอดใดๆ ของพอร์ต
 * ถ้าวันไหนมีใครอยากบวกมัน ให้กลับไปอ่านเหตุผลใน types.ts ก่อน
 */
export function reserveTHB(state: CityState): number {
  return reserveStatus(state.reserve).amountTHB;
}
