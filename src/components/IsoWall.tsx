"use client";

import {
  PITCH_H,
  PITCH_W,
  polygonPoints,
  seededRandom,
  type Point,
  type WallSegment,
} from "@/lib/iso";

/**
 * ความหนาของกำแพงเป็นสัดส่วนของช่องกริด
 *
 * ⚠️ เวอร์ชันแรกวาดกำแพงเต็มช่อง (กว้าง 112px สูง 26px) แล้วมันอ่านเป็น
 * "ทางด่วนคอนกรีต" ไม่ใช่กำแพง — เพราะกำแพงจริงบางและสูง ไม่ใช่แผ่นกว้างเตี้ย
 * ⇒ ยาวเต็มช่องตามแนวของมัน แต่หนาแค่ ~1/3 ช่องในแนวตั้งฉาก
 */
const THICK = 0.17;
const WALL_H = 40;
const TOWER_H = 62;
const MERLON_H = 8;

/**
 * หินต้องมี "สีของวัสดุ" ไม่ใช่เทาเปล่า
 *
 * ⚠️ เวอร์ชันก่อนใช้เทาล้วนไร้สี (#3b4453) แล้ว John บอกว่า
 * *"เหมือนสร้างไม่เสร็จ ไม่ก็ลืมระบายสี"* — ซึ่งตรงเป๊ะ มันคือ greybox
 * ทุกอย่างในเมืองนี้มีสีของวัสดุ: ตึกน้ำเงิน · หญ้าเขียว · กองทองทอง ·
 * กองอิฐ/ทรายในไซต์ก่อสร้างเป็นน้ำตาลอุ่น — มีแต่กำแพงที่ไม่มีวัสดุ
 *
 * ⇒ ใช้หินทรายอุ่นคล้ำ เข้าตระกูลเดียวกับกองอิฐ/ทรายที่มีอยู่แล้ว
 *   และตัดกับตึกน้ำเงินชัดเจน = อ่านออกทันทีว่าคนละชนิดของ
 */
const STONE = {
  top: "#6a5f4a",
  front: "#544a39",
  side: "#373026",
  merlon: "#7a6d55",
  course: "#2a2419",
  joint: "#3d3626",
  towerTop: "#75684f",
  towerFront: "#5c513d",
  towerSide: "#3d3628",
};

const FIRE = "#ffb35c";

const RUBBLE = {
  top: "#4a4331",
  front: "#3d3728",
  side: "#2c2820",
};

/**
 * อิฐที่เพิ่งก่อ — หินสดยังไม่โดนลมโดนฝน จึงสว่างและอุ่นกว่าหินเก่า
 *
 * ⚠️ ตั้งใจให้ต่างจากหินเก่าแค่ "ค่าน้ำหนัก" ไม่ใช่คนละสี — ถ้าเปลี่ยนเป็นสีอื่น
 * มันจะอ่านเป็นวัสดุคนละชนิด (กำแพงลายทาง) ไม่ใช่กำแพงเดียวกันที่เพิ่งต่อ
 */
const FRESH_STONE = {
  top: "#8d7f63",
  front: "#74674e",
  side: "#4f4634",
};

/**
 * ซากกำแพงที่พังเพราะถอนเงินออก
 *
 * ต่างจาก RUBBLE (ยังไม่เคยก่อ) ตรงที่ **มีเศษหินของจริงกองอยู่** และ
 * มีรอยไหม้/คบไฟที่ดับแล้ว ⇒ อ่านออกว่า "เคยมีกำแพงตรงนี้" ไม่ใช่ "ยังไม่ถึงคิว"
 */
const BROKEN = {
  top: "#5e4536",
  front: "#4a352a",
  side: "#33241d",
};

const CRACK = "#ff8f7d";

/**
 * กำแพงเมือง = เงินสำรองฉุกเฉิน (Kingdom v1)
 *
 * จงใจไม่ใช่ตึก: ตึกคือเงินที่กลายเป็นความเป็นเจ้าของแล้วและโตได้เรื่อยๆ
 * กำแพงคือของที่ **ไม่ทำให้เมืองใหญ่ขึ้นเลย แต่ทำให้เมืองไม่พัง**
 * สองอย่างนี้ต้องอ่านออกว่าคนละชนิดตั้งแต่แรกเห็น
 */
export function IsoWall({ segments }: { segments: WallSegment[] }) {
  if (segments.length === 0) return null;
  return (
    <g className="pixel-art">
      {segments.map((seg) => (
        <Segment key={`${seg.gx},${seg.gy}`} seg={seg} />
      ))}
    </g>
  );
}

