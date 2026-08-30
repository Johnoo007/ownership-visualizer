import { PITCH_H, PITCH_W, seededRandom, type GroundCell } from "./iso";

/**
 * ทิศทางของถนนแต่ละแนวในพิกัด isometric
 * dir = ทิศที่รถวิ่ง · perp = ทิศตั้งฉาก (ใช้ดันคนไปเดินริมทาง)
 */
export const AXIS = {
  x: { dir: [0.894, 0.447], perp: [-0.894, 0.447] },
  y: { dir: [-0.894, 0.447], perp: [0.894, 0.447] },
} as const;

export type RoadAxis = "x" | "y";

/**
 * ระยะพิกเซลจริงจากกลางช่องหนึ่งไปกลางช่องถัดไปตามแนวถนน
 *
 * ⚠️ ไม่ใช่ PITCH_W — ขยับ 1 ช่องได้ระยะ (PITCH_W/2, PITCH_H/2) = (56, 28)
 * ความยาวจริงคือด้านตรงข้ามมุมฉาก ≈ 62.6px ไม่ใช่ 112px
 * ใช้ PITCH_W ตรงๆ รถจะวิ่งไกลเกินจริง 1.79 เท่า แล้วทะลุออกนอกถนน
 */
export const CELL_STEP = Math.hypot(PITCH_W / 2, PITCH_H / 2);

/** สี่แยกไม่มีแนวชัดเจน — เลือกแบบคงที่ต่อช่อง จะได้ไม่กระพริบตอน re-render */
export function axisOf(cell: GroundCell): RoadAxis {
  if (cell.roadAxis === "both") {
    return seededRandom(`ax${cell.gx}:${cell.gy}`, 23) > 0.5 ? "x" : "y";
  }
  return cell.roadAxis === "y" ? "y" : "x";
}

/** ตำแหน่งช่องถนนที่มีจริงในเลนนั้น — ไม่ใช่แค่หัวท้าย */
export type Lane = { cells: Set<number> };

export function laneKey(cell: GroundCell): string {
  return axisOf(cell) === "x" ? `x:${cell.gy}` : `y:${cell.gx}`;
}

/**
 * รวบช่องถนนเป็นเลน โดยเก็บ "ตำแหน่งที่เป็นถนนจริง" ไว้ทั้งชุด
 *
 * ⚠️ ห้ามเก็บแค่ min/max — เลนขาดเป็นช่วงได้จริง เพราะถนนคั่นเขตถูกบังคับให้มี
 * แม้แถวนั้นจะมีตึกอยู่ (iso.ts) ช่องที่เป็นตึกจึงตัดเลนขาดกลาง
 * ถ้าใช้แค่หัวท้าย รถจะวิ่งคร่อมตึกทะลุไปโผล่อีกฝั่ง
 *
 * สี่แยกนับเป็นสมาชิกของ "ทั้งสองเลน" ไม่ใช่เลนที่ axisOf สุ่มได้
 * ไม่งั้นเลนจะมีรูตรงทุกสี่แยก แล้วรถจะจอดก่อนถึงแยกทุกคัน
 */
export function computeLanes(cells: GroundCell[]): Map<string, Lane> {
  const lanes = new Map<string, Lane>();
  const add = (key: string, pos: number) => {
    const lane = lanes.get(key);
    if (lane) lane.cells.add(pos);
    else lanes.set(key, { cells: new Set([pos]) });
  };

  for (const c of cells) {
    if (c.kind !== "road") continue;
    if (c.roadAxis === "x" || c.roadAxis === "both") add(`x:${c.gy}`, c.gx);
    if (c.roadAxis === "y" || c.roadAxis === "both") add(`y:${c.gx}`, c.gy);
  }
  return lanes;
}

export type CarRoute = {
  axis: RoadAxis;
  /** +1 = ไปทางพิกัดมากขึ้น · −1 = ไปทางน้อยลง */
  dir: 1 | -1;
  /** วิ่งได้กี่ช่องก่อนถึงช่องถนนสุดท้ายที่ยังต่อกันอยู่ */
  cellsAhead: number;
  canDrive: boolean;
};

/**
 * เส้นทางของรถหนึ่งคัน — ไล่ทีละช่องจนเจอช่องที่ไม่ใช่ถนนแล้วหยุด
 * จึงไม่มีทางข้ามช่องที่เป็นตึก/หญ้า/แปลงว่างได้เลย
 */
export function carRoute(cell: GroundCell, lane: Lane | undefined): CarRoute {
  const axis = axisOf(cell);
  const pos = axis === "x" ? cell.gx : cell.gy;

  const runLength = (step: 1 | -1): number => {
    if (!lane) return 0;
    let n = 0;
    while (lane.cells.has(pos + step * (n + 1))) n++;
    return n;
  };

  const ahead = runLength(1);
  const behind = runLength(-1);

  // สุ่มทิศก่อน ถ้าฝั่งนั้นตันค่อยกลับทิศ — ถนนจะได้ยังมีรถสวนกันสองเลน
  let dir: 1 | -1 = seededRandom(`dir${cell.gx}:${cell.gy}`, 7) > 0.5 ? 1 : -1;
  if ((dir > 0 ? ahead : behind) < 1) dir = (-dir) as 1 | -1;

  const cellsAhead = dir > 0 ? ahead : behind;
  // ตันทั้งสองฝั่ง (ถนนสั้นช่องเดียว) ก็จอดอยู่กับที่ ดีกว่าวิ่งทะลุ
  return { axis, dir, cellsAhead, canDrive: cellsAhead >= 1 };
}
