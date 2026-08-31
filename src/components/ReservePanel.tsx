"use client";

import { TARGET_MONTHS, reserveStatus } from "@/lib/reserve";
import { formatTHB } from "@/lib/portfolio";
import { plural } from "@/lib/text";
import type { CityState } from "@/lib/types";

/**
 * กำแพงเมือง = เงินสำรองฉุกเฉิน
 *
 * ⚠️ แผงนี้จงใจแยกออกจากทุกยอดของพอร์ต และไม่โชว์เป็น "อีกก้อนหนึ่งของความมั่งคั่ง"
 * หน่วยหลักคือ **เดือน** ไม่ใช่บาท เพราะคำถามจริงคือ "ถ้าพรุ่งนี้ไม่มีรายได้ อยู่ได้นานแค่ไหน"
 * ไม่ใช่ "มีเงินเก็บเท่าไหร่"
 */
export function ReservePanel({
  state,
  onChange,
}: {
  state: CityState;
  onChange: (field: "amountTHB" | "monthlyBurnTHB", value: number) => void;
}) {
  const s = reserveStatus(state.reserve);
  const pct = Math.round(s.coverage * 100);

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
        <span className="text-[10px] text-[var(--label-dim)]">
          emergency fund
        </span>
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

      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <Field
          label="Reserve (฿)"
          value={state.reserve?.amountTHB}
          placeholder="120000"
          onChange={(v) => onChange("amountTHB", v)}
        />
        <Field
          label="Spending / month (฿)"
          value={state.reserve?.monthlyBurnTHB}
          placeholder="5000"
          onChange={(v) => onChange("monthlyBurnTHB", v)}
        />
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
