"use client";

import { useCallback, useEffect, useState } from "react";
import { emptyCity } from "@/lib/demo";
import { clearBackup, loadBackup, loadCity, saveCity } from "@/lib/storage";
import type { CityState, Holding } from "@/lib/types";

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
      return {
        ...prev,
        // แตะพอร์ตเมื่อไหร่ = เลิกเป็นเมืองตัวอย่างทันที
        isDemo: false,
        holdings: exists
          ? prev.holdings.map((h) => (h.id === holding.id ? holding : h))
          : [...prev.holdings, holding],
      };
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

  const replaceCity = useCallback((next: CityState) => {
    setState(next);
  }, []);

  const importHoldings = useCallback((incoming: Holding[], replace: boolean) => {
    setState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        isDemo: false,
        holdings: replace ? incoming : [...prev.holdings, ...incoming],
      };
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
    replaceCity,
    importHoldings,
    startFresh,
    restoreBackup,
  };
}
