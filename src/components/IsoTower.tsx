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
import { plural, pluralize } from "@/lib/text";

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
   * New work goes on the tower currently under construction (the last one), because that's where new money goes.
   *
   * There used to be a DCA tally stuck to the side of each tower too, removed after it didn't work.
   * Why it failed: (1) it was a chart pasted into the city, not an object from this world
   * like the cranes/billboards/gold pile; (2) its horizontal ticks looked identical to the floor lines
   * that mean share count — different meaning, same look; (3) at 120 rounds
   * the ticks merged into a solid bar and became unreadable.
   * ⇒ round history moved into the "selected tower" card instead (SelectedTower).
   */
  const isNewestPart = partIndex === partCount - 1;

  /**
   * The front tower of a group labels the count directly, e.g. "SPYM ×4".
   *
   * Why not let people count: towers at the height cap are all the same height, and back-row
   * labels are hidden by the front row (showing as "PYM", "OGL") ⇒ counting by eye fails in a dense city.
   * The front tower of a group is the only one guaranteed to be unobstructed (greatest depth), so the
   * number goes there — you get the group size without needing to see every tower.
   *
   * (Outlining each group's area on the ground was tried, but in isometric view towers completely
   *  cover their own ground, so nothing was visible — removed.)
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
  // Towers are always solid to full height — as much as has been invested, that much is built.
  // A fractional share doesn't mean "unpaid", just that the top floor isn't a whole share yet.
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
        {`${s.label} — ${s.sublabel}\n${formatTHB(s.invested)} in · ${formatShares(s.units)} ${pluralize(s.units, "share")}` +
          (partCount > 1 ? `\nComplex of ${plural(partCount, "tower")} (no. ${partIndex + 1})` : "")}
      </title>

      {/* Shadow cast to the right — length follows the real height (light from the top left) */}
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

      {/* Tower body — height comes from money invested, not market price */}
      <polygon points={polygonPoints([W, S, shift(S, solidTop), shift(W, solidTop)])} fill={palette.left} />
      <polygon points={polygonPoints([S, E, shift(E, solidTop), shift(S, solidTop)])} fill={palette.right} />

      {/* Base band = ground floor / entrance */}
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

      {/* Floor lines — 1 line = 1 share held */}
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

      {/* Roof — at height 0 (a free holding) this becomes bare land flush with the ground */}
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

      {/* Rooftop clutter only on tall towers — short towers use the roof for their sign instead */}
      {solidTop > NEON_MIN_HEIGHT && (
        <RoofKit seed={s.id} center={center} top={solidTop} palette={palette} />
      )}

      {/*
        What was built this month — a differently coloured band at the top, as tall as the money actually added.
        However small, it stays true to scale, but is "found instantly" because its colour and scaffolding stand out.
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

      {/* Land with value but no money put in (a free holding) — shown as a gold pile, not a tower,
          because it wasn't built with your own money, yet it shouldn't vanish from the city when it has real value */}
      {height === 0 && s.marketValue > 0 && (
        <GoldPile center={center} value={s.marketValue} seed={s.id} />
      )}

      {/* Tall towers = neon sign on the wall · the rest = billboard on the roof/land.
          Gold-pile land needs the same kind of sign, or it would be the only thing in the city with a floating label */}
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

      {/* Top floor not yet a whole share — dashed outline around the fractional part */}
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

/** Below this the wall is shorter than the sign, which would float outside the tower */
const NEON_MIN_HEIGHT = 56;

/**
 * Sign colour = gain/loss, readable instantly without counting windows.
 *
 * The colour deliberately goes on the *sign*, not the *whole city's lights* — a sign is a small
 * spot you go to read; the lights are atmosphere, and tinting the whole city red in a downturn
 * is a fully red portfolio screen — the picture that makes people sell when they shouldn't.
 */
function signColor(health: number | null): string {
  if (health === null) return "#ffd88a"; // free holding, no % possible
  if (health > 0.005) return "#6ee7a5";
  if (health < -0.005) return "#ff8f7d";
  return "#8fe6ff"; // break-even
}

/** Height the sign must clear above the gold pile, or it sinks into the pile */
const GOLD_PILE_CLEARANCE = 20;

const GOLD = {
  rim: "#fff0b8",
  top: "#f2cf6b",
  left: "#c99a35",
  right: "#94701c",
  edge: "#5f4610",
};

/**
 * Positions of gold bars in the pile — stacked as a pyramid.
 * [dx, dy, layer] · layer 1 = bars lying on top
 */
const BAR_SLOTS: Array<[number, number, number]> = [
  [0, 2, 0],
  [-9, 4, 0],
  [9, 4, 0],
  [-4.5, -1, 1],
  [4.5, -1, 1],
];

