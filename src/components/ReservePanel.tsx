"use client";

import { useState } from "react";
import { RECENT_DAYS, TARGET_MONTHS, reserveStatus } from "@/lib/reserve";
import { formatTHB } from "@/lib/portfolio";
import { plural } from "@/lib/text";
import type { CityState } from "@/lib/types";

/**
 * กำแพงเมือง = เงินสำรองฉุกเฉิน
 *
 * ⚠️ แผงนี้จงใจแยกออกจากทุกยอดของพอร์ต และไม่โชว์เป็น "อีกก้อนหนึ่งของความมั่งคั่ง"
 * หน่วยหลักคือ **เดือน** ไม่ใช่บาท เพราะคำถามจริงคือ "ถ้าพรุ่งนี้ไม่มีรายได้ อยู่ได้นานแค่ไหน"
 * ไม่ใช่ "มีเงินเก็บเท่าไหร่"
 *
 * 🧱 การขยับเงินเข้า/ออก ทำผ่าน **ปุ่ม** ไม่ใช่การพิมพ์ทับยอดรวม
 * เพราะยอดรวมแยกไม่ออกว่า "ถอนเงินจริง" หรือ "พิมพ์ผิดแล้วแก้" — และอย่างหลัง
 * ต้องไม่ทำให้กำแพงร้าว · ช่องแก้ยอดยังมีอยู่ แต่ซ่อนไว้และไม่บันทึกประวัติ
 */
