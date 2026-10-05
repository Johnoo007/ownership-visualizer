/**
 * Checks that the wall is actually *drawn*, not just computed correctly.
 *
 * ⚠️ This suite exists because of a real miss: a file edit silently failed to match, the
 * wall footings were never updated, and it was only caught by counting real DOM nodes (0).
 * ⇒ anything that must be visible on screen needs a test that counts it in the rendered output.
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

/** Count one kind of element in the markup */
const count = (svg: string, tag: string) =>
  (svg.match(new RegExp(`<${tag}\\b`, "g")) ?? []).length;

test("freshly laid bricks show scaffolding on screen, not just a value in state", () => {
  const still = draw(60_000, 0);
  const fresh = draw(60_000, 30_000);

  assert.equal(still.ring.filter((w) => w.fresh).length, 0);
  const freshCount = fresh.ring.filter((w) => w.fresh).length;
  assert.ok(freshCount > 0, "expected a freshly built section");

  // Scaffolding = 3 lines per section (2 poles + 1 beam) that the still wall doesn't have
  const added = count(fresh.svg, "line") - count(still.svg, "line");
  assert.ok(
    added >= freshCount * 3,
    `scaffolding missing from the drawing: only ${added} extra lines for ${freshCount} new sections`,
  );
  assert.ok(fresh.svg.includes("#c9a227"), "scaffolding must use the same gold as tower cranes");
});

test("cracks are drawn as rubble, not bare footings that look like an unbuilt section", () => {
  const cracked = draw(120_000, -40_000);
  const brokenCount = cracked.ring.filter((w) => w.broken).length;
  assert.ok(brokenCount > 0, "expected rubble");

  // polyline = crack · only rubble has them, nowhere else on the wall
  assert.equal(
    count(cracked.svg, "polyline"),
    brokenCount,
    "number of cracks on screen must equal the number of broken sections",
  );
  assert.ok(cracked.svg.includes("#ff8f7d"), "cracks must use the same colour as loss figures");

  // and rubble must not contain the "planned, waiting to build" dashed outline
  const stillNothing = draw(0, 0);
  assert.ok(
    stillNothing.svg.includes("stroke-dasharray"),
    "never-built sections must stay dashed (as before)",
  );
});

test("a still wall (no events) has neither scaffolding nor cracks", () => {
  const { svg } = draw(120_000, 0);
  assert.equal(count(svg, "polyline"), 0, "nothing happened, so no cracks");
  assert.ok(!svg.includes("#c9a227"), "nothing happened, so no scaffolding");
  assert.ok(svg.includes("<polygon"), "but the wall itself must still be there");
});
