"use client";

import { useMemo } from "react";
import {
  PITCH_H,
  PITCH_W,
  polygonPoints,
  seededRandom,
  type GroundCell,
  type Point,
} from "@/lib/iso";

const FILL: Record<GroundCell["kind"], string> = {
  plot: "var(--plot)",
  road: "var(--road)",
  vacant: "var(--vacant)",
  grass: "var(--grass)",
};

/**
 * ทิศทางของถนนแต่ละแนวในพิกัด isometric
 * dir = ทิศที่รถวิ่ง · perp = ทิศตั้งฉาก (ใช้ดันคนไปเดินริมทาง)
 */
const AXIS = {
  x: { dir: [0.894, 0.447], perp: [-0.894, 0.447] },
  y: { dir: [-0.894, 0.447], perp: [0.894, 0.447] },
} as const;

/** สี่แยกไม่มีแนวชัดเจน — เลือกแบบคงที่ต่อช่อง จะได้ไม่กระพริบตอน re-render */
function axisOf(cell: GroundCell): "x" | "y" {
  if (cell.roadAxis === "both") {
    return seededRandom(`ax${cell.gx}:${cell.gy}`, 23) > 0.5 ? "x" : "y";
  }
  return cell.roadAxis === "y" ? "y" : "x";
}

function rhombus(c: Point, w: number, h: number): Point[] {
  return [
    { x: c.x, y: c.y - h / 2 },
    { x: c.x + w / 2, y: c.y },
    { x: c.x, y: c.y + h / 2 },
    { x: c.x - w / 2, y: c.y },
  ];
}

/** ปลายเลนถนนแต่ละสาย — ใช้จำกัดระยะวิ่งของรถไม่ให้เลยถนนไปอยู่บนหญ้า */
type Lane = { min: number; max: number };

function laneKey(cell: GroundCell): string {
  return axisOf(cell) === "x" ? `x:${cell.gy}` : `y:${cell.gx}`;
}

function computeLanes(cells: GroundCell[]): Map<string, Lane> {
  const lanes = new Map<string, Lane>();
  for (const c of cells) {
    if (c.kind !== "road") continue;
    const key = laneKey(c);
    const pos = axisOf(c) === "x" ? c.gx : c.gy;
    const cur = lanes.get(key);
    lanes.set(
      key,
      cur
        ? { min: Math.min(cur.min, pos), max: Math.max(cur.max, pos) }
        : { min: pos, max: pos },
    );
  }
  return lanes;
}

/** พื้นทั้งผืน วาดก่อนตึกเสมอ — แปลงที่ดิน / ถนน / หญ้าและต้นไม้ */
export function IsoGround({ cells }: { cells: GroundCell[] }) {
  const lanes = useMemo(() => computeLanes(cells), [cells]);

  return (
    <g className="pixel-art">
      {cells.map((cell) => {
        const alt = (cell.gx + cell.gy) % 2 === 0;
        const fill =
          cell.kind === "grass" && alt ? "var(--grass-alt)" : FILL[cell.kind];

        return (
          <g key={`${cell.gx},${cell.gy}`}>
            {/* เต็มระยะกริดพอดี เพื่อให้พื้นต่อกันเป็นผืนเดียว ไม่ใช่แผ่นลอยๆ */}
            <polygon
              points={polygonPoints(rhombus(cell.center, PITCH_W, PITCH_H))}
              fill={fill}
            />

            {cell.kind === "plot" && (
              <polygon
                points={polygonPoints(rhombus(cell.center, PITCH_W - 6, PITCH_H - 3))}
                fill="none"
                stroke="var(--plot-line)"
                strokeWidth={1}
              />
            )}

            {/* แปลงที่จัดสรรไว้แล้วแต่ยังไม่มีตึก — ขอบเส้นประ = รอสร้าง */}
            {cell.kind === "vacant" && (
              <polygon
                points={polygonPoints(rhombus(cell.center, PITCH_W - 14, PITCH_H - 7))}
                fill="none"
                stroke="var(--vacant-line)"
                strokeWidth={1}
                strokeDasharray="4 4"
                opacity={0.75}
              />
            )}

            {/* เส้นแบ่งเลนลากตามแนวถนนของช่องนั้น — สี่แยกไม่มีเส้นแบ่ง */}
            {cell.kind === "road" && cell.roadAxis !== "both" && (
              <line
                x1={cell.center.x - (AXIS[axisOf(cell)].dir[0] * PITCH_W) / 4}
                y1={cell.center.y - (AXIS[axisOf(cell)].dir[1] * PITCH_W) / 4}
                x2={cell.center.x + (AXIS[axisOf(cell)].dir[0] * PITCH_W) / 4}
                y2={cell.center.y + (AXIS[axisOf(cell)].dir[1] * PITCH_W) / 4}
                stroke="var(--road-line)"
                strokeWidth={1.6}
                strokeDasharray="7 6"
                opacity={0.55}
              />
            )}
          </g>
        );
      })}

      {/* ของประดับวาดทีหลังทั้งหมด กันต้นไม้ถูกพื้นช่องถัดไปทับ */}
      {cells
        .filter((c) => c.decor !== "none")
        .map((cell) => (
          <Decor
            key={`d-${cell.gx},${cell.gy}`}
            cell={cell}
            lane={cell.kind === "road" ? lanes.get(laneKey(cell)) : undefined}
          />
        ))}
    </g>
  );
}

