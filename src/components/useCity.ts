"use client";

import { useCallback, useEffect, useState } from "react";
import { emptyCity } from "@/lib/demo";
import { clearBackup, loadBackup, loadCity, saveCity } from "@/lib/storage";
import { appendContributions, detectContributions } from "@/lib/contributions";
import { applyReserveEvent } from "@/lib/reserve";
import type { CityState, Holding } from "@/lib/types";

/**
 * Whenever a holding's cost goes up, a new purchase was made → record it as a DCA round.
 *
 * Only used for manual edits / sheet imports, never for market price updates
 * (prices don't touch avgCost anyway, but this keeps history from growing for other reasons)
 */
function withContributions(prev: CityState, next: CityState): CityState {
  const added = detectContributions(prev, next);
  if (added.length === 0) return next;
  return { ...next, contributions: appendContributions(next.contributions, added) };
}

export function useCity() {
  const [state, setState] = useState<CityState | null>(null);
  const [backup, setBackup] = useState<CityState | null>(null);

  // Read only after mount — there's no localStorage on the server
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
        // Touching the portfolio means it's no longer the sample city
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

  /**
   * Set the wall numbers directly — **does not record history**.
   *
   * Used for the monthly burn and for fixing a mistyped amount. Correcting a number
   * is not a real-life event ⇒ it must never turn into new bricks or cracks.
   */
  const setReserve = useCallback(
    (field: "amountTHB" | "monthlyBurnTHB", value: number) => {
      setState((prev) =>
        prev
          ? {
              ...prev,
              isDemo: false,
              reserve: {
                amountTHB: 0,
                monthlyBurnTHB: 0,
                ...prev.reserve,
                [field]: value > 0 ? value : 0,
              },
            }
          : prev,
      );
    },
    [],
  );

  /** Lay bricks (+) / withdraw (−) — the only way wall history gets created */
  const adjustReserve = useCallback((deltaTHB: number) => {
    setState((prev) =>
      prev
        ? { ...prev, isDemo: false, reserve: applyReserveEvent(prev.reserve, deltaTHB) }
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
    setReserve,
    adjustReserve,
    setDeposits,
    replaceCity,
    importHoldings,
    startFresh,
    restoreBackup,
  };
}
