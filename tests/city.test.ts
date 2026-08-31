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
import { THB_PER_PX, TOWER_CAP_PX, TOWER_CAP_THB, floorPlan, groundCells, heightFor, towerHeights, layoutCity } from "../src/lib/iso";
import { parseHoldingsTable } from "../src/lib/importCsv";
import { compare } from "../src/lib/history";
import { plural, pluralize } from "../src/lib/text";
import {
  appendContributions,
  detectContributions,
  recentAddFor,
  summarize,
} from "../src/lib/contributions";
import { AXIS, CELL_STEP, carRoute, computeLanes, laneKey } from "../src/lib/traffic";
import { CASH_ZONE, type CityState } from "../src/lib/types";

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

/**
 * บั๊กที่เคยมีจริง: ไม้บรรทัดเป็นขั้นบันได ×√2 ที่ปรับตามตึกใหญ่สุด
 * พอตึกสูงสุดโตทะลุขั้น ตึก "ทุกหลัง" หดพร้อมกัน 29% — รวมตัวที่ไม่ได้แตะเลย
 * ตัวอย่าง: ตึกใหญ่สุดเติมอีก ฿24,000 แล้วเตี้ยลง 356px → 261px
 */
test("เติมเงินเข้าตัวใหญ่สุด ห้ามทำให้ตึกหลังไหนในเมืองเตี้ยลงแม้แต่หลังเดียว", () => {
  const before = baseCity();
  // คีย์ต้องเป็น "ตึกหลังที่เท่าไหร่ของรายการไหน" — หนึ่งรายการกินได้หลายแปลง
  const heightsOf = (st: CityState) =>
    new Map(
      layoutCity(toStructures(st), ORDER).all.map((p) => [
        `${p.structure.label}#${p.partIndex}`,
        p.height,
      ]),
    );

  let current = before;
  const start = heightsOf(current);

  // อัดเงินเข้าตัวที่ใหญ่ที่สุดซ้ำๆ ให้ทะลุทุกขั้นที่ไม้บรรทัดเดิมเคยกระโดด
  for (let round = 0; round < 40; round++) {
    // ⚠️ ต้องเทียบเป็นบาท ไม่ใช่สกุลเดิม — SCB 12,800 บาท ดูใหญ่กว่า GOOGL $860
    const c = current;
    const biggest = [...c.holdings].sort(
      (a, b) => investedTHB(b, c.fxRate) - investedTHB(a, c.fxRate),
    )[0];
    const prevH = heightsOf(current);

    current = {
      ...current,
      holdings: current.holdings.map((h) =>
        h.id === biggest.id ? { ...h, shares: h.shares * 1.35 } : h,
      ),
    };

    const nowH = heightsOf(current);
    for (const [label, h] of nowH) {
      // ตึกหลังใหม่ที่เพิ่งขึ้นไม่มีค่าเดิมให้เทียบ — ผ่านไป
      assert.ok(
        h >= (prevH.get(label) ?? 0) - 1e-9,
        `รอบ ${round}: ${label} เตี้ยลงจาก ${prevH.get(label)?.toFixed(1)} เหลือ ${h.toFixed(1)} ทั้งที่ไม่ได้ขายอะไร`,
      );
    }
  }

  // ตัวที่ถูกเติมต้องโตขึ้นจริง ไม่ใช่แค่ "ไม่หด" เพราะชนเพดาน
  // ตัวที่ถูกอัดเงินต้องกลายเป็นกลุ่มอาคารหลายหลัง ไม่ใช่เข็มเดียวสูงลิ่ว
  const end = layoutCity(toStructures(current), ORDER).all.filter(
    (p) => p.structure.label === "GOOGL",
  );
  assert.ok(end.length > 3, `GOOGL ควรแตกเป็นหลายหลัง ได้ ${end.length}`);
  assert.ok(
    end.every((p) => p.height <= TOWER_CAP_PX + 1e-9),
    "ห้ามมีหลังไหนทะลุเพดาน",
  );
  const total = end.reduce((a, p) => a + p.height, 0);
  assert.ok(total > (start.get("GOOGL#0") ?? 0) * 50, "ความสูงรวมต้องโตขึ้นจริง");
});

