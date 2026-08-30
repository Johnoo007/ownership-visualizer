import type { Structure } from "./types";

/**
 * ระยะห่างระหว่างแปลง (pitch) แยกจากขนาดฐานตึก — ต้องมีช่องว่างคั่น
 * ไม่งั้นตึกจะเบียดกันเป็นก้อนตันจนแยกไม่ออกว่ามีกี่หลัง
 */
export const PITCH_W = 112;
export const PITCH_H = 56;

/** ขนาดฐานตึกแบบ 2:1 isometric */
export const TILE_W = 68;
export const TILE_H = 34;

/**
 * ความสูงตึก: ต่ำสุดแค่พอให้เห็นว่ามีตึก — ไม่ใช่เพื่อปลอบใจตัวเล็ก
 * MIN_H ต้องเล็กจริงๆ ไม่งั้นตัวที่ลงเงินหลักหมื่นจะดูเท่ากับตัวที่ลงเงิน 0
 */
export const MIN_H = 5;

/** เกินนี้เส้นชั้นจะถี่จนเละ เปลี่ยนไปวาดเป็น texture แทน */
export const MAX_DRAWN_FLOORS = 40;

export type Point = { x: number; y: number };

/** จุดกึ่งกลางของแปลง (gx, gy) ในระบบพิกัด iso */
export function tileCenter(gx: number, gy: number): Point {
  return {
    x: (gx - gy) * (PITCH_W / 2),
    y: (gx + gy) * (PITCH_H / 2),
  };
}

/** สี่มุมของ rhombus รอบจุดกึ่งกลาง (N/E/S/W) */
export function rhombus(center: Point, lift = 0): [Point, Point, Point, Point] {
  const { x, y } = center;
  const cy = y - lift;
  return [
    { x, y: cy - TILE_H / 2 }, // N
    { x: x + TILE_W / 2, y: cy }, // E
    { x, y: cy + TILE_H / 2 }, // S
    { x: x - TILE_W / 2, y: cy }, // W
  ];
}