function Segment({ seg }: { seg: WallSegment }) {
  const c = seg.center;

  /** แปลงพิกัดกริดสัมพัทธ์ (จากกึ่งกลางช่อง) เป็นพิกัดจอ */
  const p = (dx: number, dy: number, lift = 0): Point => ({
    x: c.x + ((dx - dy) * PITCH_W) / 2,
    y: c.y + ((dx + dy) * PITCH_H) / 2 - lift,
  });

  // แนวยาวของกำแพงต้องตามทิศของวง ไม่ใช่แกนเดียวทั้งเมือง
  const alongX = seg.side === "ne" || seg.side === "sw";
  // ป้อมมุมเป็นสี่เหลี่ยมจัตุรัส กำแพงเป็นแท่งยาวบาง
  const ex = seg.corner ? 0.3 : alongX ? 0.5 : THICK;
  const ey = seg.corner ? 0.3 : alongX ? THICK : 0.5;
  const h = seg.corner ? TOWER_H : WALL_H;

  if (seg.broken) {
    /**
     * ช่วงที่เพิ่งพังเพราะถอนเงินออก — ต้องอ่านออกว่า "เคยมีกำแพงตรงนี้"
     *
     * นี่คือฝั่งตรงข้ามของอิฐใหม่ และเป็นเหตุผลที่กำแพงต้องมีประวัติ:
     * ถอนเงินสำรองออกไปแล้วตัวเลขเดือนลดลงเฉยๆ มันเงียบเกินไปสำหรับสิ่งที่
     * แปลว่า "เดือนที่เคยปลอดภัยหายไปแล้ว"
     */
    return <Breach p={p} c={c} ex={ex} ey={ey} gx={seg.gx} gy={seg.gy} />;
  }

  if (!seg.built) {
    /**
     * ช่วงที่ยังไม่ได้ก่อ — ฐานรากที่ก่อค้างไว้ ต้องอ่านออกว่า "ตรงนี้คือรู"
     * รูคือเดือนที่ยังไม่มีเงินคุ้ม ซึ่งเป็นสิ่งเดียวในภาพที่ควรทำให้รู้สึกไม่สบายใจ
     */
    const stub = 6;
    return (
      <g>
        <polygon
          points={polygonPoints([p(-ex, -ey), p(ex, -ey), p(ex, ey), p(-ex, ey)])}
          fill="#211c12"
        />
        <Box p={p} ex={ex} ey={ey} h={stub} palette={RUBBLE} />
        <polygon
          points={polygonPoints([
            p(-ex, -ey, stub),
            p(ex, -ey, stub),
            p(ex, ey, stub),
            p(-ex, ey, stub),
          ])}
          fill="none"
          stroke="#8a7420"
          strokeWidth={1.2}
          strokeDasharray="6 4"
        />
      </g>
    );
  }

  if (seg.gate && seg.built) {
    return <Gate p={p} c={c} alongX={alongX} />;
  }

  const palette = seg.fresh
    ? FRESH_STONE
    : seg.corner
      ? { top: STONE.towerTop, front: STONE.towerFront, side: STONE.towerSide }
      : { top: STONE.top, front: STONE.front, side: STONE.side };

  // ใบเสมาเรียงตามแนวยาวของกำแพง — ต้องอยู่บนสันขอบนอก ไม่ใช่กลางหลังคา
  const merlonCount = seg.corner ? 2 : 4;
  const merlons = Array.from({ length: merlonCount }, (_, i) => {
    const t = (i + 0.5) / merlonCount - 0.5; // −0.5 .. 0.5 ตามแนวยาว
    return alongX && !seg.corner
      ? { mx: t, my: 0, hx: 0.5 / merlonCount - 0.04, hy: ey }
      : !alongX && !seg.corner
        ? { mx: 0, my: t, hx: ex, hy: 0.5 / merlonCount - 0.04 }
        : { mx: t * 0.9, my: 0, hx: 0.3 / merlonCount - 0.02, hy: ey };
  });

  return (
    <g>
      <ellipse
        cx={c.x}
        cy={c.y + 2}
        rx={((ex + ey) * PITCH_W) / 2}
        ry={((ex + ey) * PITCH_H) / 2}
        fill="rgba(0,0,0,0.45)"
      />

      <Box p={p} ex={ex} ey={ey} h={h} palette={palette} courses />

      {merlons.map((m, i) => (
        <Box
          key={i}
          p={(dx, dy, lift = 0) => p(m.mx + dx, m.my + dy, h + lift)}
          ex={m.hx}
          ey={m.hy}
          h={MERLON_H}
          palette={{ top: STONE.merlon, front: palette.front, side: palette.side }}
        />
      ))}

      {/*
        นั่งร้านบนอิฐที่เพิ่งก่อ — ใช้ภาษาเดียวกับนั่งร้าน/เครนของตึก (สีทองอำพัน)
        เพราะมันคือเรื่องเดียวกัน: "เพิ่งลงมือทำตรงนี้"
      */}
      {seg.fresh && <Scaffold p={p} ex={ex} ey={ey} h={h} />}

      {/*
        ไฟบนกำแพง — ตัวที่ทำให้กำแพงกลางคืนน่ามอง ไม่ใช่เนื้อหิน
        ป้อมมุมได้ไฟใหญ่กะพริบ ช่วงกำแพงได้คบไฟเล็กเว้นระยะ
      */}
      {(seg.corner || seg.torch) && (
        <Flame
          x={c.x}
          y={c.y - h - MERLON_H - (seg.corner ? 6 : 2)}
          big={seg.corner}
        />
      )}
    </g>
  );
}

