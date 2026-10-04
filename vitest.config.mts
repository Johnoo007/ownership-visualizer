import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * เทสต์ส่วนใหญ่เป็น logic ล้วนและ import ด้วย path สัมพัทธ์ จึงไม่เคยต้องมีไฟล์นี้
 * แต่พอเริ่ม render component จริง (tests/wallRender.test.tsx) มันลากไฟล์ที่ใช้
 * alias `@/` ของ Next เข้ามาด้วย — vitest ไม่ได้อ่าน tsconfig paths ให้เอง
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
