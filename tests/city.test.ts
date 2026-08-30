import { test } from "vitest";
import assert from "node:assert/strict";

import {
  investedTHB,
  isFreeHolding,
  pnlRatio,
  cashTHB,
  portfolioSummary,
  toStructures,
  topConcentration,
  totals,
} from "../src/lib/portfolio";
import { floorPlan, groundCells, heightFor, heightScale, layoutCity } from "../src/lib/iso";
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

test("เงินสดเป็นไซต์ก่อสร้าง ไม่ใช่ความสูงของเมือง", () => {
  const withCash: CityState = { ...baseCity(), cash: { usd: 300, thb: 20_000 } };

  // เงินสดยังไม่ใช่ความเป็นเจ้าของ ห้ามไปเพิ่ม "เงินที่ลงไปแล้ว"
  assert.equal(totals(withCash).invested, totals(baseCity()).invested);
  assert.equal(totals(withCash).towerCount, totals(baseCity()).towerCount);

  const sites = toStructures(withCash).filter((s) => s.kind === "site");
  assert.equal(sites.length, 2, "แยกกอง USD กับบาท");
  assert.equal(cashTHB(withCash), 300 * 33.3 + 20_000);

  // ไซต์ต้องอยู่คนละโซนกับตึก ไม่ปนกับของที่เป็นเจ้าของแล้ว
  assert.ok(sites.every((s) => s.district === "cash"));

  // ขนาดไซต์ต้องสะท้อนเงินจริง: กองบาท 20,000 ต้องใหญ่กว่ากอง USD 9,990
  const l = layoutCity(toStructures(withCash), [...ORDER, "cash"]);
  const usd = l.all.find((p) => p.structure.id === "cash-usd")!;
  const thb = l.all.find((p) => p.structure.id === "cash-thb")!;
  assert.ok(thb.height > usd.height, "ไซต์ที่เงินเยอะกว่าต้องใหญ่กว่า");

  // ไม่มีเงินสด = ไม่มีไซต์
  assert.equal(toStructures(baseCity()).filter((s) => s.kind === "site").length, 0);
  // ใส่ 0 ก็ต้องไม่โผล่ไซต์เปล่า
  const zero: CityState = { ...baseCity(), cash: { usd: 0, thb: 0 } };
  assert.equal(toStructures(zero).filter((s) => s.kind === "site").length, 0);
});

test("ของประดับทุกชนิดที่เขียนไว้ต้องโผล่จริง ไม่กลายเป็นโค้ดตาย", () => {
  // เคยพลาดมาแล้ว: ตอนเปลี่ยนรอบเมืองเป็นแปลงจัดสรร คนเดินที่ผูกกับ "ทุ่งหญ้า
  // ใกล้เมือง" เลยไม่มีพื้นที่เหลือให้ยืน กลายเป็นโค้ดตายโดยไม่มีใครสังเกต
  const withCash: CityState = { ...baseCity(), cash: { usd: 300, thb: 20_000 } };
  const cells = groundCells(
    layoutCity(toStructures(withCash), [...ORDER, "cash"], ["cash"]),
  );

  for (const kind of ["plot", "road", "vacant", "grass"] as const) {
    assert.ok(
      cells.some((c) => c.kind === kind),
      `ไม่มีช่องชนิด ${kind} เลย`,
    );
  }

  for (const decor of ["tree", "bush", "car", "lamp", "person"] as const) {
    assert.ok(
      cells.some((c) => c.decor === decor),
      `${decor} ไม่โผล่เลยสักช่อง — น่าจะเป็นโค้ดตาย`,
    );
  }

  // ผังถนนมีสองแนวตัดกัน ทุกช่องถนนต้องรู้ว่าตัวเองเป็นแนวไหน
  // ไม่งั้นรถกับเส้นแบ่งเลนจะวางขวางถนนอีกแนวทั้งหมด
  const roads = cells.filter((c) => c.kind === "road");
  assert.ok(roads.every((c) => c.roadAxis), "ช่องถนนต้องระบุแนวเสมอ");
  for (const axis of ["x", "y"] as const) {
    assert.ok(
      roads.some((c) => c.roadAxis === axis || c.roadAxis === "both"),
      `ไม่มีถนนแนว ${axis} เลย`,
    );
  }
});

test("ยอดรวมพอร์ตนับเงินสดแบบชีต แต่ความสูงเมืองไม่นับ", () => {
  const base = baseCity();
  const withCash: CityState = {
    ...base,
    cash: { usd: 300, thb: 20_000 },
    deposits: 400_000,
  };

  const s = portfolioSummary(withCash);
  const cash = 300 * 33.3 + 20_000;

  // มูลค่าพอร์ต = หุ้น + เงินสด (แบบเดียวกับที่ชีตรายงาน)
  assert.equal(s.marketTotal, totals(base).marketValue + cash);

  // ผลตอบแทนคิดเทียบ "เงินเติมสะสม" ไม่ใช่ต้นทุนหุ้น
  assert.ok(s.usingDeposits);
  assert.equal(s.returnBase, 400_000);
  assert.ok(Math.abs(s.totalReturn! - (s.marketTotal / 400_000 - 1)) < 1e-12);

  // แต่ความสูงเมืองยังเป็นต้นทุนหุ้นล้วน ไม่ขยับตามเงินสดหรือเงินเติมสะสม
  assert.equal(s.invested, totals(base).invested);

  // ไม่กรอกเงินเติมสะสม → ถอยไปเทียบต้นทุนหุ้นแทน ไม่พัง
  const noDeposits = portfolioSummary({ ...base, cash: { usd: 300, thb: 20_000 } });
  assert.equal(noDeposits.usingDeposits, false);
  assert.equal(noDeposits.returnBase, totals(base).invested);
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

test("แยกสกุลตามระดับ: ตึกรายตัวเป็นสกุลหุ้น พอร์ตรวมเป็นบาท", () => {
  const usd = {
    id: "x", ticker: "VOO", name: "VOO", shares: 10, avgCost: 600,
    currentPrice: 700, currency: "USD" as const, district: "mission" as const,
  };

  // รายตัว = ผลตอบแทนตลาดล้วน ห้ามมีค่าเงินปน
  assert.ok(Math.abs(pnlRatio(usd)! - 700 / 600 + 1) < 1e-12);

  // บันทึกบาทจริงแล้ว ผลตอบแทนรายตัวต้องไม่ขยับ (ยังเป็น USD)
  const withReal = { ...usd, costTHB: 211_200 };
  assert.equal(pnlRatio(withReal), pnlRatio(usd), "costTHB ห้ามไปเปลี่ยนไฟรายตัว");

  // แต่ "เงินที่ลงไป" ต้องใช้บาทจริง ไม่คูณค่าเงินวันนี้ซ้ำ
  assert.equal(investedTHB(usd, 33), 198_000, "ไม่มีบาทจริง → ตีด้วยค่าเงินวันนี้");
  assert.equal(investedTHB(withReal, 33), 211_200);
  assert.equal(investedTHB(withReal, 40), 211_200, "ค่าเงินวันนี้ต้องไม่กระทบเงินที่ลงไปแล้ว");

  // ระดับพอร์ตรวมคิดฐานบาท จึงรวมผลค่าเงิน → ต่ำกว่าฝั่ง USD เพราะบาทแข็งขึ้น
  const city: CityState = { holdings: [withReal], fxRate: 33, isDemo: false };
  assert.equal(totals(city).invested, 211_200);
  assert.ok(totals(city).pnlRatio! < pnlRatio(usd)!);
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
