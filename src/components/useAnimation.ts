"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "ownership-visualizer:animate:v1";

/**
 * Motion on/off switch for the whole city.
 *
 * Defaults to the OS setting — if the user prefers reduced motion, the city
 * starts still without them having to turn it off.
 */
export function useAnimation() {
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let initial = true;
    try {
      const saved = window.localStorage.getItem(KEY);
      if (saved !== null) initial = saved === "1";
      else initial = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      initial = true;
    }
    // localStorage/matchMedia only exist in the browser, so read them after mount
    /* eslint-disable react-hooks/set-state-in-effect */
    setEnabled(initial);
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(KEY, next ? "1" : "0");
      } catch {
        // Can't persist the choice? Fine — it still applies for this session
      }
      return next;
    });
  }, []);

  // Treat it as off until the setting is read, so the first paint doesn't jitter
  return { enabled: ready && enabled, toggle, ready };
}
