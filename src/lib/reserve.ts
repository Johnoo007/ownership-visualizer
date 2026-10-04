import { RECENT_DAYS, inRecentWindow } from "./contributions";
import type { CityState, Reserve, ReserveEvent } from "./types";

/**
 * เป้าหมายกำแพง = 6 เดือน
 *
 * ธปท. แนะนำ 3–6 เดือนของรายจ่ายปกติ — เลือกขอบบนเพราะกำแพงที่ "เสร็จแล้ว"
 * ควรหมายถึงปลอดภัยจริง ไม่ใช่แค่ผ่านเกณฑ์ขั้นต่ำ
 * (อ้างอิง: สำรวจทักษะทางการเงินคนไทย ปี 2567 — มีเพียง 23.7% ที่ไปถึง 6 เดือน)
 */
export const TARGET_MONTHS = 6;

/** ขยับน้อยกว่านี้ถือเป็นเศษปัดเศษ ไม่ใช่การก่อ/ถอนจริง */
const MIN_EVENT = 1;

export type ReserveStatus = {
  /** กันได้กี่เดือน — null = ยังไม่ได้กรอกรายจ่าย จึงคำนวณไม่ได้ */
  months: number | null;
  /** สัดส่วนความยาวกำแพงที่สร้างแล้ว 0..1 */
  coverage: number;
  /**
   * coverage เมื่อ RECENT_DAYS วันก่อน — ใช้หา "ช่วงที่เพิ่งก่อ" กับ "ช่วงที่เพิ่งพัง"
   *
   * มากกว่า coverage = เพิ่งถอนเงินออก (กำแพงหดลง → ร้าว)
   * น้อยกว่า coverage = เพิ่งก่ออิฐใหม่ (ช่วงส่วนต่างเรืองแสง)
   */
  priorCoverage: number;
  /** ยังขาดอีกกี่บาทถึงจะครบเป้า */
  gapTHB: number;
  complete: boolean;
  amountTHB: number;
  monthlyBurnTHB: number;
  /** บาทที่ก่อเข้ามาในกรอบ RECENT_DAYS วัน */
  recentAddTHB: number;
  /** บาทที่ถอนออกในกรอบ RECENT_DAYS วัน (เป็นเลขบวก) */
  recentWithdrawTHB: number;
  /** จำนวนครั้งที่ลงมือก่อทั้งหมด — หน่วยที่ไม่ถูกเจือจางเมื่อกำแพงยาวขึ้น */
  rounds: number;
  /** ครั้งที่ก่อในกรอบ RECENT_DAYS วัน */
  recentRounds: number;
};

function coverageOf(amountTHB: number, monthlyBurnTHB: number): number {
  if (monthlyBurnTHB <= 0) return 0;
  const months = Math.max(0, amountTHB) / monthlyBurnTHB;
  return Math.max(0, Math.min(1, months / TARGET_MONTHS));
}

export function reserveStatus(
  reserve: Reserve | undefined,
  now: Date = new Date(),
): ReserveStatus {
  const amountTHB = reserve && reserve.amountTHB > 0 ? reserve.amountTHB : 0;
  const monthlyBurnTHB =
    reserve && reserve.monthlyBurnTHB > 0 ? reserve.monthlyBurnTHB : 0;

  const recent = (reserve?.history ?? []).filter((e) => inRecentWindow(e.at, now));
  const recentAddTHB = recent
    .filter((e) => e.amountTHB > 0)
    .reduce((a, e) => a + e.amountTHB, 0);
  const recentWithdrawTHB = recent
    .filter((e) => e.amountTHB < 0)
    .reduce((a, e) => a - e.amountTHB, 0);

  const rounds = (reserve?.history ?? []).filter((e) => e.amountTHB > 0).length;
  const recentRounds = recent.filter((e) => e.amountTHB > 0).length;

  /**
   * ยอดก่อนหน้า = ยอดวันนี้ ถอยกลับด้วยผลรวมสุทธิของเหตุการณ์ในกรอบ
   * (ไม่แยกบวก/ลบ เพราะกำแพงมีความยาวเดียว — ก่อ 4,000 แล้วถอน 20,000
   *  ในสัปดาห์เดียวกันต้องอ่านเป็น "สุทธิแล้วหดลง" ไม่ใช่ทั้งเรืองแสงทั้งร้าว)
   */
  const priorAmountTHB = amountTHB - (recentAddTHB - recentWithdrawTHB);

  // ไม่รู้รายจ่าย = บอกไม่ได้ว่ากันได้กี่เดือน · ห้ามเดาแทน ไม่งั้นกำแพงจะโกหก
  if (monthlyBurnTHB <= 0) {
    return {
      months: null,
      coverage: 0,
      priorCoverage: 0,
      gapTHB: 0,
      complete: false,
      amountTHB,
      monthlyBurnTHB: 0,
      recentAddTHB,
      recentWithdrawTHB,
      rounds,
      recentRounds,
    };
  }

  const months = amountTHB / monthlyBurnTHB;
  const target = TARGET_MONTHS * monthlyBurnTHB;

  return {
    months,
    coverage: coverageOf(amountTHB, monthlyBurnTHB),
    priorCoverage: coverageOf(priorAmountTHB, monthlyBurnTHB),
    gapTHB: Math.max(0, target - amountTHB),
    complete: months >= TARGET_MONTHS,
    amountTHB,
    monthlyBurnTHB,
    recentAddTHB,
    recentWithdrawTHB,
    rounds,
    recentRounds,
  };
}

