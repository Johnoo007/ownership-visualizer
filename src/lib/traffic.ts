import { PITCH_H, PITCH_W, seededRandom, type GroundCell } from "./iso";

/**
 * Direction of each road axis in isometric coordinates.
 * dir = the way cars drive · perp = perpendicular (used to push pedestrians to the kerb)
 */
export const AXIS = {
  x: { dir: [0.894, 0.447], perp: [-0.894, 0.447] },
  y: { dir: [-0.894, 0.447], perp: [0.894, 0.447] },
} as const;

export type RoadAxis = "x" | "y";

/**
 * Actual pixel distance from one cell centre to the next along a road.
 *
 * ⚠️ Not PITCH_W — one cell step moves (PITCH_W/2, PITCH_H/2) = (56, 28),
 * so the real length is the hypotenuse ≈ 62.6px, not 112px.
 * Using PITCH_W directly makes cars travel 1.79× too far and leave the road.
 */
export const CELL_STEP = Math.hypot(PITCH_W / 2, PITCH_H / 2);

/** Intersections have no clear axis — pick one deterministically per cell so it doesn't flicker on re-render */
export function axisOf(cell: GroundCell): RoadAxis {
  if (cell.roadAxis === "both") {
    return seededRandom(`ax${cell.gx}:${cell.gy}`, 23) > 0.5 ? "x" : "y";
  }
  return cell.roadAxis === "y" ? "y" : "x";
}

/** Positions in the lane that are actually road — not just the two ends */
export type Lane = { cells: Set<number> };

export function laneKey(cell: GroundCell): string {
  return axisOf(cell) === "x" ? `x:${cell.gy}` : `y:${cell.gx}`;
}

/**
 * Group road cells into lanes, keeping the full set of positions that are actually road.
 *
 * ⚠️ Never store only min/max — lanes really can have gaps, because district-divider roads
 * are forced through rows even where a tower stands (iso.ts), so a tower cell splits the lane.
 * With only the ends, cars would drive straight through towers and appear on the other side.
 *
 * Intersections belong to *both* lanes, not whichever one axisOf happened to pick —
 * otherwise every lane has a hole at each intersection and every car stops short of it.
 */
export function computeLanes(cells: GroundCell[]): Map<string, Lane> {
  const lanes = new Map<string, Lane>();
  const add = (key: string, pos: number) => {
    const lane = lanes.get(key);
    if (lane) lane.cells.add(pos);
    else lanes.set(key, { cells: new Set([pos]) });
  };

  for (const c of cells) {
    if (c.kind !== "road") continue;
    if (c.roadAxis === "x" || c.roadAxis === "both") add(`x:${c.gy}`, c.gx);
    if (c.roadAxis === "y" || c.roadAxis === "both") add(`y:${c.gx}`, c.gy);
  }
  return lanes;
}

export type CarRoute = {
  axis: RoadAxis;
  /** +1 = towards larger coordinates · −1 = towards smaller */
  dir: 1 | -1;
  /** How many cells it can drive before the last connected road cell */
  cellsAhead: number;
  canDrive: boolean;
};

/**
 * One car's path — walk cell by cell until a non-road cell, then stop,
 * so it can never cross a tower/grass/vacant-plot cell.
 */
export function carRoute(cell: GroundCell, lane: Lane | undefined): CarRoute {
  const axis = axisOf(cell);
  const pos = axis === "x" ? cell.gx : cell.gy;

  const runLength = (step: 1 | -1): number => {
    if (!lane) return 0;
    let n = 0;
    while (lane.cells.has(pos + step * (n + 1))) n++;
    return n;
  };

  const ahead = runLength(1);
  const behind = runLength(-1);

  // Pick a random direction; if that side is a dead end, turn around — keeps two-way traffic
  let dir: 1 | -1 = seededRandom(`dir${cell.gx}:${cell.gy}`, 7) > 0.5 ? 1 : -1;
  if ((dir > 0 ? ahead : behind) < 1) dir = (-dir) as 1 | -1;

  const cellsAhead = dir > 0 ? ahead : behind;
  // Dead end both ways (one-cell road)? Park in place — better than driving through things
  return { axis, dir, cellsAhead, canDrive: cellsAhead >= 1 };
}
