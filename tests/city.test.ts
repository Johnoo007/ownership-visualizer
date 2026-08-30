import { test } from "vitest";
import assert from "node:assert/strict";

import {
  investedTHB,
  isFreeHolding,
  pnlRatio,
  toStructures,
  topConcentration,
  totals,
} from "../src/lib/portfolio";
import { floorPlan, heightFor, heightScale, layoutCity } from "../src/lib/iso";
import { parseHoldingsTable } from "../src/lib/importCsv";
import { compare } from "../src/lib/history";
import type { CityState } from "../src/lib/types";

const ORDER = ["mission", "goldengoose"];

function baseCity(): CityState {
  return {
    fxRate: 33.3,
    isDemo: false,
    holdings: [
      // ลงเงินมาก แต่หุ้นน้อย — เคสที่ทำให้ "ความสูง = จำนวนหุ้น" ผิด
      { id: "a", ticker: "GOOGL", name: "Alphabet", shares: 5, avgCost: 172, currentPrice: 205, currency: "USD", district: "mission" },
      // หุ้นเยอะกว่า 6 เท่า แต่ลงเงินน้อยกว่า
      { id: "b", ticker: "IEMG", name: "EM", shares: 30, avgCost: 10, currentPrice: 12, currency: "USD", district: "mission" },
      // ได้มาฟรี ต้นทุน 0
      { id: "c", ticker: "GLD", name: "Gold", shares: 0.5, avgCost: 0, currentPrice: 234, currency: "USD", district: "mission" },
      // เศษหุ้น + ขาดทุนหนัก
      { id: "d", ticker: "TMDX", name: "TransMedics", shares: 0.4, avgCost: 118, currentPrice: 62, currency: "USD", district: "mission" },
      // สกุลบาท คนละเขต
      { id: "e", ticker: "SCB", name: "SCB X", shares: 100, avgCost: 128, currentPrice: 131, currency: "THB", district: "goldengoose" },
    ],
  };
}

const heightOf = (s: CityState, id: string) =>
  layoutCity(toStructures(s), ORDER).all.find((p) => p.structure.id === id)!.height;

const crash = (s: CityState, factor: number): CityState => ({
  ...s,
  holdings: s.holdings.map((h) => ({ ...h, currentPrice: h.currentPrice * factor })),
});

test("ความสูงมาจากเงินที่ลงไป ไม่ใช่จำนวนหุ้น", () => {
  const s = baseCity();
  assert.ok(
    heightOf(s, "a") > heightOf(s, "b"),
    "GOOGL (5 หุ้น ฿28,638) ต้องสูงกว่า IEMG (30 หุ้น ฿9,990)",
  );
});

test("ตลาดแดง −30% แล้วตึกต้องไม่หดแม้แต่ตึกเดียว", () => {
  const before = layoutCity(toStructures(baseCity()), ORDER);
  const after = layoutCity(toStructures(crash(baseCity(), 0.7)), ORDER);

  for (const p of before.all) {
    const q = after.all.find((x) => x.structure.id === p.structure.id)!;
    assert.equal(q.height, p.height, `${p.structure.label} ความสูงเปลี่ยน`);
  }
  assert.equal(totals(crash(baseCity(), 0.7)).invested, totals(baseCity()).invested);
  assert.ok(totals(crash(baseCity(), 0.7)).marketValue < totals(baseCity()).marketValue);
});

test("DCA เข้าตัวที่ใหญ่ที่สุดตอนตลาดแดง แล้วตึกต้องสูงขึ้น", () => {
  // เคสที่พังตอนใช้ normalize-by-max: ตึกใหญ่สุดติดเพดานถาวร
  const crashed = crash(baseCity(), 0.7);
  const dca: CityState = {
    ...crashed,
    holdings: crashed.holdings.map((h) =>
      h.id === "a" ? { ...h, shares: h.shares + 7200 / (172 * 33.3) } : h,
    ),
  };

  assert.ok(heightOf(dca, "a") > heightOf(crashed, "a"));
  assert.equal(heightOf(dca, "e"), heightOf(crashed, "e"), "ตึกที่ไม่ได้เติมต้องนิ่ง");
});

test("ข้ามขั้นสเกลแล้วสัดส่วนเทียบตึกอื่นยังโตขึ้น (กล้องถอย ไม่ใช่ตึกหด)", () => {
  const crashed = crash(baseCity(), 0.7);
  const big: CityState = {
    ...crashed,
    holdings: crashed.holdings.map((h) =>
      h.id === "a" ? { ...h, shares: h.shares + 3 } : h,
    ),
  };
  assert.ok(
    heightOf(big, "a") / heightOf(big, "e") >
      heightOf(crashed, "a") / heightOf(crashed, "e"),
  );
});

test("สเกลความสูงขยับเป็นขั้น ไม่ผูกกับตึกใหญ่สุดโดยตรง", () => {
  assert.equal(heightScale(0), 10_000);
  assert.ok(heightScale(200_000) > 200_000, "reference ต้องคลุมค่ามากสุดเสมอ");
  assert.equal(heightScale(9_000), 10_000, "ต่ำกว่าฐานยังใช้ฐานเดิม");
});

