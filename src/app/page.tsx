"use client";

import { useMemo, useRef, useState } from "react";
import { HoldingForm } from "@/components/HoldingForm";
import { HoldingList } from "@/components/HoldingList";
import { IsoCity } from "@/components/IsoCity";
import { BulkImport } from "@/components/BulkImport";
import { PriceSync } from "@/components/PriceSync";
import { SelectedTower } from "@/components/SelectedTower";
import { Sidebar, type CityView } from "@/components/Sidebar";
import { BuildLog } from "@/components/BuildLog";
import { StatsPanel } from "@/components/StatsPanel";
import { TimeMachine } from "@/components/TimeMachine";
import { useCity } from "@/components/useCity";
import { formatSnapshotDate, type Snapshot } from "@/lib/history";
import { toStructures } from "@/lib/portfolio";
import { exportCity, importCity } from "@/lib/storage";
import type { Holding } from "@/lib/types";

function Legend({
  color,
  label,
  dot,
}: {
  color: string;
  label: string;
  dot?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-[var(--label-dim)]">
      <span
        className={`h-2.5 w-2.5 shrink-0 ${dot ? "rounded-[1px]" : "rotate-45 rounded-[1px]"}`}
        style={{ background: color }}
      />
      {label}
    </div>
  );
}

export default function Home() {
  const {
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
  } = useCity();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Holding | null>(null);
  const [view, setView] = useState<CityView>("all");
  const [viewingPast, setViewingPast] = useState<Snapshot | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // เมืองที่วาดบนจอ = ภาพอดีตถ้ากำลังย้อนดู ไม่งั้นคือของวันนี้
  const displayState = viewingPast?.state ?? state;

  const structures = useMemo(() => {
    if (!displayState) return [];
    const all = toStructures(displayState);
    return view === "all" ? all : all.filter((s) => s.district === view);
  }, [displayState, view]);

  const selectedHolding =
    displayState?.holdings.find((h) => h.id === selectedId) ?? null;

  if (!state || !displayState) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-[var(--label-dim)]">กำลังโหลดเมือง…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col gap-3 p-3 lg:h-screen lg:flex-row lg:overflow-hidden">
      <Sidebar state={displayState} view={view} onViewChange={setView} />

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <header className="flex flex-wrap items-center gap-3">
          <div className="min-w-0">
            <p className="text-[10px] tracking-[0.18em] text-[var(--label-dim)] uppercase">
              City Overview
            </p>
            <h1 className="text-xl leading-tight font-semibold text-[var(--label)]">
              เมืองแห่งความเป็นเจ้าของ
            </h1>
          </div>

          {state.isDemo ? (
            <div className="ml-auto flex items-center gap-2 rounded-lg border border-[var(--warn-border)] bg-[var(--warn)] px-3 py-1.5 text-xs">
              <span className="font-medium text-[var(--warn-fg)]">
                โหมดตัวอย่าง — ตัวเลขสมมติ ไม่ใช่พอร์ตจริง
              </span>
              <button
                type="button"
                onClick={() => {
                  startFresh();
                  setSelectedId(null);
                  setView("all");
                }}
                className="rounded-md border border-[var(--warn-border)] px-2 py-1 font-medium text-[var(--warn-fg)] transition hover:bg-[var(--warn-border)]/30"
              >
                เริ่มพอร์ตจริง
              </button>
            </div>
          ) : (
            <div className="ml-auto flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-xs text-[var(--label-dim)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--gain)]" />
              พอร์ตจริงของคุณ
            </div>
          )}
        </header>

        {viewingPast && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--accent)] bg-[var(--accent)]/10 px-3 py-2 text-xs">
            <span className="font-medium text-[var(--accent)]">
              กำลังดูเมืองเมื่อ {formatSnapshotDate(viewingPast.at)} — แก้ไขไม่ได้
            </span>
            <button
              type="button"
              onClick={() => setViewingPast(null)}
              className="ml-auto rounded-md border border-[var(--accent)] px-2 py-1 font-medium text-[var(--accent)] transition hover:bg-[var(--accent)]/15"
            >
              กลับมาวันนี้
            </button>
          </div>
        )}

        <StatsPanel state={displayState} view={view} />

        <BuildLog state={displayState} />

        {backup && state.holdings.length === 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-xs">
            <span className="text-[var(--label)]">
              เมืองก่อนหน้ามี {backup.holdings.length} ตึก — กู้คืนได้
            </span>
            <button
              type="button"
              onClick={restoreBackup}
              className="ml-auto rounded-md border border-[var(--accent)] px-2 py-1 font-medium text-[var(--accent)] transition hover:bg-[var(--accent)]/10"
            >
              กู้คืนเมืองก่อนหน้า
            </button>
          </div>
        )}

        <div className="glow-panel relative h-[54vh] min-h-[340px] overflow-hidden rounded-xl bg-[var(--city-bg)] lg:h-auto lg:min-h-0 lg:flex-1">
          <div className="scanline pointer-events-none absolute inset-0 z-10" />
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
            <span className="rounded-md border border-[var(--border-bright)] bg-[var(--panel)]/85 px-2 py-1 text-[10px] tracking-[0.14em] text-[var(--label-dim)] uppercase">
              Live City Map
            </span>
          </div>

          <div className="absolute top-3 right-3 z-10 flex flex-col gap-1 rounded-lg border border-[var(--border-bright)] bg-[var(--panel)]/85 px-2.5 py-2">
            <Legend color="#7b9fd4" label="Mission — เติบโต" />
            <Legend color="#6fc49a" label="Golden Goose — ปันผล" />
            <Legend color="#f0cf7a" label="ได้มาฟรี — ที่ดินเปล่า" />
            <Legend color="#6ee7a5" label="ป้ายเขียว = กำไร" dot />
            <Legend color="#ff8f7d" label="ป้ายแดง = ขาดทุน" dot />
          </div>
          <IsoCity
            structures={structures}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
      </div>

      <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-[320px] lg:overflow-y-auto">
        {!viewingPast && <PriceSync state={state} onSynced={replaceCity} />}

        <TimeMachine
          state={state}
          viewingPast={viewingPast}
          onViewPast={(s) => {
            setViewingPast(s);
            setSelectedId(null);
            setEditing(null);
          }}
        />

        {selectedHolding && !editing && !viewingPast && (
          <SelectedTower
            state={state}
            holding={selectedHolding}
            onEdit={setEditing}
            onRemove={(id) => {
              removeHolding(id);
              setSelectedId(null);
            }}
            onClose={() => setSelectedId(null)}
          />
        )}

        <section
          className={`rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3 ${
            viewingPast ? "pointer-events-none opacity-40" : ""
          }`}
        >
          <h2 className="mb-2 text-[10px] font-semibold tracking-wide text-[var(--label-dim)] uppercase">
            {editing ? `แก้ไข ${editing.ticker}` : "สร้างตึกใหม่"}
          </h2>
          <HoldingForm
            editing={editing}
            onSubmit={(h) => {
              upsertHolding(h);
              setEditing(null);
              setSelectedId(h.id);
            }}
            onCancel={() => setEditing(null)}
          />
        </section>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)]">
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
            <h2 className="text-[10px] font-semibold tracking-wide text-[var(--label-dim)] uppercase">
              ตึกทั้งหมด
            </h2>
            <label className="ml-auto flex items-center gap-1.5 text-[10.5px] text-[var(--label-dim)]">
              USD→THB
              <input
                value={state.fxRate}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v) && v > 0) setFxRate(v);
                }}
                inputMode="decimal"
                className="w-14 rounded border border-[var(--border)] bg-[var(--input)] px-1.5 py-0.5 text-right font-mono text-[var(--label)]"
              />
            </label>
          </div>

          <HoldingList
            state={displayState}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onEdit={setEditing}
            onRemove={(id) => {
              removeHolding(id);
              if (selectedId === id) setSelectedId(null);
              if (editing?.id === id) setEditing(null);
            }}
          />
        </section>

        {!viewingPast && (
          <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3">
            <h2 className="text-[10px] font-semibold tracking-wide text-[var(--label-dim)] uppercase">
              เงินสดรอลงทุน
            </h2>
            <p className="mt-1 text-[10px] leading-relaxed text-[var(--label-dim)]">
              โผล่เป็นไซต์ก่อสร้างในเมือง · นับรวมในมูลค่าพอร์ต แต่ไม่นับเป็นความสูง
              เพราะยังไม่ได้เป็นเจ้าของอะไร
            </p>
            <label className="mt-2 block">
              <span className="text-[10.5px] tracking-wide text-[var(--label-dim)] uppercase">
                เงินเติมสะสม (฿)
              </span>
              <input
                value={state.deposits ?? ""}
                placeholder="ทุกบาทที่โอนเข้าพอร์ต"
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (e.target.value === "") setDeposits(0);
                  else if (Number.isFinite(v) && v >= 0) setDeposits(v);
                }}
                inputMode="decimal"
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-2 py-1.5 text-right font-mono text-sm text-[var(--label)] placeholder:text-left placeholder:font-sans placeholder:text-[10px] placeholder:text-[var(--label-dim)]/60"
              />
              <span className="text-[10px] text-[var(--label-dim)]">
                ใส่แล้ว % กำไรจะคิดแบบเดียวกับชีต
              </span>
            </label>

            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["usd", "thb"] as const).map((cur) => (
                <label key={cur} className="block">
                  <span className="text-[10.5px] tracking-wide text-[var(--label-dim)] uppercase">
                    {cur === "usd" ? "USD" : "บาท"}
                  </span>
                  <input
                    value={state.cash?.[cur] ?? 0}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v) && v >= 0) setCash(cur, v);
                    }}
                    inputMode="decimal"
                    className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-2 py-1.5 text-right font-mono text-sm text-[var(--label)]"
                  />
                </label>
              ))}
            </div>
          </section>
        )}

        {!viewingPast && (
          <BulkImport
            state={state}
            onImport={(holdings, replace) => {
              importHoldings(holdings, replace);
              setSelectedId(null);
              setEditing(null);
            }}
          />
        )}

        <div className="flex gap-2 pb-1">
          <button
            type="button"
            onClick={() => exportCity(state)}
            className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--label-dim)] transition hover:border-[var(--accent)] hover:text-[var(--label)]"
          >
            บันทึกเป็นไฟล์
          </button>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--label-dim)] transition hover:border-[var(--accent)] hover:text-[var(--label)]"
          >
            โหลดจากไฟล์
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const next = await importCity(file);
              if (next) {
                replaceCity(next);
                setSelectedId(null);
                setEditing(null);
              } else {
                alert("ไฟล์นี้อ่านไม่ได้ — ต้องเป็นไฟล์ที่ export จากแอปนี้");
              }
              e.target.value = "";
            }}
          />
        </div>
      </aside>
    </main>
  );
}