function Decor({ cell, lane }: { cell: GroundCell; lane?: Lane }) {
  const { x, y } = cell.center;
  const jitterX = (seededRandom(`jx${cell.gx}:${cell.gy}`, 3) - 0.5) * 18;
  const jitterY = (seededRandom(`jy${cell.gx}:${cell.gy}`, 5) - 0.5) * 8;
  let cx = x + jitterX;
  let cy = y + jitterY;

  if (cell.decor === "lamp") {
    return (
      <g>
        <ellipse cx={cx} cy={cy + 1} rx={4} ry={1.6} fill="rgba(0,0,0,0.4)" />
        <rect x={cx - 0.7} y={cy - 15} width={1.4} height={15} fill="#2a3d57" />
        <rect x={cx - 3} y={cy - 16.5} width={6} height={2} rx={1} fill="#3c5273" />
        <circle cx={cx} cy={cy - 15} r={2.2} fill="#ffe9a8" />
        {/* แสงตกลงพื้นเป็นวงรี */}
        <ellipse cx={cx} cy={cy - 14} rx={7} ry={5} fill="#ffe9a8" opacity={0.13} />
        <ellipse cx={cx} cy={cy + 1} rx={13} ry={6} fill="#ffe9a8" opacity={0.07} />
      </g>
    );
  }

  if (cell.decor === "person") {
    const shirt = seededRandom(`p${cell.gx}:${cell.gy}`, 13);
    const color = shirt > 0.66 ? "#b9634f" : shirt > 0.33 ? "#4f77aa" : "#6b9a80";
    const stride = seededRandom(`st${cell.gx}:${cell.gy}`, 17) > 0.5 ? 1 : -1;

    // คนบนถนนต้องเดินริมทาง ไม่ยืนกลางเลนให้รถชน
    // ขยับตามแกนที่ตั้งฉากกับแนวถนน (ทิศที่ gy เพิ่ม)
    if (cell.kind === "road") {
      const perp = AXIS[axisOf(cell)].perp;
      const side = seededRandom(`sd${cell.gx}:${cell.gy}`, 19) > 0.5 ? 1 : -1;
      cx = cell.center.x + perp[0] * 17 * side;
      cy = cell.center.y + perp[1] * 17 * side;
    }

    // เดินไป-กลับตามแนวทางเท้า ระยะสั้นๆ พอให้รู้ว่ามีชีวิต ไม่ใช่วิ่งข้ามเมือง
    const walkAxis = cell.kind === "road" ? AXIS[axisOf(cell)].dir : AXIS.x.dir;
    const walkLen = 10 + seededRandom(`wl${cell.gx}:${cell.gy}`, 29) * 12;

    // เงาสั้นๆ + ขาสองข้างแยกจังหวะ ทำให้อ่านเป็นคนเดิน ไม่ใช่หมุดปัก
    return (
      <g
        className="anim-walk"
        style={
          {
            "--walk-x": `${(walkAxis[0] * walkLen * stride).toFixed(1)}px`,
            "--walk-y": `${(walkAxis[1] * walkLen * stride).toFixed(1)}px`,
            "--dur": `${(7 + seededRandom(`wd${cell.gx}:${cell.gy}`, 31) * 7).toFixed(1)}s`,
          } as React.CSSProperties
        }
      >
        <ellipse cx={cx} cy={cy + 0.4} rx={2} ry={0.9} fill="rgba(0,0,0,0.5)" />
        <rect x={cx - 1.5 * stride} y={cy - 2.6} width={1} height={2.8} fill="#2c3242" />
        <rect x={cx + 0.5 * stride} y={cy - 2.6} width={1} height={2.8} fill="#3a4152" />
        <path
          d={`M ${cx - 1.5} ${cy - 2.4} L ${cx - 1.2} ${cy - 6.2} L ${cx + 1.2} ${cy - 6.2} L ${cx + 1.5} ${cy - 2.4} Z`}
          fill={color}
        />
        <rect x={cx - 0.6} y={cy - 7.8} width={1.2} height={1.4} fill="#c9a689" />
        <circle cx={cx} cy={cy - 8.4} r={1.25} fill="#e0bd9a" />
        <path
          d={`M ${cx - 1.25} ${cy - 8.7} a 1.25 1.25 0 0 1 2.5 0 Z`}
          fill="#3a2f28"
        />
      </g>
    );
  }

  if (cell.decor === "car") {
    const hue = seededRandom(`car${cell.gx}:${cell.gy}`, 11);
    const body = hue > 0.66 ? "#b8513f" : hue > 0.33 ? "#43649c" : "#9a9488";
    const bodyDark = hue > 0.66 ? "#8c3a2c" : hue > 0.33 ? "#2f4a78" : "#736e64";
    const roof = hue > 0.66 ? "#d3695a" : hue > 0.33 ? "#5b7fb8" : "#b0aa9e";
    // วิ่งไปข้างหน้าหรือย้อนกลับ — สลับให้ถนนดูมีสองเลนจริง
    /**
     * เลือกทิศวิ่งโดยดูว่าฝั่งไหนยังมีถนนเหลือให้วิ่ง
     * ถ้าสุ่มได้ฝั่งที่ตัน ให้กลับทิศ ไม่งั้นรถจะวิ่งทะลุออกนอกถนน
     */
    const pos = axisOf(cell) === "x" ? cell.gx : cell.gy;
    const toMax = lane ? lane.max - pos : 2;
    const toMin = lane ? pos - lane.min : 2;

    let dir = seededRandom(`dir${cell.gx}:${cell.gy}`, 7) > 0.5 ? 1 : -1;
    if ((dir > 0 ? toMax : toMin) < 1) dir = -dir;

    const cellsAhead = dir > 0 ? toMax : toMin;
    // อยู่ปลายเลนทั้งสองฝั่งแล้ว (ถนนสั้นมาก) ก็จอดอยู่กับที่ ดีกว่าวิ่งทะลุ
    const canDrive = cellsAhead >= 1;

    /**
     * รถวางตามแนวถนน "ของช่องนั้น" — ผังเมืองมีถนนสองแนวตัดกัน
     * ถ้าใช้แกนเดียวทั้งเมือง รถบนถนนอีกแนวจะขวางเลนหมด
     */
    const ax = AXIS[axisOf(cell)];
    const L = 8.5;
    const W = 3.6;
    const H = 3.4;
    const ux = ax.dir[0] * L * dir;
    const uy = ax.dir[1] * L * dir;
    const vx = ax.perp[0] * W;
    const vy = ax.perp[1] * W;

    const p = (a: number, b: number, lift = 0) => ({
      x: cx + ux * a + vx * b,
      y: cy + uy * a + vy * b - lift,
    });

    const frontL = p(1, -1);
    const frontR = p(1, 1);
    const backL = p(-1, -1);
    const backR = p(-1, 1);

    /**
     * ระยะวิ่งหยุดที่กลางช่องสุดท้ายของเลนพอดี ไม่บวกเกินไปอีกช่อง
     * (เดิมบวก 1 รถเลยไหลทะลุออกนอกถนนตอนใกล้จบจังหวะ)
     * และผูกเวลากับระยะ ทุกคันจึงวิ่งเร็วเท่ากัน
     */
    const travel = PITCH_W * cellsAhead;
    const speed = 11 + seededRandom(`cs${cell.gx}:${cell.gy}`, 37) * 5; // วินาทีต่อช่อง

    const driveStyle = canDrive
      ? ({
          "--drive-x": `${(ax.dir[0] * travel * dir).toFixed(1)}px`,
          "--drive-y": `${(ax.dir[1] * travel * dir).toFixed(1)}px`,
          "--dur": `${((cellsAhead * speed) / 4).toFixed(1)}s`,
          "--delay": `-${(seededRandom(`cl${cell.gx}:${cell.gy}`, 41) * 6).toFixed(1)}s`,
        } as React.CSSProperties)
      : undefined;

    return (
      <g className={canDrive ? "anim-car" : undefined} style={driveStyle}>
        <ellipse cx={cx} cy={cy + 1.5} rx={9} ry={4} fill="rgba(0,0,0,0.5)" />

        {/* ล้อ */}
        {[p(0.6, -1), p(0.6, 1), p(-0.6, -1), p(-0.6, 1)].map((w, i) => (
          <ellipse key={i} cx={w.x} cy={w.y} rx={1.5} ry={1} fill="#14161c" />
        ))}

        {/* ตัวถัง 3 หน้า */}
        <polygon
          points={polygonPoints([backR, frontR, p(1, 1, H), p(-1, 1, H)])}
          fill={bodyDark}
        />
        <polygon
          points={polygonPoints([frontL, frontR, p(1, 1, H), p(1, -1, H)])}
          fill={body}
        />
        <polygon
          points={polygonPoints([
            p(-1, -1, H),
            p(1, -1, H),
            p(1, 1, H),
            p(-1, 1, H),
          ])}
          fill={roof}
        />

        {/* กระจก/หลังคาห้องโดยสาร */}
        <polygon
          points={polygonPoints([
            p(-0.5, -0.72, H),
            p(0.45, -0.72, H),
            p(0.45, 0.72, H),
            p(-0.5, 0.72, H),
          ])}
          fill="#1d2c44"
        />

        {/* ไฟหน้าอยู่ที่หัวรถ ไม่ลอยข้างตัว */}
        <circle cx={p(1, -0.55, H * 0.45).x} cy={p(1, -0.55, H * 0.45).y} r={1} fill="#ffeeb5" />
        <circle cx={p(1, 0.55, H * 0.45).x} cy={p(1, 0.55, H * 0.45).y} r={1} fill="#ffeeb5" />
        <ellipse
          cx={p(1.9, 0, H * 0.4).x}
          cy={p(1.9, 0, H * 0.4).y}
          rx={5.5}
          ry={2.4}
          fill="#ffeeb5"
          opacity={0.12}
        />
        {/* ไฟท้าย */}
        <circle cx={p(-1, 0, H * 0.5).x} cy={p(-1, 0, H * 0.5).y} r={0.9} fill="#ff6b5a" />
      </g>
    );
  }

  if (cell.decor === "bush") {
    return (
      <g>
        <ellipse cx={cx} cy={cy + 1} rx={5} ry={2.2} fill="rgba(0,0,0,0.4)" />
        <polygon
          points={polygonPoints([
            { x: cx - 5, y: cy },
            { x: cx, y: cy - 4.5 },
            { x: cx + 5, y: cy },
            { x: cx, y: cy + 2 },
          ])}
          fill="#2f6b4f"
        />
        <polygon
          points={polygonPoints([
            { x: cx - 5, y: cy },
            { x: cx, y: cy - 4.5 },
            { x: cx, y: cy + 2 },
          ])}
          fill="#3d8560"
        />
      </g>
    );
  }

  // ต้นไม้ — พุ่ม 2 ชั้นไล่เฉด + ลำต้น
  return (
    <g>
      <ellipse cx={cx} cy={cy + 2} rx={7} ry={3} fill="rgba(0,0,0,0.45)" />
      <rect x={cx - 1.4} y={cy - 6} width={2.8} height={8} fill="#4a3524" />
      <polygon
        points={polygonPoints([
          { x: cx - 8, y: cy - 6 },
          { x: cx, y: cy - 11 },
          { x: cx + 8, y: cy - 6 },
          { x: cx, y: cy - 2 },
        ])}
        fill="#2b6349"
      />
      <polygon
        points={polygonPoints([
          { x: cx - 8, y: cy - 6 },
          { x: cx, y: cy - 11 },
          { x: cx, y: cy - 2 },
        ])}
        fill="#3a805e"
      />
      <polygon
        points={polygonPoints([
          { x: cx - 6, y: cy - 11 },
          { x: cx, y: cy - 15.5 },
          { x: cx + 6, y: cy - 11 },
          { x: cx, y: cy - 7.5 },
        ])}
        fill="#357556"
      />
      <polygon
        points={polygonPoints([
          { x: cx - 6, y: cy - 11 },
          { x: cx, y: cy - 15.5 },
          { x: cx, y: cy - 7.5 },
        ])}
        fill="#469470"
      />
    </g>
  );
}
