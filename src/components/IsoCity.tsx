"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  groundCells,
  boundsWithWall,
  layoutCity,
  wallRing,
  unionBounds,
  PITCH_H,
  PITCH_W,
  seededRandom,
  TILE_H,
} from "@/lib/iso";
import { CASH_ZONE, DISTRICTS, type Structure } from "@/lib/types";
import { IsoGround } from "./IsoGround";
import { IsoSite } from "./IsoSite";
import { IsoWall } from "./IsoWall";
import { IsoTower, TowerLabel } from "./IsoTower";
import { useAnimation } from "./useAnimation";

const DISTRICT_ORDER = ["mission", "goldengoose", CASH_ZONE];
// Cash extends off in the other direction (gx axis) rather than stacking below like stock districts
const ASIDE_DISTRICTS = [CASH_ZONE];

export function IsoCity({
  structures,
  wallCoverage,
  wallPriorCoverage,
  cameraStructures,
  cameraWallCoverage = 0,
  selectedId,
  onSelect,
  controls = true,
  districtLabels = true,
  initialScale = 1,
}: {
  structures: Structure[];
  /** Fraction of the wall built, 0..1 — the emergency fund */
  wallCoverage: number;
  /** Fraction a few days ago — the difference is glowing new bricks, or cracks from a withdrawal */
  wallPriorCoverage: number;
  /**
   * The city used to *aim the camera* instead of the one being drawn — only passed when viewing the past.
   *
   * Omitted = frame the drawn city as usual · passed = the frame stays pinned to today's city,
   * so a past city sits inside the same frame, reading as "a smaller city in the same place", not a jump.
   */
  cameraStructures?: Structure[];
  cameraWallCoverage?: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Motion/zoom buttons, bottom right — the showcase hides them for a cleaner picture */
  controls?: boolean;
  /** District names on the ground — meaningless to people who don't know the app, so the showcase hides them */
  districtLabels?: boolean;
  /** Initial zoom — the showcase pulls the camera back so the city clears the text floating over the top/bottom */
  initialScale?: number;
}) {
  const layout = useMemo(
    () => layoutCity(structures, DISTRICT_ORDER, ASIDE_DISTRICTS),
    [structures],
  );
  const wall = useMemo(
    () => wallRing(layout, wallCoverage, wallPriorCoverage),
    [layout, wallCoverage, wallPriorCoverage],
  );
  /**
   * Cells the wall actually blocks — built and not a gate.
   * Roads passing under the wall must be cut, or cars would drive straight through it out of the city.
   */
  const blocked = useMemo(
    () => new Set(wall.filter((w) => w.built && !w.gate).map((w) => `${w.gx},${w.gy}`)),
    [wall],
  );
  const cells = useMemo(() => groundCells(layout, blocked), [layout, blocked]);

  /**
   * Camera frame — must include the wall, not just the towers,
   * and when viewing the past it must also include today's city, so the camera stays still while switching dates.
   */
  const cameraLayout = useMemo(
    () =>
      cameraStructures
        ? layoutCity(cameraStructures, DISTRICT_ORDER, ASIDE_DISTRICTS)
        : null,
    [cameraStructures],
  );
  const bounds = useMemo(() => {
    const own = boundsWithWall(layout, wall);
    if (!cameraLayout) return own;
    const frame = boundsWithWall(
      cameraLayout,
      wallRing(cameraLayout, cameraWallCoverage),
    );
    return unionBounds(own, frame);
  }, [layout, wall, cameraLayout, cameraWallCoverage]);
  const stars = useMemo(() => {
    if (structures.length === 0) return [];
    // Spread beyond the frame, because letterboxing shows area outside the viewBox
    return Array.from({ length: 140 }, (_, i) => ({
      x: bounds.minX - bounds.width * 0.5 + seededRandom("sx", i) * bounds.width * 2,
      y: bounds.minY - bounds.height * 0.5 + seededRandom("sy", i) * bounds.height * 1.4,
      r: 0.5 + seededRandom("sr", i) * 1.1,
      o: 0.25 + seededRandom("so", i) * 0.75,
    }));
  }, [bounds, structures.length]);

  /**
   * Label positions after collision avoidance — tallest towers are placed first, colliding ones pushed up step by step
   * (otherwise short towers' labels land in the middle of the towers behind them, unreadable).
   */
  const labelYs = useMemo(() => {
    const result = new Map<string, number>();
    const boxes: { x1: number; x2: number; y1: number; y2: number }[] = [];

    const byTop = [...layout.all].sort(
      (a, b) => a.center.y - a.height - (b.center.y - b.height),
    );

    for (const p of byTop) {
      const w = Math.max(30, p.structure.label.length * 7.5 + 10);
      const x1 = p.center.x - w / 2;
      const x2 = p.center.x + w / 2;
      let y = p.center.y - p.height - TILE_H / 2 - 10;

      let guard = 0;
      while (
        guard++ < 40 &&
        boxes.some(
          (b) => !(x2 < b.x1 - 3 || x1 > b.x2 + 3 || y + 4 < b.y1 || y - 9 > b.y2),
        )
      ) {
        y -= 15;
      }

      boxes.push({ x1, x2, y1: y - 9, y2: y + 4 });
      result.set(p.structure.id, y);
    }

    return result;
  }, [layout]);

  /**
   * Distant towers on the skyline — not data, pure backdrop.
   * Deliberately faint and detail-free (no windows/signs) so nobody reads them as holdings.
   */
  const skyline = useMemo(() => {
    if (cells.length === 0) return { baseY: 0, items: [] };
    // Placed at a height that's always in frame, not tied to the real ground edge (far off-screen);
    // their bases get covered by the city ground = a distant city rising over the horizon
    const baseY = bounds.minY + bounds.height * 0.2;
    const spread = bounds.width * 2;
    const startX = bounds.minX - bounds.width * 0.5;

    const items = Array.from({ length: 54 }, (_, i) => {
      const w = 22 + seededRandom("skw", i) * 34;
      return {
        x: startX + (i / 54) * spread + seededRandom("skj", i) * 14,
        w,
        h: 34 + seededRandom("skh", i) * 150,
      };
    });

    return { baseY, items };
  }, [cells, bounds]);

  const { enabled: animate, toggle: toggleAnimate } = useAnimation();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [scale, setScale] = useState(initialScale);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{
    x: number;
    y: number;
    px: number;
    py: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);

  /**
   * ⚠️ Never setPointerCapture on pointerdown — once the svg captures the pointer,
   * Chrome sends the click to the svg instead of the tower that was pressed ⇒ it hits the
   * "click on empty space = deselect" path and towers never open · capture only once it's a real drag (> 4px).
   */
  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      // In case the previous drag had no click after it, so it doesn't swallow the next real click
      suppressClick.current = false;
      drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, moved: false };
    },
    [pan],
  );

  const onPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 4) return;
      d.moved = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    setPan({ x: d.px + dx, y: d.py + dy });
  }, []);

  const endDrag = useCallback(() => {
    // Releasing the mouse over a tower at the end of a drag must not count as selecting it
    if (drag.current?.moved) suppressClick.current = true;
    drag.current = null;
  }, []);

  if (structures.length === 0) {
    return (
      <div className="flex h-full min-h-[380px] flex-col items-center justify-center gap-3 text-center">
        <p className="text-lg font-medium text-[var(--label)]">No towers in the city yet</p>
        <p className="max-w-xs text-sm text-[var(--label-dim)]">
          Add your first holding on the right and the first tower goes up immediately
        </p>
      </div>
    );
  }

  const cx = bounds.minX + bounds.width / 2;
  const cy = bounds.minY + bounds.height / 2;

  return (
    <div className="relative h-full w-full">
      <svg
        viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
        className={`h-full w-full touch-none select-none ${animate ? "city-animate" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            suppressClick.current = false;
            e.stopPropagation();
          }
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onSelect(null);
        }}
      >
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--sky-top)" />
            <stop offset="100%" stopColor="var(--sky-bottom)" />
          </linearGradient>
          <linearGradient id="haze" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--sky-bottom)" stopOpacity="0" />
            <stop offset="70%" stopColor="var(--sky-bottom)" stopOpacity="0.85" />
            <stop offset="100%" stopColor="var(--sky-bottom)" stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* Night sky + stars — outside the transform, so they don't move when panning.
            Drawn far beyond the frame, because SVG letterboxing can show area outside the viewBox */}
        <rect
          x={bounds.minX - bounds.width}
          y={bounds.minY - bounds.height}
          width={bounds.width * 3}
          height={bounds.height * 3}
          fill="url(#sky)"
        />
        <g>
          {stars.map((s, i) => (
            <circle
              key={i}
              className="anim-star"
              cx={s.x}
              cy={s.y}
              r={s.r}
              fill="var(--star)"
              opacity={s.o}
              style={
                {
                  "--star-o": s.o,
                  "--dur": `${(3 + seededRandom("sd", i) * 5).toFixed(1)}s`,
                  "--delay": `${(seededRandom("sdl", i) * 6).toFixed(1)}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </g>

        <g
          transform={`translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy}) translate(${pan.x / scale} ${pan.y / scale})`}
        >
          {/* Backdrop: a city so far away it has no detail */}
          <g className="pixel-art">
            {skyline.items.map((b, i) => (
              <g key={i}>
                <rect
                  x={b.x}
                  y={skyline.baseY - b.h}
                  width={b.w}
                  height={b.h}
                  fill="#101d33"
                />
                <rect
                  x={b.x}
                  y={skyline.baseY - b.h}
                  width={b.w}
                  height={2}
                  fill="#1a2b47"
                />
              </g>
            ))}
            {/* Haze over the bases of the distant towers, blending them into the ground */}
            <rect
              x={bounds.minX - bounds.width}
              y={skyline.baseY - 46}
              width={bounds.width * 3}
              height={64}
              fill="url(#haze)"
            />
          </g>

          <IsoGround cells={cells} />

          {/*
            Building layer — back to front, so nearer things correctly cover farther ones.
            The wall joins the same depth queue as the towers instead of being drawn entirely before/after,
            because the ring surrounds the city: each side has parts both deeper and shallower than towers.
          */}
          {wall
            .filter((w) => w.depth < layout.all[0].depth)
            .map((w) => (
              <IsoWall key={`wb-${w.gx},${w.gy}`} segments={[w]} />
            ))}

          {layout.all.map((placed) => {
            const props = {
              placed,
              selected: placed.structure.id === selectedId,
              hovered: placed.structure.id === hoveredId,
              onSelect,
              onHover: setHoveredId,
            };
            const key = `${placed.structure.id}#${placed.partIndex}`;
            return placed.structure.kind === "site" ? (
              <IsoSite key={key} {...props} />
            ) : (
              <IsoTower key={key} {...props} />
            );
          })}

          {wall
            .filter((w) => w.depth >= layout.all[0].depth)
            .map((w) => (
              <IsoWall key={`wf-${w.gx},${w.gy}`} segments={[w]} />
            ))}

          {/* Label layer — always on top, never hidden behind a tower */}
          {districtLabels && layout.districts.map((d) => {
            const meta = DISTRICTS[d.id as keyof typeof DISTRICTS];
            const labelX = Math.min(...d.placed.map((p) => p.center.x)) - PITCH_W / 2;
            const labelY =
              Math.max(...d.placed.map((p) => p.center.y)) + PITCH_H / 2 + 18;

            return (
              <g key={d.id}>
                <rect
                  x={labelX - 6}
                  y={labelY - 11}
                  width={(meta?.label ?? d.id).length * 6.4 + 14}
                  height={16}
                  rx={2}
                  fill="#0a1626"
                  stroke="var(--border-bright)"
                  strokeWidth={1}
                  opacity={0.9}
                />
                <text
                  x={labelX + 1}
                  y={labelY}
                  className="text-[9.5px] font-semibold tracking-[0.16em] uppercase"
                  style={{ fill: "var(--label-dim)" }}
                >
                  {meta?.label ?? d.id}
                </text>
              </g>
            );
          })}

          {layout.all.map((placed) => {
            const selected = placed.structure.id === selectedId;
            const hovered = placed.structure.id === hoveredId;

            // Already has its own sign (wall/rooftop/on the gold pile), so no floating label too —
            // only when selected/hovered, where the details are needed
            const hasOwnSign =
              placed.height > 0 || placed.structure.marketValue > 0;
            if (hasOwnSign && !selected && !hovered) return null;
            // Holdings spanning several plots get one floating label, not one per tower
            if (placed.partIndex > 0) return null;

            return (
              <TowerLabel
                key={`label-${placed.structure.id}`}
                placed={placed}
                labelY={labelYs.get(placed.structure.id) ?? 0}
                selected={selected}
                hovered={hovered}
                onSelect={onSelect}
                onHover={setHoveredId}
              />
            );
          })}
        </g>
      </svg>

      {controls && (
      <div className="absolute right-3 bottom-3 flex gap-1.5">
        <button
          type="button"
          onClick={toggleAnimate}
          title={animate ? "Stop the motion" : "Let the city move"}
          className={`h-8 rounded-md border px-2 text-[11px] transition ${
            animate
              ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
              : "border-[var(--border-bright)] bg-[var(--panel)]/90 text-[var(--label-dim)]"
          }`}
        >
          {animate ? "▶ Motion on" : "⏸ Still"}
        </button>
        <ZoomButton label="−" onClick={() => setScale((s) => Math.max(0.4, s - 0.2))} />
        <ZoomButton label="+" onClick={() => setScale((s) => Math.min(3, s + 0.2))} />
        <ZoomButton
          label="⟳"
          onClick={() => {
            setScale(initialScale);
            setPan({ x: 0, y: 0 });
          }}
        />
      </div>
      )}
    </div>
  );
}

function ZoomButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-8 w-8 rounded-md border border-[var(--border-bright)] bg-[var(--panel)]/90 text-sm text-[var(--label)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
    >
      {label}
    </button>
  );
}
