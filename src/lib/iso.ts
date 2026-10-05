import type { Structure } from "./types";

/**
 * Spacing between plots (pitch), separate from the tower footprint — there must be a gap,
 * otherwise towers merge into one solid mass and you can't tell how many there are.
 */
export const PITCH_W = 112;
export const PITCH_H = 56;

/** Tower footprint size, 2:1 isometric */
export const TILE_W = 68;
export const TILE_H = 34;

/**
 * Tower height: the minimum is just enough to see a tower exists — not to flatter small ones.
 * MIN_H must be genuinely small, or a holding with tens of thousands in it looks the same as one with 0.
 */
export const MIN_H = 5;

/** Beyond this, floor lines get too dense to read — switch to drawing a texture instead */
export const MAX_DRAWN_FLOORS = 40;

export type Point = { x: number; y: number };

/** Centre of plot (gx, gy) in iso coordinates */
export function tileCenter(gx: number, gy: number): Point {
  return {
    x: (gx - gy) * (PITCH_W / 2),
    y: (gx + gy) * (PITCH_H / 2),
  };
}

/** The four corners of the rhombus around a centre point (N/E/S/W) */
export function rhombus(center: Point, lift = 0): [Point, Point, Point, Point] {
  const { x, y } = center;
  const cy = y - lift;
  return [
    { x, y: cy - TILE_H / 2 }, // N
    { x: x + TILE_W / 2, y: cy }, // E
    { x, y: cy + TILE_H / 2 }, // S
    { x: x - TILE_W / 2, y: cy }, // W
  ];
}

