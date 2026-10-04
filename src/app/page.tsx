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
import { plural } from "@/lib/text";
import { ReservePanel } from "@/components/ReservePanel";
import { reserveStatus } from "@/lib/reserve";

/** คู่มืออ่านเมือง — กดดูเมื่ออยากดู ไม่เกะกะตอนไม่ได้ใช้ */
function MapLegend() {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`rounded-md border px-2 py-1 text-[10px] tracking-[0.14em] uppercase transition ${
          open
            ? "border-[var(--accent)] bg-[var(--panel)] text-[var(--accent)]"
            : "border-[var(--border-bright)] bg-[var(--panel)]/85 text-[var(--label-dim)] hover:text-[var(--label)]"
        }`}
      >
        {open ? "Close" : "Legend"}
      </button>

      {open && (
        <div className="flex flex-col gap-1 rounded-lg border border-[var(--border-bright)] bg-[var(--panel)]/95 px-2.5 py-2">
          <Legend color="#7b9fd4" label="Mission — growth" />
          <Legend color="#6fc49a" label="Golden Goose — dividends" />
          <Legend color="#f0cf7a" label="Free — bare land" />
          <Legend color="#6ee7a5" label="Green sign = gain" dot />
          <Legend color="#ff8f7d" label="Red sign = loss" dot />
          <div className="mt-1 border-t border-[var(--border)] pt-1.5 text-[10px] leading-relaxed text-[var(--label-dim)]">
            Height = money in · Floors = shares
            <br />
            Lit windows = gain · Crane = added this week
            <br />
            Market down dims the lights, never shrinks a tower.
          </div>
        </div>
      )}
    </div>
  );
}

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
    setReserve,
    adjustReserve,
    setDeposits,
    replaceCity,
    importHoldings,
    startFresh,
    restoreBackup,
  } = useCity();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Holding | null>(null);
  const [formOpen, setFormOpen] = useState(true);
  const [view, setView] = useState<CityView>("all");
  const [viewingPast, setViewingPast] = useState<Snapshot | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  /**
   * กด Edit ที่ตึกไหนก็ตาม ต้องกางฟอร์มให้เสมอ
   * ไม่งั้นตอนย่อไว้อยู่ จะกดแล้วเหมือนแอปไม่ตอบสนอง (ฟอร์มถูกใส่ค่าแล้วแต่มองไม่เห็น)
   */
  const openEditor = (h: Holding) => {
    setEditing(h);
    setFormOpen(true);
  };

  // เมืองที่วาดบนจอ = ภาพอดีตถ้ากำลังย้อนดู ไม่งั้นคือของวันนี้
  const displayState = viewingPast?.state ?? state;

  const structures = useMemo(() => {
    if (!displayState) return [];
    const all = toStructures(displayState);
    return view === "all" ? all : all.filter((s) => s.district === view);
  }, [displayState, view]);

  /**
   * เมืองวันนี้ ใช้ตรึงกล้องตอนย้อนดูอดีต — ต้องกรองเขตแบบเดียวกับที่วาด
   * ไม่งั้นสลับเขตแล้วกล้องจะเล็งกรอบของทั้งเมือง (ซูมออกเกินจริง)
   */
  const cameraStructures = useMemo(() => {
    if (!viewingPast || !state) return undefined;
    const all = toStructures(state);
    return view === "all" ? all : all.filter((s) => s.district === view);
  }, [viewingPast, state, view]);

  const selectedHolding =
    displayState?.holdings.find((h) => h.id === selectedId) ?? null;

  /**
   * สถานะกำแพงของภาพที่กำลังดู — เมืองต้องรู้ทั้ง "ก่อถึงไหนแล้ว" และ
   * "เมื่อไม่กี่วันก่อนก่อถึงไหน" ถึงจะวาดอิฐใหม่กับรอยร้าวได้
   */
  const wall = reserveStatus(displayState?.reserve);

  if (!state || !displayState) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-[var(--label-dim)]">Loading the city…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col gap-3 p-3 lg:h-screen lg:flex-row lg:overflow-hidden">
      <Sidebar state={displayState} view={view} onViewChange={setView} />

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <header className="flex flex-wrap items-center gap-3">
          <h1 className="min-w-0 text-xl leading-tight font-semibold text-[var(--label)]">
            City of Ownership
          </h1>

          {state.isDemo ? (
            <div className="ml-auto flex items-center gap-2 rounded-lg border border-[var(--warn-border)] bg-[var(--warn)] px-3 py-1.5 text-xs">
              <span className="font-medium text-[var(--warn-fg)]">
                Sample mode — made-up numbers, not your real portfolio
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
                Start real portfolio
              </button>
            </div>
          ) : (
            <div className="ml-auto flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-xs text-[var(--label-dim)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--gain)]" />
              Your real portfolio
            </div>
          )}
        </header>

        <StatsPanel state={displayState} view={view} />

        <BuildLog state={displayState} />

        {backup && state.holdings.length === 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-xs">
            <span className="text-[var(--label)]">
              Previous city had {plural(backup.holdings.length, "tower")} — restorable
            </span>
            <button
              type="button"
              onClick={restoreBackup}
              className="ml-auto rounded-md border border-[var(--accent)] px-2 py-1 font-medium text-[var(--accent)] transition hover:bg-[var(--accent)]/10"
            >
              Restore previous city
            </button>
          </div>
        )}

        <div className="glow-panel relative h-[54vh] min-h-[340px] overflow-hidden rounded-xl bg-[var(--city-bg)] lg:h-auto lg:min-h-0 lg:flex-1">
          <div className="scanline pointer-events-none absolute inset-0 z-10" />
          {/*
            ป้ายบอกว่ากำลังดูอะไรอยู่ — ต้องเป็น *ป้ายลอยบนแผนที่* ไม่ใช่แถบในสายผัง
            ⚠️ เดิมแถบ "Viewing the city as of…" แทรกอยู่เหนือ StatsPanel ⇒ กดย้อนอดีต
            ทีไรแผนที่ถูกดันลง ~55px ทั้งแผง · กล้องนิ่งแล้วแต่ภาพยัง "ขยับ" อยู่ดี
            (John: *"อยากให้ภาพเมืองอยู่กับที่"*) ⇒ เอามาแทนที่ป้าย Live City Map
            ตรงมุมเดิม พื้นที่เท่ากันเป๊ะ แผนที่จึงไม่ขยับสักพิกเซล
          */}
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
            {viewingPast ? (
              <span className="flex items-center gap-2 rounded-md border border-[var(--accent)] bg-[var(--panel)]/95 px-2 py-1 text-[10px] tracking-[0.14em] text-[var(--accent)] uppercase">
                As of {formatSnapshotDate(viewingPast.at)} · read only
                <button
                  type="button"
                  onClick={() => setViewingPast(null)}
                  className="rounded border border-[var(--accent)] px-1.5 py-0.5 tracking-normal normal-case transition hover:bg-[var(--accent)]/15"
                >
                  Back to today
                </button>
              </span>
            ) : (
              <span className="rounded-md border border-[var(--border-bright)] bg-[var(--panel)]/85 px-2 py-1 text-[10px] tracking-[0.14em] text-[var(--label-dim)] uppercase">
                Live City Map
              </span>
            )}
          </div>

          {/*
            legend เดียวของทั้งแอป และปิดไว้เป็นค่าเริ่มต้น
            เดิมมีสองที่ (กล่องบนแผนที่ + รายการยาวใน sidebar) เนื้อหาซ้ำกัน
            และเป็นข้อความที่อ่านครั้งเดียวก็จำได้ ไม่ต้องกินพื้นที่ถาวร
          */}
          <MapLegend />
          <IsoCity
            structures={structures}
            wallCoverage={wall.coverage}
            wallPriorCoverage={wall.priorCoverage}
            cameraStructures={cameraStructures}
            cameraWallCoverage={reserveStatus(state?.reserve).coverage}
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
            onEdit={openEditor}
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
          {/*
            หัวข้อเป็นปุ่มย่อ/ขยาย — ฟอร์มนี้กินที่สุดใน sidebar แต่ใช้จริงแค่ตอน
            เพิ่ม/แก้ตึก · ย่อไว้แล้วรายการตึกกับกำแพงเลื่อนขึ้นมาอยู่ในสายตาแทน
          */}
          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            aria-expanded={formOpen}
            className="group flex w-full items-center gap-2 text-left"
          >
            <h2 className="text-[10px] font-semibold tracking-wide text-[var(--label-dim)] uppercase transition group-hover:text-[var(--label)]">
              {editing ? `Edit ${editing.ticker}` : "Build a new tower"}
            </h2>
            {/*
              ⚠️ เวอร์ชันแรกใช้ลูกศร ▾ หมุน 90° ขนาด 10px แล้ว**มองไม่เห็นเลย**
              (เหลือเป็นจุดจางๆ มุมขวา ไม่มีใครรู้ว่ากดได้) — ใช้กล่อง +/− แบบเดียวกับ
              ปุ่มซูมของแผนที่แทน เพราะเป็นภาษาที่แอปนี้มีอยู่แล้วและอ่านออกทุกขนาด
            */}
            <span
              className="ml-auto flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[var(--border)] text-[11px] leading-none text-[var(--label-dim)] transition group-hover:border-[var(--accent)] group-hover:text-[var(--accent)]"
              aria-hidden
            >
              {formOpen ? "−" : "+"}
            </span>
          </button>

          {/*
            ย่อ/กางแบบไหลลื่น ด้วยกริด 0fr → 1fr
            เหตุผลที่ไม่ใช้ max-height: ต้องเดาความสูงเผื่อไว้เสมอ พอเดาเกิน
            จังหวะปิดจะ "ค้างแล้ววูบ" เพราะช่วงแรกของ transition ไม่มีอะไรขยับ
            ส่วน 0fr→1fr เบราว์เซอร์คำนวณความสูงจริงให้ ⇒ ฟอร์มยาวแค่ไหนก็ลื่นเท่ากัน

            ⚠️ ฟอร์มยังอยู่ใน DOM ตอนย่อ (ต้องอยู่ ไม่งั้น animate ขาออกไม่ได้)
            จึงต้องมี `inert` กันไม่ให้ Tab หลุดเข้าไปในช่องที่มองไม่เห็น
            ผลพลอยได้: พิมพ์ค้างไว้แล้วเผลอย่อ ค่าที่กรอกไม่หาย
          */}
          <div
            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none ${
              formOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            }`}
            inert={!formOpen}
          >
            <div className="overflow-hidden">
              <div className="mt-2">
                <HoldingForm
                  editing={editing}
                  onSubmit={(h) => {
                    upsertHolding(h);
                    setEditing(null);
                    setSelectedId(h.id);
                  }}
                  onCancel={() => setEditing(null)}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)]">
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
            <h2 className="text-[10px] font-semibold tracking-wide text-[var(--label-dim)] uppercase">
              All towers
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
            onEdit={openEditor}
            onRemove={(id) => {
              removeHolding(id);
              if (selectedId === id) setSelectedId(null);
              if (editing?.id === id) setEditing(null);
            }}
          />
        </section>

        {!viewingPast && (
          <ReservePanel
            state={displayState}
            onChange={setReserve}
            onAdjust={adjustReserve}
          />
        )}

        {!viewingPast && (
          <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3">
            <h2 className="text-[10px] font-semibold tracking-wide text-[var(--label-dim)] uppercase">
              Cash on hand
            </h2>
            <p className="mt-1 text-[10px] leading-relaxed text-[var(--label-dim)]">
              Build sites in the city · counted in value, never in height
            </p>
            <label className="mt-2 block">
              <span className="text-[10.5px] tracking-wide text-[var(--label-dim)] uppercase">
                Total deposits (฿)
              </span>
              <input
                value={state.deposits ?? ""}
                placeholder="every baht transferred in"
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (e.target.value === "") setDeposits(0);
                  else if (Number.isFinite(v) && v >= 0) setDeposits(v);
                }}
                inputMode="decimal"
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-2 py-1.5 text-right font-mono text-sm text-[var(--label)] placeholder:text-left placeholder:font-sans placeholder:text-[10px] placeholder:text-[var(--label-dim)]/60"
              />
              <span className="text-[10px] text-[var(--label-dim)]">
                Used as the base for return %
              </span>
            </label>

            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["usd", "thb"] as const).map((cur) => (
                <label key={cur} className="block">
                  <span className="text-[10.5px] tracking-wide text-[var(--label-dim)] uppercase">
                    {cur === "usd" ? "USD" : "THB"}
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
            Save to file
          </button>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--label-dim)] transition hover:border-[var(--accent)] hover:text-[var(--label)]"
          >
            Load from file
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
                alert("Could not read this file — it must be a JSON exported from this app");
              }
              e.target.value = "";
            }}
          />
        </div>
      </aside>
    </main>
  );
}