export function ReservePanel({
  state,
  onChange,
  onAdjust,
}: {
  state: CityState;
  onChange: (field: "amountTHB" | "monthlyBurnTHB", value: number) => void;
  onAdjust: (deltaTHB: number) => void;
}) {
  const s = reserveStatus(state.reserve);
  const pct = Math.round(s.coverage * 100);
  const [amount, setAmount] = useState("");
  const [fixing, setFixing] = useState(false);

  const delta = Number(amount);
  const canMove = Number.isFinite(delta) && delta >= 1;

  const move = (sign: 1 | -1) => {
    if (!canMove) return;
    onAdjust(sign * delta);
    setAmount("");
  };

  const tone = s.complete
    ? "var(--gain)"
    : s.coverage >= 0.5
      ? "var(--free)"
      : "var(--loss)";

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[10px] font-semibold tracking-wide text-[var(--label-dim)] uppercase">
          City wall
        </h2>
        <span className="text-[10px] text-[var(--label-dim)]">emergency fund</span>
      </div>

      {s.months === null ? (
        <p className="mt-1.5 text-[11px] text-[var(--label-dim)]">
          Enter your monthly spending to see how many months the wall covers.
        </p>
      ) : (
        <>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold" style={{ color: tone }}>
              {s.months.toFixed(1)}
            </span>
            <span className="text-[11px] text-[var(--label-dim)]">
              {plural(TARGET_MONTHS, "month")} of cover is the goal
            </span>
          </div>

          {/* แถบความยาวกำแพง — ตรงกับสัดส่วนที่ก่อจริงในเมือง */}
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--input)]">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${Math.max(2, pct)}%`, background: tone }}
            />
          </div>

          <p className="mt-1 text-[10px] text-[var(--label-dim)]">
            {s.complete ? (
              <span style={{ color: "var(--gain)" }}>
                ✓ The wall is closed — the city is covered for {TARGET_MONTHS} months
              </span>
            ) : (
              <>
                {pct}% built ·{" "}
                <span className="text-[var(--label)]">{formatTHB(s.gapTHB)}</span> left
                to close the gap
              </>
            )}
          </p>
        </>
      )}

      {/*
        ก่ออิฐ / ถอน — ช่องนี้รับ *ส่วนต่าง* ไม่ใช่ยอดรวม
        นี่คือช่องทาง feedback ของกำแพง: ฿4,000 ขยับตัวเลขเดือนแค่นิดเดียวเสมอ
        แต่ "ก่ออิฐอีกครั้ง" เป็น 1 เต็มเสมอ และเห็นเป็นอิฐใหม่บนกำแพงจริง
      */}
      <div className="mt-2.5 flex gap-1.5">
        <input
          type="number"
          min={0}
          value={amount}
          placeholder="amount ฿"
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") move(1);
          }}
          className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2.5 py-1.5 text-right font-mono text-xs text-[var(--label)] outline-none placeholder:text-left placeholder:font-sans placeholder:text-[10px] placeholder:text-[var(--label-dim)]/60 focus:border-[var(--accent)]"
        />
        <button
          type="button"
          disabled={!canMove}
          onClick={() => move(1)}
          className="rounded-lg border border-[var(--gain)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--gain)] transition hover:bg-[var(--gain)]/10 disabled:cursor-not-allowed disabled:border-[var(--border)] disabled:text-[var(--label-dim)]"
        >
          🧱 Lay
        </button>
        <button
          type="button"
          disabled={!canMove || s.amountTHB <= 0}
          onClick={() => move(-1)}
          className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--label-dim)] transition hover:border-[var(--loss)] hover:text-[var(--loss)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Take out
        </button>
      </div>

      {/* เรื่องที่เพิ่งเกิดกับกำแพง — คู่กับ BuildLog ของตึก */}
      {(s.recentAddTHB > 0 || s.recentWithdrawTHB > 0) && (
        <p className="mt-1.5 text-[10px] leading-relaxed">
          {s.recentWithdrawTHB > 0 && (
            <span style={{ color: "var(--loss)" }}>
              ⚡ The wall is breached — {formatTHB(s.recentWithdrawTHB)} taken out in
              the last {RECENT_DAYS} days
              <br />
            </span>
          )}
          {s.recentAddTHB > 0 && (
            <span style={{ color: "var(--gain)" }}>
              🧱 Fresh brick — {formatTHB(s.recentAddTHB)} laid in{" "}
              {plural(s.recentRounds, "round")} this week
            </span>
          )}
        </p>
      )}

      {s.rounds > 0 && (
        <p className="mt-1 text-[10px] text-[var(--label-dim)]">
          You have laid brick {plural(s.rounds, "time")} · total{" "}
          <span className="text-[var(--label)]">{formatTHB(s.amountTHB)}</span> standing
        </p>
      )}

      <div className="mt-2.5">
        <Field
          label="Spending / month (฿)"
          value={state.reserve?.monthlyBurnTHB}
          placeholder="5000"
          onChange={(v) => onChange("monthlyBurnTHB", v)}
        />
      </div>

      {/*
        ช่องแก้ยอดให้ถูก — ซ่อนไว้เพราะมันไม่ใช่ทางปกติ
        เปิดไว้ตลอดเมื่อไหร่ คนจะใช้มันแทนปุ่ม แล้วประวัติกำแพงจะว่างเปล่าตลอดกาล
      */}
      <div className="mt-2 border-t border-[var(--border)] pt-2">
        {fixing ? (
          <Field
            label="Correct the balance (no record)"
            value={state.reserve?.amountTHB}
            placeholder="120000"
            onChange={(v) => onChange("amountTHB", v)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setFixing(true)}
            className="text-[10px] text-[var(--label-dim)] underline decoration-dotted underline-offset-2 transition hover:text-[var(--label)]"
          >
            Balance wrong? Correct it without recording a move
          </button>
        )}
      </div>

      {/* กฎที่ต้องเห็นบนหน้าจอ ไม่ใช่ซ่อนไว้ในโค้ด */}
      <p className="mt-2 border-t border-[var(--border)] pt-2 text-[10px] leading-relaxed text-[var(--label-dim)]">
        Never counted in portfolio value or tower height — a wall does not make the
        city bigger, it keeps it standing.
      </p>
    </section>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: number | undefined;
  placeholder: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] tracking-wide text-[var(--label-dim)] uppercase">
        {label}
      </span>
      <input
        type="number"
        min={0}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-2.5 py-1.5 text-right font-mono text-xs text-[var(--label)] outline-none focus:border-[var(--accent)]"
      />
    </label>
  );
}
