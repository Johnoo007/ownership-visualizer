"use client";

import {
  TILE_H,
  TILE_W,
  floorPlan,
  litRatio,
  polygonPoints,
  seededRandom,
  type PlacedStructure,
  type Point,
} from "@/lib/iso";
import { formatShares, formatTHB } from "@/lib/portfolio";

type Palette = {
  top: string;
  left: string;
  right: string;
  band: string;
  edge: string;
  base: string;
};

const PALETTES: Record<string, Palette> = {
  mission: {
    top: "#7b9fd4",
    left: "#4a6ba3",
    right: "#33507d",
    band: "#5c7cb5",
    edge: "#1b2c49",
    base: "#263c60",
  },
  goldengoose: {
    top: "#6fc49a",
    left: "#3f8a68",
    right: "#2c6b4f",
    band: "#52a37e",
    edge: "#173d2c",
    base: "#1f5540",
  },
  free: {
    top: "#f0cf7a",
    left: "#c39a3f",
    right: "#96742b",
    band: "#d9b257",
    edge: "#5e4718",
    base: "#7d5f21",
  },
};

const WINDOW_ON = "#ffe9a8";
const WINDOW_OFF = "#16243c";

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function shift(p: Point, dy: number): Point {
  return { x: p.x, y: p.y - dy };
}

