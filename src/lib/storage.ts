import type { CityState, Holding } from "./types";
import { demoCity } from "./demo";

const KEY = "ownership-visualizer:city:v1";
const BACKUP_KEY = "ownership-visualizer:city:v1:backup";

function isHolding(value: unknown): value is Holding {
  if (typeof value !== "object" || value === null) return false;
  const h = value as Record<string, unknown>;
  return (
    typeof h.id === "string" &&
    typeof h.ticker === "string" &&
    typeof h.shares === "number" &&
    typeof h.avgCost === "number" &&
    typeof h.currentPrice === "number" &&
    (h.currency === "USD" || h.currency === "THB") &&
    (h.district === "mission" || h.district === "goldengoose")
  );
}

/** รับ JSON ที่ไม่รู้ที่มา (localStorage เก่า / ไฟล์ import) แล้วคืน state ที่ใช้ได้จริง */
export function parseCity(raw: unknown): CityState | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.holdings)) return null;

  const holdings = obj.holdings.filter(isHolding).map((h) => ({
    ...h,
    name: typeof h.name === "string" ? h.name : h.ticker,
    costTHB:
      typeof h.costTHB === "number" && h.costTHB >= 0 ? h.costTHB : undefined,
  }));

  const fxRate = typeof obj.fxRate === "number" && obj.fxRate > 0 ? obj.fxRate : 33.3;

  const rawCash = obj.cash as { usd?: unknown; thb?: unknown } | undefined;
  const num = (v: unknown) => (typeof v === "number" && v >= 0 ? v : 0);
  const cash =
    rawCash && typeof rawCash === "object"
      ? { usd: num(rawCash.usd), thb: num(rawCash.thb) }
      : undefined;

  return {
    holdings,
    cash,
    fxRate,
    isDemo: obj.isDemo === true,
    pricesUpdatedAt:
      typeof obj.pricesUpdatedAt === "string" ? obj.pricesUpdatedAt : undefined,
  };
}

export function loadCity(): CityState {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return demoCity();
    const parsed = parseCity(JSON.parse(raw));
    return parsed ?? demoCity();
  } catch {
    // โหมดส่วนตัว / เบราว์เซอร์บล็อก site data — แอปต้องยังเปิดได้
    return demoCity();
  }
}

export function saveCity(state: CityState): void {
  try {
    // เมืองกำลังจะกลายเป็นว่างทั้งที่เคยมีตึก → เก็บสำเนาไว้ก่อนเขียนทับ
    // (เคยเจอ state ว่างถูกเขียนทับข้อมูลจริงมาแล้วตอน dev — ของหายถาวร)
    if (state.holdings.length === 0) {
      const prev = parseCity(JSON.parse(window.localStorage.getItem(KEY) ?? "null"));
      if (prev && prev.holdings.length > 0 && !prev.isDemo) {
        window.localStorage.setItem(BACKUP_KEY, JSON.stringify(prev));
      }
    }
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // เขียนไม่ได้ก็ปล่อย — ข้อมูลยังอยู่ในหน้าจนกว่าจะรีเฟรช
  }
}

/** เมืองจริงชุดล่าสุดก่อนถูกล้าง — null ถ้าไม่มีอะไรให้กู้ */
export function loadBackup(): CityState | null {
  try {
    const raw = window.localStorage.getItem(BACKUP_KEY);
    if (!raw) return null;
    const parsed = parseCity(JSON.parse(raw));
    return parsed && parsed.holdings.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function clearBackup(): void {
  try {
    window.localStorage.removeItem(BACKUP_KEY);
  } catch {
    // ไม่เป็นไร
  }
}

export function exportCity(state: CityState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ownership-city-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importCity(file: File): Promise<CityState | null> {
  try {
    return parseCity(JSON.parse(await file.text()));
  } catch {
    return null;
  }
}