/**
 * กล่องหิน 3 หน้าในมุม isometric
 *
 * หน้าที่มองเห็นคือด้าน +gy (เอียงลงซ้าย รับแสง) กับ +gx (เอียงลงขวา เป็นเงา)
 * ตรงกับกติกาแสงเดียวกับตึก คือแสงมาจากซ้ายบน
 */
function Box({
  p,
  ex,
  ey,
  h,
  palette,
  courses = false,
}: {
  p: (dx: number, dy: number, lift?: number) => Point;
  ex: number;
  ey: number;
  h: number;
  palette: { top: string; front: string; side: string };
  courses?: boolean;
}) {
  return (
    <g>
      {/* หน้ารับแสง (+gy) */}
      <polygon
        points={polygonPoints([p(-ex, ey), p(ex, ey), p(ex, ey, h), p(-ex, ey, h)])}
        fill={palette.front}
      />
      {/* หน้าเงา (+gx) */}
      <polygon
        points={polygonPoints([p(ex, -ey), p(ex, ey), p(ex, ey, h), p(ex, -ey, h)])}
        fill={palette.side}
      />
      {/* สันบน */}
      <polygon
        points={polygonPoints([
          p(-ex, -ey, h),
          p(ex, -ey, h),
          p(ex, ey, h),
          p(-ex, ey, h),
        ])}
        fill={palette.top}
      />

      {/*
        ลายก่อหิน — เส้นแนวนอนอย่างเดียวยังอ่านเป็นแท่งคอนกรีตหล่อ
        ต้องมีรอยต่อแนวตั้งสลับแถวแบบก่ออิฐ (running bond) ถึงจะอ่านเป็นหินก่อทีละก้อน
      */}
      {courses && (
        <>
          <Masonry a={p(-ex, ey)} b={p(ex, ey)} h={h} long={ex >= ey} />
          <Masonry a={p(ex, ey)} b={p(ex, -ey)} h={h} long={ey > ex} />
        </>
      )}
    </g>
  );
}

const TIMBER = "#c9a227";
const TIMBER_LIT = "#e8c46a";

/**
 * นั่งร้านบนช่วงที่เพิ่งก่อ — เสาสองต้นบนหน้ารับแสง + คานพาดกลาง
 *
 * ทำไมต้องมีทั้งที่หินสว่างกว่าอยู่แล้ว: ความต่างของเฉดหินอ่านออกยากตอนซูมออก
 * (ทั้งเมืองมองจากไกล กำแพงเป็นแถบบางๆ) แต่เส้นทองพาดขวางเห็นได้ทุกระยะ
 * — เป็นเหตุผลเดียวกับที่ตึกต้องมีเครน ไม่ใช่แค่แถบสี
 */
function Scaffold({
  p,
  ex,
  ey,
  h,
}: {
  p: (dx: number, dy: number, lift?: number) => Point;
  ex: number;
  ey: number;
  h: number;
}) {
  // หน้ารับแสงคือด้าน +gy · ไล่ตามความยาวของหน้านั้น
  const a = p(-ex, ey);
  const b = p(ex, ey);
  const at = (t: number, lift: number): Point => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t - lift,
  });

  const poles = [0.3, 0.7];
  const rail = h * 0.62;

  return (
    <g opacity={0.85}>
      {poles.map((t) => (
        <line
          key={t}
          x1={at(t, 0).x}
          y1={at(t, 0).y}
          x2={at(t, h + 4).x}
          y2={at(t, h + 4).y}
          stroke={TIMBER}
          strokeWidth={1.3}
        />
      ))}
      <line
        x1={at(0.16, rail).x}
        y1={at(0.16, rail).y}
        x2={at(0.84, rail).x}
        y2={at(0.84, rail).y}
        stroke={TIMBER_LIT}
        strokeWidth={1.1}
      />
    </g>
  );
}

