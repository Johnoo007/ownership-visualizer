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
 * Wall thickness as a fraction of a grid cell.
 *
 * ⚠️ The first version filled the whole cell (112px wide, 26px tall) and read as
 * a "concrete highway", not a wall — real walls are thin and tall, not wide and low.
 * ⇒ full cell length along its run, but only ~1/3 of a cell thick across it.
 */
const THICK = 0.17;
const WALL_H = 40;
const TOWER_H = 62;
const MERLON_H = 8;

/**
 * Stone needs a *material colour*, not plain grey.
 *
 * ⚠️ The previous version was plain colourless grey (#3b4453), and the feedback was
 * "looks unfinished, like someone forgot to paint it" — exactly right: it was a greybox.
 * Everything else in the city has a material colour: blue towers · green grass · gold gold pile ·
 * warm brown bricks/sand on the construction site — only the wall had none.
 *
 * ⇒ a dark warm sandstone, in the same family as the existing brick/sand piles,
 *   and clearly distinct from the blue towers = instantly reads as a different kind of thing.
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
 * Freshly laid bricks — new stone hasn't weathered yet, so it's brighter and warmer than old stone.
 *
 * ⚠️ Deliberately differs from old stone only in *value*, not hue — a different hue
 * would read as a different material (a striped wall), not the same wall just extended.
 */
const FRESH_STONE = {
  top: "#8d7f63",
  front: "#74674e",
  side: "#4f4634",
};

/**
 * Ruins of wall sections that fell because money was withdrawn.
 *
 * Unlike RUBBLE (never built), it has **real fallen stone piled up** and
 * scorch marks / extinguished torches ⇒ reads as "there used to be a wall here", not "not built yet".
 */
const BROKEN = {
  top: "#5e4536",
  front: "#4a352a",
  side: "#33241d",
};

const CRACK = "#ff8f7d";

/**
 * City wall = emergency fund.
 *
 * Deliberately not a tower: a tower is money that became ownership and keeps growing.
 * The wall **doesn't make the city any bigger — it keeps the city from falling**.
 * The two must read as different kinds of thing at first glance.
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

  /** Convert relative grid coordinates (from the cell centre) to screen coordinates */
  const p = (dx: number, dy: number, lift = 0): Point => ({
    x: c.x + ((dx - dy) * PITCH_W) / 2,
    y: c.y + ((dx + dy) * PITCH_H) / 2 - lift,
  });

  // The wall's long axis follows the ring's direction, not one axis for the whole city
  const alongX = seg.side === "ne" || seg.side === "sw";
  // Corner towers are square; wall sections are long and thin
  const ex = seg.corner ? 0.3 : alongX ? 0.5 : THICK;
  const ey = seg.corner ? 0.3 : alongX ? THICK : 0.5;
  const h = seg.corner ? TOWER_H : WALL_H;

  if (seg.broken) {
    /**
     * A section that just fell because money was withdrawn — must read as "there was a wall here".
     *
     * This is the opposite of new bricks, and the reason the wall needs history:
     * withdrawing from the reserve and just seeing the months figure drop is too quiet for
     * something that means "months of safety are gone".
     */
    return <Breach p={p} c={c} ex={ex} ey={ey} gx={seg.gx} gy={seg.gy} />;
  }

  if (!seg.built) {
    /**
     * A section not built yet — a foundation left waiting; must read as "this is a gap".
     * A gap is a month not yet covered — the one thing in the picture that should feel uncomfortable.
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

  // Merlons follow the wall's long axis — on the outer ridge, not the middle of the top
  const merlonCount = seg.corner ? 2 : 4;
  const merlons = Array.from({ length: merlonCount }, (_, i) => {
    const t = (i + 0.5) / merlonCount - 0.5; // −0.5 .. 0.5 along the length
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
        Scaffolding on freshly laid bricks — same language as the towers' scaffolding/cranes (amber gold),
        because it means the same thing: "work just happened here".
      */}
      {seg.fresh && <Scaffold p={p} ex={ex} ey={ey} h={h} />}

      {/*
        Lights on the wall — what makes it pleasant to look at at night, not the stone itself.
        Corner towers get a large blinking light; wall sections get small spaced-out torches.
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
 * A three-faced stone block in isometric view.
 *
 * The visible faces are +gy (sloping down-left, lit) and +gx (sloping down-right, in shadow),
 * following the same lighting rule as the towers: light comes from the top left.
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
      {/* Lit face (+gy) */}
      <polygon
        points={polygonPoints([p(-ex, ey), p(ex, ey), p(ex, ey, h), p(-ex, ey, h)])}
        fill={palette.front}
      />
      {/* Shadow face (+gx) */}
      <polygon
        points={polygonPoints([p(ex, -ey), p(ex, ey), p(ex, ey, h), p(ex, -ey, h)])}
        fill={palette.side}
      />
      {/* Top ridge */}
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
        Masonry pattern — horizontal lines alone still read as a cast concrete slab;
        it needs vertical joints offset row by row (running bond) to read as stones laid one by one.
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
 * Scaffolding on a freshly built section — two poles on the lit face + a beam across.
 *
 * Why, when the stone is already brighter: shade differences are hard to see zoomed out
 * (from afar the wall is a thin strip), but a gold line across it is visible at any distance
 * — the same reason towers get a crane, not just a coloured band.
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
  // The lit face is the +gy side · spaced along that face's length
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
 * A wall section broken by a withdrawal — low stumps + fallen stones + cracks.
 *
 * ⚠️ Must not look like an unbuilt section (RUBBLE + dashed outline = "planned, waiting").
 * This must read as ruins: darker reddish stone, scattered debris, cracks in the loss colour,
 * and **no light** — the torches that used to burn here went out with the wall.
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
   * ⚠️ Heights must not all be equal.
   *
   * The first version used a uniform 11px and long runs of ruins read as a **ramp**,
   * not ruins — the same lesson as before (first wall = "concrete highway"):
   * things that don't look real are wrong in proportion first · real ruins break unevenly,
   * some stumps stay tall, some are flattened ⇒ deterministic randomness from coordinates (stable every render).
   */
  const stump = 3 + seededRandom(`breach${gx}:${gy}`, gx * 17 + gy) * 15;

  return (
    <g>
      <polygon
        points={polygonPoints([p(-ex, -ey), p(ex, -ey), p(ex, ey), p(-ex, ey)])}
        fill="#1c1410"
      />

      {/* Stumps left from the old wall — much lower than the wall, but not flush with the ground */}
      <Box p={p} ex={ex} ey={ey} h={stump} palette={BROKEN} />

      {/*
        Stones fallen beside the ruins — evidence that something taller stood here.
        Uses the wall's stone colour (not the ruin colour), because it's the same stone that fell.
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

      {/* Cracks on the stumps — jagged lines, not straight ones, or they read as mortar joints */}
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

/** Flame + glow — same visual language as the city's street lights */
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
 * City gate — two towers flanking an opening, with warm light spilling out.
 *
 * Why: a ring sealed on every side reads as "a barrier", not "a walled city".
 * The gate is the one thing that says people live inside, and it anchors the whole picture.
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
  // Two pillars on either side, opening in the middle
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

      {/* Warm light spilling through the gateway */}
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

      {/* Lintel above the gateway */}
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
 * Masonry pattern on one wall face.
 *
 * a→b is the bottom edge of the face · rows offset by half a block, running bond
 * Short faces (the ends) use fewer blocks, otherwise the pattern gets too dense to read.
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
      // Even/odd rows offset by half a block
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