test("ไม้บรรทัดตรึงตายตัว — เงินเท่ากันได้ความสูงเท่ากันเสมอ ไม่ว่าเมืองจะใหญ่แค่ไหน", () => {
  assert.equal(heightFor(THB_PER_PX * 100), 100);
  // เมืองเล็กกับเมืองใหญ่ ตึก ฿50,000 ต้องสูงเท่ากันเป๊ะ
  const small = layoutCity(toStructures(baseCity()), ORDER).all;
  const huge = layoutCity(
    toStructures({
      ...baseCity(),
      holdings: [
        ...baseCity().holdings,
        { id: "z", ticker: "MEGA", name: "Mega", shares: 5000, avgCost: 500, currentPrice: 500, currency: "USD", district: "mission" },
      ],
    }),
    ORDER,
  ).all;
  const h = (list: typeof small, label: string) =>
    list.find((p) => p.structure.label === label)!.height;
  assert.equal(h(small, "GOOGL"), h(huge, "GOOGL"));
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

  // ไม่กรอกเงินเติมสะสม → ประมาณด้วยต้นทุนหุ้น + เงินสด (ต้องนับเงินสดด้วยเสมอ
  // เพราะเงินที่โอนเข้าพอร์ตแล้วก็คือเงินที่เก็บมาได้แล้ว)
  const noDeposits = portfolioSummary({ ...base, cash: { usd: 300, thb: 20_000 } });
  assert.equal(noDeposits.usingDeposits, false);
  assert.equal(noDeposits.returnBase, totals(base).invested + cash);
});