/**
 * ช่วงกำแพงที่พังจากการถอนเงิน — ตอม่อเตี้ยๆ + กองหินร่วง + รอยแตก
 *
 * ⚠️ ห้ามวาดเหมือนช่วงที่ยังไม่ก่อ (RUBBLE + เส้นประ = "แบบก่อสร้าง รอคิว")
 * ตรงนี้ต้องอ่านเป็นซาก: หินคล้ำอมแดง เศษกระจาย รอยแตกสีเดียวกับตัวเลขขาดทุน
 * และ **ไม่มีไฟ** — คบไฟที่เคยติดตรงนี้ดับไปพร้อมกำแพง
 */
function Breach({
  p,
  c,
  ex,
  ey,
  gx,
  gy,
}: {
  p: (dx: number, dy: number, lift?: number) => Point;
  c: Point;
  ex: number;
  ey: number;
  gx: number;
  gy: number;
}) {
  /**
   * ⚠️ ความสูงต้องไม่เท่ากันทุกช่วง
   *
   * เวอร์ชันแรกใช้ 11px เท่ากันหมด แล้วแนวซากยาวๆ อ่านเป็น **ทางลาด**
   * ไม่ใช่ซากปรักหักพัง — ซ้ำรอยบทเรียนเดิมเป๊ะ (กำแพงรุ่นแรก = "ทางด่วนคอนกรีต"):
   * ของที่ดูไม่เหมือนของจริง ผิดที่สัดส่วนก่อนเสมอ · ของพังจริงพังไม่เท่ากัน
   * บางช่วงเหลือตอสูง บางช่วงราบไปเลย ⇒ สุ่มแบบคงที่จากพิกัด (ภาพนิ่งทุกครั้งที่วาด)
   */
  const stump = 3 + seededRandom(`breach${gx}:${gy}`, gx * 17 + gy) * 15;

  return (
    <g>
      <polygon
        points={polygonPoints([p(-ex, -ey), p(ex, -ey), p(ex, ey), p(-ex, ey)])}
        fill="#1c1410"
      />

      {/* ตอม่อที่เหลือจากกำแพงเดิม — เตี้ยกว่ากำแพงมาก แต่ไม่ราบไปกับพื้น */}
      <Box p={p} ex={ex} ey={ey} h={stump} palette={BROKEN} />

      {/*
        หินที่ร่วงลงมากองข้างซาก — หลักฐานว่าเคยมีของสูงกว่านี้ตรงนี้
        ใช้สีของหินกำแพง (ไม่ใช่สีซาก) เพราะมันคือก้อนเดียวกับที่หล่นลงมา
      */}
      {[
        { dx: -0.34, dy: 0.72, s: 3.0 },
        { dx: 0.18, dy: 0.86, s: 2.3 },
        { dx: 0.44, dy: -0.62, s: 2.7 },
        { dx: -0.5, dy: -0.34, s: 2.0 },
      ].map((r, i) => {
        const q = p(r.dx, r.dy);
        return (
          <ellipse
            key={i}
            cx={q.x}
            cy={q.y - 1}
            rx={r.s}
            ry={r.s * 0.62}
            fill={i % 2 === 0 ? STONE.front : BROKEN.top}
          />
        );
      })}

      {/* รอยแตกบนตอม่อ — เส้นหักมุม ไม่ใช่เส้นตรง ไม่งั้นอ่านเป็นรอยต่อหิน */}
      <polyline
        points={[
          `${c.x - 5},${c.y - stump - 1}`,
          `${c.x - 1},${c.y - stump * 0.55}`,
          `${c.x + 3},${c.y - stump * 0.75}`,
          `${c.x + 6},${c.y - stump * 0.25}`,
        ].join(" ")}
        fill="none"
        stroke={CRACK}
        strokeWidth={1.1}
        opacity={0.75}
      />
    </g>
  );
}

/** เปลวไฟ + แสงฟุ้ง — ใช้ภาษาเดียวกับไฟถนนในเมือง */
function Flame({ x, y, big }: { x: number; y: number; big: boolean }) {
  const r = big ? 3 : 2;
  return (
    <g className={big ? "anim-beacon" : undefined}>
      <ellipse cx={x} cy={y} rx={r * 5} ry={r * 3.4} fill={FIRE} opacity={0.12} />
      <ellipse cx={x} cy={y} rx={r * 2.4} ry={r * 1.8} fill={FIRE} opacity={0.2} />
      <circle cx={x} cy={y} r={r} fill="#ffe3ad" />
      <circle cx={x} cy={y - r * 0.6} r={r * 0.6} fill="#fff6e0" />
    </g>
  );
}

