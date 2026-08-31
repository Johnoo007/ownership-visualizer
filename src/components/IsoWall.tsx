"use client";

import { PITCH_H, PITCH_W, polygonPoints, type Point, type WallSegment } from "@/lib/iso";

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

const STONE = {
  top: "#666e78",
  front: "#4d545e",
  side: "#363c45",
  merlon: "#767e8a",
  course: "#2f343c",
  towerTop: "#6f7885",
  towerFront: "#555d68",
  towerSide: "#3b414b",
};

const RUBBLE = {
  top: "#4a4331",
  front: "#3d3728",
  side: "#2c2820",
};

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

  const palette = seg.corner
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

      {/* ป้อมมุมมีคบไฟ — บอกว่ามีคนเฝ้าอยู่ ไม่ใช่ซากปรักหักพัง */}
      {seg.corner && (
        <circle
          cx={c.x}
          cy={c.y - h - MERLON_H - 6}
          r={2.4}
          fill="#ffd88a"
          className="anim-beacon"
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

      {/* แนวหินเรียงชั้น — ตัวที่ทำให้อ่านเป็นหินก่อ ไม่ใช่แท่งคอนกรีตหล่อ */}
      {courses &&
        [0.28, 0.55, 0.82].map((t) => (
          <g key={t}>
            <line
              x1={p(-ex, ey, h * t).x}
              y1={p(-ex, ey, h * t).y}
              x2={p(ex, ey, h * t).x}
              y2={p(ex, ey, h * t).y}
              stroke={STONE.course}
              strokeWidth={1}
              opacity={0.75}
            />
            <line
              x1={p(ex, -ey, h * t).x}
              y1={p(ex, -ey, h * t).y}
              x2={p(ex, ey, h * t).x}
              y2={p(ex, ey, h * t).y}
              stroke={STONE.course}
              strokeWidth={1}
              opacity={0.6}
            />
          </g>
        ))}
    </g>
  );
}