export function polygonPoints(points: Point[]): string {
  return points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

/**
 * The city's ruler: baht per 1px of height — **constant for the life of the app, never change it**.
 *
 * ⚠️ The old ruler stepped by ×√2 based on the tallest tower, and it broke like this:
 * when the tallest tower grew past a step, the ruler jumped and **every tower shrank 29% at once**.
 * Example: a ~฿90,000 tower → add another ฿24,000 and it **drops from 356px to 261px**,
 * while GOOGL, untouched, shrank from 159px to 112px.
 * ⇒ the city shrank when the owner did the most correct thing — adding money — directly breaking the app's first promise.
 *
 * A ruler that moves = progress periodically eaten back · pin it and towers never shrink.
 * When the city outgrows the screen, **the camera pulls back** (the viewBox grows), towers don't get shorter.
 * The difference: pulling the camera back keeps tower-to-land proportions, so the eye reads a bigger city.
 *
 * The value 320 preserved the city's look on the day it changed (a ~฿90,000 tower ≈ 281px ≈ before).
 */
export const THB_PER_PX = 320;

/**
 * Height is directly proportional to money invested (linear, never log).
 * Log would make near-empty holdings look bigger than they are — small should look small.
 *
 * No ceiling: a ceiling is exactly what forced an adjustable ruler in the first place.
 */
export function heightFor(invested: number): number {
  // Zero invested (a free holding) = no tower, just land — matching "height = money invested"
  // Forcing MIN_H here would make a ฿0 tower as tall as a ฿1,572 one, which lies to the eye
  if (invested <= 0) return 0;
  return Math.max(MIN_H, invested / THB_PER_PX);
}

/**
 * Height cap per tower — beyond it a new tower goes up next door instead of stretching the old one.
 *
 * Why: the pinned ruler (THB_PER_PX) fixed shrinking towers, but turns towers into needles
 * as the portfolio grows — at ฿560,000 a single tower is 25.7× as tall as a plot is wide.
 * Splitting into several towers keeps the ratio at 5.9× forever, however large the portfolio gets.
 *
 * ⚠️ Hard rule: **never split an existing tower into several equal parts**
 * (฿142,364 → 2 towers of 222px each = the original shrinks from 445px, which is the √2 bug again).
 * A tower that reached the cap **stays at the cap forever**, and the new tower grows from zero beside it
 * ⇒ every tower's height is a non-decreasing function of money · walking ฿0→฿800,000 one round at a time,
 *   no tower ever gets shorter, even once (locked by a test).
 */
export const TOWER_CAP_PX = 400;
export const TOWER_CAP_THB = TOWER_CAP_PX * THB_PER_PX;

/**
 * Split one holding's money into the heights of its towers.
 * Earlier towers are always at the cap; the last one is the one under construction.
 */
export function towerHeights(invested: number): number[] {
  const h = heightFor(invested);
  if (h <= TOWER_CAP_PX) return [h];

  const full = Math.floor(invested / TOWER_CAP_THB);
  const rest = heightFor(invested - full * TOWER_CAP_THB);
  const out = Array.from({ length: full }, () => TOWER_CAP_PX);
  // A remainder smaller than MIN_H must still become a new tower, or it would vanish right at the cap
  if (invested - full * TOWER_CAP_THB > 0) out.push(rest);
  return out;
}

export type PlacedStructure = {
  structure: Structure;
  /** Which tower of this holding (0 = first) — the last one is the one being built */
  partIndex: number;
  partCount: number;
  gx: number;
  gy: number;
  center: Point;
  height: number;
  /** Larger = further forward — used to order drawing */
  depth: number;
};

export type DistrictLayout = {
  id: string;
  placed: PlacedStructure[];
  /** First row of this district in the combined grid */
  startRow: number;
  /** Rows this district takes in the combined grid */
  rows: number;
};

export type CityLayout = {
  districts: DistrictLayout[];
  all: PlacedStructure[];
  bounds: { minX: number; minY: number; width: number; height: number };
};

const DISTRICT_GAP = 2;

/**
 * City layout: districts recede backwards; within a district, money sorted high → low.
 * Big holdings are pushed to the back rows (small gx+gy) so they don't hide short towers in front.
 */
export function layoutCity(
  structures: Structure[],
  districtOrder: string[],
  /** Districts placed "off to the side" (extending along gx) instead of stacking below */
  asideDistricts: string[] = [],
): CityLayout {
  const districts: DistrictLayout[] = [];
  const all: PlacedStructure[] = [];
  let rowOffset = 0;

  const place = (
    districtId: string,
    originX: number,
    originY: number,
  ): number => {
    const rows_ = structures
      .filter((s) => s.district === districtId)
      .sort((a, b) => b.invested - a.invested);

    if (rows_.length === 0) return 0;

    /**
     * Holdings spanning several plots are arranged as a *square block*, not a long row.
     *
     * Why: once the portfolio grows and many towers hit the cap, they're all the same height,
     * and at a glance you can't tell which holding is bigger (in year 30, 47% are at the cap).
     * ⇒ size moves from "height" to "area occupied".
     * SPYM's 4 towers become a 2×2 block = reads as territory, not 4 equally tall towers.
     *
     * Leftover slots in a block (e.g. 3 towers in a 2×2 block) are deliberately left empty —
     * that's exactly the plot where the next tower will go up.
     */
    const blocks = rows_.map((structure) => {
      const heights = towerHeights(structure.invested);
      const w = Math.max(1, Math.ceil(Math.sqrt(heights.length)));
      return {
        w,
        h: Math.ceil(heights.length / w),
        parts: heights.map((height, partIndex) => ({
          structure,
          height,
          partIndex,
          partCount: heights.length,
        })),
      };
    });

    /**
     * Place blocks by shelf packing — left to right until the row is full, then a new row.
     * Bigger blocks come first (money high → low), so they end up in the back rows, not hiding short towers.
     *
     * ⚠️ Leaving one empty plot between blocks was tried and was worse:
     * one grid cell = 112px = a very wide road, so the city looked sparse and towers isolated again.
     * ⇒ keep the density; block size is shown by the "×N" label on the front tower instead.
     */
    const BLOCK_GAP = 0;
    const totalParts = blocks.reduce((a, b) => a + b.parts.length, 0);
    const maxCols = Math.max(2, Math.ceil(Math.sqrt(totalParts)) + 1);

    const placed: PlacedStructure[] = [];
    let shelfX = 0;
    let shelfY = 0;
    let shelfH = 0;

    for (const block of blocks) {
      if (shelfX > 0 && shelfX + block.w > maxCols) {
        shelfY += shelfH + BLOCK_GAP;
        shelfX = 0;
        shelfH = 0;
      }
      block.parts.forEach((part, i) => {
        const gx = originX + shelfX + (i % block.w);
        const gy = originY + shelfY + Math.floor(i / block.w);
        placed.push({ ...part, gx, gy, center: tileCenter(gx, gy), depth: gx + gy });
      });
      shelfX += block.w + BLOCK_GAP;
      shelfH = Math.max(shelfH, block.h);
    }

    const usedRows = shelfY + shelfH;
    districts.push({ id: districtId, placed, startRow: originY, rows: usedRows });
    all.push(...placed);
    return usedRows;
  };

  // Main districts stack downwards along gy
  for (const districtId of districtOrder) {
    if (asideDistricts.includes(districtId)) continue;
    const used = place(districtId, 0, rowOffset);
    if (used > 0) rowOffset += used + DISTRICT_GAP;
  }

  // Side districts extend along gx from the city's right edge
  const mainMaxGx = all.length > 0 ? Math.max(...all.map((p) => p.gx)) : 0;
  let asideX = mainMaxGx + DISTRICT_GAP + 1;
  for (const districtId of asideDistricts) {
    const before = all.length;
    place(districtId, asideX, 0);
    const added = all.slice(before);
    if (added.length > 0) {
      asideX += Math.max(...added.map((p) => p.gx)) - asideX + 1 + DISTRICT_GAP;
    }
  }

  // Back to front — nearer towers correctly cover farther ones
  all.sort((a, b) => a.depth - b.depth || a.gx - b.gx);

  return { districts, all, bounds: boundsOf(all) };
}

export type CellKind = "plot" | "road" | "vacant" | "grass" | "wall";

export type GroundCell = {
  gx: number;
  gy: number;
  kind: CellKind;
  center: Point;
  depth: number;
  /** Decoration — deterministic, so it doesn't flicker on re-render */
  decor: "none" | "tree" | "bush" | "car" | "lamp" | "person";
  /**
   * This cell's road axis — cars, lane markings and kerbside pedestrians all follow it.
   * "x" = road runs along +gx · "y" = along +gy · "both" = intersection
   */
  roadAxis?: "x" | "y" | "both";
  /** Which building group this plot belongs to (a holding spanning several plots) — undefined = single tower */
  blockId?: string;
};

/**
 * How far the ground extends around the city (in cells).
 * Deliberately overflows the frame — if every edge of the ground is visible, the city looks like
 * an island floating in space and feels small · bounds deliberately ignore this (see boundsOf).
 */
const GROUND_PAD = 6;

/** Range where trees/people/cars are placed — beyond it the ground is left bare, to avoid clutter and slowness */
const DECOR_REACH = 3;

/**
 * Range that still counts as "our own city plan" — allocated plots with roads cut, waiting to be built.
 * Deliberately no other people's cities around it, because there's no real data on who owns what
 * (that would be a scoreboard against numbers we made up).
 */
const PLAN_REACH = 4;

/** Minimum spacing between two roads (in cells) */
const ROAD_SPACING = 3;

/**
 * The city's whole ground — plots under towers, roads between districts, and grass/trees around.
 * Computed separately from towers because the ground is always drawn first (not in the towers' depth sort).
 */
export function groundCells(
  layout: CityLayout,
  /**
   * Cells where the wall stands (only built sections, excluding gates).
   *
   * Passed in because **the wall must cut roads**, otherwise cars drive straight through it.
   * Unbuilt sections deliberately don't block — a gap is a real gap, cars can get out, matching the meaning.
   * Gates are left as road too, so cars drive through the gate like a real city.
   */
  blocked: ReadonlySet<string> = new Set(),
): GroundCell[] {
  // Enclose everything on the map — towers and the cash site
  const gxs = layout.all.map((p) => p.gx);
  const gys = layout.all.map((p) => p.gy);
  const minGx = Math.min(...gxs) - GROUND_PAD;
  const maxGx = Math.max(...gxs) + GROUND_PAD;
  const minGy = Math.min(...gys) - GROUND_PAD;
  const maxGy = Math.max(...gys) + GROUND_PAD;

  const occupied = new Set(layout.all.map((p) => `${p.gx},${p.gy}`));
  /**
   * Plots of holdings spanning several plots — marks the block as one piece of land.
   * Once towers all hit the cap, height can't show size anymore, so "area" has to.
   */
  const blockOf = new Map<string, string>();
  for (const p of layout.all) {
    if (p.partCount > 1) blockOf.set(`${p.gx},${p.gy}`, p.structure.id);
  }

  // Extent of the actual towers (not the extended ground) — defines the city-plan zone
  const tMinGx = Math.min(...gxs);
  const tMaxGx = Math.max(...gxs);
  const tMinGy = Math.min(...gys);
  const tMaxGy = Math.max(...gys);

  /**
   * Cut roads in a grid around tower blocks — only rows/columns with no towers at all,
   * so a road never runs over a plot that's already built.
   */
  const usedRows = new Set(layout.all.map((p) => p.gy));
  const usedCols = new Set(layout.all.map((p) => p.gx));

  const pickLines = (from: number, to: number, blocked: Set<number>) => {
    const lines = new Set<number>();
    let last = -Infinity;
    for (let v = from; v <= to; v++) {
      if (blocked.has(v)) continue;
      if (v - last < ROAD_SPACING) continue;
      lines.add(v);
      last = v;
    }
    return lines;
  };

  const roadRows = pickLines(minGy, maxGy, usedRows);
  const roadCols = pickLines(minGx, maxGx, usedCols);

  // A road between districts must always exist, even if it breaks the spacing rule
  for (let i = 1; i < layout.districts.length; i++) {
    roadRows.add(layout.districts[i].startRow - 1);
  }

  /**
   * Outside the wall is "outside the city" — no cars or people allowed there,
   * only trees and bushes, so it reads as forest beyond the realm, not a lively suburb.
   */
  const wb = wallBounds(layout);
  const insideWall = (gx: number, gy: number) =>
    !wb || (gx > wb.x0 && gx < wb.x1 && gy > wb.y0 && gy < wb.y1);

  const cells: GroundCell[] = [];
  for (let gy = minGy; gy <= maxGy; gy++) {
    for (let gx = minGx; gx <= maxGx; gx++) {
      const key = `${gx},${gy}`;
      const inPlan =
        gx >= tMinGx - PLAN_REACH &&
        gx <= tMaxGx + PLAN_REACH &&
        gy >= tMinGy - PLAN_REACH &&
        gy <= tMaxGy + PLAN_REACH;

      const onRow = roadRows.has(gy);
      const onCol = inPlan && roadCols.has(gx);

      let kind: CellKind = "grass";
      let roadAxis: GroundCell["roadAxis"];
      if (blocked.has(key)) kind = "wall";
      else if (occupied.has(key)) kind = "plot";
      else if (onRow || onCol) {
        kind = "road";
        roadAxis = onRow && onCol ? "both" : onRow ? "x" : "y";
      } else if (inPlan) kind = "vacant";

      let decor: GroundCell["decor"] = "none";
      const r = seededRandom(`decor${gx}:${gy}`, gx * 31 + gy);
      const nearCity =
        gx >= tMinGx - DECOR_REACH &&
        gx <= tMaxGx + DECOR_REACH &&
        gy >= tMinGy - DECOR_REACH &&
        gy <= tMaxGy + DECOR_REACH;

      if (kind === "wall") {
        decor = "none";
      } else if (kind === "road") {
        if (r > 0.62) decor = "car";
        else if (r > 0.3) decor = "lamp";
        else if (r > 0.12) decor = "person"; // pedestrian along the road
        // Roads outside the wall keep only street lights — no cars, no people
        if (!insideWall(gx, gy) && decor !== "lamp") decor = "none";
      } else if (kind === "vacant") {
        // Allocated plots are mostly left empty, with the occasional passer-by
        if (r > 0.88) decor = "person";
      } else if (kind === "grass") {
        // Outskirts around the plan — forest/fields
        if (r > 0.72) decor = "tree";
        else if (r > 0.58) decor = "bush";
        else if (r > 0.5 && nearCity && insideWall(gx, gy)) decor = "person";
      }

      cells.push({
        gx,
        gy,
        kind,
        center: tileCenter(gx, gy),
        depth: gx + gy,
        decor,
        roadAxis,
        blockId: blockOf.get(key),
      });
    }
  }

  return cells.sort((a, b) => a.depth - b.depth || a.gx - b.gx);
}

function boundsOf(placed: PlacedStructure[]) {
  if (placed.length === 0) {
    return { minX: -TILE_W, minY: -TILE_H, width: TILE_W * 2, height: TILE_H * 2 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of placed) {
    minX = Math.min(minX, p.center.x - PITCH_W / 2);
    maxX = Math.max(maxX, p.center.x + PITCH_W / 2);
    // Leave room above for tower tops + labels · below for district labels
    minY = Math.min(minY, p.center.y - p.height - TILE_H / 2 - 26);
    maxY = Math.max(maxY, p.center.y + PITCH_H / 2 + 30);
  }

  // Deliberately just breathing room, not the whole GROUND_PAD — let the ground overflow the frame
  // so the city fills as much of the screen as possible and the edge of the land isn't visible
  const padX = PITCH_W * 0.75;
  const padY = PITCH_H + 24;
  return {
    minX: minX - padX,
    minY: minY - padY,
    width: maxX - minX + padX * 2,
    height: maxY - minY + padY * 2,
  };
}

export type FloorPlan = {
  /** Completed floors (whole shares) */
  fullFloors: number;
  /** Height per share */
  floorHeight: number;
  /** Remaining fractional share 0–1 — the unfinished top floor */
  partial: number;
  /** Floors too dense to draw one line each */
  toodense: boolean;
};

/**
 * Divide the height (which comes from money) into floors by share count
 * ⇒ the tower is as tall as the money invested, but you can "count floors" as shares held.
 */
export function floorPlan(units: number, height: number): FloorPlan {
  if (units <= 0) {
    return { fullFloors: 0, floorHeight: height, partial: 0, toodense: false };
  }
  const fullFloors = Math.floor(units);
  return {
    fullFloors,
    floorHeight: height / units,
    partial: units - fullFloors,
    toodense: units > MAX_DRAWN_FLOORS,
  };
}

/**
 * Fraction of windows lit, from gain/loss.
 * Deliberately not red–green (a panic trigger) — bright ↔ dim instead,
 * and the floor is never 0: even a tower deep in the red still has people living in it.
 */
export function litRatio(health: number | null): number {
  if (health === null) return 0.8;
  if (health >= 0) return 0.55 + Math.min(health, 0.6) * 0.75;
  return Math.max(0.12, 0.55 + Math.max(health, -0.6) * 0.72);
}

/** Deterministic randomness — windows must not re-flicker on every re-render */
export function seededRandom(seed: string, index: number): number {
  let h = 2166136261 ^ index;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/**
 * How many cells the wall sits from the outermost object.
 *
 * Encloses "the whole map", not just the cluster of towers — for a semantic reason too:
 * the emergency fund protects everything you have, not only what has already become shares,
 * so the cash site must be inside the wall as well.
 *
 * Set 2 cells inside GROUND_PAD so there's still visible land outside the wall;
 * if equal, the wall would sit on the edge of the picture and read as a picture frame, not a wall.
 */
const WALL_MARGIN = 4;

export type WallSegment = {
  gx: number;
  gy: number;
  center: Point;
  depth: number;
  /** Built yet? — unbuilt = bare footing, visible as a gap */
  built: boolean;
  /**
   * Laid within the last few days — new bricks still glow, with scaffolding.
   *
   * This is the wall's feedback channel, the equivalent of the towers' "crane + DCA tally":
   * adding ฿4,000 to the reserve always moves the months figure only slightly, but "2 new bricks"
   * are fully visible and never diluted as the wall grows.
   */
  fresh: boolean;
  /**
   * Was built, then just fell because money was withdrawn — a different meaning from "not built yet".
   *
   * Must be distinguishable: bare footing = never reached here · cracked ruins = was safe and lost it.
   * Drawn the same, a withdrawal would be completely silent, which is the last thing it should be.
   */
  broken: boolean;
  /** Which side of the ring — used to orient the wall section */
  side: "nw" | "ne" | "se" | "sw";
  /** Ring corner, drawn as a tower */
  corner: boolean;
  /** City gate — the one way in or out, at the very front to anchor the eye */
  gate: boolean;
  /** Has a torch on the wall top — spaced out, not on every section */
  torch: boolean;
};

/**
 * Wall ring around the city.
 *
 * The built fraction is *length*, not *height*, on purpose:
 * a low wall all the way round still means fully enclosed, but a tall wall half-way round means a gap to walk through
 * ⇒ a gap = months not yet covered, something to feel, not just a number.
 *
 * Building starts at the back and works forward ⇒ **the gap is always at the front, always visible**
 * (if the gap were behind the city, towers would hide it and the "not safe yet" feeling would disappear).
 */
/**
 * Camera frame with room for the wall ring — use it instead of layout.bounds when setting the viewBox,
 * otherwise the camera aims only at the towers and half the wall gets cropped.
 */
export type Bounds = { minX: number; minY: number; width: number; height: number };

/**
 * Merge two frames into one that covers both.
 *
 * Used when viewing the past: the camera must aim at **the same frame as today**, not re-aim at the past city.
 *
 * ⚠️ Letting the camera re-aim at whatever city is drawn causes two problems at once:
 * (1) the picture jumps every time you switch dates, which feels off;
 * (2) worse, **growth disappears from the picture**, because the smaller past city gets
 *     zoomed in to fill the screen like today's ⇒ they look the same even though it really grew.
 *
 * Same rule as when the height ruler was pinned: **the camera may move, but never
 * so much that it hides the truth you're meant to see** (city taller than the screen → camera pulls back, towers don't shrink).
 */
export function unionBounds(a: Bounds, b: Bounds): Bounds {
  const minX = Math.min(a.minX, b.minX);
  const minY = Math.min(a.minY, b.minY);
  const maxX = Math.max(a.minX + a.width, b.minX + b.width);
  const maxY = Math.max(a.minY + a.height, b.minY + b.height);
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

export function boundsWithWall(layout: CityLayout, segments: WallSegment[]) {
  const b = layout.bounds;
  if (segments.length === 0) return b;

  let minX = b.minX;
  let maxX = b.minX + b.width;
  let minY = b.minY;
  let maxY = b.minY + b.height;

  for (const w of segments) {
    minX = Math.min(minX, w.center.x - PITCH_W / 2 - 8);
    maxX = Math.max(maxX, w.center.x + PITCH_W / 2 + 8);
    minY = Math.min(minY, w.center.y - PITCH_H / 2 - 52);
    maxY = Math.max(maxY, w.center.y + PITCH_H / 2 + 8);
  }

  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

/**
 * The rectangle the wall sits on — encloses everything on the map, towers and the cash site.
 *
 * Factored out because the ground also needs to know "where is inside the wall",
 * otherwise cars would drive around outside the city where it should be forest.
 */
export function wallBounds(layout: CityLayout) {
  if (layout.all.length === 0) return null;
  const gxs = layout.all.map((p) => p.gx);
  const gys = layout.all.map((p) => p.gy);
  return {
    x0: Math.min(...gxs) - WALL_MARGIN,
    x1: Math.max(...gxs) + WALL_MARGIN,
    y0: Math.min(...gys) - WALL_MARGIN,
    y1: Math.max(...gys) + WALL_MARGIN,
  };
}

/**
 * @param coverage      fraction built today, 0..1
 * @param priorCoverage fraction a few days ago — the difference is "new bricks" or "cracks"
 *                      omitted = nothing just happened (a still wall)
 */
export function wallRing(
  layout: CityLayout,
  coverage: number,
  priorCoverage?: number,
): WallSegment[] {
  const b = wallBounds(layout);
  if (!b) return [];
  const { x0, x1, y0, y1 } = b;

  const ring: Array<{ gx: number; gy: number; side: WallSegment["side"]; corner: boolean }> = [];
  const push = (gx: number, gy: number, side: WallSegment["side"]) =>
    ring.push({
      gx,
      gy,
      side,
      corner: (gx === x0 || gx === x1) && (gy === y0 || gy === y1),
    });

  // Walk clockwise from the backmost corner (x0,y0) — back sides first, front sides later
  for (let gx = x0; gx <= x1; gx++) push(gx, y0, "ne");
  for (let gy = y0 + 1; gy <= y1; gy++) push(x1, gy, "se");
  for (let gx = x1 - 1; gx >= x0; gx--) push(gx, y1, "sw");
  for (let gy = y1 - 1; gy > y0; gy--) push(x0, gy, "nw");

  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const builtCount = Math.round(clamp01(coverage) * ring.length);
  const priorCount =
    priorCoverage === undefined
      ? builtCount
      : Math.round(clamp01(priorCoverage) * ring.length);

  /**
   * ⚠️ Ring order only decides "how far it's built" — never use it as drawing order.
   *
   * The ring goes clockwise: the top side (gx increasing) and right side (gy increasing) happen to
   * increase in depth in order, but the bottom (gx decreasing) and left (gy decreasing) run backwards
   * ⇒ drawn in ring order, those two sides paint farther sections over nearer ones,
   *   and the wall looks like mis-stacked blocks (correct on two sides, wrong on the other two).
   * ⇒ always sort by depth before returning, the same as towers.
   */
  /**
   * The city gate is in the middle of the front side (sw) — a ring sealed on all sides reads as a prison,
   * not a city · the gate gives the ring a focal point and says people live inside.
   */
  const frontIdx = ring
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.side === "sw" && !r.corner)
    .map(({ i }) => i);
  const gateIdx = frontIdx.length > 0 ? frontIdx[Math.floor(frontIdx.length / 2)] : -1;

  return ring
    .map((r, i) => ({
      ...r,
      center: tileCenter(r.gx, r.gy),
      depth: r.gx + r.gy,
      built: i < builtCount,
      // New bricks = sections that didn't exist before · cracked ruins = sections that existed and are now gone
      fresh: i < builtCount && i >= priorCount,
      broken: i >= builtCount && i < priorCount,
      gate: i === gateIdx,
      // A torch every 3 sections — denser looks like running lights, sparser looks abandoned
      torch: !r.corner && i % 3 === 1,
    }))
    .sort((a, b) => a.depth - b.depth || a.gx - b.gx);
}