export function IsoTower({
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
  const palette = s.isFree ? PALETTES.free : (PALETTES[s.district] ?? PALETTES.mission);

  const N: Point = { x: center.x, y: center.y - TILE_H / 2 };
  const E: Point = { x: center.x + TILE_W / 2, y: center.y };
  const S: Point = { x: center.x, y: center.y + TILE_H / 2 };
  const W: Point = { x: center.x - TILE_W / 2, y: center.y };

  const Nr = shift(N, height);
  const Er = shift(E, height);
  const Sr = shift(S, height);
  const Wr = shift(W, height);

  const plan = floorPlan(s.units, height);
  const lit = litRatio(s.health);

  const partialStart = plan.fullFloors * plan.floorHeight;
  // ตึกทึบเต็มความสูงเสมอ — เงินลงไปแล้วเท่าไหร่ ตึกสร้างไปแล้วเท่านั้น
  // เศษหุ้นไม่ได้แปลว่า "ยังไม่จ่าย" แค่แปลว่าชั้นบนสุดยังสะสมไม่ครบใบ
  const solidTop = height;
  const hasPartial = plan.partial > 0.001 && height - partialStart > 2.5;

  const floorLines: number[] = [];
  if (!plan.toodense && plan.floorHeight > 3.5) {
    for (let i = 1; i <= plan.fullFloors; i++) {
      const y = i * plan.floorHeight;
      if (y < solidTop - 0.5) floorLines.push(y);
    }
  }

  return (
    <g
      className="cursor-pointer"
      onClick={() => onSelect(s.id)}
      onMouseEnter={() => onHover(s.id)}
      onMouseLeave={() => onHover(null)}
      style={{ filter: hovered && !selected ? "brightness(1.18)" : undefined }}
    >
      <title>
        {`${s.label} — ${s.sublabel}\nลงเงิน ${formatTHB(s.invested)} · ${formatShares(s.units)} หุ้น`}
      </title>

      {/* เงาทอดไปทางขวา — ยาวตามความสูงจริง (แสงมาจากซ้ายบน) */}
      {(() => {
        const dx = height * 0.2;
        const dy = height * 0.07;
        const off = (p: Point): Point => ({ x: p.x + dx, y: p.y + dy });
        return (
          <polygon
            points={polygonPoints([W, N, off(N), off(E), off(S), S])}
            fill="var(--ground-shadow)"
          />
        );
      })()}

      {/* ตัวตึก — ความสูงมาจากเงินที่ลงไป ไม่ใช่ราคาตลาด */}
      <polygon points={polygonPoints([W, S, shift(S, solidTop), shift(W, solidTop)])} fill={palette.left} />
      <polygon points={polygonPoints([S, E, shift(E, solidTop), shift(S, solidTop)])} fill={palette.right} />

      {/* แถบฐาน = ชั้นล่าง/ทางเข้า */}
      {solidTop > 12 && (
        <>
          <polygon
            points={polygonPoints([W, S, shift(S, 7), shift(W, 7)])}
            fill={palette.base}
          />
          <polygon
            points={polygonPoints([S, E, shift(E, 7), shift(S, 7)])}
            fill={palette.edge}
          />
          <polygon
            points={polygonPoints([
              shift(lerp(W, S, 0.38), 2),
              shift(lerp(W, S, 0.62), 2),
              shift(lerp(W, S, 0.62), 6.5),
              shift(lerp(W, S, 0.38), 6.5),
            ])}
            fill={WINDOW_ON}
            opacity={0.75}
          />
        </>
      )}

      <Windows seed={s.id} W={W} S={S} E={E} height={solidTop} lit={lit} />

      {/* แถบคั่นชั้น — 1 เส้น = 1 หุ้นที่สะสมได้ */}
      {floorLines.map((y, i) => (
        <g key={i}>
          <polygon
            points={polygonPoints([
              shift(W, y),
              shift(S, y),
              shift(S, y + 1.6),
              shift(W, y + 1.6),
            ])}
            fill={palette.band}
          />
          <polygon
            points={polygonPoints([
              shift(S, y),
              shift(E, y),
              shift(E, y + 1.6),
              shift(S, y + 1.6),
            ])}
            fill={palette.edge}
          />
        </g>
      ))}

      {/* หลังคา — ถ้าสูง 0 (ของฟรี) อันนี้จะกลายเป็นที่ดินเปล่าราบกับพื้น */}
      <polygon
        points={polygonPoints([
          shift(N, solidTop),
          shift(E, solidTop),
          shift(S, solidTop),
          shift(W, solidTop),
        ])}
        fill={palette.top}
        fillOpacity={height === 0 ? 0.45 : 1}
        stroke={height === 0 ? palette.top : undefined}
        strokeWidth={height === 0 ? 1.5 : undefined}
        strokeDasharray={height === 0 ? "5 4" : undefined}
      />

      {/* ของบนดาดฟ้ามีได้เฉพาะตึกสูง — ตึกเตี้ยเอาพื้นที่ดาดฟ้าไปติดป้ายแทน */}
      {solidTop > NEON_MIN_HEIGHT && (
        <RoofKit seed={s.id} center={center} top={solidTop} palette={palette} />
      )}

      {/* ตึกสูง = ป้ายไฟบนผนัง · ตึกเตี้ย = ป้ายวางราบบนดาดฟ้า (ดาดฟ้ากว้างเท่ากันทุกตึก) */}
      {solidTop > NEON_MIN_HEIGHT ? (
        <NeonSign label={s.label} W={W} S={S} top={solidTop} />
      ) : (
        height > 0 && <RoofSign label={s.label} center={center} top={solidTop} />
      )}

      {/* ชั้นบนสุดที่ยังสะสมไม่ครบใบ — ขอบเส้นประรอบส่วนที่เป็นเศษ */}
      {hasPartial && (
        <g opacity={0.9}>
          <polyline
            points={polygonPoints([
              shift(W, partialStart),
              shift(S, partialStart),
              shift(E, partialStart),
            ])}
            fill="none"
            stroke={palette.top}
            strokeWidth={1}
            strokeDasharray="3 2"
          />
          <polygon
            points={polygonPoints([Nr, Er, Sr, Wr])}
            fill="none"
            stroke={palette.top}
            strokeWidth={1}
            strokeDasharray="3 2"
            opacity={0.8}
          />
        </g>
      )}

      {selected && (
        <polygon
          points={polygonPoints([
            shift(N, height),
            shift(E, height),
            shift(S, height),
            shift(W, height),
          ])}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2}
        />
      )}
    </g>
  );
}

/** ต่ำกว่านี้ผนังสั้นกว่าตัวป้าย ติดไปก็ลอยอยู่นอกตึก */
const NEON_MIN_HEIGHT = 56;

