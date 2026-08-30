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

  /**
   * กองวัสดุต้องสูงตามสเกลเดียวกับตึก — เงินก้อนนี้ถ้าซื้อหุ้นจะได้ตึกสูงเท่าไหร่
   * กองก็ควรใหญ่ประมาณนั้น (เดิมเอา height ไปแปลงเป็นตัวคูณอีกที กองเลยหดเหลือ 1/5)
   *
   * จงใจไม่ทำเป็นโครงตึก/นั่งร้าน เพราะโครงแปลว่าตัดสินใจแล้วว่าจะสร้างอะไร
   * แต่เงินสดยังไม่ได้เลือกเลยว่าจะไปเป็นหุ้นตัวไหน มันคือวัสดุที่ยังไม่ได้ประกอบ
   */
  const stackH = Math.max(8, height * 0.78);
  const sandH = Math.max(6, height * 0.34);
  const craneH = Math.max(30, height * 1.05);
  // กองเดียวสูงเกิน ~22px จะเริ่มอ่านเป็นตึก — เกินนั้นแตกเป็นกองใหม่แทน
  const stackCount = Math.max(1, Math.min(4, Math.ceil(stackH / 22)));

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

      <Crane x={center.x - 21} y={center.y - 4} h={craneH} />

      {/* วัสดุก่อสร้างที่ยังไม่ได้ประกอบ — กองสูงตามเงินด้วยสเกลเดียวกับตึก */}
      <SandPile x={center.x - 13} y={center.y + 6} h={sandH} />
      <Rebar x={center.x - 1} y={center.y + 14} scale={1} />

      {/*
        ปริมาตรรวมมาจากเงิน แต่กระจายเป็นหลายกองแทนกองเดียวสูงลิ่ว
        ไม่งั้นกองอิฐจะอ่านเป็นตึกอิฐ ไม่ใช่ของที่กองไว้รอใช้
      */}
      {STACK_SPOTS.slice(0, stackCount)
        .slice()
        .sort((a, b) => a[1] - b[1])
        .map(([dx, dy], i) => (
          <BrickStack
            key={i}
            x={center.x + dx}
            y={center.y + dy}
            h={stackH / stackCount}
          />
        ))}

      {/* ป้ายไซต์ — ใช้แบบเดียวกับป้ายบิลบอร์ดของตึก จะได้ไม่หลุดแบบ */}
      <g
        transform={`matrix(0.894 0.447 0 1 ${center.x} ${center.y - stackH - 16})`}
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

/** จุดวางกองวัสดุในแปลง — เรียงไม่ให้ทับกัน */
const STACK_SPOTS: Array<[number, number]> = [
  [12, 2],
  [-3, 9],
  [22, 11],
  [7, 17],
];

/** กองทราย/กรวด — ทรงกรวย กว้างคุมไม่ให้ล้นแปลง สูงตามเงิน */
function SandPile({ x, y, h }: { x: number; y: number; h: number }) {
  const w = Math.min(30, 12 + h * 0.75);
  return (
    <g>
      <ellipse cx={x} cy={y + 1} rx={w / 2 + 1.5} ry={w / 5} fill="rgba(0,0,0,0.45)" />
      <polygon
        points={polygonPoints([
          { x: x - w / 2, y },
          { x, y: y - h },
          { x: x + w / 2, y },
          { x, y: y + w / 5 },
        ])}
        fill="#8a7048"
      />
      <polygon
        points={polygonPoints([
          { x: x - w / 2, y },
          { x, y: y - h },
          { x, y: y + w / 5 },
        ])}
        fill="#a88a5c"
      />
      <polyline
        points={polygonPoints([
          { x: x - w / 2, y },
          { x, y: y - h },
          { x: x + w / 2, y },
        ])}
        fill="none"
        stroke="#c4a878"
        strokeWidth={0.7}
        opacity={0.8}
      />
    </g>
  );
}

/**
 * กองอิฐ/บล็อกวางซ้อนเป็นชั้น — เหมือนพาเลทวัสดุในโกดัง
 * ความสูงมาจากเงิน ส่วนความกว้างคงที่ ยิ่งเงินเยอะยิ่งซ้อนสูงขึ้นเรื่อยๆ
 */
function BrickStack({ x, y, h }: { x: number; y: number; h: number }) {
  const w = 22;
  const layerH = 3.4;
  const layers = Math.max(2, Math.min(26, Math.round(h / layerH)));

  return (
    <g>
      <ellipse cx={x} cy={y + 1} rx={w / 2 + 1} ry={w / 5} fill="rgba(0,0,0,0.45)" />
      {Array.from({ length: layers }, (_, i) => {
        const ly = y - i * layerH;
        return (
          <g key={i}>
            <polygon
              points={polygonPoints([
                { x: x - w / 2, y: ly },
                { x, y: ly + w / 4 },
                { x, y: ly + w / 4 - layerH },
                { x: x - w / 2, y: ly - layerH },
              ])}
              fill="#8f4f3d"
            />
            <polygon
              points={polygonPoints([
                { x, y: ly + w / 4 },
                { x: x + w / 2, y: ly },
                { x: x + w / 2, y: ly - layerH },
                { x, y: ly + w / 4 - layerH },
              ])}
              fill="#6d3b2d"
            />
          </g>
        );
      })}
      <polygon
        points={polygonPoints([
          { x, y: y - layers * layerH - w / 4 },
          { x: x + w / 2, y: y - layers * layerH },
          { x, y: y - layers * layerH + w / 4 },
          { x: x - w / 2, y: y - layers * layerH },
        ])}
        fill="#a35f49"
      />
    </g>
  );
}

/** มัดเหล็กเส้น/ท่อ วางนอนกับพื้น */
function Rebar({ x, y, scale }: { x: number; y: number; scale: number }) {
  const len = 26 * scale;
  const bars = Math.max(3, Math.round(5 * scale));

  return (
    <g>
      <ellipse cx={x} cy={y + 1} rx={len / 2} ry={len / 7} fill="rgba(0,0,0,0.4)" />
      {Array.from({ length: bars }, (_, i) => {
        const row = Math.floor(i / 3);
        const col = i % 3;
        const bx = x - len / 2 + col * (len / 3.4) + row * 2.5;
        const by = y - row * 2.6 + col * (len / 9);
        return (
          <g key={i}>
            <rect
              x={bx}
              y={by - 2}
              width={len * 0.42}
              height={2}
              rx={1}
              fill="#7f8894"
              transform={`rotate(26.57 ${bx} ${by})`}
            />
            <rect
              x={bx}
              y={by - 2.6}
              width={len * 0.42}
              height={0.7}
              rx={0.3}
              fill="#a8b2be"
              transform={`rotate(26.57 ${bx} ${by})`}
            />
          </g>
        );
      })}
    </g>
  );
}

/** เครน — สูงตามไซต์ ยิ่งเงินเยอะยิ่งตระหง่าน */
function Crane({ x, y, h }: { x: number; y: number; h: number }) {
  const jib = Math.max(16, h * 0.5);
  return (
    <g
      className="anim-crane"
      style={
        {
          "--pivot": "50% 100%",
          "--dur": `${(11 + (h % 7)).toFixed(0)}s`,
        } as React.CSSProperties
      }
    >
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
