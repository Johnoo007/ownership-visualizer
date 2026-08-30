"use client";

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

function rhombus(c: Point, w: number, h: number): Point[] {
  return [
    { x: c.x, y: c.y - h / 2 },
    { x: c.x + w / 2, y: c.y },
    { x: c.x, y: c.y + h / 2 },
    { x: c.x - w / 2, y: c.y },
  ];
}

/** พื้นทั้งผืน วาดก่อนตึกเสมอ — แปลงที่ดิน / ถนน / หญ้าและต้นไม้ */
export function IsoGround({ cells }: { cells: GroundCell[] }) {
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

            {/* เส้นแบ่งเลน — ลากตามแนวถนน (ทิศที่ gx เพิ่ม) ไม่ใช่ขีดกลางลอยๆ */}
            {cell.kind === "road" && (
              <line
                x1={cell.center.x - PITCH_W / 4}
                y1={cell.center.y - PITCH_H / 4}
                x2={cell.center.x + PITCH_W / 4}
                y2={cell.center.y + PITCH_H / 4}
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
          <Decor key={`d-${cell.gx},${cell.gy}`} cell={cell} />
        ))}
    </g>
  );
}

function Decor({ cell }: { cell: GroundCell }) {
  const { x, y } = cell.center;
  const jitterX = (seededRandom(`jx${cell.gx}:${cell.gy}`, 3) - 0.5) * 18;
  const jitterY = (seededRandom(`jy${cell.gx}:${cell.gy}`, 5) - 0.5) * 8;
  const cx = x + jitterX;
  const cy = y + jitterY;

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
    const color = shirt > 0.66 ? "#c9705f" : shirt > 0.33 ? "#5b86bd" : "#7ba98c";
    return (
      <g>
        <ellipse cx={cx} cy={cy + 0.5} rx={2.4} ry={1.1} fill="rgba(0,0,0,0.45)" />
        <rect x={cx - 1.3} y={cy - 5} width={2.6} height={5} rx={0.6} fill={color} />
        <circle cx={cx} cy={cy - 6.4} r={1.5} fill="#e8c9a8" />
      </g>
    );
  }

  if (cell.decor === "car") {
    const hue = seededRandom(`car${cell.gx}:${cell.gy}`, 11);
    const body = hue > 0.66 ? "#c05a4a" : hue > 0.33 ? "#4a6fa8" : "#b8b0a2";

    return (
      <g>
        <ellipse cx={cx} cy={cy + 2} rx={9} ry={3.5} fill="rgba(0,0,0,0.45)" />
        {/* ตัวรถวางตามแนวถนน (แกน W→E ของ isometric) */}
        <polygon
          points={polygonPoints([
            { x: cx - 9, y: cy - 1 },
            { x: cx, y: cy - 5.5 },
            { x: cx + 9, y: cy - 1 },
            { x: cx, y: cy + 3.5 },
          ])}
          fill={body}
        />
        <polygon
          points={polygonPoints([
            { x: cx - 4.5, y: cy - 3.5 },
            { x: cx, y: cy - 6 },
            { x: cx + 4.5, y: cy - 3.5 },
            { x: cx, y: cy - 1 },
          ])}
          fill="#2c3c56"
        />
        {/* ไฟหน้า */}
        <circle cx={cx + 8} cy={cy - 1.5} r={1.4} fill="#ffe9a8" />
        <circle cx={cx + 8} cy={cy - 1.5} r={3} fill="#ffe9a8" opacity={0.18} />
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