/**
 * ป้ายไฟบนผนังด้านซ้าย — ต้อง skew ตัวอักษรให้ระนาบเดียวกับผนัง
 * matrix แรกคือเวกเตอร์ทิศ W→S ของ isometric 2:1 (cos/sin ของ 26.57°)
 */
function NeonSign({
  label,
  W,
  S,
  top,
}: {
  label: string;
  W: Point;
  S: Point;
  top: number;
}) {
  // ผนังยาวเท่านี้ในระบบพิกัดของ matrix — ป้ายต้องไม่เกินนี้ ไม่งั้นล้นออกนอกตึก
  const wallLength = Math.hypot(S.x - W.x, S.y - W.y) / 0.894;
  const maxTextWidth = wallLength * 0.78;

  // ชื่อยาวก็ย่อฟอนต์ลงให้พอดีผนัง แทนที่จะปล่อยล้น
  const fontSize = Math.min(11, Math.max(6.5, maxTextWidth / (label.length * 0.72)));
  const textWidth = label.length * fontSize * 0.72;

  const anchor = shift(lerp(W, S, 0.12), top - Math.min(30, top * 0.32));

  return (
    <g transform={`matrix(0.894 0.447 0 1 ${anchor.x} ${anchor.y})`}>
      {/* แผ่นป้ายรองตัวอักษร ไม่งั้นนีออนจะจมไปกับแถวหน้าต่าง */}
      <rect
        x={-3}
        y={-fontSize - 1.5}
        width={textWidth + 6}
        height={fontSize + 4}
        rx={1}
        fill="#08111f"
        opacity={0.75}
      />
      <text
        x={0}
        y={0}
        className="font-bold"
        style={{
          fontFamily: "var(--font-geist-mono, monospace)",
          fontSize,
          fill: "#8fe6ff",
          letterSpacing: "0.04em",
          paintOrder: "stroke",
          stroke: "#8fe6ff",
          strokeWidth: 2.2,
          strokeOpacity: 0.22,
          strokeLinejoin: "round",
        }}
      >
        {label}
      </text>
    </g>
  );
}

/**
 * ป้ายบิลบอร์ดตั้งบนดาดฟ้า สำหรับตึกที่เตี้ยเกินกว่าจะมีผนังให้แปะ
 *
 * matrix เอียงเฉพาะแกนนอน (a,b = ทิศ W→S) ส่วนแกนตั้งปล่อยไว้ (c,d = 0,1)
 * ⇒ ป้ายหันหน้าถูกทิศตามเมือง แต่ยัง "ตั้งฉากกับพื้นโลก" จริงๆ
 * ถ้าเอียงทั้งสองแกนป้ายจะนอนราบไปกับหลังคาแทน
 *
 * ดาดฟ้ากว้างเท่ากันทุกตึกไม่ว่าจะเตี้ยแค่ไหน จึงติดป้ายได้โดยไม่ต้องดันความสูงให้ผิดสเกล
 */
function RoofSign({
  label,
  center,
  top,
}: {
  label: string;
  center: Point;
  top: number;
}) {
  // ความกว้างดาดฟ้าในระบบพิกัดของ matrix นี้ ≈ 38 หน่วย
  const fontSize = Math.min(10, 30 / (label.length * 0.72));
  const w = label.length * fontSize * 0.72 + 6;
  const h = fontSize + 4;
  const legH = 6;

  return (
    <g transform={`matrix(0.894 0.447 0 1 ${center.x} ${center.y - top})`}>
      {/* ขาตั้งสองข้าง ยึดป้ายกับดาดฟ้า */}
      <rect x={-w / 3 - 0.6} y={-legH} width={1.2} height={legH} fill="#2c4767" />
      <rect x={w / 3 - 0.6} y={-legH} width={1.2} height={legH} fill="#2c4767" />

      {/* แสงจากป้ายสาดลงดาดฟ้า */}
      <rect
        x={-w / 2}
        y={-legH - h - 1}
        width={w}
        height={h + 2}
        rx={1}
        fill="#8fe6ff"
        opacity={0.1}
      />

      <rect
        x={-w / 2}
        y={-legH - h}
        width={w}
        height={h}
        rx={1}
        fill="#08111f"
        stroke="#2c4767"
        strokeWidth={0.6}
        opacity={0.92}
      />
      <text
        x={0}
        y={-legH - h / 2}
        textAnchor="middle"
        dominantBaseline="central"
        className="font-bold"
        style={{
          fontFamily: "var(--font-geist-mono, monospace)",
          fontSize,
          fill: "#8fe6ff",
          letterSpacing: "0.04em",
          paintOrder: "stroke",
          stroke: "#8fe6ff",
          strokeWidth: 1.8,
          strokeOpacity: 0.2,
          strokeLinejoin: "round",
        }}
      >
        {label}
      </text>
    </g>
  );
}

