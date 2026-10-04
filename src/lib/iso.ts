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
     * รายการที่กินหลายแปลงจัดเป็น "บล็อกสี่เหลี่ยม" ไม่ใช่เรียงเป็นแถวยาว
     *
     * เหตุผล: พอพอร์ตโตจนตึกชนเพดานกันหลายหลัง ความสูงจะเท่ากันหมด
     * มองปราดเดียวแยกไม่ออกว่าตัวไหนใหญ่กว่า (ปีที่ 30 มี 47% ที่ชนเพดาน)
     * ⇒ ย้ายตัวบอกขนาดจาก "ความสูง" ไปเป็น "พื้นที่ที่ยึดครอง"
     * SPYM 4 หลังกลายเป็นบล็อก 2×2 = อ่านเป็นอาณาเขต ไม่ใช่ตึกสูงเท่ากัน 4 หลัง
     *
     * ช่องที่เหลือในบล็อก (เช่น 3 หลังในบล็อก 2×2) จงใจปล่อยว่าง —
     * มันคือแปลงที่ตึกหลังถัดไปจะขึ้นพอดี
     */
    const blocks = rows_.map((structure) => {
      const heights = towerHeights(structure.invested);
      const w = Math.max(1, Math.ceil(Math.sqrt(heights.length)));
      return {
        w,
        h: Math.ceil(heights.length / w),
        parts: heights.map((height, partIndex) => ({
          structure,
          height,
          partIndex,
          partCount: heights.length,
        })),
      };
    });

    /**
     * วางบล็อกแบบ shelf packing — เรียงต่อกันไปทางขวาจนเต็มแถว แล้วขึ้นแถวใหม่
     * บล็อกใหญ่มาก่อน (เรียงเงินมาก→น้อย) จึงไปอยู่แถวหลังสุด ไม่บังตึกเตี้ยด้านหน้า
     *
     * ⚠️ เคยลองเว้นแปลงว่างคั่นระหว่างบล็อก 1 ช่อง แล้วแย่กว่าเดิม:
     * 1 ช่องกริด = 112px = ถนนกว้างมาก เมืองเลยโหรงเหรง ตึกกลับไปโดดเดี่ยวทีละหลัง
     * ⇒ คงความหนาแน่นไว้ แล้วไปบอกขอบเขตบล็อกด้วย "เส้นอาณาเขตบนพื้น" แทน
     */
    const BLOCK_GAP = 0;
    const totalParts = blocks.reduce((a, b) => a + b.parts.length, 0);
    const maxCols = Math.max(2, Math.ceil(Math.sqrt(totalParts)) + 1);

    const placed: PlacedStructure[] = [];
    let shelfX = 0;
    let shelfY = 0;
    let shelfH = 0;

    for (const block of blocks) {
      if (shelfX > 0 && shelfX + block.w > maxCols) {
        shelfY += shelfH + BLOCK_GAP;
        shelfX = 0;
        shelfH = 0;
      }
      block.parts.forEach((part, i) => {
        const gx = originX + shelfX + (i % block.w);
        const gy = originY + shelfY + Math.floor(i / block.w);
        placed.push({ ...part, gx, gy, center: tileCenter(gx, gy), depth: gx + gy });
      });
      shelfX += block.w + BLOCK_GAP;
      shelfH = Math.max(shelfH, block.h);
    }

    const usedRows = shelfY + shelfH;
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

