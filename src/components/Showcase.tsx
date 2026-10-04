"use client";

import { useMemo, useState } from "react";
import { IsoCity } from "@/components/IsoCity";
import { demoCity } from "@/lib/demo";
import {
  formatPercent,
  formatTHB,
  investedTHB,
  isFreeHolding,
  marketValueTHB,
  pnlRatio,
  portfolioSummary,
  toStructures,
} from "@/lib/portfolio";
import { reserveStatus } from "@/lib/reserve";
import type { CityState } from "@/lib/types";

/**
 * หน้าโชว์สำหรับคนที่ไม่รู้จักแอป (recruiter ที่กดมาจาก portfolio)
 *
 * ⚠️ ใช้เมืองตัวอย่างเสมอ ไม่อ่าน localStorage เลย — เปิดบนเครื่องที่มีพอร์ตจริง
 * ก็ยังเห็นแค่ตัวเลขสมมติ หน้านี้จึงแชร์ลิงก์ได้โดยไม่มีทางหลุดพอร์ตจริง
 *
 * ทุกอย่างที่เป็นเครื่องมือ (ฟอร์ม/ราคา/ประวัติ/import) อยู่ที่หน้า `/` ตามเดิม
 * หน้านี้ตอบแค่คำถามเดียว: "นี่คืออะไร" — ให้ภาพเมืองเล่าเรื่อง ตัวหนังสือแค่กำกับ
 */
function showcaseCity(): CityState {
  return {
    ...demoCity(),
    // กำแพงก่อไม่ครบวง = เห็นช่องโหว่ด้านหน้า เล่าเรื่อง "เงินสำรองยังไม่ครบ" ได้ในภาพเดียว
    reserve: { amountTHB: 100_000, monthlyBurnTHB: 20_000 },
  };
}

export function Showcase() {
  const state = useMemo(showcaseCity, []);
  const structures = useMemo(() => toStructures(state), [state]);
  const summary = useMemo(() => portfolioSummary(state), [state]);
  const wall = reserveStatus(state.reserve);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = state.holdings.find((h) => h.id === selectedId) ?? null;

  /**
   * เมืองเต็มจอ แล้วให้หัว/ท้ายลอยทับ — ไม่แบ่งเป็นแถบ
   * ⚠️ เวอร์ชันแรกวางหัว/เมือง/ท้ายเรียงกัน ⇒ เห็นรอยต่อแนวนอน 2 เส้น
   * (ท้องฟ้าใน SVG กับพื้นหน้าเว็บสีไม่ตรงกัน) ภาพเลยดูเป็นกล่องในกล่อง
   */
  return (
    <main className="relative h-[100svh] min-h-[560px] overflow-hidden bg-[var(--sky-top)] text-[var(--label)]">
      <div className="absolute inset-0">
        <IsoCity
          structures={structures}
          wallCoverage={wall.coverage}
          wallPriorCoverage={wall.priorCoverage}
          selectedId={selectedId}
          onSelect={setSelectedId}
          controls={false}
          districtLabels={false}
          initialScale={0.8}
        />
      </div>

      <header
        className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-5 px-6 pt-7 pb-20 sm:px-10 md:flex-row md:items-start md:justify-between"
        style={{
          background:
            "linear-gradient(to bottom, var(--sky-top) 0%, rgba(6,11,20,0.75) 55%, rgba(6,11,20,0) 100%)",
        }}
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">City of Ownership</h1>
          <p className="mt-1.5 text-sm text-[var(--label-dim)]">
            A stock portfolio, drawn as a city.
          </p>
        </div>

        <dl className="flex gap-8 sm:gap-10">
          <Stat label="Portfolio" value={formatTHB(summary.marketTotal)} />
          <Stat
            label="Return"
            value={formatPercent(summary.totalReturn)}
            tone={summary.totalReturn !== null && summary.totalReturn < 0 ? "loss" : "gain"}
          />
          <Stat label="Holdings" value={String(state.holdings.length)} />
        </dl>
      </header>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 px-6 pt-20 pb-5 sm:px-10"
        style={{
          background:
            "linear-gradient(to top, var(--background) 0%, rgba(7,13,22,0.8) 45%, rgba(7,13,22,0) 100%)",
        }}
      >
        <div className="flex items-end justify-between gap-4">
          <Key />
          <div className="pointer-events-auto">
            {selected ? (
              <TowerCard
                ticker={selected.ticker}
                name={selected.name}
                invested={investedTHB(selected, state.fxRate)}
                value={marketValueTHB(selected, state.fxRate)}
                ret={isFreeHolding(selected) ? null : pnlRatio(selected)}
                onClose={() => setSelectedId(null)}
              />
            ) : (
              <p className="text-xs text-[var(--label-dim)]">Click any tower</p>
            )}
          </div>
        </div>

        <footer className="mt-5 flex flex-col gap-1.5 border-t border-[var(--border)]/60 pt-4 text-[11px] text-[var(--label-dim)] sm:flex-row sm:items-center sm:justify-between">
          <span>Sample portfolio — made-up numbers</span>
          <span className="pointer-events-auto">
            Built by John Wongprasittigul · Next.js, TypeScript, hand-drawn SVG ·{" "}
            <a
              href="https://github.com/Johnoo007/ownership-visualizer"
              target="_blank"
              rel="noreferrer"
              className="text-[var(--label)] underline-offset-4 hover:underline"
            >
              Source
            </a>
          </span>
        </footer>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "gain" | "loss";
}) {
  const color =
    tone === "gain" ? "text-[var(--gain)]" : tone === "loss" ? "text-[var(--loss)]" : "";
  return (
    <div>
      <dt className="text-[11px] text-[var(--label-dim)]">{label}</dt>
      <dd className={`mt-0.5 text-lg font-medium tabular-nums ${color}`}>{value}</dd>
    </div>
  );
}

