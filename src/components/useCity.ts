"use client";

import { useCallback, useEffect, useState } from "react";
import { emptyCity } from "@/lib/demo";
import { clearBackup, loadBackup, loadCity, saveCity } from "@/lib/storage";
import { appendContributions, detectContributions } from "@/lib/contributions";
import type { CityState, Holding } from "@/lib/types";

/**
 * ทุกครั้งที่ต้นทุนของตัวไหนเพิ่มขึ้น = John เพิ่งลงไม้ใหม่ → บันทึกเป็นไม้ DCA
 *
 * จงใจใช้เฉพาะตอนแก้พอร์ตด้วยมือ/นำเข้าจากชีต ไม่ใช้ตอนอัปเดตราคาตลาด
 * (ราคาไม่แตะ avgCost อยู่แล้ว แต่กันไว้ไม่ให้ประวัติงอกจากเหตุอื่น)
 */
function withContributions(prev: CityState, next: CityState): CityState {
  const added = detectContributions(prev, next);
  if (added.length === 0) return next;
  return { ...next, contributions: appendContributions(next.contributions, added) };
}

export function useCity() {
  const [state, setState] = useState<CityState | null>(null);
  const [backup, setBackup] = useState<CityState | null>(null);

  // อ่านหลัง mount เท่านั้น — localStorage ไม่มีบนเซิร์ฟเวอร์
  useEffect(() => {
    setState(loadCity());
    setBackup(loadBackup());
  }, []);

  useEffect(() => {
    if (!state) return;
    saveCity(state);
    if (state.holdings.length === 0) setBackup(loadBackup());
  }, [state]);

  const upsertHolding = useCallback((holding: Holding) => {
    setState((prev) => {
      if (!prev) return prev;
      const exists = prev.holdings.some((h) => h.id === holding.id);
      return withContributions(prev, {
        ...prev,
        // แตะพอร์ตเมื่อไหร่ = เลิกเป็นเมืองตัวอย่างทันที
        isDemo: false,
        holdings: exists
          ? prev.holdings.map((h) => (h.id === holding.id ? holding : h))
          : [...prev.holdings, holding],
      });
    });
  }, []);

  const removeHolding = useCallback((id: string) => {
    setState((prev) =>
      prev
        ? { ...prev, isDemo: false, holdings: prev.holdings.filter((h) => h.id !== id) }
        : prev,
    );
  }, []);

  const setFxRate = useCallback((fxRate: number) => {
    setState((prev) => (prev ? { ...prev, fxRate } : prev));
  }, []);

  const setDeposits = useCallback((amount: number) => {
    setState((prev) =>
      prev
        ? { ...prev, isDemo: false, deposits: amount > 0 ? amount : undefined }
        : prev,
    );
  }, []);

  const setCash = useCallback((currency: "usd" | "thb", amount: number) => {
    setState((prev) =>
      prev
        ? {
            ...prev,
            isDemo: false,
            cash: { usd: 0, thb: 0, ...prev.cash, [currency]: amount },
          }
        : prev,
    );
  }, []);

  const replaceCity = useCallback((next: CityState) => {
    setState(next);
  }, []);

  const importHoldings = useCallback((incoming: Holding[], replace: boolean) => {
    setState((prev) => {
      if (!prev) return prev;
      return withContributions(prev, {
        ...prev,
        isDemo: false,
        holdings: replace ? incoming : [...prev.holdings, ...incoming],
      });
    });
  }, []);

  const startFresh = useCallback(() => {
    setState(emptyCity());
  }, []);

  const restoreBackup = useCallback(() => {
    setState((prev) => {
      const b = loadBackup();
      if (!b) return prev;
      clearBackup();
      setBackup(null);
      return b;
    });
  }, []);

  return {
    state,
    backup,
    upsertHolding,
    removeHolding,
    setFxRate,
    setCash,
    setDeposits,
    replaceCity,
    importHoldings,
    startFresh,
    restoreBackup,
  };
}
