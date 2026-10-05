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
import { THB_PER_PX, TOWER_CAP_PX, boundsWithWall, floorPlan, groundCells, heightFor, towerHeights, unionBounds, wallRing, wallBounds, layoutCity } from "../src/lib/iso";
import { parseHoldingsTable } from "../src/lib/importCsv";
import { parseCity } from "../src/lib/storage";
import { compare } from "../src/lib/history";
import { plural, pluralize } from "../src/lib/text";
import { applyReserveEvent, appendReserveEvent, reserveStatus } from "../src/lib/reserve";
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
      // Lots of money, few shares — the case that makes "height = share count" wrong
      { id: "a", ticker: "GOOGL", name: "Alphabet", shares: 5, avgCost: 172, currentPrice: 205, currency: "USD", district: "mission" },
      // 6× more shares, but less money invested
      { id: "b", ticker: "IEMG", name: "EM", shares: 30, avgCost: 10, currentPrice: 12, currency: "USD", district: "mission" },
      // Obtained free, zero cost
      { id: "c", ticker: "GLD", name: "Gold", shares: 0.5, avgCost: 0, currentPrice: 234, currency: "USD", district: "mission" },
      // Fractional share + heavy loss
      { id: "d", ticker: "TMDX", name: "TransMedics", shares: 0.4, avgCost: 118, currentPrice: 62, currency: "USD", district: "mission" },
      // Baht-denominated, different district
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

test("height comes from money invested, not share count", () => {
  const s = baseCity();
  assert.ok(
    heightOf(s, "a") > heightOf(s, "b"),
    "GOOGL (5 shares, ฿28,638) must be taller than IEMG (30 shares, ฿9,990)",
  );
});

test("a −30% market drop must not shrink a single tower", () => {
  const before = layoutCity(toStructures(baseCity()), ORDER);
  const after = layoutCity(toStructures(crash(baseCity(), 0.7)), ORDER);

  for (const p of before.all) {
    const q = after.all.find((x) => x.structure.id === p.structure.id)!;
    assert.equal(q.height, p.height, `${p.structure.label} height changed`);
  }
  assert.equal(totals(crash(baseCity(), 0.7)).invested, totals(baseCity()).invested);
  assert.ok(totals(crash(baseCity(), 0.7)).marketValue < totals(baseCity()).marketValue);
});

test("DCA into the biggest holding during a drop must make its tower taller", () => {
  // The case that broke under normalize-by-max: the biggest tower was pinned to the ceiling forever
  const crashed = crash(baseCity(), 0.7);
  const dca: CityState = {
    ...crashed,
    holdings: crashed.holdings.map((h) =>
      h.id === "a" ? { ...h, shares: h.shares + 7200 / (172 * 33.3) } : h,
    ),
  };

  assert.ok(heightOf(dca, "a") > heightOf(crashed, "a"));
  assert.equal(heightOf(dca, "e"), heightOf(crashed, "e"), "towers without a top-up must not move");
});