/** คู่มือ 3 บรรทัด — เท่าที่ต้องรู้เพื่ออ่านภาพออก ที่เหลือให้กดตึกดูเอง */
function Key() {
  return (
    <ul className="hidden flex-col gap-1.5 text-xs text-[var(--label-dim)] sm:flex">
      <KeyRow swatch="#7b9fd4" tall>
        Height — money invested
      </KeyRow>
      <KeyRow swatch="#ffe9a8">Lit windows — in profit</KeyRow>
      <KeyRow swatch="#7a6d55">Wall — emergency fund</KeyRow>
    </ul>
  );
}

function KeyRow({
  swatch,
  tall,
  children,
}: {
  swatch: string;
  tall?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-2.5">
      <span
        className={`inline-block w-2 rounded-[1px] ${tall ? "h-3.5" : "h-2"}`}
        style={{ background: swatch }}
      />
      {children}
    </li>
  );
}

function TowerCard({
  ticker,
  name,
  invested,
  value,
  ret,
  onClose,
}: {
  ticker: string;
  name: string;
  invested: number;
  value: number;
  ret: number | null;
  onClose: () => void;
}) {
  const retColor =
    ret === null ? "text-[var(--free)]" : ret < 0 ? "text-[var(--loss)]" : "text-[var(--gain)]";

  return (
    <div className="w-60 rounded-lg border border-[var(--border)] bg-[var(--panel)]/90 p-4 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold">{ticker}</p>
          <p className="truncate text-xs text-[var(--label-dim)]">{name}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-[var(--label-dim)] transition hover:text-[var(--label)]"
        >
          ×
        </button>
      </div>
      <dl className="mt-3 space-y-1 text-xs">
        <Row label="Invested" value={formatTHB(invested)} />
        <Row label="Value now" value={formatTHB(value)} />
        <Row
          label="Return"
          value={ret === null ? "Free" : formatPercent(ret)}
          className={retColor}
        />
      </dl>
    </div>
  );
}

function Row({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex justify-between">
      <dt className="text-[var(--label-dim)]">{label}</dt>
      <dd className={`tabular-nums ${className}`}>{value}</dd>
    </div>
  );
}