/** ของบนดาดฟ้า — แท็งก์น้ำ/ช่องแอร์/เสาอากาศ ทำให้ยอดตึกไม่โล้น */
function RoofKit({
  seed,
  center,
  top,
  palette,
}: {
  seed: string;
  center: Point;
  top: number;
  palette: Palette;
}) {
  const pick = seededRandom(seed + "roof", 7);
  const cx = center.x;
  const cy = center.y - top;

  if (pick < 0.4) {
    // แท็งก์น้ำทรงกล่อง
    const w = 7;
    const h = 9;
    return (
      <g>
        <polygon
          points={polygonPoints([
            { x: cx - w, y: cy - 2 },
            { x: cx, y: cy - 2 + w / 2 },
            { x: cx, y: cy - 2 + w / 2 - h },
            { x: cx - w, y: cy - 2 - h },
          ])}
          fill={palette.right}
        />
        <polygon
          points={polygonPoints([
            { x: cx, y: cy - 2 + w / 2 },
            { x: cx + w, y: cy - 2 },
            { x: cx + w, y: cy - 2 - h },
            { x: cx, y: cy - 2 + w / 2 - h },
          ])}
          fill={palette.edge}
        />
        <polygon
          points={polygonPoints([
            { x: cx, y: cy - 2 - h - w / 2 },
            { x: cx + w, y: cy - 2 - h },
            { x: cx, y: cy - 2 - h + w / 2 },
            { x: cx - w, y: cy - 2 - h },
          ])}
          fill={palette.band}
        />
      </g>
    );
  }

  if (pick < 0.72) {
    // เสาอากาศ + ไฟกระพริบบนยอด
    return (
      <g>
        <rect x={cx - 0.8} y={cy - 20} width={1.6} height={20} fill={palette.edge} />
        <rect x={cx - 3} y={cy - 3} width={6} height={3} fill={palette.right} />
        <circle cx={cx} cy={cy - 21} r={1.8} fill="#ff6b5a" />
      </g>
    );
  }

  // ช่องแอร์เตี้ยๆ 2 ก้อน
  return (
    <g>
      <rect x={cx - 10} y={cy - 5} width={8} height={4} fill={palette.right} />
      <rect x={cx - 10} y={cy - 6} width={8} height={1.5} fill={palette.band} />
      <rect x={cx + 3} y={cy - 4} width={6} height={3} fill={palette.right} />
      <rect x={cx + 3} y={cy - 5} width={6} height={1.5} fill={palette.band} />
    </g>
  );
}