/**
 * ประตูเมือง — ป้อมสองข้างขนาบช่องเปิด มีแสงอุ่นลอดออกมา
 *
 * เหตุผลที่ต้องมี: วงกำแพงที่ปิดตายรอบด้านอ่านเป็น "กำแพงกั้น" ไม่ใช่ "เมืองมีกำแพง"
 * ประตูเป็นจุดเดียวที่บอกว่าข้างในมีคนอยู่ และเป็นจุดนำสายตาของภาพทั้งภาพ
 */
function Gate({
  p,
  c,
  alongX,
}: {
  p: (dx: number, dy: number, lift?: number) => Point;
  c: Point;
  alongX: boolean;
}) {
  const pierH = 54;
  const archH = 30;
  const half = 0.5;
  const thick = THICK;
  // เสาสองต้นขนาบ ช่องเปิดอยู่ตรงกลาง
  const piers = [-1, 1].map((sign) =>
    alongX
      ? { ox: sign * 0.34, oy: 0, ex: 0.16, ey: thick }
      : { ox: 0, oy: sign * 0.34, ex: thick, ey: 0.16 },
  );
  const lintel = alongX
    ? { ox: 0, oy: 0, ex: half, ey: thick }
    : { ox: 0, oy: 0, ex: thick, ey: half };

  return (
    <g>
      <ellipse
        cx={c.x}
        cy={c.y + 2}
        rx={PITCH_W / 2}
        ry={PITCH_H / 2.6}
        fill="rgba(0,0,0,0.45)"
      />

      {/* แสงอุ่นลอดจากช่องประตู */}
      <ellipse cx={c.x} cy={c.y + 6} rx={26} ry={12} fill={FIRE} opacity={0.16} />

      {piers.map((pier, i) => (
        <Box
          key={i}
          p={(dx, dy, lift = 0) => p(pier.ox + dx, pier.oy + dy, lift)}
          ex={pier.ex}
          ey={pier.ey}
          h={pierH}
          palette={{ top: STONE.towerTop, front: STONE.towerFront, side: STONE.towerSide }}
          courses
        />
      ))}

      {/* คานเหนือช่องประตู */}
      <Box
        p={(dx, dy, lift = 0) => p(lintel.ox + dx, lintel.oy + dy, pierH - archH + lift)}
        ex={lintel.ex}
        ey={lintel.ey}
        h={archH}
        palette={{ top: STONE.towerTop, front: STONE.towerFront, side: STONE.towerSide }}
      />

      <Flame x={c.x} y={c.y - pierH - 6} big />
    </g>
  );
}

/**
 * ลายหินก่อบนหน้ากำแพงหนึ่งหน้า
 *
 * a→b คือขอบล่างของหน้านั้น · แถวสลับกันครึ่งก้อนแบบ running bond
 * หน้าที่สั้น (ด้านสกัด) ใช้ก้อนน้อยลง ไม่งั้นลายจะถี่จนเละ
 */
function Masonry({
  a,
  b,
  h,
  long,
}: {
  a: Point;
  b: Point;
  h: number;
  long: boolean;
}) {
  const rows = 4;
  const cols = long ? 4 : 1;
  const ch = h / rows;
  const at = (t: number, lift: number): Point => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t - lift,
  });

  const lines: React.ReactElement[] = [];
  for (let r = 1; r < rows; r++) {
    const y = r * ch;
    const p0 = at(0, y);
    const p1 = at(1, y);
    lines.push(
      <line
        key={`h${r}`}
        x1={p0.x}
        y1={p0.y}
        x2={p1.x}
        y2={p1.y}
        stroke={STONE.course}
        strokeWidth={1}
        opacity={0.55}
      />,
    );
  }
  for (let r = 0; r < rows; r++) {
    for (let cIdx = 1; cIdx <= cols; cIdx++) {
      // แถวคู่/คี่เยื้องกันครึ่งก้อน
      const t = (cIdx - (r % 2 === 0 ? 0.5 : 0)) / cols;
      if (t <= 0.02 || t >= 0.98) continue;
      const p0 = at(t, r * ch);
      const p1 = at(t, (r + 1) * ch);
      lines.push(
        <line
          key={`v${r}-${cIdx}`}
          x1={p0.x}
          y1={p0.y}
          x2={p1.x}
          y2={p1.y}
          stroke={STONE.joint}
          strokeWidth={1}
          opacity={0.5}
        />,
      );
    }
  }
  return <g>{lines}</g>;
}
