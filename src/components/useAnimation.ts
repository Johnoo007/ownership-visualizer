"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "ownership-visualizer:animate:v1";

/**
 * สวิตช์เปิด/ปิดความเคลื่อนไหวทั้งเมือง
 *
 * ค่าเริ่มต้นตามการตั้งค่าเครื่อง — ถ้าผู้ใช้ตั้ง "ลดการเคลื่อนไหว" ไว้
 * เมืองต้องนิ่งตั้งแต่แรกโดยไม่ต้องมากดปิดเอง
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
    setEnabled(initial);
    setReady(true);
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(KEY, next ? "1" : "0");
      } catch {
        // จำค่าไม่ได้ก็ไม่เป็นไร ยังใช้ได้ในรอบนี้
      }
      return next;
    });
  }, []);

  // ระหว่างยังอ่านค่าไม่เสร็จให้ถือว่าปิดไว้ก่อน กันภาพกระตุกตอนโหลด
  return { enabled: ready && enabled, toggle, ready };
}
