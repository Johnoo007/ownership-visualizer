"use client";

import { useState } from "react";
import { RECENT_DAYS, TARGET_MONTHS, reserveStatus } from "@/lib/reserve";
import { formatTHB } from "@/lib/portfolio";
import { plural } from "@/lib/text";
import type { CityState } from "@/lib/types";

/**
 * City wall = emergency fund.
 *
 * ⚠️ Deliberately separate from every portfolio total, and never shown as "another pile of wealth".
 * The main unit is **months**, not baht — the real question is "if income stopped tomorrow, how
 * long could I last?", not "how much have I saved?".
 *
 * 🧱 Money goes in/out through **buttons**, not by overwriting the total, because a total
 * can't tell a real withdrawal from a typo being fixed — and the latter must never crack
 * the wall. A field to correct the total still exists, but it's hidden and records no history.
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

          {/* Wall length bar — matches the share of the ring actually built in the city */}
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
        Lay bricks / withdraw — this field takes a *delta*, not a total.
        This is the wall's feedback channel: ฿4,000 barely moves the months figure,
        but "laid bricks again" always counts as one full step, and shows as new bricks on the wall.
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

      {/* What just happened to the wall — the counterpart of the towers' BuildLog */}
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
        Field to correct the total — hidden because it isn't the normal path.
        Left open, people would use it instead of the buttons and wall history would stay empty forever.
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

      {/* Rules that must be visible on screen, not buried in code */}
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