/** หน้าต่างบนสองหน้าที่มองเห็น — สัดส่วนที่ติดไฟบอกกำไร/ขาดทุน */
function Windows({
  seed,
  W,
  S,
  E,
  height,
  lit,
}: {
  seed: string;
  W: Point;
  S: Point;
  E: Point;
  height: number;
  lit: number;
}) {
  const ROW_H = 11;
  const WIN_H = 5.5;
  const rows = Math.floor((height - 12) / ROW_H);
  if (rows < 1) return null;

  const cells: React.ReactElement[] = [];
  let n = 0;

  for (const [a, b, side, dim] of [
    [W, S, "l", 1],
    [S, E, "r", 0.72],
  ] as const) {
    for (let r = 0; r < rows; r++) {
      const v = 9 + r * ROW_H;
      for (let c = 0; c < 3; c++) {
        const u0 = 0.14 + c * 0.26;
        const u1 = u0 + 0.16;
        const on = seededRandom(seed + side, n++) < lit;

        // แสงรั่วออกรอบบานที่เปิดไฟ — ทำให้เมืองกลางคืนดูเรืองแสงจริง
        if (on) {
          cells.push(
            <polygon
              key={`${side}-${r}-${c}-glow`}
              points={polygonPoints([
                shift(lerp(a, b, u0 - 0.035), v - 2),
                shift(lerp(a, b, u1 + 0.035), v - 2),
                shift(lerp(a, b, u1 + 0.035), v + WIN_H + 2),
                shift(lerp(a, b, u0 - 0.035), v + WIN_H + 2),
              ])}
              fill={WINDOW_ON}
              opacity={0.16 * dim}
            />,
          );
        }

        cells.push(
          <polygon
            key={`${side}-${r}-${c}`}
            points={polygonPoints([
              shift(lerp(a, b, u0), v),
              shift(lerp(a, b, u1), v),
              shift(lerp(a, b, u1), v + WIN_H),
              shift(lerp(a, b, u0), v + WIN_H),
            ])}
            fill={on ? WINDOW_ON : WINDOW_OFF}
            opacity={on ? dim : 0.85}
          />,
        );
      }
    }
  }

  return <g>{cells}</g>;
}

/**
 * ป้ายชื่อวาดแยกเป็นเลเยอร์บนสุด — ถ้าวาดไปพร้อมตึก ป้ายของตึกแถวหลัง
 * จะถูกตึกแถวหน้าทับ (เป็นธรรมชาติของ depth sort แบบ isometric)
 */
export function TowerLabel({
  placed,
  labelY,
  selected,
  hovered,
  onSelect,
  onHover,
}: {
  placed: PlacedStructure;
  /** ตำแหน่งที่ผ่านการหลบชนกับป้ายอื่นแล้ว */
  labelY: number;
  selected: boolean;
  hovered: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const { structure: s, center, height } = placed;
  const y = labelY;
  const w = Math.max(30, s.label.length * 7.5 + 10);
  const roofY = center.y - height - TILE_H / 2;
  const active = selected || hovered;

  return (
    <g
      className="cursor-pointer"
      onClick={() => onSelect(s.id)}
      onMouseEnter={() => onHover(s.id)}
      onMouseLeave={() => onHover(null)}
    >
      {/* ป้ายถูกดันหนีป้ายอื่น — ลากเส้นกลับไปหายอดตึกของตัวเอง */}
      {roofY - y > 8 && (
        <line
          x1={center.x}
          y1={y + 4}
          x2={center.x}
          y2={roofY - 1}
          stroke={active ? "var(--accent)" : "var(--border-bright)"}
          strokeWidth={1}
          strokeDasharray="2 2"
          opacity={0.8}
        />
      )}

      <rect
        x={center.x - w / 2}
        y={y - 9}
        width={w}
        height={13}
        rx={2}
        fill={selected ? "var(--accent)" : hovered ? "#152740" : "#0a1626"}
        stroke={active ? "var(--accent)" : "var(--border-bright)"}
        strokeWidth={1}
        opacity={0.96}
      />
      <text
        x={center.x}
        y={y + 0.5}
        textAnchor="middle"
        className="text-[9.5px] font-bold"
        style={{
          fontFamily: "var(--font-geist-mono, monospace)",
          fill: selected ? "var(--accent-fg)" : "var(--label)",
          letterSpacing: "0.03em",
        }}
      >
        {s.label}
      </text>

      {selected && (
        <text
          x={center.x}
          y={y + 15}
          textAnchor="middle"
          className="text-[9px]"
          style={{
            fill: "var(--accent)",
            paintOrder: "stroke",
            stroke: "#050c16",
            strokeWidth: 3,
            strokeLinejoin: "round",
          }}
        >
          {formatTHB(s.invested)} · {formatShares(s.units)} ชั้น
        </text>
      )}
    </g>
  );
}