/** One gold bar — tapered toward the top like a real bar, not a rectangular box */
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
      {/* Shiny top edge */}
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
 * Gold pile on land obtained for free — the number of bars roughly shows value.
 * Deliberately not a tower: towers are built with your own money, and this cost nothing.
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

  // Draw back to front, or the back bars would cover the front ones
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

      {/* Small sparkle on the top bar */}
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
 * Neon sign on the left wall — the text has to be skewed onto the wall's plane.
 * The first matrix row is the W→S direction vector of 2:1 isometric (cos/sin of 26.57°).
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
  // The wall's length in this matrix's coordinates — the sign must not exceed it or it overflows the tower
  const wallLength = Math.hypot(S.x - W.x, S.y - W.y) / 0.894;
  const maxTextWidth = wallLength * 0.78;

  // Long names get a smaller font to fit the wall instead of overflowing
  const fontSize = Math.min(11, Math.max(6.5, maxTextWidth / (label.length * 0.72)));
  const textWidth = label.length * fontSize * 0.72;

  const anchor = shift(lerp(W, S, 0.12), top - Math.min(30, top * 0.32));

  return (
    <g transform={`matrix(0.894 0.447 0 1 ${anchor.x} ${anchor.y})`}>
      {/* Backing plate behind the letters, or the neon would blend into the rows of windows */}
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
 * Billboard standing on the roof, for towers too short to have a wall to mount on.
 *
 * The matrix skews only the horizontal axis (a,b = the W→S direction) and leaves vertical alone (c,d = 0,1)
 * ⇒ the sign faces the right way for the city but stays truly perpendicular to the ground.
 * Skewing both axes would lay the sign flat on the roof instead.
 *
 * Every roof is the same width however short the tower, so signs fit without faking the height scale.
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
  // Roof width in this matrix's coordinates ≈ 38 units
  const fontSize = Math.min(10, 30 / (label.length * 0.72));
  const w = label.length * fontSize * 0.72 + 6;
  const h = fontSize + 4;
  const legH = 6;

  return (
    <g transform={`matrix(0.894 0.447 0 1 ${center.x} ${center.y - top})`}>
      {/* Two legs anchoring the sign to the roof */}
      <rect x={-w / 3 - 0.6} y={-legH} width={1.2} height={legH} fill="#2c4767" />
      <rect x={w / 3 - 0.6} y={-legH} width={1.2} height={legH} fill="#2c4767" />

      {/* Light from the sign spilling onto the roof */}
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

/** Rooftop clutter — water tank / AC units / antenna, so tower tops aren't bare */
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
    // Box-shaped water tank
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
    // Antenna + blinking light on top
    return (
      <g>
        <rect x={cx - 0.8} y={cy - 20} width={1.6} height={20} fill={palette.edge} />
        <rect x={cx - 3} y={cy - 3} width={6} height={3} fill={palette.right} />
        <circle className="anim-beacon" cx={cx} cy={cy - 21} r={1.8} fill="#ff6b5a" />
      </g>
    );
  }

  // Two low AC units
  return (
    <g>
      <rect x={cx - 10} y={cy - 5} width={8} height={4} fill={palette.right} />
      <rect x={cx - 10} y={cy - 6} width={8} height={1.5} fill={palette.band} />
      <rect x={cx + 3} y={cy - 4} width={6} height={3} fill={palette.right} />
      <rect x={cx + 3} y={cy - 5} width={6} height={1.5} fill={palette.band} />
    </g>
  );
}

/** Windows on the two visible faces — the share that are lit shows gain/loss */
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

        // Light bleeding around lit windows — makes the night city actually glow
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

        // Some windows switch on and off now and then, as if people inside are living their lives
        // Chosen deterministically per window, or the picture would change when motion is switched off
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
 * Labels are drawn as a separate top layer — drawn with the towers, back-row labels
 * would be covered by front-row towers (the nature of isometric depth sorting).
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
  /** Position after collision avoidance with other labels */
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
      {/* A label pushed away from others — draw a line back to its own tower top */}
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
          {formatTHB(s.invested)} · {formatShares(s.units)} floors
        </text>
      )}
    </g>
  );
}

/**
 * Work done in the last few days — coloured band at the top + scaffolding + crane.
 *
 * The band's height = money just added as a share of the tower's total (exactly true to scale).
 * It will always be very thin, and that's the truth — what makes it visible is the *colour* and the *crane*,
 * not exaggerating its size.
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
  // At least 3px so it still reads as a band, not a single line — not inflating the value
  const band = Math.max(3, Math.min(height, ratio * height));
  const base = top - band;

  return (
    <g>
      {/* New-work band on the two visible faces */}
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

      {/* Vertical scaffolding lines across the band — reads as "work not finished yet" */}
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

/** Small crane on the roof — just enough to say this tower has work going on, without hiding it */
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