test("เมืองว่างต้องไม่ crash", () => {
  const empty = layoutCity([], ORDER);
  assert.equal(empty.all.length, 0);
  assert.ok(empty.bounds.width > 0);

  assert.equal(heightFor(0), 0, "ไม่ลงเงิน = ไม่มีตึก");
  assert.ok(heightFor(1000) > 0, "เงินน้อยมากก็ยังมีความสูงขั้นต่ำ");

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

/**
 * รถต้องวิ่งอยู่บนถนนตลอดเส้นทาง — ตรวจทุกคันทีละช่อง
 *
 * ตรวจด้วยตาไม่พอ: รถมีเป็นสิบคัน วิ่งวนคนละจังหวะ คันที่หลุดออกนอกถนนอาจ
 * อยู่นอกจอหรือหลุดแค่ตอนท้ายจังหวะพอดี
 */
test("รถทุกคันวิ่งไม่พ้นถนน — ทุกช่องตลอดเส้นทางต้องเป็นถนน", () => {
  const state = baseCity();
  const layout = layoutCity(toStructures(state), ORDER, [CASH_ZONE]);
  const cells = groundCells(layout);
  const lanes = computeLanes(cells);

  const roadAt = new Set(
    cells.filter((c) => c.kind === "road").map((c) => `${c.gx},${c.gy}`),
  );

  const cars = cells.filter((c) => c.decor === "car");
  assert.ok(cars.length > 0, "ต้องมีรถอย่างน้อยหนึ่งคันให้ตรวจ");

  let driving = 0;
  for (const car of cars) {
    assert.equal(car.kind, "road", `รถอยู่บนช่องที่ไม่ใช่ถนน ${car.gx},${car.gy}`);

    const route = carRoute(car, lanes.get(laneKey(car)));
    if (!route.canDrive) continue;
    driving++;

    // ทุกช่องที่ผ่านต้องเป็นถนน
    for (let step = 1; step <= route.cellsAhead; step++) {
      const gx = route.axis === "x" ? car.gx + route.dir * step : car.gx;
      const gy = route.axis === "y" ? car.gy + route.dir * step : car.gy;
      assert.ok(
        roadAt.has(`${gx},${gy}`),
        `รถจาก ${car.gx},${car.gy} แนว ${route.axis} วิ่งไปโผล่ที่ ${gx},${gy} ซึ่งไม่ใช่ถนน`,
      );
    }

    /**
     * และระยะพิกเซลต้องพาไปจอดกลางช่องนั้นจริง ไม่ใช่แค่ "นับช่องถูก"
     * เคยพลาดตรงนี้: ใช้ PITCH_W (112px) เป็นระยะต่อช่อง ทั้งที่ระยะจริง
     * ระหว่างกลางช่อง = hypot(56,28) ≈ 62.6px รถจึงวิ่งเกินไป 1.79 เท่า
     */
    const ax = AXIS[route.axis];
    const travel = CELL_STEP * route.cellsAhead;
    const endX = car.center.x + ax.dir[0] * travel * route.dir;
    const endY = car.center.y + ax.dir[1] * travel * route.dir;

    const tgx = route.axis === "x" ? car.gx + route.dir * route.cellsAhead : car.gx;
    const tgy = route.axis === "y" ? car.gy + route.dir * route.cellsAhead : car.gy;
    const target = cells.find((c) => c.gx === tgx && c.gy === tgy)!;
    const off = Math.hypot(endX - target.center.x, endY - target.center.y);

    assert.ok(
      off < 2,
      `รถจาก ${car.gx},${car.gy} ควรจอดกลางช่อง ${tgx},${tgy} แต่เลยไป ${off.toFixed(1)}px`,
    );
  }

  assert.ok(driving > 0, "รถต้องมีคันที่วิ่งได้จริง ไม่ใช่จอดหมดทั้งเมือง");
});

/** เลนต้องไม่กินช่องที่เป็นตึก — ถนนคั่นเขตถูกบังคับให้ทับแถวที่มีตึกได้ */
test("เลนถนนเก็บเฉพาะช่องที่เป็นถนนจริง ไม่คร่อมตึก", () => {
  const state = baseCity();
  const cells = groundCells(layoutCity(toStructures(state), ORDER, [CASH_ZONE]));
  const lanes = computeLanes(cells);

  for (const [key, lane] of lanes) {
    const [axis, fixed] = key.split(":");
    for (const pos of lane.cells) {
      const gx = axis === "x" ? pos : Number(fixed);
      const gy = axis === "x" ? Number(fixed) : pos;
      const cell = cells.find((c) => c.gx === gx && c.gy === gy);
      assert.equal(cell?.kind, "road", `เลน ${key} กินช่อง ${gx},${gy} ที่ไม่ใช่ถนน`);
    }
  }
});

/* ── ไม้ DCA: หน่วยวัดที่ไม่ถูกเจือจางเมื่อพอร์ตโต ───────────────── */

const DAY = 86_400_000;
const NOW = new Date("2026-08-31T10:00:00Z");

test("ซื้อเพิ่ม = บันทึก 1 ไม้ พร้อมยอดบาทจริง", () => {
  const before = baseCity();
  const after: CityState = {
    ...before,
    holdings: before.holdings.map((h) =>
      h.id === "a" ? { ...h, shares: h.shares + 2 } : h,
    ),
  };

  const found = detectContributions(before, after, NOW);
  assert.equal(found.length, 1);
  assert.equal(found[0].ticker, "GOOGL");
  assert.equal(found[0].at, "2026-08-31");
  // 2 หุ้น × $172 × 33.3 = ฿11,455.2
  assert.ok(Math.abs(found[0].amountTHB - 2 * 172 * 33.3) < 0.01);
});

/**
 * กับดักที่ทำให้ประวัติปลอมได้ง่ายที่สุด — ถ้าเทียบด้วยยอดบาท
 * การขยับค่าเงินอย่างเดียวจะทำให้ทุกตัวดูเหมือนเพิ่งเติมเงินพร้อมกัน
 */
test("แก้ค่าเงินอย่างเดียว ห้ามงอกไม้ปลอม", () => {
  const before = baseCity();
  const after: CityState = { ...before, fxRate: before.fxRate + 3 };
  assert.deepEqual(detectContributions(before, after, NOW), []);
});

test("ราคาตลาดวิ่ง ห้ามงอกไม้", () => {
  const before = baseCity();
  assert.deepEqual(detectContributions(before, crash(baseCity(), 0.4), NOW), []);
  const up: CityState = {
    ...before,
    holdings: before.holdings.map((h) => ({ ...h, currentPrice: h.currentPrice * 3 })),
  };
  assert.deepEqual(detectContributions(before, up, NOW), []);
});

test("ขายออกไม่นับเป็นไม้ และไม่ลบขีดที่เคยลงไปแล้ว", () => {
  const before = baseCity();
  const sold: CityState = {
    ...before,
    holdings: before.holdings.map((h) =>
      h.id === "a" ? { ...h, shares: h.shares - 3 } : h,
    ),
  };
  assert.deepEqual(detectContributions(before, sold, NOW), []);

  const past = [{ at: "2026-07-01", ticker: "GOOGL", amountTHB: 4000 }];
  assert.equal(appendContributions(past, []).length, 1);
});

test("เติมตัวเดิมวันเดียวกันสองครั้ง รวมเป็นไม้เดียว ไม่ใช่สองขีด", () => {
  const merged = appendContributions(
    [{ at: "2026-08-31", ticker: "SPYM", amountTHB: 2000 }],
    [{ at: "2026-08-31", ticker: "SPYM", amountTHB: 1500 }],
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0].amountTHB, 3500);
});

test("ถ้ามีบาทจ่ายจริงทั้งสองฝั่ง ใช้ส่วนต่างบาทตรงๆ ไม่แปลงด้วยค่าเงินวันนี้", () => {
  const before: CityState = {
    ...baseCity(),
    holdings: [
      { id: "a", ticker: "GOOGL", name: "Alphabet", shares: 5, avgCost: 172, currentPrice: 205, currency: "USD", district: "mission", costTHB: 27_000 },
    ],
  };
  const after: CityState = {
    ...before,
    holdings: [{ ...before.holdings[0], shares: 6, costTHB: 32_500 }],
  };
  const found = detectContributions(before, after, NOW);
  assert.equal(found.length, 1);
  assert.equal(found[0].amountTHB, 5_500); // ไม่ใช่ 172 × 33.3
});

test("จำนวนขีดและงานใหม่ไปถึง structure — เงินสดไม่มีขีดของตัวเอง", () => {
  const state: CityState = {
    ...baseCity(),
    cash: { usd: 100, thb: 5000 },
    contributions: [
      { at: "2026-06-01", ticker: "GOOGL", amountTHB: 4000 },
      { at: "2026-07-01", ticker: "GOOGL", amountTHB: 4000 },
      { at: "2026-08-29", ticker: "GOOGL", amountTHB: 4000 },
      { at: "2026-01-05", ticker: "IEMG", amountTHB: 2000 },
    ],
  };

  const structures = toStructures(state, NOW);
  const googl = structures.find((s) => s.label === "GOOGL")!;
  const iemg = structures.find((s) => s.label === "IEMG")!;
  const cash = structures.find((s) => s.district === CASH_ZONE)!;

  assert.equal(googl.contributionCount, 3);
  assert.equal(googl.recentAdd, 4000); // เฉพาะไม้ 29 ส.ค. ที่อยู่ในกรอบ 7 วัน
  assert.equal(iemg.contributionCount, 1);
  assert.equal(iemg.recentAdd, null); // ม.ค. เก่าเกินกรอบ
  assert.equal(cash.contributionCount, 0);
  assert.equal(cash.recentAdd, null);
});

test("สรุปไม้: นับครั้ง แยกปีนี้ และจับของใหม่ในกรอบ 7 วัน", () => {
  const s = summarize(
    [
      { at: "2025-11-10", ticker: "VOO", amountTHB: 3000 },
      { at: "2026-02-02", ticker: "VOO", amountTHB: 4000 },
      { at: new Date(NOW.getTime() - 2 * DAY).toISOString().slice(0, 10), ticker: "SPYM", amountTHB: 4000 },
    ],
    NOW,
  );
  assert.equal(s.rounds, 3);
  assert.equal(s.totalTHB, 11_000);
  assert.equal(s.thisYearRounds, 2);
  assert.equal(s.thisYearTHB, 8_000);
  assert.equal(s.recentTHB, 4_000);
  assert.deepEqual(s.recentTickers, ["SPYM"]);
});

/** เหตุผลทั้งหมดที่ฟีเจอร์นี้มีอยู่ — ขีดต้องโตเต็ม 1 ทั้งที่ตึกแทบไม่ขยับ */
test("เติมเงินก้อนเล็กบนพอร์ตใหญ่: ตึกโตไม่ถึง 5% แต่ขีดโต 100%", () => {
  const big: CityState = {
    fxRate: 32, isDemo: false,
    holdings: [
      { id: "s", ticker: "SPYM", name: "S&P500", shares: 1000, avgCost: 90, currentPrice: 95, currency: "USD", district: "mission" },
    ],
    contributions: [{ at: "2026-07-01", ticker: "SPYM", amountTHB: 4000 }],
  };

  const beforeH = toStructures(big, NOW)[0];
  const after: CityState = {
    ...big,
    holdings: [{ ...big.holdings[0], shares: 1000 + 4000 / 32 / 90 }],
  };
  const withNew: CityState = {
    ...after,
    contributions: appendContributions(big.contributions, detectContributions(big, after, NOW)),
  };
  const afterH = toStructures(withNew, NOW)[0];

  const growth = afterH.invested / beforeH.invested - 1;
  assert.ok(growth < 0.05, `เงินโตขึ้น ${(growth * 100).toFixed(1)}% ควรน้อยกว่า 5%`);
  assert.equal(beforeH.contributionCount, 1);
  assert.equal(afterH.contributionCount, 2); // +100%
});

test("ไม้ที่ลงวันที่ในอนาคต ห้ามนับเป็น 'เพิ่งเติม' — ไม่งั้นขึ้นเครนทั้งเมือง", () => {
  const future = new Date(NOW.getTime() + 90 * DAY).toISOString().slice(0, 10);
  const list = [
    { at: future, ticker: "SPYM", amountTHB: 7200 },
    { at: new Date(NOW.getTime() - 3 * DAY).toISOString().slice(0, 10), ticker: "VOO", amountTHB: 5000 },
  ];
  assert.equal(recentAddFor(list, "SPYM", NOW), null);
  assert.equal(recentAddFor(list, "VOO", NOW), 5000);

  const s = summarize(list, NOW);
  assert.equal(s.recentTHB, 5000);
  assert.deepEqual(s.recentTickers, ["VOO"]);
  assert.equal(s.rounds, 2, "แต่ยังนับเป็นไม้ที่ลงไปแล้วอยู่ ไม่ได้ทิ้ง");
});

/**
 * กฎเหล็กของการแตกตึก: ตึกที่เต็มเพดานแล้วต้องค้างที่เพดานตลอดไป
 * ห้ามผ่าเงินออกเป็นหลายหลังเท่าๆ กัน (นั่นคือบั๊ก √2 ในเสื้อใหม่)
 */
test("แตกตึกแล้วต้องไม่มีหลังไหนเตี้ยลง แม้เดินเงินทีละไม้ตลอดทาง", () => {
  let prev: number[] = [];
  let splits = 0;

  for (let thb = 0; thb <= 900_000; thb += 4_000) {
    const parts = towerHeights(thb);
    assert.ok(
      parts.every((h) => h <= TOWER_CAP_PX + 1e-9),
      `฿${thb}: มีหลังทะลุเพดาน`,
    );
    parts.forEach((h, i) => {
      assert.ok(
        h >= (prev[i] ?? 0) - 1e-9,
        `฿${thb}: หลังที่ ${i + 1} เตี้ยลงจาก ${prev[i]?.toFixed(1)} เหลือ ${h.toFixed(1)}`,
      );
    });
    if (parts.length > prev.length) splits++;
    prev = parts;
  }

  assert.ok(splits >= 6, `ควรแตกตึกหลายรอบในช่วงนี้ ได้ ${splits}`);
});

test("อัตราส่วนตึกต่อแปลงหยุดโตหลังแตกตึก — ไม่กลายเป็นเข็มอีกต่อไป", () => {
  const ratio = (thb: number) => Math.max(...towerHeights(thb)) / 68;
  assert.ok(ratio(90_000) < 5, "วันนี้ยังทรงเดิม");
  // ฿560,000 ในตัวเดียว: ตึกเดียวจะเป็น 25.7 เท่า
  assert.ok(560_000 / THB_PER_PX / 68 > 25, "เทียบกับแบบตึกเดียวที่เป็นเข็มจริง");
  assert.ok(ratio(560_000) < 6.2, "แตกตึกแล้วต้องค้างที่ ~5.9 เท่า");
  assert.equal(ratio(5_000_000).toFixed(1), ratio(560_000).toFixed(1), "โตอีกกี่เท่าก็ไม่เพี้ยนเพิ่ม");
});

test("เงินรวมของทุกหลังต้องเท่ากับเงินที่ลงไปจริง ไม่ตกหล่นตอนแตกตึก", () => {
  for (const thb of [0, 5_000, 128_000, 128_001, 300_000, 777_777]) {
    const sum = towerHeights(thb).reduce((a, h) => a + h, 0);
    const expected = thb / THB_PER_PX;
    if (thb === 0) { assert.equal(sum, 0); continue; }
    // เศษเล็กกว่า MIN_H ถูกดันขึ้นเป็น 5px ได้ จึงยอมให้เกินได้เล็กน้อย
    assert.ok(sum >= expected - 1e-9 && sum <= expected + MIN_H_ALLOWANCE,
      `฿${thb}: รวมได้ ${sum.toFixed(1)}px ควรเป็น ${expected.toFixed(1)}px`);
  }
});
const MIN_H_ALLOWANCE = 5;

/** บล็อกสี่เหลี่ยม: ตึกของหุ้นตัวเดียวกันต้องอยู่ติดกันเป็นผืน ไม่กระจายทั่วเมือง */
test("หุ้นที่กินหลายแปลงต้องจัดเป็นบล็อกสี่เหลี่ยมติดกัน", () => {
  const big: CityState = {
    fxRate: 32, isDemo: false,
    holdings: [
      // ฿1,280,000 = 10 หลัง → ควรได้บล็อก 4×3
      { id: "a", ticker: "SPYM", name: "S&P", shares: 40_000, avgCost: 1, currentPrice: 1.2, currency: "USD", district: "mission" },
      // ฿256,000 = 2 หลัง
      { id: "b", ticker: "VOO", name: "Vanguard", shares: 8_000, avgCost: 1, currentPrice: 1.1, currency: "USD", district: "mission" },
      { id: "c", ticker: "PG", name: "P&G", shares: 100, avgCost: 1, currentPrice: 1, currency: "USD", district: "mission" },
    ],
  };

  const all = layoutCity(toStructures(big), ORDER).all;
  const spym = all.filter((p) => p.structure.label === "SPYM");
  assert.ok(spym.length >= 9, `SPYM ควรได้หลายหลัง ได้ ${spym.length}`);

  const w = new Set(spym.map((p) => p.gx)).size;
  const h = new Set(spym.map((p) => p.gy)).size;
  assert.ok(w > 1 && h > 1, `ต้องเป็นบล็อก ไม่ใช่แถวเดียว ได้ ${w}×${h}`);
  // สี่เหลี่ยมจริง ไม่ใช่แถวยาว — ด้านสั้นต้องไม่น้อยกว่าครึ่งของด้านยาว
  assert.ok(Math.min(w, h) >= Math.max(w, h) / 2, `บล็อกเพี้ยน ${w}×${h}`);

  // ทุกหลังต้องอยู่ในกรอบสี่เหลี่ยมเดียวกัน ไม่มีหลังหลงไปอยู่อีกฝั่งเมือง
  const gxs = spym.map((p) => p.gx), gys = spym.map((p) => p.gy);
  const area = (Math.max(...gxs) - Math.min(...gxs) + 1) * (Math.max(...gys) - Math.min(...gys) + 1);
  assert.ok(area <= spym.length + w, `ตึกกระจายเกินบล็อก พื้นที่ ${area} สำหรับ ${spym.length} หลัง`);

  // บล็อกของคนละหุ้นห้ามทับกัน
  const seen = new Set<string>();
  for (const p of all) {
    const key = `${p.gx},${p.gy}`;
    assert.ok(!seen.has(key), `แปลง ${key} ถูกใช้ซ้ำสองตึก`);
    seen.add(key);
  }
});

/**
 * พหูพจน์อังกฤษ — ภาษาไทยไม่มีพจน์ พอเปลี่ยน UI เป็นอังกฤษความผิดแบบนี้
 * จึงโผล่พร้อมกันทั้งแอป (Golden Goose ตึกเดียวขึ้นว่า "1 towers")
 */
test("นับ 1 ต้องเป็นเอกพจน์ ที่เหลือพหูพจน์ — รวมเศษและศูนย์", () => {
  assert.equal(plural(1, "tower"), "1 tower");
  assert.equal(plural(0, "tower"), "0 towers");
  assert.equal(plural(17, "tower"), "17 towers");
  assert.equal(plural(1, "earlier round"), "1 earlier round");
  assert.equal(plural(3, "new tower"), "3 new towers");

  assert.equal(pluralize(1, "share"), "share");
  assert.equal(pluralize(0.316, "share"), "shares", "เศษหุ้นเป็นพหูพจน์");
  assert.equal(pluralize(2, "share"), "shares");
});

/**
 * เลขจำนวนตึกต้องตรงกับสิ่งที่นับได้ด้วยตาในเมือง
 * ของฟรี (ต้นทุน 0) วาดเป็นที่ดินเปล่า+กองทอง ไม่ใช่ตึก จึงห้ามนับเป็นตึก
 */
test("จำนวนตึกต้องเท่ากับตึกที่ยืนอยู่จริงในเมือง ไม่ใช่จำนวนหุ้นที่ถือ", () => {
  const state = baseCity();
  const t = totals(state);
  const standing = layoutCity(toStructures(state), ORDER).all.filter(
    (p) => p.structure.kind === "tower" && p.height > 0,
  ).length;

  assert.equal(t.towerCount, standing, "sidebar ต้องไม่โกหกภาพในเมือง");
  assert.equal(t.landCount, 1, "GLD ต้นทุน 0 = ที่ดินเปล่า 1 แปลง");
  assert.equal(
    t.towerCount + t.landCount,
    state.holdings.length,
    "ตึก + ที่ดิน ต้องครบทุกตัวที่ถือ ไม่ตกหล่น",
  );
});

test("หุ้นที่แตกเป็นหลายตึกต้องถูกนับหลายหลัง ไม่ใช่หลังเดียว", () => {
  const big: CityState = {
    fxRate: 32, isDemo: false,
    holdings: [
      // ฿384,000 = 3 หลังเต็มเพดาน
      { id: "a", ticker: "SPYM", name: "S&P", shares: 12_000, avgCost: 1, currentPrice: 1, currency: "USD", district: "mission" },
    ],
  };
  const t = totals(big);
  const standing = layoutCity(toStructures(big), ORDER).all.filter(
    (p) => p.structure.kind === "tower" && p.height > 0,
  ).length;
  assert.equal(t.towerCount, 3);
  assert.equal(t.towerCount, standing);
});

/**
 * เลขที่ sidebar โชว์ข้างชื่อเขตต้องเป็น "มูลค่าตลาด" ไม่ใช่ต้นทุน
 * เคยโชว์ต้นทุน ฿300,000 ทั้งที่มูลค่าจริง ฿330,000 — คนอ่านเลขลอยๆ ข้างชื่อเขต
 * ว่า "เขตนี้มีค่าเท่าไหร่" เสมอ
 */
test("มูลค่าตลาดของแต่ละเขตบวกกันต้องเท่ากับทั้งเมือง และต่างจากต้นทุนจริง", () => {
  const s = baseCity();
  const all = totals(s);
  const mission = totals(s, "mission");
  const gg = totals(s, "goldengoose");

  assert.ok(
    Math.abs(mission.marketValue + gg.marketValue - all.marketValue) < 0.01,
    "แยกเขตแล้วบวกกลับต้องได้เท่าเดิม",
  );
  assert.ok(
    Math.abs(mission.invested + gg.invested - all.invested) < 0.01,
    "ต้นทุนก็ต้องบวกกลับได้เหมือนกัน",
  );
  assert.notEqual(all.marketValue, all.invested, "สองตัวนี้ต้องไม่ใช่เลขเดียวกัน");

  // เงินสดไม่อยู่ในเขตไหน จึงห้ามโผล่ในผลรวมของเขต
  const withCash: CityState = { ...s, cash: { usd: 1000, thb: 50_000 } };
  assert.equal(totals(withCash).marketValue, all.marketValue, "เงินสดห้ามปนมูลค่าเขต");
});