export function polygonPoints(points: Point[]): string {
  return points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

/**
 * ไม้บรรทัดของเมือง: ฿ ต่อความสูง 1 พิกเซล — **ค่าคงที่ตลอดอายุแอป ห้ามเปลี่ยน**
 *
 * ⚠️ ของเดิมเป็นขั้นบันได ×√2 ที่ปรับตามตึกใหญ่สุด แล้วมันพังตรงนี้:
 * พอตึกที่สูงสุดโตทะลุขั้น ไม้บรรทัดจะกระโดด **ตึกทุกหลังในเมืองหดพร้อมกัน 29%**
 * ตัวอย่าง: ตึก ~฿90,000 → เติมอีก ฿24,000 แล้ว **เตี้ยลงจาก 356px เหลือ 261px**
 * ส่วน GOOGL ที่ไม่ได้แตะเลยหดจาก 159px เหลือ 112px
 * ⇒ เมืองหดตอนเจ้าของทำสิ่งที่ถูกที่สุดคือเติมเงิน ซึ่งขัดสัญญาข้อแรกของแอปตรงๆ
 *
 * ไม้บรรทัดที่ขยับได้ = ความคืบหน้าถูกกินคืนเป็นระยะ · ตรึงไว้แล้วตึกจะไม่มีวันหด
 * เมืองสูงเกินจอเมื่อไหร่ ให้ **กล้องถอยออก** (viewBox ขยายเอง) ไม่ใช่ให้ตึกเตี้ยลง
 * ต่างกันตรงที่ถอยกล้องแล้วสัดส่วนตึกต่อที่ดินยังเท่าเดิม ตาอ่านออกว่าเมืองใหญ่ขึ้น
 *
 * เลข 320 มาจากการรักษาหน้าตาเมือง ณ วันที่เปลี่ยน (ตึก ~฿90,000 ≈ 281px ≈ ของเดิม)
 */
export const THB_PER_PX = 320;

/**
 * ความสูงเป็นสัดส่วนตรงกับเงินที่ลงไป (linear ห้าม log)
 * log จะทำให้ตัวที่แทบไม่มีอะไรดูใหญ่เกินจริง — ตัวเล็กควรเห็นว่าเล็ก
 *
 * ไม่มีเพดาน: เพดานคือสิ่งที่บังคับให้ต้องมีไม้บรรทัดปรับได้ตั้งแต่แรก
 */
export function heightFor(invested: number): number {
  // ลงเงิน 0 (ของที่ได้มาฟรี) = ไม่มีตึก เหลือแค่ที่ดิน — ตรงกฎ "ความสูง = เงินที่ลงไป"
  // ถ้าดัน MIN_H ให้ ตึก ฿0 จะสูงเท่าตึก ฿1,572 ซึ่งโกหกสายตา
  if (invested <= 0) return 0;
  return Math.max(MIN_H, invested / THB_PER_PX);
}

/**
 * เพดานความสูงต่อ "หนึ่งตึก" — เกินนี้ให้ขึ้นตึกใหม่ข้างๆ แทนที่จะยืดตึกเดิม
 *
 * ทำไมต้องมี: ไม้บรรทัดตรึง (THB_PER_PX) แก้ปัญหาตึกหดได้ แต่ทำให้ตึกกลายเป็น
 * เข็มเมื่อพอร์ตโต — ที่ ฿560,000 ตึกเดียวจะสูง 25.7 เท่าของความกว้างแปลง
 * แตกเป็นหลายตึกแล้วอัตราส่วนค้างที่ 5.9 เท่าตลอดไป ไม่ว่าพอร์ตจะโตแค่ไหน
 *
 * ⚠️ กฎเหล็ก: **ห้ามผ่าตึกเดิมออกเป็นหลายส่วนเท่าๆ กัน**
 * (฿142,364 → 2 ตึก ตึกละ 222px = ตึกเดิมหดจาก 445px ซึ่งคือบั๊ก √2 กลับมา)
 * ตึกที่เต็มเพดานแล้วต้อง **ค้างที่เพดานตลอดไป** แล้วให้ตึกใหม่โตจากศูนย์ข้างๆ
 * ⇒ ความสูงของทุกตึกเป็นฟังก์ชันไม่ลดของเงิน · เดินเงิน ฿0→฿800,000 ทีละไม้
 *   แล้วไม่มีตึกไหนเตี้ยลงแม้แต่ครั้งเดียว (มีเทสต์ล็อก)
 */
export const TOWER_CAP_PX = 400;
export const TOWER_CAP_THB = TOWER_CAP_PX * THB_PER_PX;

/**
 * แบ่งเงินของหนึ่งรายการเป็นความสูงของตึกแต่ละหลัง
 * หลังก่อนหน้าเต็มเพดานเสมอ หลังสุดท้ายคือหลังที่กำลังก่อสร้าง
 */
export function towerHeights(invested: number): number[] {
  const h = heightFor(invested);
  if (h <= TOWER_CAP_PX) return [h];

  const full = Math.floor(invested / TOWER_CAP_THB);
  const rest = heightFor(invested - full * TOWER_CAP_THB);
  const out = Array.from({ length: full }, () => TOWER_CAP_PX);
  // เศษที่เล็กกว่า MIN_H ยังต้องขึ้นเป็นตึกใหม่ ไม่งั้นตึกจะวูบหายตอนข้ามเพดานพอดี
  if (invested - full * TOWER_CAP_THB > 0) out.push(rest);
  return out;
}

export type PlacedStructure = {
  structure: Structure;
  /** ตึกหลังที่เท่าไหร่ของรายการนี้ (0 = หลังแรก) — หลังสุดท้ายคือหลังที่กำลังสร้าง */
  partIndex: number;
  partCount: number;
  gx: number;
  gy: number;
  center: Point;
  height: number;
  /** ยิ่งมากยิ่งอยู่หน้า — ใช้เรียงลำดับการวาด */
  depth: number;
};

export type DistrictLayout = {
  id: string;
  placed: PlacedStructure[];
  /** แถวแรกของเขตนี้ในกริดรวม */
  startRow: number;
  /** แถวที่เขตนี้กินไปในกริดรวม */
  rows: number;
};

export type CityLayout = {
  districts: DistrictLayout[];
  all: PlacedStructure[];
  bounds: { minX: number; minY: number; width: number; height: number };
};

const DISTRICT_GAP = 2;

/**
 * จัดผังเมือง: เขตเรียงถอยหลังไปข้างหลัง, ในเขตเรียงเงินมาก→น้อย
 * ตัวใหญ่ถูกดันไปอยู่แถวหลัง (gx+gy น้อย) เพื่อไม่ให้บังตึกเตี้ยด้านหน้า
 */
export function layoutCity(
  structures: Structure[],
  districtOrder: string[],
  /** เขตที่ให้ไปอยู่ "อีกทิศ" (ยื่นออกไปตามแกน gx) แทนที่จะต่อแถวลงมา */
  asideDistricts: string[] = [],
): CityLayout {
  const districts: DistrictLayout[] = [];
  const all: PlacedStructure[] = [];
  let rowOffset = 0;

  const place = (
    districtId: string,
    originX: number,
    originY: number,
  ): number => {
    const rows_ = structures
      .filter((s) => s.district === districtId)
      .sort((a, b) => b.invested - a.invested);

    if (rows_.length === 0) return 0;

    /**
     * รายการเดียวอาจกินหลายแปลง — เงินเกินเพดานแล้วขึ้นตึกใหม่ข้างๆ
     * ตึกของรายการเดียวกันเรียงติดกัน จะได้อ่านเป็น "กลุ่มอาคารของตัวนั้น"
     */
    const parts = rows_.flatMap((structure) => {
      const heights = towerHeights(structure.invested);
      return heights.map((height, partIndex) => ({
        structure,
        height,
        partIndex,
        partCount: heights.length,
      }));
    });

    const cols = Math.max(1, Math.ceil(Math.sqrt(parts.length)));
    const placed: PlacedStructure[] = parts.map((part, i) => {
      const gx = (i % cols) + originX;
      const gy = Math.floor(i / cols) + originY;
      return {
        ...part,
        gx,
        gy,
        center: tileCenter(gx, gy),
        depth: gx + gy,
      };
    });

    const usedRows = Math.ceil(parts.length / cols);
    districts.push({ id: districtId, placed, startRow: originY, rows: usedRows });
    all.push(...placed);
    return usedRows;
  };

  // เขตหลักเรียงต่อกันลงมาตามแกน gy
  for (const districtId of districtOrder) {
    if (asideDistricts.includes(districtId)) continue;
    const used = place(districtId, 0, rowOffset);
    if (used > 0) rowOffset += used + DISTRICT_GAP;
  }

  // เขตที่แยกออกไปอีกทิศ — ยื่นไปตามแกน gx จากขอบขวาของเมือง
  const mainMaxGx = all.length > 0 ? Math.max(...all.map((p) => p.gx)) : 0;
  let asideX = mainMaxGx + DISTRICT_GAP + 1;
  for (const districtId of asideDistricts) {
    const before = all.length;
    place(districtId, asideX, 0);
    const added = all.slice(before);
    if (added.length > 0) {
      asideX += Math.max(...added.map((p) => p.gx)) - asideX + 1 + DISTRICT_GAP;
    }
  }

  // ไกลไปใกล้ — ตึกหน้าทับตึกหลังได้ถูกต้อง
  all.sort((a, b) => a.depth - b.depth || a.gx - b.gx);

  return { districts, all, bounds: boundsOf(all) };
}

export type CellKind = "plot" | "road" | "vacant" | "grass";

export type GroundCell = {
  gx: number;
  gy: number;
  kind: CellKind;
  center: Point;
  depth: number;
  /** ของประดับ — deterministic ไม่กระพริบตอน re-render */
  decor: "none" | "tree" | "bush" | "car" | "lamp" | "person";
  /**
   * แนวของถนนช่องนี้ — รถ เส้นแบ่งเลน และคนเดินริมทางต้องอิงตามนี้
   * "x" = ถนนพาดตามแกนที่ gx เพิ่ม · "y" = ตามแกนที่ gy เพิ่ม · "both" = สี่แยก
   */
  roadAxis?: "x" | "y" | "both";
};

/**
 * ระยะขยายพื้นออกไปรอบเมือง (หน่วยช่อง)
 * ตั้งใจให้พื้นล้นออกนอกกรอบภาพ — ถ้าเห็นขอบพื้นครบทุกด้าน เมืองจะดูเหมือน
 * แผ่นดินลอยในอวกาศแล้วรู้สึกเล็ก · bounds จงใจไม่นับระยะนี้ (ดู boundsOf)
 */
const GROUND_PAD = 6;

/** ระยะที่ยังวางต้นไม้/คน/รถ — ไกลกว่านี้ปล่อยเป็นพื้นโล่ง กันรกและกันช้า */
const DECOR_REACH = 3;

/**
 * ระยะที่ถือว่ายังอยู่ใน "ผังเมืองของเรา" — แปลงจัดสรรที่ตัดถนนรอไว้แล้วแต่ยังว่าง
 * จงใจไม่ใส่เมืองของคนอื่นรอบๆ เพราะไม่มีข้อมูลจริงว่าใครถืออะไร
 * (ถ้าใส่ = สกอร์บอร์ดที่เทียบกับตัวเลขที่เราแต่งเอง)
 */
const PLAN_REACH = 4;

/** ระยะห่างขั้นต่ำระหว่างถนนสองสาย (หน่วยช่อง) */
const ROAD_SPACING = 3;

/**
 * พื้นทั้งผืนของเมือง — แปลงที่ดินใต้ตึก, ถนนคั่นระหว่างเขต, และหญ้า/ต้นไม้รอบนอก
 * คำนวณแยกจากตึกเพราะพื้นต้องวาดก่อนเสมอ (ไม่เข้าคิว depth sort เดียวกับตึก)
 */
export function groundCells(layout: CityLayout): GroundCell[] {
  if (layout.all.length === 0) return [];

  const gxs = layout.all.map((p) => p.gx);
  const gys = layout.all.map((p) => p.gy);
  const minGx = Math.min(...gxs) - GROUND_PAD;
  const maxGx = Math.max(...gxs) + GROUND_PAD;
  const minGy = Math.min(...gys) - GROUND_PAD;
  const maxGy = Math.max(...gys) + GROUND_PAD;

  const occupied = new Set(layout.all.map((p) => `${p.gx},${p.gy}`));

  // ขอบเขตของตึกจริง (ยังไม่รวมพื้นที่ขยาย) — ใช้กำหนดโซนผังเมือง
  const tMinGx = Math.min(...gxs);
  const tMaxGx = Math.max(...gxs);
  const tMinGy = Math.min(...gys);
  const tMaxGy = Math.max(...gys);

  /**
   * ตัดถนนเป็นตารางล้อมบล็อกตึก — เลือกเฉพาะแถว/คอลัมน์ที่ไม่มีตึกอยู่เลย
   * เพื่อไม่ให้ถนนพาดทับแปลงที่สร้างไปแล้ว
   */
  const usedRows = new Set(layout.all.map((p) => p.gy));
  const usedCols = new Set(layout.all.map((p) => p.gx));

  const pickLines = (from: number, to: number, blocked: Set<number>) => {
    const lines = new Set<number>();
    let last = -Infinity;
    for (let v = from; v <= to; v++) {
      if (blocked.has(v)) continue;
      if (v - last < ROAD_SPACING) continue;
      lines.add(v);
      last = v;
    }
    return lines;
  };

  const roadRows = pickLines(minGy, maxGy, usedRows);
  const roadCols = pickLines(minGx, maxGx, usedCols);

  // ถนนคั่นระหว่างเขตต้องมีเสมอ ถึงจะชนกติกาเว้นระยะก็ตาม
  for (let i = 1; i < layout.districts.length; i++) {
    roadRows.add(layout.districts[i].startRow - 1);
  }

  const cells: GroundCell[] = [];
  for (let gy = minGy; gy <= maxGy; gy++) {
    for (let gx = minGx; gx <= maxGx; gx++) {
      const key = `${gx},${gy}`;
      const inPlan =
        gx >= tMinGx - PLAN_REACH &&
        gx <= tMaxGx + PLAN_REACH &&
        gy >= tMinGy - PLAN_REACH &&
        gy <= tMaxGy + PLAN_REACH;

      const onRow = roadRows.has(gy);
      const onCol = inPlan && roadCols.has(gx);

      let kind: CellKind = "grass";
      let roadAxis: GroundCell["roadAxis"];
      if (occupied.has(key)) kind = "plot";
      else if (onRow || onCol) {
        kind = "road";
        roadAxis = onRow && onCol ? "both" : onRow ? "x" : "y";
      } else if (inPlan) kind = "vacant";

      let decor: GroundCell["decor"] = "none";
      const r = seededRandom(`decor${gx}:${gy}`, gx * 31 + gy);
      const nearCity =
        gx >= tMinGx - DECOR_REACH &&
        gx <= tMaxGx + DECOR_REACH &&
        gy >= tMinGy - DECOR_REACH &&
        gy <= tMaxGy + DECOR_REACH;

      if (kind === "road") {
        if (r > 0.62) decor = "car";
        else if (r > 0.3) decor = "lamp";
        else if (r > 0.12) decor = "person"; // คนเดินริมถนน
      } else if (kind === "vacant") {
        // แปลงจัดสรรปล่อยโล่งเป็นหลัก มีคนเดินผ่านบ้าง
        if (r > 0.88) decor = "person";
      } else if (kind === "grass") {
        // ชานเมืองรอบผัง — ป่า/ทุ่ง
        if (r > 0.72) decor = "tree";
        else if (r > 0.58) decor = "bush";
        else if (r > 0.5 && nearCity) decor = "person";
      }

      cells.push({
        gx,
        gy,
        kind,
        center: tileCenter(gx, gy),
        depth: gx + gy,
        decor,
        roadAxis,
      });
    }
  }

  return cells.sort((a, b) => a.depth - b.depth || a.gx - b.gx);
}

function boundsOf(placed: PlacedStructure[]) {
  if (placed.length === 0) {
    return { minX: -TILE_W, minY: -TILE_H, width: TILE_W * 2, height: TILE_H * 2 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of placed) {
    minX = Math.min(minX, p.center.x - PITCH_W / 2);
    maxX = Math.max(maxX, p.center.x + PITCH_W / 2);
    // เผื่อที่ด้านบนให้ยอดตึก + ป้ายชื่อ · ด้านล่างให้ป้ายเขต
    minY = Math.min(minY, p.center.y - p.height - TILE_H / 2 - 26);
    maxY = Math.max(maxY, p.center.y + PITCH_H / 2 + 30);
  }

  // จงใจเผื่อแค่พอหายใจ ไม่นับ GROUND_PAD ทั้งก้อน — ปล่อยให้พื้นล้นออกนอกเฟรมไป
  // เพื่อให้เมืองกินพื้นที่จอมากที่สุดและมองไม่เห็นขอบแผ่นดิน
  const padX = PITCH_W * 0.75;
  const padY = PITCH_H + 24;
  return {
    minX: minX - padX,
    minY: minY - padY,
    width: maxX - minX + padX * 2,
    height: maxY - minY + padY * 2,
  };
}

export type FloorPlan = {
  /** ชั้นที่สร้างเสร็จแล้ว (หุ้นเต็มใบ) */
  fullFloors: number;
  /** ความสูงต่อ 1 หุ้น */
  floorHeight: number;
  /** เศษหุ้นที่เหลือ 0–1 — ชั้นบนสุดที่ยังสร้างไม่เสร็จ */
  partial: number;
  /** ชั้นถี่เกินกว่าจะวาดเส้นทีละชั้น */
  toodense: boolean;
};

/**
 * แบ่งความสูง (ที่มาจากเงิน) ออกเป็นชั้นตามจำนวนหุ้น
 * ⇒ ตึกสูงเท่าเงินที่ลง แต่ "นับชั้น" ได้เท่าจำนวนหุ้นที่สะสม
 */
export function floorPlan(units: number, height: number): FloorPlan {
  if (units <= 0) {
    return { fullFloors: 0, floorHeight: height, partial: 0, toodense: false };
  }
  const fullFloors = Math.floor(units);
  return {
    fullFloors,
    floorHeight: height / units,
    partial: units - fullFloors,
    toodense: units > MAX_DRAWN_FLOORS,
  };
}

/**
 * สัดส่วนหน้าต่างที่ติดไฟ จากกำไร/ขาดทุน
 * ตั้งใจไม่ใช้แดง–เขียว (panic trigger) — ใช้สว่าง ↔ หรี่แทน
 * และพื้นไม่เคยเป็น 0: ตึกที่ขาดทุนหนักก็ยังมีคนอยู่
 */
export function litRatio(health: number | null): number {
  if (health === null) return 0.8;
  if (health >= 0) return 0.55 + Math.min(health, 0.6) * 0.75;
  return Math.max(0.12, 0.55 + Math.max(health, -0.6) * 0.72);
}

/** สุ่มแบบคงที่ — หน้าต่างต้องไม่กระพริบใหม่ทุกครั้งที่ re-render */
export function seededRandom(seed: string, index: number): number {
  let h = 2166136261 ^ index;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}
