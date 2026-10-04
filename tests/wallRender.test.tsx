/**
 * เช็คว่ากำแพง "วาดออกมาจริง" ไม่ใช่แค่คำนวณถูก
 *
 * ⚠️ มีเทสต์ชุดนี้เพราะเคยพลาดมาแล้ว: แก้ไฟล์ไม่ match แล้วเงียบ ตอม่อกำแพง
 * ไม่ถูกแก้ กว่าจะจับได้คือตอนไปนับ DOM จริงแล้วได้ 0 ชิ้น
 * ⇒ ของที่ "ต้องเห็นบนจอ" ต้องมีเทสต์ที่นับมันจากผลลัพธ์ที่ render ออกมาจริง
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import { IsoWall } from "../src/components/IsoWall";
import { layoutCity, wallRing } from "../src/lib/iso";
import { toStructures } from "../src/lib/portfolio";
import { applyReserveEvent, reserveStatus } from "../src/lib/reserve";
import { CASH_ZONE, type CityState } from "../src/lib/types";

const ORDER = ["mission", "goldengoose"];
const NOW = new Date("2026-09-01T09:00:00Z");

function city(): CityState {
  return {
    fxRate: 33.3,
    isDemo: false,
    holdings: [
      { id: "a", ticker: "GOOGL", name: "Alphabet", shares: 5, avgCost: 172, currentPrice: 205, currency: "USD", district: "mission" },
      { id: "b", ticker: "SPYM", name: "S&P", shares: 40, avgCost: 60, currentPrice: 66, currency: "USD", district: "goldengoose" },
    ],
  };
}

function draw(amountTHB: number, deltaTHB: number) {
  const layout = layoutCity(toStructures(city()), ORDER, [CASH_ZONE]);
  const reserve = applyReserveEvent(
    { amountTHB, monthlyBurnTHB: 20_000 },
    deltaTHB,
    NOW,
  );
  const s = reserveStatus(reserve, NOW);
  const ring = wallRing(layout, s.coverage, s.priorCoverage);
  return { ring, svg: renderToStaticMarkup(<IsoWall segments={ring} />) };
}

/** นับ element ชนิดหนึ่งใน markup */
const count = (svg: string, tag: string) =>
  (svg.match(new RegExp(`<${tag}\\b`, "g")) ?? []).length;

test("อิฐที่เพิ่งก่อต้องมีนั่งร้านโผล่บนจอจริง ไม่ใช่แค่ค่าใน state", () => {
  const still = draw(60_000, 0);
  const fresh = draw(60_000, 30_000);

  assert.equal(still.ring.filter((w) => w.fresh).length, 0);
  const freshCount = fresh.ring.filter((w) => w.fresh).length;
  assert.ok(freshCount > 0, "ต้องมีช่วงที่เพิ่งก่อ");

  // นั่งร้าน = เส้น 3 เส้นต่อช่วง (เสา 2 + คาน 1) ที่ไม่มีในภาพนิ่ง
  const added = count(fresh.svg, "line") - count(still.svg, "line");
  assert.ok(
    added >= freshCount * 3,
    `นั่งร้านหายไปจากภาพ: เส้นเพิ่มแค่ ${added} เส้น สำหรับอิฐใหม่ ${freshCount} ช่วง`,
  );
  assert.ok(fresh.svg.includes("#c9a227"), "นั่งร้านต้องใช้สีทองชุดเดียวกับเครนของตึก");
});

test("รอยร้าวต้องวาดออกมาเป็นซาก ไม่ใช่ตอม่อเปล่าหน้าตาเหมือนช่วงที่ยังไม่ก่อ", () => {
  const cracked = draw(120_000, -40_000);
  const brokenCount = cracked.ring.filter((w) => w.broken).length;
  assert.ok(brokenCount > 0, "ต้องมีซาก");

  // polyline = รอยแตก · มีเฉพาะซาก ไม่มีที่อื่นในกำแพงเลย
  assert.equal(
    count(cracked.svg, "polyline"),
    brokenCount,
    "จำนวนรอยแตกบนจอต้องเท่ากับจำนวนช่วงที่พัง",
  );
  assert.ok(cracked.svg.includes("#ff8f7d"), "รอยแตกต้องใช้สีเดียวกับตัวเลขขาดทุน");

  // และต้องไม่มีเส้นประแบบ "แบบก่อสร้างรอคิว" ปนอยู่ในซาก
  const stillNothing = draw(0, 0);
  assert.ok(
    stillNothing.svg.includes("stroke-dasharray"),
    "ช่วงที่ยังไม่เคยก่อต้องเป็นเส้นประ (ของเดิม)",
  );
});

test("กำแพงนิ่ง (ไม่มีเหตุการณ์) ต้องไม่มีทั้งนั่งร้านและรอยแตก", () => {
  const { svg } = draw(120_000, 0);
  assert.equal(count(svg, "polyline"), 0, "ไม่มีอะไรเกิดขึ้น ห้ามมีรอยแตก");
  assert.ok(!svg.includes("#c9a227"), "ไม่มีอะไรเกิดขึ้น ห้ามมีนั่งร้าน");
  assert.ok(svg.includes("<polygon"), "แต่ตัวกำแพงต้องยังอยู่");
});
