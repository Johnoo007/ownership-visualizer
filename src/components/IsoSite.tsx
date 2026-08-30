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
  const { structure: s, center, height } = placed;
  const value = s.marketValue;

  // ใช้ความสูงเดียวกับตึก — ไซต์คือตึกที่ยังไม่ได้สร้าง จึงควรใหญ่ตามเงินจริง
  const scaffoldH = Math.max(10, height);
  const craneH = scaffoldH * 1.5 + 12;
  const piles = value < 5_000 ? 1 : value < 15_000 ? 2 : 3;

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

      {/* โครงนั่งร้าน = รูปร่างของตึกที่กำลังจะเกิด สูงเท่าที่เงินก้อนนี้สร้างได้ */}
      <Scaffold x={center.x + 2} y={center.y - 1} h={scaffoldH} />
      <Crane x={center.x - 17} y={center.y - 4} h={craneH} />

      {piles >= 1 && <Pile x={center.x - 11} y={center.y + 8} color="#8a6f47" />}
      {piles >= 2 && <Pile x={center.x + 13} y={center.y + 7} color="#6f6a5e" />}
      {piles >= 3 && <Pile x={center.x + 1} y={center.y + 12} color="#8a6f47" />}

      {/* ป้ายไซต์ — ใช้แบบเดียวกับป้ายบิลบอร์ดของตึก จะได้ไม่หลุดแบบ */}
      <g
        transform={`matrix(0.894 0.447 0 1 ${center.x} ${center.y - scaffoldH - 10})`}
      >
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

/** นั่งร้าน — โครงเหล็กเปล่าที่บอกว่าตึกจะสูงแค่ไหนถ้าเอาเงินก้อนนี้ไปลง */
function Scaffold({ x, y, h }: { x: number; y: number; h: number }) {
  const w = 26;
  // ชั้นนั่งร้านทุกๆ ~14px กันเส้นถี่เกินตอนไซต์สูงมาก
  const decks = Math.max(1, Math.min(9, Math.round(h / 14)));

  return (
    <g stroke="#8494a8" strokeWidth={1} fill="none" opacity={0.92}>
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
      <line x1={x} y1={y - w / 4} x2={x} y2={y - w / 4 - h} />

      {Array.from({ length: decks }, (_, i) => {
        const dy = ((i + 1) / decks) * h;
        return (
          <polygon
            key={i}
            points={polygonPoints([
              { x: x - w / 2, y: y - dy },
              { x, y: y + w / 4 - dy },
              { x: x + w / 2, y: y - dy },
              { x, y: y - w / 4 - dy },
            ])}
            opacity={0.75}
          />
        );
      })}
    </g>
  );
}

/** เครน — สูงตามไซต์ ยิ่งเงินเยอะยิ่งตระหง่าน */
function Crane({ x, y, h }: { x: number; y: number; h: number }) {
  const jib = Math.max(16, h * 0.5);
  return (
    <g>
      <ellipse cx={x} cy={y + 1} rx={5} ry={2} fill="rgba(0,0,0,0.45)" />
      <rect x={x - 3} y={y - 3} width={6} height={4} fill="#8a7420" />
      <rect x={x - 1.2} y={y - h} width={2.4} height={h} fill="#c9a227" />
      {/* ขาไขว้ของเสาเครน */}
      {Array.from({ length: Math.max(2, Math.round(h / 12)) }, (_, i) => (
        <line
          key={i}
          x1={x - 1.2}
          y1={y - (i * h) / Math.max(2, Math.round(h / 12))}
          x2={x + 1.2}
          y2={y - ((i + 1) * h) / Math.max(2, Math.round(h / 12))}
          stroke="#8a7420"
          strokeWidth={0.7}
        />
      ))}
      <rect x={x - 2} y={y - h - 2} width={jib} height={2.2} fill="#c9a227" />
      <rect x={x - 8} y={y - h - 2} width={6} height={2.2} fill="#8a7420" />
      <line
        x1={x + jib - 4}
        y1={y - h}
        x2={x + jib - 4}
        y2={y - h + Math.min(18, h * 0.35)}
        stroke="#8494a8"
        strokeWidth={0.8}
      />
      <rect
        x={x + jib - 6}
        y={y - h + Math.min(18, h * 0.35)}
        width={4}
        height={3}
        fill="#8494a8"
      />
      <circle cx={x} cy={y - h - 4} r={1.5} fill="#ff6b5a" />
    </g>
  );
}
