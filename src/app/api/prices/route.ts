import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Quote = {
  price: number;
  currency: string;
  /** เวลาที่ตลาดบันทึกราคานี้ (ISO) — ไม่ใช่เวลาที่เราดึง */
  marketTime: string | null;
};

const YAHOO = "https://query1.finance.yahoo.com/v8/finance/chart";
const BATCH = 5;

async function fetchQuote(symbol: string): Promise<Quote | null> {
  try {
    const res = await fetch(
      `${YAHOO}/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
      {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      },
    );
    if (!res.ok) return null;

    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    if (typeof price !== "number" || !Number.isFinite(price)) return null;

    return {
      price,
      currency: typeof meta.currency === "string" ? meta.currency : "USD",
      marketTime:
        typeof meta.regularMarketTime === "number"
          ? new Date(meta.regularMarketTime * 1000).toISOString()
          : null,
    };
  } catch {
    return null;
  }
}

/**
 * ดึงราคาล่าสุดจาก Yahoo Finance
 *
 * ⚠️ เป็น endpoint สาธารณะที่ไม่มีสัญญาบริการ — ล่ม/เปลี่ยนรูปแบบได้ทุกเมื่อ
 * ตัวไหนดึงไม่ได้จะอยู่ใน failed แทนที่จะทำให้ทั้งชุดพัง และฝั่งหน้าเว็บ
 * ต้องคงราคาเดิมไว้ ไม่ใช่เขียนทับด้วยค่าว่าง
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbols = (searchParams.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 40);

  if (symbols.length === 0) {
    return NextResponse.json({ error: "symbols is required" }, { status: 400 });
  }

  const quotes: Record<string, Quote> = {};
  const failed: string[] = [];

  // ยิงทีละกลุ่ม กันโดนปฏิเสธเพราะยิงรัวเกินไป
  for (let i = 0; i < symbols.length; i += BATCH) {
    const chunk = symbols.slice(i, i + BATCH);
    const results = await Promise.all(chunk.map(fetchQuote));
    chunk.forEach((symbol, j) => {
      const q = results[j];
      if (q) quotes[symbol] = q;
      else failed.push(symbol);
    });
  }

  return NextResponse.json({
    quotes,
    failed,
    fetchedAt: new Date().toISOString(),
    source: "Yahoo Finance (unofficial) · ~15 min delayed",
  });
}
