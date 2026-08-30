"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  groundCells,
  layoutCity,
  PITCH_H,
  PITCH_W,
  seededRandom,
  TILE_H,
} from "@/lib/iso";
import { CASH_ZONE, DISTRICTS, type Structure } from "@/lib/types";
import { IsoGround } from "./IsoGround";
import { IsoSite } from "./IsoSite";
import { IsoTower, TowerLabel } from "./IsoTower";
import { useAnimation } from "./useAnimation";

const DISTRICT_ORDER = ["mission", "goldengoose", CASH_ZONE];
// เงินสดยื่นออกไปอีกทิศ (แกน gx) ไม่ต่อแถวลงมาเหมือนเขตหุ้น
const ASIDE_DISTRICTS = [CASH_ZONE];

export function IsoCity({
  structures,
  selectedId,
  onSelect,
}: {
  structures: Structure[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const layout = useMemo(
    () => layoutCity(structures, DISTRICT_ORDER, ASIDE_DISTRICTS),
    [structures],
  );
  const cells = useMemo(() => groundCells(layout), [layout]);

  const { bounds } = layout;
  const stars = useMemo(() => {
    if (structures.length === 0) return [];
    // กระจายเกินกรอบ เพราะ letterbox ทำให้เห็นพื้นที่นอก viewBox
    return Array.from({ length: 140 }, (_, i) => ({
      x: bounds.minX - bounds.width * 0.5 + seededRandom("sx", i) * bounds.width * 2,
      y: bounds.minY - bounds.height * 0.5 + seededRandom("sy", i) * bounds.height * 1.4,
      r: 0.5 + seededRandom("sr", i) * 1.1,
      o: 0.25 + seededRandom("so", i) * 0.75,
    }));
  }, [bounds, structures.length]);

  /**
   * ตำแหน่งป้ายที่หลบกันแล้ว — วางป้ายของตึกสูงก่อน ตัวที่ชนถูกดันขึ้นทีละขั้น
   * (ไม่งั้นป้ายตึกเตี้ยจะไปนั่งทับกลางตึกที่อยู่ข้างหลัง อ่านไม่ออก)
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
   * เงาตึกไกลๆ ที่เส้นขอบฟ้า — ไม่ใช่ข้อมูล เป็นฉากหลังล้วน
   * จงใจทำให้จางและไร้รายละเอียด (ไม่มีหน้าต่าง/ป้าย) จะได้ไม่มีใครอ่านว่าเป็นหุ้น
   */
  const skyline = useMemo(() => {
    if (cells.length === 0) return { baseY: 0, items: [] };
    // วางที่ระดับที่มองเห็นในเฟรมเสมอ ไม่ผูกกับขอบพื้นจริง (ซึ่งอยู่ไกลนอกจอ)
    // โคนตึกจะถูกพื้นเมืองทับ = เหมือนเมืองไกลโผล่พ้นขอบฟ้า
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
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [pan],
  );

  const onPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    setPan({ x: d.px + (e.clientX - d.x), y: d.py + (e.clientY - d.y) });
  }, []);

  const endDrag = useCallback(() => {
    drag.current = null;
  }, []);

  if (structures.length === 0) {
    return (
      <div className="flex h-full min-h-[380px] flex-col items-center justify-center gap-3 text-center">
        <p className="text-lg font-medium text-[var(--label)]">ยังไม่มีตึกในเมือง</p>
        <p className="max-w-xs text-sm text-[var(--label-dim)]">
          เพิ่มหุ้นตัวแรกทางขวา แล้วตึกหลังแรกจะขึ้นทันที
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

        {/* ท้องฟ้ากลางคืน + ดาว — อยู่นอก transform จึงไม่เลื่อนตามตอน pan
            วาดเกินกรอบไปมาก เพราะ SVG letterbox ทำให้เห็นพื้นที่นอก viewBox ได้ */}
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
          {/* ฉากหลัง: เมืองที่ไกลออกไปจนไม่เห็นรายละเอียด */}
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
            {/* หมอกกลบโคนตึกไกล ให้กลืนเข้ากับพื้น */}
            <rect
              x={bounds.minX - bounds.width}
              y={skyline.baseY - 46}
              width={bounds.width * 3}
              height={64}
              fill="url(#haze)"
            />
          </g>

          <IsoGround cells={cells} />

          {/* เลเยอร์สิ่งปลูกสร้าง — ไกลไปใกล้ ตัวหน้าทับตัวหลังได้ถูกต้อง */}
          {layout.all.map((placed) => {
            const props = {
              placed,
              selected: placed.structure.id === selectedId,
              hovered: placed.structure.id === hoveredId,
              onSelect,
              onHover: setHoveredId,
            };
            return placed.structure.kind === "site" ? (
              <IsoSite key={placed.structure.id} {...props} />
            ) : (
              <IsoTower key={placed.structure.id} {...props} />
            );
          })}

          {/* เลเยอร์ป้าย — บนสุดเสมอ ไม่โดนตึกบัง */}
          {layout.districts.map((d) => {
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

            // มีป้ายบนตัวเองอยู่แล้ว (ผนัง/ดาดฟ้า/บนกองทอง) ไม่ต้องมีป้ายลอยซ้ำ
            // เหลือไว้เฉพาะตอนเลือก/ชี้ ที่ต้องเห็นรายละเอียด
            const hasOwnSign =
              placed.height > 0 || placed.structure.marketValue > 0;
            if (hasOwnSign && !selected && !hovered) return null;

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

      <div className="absolute right-3 bottom-3 flex gap-1.5">
        <button
          type="button"
          onClick={toggleAnimate}
          title={animate ? "หยุดความเคลื่อนไหว" : "ให้เมืองเคลื่อนไหว"}
          className={`h-8 rounded-md border px-2 text-[11px] transition ${
            animate
              ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
              : "border-[var(--border-bright)] bg-[var(--panel)]/90 text-[var(--label-dim)]"
          }`}
        >
          {animate ? "▶ เคลื่อนไหว" : "⏸ หยุดนิ่ง"}
        </button>
        <ZoomButton label="−" onClick={() => setScale((s) => Math.max(0.4, s - 0.2))} />
        <ZoomButton label="+" onClick={() => setScale((s) => Math.min(3, s + 0.2))} />
        <ZoomButton
          label="⟳"
          onClick={() => {
            setScale(1);
            setPan({ x: 0, y: 0 });
          }}
        />
      </div>
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
