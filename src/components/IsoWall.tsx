"use client";

import { PITCH_H, PITCH_W, polygonPoints, type Point, type WallSegment } from "@/lib/iso";

/**
 * ⚠️ ต้องใช้ระยะกริด (PITCH) ไม่ใช่ขนาดฐานตึก (TILE)
 * ฐานตึกแคบกว่าระยะกริดโดยตั้งใจ เพื่อให้ตึกมีช่องว่างคั่นแยกหลังกันออก
 * แต่กำแพงต้อง "ต่อกันเป็นแนว" ถ้าใช้ TILE จะกลายเป็นบล็อกวางเรียงห่างๆ
 * ซึ่งอ่านเป็นก้อนหินกองไว้ ไม่ใช่กำแพงที่ปิดล้อมอะไรได้
 */

const WALL_H = 26;
const TOWER_H = 40;

/**
 * กำแพงเมือง = เงินสำรองฉุกเฉิน (Kingdom v1)
 *
 * จงใจไม่ใช่ตึก: ตึกคือเงินที่กลายเป็นความเป็นเจ้าของแล้วและโตได้เรื่อยๆ
 * กำแพงคือของที่ **ไม่ทำให้เมืองใหญ่ขึ้นเลย แต่ทำให้เมืองไม่พัง** — สองอย่างนี้
 * ต้องอ่านออกว่าคนละชนิดตั้งแต่แรกเห็น ไม่งั้นจะเผลอเอาไปรวมเป็นสกอร์เดียวกัน
 *
 * ส่วนที่ยังไม่ได้ก่อวาดเป็น "ตอม่อ" เตี้ยๆ เส้นประ = ช่องให้เดินเข้าเมืองได้
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
  const h = seg.corner ? TOWER_H : WALL_H;

  const N: Point = { x: c.x, y: c.y - PITCH_H / 2 };
  const E: Point = { x: c.x + PITCH_W / 2, y: c.y };
  const S: Point = { x: c.x, y: c.y + PITCH_H / 2 };
  const W: Point = { x: c.x - PITCH_W / 2, y: c.y };
  const up = (p: Point, dy: number): Point => ({ x: p.x, y: p.y - dy });

  if (!seg.built) {
    /**
     * ช่วงที่ยังไม่ได้ก่อ — ต้องอ่านออกว่า "ตรงนี้คือรู" ไม่ใช่พื้นว่างธรรมดา
     *
     * รูคือเดือนที่ยังไม่มีเงินคุ้ม ซึ่งเป็นสิ่งเดียวในภาพที่ควรทำให้รู้สึกไม่สบายใจ
     * ⇒ วาดเป็นฐานรากเตี้ยที่ก่อค้างไว้ ไม่ใช่เส้นประจางๆ (เวอร์ชันแรกจางจน
     *   นับ DOM ได้ 0 ชิ้น = ครึ่งวงหายไปเลย คนดูเลยไม่เห็นว่ากำแพงยังไม่ปิด)
     */
    const stub = 7;
    return (
      <g>
        <polygon points={polygonPoints([N, E, S, W])} fill="#211c12" />
        <polygon
          points={polygonPoints([N, E, S, W])}
          fill="none"
          stroke="#8a7420"
          strokeWidth={1.4}
          strokeDasharray="7 5"
        />
        <polygon
          points={polygonPoints([W, S, up(S, stub), up(W, stub)])}
          fill="#3d3728"
        />
        <polygon
          points={polygonPoints([S, E, up(E, stub), up(S, stub)])}
          fill="#2c2820"
        />
        <polygon
          points={polygonPoints([up(N, stub), up(E, stub), up(S, stub), up(W, stub)])}
          fill="#4a4331"
        />
      </g>
    );
  }

  return (
    <g>
      {/* เงาที่โคนกำแพง */}
      <ellipse cx={c.x} cy={c.y + 2} rx={PITCH_W / 2} ry={PITCH_H / 2.6} fill="rgba(0,0,0,0.45)" />

      {/* สองหน้าที่มองเห็น */}
      <polygon
        points={polygonPoints([W, S, up(S, h), up(W, h)])}
        fill={seg.corner ? "#4a5468" : "#3f4859"}
      />
      <polygon
        points={polygonPoints([S, E, up(E, h), up(S, h)])}
        fill={seg.corner ? "#333c4d" : "#2c3442"}
      />

      {/* หลังคากำแพง */}
      <polygon
        points={polygonPoints([up(N, h), up(E, h), up(S, h), up(W, h)])}
        fill={seg.corner ? "#5d6a80" : "#525d70"}
      />

      {/* ใบเสมาบนสันกำแพง — ทำให้อ่านเป็นป้อมปราการ ไม่ใช่บล็อกคอนกรีต */}
      {[0.16, 0.38, 0.6, 0.82].map((t) => {
        const bx = W.x + (S.x - W.x) * t;
        const by = W.y + (S.y - W.y) * t - h;
        return (
          <rect key={t} x={bx - 3} y={by - 5} width={6} height={5} fill="#5d6a80" />
        );
      })}

      {/* มุมกำแพง = ป้อม มีไฟจุดหนึ่งดวง บอกว่ามีคนเฝ้าอยู่ */}
      {seg.corner && (
        <>
          <rect x={c.x - 5} y={c.y - h - 12} width={10} height={8} fill="#4a5468" />
          <circle cx={c.x} cy={c.y - h - 14} r={2} fill="#ffd88a" className="anim-beacon" />
        </>
      )}
    </g>
  );
}