test("crossing a scale step still grows relative to other towers (camera pulls back, towers don't shrink)", () => {
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
 * A real bug that existed: the ruler stepped by ×√2 based on the biggest tower.
 * When the tallest tower grew past a step, *every* tower shrank 29% at once — including untouched ones.
 * Example: adding ฿24,000 to the biggest tower made it drop from 356px → 261px.
 */
test("adding money to the biggest holding must never make any tower in the city shorter", () => {
  const before = baseCity();
  // The key must be "which tower of which holding" — one holding can span several plots
  const heightsOf = (st: CityState) =>
    new Map(
      layoutCity(toStructures(st), ORDER).all.map((p) => [
        `${p.structure.label}#${p.partIndex}`,
        p.height,
      ]),
    );

  let current = before;
  const start = heightsOf(current);

  // Keep pumping money into the biggest holding so it crosses every step the old ruler used to jump at
  for (let round = 0; round < 40; round++) {
    // ⚠️ Compare in baht, not native currency — SCB at 12,800 baht looks bigger than GOOGL at $860
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
      // A newly added tower has no previous height to compare — skip
      assert.ok(
        h >= (prevH.get(label) ?? 0) - 1e-9,
        `round ${round}: ${label} dropped from ${prevH.get(label)?.toFixed(1)} to ${h.toFixed(1)} without selling anything`,
      );
    }
  }

  // The holding that received money must actually grow, not just "not shrink" because it hit the cap
  // and the one being pumped must become a group of towers, not one towering needle
  const end = layoutCity(toStructures(current), ORDER).all.filter(
    (p) => p.structure.label === "GOOGL",
  );
  assert.ok(end.length > 3, `GOOGL should split into several towers, got ${end.length}`);
  assert.ok(
    end.every((p) => p.height <= TOWER_CAP_PX + 1e-9),
    "no tower may exceed the cap",
  );
  const total = end.reduce((a, p) => a + p.height, 0);
  assert.ok(total > (start.get("GOOGL#0") ?? 0) * 50, "total height must really grow");
});

test("the ruler is fixed — the same money always gives the same height, however big the city", () => {
  assert.equal(heightFor(THB_PER_PX * 100), 100);
  // In a small city and a big one, a ฿50,000 tower must be exactly the same height
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

test("free holdings (zero cost) don't break anything and have no tower", () => {
  const s = baseCity();
  const gld = s.holdings.find((h) => h.id === "c")!;

  assert.equal(pnlRatio(gld), null, "must not divide by zero and get Infinity");
  assert.equal(investedTHB(gld, s.fxRate), 0);
  assert.ok(isFreeHolding(gld));
  assert.equal(heightOf(s, "c"), 0, "zero invested = bare land, not a tower");
  assert.ok(
    heightOf(s, "d") > heightOf(s, "c"),
    "a tower with real money in it must always be taller than free land",
  );
});

test("floor count matches share count", () => {
  const full = floorPlan(5, 100);
  assert.equal(full.fullFloors, 5);
  assert.equal(full.partial, 0);
  assert.equal(full.floorHeight * 5, 100);

  const frac = floorPlan(0.4, 50);
  assert.equal(frac.fullFloors, 0);
  assert.ok(Math.abs(frac.partial - 0.4) < 1e-9);

  assert.ok(floorPlan(120, 200).toodense, "too many shares must stop drawing per-floor lines");
});

test("mixed currencies and separate districts", () => {
  const s = baseCity();
  const scb = s.holdings.find((h) => h.id === "e")!;

  assert.equal(investedTHB(scb, s.fxRate), 12_800, "baht must not be multiplied by FX again");

  const gg = totals(s, "goldengoose");
  assert.equal(gg.towerCount, 1);
  assert.equal(gg.invested, 12_800);

  const l = layoutCity(toStructures(s), ORDER);
  assert.ok(
    Math.max(...l.districts[0].placed.map((p) => p.gy)) <
      Math.min(...l.districts[1].placed.map((p) => p.gy)),
    "the two districts must not overlap in the grid",
  );
});

test("concentration metric instead of summing share counts across companies", () => {
  const top = topConcentration(baseCity());
  assert.equal(top?.label, "GOOGL");
  assert.ok(top!.share > 0 && top!.share <= 1);
  assert.equal(topConcentration({ holdings: [], fxRate: 33.3, isDemo: false }), null);
});

test("cash is a construction site, not city height", () => {
  const withCash: CityState = { ...baseCity(), cash: { usd: 300, thb: 20_000 } };

  // Cash isn't ownership yet — it must not increase "money invested"
  assert.equal(totals(withCash).invested, totals(baseCity()).invested);
  assert.equal(totals(withCash).towerCount, totals(baseCity()).towerCount);

  const sites = toStructures(withCash).filter((s) => s.kind === "site");
  assert.equal(sites.length, 2, "separate USD and baht piles");
  assert.equal(cashTHB(withCash), 300 * 33.3 + 20_000);

  // Sites must be in a separate zone from towers, not mixed with what's already owned
  assert.ok(sites.every((s) => s.district === "cash"));

  // Site size must reflect real money: a 20,000 baht pile must be bigger than a USD 9,990 pile
  const l = layoutCity(toStructures(withCash), [...ORDER, "cash"]);
  const usd = l.all.find((p) => p.structure.id === "cash-usd")!;
  const thb = l.all.find((p) => p.structure.id === "cash-thb")!;
  assert.ok(thb.height > usd.height, "a site with more money must be bigger");

  // No cash = no site
  assert.equal(toStructures(baseCity()).filter((s) => s.kind === "site").length, 0);
  // Entering 0 must not produce an empty site either
  const zero: CityState = { ...baseCity(), cash: { usd: 0, thb: 0 } };
  assert.equal(toStructures(zero).filter((s) => s.kind === "site").length, 0);
});

test("every decoration type that exists in code actually appears, not dead code", () => {
  // This went wrong before: when the outskirts became allocated plots, pedestrians tied to "grass near the
  // city" had nowhere left to stand and silently became dead code without anyone noticing
  const withCash: CityState = { ...baseCity(), cash: { usd: 300, thb: 20_000 } };
  const cells = groundCells(
    layoutCity(toStructures(withCash), [...ORDER, "cash"], ["cash"]),
  );

  for (const kind of ["plot", "road", "vacant", "grass"] as const) {
    assert.ok(
      cells.some((c) => c.kind === kind),
      `no cells of kind ${kind} at all`,
    );
  }

  for (const decor of ["tree", "bush", "car", "lamp", "person"] as const) {
    assert.ok(
      cells.some((c) => c.decor === decor),
      `${decor} never appears in any cell — probably dead code`,
    );
  }

  // The street plan has roads in two directions; every road cell must know which one it is,
  // otherwise cars and lane markings get placed sideways across the other roads
  const roads = cells.filter((c) => c.kind === "road");
  assert.ok(roads.every((c) => c.roadAxis), "road cells must always have an axis");
  for (const axis of ["x", "y"] as const) {
    assert.ok(
      roads.some((c) => c.roadAxis === axis || c.roadAxis === "both"),
      `no roads along ${axis} at all`,
    );
  }
});

test("portfolio totals count cash like the spreadsheet, but city height doesn't", () => {
  const base = baseCity();
  const withCash: CityState = {
    ...base,
    cash: { usd: 300, thb: 20_000 },
    deposits: 400_000,
  };

  const s = portfolioSummary(withCash);
  const cash = 300 * 33.3 + 20_000;

  // Portfolio value = stocks + cash (the same as the spreadsheet reports)
  assert.equal(s.marketTotal, totals(base).marketValue + cash);

  // Return is measured against "total deposits", not stock cost
  assert.ok(s.usingDeposits);
  assert.equal(s.returnBase, 400_000);
  assert.ok(Math.abs(s.totalReturn! - (s.marketTotal / 400_000 - 1)) < 1e-12);

  // But city height is still pure stock cost, unaffected by cash or total deposits
  assert.equal(s.invested, totals(base).invested);

  // Without total deposits → estimate from stock cost + cash (cash must always count,
  // because money moved into the portfolio has already been saved)
  const noDeposits = portfolioSummary({ ...base, cash: { usd: 300, thb: 20_000 } });
  assert.equal(noDeposits.usingDeposits, false);
  assert.equal(noDeposits.returnBase, totals(base).invested + cash);
});

test("an empty city must not crash", () => {
  const empty = layoutCity([], ORDER);
  assert.equal(empty.all.length, 0);
  assert.ok(empty.bounds.width > 0);

  assert.equal(heightFor(0), 0, "no money = no tower");
  assert.ok(heightFor(1000) > 0, "very little money still gets the minimum height");

  const t = totals({ holdings: [], fxRate: 33.3, isDemo: false });
  assert.equal(t.invested, 0);
  assert.equal(t.pnlRatio, null);
});

test("parse a table pasted from a sheet", () => {
  const rows = parseHoldingsTable(
    "ticker,shares,cost\nVOO, 12, 480\nGOOGL\t5\t172\t205\nSCB;100;128;131;THB;goldengoose\nBAD, abc, 1",
  );
  const ok = rows.filter((r) => r.ok);
  const bad = rows.filter((r) => !r.ok);

  assert.equal(ok.length, 3, "accepts comma / tab / semicolon and skips the header");
  assert.equal(bad.length, 1, "bad rows must be reported, not fail the whole batch");

  const scb = ok.find((r) => r.ok && r.holding.ticker === "SCB");
  assert.ok(scb?.ok && scb.holding.currency === "THB");
  assert.ok(scb?.ok && scb.holding.district === "goldengoose");

  const voo = ok.find((r) => r.ok && r.holding.ticker === "VOO");
  assert.ok(voo?.ok && voo.holding.currentPrice === 480, "no price given → use cost for now");
});

test("currency by level: per-tower in the stock's currency, portfolio total in baht", () => {
  const usd = {
    id: "x", ticker: "VOO", name: "VOO", shares: 10, avgCost: 600,
    currentPrice: 700, currency: "USD" as const, district: "mission" as const,
  };

  // Per holding = pure market return, no FX mixed in
  assert.ok(Math.abs(pnlRatio(usd)! - 700 / 600 + 1) < 1e-12);

  // After recording real baht paid, the per-holding return must not move (still USD)
  const withReal = { ...usd, costTHB: 211_200 };
  assert.equal(pnlRatio(withReal), pnlRatio(usd), "costTHB must not change per-tower lights");

  // But "money invested" must use the real baht, not today's FX again
  assert.equal(investedTHB(usd, 33), 198_000, "no real baht → estimate at today's FX");
  assert.equal(investedTHB(withReal, 33), 211_200);
  assert.equal(investedTHB(withReal, 40), 211_200, "today's FX must not affect money already invested");

  // The portfolio level is in baht, so it includes FX effects → lower than the USD side because the baht strengthened
  const city: CityState = { holdings: [withReal], fxRate: 33, isDemo: false };
  assert.equal(totals(city).invested, 211_200);
  assert.ok(totals(city).pnlRatio! < pnlRatio(usd)!);
});

test("comparing the city with the past measures money invested, not market value", () => {
  const past = { at: new Date(Date.now() - 86_400_000 * 30).toISOString(), state: baseCity() };

  // Market falls 50% with no top-up → growth must be 0
  const marketOnly = compare(past, crash(baseCity(), 0.5));
  assert.equal(marketOnly.investedDelta, 0);
  assert.equal(marketOnly.newTowers.length, 0);

  // Buy more + a new tower
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
 * Cars must stay on the road for their whole route — check every car, cell by cell.
 *
 * Checking by eye isn't enough: there are dozens of cars on different loops, and one that leaves
 * the road may be off-screen or only stray at the very end of its loop.
 */
test("no car ever leaves the road — every cell along its route must be road", () => {
  const state = baseCity();
  const layout = layoutCity(toStructures(state), ORDER, [CASH_ZONE]);
  const cells = groundCells(layout);
  const lanes = computeLanes(cells);

  const roadAt = new Set(
    cells.filter((c) => c.kind === "road").map((c) => `${c.gx},${c.gy}`),
  );

  const cars = cells.filter((c) => c.decor === "car");
  assert.ok(cars.length > 0, "need at least one car to check");

  let driving = 0;
  for (const car of cars) {
    assert.equal(car.kind, "road", `car is on a non-road cell ${car.gx},${car.gy}`);

    const route = carRoute(car, lanes.get(laneKey(car)));
    if (!route.canDrive) continue;
    driving++;

    // Every cell it passes through must be road
    for (let step = 1; step <= route.cellsAhead; step++) {
      const gx = route.axis === "x" ? car.gx + route.dir * step : car.gx;
      const gy = route.axis === "y" ? car.gy + route.dir * step : car.gy;
      assert.ok(
        roadAt.has(`${gx},${gy}`),
        `car from ${car.gx},${car.gy} on axis ${route.axis} ends up at ${gx},${gy}, which isn't road`,
      );
    }

    /**
     * and the pixel distance must actually park it at the centre of that cell, not just "count cells right".
     * This went wrong before: PITCH_W (112px) was used as the distance per cell, while the real
     * distance between cell centres = hypot(56,28) ≈ 62.6px, so cars overshot by 1.79×.
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
      `car from ${car.gx},${car.gy} should park at the centre of ${tgx},${tgy} but overshot by ${off.toFixed(1)}px`,
    );
  }

  assert.ok(driving > 0, "some cars must actually drive, not all parked across the whole city");
});

/** Lanes must not include tower cells — district-divider roads are allowed to run through rows with towers */
test("lanes only contain cells that are actually road, never spanning a tower", () => {
  const state = baseCity();
  const cells = groundCells(layoutCity(toStructures(state), ORDER, [CASH_ZONE]));
  const lanes = computeLanes(cells);

  for (const [key, lane] of lanes) {
    const [axis, fixed] = key.split(":");
    for (const pos of lane.cells) {
      const gx = axis === "x" ? pos : Number(fixed);
      const gy = axis === "x" ? Number(fixed) : pos;
      const cell = cells.find((c) => c.gx === gx && c.gy === gy);
      assert.equal(cell?.kind, "road", `lane ${key} includes ${gx},${gy}, which isn't road`);
    }
  }
});

/* ── DCA rounds: a unit that doesn't get diluted as the portfolio grows ───────────── */

const DAY = 86_400_000;
const NOW = new Date("2026-08-31T10:00:00Z");

test("buying more = 1 round recorded, with the real baht amount", () => {
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
  // 2 shares × $172 × 33.3 = ฿11,455.2
  assert.ok(Math.abs(found[0].amountTHB - 2 * 172 * 33.3) < 0.01);
});

/**
 * The easiest trap for fake history — if compared in baht,
 * changing only the FX rate would make every holding look like it was just topped up.
 */
test("changing only the FX rate must not create fake rounds", () => {
  const before = baseCity();
  const after: CityState = { ...before, fxRate: before.fxRate + 3 };
  assert.deepEqual(detectContributions(before, after, NOW), []);
});

test("market price moves must not create rounds", () => {
  const before = baseCity();
  assert.deepEqual(detectContributions(before, crash(baseCity(), 0.4), NOW), []);
  const up: CityState = {
    ...before,
    holdings: before.holdings.map((h) => ({ ...h, currentPrice: h.currentPrice * 3 })),
  };
  assert.deepEqual(detectContributions(before, up, NOW), []);
});

test("selling isn't a round, and doesn't erase tallies already made", () => {
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

test("topping up the same holding twice in one day merges into one round, not two", () => {
  const merged = appendContributions(
    [{ at: "2026-08-31", ticker: "SPYM", amountTHB: 2000 }],
    [{ at: "2026-08-31", ticker: "SPYM", amountTHB: 1500 }],
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0].amountTHB, 3500);
});

test("with real baht paid on both sides, use the baht difference directly, not today's FX", () => {
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
  assert.equal(found[0].amountTHB, 5_500); // not 172 × 33.3
});

test("tally counts and recent work reach the structure — cash has no tally of its own", () => {
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
  assert.equal(googl.recentAdd, 4000); // only the Aug 29 round falls in the 7-day window
  assert.equal(iemg.contributionCount, 1);
  assert.equal(iemg.recentAdd, null); // January is outside the window
  assert.equal(cash.contributionCount, 0);
  assert.equal(cash.recentAdd, null);
});

test("round summary: counts times, splits out this year, and catches new ones in the 7-day window", () => {
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

/** The whole reason this feature exists — the tally grows a full 1 while the tower barely moves */
test("a small top-up on a big portfolio: tower grows under 5% but the tally grows 100%", () => {
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
  assert.ok(growth < 0.05, `money grew ${(growth * 100).toFixed(1)}%, should be under 5%`);
  assert.equal(beforeH.contributionCount, 1);
  assert.equal(afterH.contributionCount, 2); // +100%
});

test("rounds dated in the future must not count as 'just added' — or every tower gets a crane", () => {
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
  assert.equal(s.rounds, 2, "but they still count as rounds made, not dropped");
});

/**
 * Hard rule of tower splitting: a tower at the cap stays at the cap forever.
 * Never split money into several equal towers (that's the √2 bug in new clothes).
 */
test("splitting never makes any tower shorter, even walking money in one round at a time", () => {
  let prev: number[] = [];
  let splits = 0;

  for (let thb = 0; thb <= 900_000; thb += 4_000) {
    const parts = towerHeights(thb);
    assert.ok(
      parts.every((h) => h <= TOWER_CAP_PX + 1e-9),
      `฿${thb}: a tower exceeds the cap`,
    );
    parts.forEach((h, i) => {
      assert.ok(
        h >= (prev[i] ?? 0) - 1e-9,
        `฿${thb}: tower ${i + 1} dropped from ${prev[i]?.toFixed(1)} to ${h.toFixed(1)}`,
      );
    });
    if (parts.length > prev.length) splits++;
    prev = parts;
  }

  assert.ok(splits >= 6, `should split several times over this range, got ${splits}`);
});

test("tower-to-plot ratio stops growing after splitting — no more needles", () => {
  const ratio = (thb: number) => Math.max(...towerHeights(thb)) / 68;
  assert.ok(ratio(90_000) < 5, "a ~฿90k tower is still normally proportioned");
  // ฿560,000 in one holding: a single tower would be 25.7×
  assert.ok(560_000 / THB_PER_PX / 68 > 25, "compared with the single-tower version, which really is a needle");
  assert.ok(ratio(560_000) < 6.2, "after splitting it must stay at ~5.9×");
  assert.equal(ratio(5_000_000).toFixed(1), ratio(560_000).toFixed(1), "however much bigger it gets, it doesn't distort further");
});

test("the money across all towers equals the money invested — nothing lost when splitting", () => {
  for (const thb of [0, 5_000, 128_000, 128_001, 300_000, 777_777]) {
    const sum = towerHeights(thb).reduce((a, h) => a + h, 0);
    const expected = thb / THB_PER_PX;
    if (thb === 0) { assert.equal(sum, 0); continue; }
    // Remainders smaller than MIN_H can be bumped up to 5px, so a small overshoot is allowed
    assert.ok(sum >= expected - 1e-9 && sum <= expected + MIN_H_ALLOWANCE,
      `฿${thb}: summed to ${sum.toFixed(1)}px, should be ${expected.toFixed(1)}px`);
  }
});
const MIN_H_ALLOWANCE = 5;

/** Square blocks: one holding's towers must sit together as one piece of land, not scattered across the city */
test("holdings spanning several plots are arranged as adjacent square blocks", () => {
  const big: CityState = {
    fxRate: 32, isDemo: false,
    holdings: [
      // ฿1,280,000 = 10 towers → should be a 4×3 block
      { id: "a", ticker: "SPYM", name: "S&P", shares: 40_000, avgCost: 1, currentPrice: 1.2, currency: "USD", district: "mission" },
      // ฿256,000 = 2 towers
      { id: "b", ticker: "VOO", name: "Vanguard", shares: 8_000, avgCost: 1, currentPrice: 1.1, currency: "USD", district: "mission" },
      { id: "c", ticker: "PG", name: "P&G", shares: 100, avgCost: 1, currentPrice: 1, currency: "USD", district: "mission" },
    ],
  };

  const all = layoutCity(toStructures(big), ORDER).all;
  const spym = all.filter((p) => p.structure.label === "SPYM");
  assert.ok(spym.length >= 9, `SPYM should have many towers, got ${spym.length}`);

  const w = new Set(spym.map((p) => p.gx)).size;
  const h = new Set(spym.map((p) => p.gy)).size;
  assert.ok(w > 1 && h > 1, `must be a block, not a single row, got ${w}×${h}`);
  // A real square, not a long row — the short side must be at least half the long side
  assert.ok(Math.min(w, h) >= Math.max(w, h) / 2, `misshapen block ${w}×${h}`);

  // Every tower must be inside one rectangle — none stranded on the other side of the city
  const gxs = spym.map((p) => p.gx), gys = spym.map((p) => p.gy);
  const area = (Math.max(...gxs) - Math.min(...gxs) + 1) * (Math.max(...gys) - Math.min(...gys) + 1);
  assert.ok(area <= spym.length + w, `towers spread beyond the block: area ${area} for ${spym.length} towers`);

  // Blocks of different holdings must not overlap
  const seen = new Set<string>();
  for (const p of all) {
    const key = `${p.gx},${p.gy}`;
    assert.ok(!seen.has(key), `plot ${key} used by two towers`);
    seen.add(key);
  }
});

/**
 * English plurals — Thai has no plural forms, so when the UI switched to English this kind of
 * bug appeared across the whole app at once (Golden Goose, with one tower, showed "1 towers").
 */
test("1 is singular, everything else plural — including fractions and zero", () => {
  assert.equal(plural(1, "tower"), "1 tower");
  assert.equal(plural(0, "tower"), "0 towers");
  assert.equal(plural(17, "tower"), "17 towers");
  assert.equal(plural(1, "earlier round"), "1 earlier round");
  assert.equal(plural(3, "new tower"), "3 new towers");

  assert.equal(pluralize(1, "share"), "share");
  assert.equal(pluralize(0.316, "share"), "shares", "fractional shares are plural");
  assert.equal(pluralize(2, "share"), "shares");
});

/**
 * The tower count must match what you can count by eye in the city.
 * Free holdings (zero cost) are drawn as bare land + a gold pile, not towers, so they mustn't count as towers.
 */
test("tower count equals towers actually standing in the city, not the number of holdings", () => {
  const state = baseCity();
  const t = totals(state);
  const standing = layoutCity(toStructures(state), ORDER).all.filter(
    (p) => p.structure.kind === "tower" && p.height > 0,
  ).length;

  assert.equal(t.towerCount, standing, "the sidebar must not contradict the city");
  assert.equal(t.landCount, 1, "GLD at zero cost = 1 plot of bare land");
  assert.equal(
    t.towerCount + t.landCount,
    state.holdings.length,
    "towers + land must cover every holding, none missing",
  );
});

test("a holding split into several towers counts as several, not one", () => {
  const big: CityState = {
    fxRate: 32, isDemo: false,
    holdings: [
      // ฿384,000 = 3 towers at the cap
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
 * The number the sidebar shows next to a district must be market value, not cost.
 * It used to show cost ฿300,000 while the real value was ฿330,000 — people read a bare number next to a district
 * as "what this district is worth", always.
 */
test("district market values add up to the whole city, and differ from cost", () => {
  const s = baseCity();
  const all = totals(s);
  const mission = totals(s, "mission");
  const gg = totals(s, "goldengoose");

  assert.ok(
    Math.abs(mission.marketValue + gg.marketValue - all.marketValue) < 0.01,
    "splitting by district and adding back must give the same total",
  );
  assert.ok(
    Math.abs(mission.invested + gg.invested - all.invested) < 0.01,
    "cost must add back up the same way",
  );
  assert.notEqual(all.marketValue, all.invested, "these two must not be the same number");

  // Cash isn't in any district, so it must not appear in district totals
  const withCash: CityState = { ...s, cash: { usd: 1000, thb: 50_000 } };
  assert.equal(totals(withCash).marketValue, all.marketValue, "cash must not leak into district value");
});

/* ── City wall = emergency fund ─────────────────── */

/**
 * Hard rule set by the owner: never add the emergency fund to portfolio totals.
 * The reasoning: "otherwise it would look like the goal was already reached".
 * ⇒ however much is added to the reserve, every city total must stay exactly the same.
 */
test("the reserve never flows into portfolio totals, tower heights, or tower count", () => {
  const before = baseCity();
  const after: CityState = {
    ...before,
    reserve: { amountTHB: 120_000, monthlyBurnTHB: 5_000 },
  };

  const t0 = totals(before);
  const t1 = totals(after);
  assert.equal(t1.invested, t0.invested, "money invested must not move");
  assert.equal(t1.marketValue, t0.marketValue, "portfolio value must not move");
  assert.equal(t1.towerCount, t0.towerCount, "tower count must not move");

  const p0 = portfolioSummary(before);
  const p1 = portfolioSummary(after);
  assert.equal(p1.marketTotal, p0.marketTotal, "whole-portfolio total must not move");
  assert.equal(p1.cash, p0.cash, "must not show up as cash waiting to be invested");

  const h0 = layoutCity(toStructures(before), ORDER).all.map((p) => p.height);
  const h1 = layoutCity(toStructures(after), ORDER).all.map((p) => p.height);
  assert.deepEqual(h1, h0, "every tower height must be exactly the same");

  // and it must not become a structure in the city
  assert.equal(
    toStructures(after).length,
    toStructures(before).length,
    "the wall is not a structure in the plan",
  );
});

test("the wall is measured in months, not baht — and never guesses without expenses", () => {
  assert.equal(reserveStatus(undefined).months, null);
  assert.equal(reserveStatus({ amountTHB: 120_000, monthlyBurnTHB: 0 }).months, null,
    "money but no known expenses = can't say how many months it covers");

  const s = reserveStatus({ amountTHB: 120_000, monthlyBurnTHB: 20_000 });
  assert.equal(s.months, 6);
  assert.equal(s.coverage, 1);
  assert.equal(s.gapTHB, 0);
  assert.ok(s.complete);

  // Same money but higher expenses = the wall really gets shorter, not a bug
  const pricier = reserveStatus({ amountTHB: 120_000, monthlyBurnTHB: 40_000 });
  assert.equal(pricier.months, 3);
  assert.equal(pricier.coverage, 0.5);
  assert.equal(pricier.gapTHB, 120_000);
});

test("the wall grows with money without ever shrinking, and stops at the target without overflowing", () => {
  let prev = -1;
  for (let amount = 0; amount <= 300_000; amount += 5_000) {
    const c = reserveStatus({ amountTHB: amount, monthlyBurnTHB: 20_000 }).coverage;
    assert.ok(c >= prev, `฿${amount}: the wall got shorter although money increased`);
    assert.ok(c <= 1, `฿${amount}: coverage ${c} exceeds 1`);
    prev = c;
  }
  assert.equal(prev, 1, "beyond the target it must stop at a full ring");
});

test("the wall ring really encloses the city, never covers tower plots, and is built back to front", () => {
  const layout = layoutCity(toStructures(baseCity()), ORDER, [CASH_ZONE]);
  const plots = new Set(layout.all.map((p) => `${p.gx},${p.gy}`));

  const full = wallRing(layout, 1);
  assert.ok(full.length > 8, `the ring must have many sections, got ${full.length}`);
  assert.ok(full.every((w) => w.built), "coverage 1 = every section built");
  for (const w of full) {
    assert.ok(!plots.has(`${w.gx},${w.gy}`), `wall covers a tower plot at ${w.gx},${w.gy}`);
  }
  assert.equal(full.filter((w) => w.corner).length, 4, "exactly 4 corner towers");

  assert.equal(wallRing(layout, 0).filter((w) => w.built).length, 0);

  // Half ring: built sections must be *behind* unbuilt ones → the gap is at the front, visible
  const half = wallRing(layout, 0.5);
  const builtDepth = half.filter((w) => w.built).map((w) => w.depth);
  const gapDepth = half.filter((w) => !w.built).map((w) => w.depth);
  assert.ok(
    Math.max(...gapDepth) > Math.max(...builtDepth),
    "the gap in the wall must be at the front, not hidden behind the city",
  );
});

test("the wall ring encloses everything on the map, including the cash site, not just the towers", () => {
  const state: CityState = { ...baseCity(), cash: { usd: 500, thb: 30_000 } };
  const layout = layoutCity(toStructures(state), ORDER, [CASH_ZONE]);

  const sites = layout.all.filter((p) => p.structure.kind === "site");
  assert.ok(sites.length > 0, "this test needs a cash site to mean anything");

  const ring = wallRing(layout, 1);
  const x0 = Math.min(...ring.map((w) => w.gx));
  const x1 = Math.max(...ring.map((w) => w.gx));
  const y0 = Math.min(...ring.map((w) => w.gy));
  const y1 = Math.max(...ring.map((w) => w.gy));

  // Every structure must be inside the ring — nothing left outside the wall
  for (const p of layout.all) {
    assert.ok(
      p.gx > x0 && p.gx < x1 && p.gy > y0 && p.gy < y1,
      `${p.structure.label} (${p.structure.kind}) is outside the wall`,
    );
  }
});

test("wall sections come out sorted by depth on every side, not in ring order", () => {
  const layout = layoutCity(toStructures(baseCity()), ORDER, [CASH_ZONE]);
  const ring = wallRing(layout, 1);

  for (let i = 1; i < ring.length; i++) {
    assert.ok(
      ring[i].depth >= ring[i - 1].depth,
      `section ${i} at depth ${ring[i].depth} comes after depth ${ring[i - 1].depth} = drawn in the wrong order`,
    );
  }

  // All four sides must really be there, not lost in the sort
  const sides = new Set(ring.map((w) => w.side));
  assert.equal(sides.size, 4, `expected all 4 sides, got ${[...sides].join(",")}`);
  assert.equal(ring.length, new Set(ring.map((w) => `${w.gx},${w.gy}`)).size,
    "no duplicate cells after sorting");
});

/**
 * Cars must not drive through the wall — once the wall encloses the whole map, several roads pass under it,
 * and if they aren't cut there, cars drive through the stone out of the city.
 */
test("cars can't drive through the wall — but can pass through the gate and unbuilt gaps", () => {
  const state: CityState = { ...baseCity(), cash: { usd: 300, thb: 20_000 } };
  const layout = layoutCity(toStructures(state), ORDER, [CASH_ZONE]);
  const wall = wallRing(layout, 1);

  const blocked = new Set(
    wall.filter((w) => w.built && !w.gate).map((w) => `${w.gx},${w.gy}`),
  );
  const cells = groundCells(layout, blocked);
  const lanes = computeLanes(cells);
  const roadAt = new Set(
    cells.filter((c) => c.kind === "road").map((c) => `${c.gx},${c.gy}`),
  );

  // Cells where the wall stands must no longer be road
  for (const key of blocked) {
    assert.ok(!roadAt.has(key), `cell ${key} is still road although the wall covers it`);
  }

  // and no car may pass through a cell with the wall on it
  const cars = cells.filter((c) => c.decor === "car");
  assert.ok(cars.length > 0, "need cars to check");
  for (const car of cars) {
    const route = carRoute(car, lanes.get(laneKey(car)));
    for (let step = 1; step <= route.cellsAhead; step++) {
      const gx = route.axis === "x" ? car.gx + route.dir * step : car.gx;
      const gy = route.axis === "y" ? car.gy + route.dir * step : car.gy;
      assert.ok(
        !blocked.has(`${gx},${gy}`),
        `car from ${car.gx},${car.gy} drives through the wall at ${gx},${gy}`,
      );
    }
  }

  // No decorations may appear under the wall
  for (const c of cells) {
    if (c.kind === "wall") assert.equal(c.decor, "none", `decoration under the wall at ${c.gx},${c.gy}`);
  }

  // The gate must stay open, not blocked
  const gate = wall.find((w) => w.gate);
  assert.ok(gate, "there must be a city gate");
  assert.ok(!blocked.has(`${gate!.gx},${gate!.gy}`), "the gate must not be blocked");
});

test("unbuilt wall sections don't block roads — a gap is a real gap", () => {
  const layout = layoutCity(toStructures(baseCity()), ORDER, [CASH_ZONE]);
  const half = wallRing(layout, 0.5);
  const blocked = new Set(
    half.filter((w) => w.built && !w.gate).map((w) => `${w.gx},${w.gy}`),
  );
  for (const open of half.filter((w) => !w.built)) {
    assert.ok(
      !blocked.has(`${open.gx},${open.gy}`),
      `unbuilt cell ${open.gx},${open.gy} shouldn't block anything`,
    );
  }
  assert.ok(blocked.size > 0 && blocked.size < half.length, "a half ring must block only part of it");
});

/** Outside the wall is outside the city — no cars or people there, only forest */
test("no cars or people outside the wall", () => {
  const state: CityState = { ...baseCity(), cash: { usd: 300, thb: 20_000 } };
  const layout = layoutCity(toStructures(state), ORDER, [CASH_ZONE]);
  const wall = wallRing(layout, 1);
  const b = wallBounds(layout)!;
  const blocked = new Set(
    wall.filter((w) => w.built && !w.gate).map((w) => `${w.gx},${w.gy}`),
  );
  const cells = groundCells(layout, blocked);

  const outside = cells.filter(
    (c) => c.gx <= b.x0 || c.gx >= b.x1 || c.gy <= b.y0 || c.gy >= b.y1,
  );
  assert.ok(outside.length > 0, "need some area outside the wall to check");

  for (const c of outside) {
    assert.ok(
      c.decor !== "car" && c.decor !== "person",
      `${c.decor} outside the wall at ${c.gx},${c.gy}`,
    );
  }

  // Outside must still feel alive like a forest, not completely empty
  assert.ok(
    outside.some((c) => c.decor === "tree" || c.decor === "bush"),
    "there should still be trees outside the wall",
  );

  // Inside must still have cars and people as before
  const inside = cells.filter(
    (c) => c.gx > b.x0 && c.gx < b.x1 && c.gy > b.y0 && c.gy < b.y1,
  );
  assert.ok(inside.some((c) => c.decor === "car"), "the city must still have cars");
  assert.ok(inside.some((c) => c.decor === "person"), "the city must still have people");
});

/* ── Wall: laying bricks / withdrawing ───────────────────────────────────────────────
 *
 * Why this whole suite exists: the wall is the one thing in the app meant to close the
 * "feedback gap", yet it used to have no feedback itself — add money and the months figure
 * moved a little, and that was it · these tests lock in that acting is visible.
 */

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (now: Date, n: number) => iso(new Date(now.getTime() - n * DAY));

test("laying bricks: adding to the reserve is recorded as an event and shows as new bricks", () => {
  const now = new Date("2026-09-01T09:00:00Z");
  const r0 = { amountTHB: 100_000, monthlyBurnTHB: 20_000 };

  const r1 = applyReserveEvent(r0, 4_000, now);
  assert.equal(r1.amountTHB, 104_000, "the balance must add the delta");
  assert.deepEqual(r1.history, [{ at: "2026-09-01", amountTHB: 4_000 }]);

  const s = reserveStatus(r1, now);
  assert.equal(s.recentAddTHB, 4_000);
  assert.equal(s.recentRounds, 1);
  assert.equal(s.rounds, 1);
  // The previous amount must roll back to before the bricks were laid, not today's
  assert.ok(s.priorCoverage < s.coverage, "previous coverage must be less than now");

  const layout = layoutCity(toStructures(baseCity()), ORDER, [CASH_ZONE]);
  const ring = wallRing(layout, s.coverage, s.priorCoverage);
  const fresh = ring.filter((w) => w.fresh);
  assert.ok(fresh.length > 0, "after a top-up there must be at least 1 new brick to see");
  assert.ok(fresh.every((w) => w.built), "new bricks must be built sections");
  assert.equal(ring.filter((w) => w.broken).length, 0, "laying only must not produce cracks");
});

test("withdrawing: the wall cracks — lost sections must differ from 'not built yet'", () => {
  const now = new Date("2026-09-01T09:00:00Z");
  const r0 = { amountTHB: 120_000, monthlyBurnTHB: 20_000 };

  const r1 = applyReserveEvent(r0, -40_000, now);
  assert.equal(r1.amountTHB, 80_000);
  assert.deepEqual(r1.history, [{ at: "2026-09-01", amountTHB: -40_000 }]);

  const s = reserveStatus(r1, now);
  assert.equal(s.recentWithdrawTHB, 40_000);
  assert.equal(s.recentAddTHB, 0);
  assert.equal(s.rounds, 0, "a withdrawal doesn't count as laying bricks");
  assert.ok(s.priorCoverage > s.coverage, "the wall must shrink compared with before the withdrawal");

  const layout = layoutCity(toStructures(baseCity()), ORDER, [CASH_ZONE]);
  const ring = wallRing(layout, s.coverage, s.priorCoverage);
  const broken = ring.filter((w) => w.broken);
  assert.ok(broken.length > 0, "a withdrawal must show cracks, not vanish silently");
  assert.ok(broken.every((w) => !w.built), "ruins must not count as built");
  assert.equal(ring.filter((w) => w.fresh).length, 0, "withdrawing only must not produce new bricks");

  // The wall used to be a full ring ⇒ every lost cell is "was safe and lost it"
  // no cell may become a bare footing (= never built), because that wouldn't be true
  assert.equal(
    ring.filter((w) => !w.built && !w.broken).length,
    0,
    "it was fully built, so no cell can be 'never built'",
  );
});

test("ruins and bare footings stay distinct when the wall wasn't complete at the time of withdrawal", () => {
  const now = new Date("2026-09-01T09:00:00Z");
  const layout = layoutCity(toStructures(baseCity()), ORDER, [CASH_ZONE]);

  // Built to 75%, then withdrawn down to 50% ⇒ all three states must appear in one ring
  const r = applyReserveEvent({ amountTHB: 90_000, monthlyBurnTHB: 20_000 }, -30_000, now);
  const s = reserveStatus(r, now);
  const ring = wallRing(layout, s.coverage, s.priorCoverage);

  const built = ring.filter((w) => w.built);
  const broken = ring.filter((w) => w.broken);
  const never = ring.filter((w) => !w.built && !w.broken);
  assert.ok(built.length > 0 && broken.length > 0 && never.length > 0,
    `expected all three states, got ${built.length}/${broken.length}/${never.length}`);
  assert.equal(built.length + broken.length + never.length, ring.length,
    "every section must be in exactly one state, never overlapping");

  /**
   * Ruins must be exactly where "there used to be a wall" — measured against the ring at the old coverage
   * (not by depth: the ring covers all four sides, so depth isn't in ring order).
   */
  const key = (w: { gx: number; gy: number }) => `${w.gx},${w.gy}`;
  const wasBuilt = new Set(
    wallRing(layout, s.priorCoverage).filter((w) => w.built).map(key),
  );
  assert.deepEqual(
    new Set([...built.map(key), ...broken.map(key)]),
    wasBuilt,
    "standing sections + ruins must equal exactly what was built before the withdrawal",
  );
  for (const w of never) {
    assert.ok(!wasBuilt.has(key(w)), `${key(w)} was built before, must not read as 'never built'`);
  }
});

test("correcting a mistyped amount must not create bricks or cracks", () => {
  const now = new Date("2026-09-01T09:00:00Z");
  // Typed ฿150,000 then corrected it to ฿120,000 — nobody actually withdrew a baht
  const corrected = { amountTHB: 120_000, monthlyBurnTHB: 20_000 };

  const s = reserveStatus(corrected, now);
  assert.equal(s.recentWithdrawTHB, 0, "a correction must not read as a withdrawal");
  assert.equal(s.recentAddTHB, 0);
  assert.equal(s.coverage, s.priorCoverage, "no events = a completely still wall");

  const layout = layoutCity(toStructures(baseCity()), ORDER, [CASH_ZONE]);
  const ring = wallRing(layout, s.coverage, s.priorCoverage);
  assert.equal(ring.filter((w) => w.fresh).length, 0);
  assert.equal(ring.filter((w) => w.broken).length, 0);
});

test("glowing bricks and cracks disappear on their own after the 7-day window", () => {
  const now = new Date("2026-09-01T09:00:00Z");
  const layout = layoutCity(toStructures(baseCity()), ORDER, [CASH_ZONE]);

  const old = {
    amountTHB: 104_000,
    monthlyBurnTHB: 20_000,
    history: [
      { at: daysAgo(now, 40), amountTHB: 100_000 },
      { at: daysAgo(now, 30), amountTHB: 4_000 },
    ],
  };
  const s = reserveStatus(old, now);
  assert.equal(s.recentAddTHB, 0, "old events must not count as recent");
  assert.equal(s.rounds, 2, "but the number of times acted must not be lost");
  assert.equal(s.coverage, s.priorCoverage);

  const ring = wallRing(layout, s.coverage, s.priorCoverage);
  assert.equal(ring.filter((w) => w.fresh || w.broken).length, 0);

  // Future dates (wrong clock / imported file) must not make the whole ring glow
  const future = {
    amountTHB: 120_000,
    monthlyBurnTHB: 20_000,
    history: [{ at: iso(new Date(now.getTime() + 10 * DAY)), amountTHB: 120_000 }],
  };
  assert.equal(reserveStatus(future, now).recentAddTHB, 0);
});

test("laying and withdrawing on the same day leaves two history entries, not netted away", () => {
  const now = new Date("2026-09-01T09:00:00Z");
  let r = applyReserveEvent({ amountTHB: 100_000, monthlyBurnTHB: 20_000 }, 5_000, now);
  r = applyReserveEvent(r, -5_000, now);

  assert.equal(r.amountTHB, 100_000, "balance is back where it was");
  assert.deepEqual(
    r.history,
    [
      { at: "2026-09-01", amountTHB: 5_000 },
      { at: "2026-09-01", amountTHB: -5_000 },
    ],
    "both events really happened and must not cancel out of history",
  );

  // But laying twice on the same day = one round, amounts summed (like a tower's DCA round)
  const twice = appendReserveEvent(
    [{ at: "2026-09-01", amountTHB: 4_000 }],
    { at: "2026-09-01", amountTHB: 1_000 },
  );
  assert.deepEqual(twice, [{ at: "2026-09-01", amountTHB: 5_000 }]);
});

test("withdrawing more than there is leaves zero, never negative, and the whole wall is gone", () => {
  const now = new Date("2026-09-01T09:00:00Z");
  const r = applyReserveEvent({ amountTHB: 30_000, monthlyBurnTHB: 20_000 }, -80_000, now);

  assert.equal(r.amountTHB, 0, "the reserve can't go negative");
  assert.deepEqual(r.history, [{ at: "2026-09-01", amountTHB: -30_000 }],
    "records only what could actually be withdrawn, not the amount requested");

  const s = reserveStatus(r, now);
  assert.equal(s.coverage, 0);
  assert.equal(s.months, 0);

  const layout = layoutCity(toStructures(baseCity()), ORDER, [CASH_ZONE]);
  const ring = wallRing(layout, s.coverage, s.priorCoverage);
  assert.equal(ring.filter((w) => w.built).length, 0, "not a single wall section left");
  assert.ok(ring.filter((w) => w.broken).length > 0, "but the ruins must show it used to exist");
});

test("laying bricks and withdrawing never touch any portfolio total, not even one baht", () => {
  const now = new Date("2026-09-01T09:00:00Z");
  const before = baseCity();
  const t0 = totals(before);
  const h0 = layoutCity(toStructures(before), ORDER).all.map((p) => p.height);

  // Run a full story: lay → lay → withdraw
  let reserve = applyReserveEvent(
    { amountTHB: 0, monthlyBurnTHB: 20_000 },
    100_000,
    now,
  );
  reserve = applyReserveEvent(reserve, 20_000, now);
  reserve = applyReserveEvent(reserve, -40_000, now);
  assert.equal(reserve.amountTHB, 80_000);

  const after: CityState = { ...before, reserve };
  const t1 = totals(after);
  assert.equal(t1.invested, t0.invested);
  assert.equal(t1.marketValue, t0.marketValue);
  assert.equal(t1.towerCount, t0.towerCount);
  assert.equal(portfolioSummary(after).cash, portfolioSummary(before).cash);
  assert.deepEqual(
    layoutCity(toStructures(after), ORDER).all.map((p) => p.height),
    h0,
    "every tower height must stay perfectly still throughout",
  );
  // and wall history must not show up in the towers' DCA rounds
  assert.equal(after.contributions, before.contributions);
});

test("new bricks go at the end of the wall, continuing the old ones, not inserted mid-ring", () => {
  const now = new Date("2026-09-01T09:00:00Z");
  const layout = layoutCity(toStructures(baseCity()), ORDER, [CASH_ZONE]);

  const r = applyReserveEvent({ amountTHB: 60_000, monthlyBurnTHB: 20_000 }, 30_000, now);
  const s = reserveStatus(r, now);
  const ring = wallRing(layout, s.coverage, s.priorCoverage);

  const fresh = ring.filter((w) => w.fresh);
  const oldBuilt = ring.filter((w) => w.built && !w.fresh);
  assert.ok(fresh.length > 0 && oldBuilt.length > 0);

  // The wall is built back to front ⇒ new bricks must always be "further forward" than the old ones
  assert.ok(
    Math.max(...fresh.map((w) => w.depth)) > Math.max(...oldBuilt.map((w) => w.depth)),
    "new bricks must continue at the front end of the wall, not appear in the middle of what's built",
  );
});

test("wall ruins don't block roads — a gap from a withdrawal is a real gap", () => {
  const now = new Date("2026-09-01T09:00:00Z");
  const layout = layoutCity(toStructures(baseCity()), ORDER, [CASH_ZONE]);

  const r = applyReserveEvent({ amountTHB: 120_000, monthlyBurnTHB: 20_000 }, -60_000, now);
  const s = reserveStatus(r, now);
  const ring = wallRing(layout, s.coverage, s.priorCoverage);

  // The road blocker uses the same condition as IsoCity: built and not a gate
  const blocked = new Set(
    ring.filter((w) => w.built && !w.gate).map((w) => `${w.gx},${w.gy}`),
  );
  for (const w of ring.filter((x) => x.broken)) {
    assert.ok(
      !blocked.has(`${w.gx},${w.gy}`),
      `ruins at ${w.gx},${w.gy} still block the road — a fallen wall must be passable`,
    );
  }
});

test("wall history survives save/load, including negative amounts", () => {
  const city: CityState = {
    ...baseCity(),
    reserve: {
      amountTHB: 80_000,
      monthlyBurnTHB: 20_000,
      history: [
        { at: "2026-08-01", amountTHB: 120_000 },
        { at: "2026-08-28", amountTHB: -40_000 },
      ],
    },
  };

  const round = parseCity(JSON.parse(JSON.stringify(city)));
  assert.ok(round);
  assert.deepEqual(
    round.reserve?.history,
    city.reserve?.history,
    "cracks (negative amounts) must not be clamped to 0 when read back",
  );
  assert.equal(round.reserve?.amountTHB, 80_000);
});

/* ── The camera stays still while viewing the past ────────────────────────────────────────── */

test("viewing the past doesn't move the camera — a smaller city sits in the same frame", () => {
  const today = baseCity();
  // Past: a single tower with much less money ⇒ a smaller city in every way
  const past: CityState = {
    ...today,
    holdings: [today.holdings[0]],
    cash: undefined,
  };

  const frame = (c: CityState) => {
    const layout = layoutCity(toStructures(c), ORDER, [CASH_ZONE]);
    return boundsWithWall(layout, wallRing(layout, 1));
  };

  const todayFrame = frame(today);
  const pastFrame = frame(past);

  // Before the fix: the camera aimed straight at the past city ⇒ a different frame from today = the picture jumps
  assert.notDeepEqual(pastFrame, todayFrame, "the past city really has a different frame (or this test proves nothing)");

  // After the fix: the camera aims at union(past, today), which must equal today's frame exactly
  const locked = unionBounds(pastFrame, todayFrame);
  assert.deepEqual(locked, todayFrame, "the frame while viewing the past must equal today's, not move a pixel");

  // and going back to "today" must give the same frame again ⇒ no jolt either way
  assert.deepEqual(frame(today), locked, "returning to today must not move the frame again");
});

test("a past city larger than today's must not be cropped by the camera", () => {
  // A real case: towers were sold, so today's city is smaller than the past one
  const past = baseCity();
  const today: CityState = { ...past, holdings: [past.holdings[0]], cash: undefined };

  const frame = (c: CityState) => {
    const layout = layoutCity(toStructures(c), ORDER, [CASH_ZONE]);
    return boundsWithWall(layout, wallRing(layout, 1));
  };

  const locked = unionBounds(frame(past), frame(today));
  const p = frame(past);
  assert.ok(locked.minX <= p.minX && locked.minY <= p.minY, "the frame must cover the past city's top-left corner");
  assert.ok(
    locked.minX + locked.width >= p.minX + p.width &&
      locked.minY + locked.height >= p.minY + p.height,
    "the frame must cover the past city's bottom-right corner — never crop a city that used to be bigger",
  );
});

test("merging frames: the result always covers both, and merging with itself changes nothing", () => {
  const a = { minX: 0, minY: 0, width: 100, height: 50 };
  const b = { minX: -20, minY: 10, width: 60, height: 100 };

  assert.deepEqual(unionBounds(a, a), a, "merging with itself must not move");
  assert.deepEqual(unionBounds(a, b), unionBounds(b, a), "order must not matter");
  assert.deepEqual(unionBounds(a, b), { minX: -20, minY: 0, width: 120, height: 110 });
});