function todayISO(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * ก่ออิฐ (delta > 0) หรือถอนออก (delta < 0) แล้วคืน reserve ชุดใหม่
 *
 * จงใจรับ **ส่วนต่าง** ไม่ใช่ยอดรวม เพราะยอดรวมแยกไม่ออกระหว่าง
 * "ถอนเงินจริง" กับ "พิมพ์ผิดแล้วแก้ให้ถูก" — อย่างหลังต้องไม่ทำให้กำแพงร้าว
 *
 * ถอนเกินที่มี = เหลือ 0 (ติดลบไม่ได้) และเหตุการณ์บันทึกเท่าที่ถอนได้จริง
 */
export function applyReserveEvent(
  reserve: Reserve | undefined,
  deltaTHB: number,
  now: Date = new Date(),
): Reserve {
  const base: Reserve = {
    amountTHB: 0,
    monthlyBurnTHB: 0,
    ...reserve,
  };

  if (!Number.isFinite(deltaTHB) || Math.abs(deltaTHB) < MIN_EVENT) return base;

  // ถอนได้มากสุดเท่าที่มี — กำแพงไม่มีความยาวติดลบ
  const applied = Math.max(deltaTHB, -base.amountTHB);
  if (Math.abs(applied) < MIN_EVENT) return base;

  return {
    ...base,
    amountTHB: base.amountTHB + applied,
    history: appendReserveEvent(base.history, {
      at: todayISO(now),
      amountTHB: applied,
    }),
  };
}

/**
 * ต่อเหตุการณ์เข้าประวัติ — วันเดียวกัน *ทิศเดียวกัน* รวมเป็นรายการเดียว
 *
 * ⚠️ ต้องแยกทิศ ไม่งั้นวันที่ก่อ ฿5,000 แล้วถอน ฿5,000 จะหักกันเหลือ 0
 * แล้วหายไปจากประวัติทั้งที่มันเกิดขึ้นจริงสองครั้ง
 */
export function appendReserveEvent(
  existing: ReserveEvent[] | undefined,
  added: ReserveEvent,
): ReserveEvent[] {
  const list = [...(existing ?? [])];
  const same = list.findIndex(
    (e) => e.at === added.at && Math.sign(e.amountTHB) === Math.sign(added.amountTHB),
  );
  if (same >= 0) list[same] = { ...list[same], amountTHB: list[same].amountTHB + added.amountTHB };
  else list.push(added);
  return list.sort((a, b) => a.at.localeCompare(b.at));
}

/**
 * ⚠️ ตัวช่วยเตือนความจำ ไม่ใช่ตัวคำนวณ: เงินสำรองไม่เคยเข้าไปอยู่ในยอดใดๆ ของพอร์ต
 * ถ้าวันไหนมีใครอยากบวกมัน ให้กลับไปอ่านเหตุผลใน types.ts ก่อน
 */
export function reserveTHB(state: CityState): number {
  return reserveStatus(state.reserve).amountTHB;
}

export { RECENT_DAYS };
