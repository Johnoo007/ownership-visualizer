"use client";

import { TILE_H, TILE_W, polygonPoints, type PlacedStructure, type Point } from "@/lib/iso";
import { formatTHB } from "@/lib/portfolio";

/**
 * ไซต์ก่อสร้าง = เงินสดที่ยังไม่ได้ลงทุน
 *
 * จงใจไม่ทำเป็นตึก เพราะเงินสดยังไม่ใช่ความเป็นเจ้าของอะไรเลย — มันคือของ
 * ที่รอกลายเป็นตึก · ยิ่งเงินสดเยอะไซต์ยิ่งใหญ่ พอเอาไปซื้อหุ้นไซต์จะหดลง
 * แล้วตึกจะโตขึ้นแทน ซึ่งตรงกับสิ่งที่เกิดขึ้นจริง
 */
export function IsoSite({
  placed,
  selected,
  hovered,
  onSelect,
  onHover,
}: {
  placed: PlacedStructure;
  selected: boolean;
  hovered: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const { structure: s, center } = placed;
  const value = s.marketValue;

  const piles = value < 5_000 ? 1 : value < 15_000 ? 2 : 3;
  const hasScaffold = value >= 12_000;
  const hasCrane = value >= 30_000;

  const N: Point = { x: center.x, y: center.y - TILE_H / 2 };
  const E: Point = { x: center.x + TILE_W / 2, y: center.y };
  const S: Point = { x: center.x, y: center.y + TILE_H / 2 };
  const W: Point = { x: center.x - TILE_W / 2, y: center.y };

  return (
    <g
      className="cursor-pointer"
      onClick={() => onSelect(s.id)}
      onMouseEnter={() => onHover(s.id)}
      onMouseLeave={() => onHover(null)}
      style={{ filter: hovered && !selected ? "brightness(1.2)" : undefined }}
    >
      <title>{`${s.label} — ${s.sublabel}\n${formatTHB(value)}`}</title>

      {/* พื้นไซต์ + รั้วล้อม */}
      <polygon
        points={polygonPoints([N, E, S, W])}
        fill="#2a2b21"
        stroke={selected ? "var(--accent)" : "#6b5f2a"}
        strokeWidth={selected ? 2 : 1.2}
        strokeDasharray="4 3"
      />

      {/* แถบเตือนสีเหลืองรอบขอบ */}
      <polyline
        points={polygonPoints([W, S, E])}
        fill="none"
        stroke="#c9a227"
        strokeWidth={1.6}
        strokeDasharray="5 4"
        opacity={0.7}
      />

      {piles >= 1 && <Pile x={center.x - 11} y={center.y + 5} color="#8a6f47" />}
      {piles >= 2 && <Pile x={center.x + 10} y={center.y + 6} color="#6f6a5e" />}
      {piles >= 3 && <Pile x={center.x + 1} y={center.y + 10} color="#8a6f47" />}

      {hasScaffold && <Scaffold x={center.x + 4} y={center.y - 2} />}
      {hasCrane && <Crane x={center.x - 14} y={center.y - 6} />}

      {/* ป้ายไซต์ — ใช้แบบเดียวกับป้ายบิลบอร์ดของตึก จะได้ไม่หลุดแบบ */}
      <g transform={`matrix(0.894 0.447 0 1 ${center.x} ${center.y - 22})`}>
        <rect x={-1} y={-6} width={1.2} height={6} fill="#6b5f2a" />
        <rect
          x={-s.label.length * 3.6 - 3}
          y={-16}
          width={s.label.length * 7.2 + 6}
          height={11}
          rx={1}
          fill="#08111f"
          stroke="#6b5f2a"
          strokeWidth={0.6}
          opacity={0.92}
        />
        <text
          x={0}
          y={-10.5}
          textAnchor="middle"
          dominantBaseline="central"
          className="font-bold"
          style={{
            fontFamily: "var(--font-geist-mono, monospace)",
            fontSize: 8,
            fill: "#e8c46a",
            letterSpacing: "0.04em",
          }}
        >
          {s.label}
        </text>
      </g>
    </g>
  );
}

/** กองวัสดุก่อสร้าง */
function Pile({ x, y, color }: { x: number; y: number; color: string }) {
  const w = 13;
  const h = 5;
  return (
    <g>
      <ellipse cx={x} cy={y + 1} rx={w / 2 + 1} ry={2.5} fill="rgba(0,0,0,0.4)" />
      <polygon
        points={polygonPoints([
          { x: x - w / 2, y },
          { x, y: y - h },
          { x: x + w / 2, y },
          { x, y: y + w / 4 },
        ])}
        fill={color}
      />
      <polygon
        points={polygonPoints([
          { x: x - w / 2, y },
          { x, y: y - h },
          { x, y: y + w / 4 },
        ])}
        fill="#a68a5b"
        opacity={0.55}
      />
    </g>
  );
}

/** นั่งร้าน — โครงเหล็กที่ยังไม่มีตึกอยู่ข้างใน */
function Scaffold({ x, y }: { x: number; y: number }) {
  const w = 16;
  const h = 18;
  return (
    <g stroke="#7d8899" strokeWidth={1} fill="none" opacity={0.9}>
      <polygon
        points={polygonPoints([
          { x: x - w / 2, y },
          { x, y: y + w / 4 },
          { x: x + w / 2, y },
          { x, y: y - w / 4 },
        ])}
      />
      <line x1={x - w / 2} y1={y} x2={x - w / 2} y2={y - h} />
      <line x1={x + w / 2} y1={y} x2={x + w / 2} y2={y - h} />
      <line x1={x} y1={y + w / 4} x2={x} y2={y + w / 4 - h} />
      <polyline
        points={polygonPoints([
          { x: x - w / 2, y: y - h * 0.55 },
          { x, y: y + w / 4 - h * 0.55 },
          { x: x + w / 2, y: y - h * 0.55 },
        ])}
      />
      <polyline
        points={polygonPoints([
          { x: x - w / 2, y: y - h },
          { x, y: y + w / 4 - h },
          { x: x + w / 2, y: y - h },
        ])}
      />
    </g>
  );
}

/** เครน — โผล่เฉพาะไซต์ใหญ่ */
function Crane({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x - 1} y={y - 34} width={2} height={34} fill="#c9a227" />
      <rect x={x - 3} y={y - 2} width={6} height={3} fill="#8a7420" />
      <rect x={x - 2} y={y - 36} width={20} height={2} fill="#c9a227" />
      <line
        x1={x + 15}
        y1={y - 34}
        x2={x + 15}
        y2={y - 25}
        stroke="#7d8899"
        strokeWidth={0.8}
      />
      <rect x={x + 13} y={y - 25} width={4} height={3} fill="#7d8899" />
      <circle cx={x} cy={y - 37.5} r={1.4} fill="#ff6b5a" />
    </g>
  );
}
