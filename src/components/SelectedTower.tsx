"use client";

import {
  formatPercent,
  formatShares,
  formatTHB,
  investedTHB,
  isFreeHolding,
  marketValueTHB,
  pnlRatio,
  totals,
} from "@/lib/portfolio";
import { DISTRICTS, type CityState, type Holding } from "@/lib/types";

/** การ์ดสรุปตึกที่เลือกอยู่ — โผล่บนสุดของแผงขวาเมื่อคลิกตึกในเมือง */
export function SelectedTower({
  state,
  holding,
  onEdit,
  onRemove,
  onClose,
}: {
  state: CityState;
  holding: Holding;
  onEdit: (h: Holding) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}) {
  const invested = investedTHB(holding, state.fxRate);
  const market = marketValueTHB(holding, state.fxRate);
  const ratio = pnlRatio(holding);
  const free = isFreeHolding(holding);
  const cityInvested = totals(state).invested;
  const share = cityInvested > 0 ? invested / cityInvested : 0;
  const meta = DISTRICTS[holding.district];

  const tone = free
    ? "var(--free)"
    : (ratio ?? 0) >= 0
      ? "var(--gain)"
      : "var(--loss)";

  return (
    <section
      className="glow-panel rounded-xl bg-[var(--panel)] p-3"
      style={{ borderTop: `2px solid ${tone}` }}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] tracking-wide text-[var(--label-dim)] uppercase">
            ตึกที่เลือก
          </p>
          <div className="flex items-baseline gap-2">
            <h2 className="font-mono text-lg font-bold text-[var(--label)]">
              {holding.ticker}
            </h2>
            <span className="truncate text-[11px] text-[var(--label-dim)]">
              {holding.name}
            </span>
          </div>
          <p className="mt-0.5 text-[10px] text-[var(--label-dim)]">
            {meta?.label} · {holding.currency}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--label-dim)] transition hover:border-[var(--accent)] hover:text-[var(--label)]"
        >
          ปิด
        </button>
      </div>

      <div className="mt-2.5 rounded-lg border border-[var(--border)] bg-[var(--panel-raised)] p-2.5">
        <p className="text-[10px] text-[var(--label-dim)]">ความสูงของตึกนี้มาจาก</p>
        <p className="font-mono text-xl font-semibold text-[var(--label)]">
          {formatTHB(invested)}
        </p>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--input)]">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.max(2, share * 100).toFixed(1)}%`,
              background: "var(--accent)",
            }}
          />
        </div>
        <p className="mt-1 text-[10px] text-[var(--label-dim)]">
          {(share * 100).toFixed(1)}% ของทั้งเมือง
        </p>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
        <Row label="จำนวนชั้น" value={`${formatShares(holding.shares)} หุ้น`} />
        <Row
          label="ระดับไฟ"
          value={free ? "ของฟรี" : formatPercent(ratio)}
          color={tone}
        />
        <Row label="มูลค่าตลาด" value={formatTHB(market)} />
        <Row
          label="กำไร/ขาดทุน"
          value={`${market - invested >= 0 ? "+" : "−"}${formatTHB(Math.abs(market - invested)).slice(1)}`}
          color={tone}
        />
        <Row
          label="ต้นทุน/หุ้น"
          value={free ? "0 (ฟรี)" : `${holding.avgCost} ${holding.currency}`}
        />
        <Row
          label="ราคาตอนนี้"
          value={`${holding.currentPrice} ${holding.currency}`}
        />
      </dl>

      <div className="mt-2.5 flex gap-2">
        <button
          type="button"
          onClick={() => onEdit(holding)}
          className="flex-1 rounded-lg border border-[var(--border-bright)] px-3 py-1.5 text-xs text-[var(--label)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          แก้ไขตึกนี้
        </button>
        <button
          type="button"
          onClick={() => onRemove(holding.id)}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--loss)] transition hover:border-[var(--loss)]"
        >
          รื้อทิ้ง
        </button>
      </div>
    </section>
  );
}

function Row({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-[var(--label-dim)]">{label}</dt>
      <dd
        className="truncate font-mono text-[11px]"
        style={{ color: color ?? "var(--label)" }}
      >
        {value}
      </dd>
    </div>
  );
}