test("ของที่ได้มาฟรี (ต้นทุน 0) ไม่พัง และไม่มีตึก", () => {
  const s = baseCity();
  const gld = s.holdings.find((h) => h.id === "c")!;

  assert.equal(pnlRatio(gld), null, "ห้ามหารศูนย์แล้วได้ Infinity");
  assert.equal(investedTHB(gld, s.fxRate), 0);
  assert.ok(isFreeHolding(gld));
  assert.equal(heightOf(s, "c"), 0, "ลงเงิน 0 = ที่ดินเปล่า ไม่ใช่ตึก");
  assert.ok(
    heightOf(s, "d") > heightOf(s, "c"),
    "ตึกที่ลงเงินจริงต้องสูงกว่าที่ดินของฟรีเสมอ",
  );
});

test("จำนวนชั้นตรงกับจำนวนหุ้น", () => {
  const full = floorPlan(5, 100);
  assert.equal(full.fullFloors, 5);
  assert.equal(full.partial, 0);
  assert.equal(full.floorHeight * 5, 100);

  const frac = floorPlan(0.4, 50);
  assert.equal(frac.fullFloors, 0);
  assert.ok(Math.abs(frac.partial - 0.4) < 1e-9);

  assert.ok(floorPlan(120, 200).toodense, "หุ้นเยอะเกินต้องเลิกวาดเส้นรายชั้น");
});

test("สกุลเงินผสมและการแยกเขต", () => {
  const s = baseCity();
  const scb = s.holdings.find((h) => h.id === "e")!;

  assert.equal(investedTHB(scb, s.fxRate), 12_800, "บาทห้ามคูณ FX ซ้ำ");

  const gg = totals(s, "goldengoose");
  assert.equal(gg.towerCount, 1);
  assert.equal(gg.invested, 12_800);

  const l = layoutCity(toStructures(s), ORDER);
  assert.ok(
    Math.max(...l.districts[0].placed.map((p) => p.gy)) <
      Math.min(...l.districts[1].placed.map((p) => p.gy)),
    "สองเขตต้องไม่ทับกันในกริด",
  );
});

test("ตัวชี้วัดความกระจุก แทนการบวก share count ข้ามบริษัท", () => {
  const top = topConcentration(baseCity());
  assert.equal(top?.label, "GOOGL");
  assert.ok(top!.share > 0 && top!.share <= 1);
  assert.equal(topConcentration({ holdings: [], fxRate: 33.3, isDemo: false }), null);
});

test("เมืองว่างต้องไม่ crash", () => {
  const empty = layoutCity([], ORDER);
  assert.equal(empty.all.length, 0);
  assert.ok(empty.bounds.width > 0);

  assert.equal(heightFor(0, 0), 0, "ไม่ลงเงิน = ไม่มีตึก");
  assert.ok(heightFor(1000, 0) > 0, "มีเงินแต่ reference พัง → ยังมีความสูงขั้นต่ำ");

  const t = totals({ holdings: [], fxRate: 33.3, isDemo: false });
  assert.equal(t.invested, 0);
  assert.equal(t.pnlRatio, null);
});

test("อ่านตารางที่วางมาจากชีต", () => {
  const rows = parseHoldingsTable(
    "ticker,shares,cost\nVOO, 12, 480\nGOOGL\t5\t172\t205\nSCB;100;128;131;THB;goldengoose\nBAD, abc, 1",
  );
  const ok = rows.filter((r) => r.ok);
  const bad = rows.filter((r) => !r.ok);

  assert.equal(ok.length, 3, "รับทั้ง comma / tab / semicolon และข้ามหัวตาราง");
  assert.equal(bad.length, 1, "แถวเสียต้องถูกรายงาน ไม่ใช่ทำให้ทั้งชุดล้ม");

  const scb = ok.find((r) => r.ok && r.holding.ticker === "SCB");
  assert.ok(scb?.ok && scb.holding.currency === "THB");
  assert.ok(scb?.ok && scb.holding.district === "goldengoose");

  const voo = ok.find((r) => r.ok && r.holding.ticker === "VOO");
  assert.ok(voo?.ok && voo.holding.currentPrice === 480, "ไม่ระบุราคา → ใช้ต้นทุนไปก่อน");
});

test("เทียบเมืองกับอดีต วัดที่เงินที่ลง ไม่ใช่มูลค่าตลาด", () => {
  const past = { at: new Date(Date.now() - 86_400_000 * 30).toISOString(), state: baseCity() };

  // ตลาดพัง 50% แต่ไม่ได้เติมเงิน → การเติบโตต้องเป็น 0
  const marketOnly = compare(past, crash(baseCity(), 0.5));
  assert.equal(marketOnly.investedDelta, 0);
  assert.equal(marketOnly.newTowers.length, 0);

  // ซื้อเพิ่ม + ตึกใหม่
  const grown: CityState = {
    ...baseCity(),
    holdings: [
      ...baseCity().holdings.map((h) =>
        h.id === "a" ? { ...h, shares: h.shares + 1 } : h,
      ),
      { id: "f", ticker: "NVDA", name: "Nvidia", shares: 2, avgCost: 100, currentPrice: 120, currency: "USD", district: "mission" },
    ],
  };
  const g = compare(past, grown);
  assert.ok(g.investedDelta > 0);
  assert.deepEqual(g.newTowers, ["NVDA"]);
  assert.deepEqual(g.grownTowers, ["GOOGL"]);
  assert.equal(g.days, 30);
});
