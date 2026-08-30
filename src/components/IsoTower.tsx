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
  const { structure: s, center, height, partIndex, partCount } = placed;
  /**
   * งานที่เพิ่งสร้างต้องขึ้นบนหลังที่กำลังก่อสร้าง (หลังสุดท้าย) เพราะเงินใหม่เข้าที่นั่น
   *
   * เคยมี "ไม้บรรทัดนับไม้ DCA" แปะข้างตึกด้วย แต่ถอดออกแล้ว — John: "ไม่ค่อย work"
   * เหตุผลที่มันพัง: (1) มันเป็นกราฟที่เอาไปแปะในเมือง ไม่ใช่สิ่งของในโลกนี้
   * เหมือนเครน/บิลบอร์ด/กองทอง (2) ขีดแนวนอนไล่ขึ้นไปหน้าตาซ้ำกับเส้นแบ่งชั้น
   * ที่แปลว่าจำนวนหุ้น — ความหมายคนละเรื่องแต่หน้าตาเหมือนกัน (3) พอ 120 ไม้
   * ขีดชิดกันจนกลายเป็นแท่งทึบ อ่านไม่ออก
   * ⇒ ย้ายประวัติไม้ไปอยู่ในการ์ด "ตึกที่เลือก" แทน (SelectedTower)
   */
  const isNewestPart = partIndex === partCount - 1;

  /**
   * ป้ายของตึกหน้าสุดในกลุ่มบอกจำนวนหลังไปเลย เช่น "SPYM ×4"
   *
   * ทำไมไม่ให้นับเอาเอง: ตึกที่ชนเพดานสูงเท่ากันหมด ป้ายของตึกแถวหลังก็โดน
   * ตึกแถวหน้าบัง (เห็นเป็น "PYM" "OGL") ⇒ นับด้วยตาไม่ได้จริงตอนเมืองหนาแน่น
   * ตึกหน้าสุดของกลุ่มเป็นหลังเดียวที่ไม่มีอะไรบังแน่นอน (depth มากสุด) จึงเอาเลข
   * ไปแปะไว้ตรงนั้น — ได้ขนาดกลุ่มโดยไม่ต้องเห็นครบทุกหลัง
   *
   * (เคยลองตีเส้นอาณาเขตบนพื้นแทน แต่ในมุม isometric ตึกทับพื้นของตัวเองมิด
   *  มองไม่เห็นอะไรเลย จึงถอดออก)
   */
  const signLabel =
    partCount > 1 && isNewestPart ? `${s.label} ×${partCount}` : s.label;
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
        {`${s.label} — ${s.sublabel}\nลงเงิน ${formatTHB(s.invested)} · ${formatShares(s.units)} หุ้น` +
          (partCount > 1 ? `\nกลุ่มอาคาร ${partCount} หลัง (หลังที่ ${partIndex + 1})` : "")}
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

      {/*
        ส่วนที่เพิ่งสร้างเดือนนี้ — แถบสีต่างพาดที่ยอดตึก สูงตามเงินที่เพิ่งเติมจริง
        เล็กแค่ไหนก็ตามความจริง แต่ "หาเจอทันที" เพราะสีกับนั่งร้านต่างจากที่เหลือ
      */}
      {s.recentAdd !== null && height > 0 && isNewestPart && (
        <FreshWork
          W={W}
          S={S}
          E={E}
          top={solidTop}
          center={center}
          amount={s.recentAdd}
          invested={s.invested}
          height={height}
        />
      )}

      {/* ที่ดินที่ไม่ได้ลงเงินสร้างแต่มีมูลค่า (ของที่ได้มาฟรี) — วางเป็นกองทอง ไม่ใช่ตึก
          เพราะมันไม่ได้ถูกสร้างด้วยเงินตัวเอง แต่ก็ไม่ควรหายไปจากเมืองทั้งที่มีมูลค่าจริง */}
      {height === 0 && s.marketValue > 0 && (
        <GoldPile center={center} value={s.marketValue} seed={s.id} />
      )}

      {/* ตึกสูง = ป้ายไฟบนผนัง · ที่เหลือ = บิลบอร์ดปักบนดาดฟ้า/บนที่ดิน
          ที่ดินที่มีแต่กองทองก็ต้องมีป้ายแบบเดียวกัน ไม่งั้นจะเป็นชิ้นเดียวในเมืองที่ใช้ป้ายลอย */}
      {solidTop > NEON_MIN_HEIGHT ? (
        <NeonSign
          label={signLabel}
          W={W}
          S={S}
          top={solidTop}
          color={signColor(s.health)}
        />
      ) : (
        (height > 0 || s.marketValue > 0) && (
          <RoofSign
            label={signLabel}
            center={center}
            top={height > 0 ? solidTop : GOLD_PILE_CLEARANCE}
            color={signColor(s.health)}
          />
        )
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
 * สีป้าย = สถานะกำไร/ขาดทุน อ่านออกทันทีโดยไม่ต้องนับหน้าต่าง
 *
 * จงใจใส่สีที่ "ป้าย" ไม่ใช่ที่ "ไฟทั้งเมือง" — ป้ายเป็นจุดเล็กที่ตั้งใจไปอ่าน
 * ส่วนไฟคือบรรยากาศ ถ้าย้อมแดงทั้งเมืองตอนตลาดตก มันคือหน้าจอพอร์ตแดงทั้งจอ
 * ซึ่งเป็นภาพที่ทำให้คนขายตอนไม่ควรขาย
 */
function signColor(health: number | null): string {
  if (health === null) return "#ffd88a"; // ของฟรี คิด % ไม่ได้
  if (health > 0.005) return "#6ee7a5";
  if (health < -0.005) return "#ff8f7d";
  return "#8fe6ff"; // เสมอทุน
}

/** ความสูงที่ป้ายต้องอยู่เหนือกองทอง ไม่งั้นป้ายจะจมเข้าไปในกอง */
const GOLD_PILE_CLEARANCE = 20;

const GOLD = {
  rim: "#fff0b8",
  top: "#f2cf6b",
  left: "#c99a35",
  right: "#94701c",
  edge: "#5f4610",
};

/**
 * ตำแหน่งแท่งทองในกอง — วางซ้อนเป็นพีระมิด
 * [dx, dy, layer] · layer 1 = แท่งที่วางทับอยู่ด้านบน
 */
const BAR_SLOTS: Array<[number, number, number]> = [
  [0, 2, 0],
  [-9, 4, 0],
  [9, 4, 0],
  [-4.5, -1, 1],
  [4.5, -1, 1],
];

/** แท่งทองหนึ่งแท่ง — ทรงสอบเข้าด้านบนแบบแท่งจริง ไม่ใช่กล่องสี่เหลี่ยม */
function GoldBar({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const topW = w * 0.66;
  const b = (dx: number, dy: number) => ({ x: x + dx, y: y + dy });

  const baseS = b(0, w / 4);
  const baseE = b(w / 2, 0);
  const baseW = b(-w / 2, 0);

  const topN = b(0, -h - topW / 4);
  const topE = b(topW / 2, -h);
  const topS = b(0, -h + topW / 4);
  const topW_ = b(-topW / 2, -h);

  return (
    <g>
      <polygon
        points={polygonPoints([baseW, baseS, topS, topW_])}
        fill={GOLD.left}
      />
      <polygon points={polygonPoints([baseS, baseE, topE, topS])} fill={GOLD.right} />
      <polygon
        points={polygonPoints([topN, topE, topS, topW_])}
        fill={GOLD.top}
        stroke={GOLD.rim}
        strokeWidth={0.5}
      />
      {/* ขอบมันวาวด้านบน */}
      <polyline
        points={polygonPoints([topW_, topN, topE])}
        fill="none"
        stroke={GOLD.rim}
        strokeWidth={0.8}
        opacity={0.9}
      />
      <polyline
        points={polygonPoints([baseW, baseS, baseE])}
        fill="none"
        stroke={GOLD.edge}
        strokeWidth={0.5}
        opacity={0.6}
      />
    </g>
  );
}

/**
 * กองทองบนที่ดินที่ได้มาฟรี — จำนวนแท่งบอกมูลค่าแบบหยาบๆ
 * จงใจไม่ทำเป็นตึก เพราะตึก = สิ่งที่สร้างด้วยเงินตัวเอง ส่วนอันนี้ไม่ได้จ่ายไปสักบาท
 */
function GoldPile({
  center,
  value,
  seed,
}: {
  center: Point;
  value: number;
  seed: string;
}) {
  const count =
    value < 2_000 ? 1 : value < 5_000 ? 2 : value < 15_000 ? 3 : value < 40_000 ? 4 : 5;

  const barW = 16;
  const barH = 5.5;
  const layerLift = 5;

  // วาดจากหลังไปหน้า ไม่งั้นแท่งหลังจะทับแท่งหน้า
  const slots = BAR_SLOTS.slice(0, count)
    .map(([dx, dy, layer]) => ({ dx, dy, layer }))
    .sort((a, b) => a.layer - b.layer || a.dy - b.dy);

  return (
    <g>
      <ellipse
        cx={center.x}
        cy={center.y + 5}
        rx={20}
        ry={8}
        fill="rgba(0,0,0,0.45)"
      />

      {slots.map((s, i) => (
        <GoldBar
          key={i}
          x={center.x + s.dx}
          y={center.y + s.dy - s.layer * layerLift}
          w={barW}
          h={barH}
        />
      ))}

      {/* ประกายเล็กๆ บนแท่งบนสุด */}
      {[0, 1].map((i) => {
        const sx = center.x + (seededRandom(seed + "sp", i) - 0.5) * 16;
        const sy =
          center.y - (count > 3 ? 12 : 6) - seededRandom(seed + "sy", i) * 3;
        return (
          <g key={`sp${i}`} opacity={0.85}>
            <rect x={sx - 2} y={sy - 0.3} width={4} height={0.6} fill="#fffbe8" />
            <rect x={sx - 0.3} y={sy - 2} width={0.6} height={4} fill="#fffbe8" />
          </g>
        );
      })}
    </g>
  );
}

/**
 * ป้ายไฟบนผนังด้านซ้าย — ต้อง skew ตัวอักษรให้ระนาบเดียวกับผนัง
 * matrix แรกคือเวกเตอร์ทิศ W→S ของ isometric 2:1 (cos/sin ของ 26.57°)
 */
function NeonSign({
  label,
  W,
  S,
  top,
  color,
}: {
  label: string;
  W: Point;
  S: Point;
  top: number;
  color: string;
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
          fill: color,
          letterSpacing: "0.04em",
          paintOrder: "stroke",
          stroke: color,
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
  color,
}: {
  label: string;
  center: Point;
  top: number;
  color: string;
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
        fill={color}
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
          fill: color,
          letterSpacing: "0.04em",
          paintOrder: "stroke",
          stroke: color,
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
        <circle className="anim-beacon" cx={cx} cy={cy - 21} r={1.8} fill="#ff6b5a" />
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

        // ให้บางบานเปิด-ปิดไฟเป็นระยะ เหมือนคนในตึกยังใช้ชีวิตอยู่
        // เลือกแบบคงที่ต่อบาน ไม่งั้นตอนปิดสวิตช์ภาพจะเปลี่ยนไปจากเดิม
        const flickers = on && seededRandom(seed + side + "f", n) > 0.86;

        cells.push(
          <polygon
            key={`${side}-${r}-${c}`}
            className={flickers ? "anim-window" : undefined}
            points={polygonPoints([
              shift(lerp(a, b, u0), v),
              shift(lerp(a, b, u1), v),
              shift(lerp(a, b, u1), v + WIN_H),
              shift(lerp(a, b, u0), v + WIN_H),
            ])}
            fill={on ? WINDOW_ON : WINDOW_OFF}
            opacity={on ? dim : 0.85}
            style={
              flickers
                ? ({
                    "--win-o": dim,
                    "--dur": `${(12 + seededRandom(seed + "wd", n) * 20).toFixed(0)}s`,
                    "--delay": `${(seededRandom(seed + "wl", n) * 15).toFixed(1)}s`,
                  } as React.CSSProperties)
                : undefined
            }
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

/**
 * งานที่เพิ่งสร้างในรอบไม่กี่วันนี้ — แถบสีที่ยอดตึก + นั่งร้าน + เครน
 *
 * ความสูงของแถบ = สัดส่วนเงินที่เพิ่งเติมต่อเงินทั้งก้อนของตึกนี้ (ตามจริงเป๊ะ)
 * มันจะบางมากเสมอ นั่นแหละคือความจริง — สิ่งที่ทำให้เห็นคือ *สี* กับ *เครน*
 * ไม่ใช่การโม้ขนาด
 */
function FreshWork({
  W,
  S,
  E,
  top,
  center,
  amount,
  invested,
  height,
}: {
  W: Point;
  S: Point;
  E: Point;
  top: number;
  center: Point;
  amount: number;
  invested: number;
  height: number;
}) {
  const ratio = invested > 0 ? Math.min(1, amount / invested) : 1;
  // ขั้นต่ำ 3px เพื่อให้ยังเห็นเป็นแถบ ไม่ใช่เส้นเดียว — ไม่ใช่การขยายค่าให้ดูเยอะ
  const band = Math.max(3, Math.min(height, ratio * height));
  const base = top - band;

  return (
    <g>
      {/* แถบงานใหม่บนสองหน้าที่มองเห็น */}
      <polygon
        points={polygonPoints([
          shift(W, base),
          shift(S, base),
          shift(S, top),
          shift(W, top),
        ])}
        fill="#c9a227"
        opacity={0.55}
      />
      <polygon
        points={polygonPoints([
          shift(S, base),
          shift(E, base),
          shift(E, top),
          shift(S, top),
        ])}
        fill="#a8871d"
        opacity={0.55}
      />

      {/* เส้นนั่งร้านแนวตั้งพาดแถบ — อ่านออกว่า "ยังไม่เก็บงาน" */}
      {[0.25, 0.5, 0.75].map((t) => (
        <line
          key={t}
          x1={W.x + (S.x - W.x) * t}
          y1={W.y + (S.y - W.y) * t - top}
          x2={W.x + (S.x - W.x) * t}
          y2={W.y + (S.y - W.y) * t - base}
          stroke="#e8c46a"
          strokeWidth={0.7}
          opacity={0.7}
        />
      ))}

      <MiniCrane x={center.x - 12} y={center.y - top} h={Math.max(18, height * 0.22)} />
    </g>
  );
}

/** เครนเล็กบนดาดฟ้า — แค่พอบอกว่าตึกนี้กำลังมีงาน ไม่ให้บังตัวตึก */
function MiniCrane({ x, y, h }: { x: number; y: number; h: number }) {
  const jib = Math.max(10, h * 0.55);
  return (
    <g
      className="anim-crane"
      style={{ "--pivot": "50% 100%", "--dur": "12s" } as React.CSSProperties}
    >
      <rect x={x - 1} y={y - h} width={2} height={h} fill="#c9a227" />
      <rect x={x - 1.6} y={y - h - 1.8} width={jib} height={1.8} fill="#c9a227" />
      <rect x={x - 5} y={y - h - 1.8} width={3.6} height={1.8} fill="#8a7420" />
      <line
        x1={x + jib - 4}
        y1={y - h}
        x2={x + jib - 4}
        y2={y - h + h * 0.3}
        stroke="#8494a8"
        strokeWidth={0.6}
      />
      <circle cx={x} cy={y - h - 3.5} r={1.2} fill="#ff6b5a" className="anim-beacon" />
    </g>
  );
}
