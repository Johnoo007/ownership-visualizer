import type { CityState } from "./types";
import { totals } from "./portfolio";

const KEY = "ownership-visualizer:history:v1";
const MAX_SNAPSHOTS = 60;

export type Snapshot = {
  /** ISO ของตอนที่บันทึก */
  at: string;
  state: CityState;
};

export function loadHistory(): Snapshot[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s) =>
        s &&
        typeof s.at === "string" &&
        s.state &&
        Array.isArray(s.state.holdings),
    );
  } catch {
    return [];
  }
}

function save(list: Snapshot[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX_SNAPSHOTS)));
  } catch {
    // เขียนไม่ได้ก็ปล่อย ประวัติไม่ใช่ข้อมูลหลัก
  }
}

/** บันทึกภาพเมืองวันนี้ — วันเดียวกันทับของเดิม ไม่ให้ประวัติบวมจากการกดซ้ำ */
export function pushSnapshot(state: CityState): Snapshot[] {
  if (state.isDemo || state.holdings.length === 0) return loadHistory();

  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const list = loadHistory().filter((s) => s.at.slice(0, 10) !== today);

  list.push({ at: now, state: structuredClone(state) });
  list.sort((a, b) => a.at.localeCompare(b.at));
  save(list);
  return list;
}

export function clearHistory(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ไม่เป็นไร
  }
}

export type Growth = {
  investedDelta: number;
  /** ตึกที่เพิ่งขึ้นใหม่หลังจากภาพนั้น */
  newTowers: string[];
  /** ตึกที่สูงขึ้น (ลงเงินเพิ่ม) */
  grownTowers: string[];
  days: number;
};

/** เทียบเมืองวันนี้กับภาพในอดีต — วัดที่ "เงินที่ลงไป" ไม่ใช่มูลค่าตลาด */
export function compare(past: Snapshot, present: CityState): Growth {
  const pastTotals = totals(past.state);
  const nowTotals = totals(present);

  const pastByTicker = new Map(
    past.state.holdings.map((h) => [h.ticker, h.shares * h.avgCost]),
  );

  const newTowers: string[] = [];
  const grownTowers: string[] = [];

  for (const h of present.holdings) {
    const before = pastByTicker.get(h.ticker);
    const cost = h.shares * h.avgCost;
    if (before === undefined) newTowers.push(h.ticker);
    else if (cost > before + 0.01) grownTowers.push(h.ticker);
  }

  const days = Math.max(
    0,
    Math.round((Date.now() - Date.parse(past.at)) / 86_400_000),
  );

  return {
    investedDelta: nowTotals.invested - pastTotals.invested,
    newTowers,
    grownTowers,
    days,
  };
}

export function formatSnapshotDate(at: string): string {
  const d = new Date(at);
  return d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}