export type CellKind = "plot" | "road" | "vacant" | "grass" | "wall";

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
  /** แปลงนี้เป็นของกลุ่มอาคารไหน (หุ้นที่กินหลายแปลง) — undefined = ตึกเดี่ยว */
  blockId?: string;
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
export function groundCells(
  layout: CityLayout,
  /**
   * ช่องที่กำแพงยืนอยู่ (เฉพาะช่วงที่ก่อแล้ว และไม่ใช่ประตู)
   *
   * ต้องส่งเข้ามาเพราะ **กำแพงต้องตัดถนน** ไม่งั้นรถจะวิ่งทะลุกำแพงออกไปข้างนอก
   * ช่วงที่ยังไม่ได้ก่อจงใจไม่กั้น — รูคือรูจริง รถลอดออกไปได้ ตรงกับความหมาย
   * ส่วนประตูก็ปล่อยเป็นถนน รถจะได้วิ่งผ่านประตูได้เหมือนเมืองจริง
   */
  blocked: ReadonlySet<string> = new Set(),
): GroundCell[] {
  // ล้อมทุกอย่างที่อยู่บนแผนที่ ทั้งตึกและไซต์เงินสด
  const gxs = layout.all.map((p) => p.gx);
  const gys = layout.all.map((p) => p.gy);
  const minGx = Math.min(...gxs) - GROUND_PAD;
  const maxGx = Math.max(...gxs) + GROUND_PAD;
  const minGy = Math.min(...gys) - GROUND_PAD;
  const maxGy = Math.max(...gys) + GROUND_PAD;

  const occupied = new Set(layout.all.map((p) => `${p.gx},${p.gy}`));
  /**
   * แปลงของหุ้นที่กินหลายแปลง — ใช้ตีเส้นอาณาเขตให้เห็นว่าบล็อกนี้เป็นผืนเดียวกัน
   * พอตึกชนเพดานกันหมด ความสูงบอกขนาดไม่ได้แล้ว ต้องให้ "พื้นที่" เป็นตัวบอกแทน
   */
  const blockOf = new Map<string, string>();
  for (const p of layout.all) {
    if (p.partCount > 1) blockOf.set(`${p.gx},${p.gy}`, p.structure.id);
  }

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

  /**
   * นอกกำแพงคือ "นอกเมือง" — ห้ามมีรถหรือคนอยู่ตรงนั้น
   * เหลือแค่ต้นไม้กับพุ่มไม้ ให้อ่านเป็นป่านอกอาณาเขต ไม่ใช่ชานเมืองที่มีชีวิต
   */
  const wb = wallBounds(layout);
  const insideWall = (gx: number, gy: number) =>
    !wb || (gx > wb.x0 && gx < wb.x1 && gy > wb.y0 && gy < wb.y1);

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
      if (blocked.has(key)) kind = "wall";
      else if (occupied.has(key)) kind = "plot";
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

      if (kind === "wall") {
        decor = "none";
      } else if (kind === "road") {
        if (r > 0.62) decor = "car";
        else if (r > 0.3) decor = "lamp";
        else if (r > 0.12) decor = "person"; // คนเดินริมถนน
        // ถนนนอกกำแพงเหลือแค่ไฟส่องทาง ไม่มีรถไม่มีคน
        if (!insideWall(gx, gy) && decor !== "lamp") decor = "none";
      } else if (kind === "vacant") {
        // แปลงจัดสรรปล่อยโล่งเป็นหลัก มีคนเดินผ่านบ้าง
        if (r > 0.88) decor = "person";
      } else if (kind === "grass") {
        // ชานเมืองรอบผัง — ป่า/ทุ่ง
        if (r > 0.72) decor = "tree";
        else if (r > 0.58) decor = "bush";
        else if (r > 0.5 && nearCity && insideWall(gx, gy)) decor = "person";
      }

      cells.push({
        gx,
        gy,
        kind,
        center: tileCenter(gx, gy),
        depth: gx + gy,
        decor,
        roadAxis,
        blockId: blockOf.get(key),
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

/**
 * กำแพงอยู่ห่างจากของชิ้นนอกสุดกี่ช่อง
 *
 * ล้อม "ทั้งแผนที่" ไม่ใช่แค่กระจุกตึก (John เคาะ) — เหตุผลเชิงความหมายด้วย:
 * เงินสำรองปกป้องทุกอย่างที่เรามี ไม่ใช่เฉพาะส่วนที่กลายเป็นหุ้นแล้ว
 * ไซต์เงินสดจึงต้องอยู่ในกำแพงด้วย
 *
 * ตั้งไว้ต่ำกว่า GROUND_PAD อยู่ 2 ช่อง เพื่อให้ยังเห็นผืนดินนอกกำแพง
 * ถ้าเท่ากันพอดี กำแพงจะไปแปะขอบภาพ อ่านเป็นกรอบรูปแทนที่จะเป็นกำแพง
 */
const WALL_MARGIN = 4;

export type WallSegment = {
  gx: number;
  gy: number;
  center: Point;
  depth: number;
  /** สร้างแล้วหรือยัง — ยังไม่สร้าง = ตอม่อเปล่า เห็นเป็นช่องโหว่ */
  built: boolean;
  /**
   * เพิ่งก่อในกรอบไม่กี่วันนี้ — อิฐใหม่ยังเรืองแสง มีนั่งร้าน
   *
   * นี่คือช่องทาง feedback ของกำแพง เทียบเท่า "เครน + ขีด DCA" ของตึก:
   * เติมเงินสำรอง ฿4,000 ทำให้ตัวเลขเดือนขยับนิดเดียวเสมอ แต่ "อิฐใหม่ 2 ก้อน"
   * เป็นของที่เห็นได้เต็มๆ และไม่ถูกเจือจางเมื่อกำแพงยาวขึ้น
   */
  fresh: boolean;
  /**
   * เคยก่อไว้แล้วเพิ่งพังเพราะถอนเงินออก — คนละความหมายกับ "ยังไม่ได้ก่อ"
   *
   * ต้องแยกให้เห็น: ตอม่อเปล่า = ยังไม่เคยถึงตรงนี้ · ซากร้าว = เคยปลอดภัยแล้วเสียไป
   * ถ้าวาดเหมือนกันหมด การถอนเงินจะเงียบสนิท ซึ่งเป็นสิ่งที่ไม่ควรเงียบที่สุด
   */
  broken: boolean;
  /** ด้านไหนของวง ใช้เลือกทิศวางตัวกำแพง */
  side: "nw" | "ne" | "se" | "sw";
  /** มุมของวง วาดเป็นป้อม */
  corner: boolean;
  /** ประตูเมือง — จุดเดียวที่เข้าออกได้ อยู่ด้านหน้าสุดเพื่อให้เป็นจุดนำสายตา */
  gate: boolean;
  /** มีคบไฟบนสันกำแพง — เว้นระยะ ไม่ใช่ทุกช่วง */
  torch: boolean;
};

/**
 * วงกำแพงล้อมเมือง — Kingdom v1
 *
 * สัดส่วนที่สร้างแล้วคือ "ความยาว" ไม่ใช่ "ความสูง" โดยตั้งใจ:
 * กำแพงเตี้ยทั้งวงยังแปลว่าล้อมครบ แต่กำแพงสูงครึ่งวงแปลว่ามีรูให้เดินเข้า
 * ⇒ ช่องโหว่ = เดือนที่ยังไม่มีเงินคุ้ม ซึ่งเป็นสิ่งที่ต้องรู้สึกได้ ไม่ใช่ตัวเลข
 *
 * เริ่มก่อจากด้านหลังไล่มาข้างหน้า ⇒ **รูอยู่ด้านหน้าเสมอ มองเห็นแน่นอน**
 * (ถ้าให้รูไปอยู่หลังเมือง มันจะถูกตึกบังแล้วความรู้สึก "ยังไม่ปลอดภัย" หายไป)
 */
/**
 * กรอบภาพที่เผื่อที่ให้วงกำแพงแล้ว — ต้องใช้แทน layout.bounds ตอนตั้ง viewBox
 * ไม่งั้นกล้องจะเล็งเฉพาะตึก แล้วกำแพงโดนตัดขอบหายไปครึ่งวง
 */
export type Bounds = { minX: number; minY: number; width: number; height: number };

/**
 * รวมสองกรอบให้เป็นกรอบเดียวที่คลุมทั้งคู่
 *
 * ใช้ตอนย้อนดูอดีต: กล้องต้องเล็ง **กรอบเดียวกับวันนี้** ไม่ใช่เล็งเมืองในอดีตใหม่
 *
 * ⚠️ ถ้าปล่อยให้กล้องเล็งใหม่ตามเมืองที่วาด จะเกิดสองปัญหาพร้อมกัน:
 * (1) ภาพกระโดดทุกครั้งที่กดสลับวัน — John: *"พอขยับแล้วมันรู้สึกแปลกๆ"*
 * (2) หนักกว่านั้น **การเติบโตหายไปจากภาพ** เพราะเมืองอดีตที่เล็กกว่าจะถูก
 *     ซูมเข้าจนเต็มจอเท่าเมืองวันนี้ ⇒ เทียบแล้วดูเท่ากัน ทั้งที่มันโตขึ้นจริง
 *
 * เป็นกฎเดียวกับที่ตกลงกันไว้ตอนตรึงไม้บรรทัดความสูง: **กล้องขยับได้ แต่ห้าม
 * ขยับจนกลบความจริงที่ต้องการให้เห็น** (เมืองสูงเกินจอ → กล้องถอย ไม่ใช่ตึกเตี้ยลง)
 */
export function unionBounds(a: Bounds, b: Bounds): Bounds {
  const minX = Math.min(a.minX, b.minX);
  const minY = Math.min(a.minY, b.minY);
  const maxX = Math.max(a.minX + a.width, b.minX + b.width);
  const maxY = Math.max(a.minY + a.height, b.minY + b.height);
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

export function boundsWithWall(layout: CityLayout, segments: WallSegment[]) {
  const b = layout.bounds;
  if (segments.length === 0) return b;

  let minX = b.minX;
  let maxX = b.minX + b.width;
  let minY = b.minY;
  let maxY = b.minY + b.height;

  for (const w of segments) {
    minX = Math.min(minX, w.center.x - PITCH_W / 2 - 8);
    maxX = Math.max(maxX, w.center.x + PITCH_W / 2 + 8);
    minY = Math.min(minY, w.center.y - PITCH_H / 2 - 52);
    maxY = Math.max(maxY, w.center.y + PITCH_H / 2 + 8);
  }

  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

/**
 * กรอบสี่เหลี่ยมที่กำแพงวางอยู่ — ล้อมทุกอย่างบนแผนที่ ทั้งตึกและไซต์เงินสด
 *
 * แยกออกมาเพราะพื้นดินก็ต้องรู้ว่า "ตรงไหนคือในกำแพง" ด้วย
 * ไม่งั้นจะมีรถวิ่งอยู่นอกเมืองทั้งที่ข้างนอกควรเป็นป่า
 */
export function wallBounds(layout: CityLayout) {
  if (layout.all.length === 0) return null;
  const gxs = layout.all.map((p) => p.gx);
  const gys = layout.all.map((p) => p.gy);
  return {
    x0: Math.min(...gxs) - WALL_MARGIN,
    x1: Math.max(...gxs) + WALL_MARGIN,
    y0: Math.min(...gys) - WALL_MARGIN,
    y1: Math.max(...gys) + WALL_MARGIN,
  };
}

/**
 * @param coverage      สัดส่วนที่ก่อแล้ววันนี้ 0..1
 * @param priorCoverage สัดส่วนเมื่อไม่กี่วันก่อน — ส่วนต่างคือ "อิฐใหม่" หรือ "รอยร้าว"
 *                      ไม่ส่งมา = ไม่มีอะไรเพิ่งเกิดขึ้น (กำแพงนิ่ง)
 */
export function wallRing(
  layout: CityLayout,
  coverage: number,
  priorCoverage?: number,
): WallSegment[] {
  const b = wallBounds(layout);
  if (!b) return [];
  const { x0, x1, y0, y1 } = b;

  const ring: Array<{ gx: number; gy: number; side: WallSegment["side"]; corner: boolean }> = [];
  const push = (gx: number, gy: number, side: WallSegment["side"]) =>
    ring.push({
      gx,
      gy,
      side,
      corner: (gx === x0 || gx === x1) && (gy === y0 || gy === y1),
    });

  // ไล่ตามเข็ม เริ่มมุมหลังสุด (x0,y0) — ด้านหลังก่อน ด้านหน้าทีหลัง
  for (let gx = x0; gx <= x1; gx++) push(gx, y0, "ne");
  for (let gy = y0 + 1; gy <= y1; gy++) push(x1, gy, "se");
  for (let gx = x1 - 1; gx >= x0; gx--) push(gx, y1, "sw");
  for (let gy = y1 - 1; gy > y0; gy--) push(x0, gy, "nw");

  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const builtCount = Math.round(clamp01(coverage) * ring.length);
  const priorCount =
    priorCoverage === undefined
      ? builtCount
      : Math.round(clamp01(priorCoverage) * ring.length);

  /**
   * ⚠️ ลำดับใน ring ใช้ตัดสินว่า "ก่อถึงไหนแล้ว" เท่านั้น ห้ามใช้เป็นลำดับการวาด
   *
   * วงไล่ตามเข็ม: ด้านบน (gx เพิ่ม) กับด้านขวา (gy เพิ่ม) บังเอิญได้ความลึกเพิ่มขึ้น
   * ตามลำดับพอดี แต่ด้านล่าง (gx ลด) กับด้านซ้าย (gy ลด) ไล่ย้อนกลับ
   * ⇒ ถ้าวาดตามลำดับวง สองด้านนั้นจะเอาช่วงที่อยู่ไกลกว่าไปวาดทับช่วงที่อยู่ใกล้กว่า
   *   กำแพงเลยดูเป็นก้อนซ้อนผิดรูป (John: "โอเคแค่สองด้าน อีกสองด้านยังผิด")
   * ⇒ ต้องเรียงตามความลึกก่อนคืนออกไปเสมอ แบบเดียวกับตึก
   */
  /**
   * ประตูเมืองอยู่กลางด้านหน้าสุด (sw) — กำแพงที่ปิดตายรอบด้านอ่านเป็นคุก
   * ไม่ใช่เมือง · ประตูทำให้วงมีจุดนำสายตาและบอกว่าข้างในมีคนอยู่
   */
  const frontIdx = ring
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.side === "sw" && !r.corner)
    .map(({ i }) => i);
  const gateIdx = frontIdx.length > 0 ? frontIdx[Math.floor(frontIdx.length / 2)] : -1;

  return ring
    .map((r, i) => ({
      ...r,
      center: tileCenter(r.gx, r.gy),
      depth: r.gx + r.gy,
      built: i < builtCount,
      // อิฐใหม่ = ช่วงที่วันก่อนยังไม่มี · ซากร้าว = ช่วงที่วันก่อนมีแล้วตอนนี้ไม่มี
      fresh: i < builtCount && i >= priorCount,
      broken: i >= builtCount && i < priorCount,
      gate: i === gateIdx,
      // คบไฟทุก 3 ช่วง — ถี่กว่านี้จะกลายเป็นไฟวิ่ง ห่างกว่านี้จะดูร้าง
      torch: !r.corner && i % 3 === 1,
    }))
    .sort((a, b) => a.depth - b.depth || a.gx - b.gx);
}
