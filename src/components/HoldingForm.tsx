"use client";

import { useEffect, useState } from "react";
import type { Currency, DistrictId, Holding } from "@/lib/types";

const BLANK = {
  ticker: "",
  name: "",
  shares: "",
  avgCost: "",
  currentPrice: "",
  costTHB: "",
  currency: "USD" as Currency,
  district: "mission" as DistrictId,
};

export function HoldingForm({
  editing,
  onSubmit,
  onCancel,
}: {
  editing: Holding | null;
  onSubmit: (h: Holding) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(BLANK);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the form whenever a different holding is opened for editing
    setForm(
      editing
        ? {
            ticker: editing.ticker,
            name: editing.name,
            shares: String(editing.shares),
            avgCost: String(editing.avgCost),
            currentPrice: String(editing.currentPrice),
            costTHB: editing.costTHB === undefined ? "" : String(editing.costTHB),
            currency: editing.currency,
            district: editing.district,
          }
        : BLANK,
    );
  }, [editing]);

  const shares = Number(form.shares);
  const avgCost = Number(form.avgCost);
  const currentPrice = Number(form.currentPrice);
  const valid =
    form.ticker.trim().length > 0 &&
    Number.isFinite(shares) &&
    shares > 0 &&
    Number.isFinite(avgCost) &&
    avgCost >= 0 &&
    Number.isFinite(currentPrice) &&
    currentPrice >= 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const ticker = form.ticker.trim().toUpperCase();
    const rawCostTHB = Number(form.costTHB);
    const costTHB =
      form.costTHB.trim() && Number.isFinite(rawCostTHB) && rawCostTHB >= 0
        ? rawCostTHB
        : undefined;

    onSubmit({
      id: editing?.id ?? `${ticker}-${Date.now()}`,
      ticker,
      name: form.name.trim() || ticker,
      shares,
      avgCost,
      currentPrice,
      currency: form.currency,
      district: form.district,
      ...(costTHB !== undefined ? { costTHB } : {}),
    });
    setForm(BLANK);
  }

  return (
    <form onSubmit={submit} className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <Field
          label="Ticker"
          value={form.ticker}
          onChange={(v) => setForm({ ...form, ticker: v })}
          placeholder="GOOGL"
        />
        <Field
          label="Company name"
          value={form.name}
          onChange={(v) => setForm({ ...form, name: v })}
          placeholder="Alphabet"
        />
      </div>

      <Field
        label="Shares (fractional ok)"
        value={form.shares}
        onChange={(v) => setForm({ ...form, shares: v })}
        placeholder="5.0234"
        inputMode="decimal"
      />

      <div className="grid grid-cols-2 gap-2">
        <Field
          label="Avg cost / share"
          value={form.avgCost}
          onChange={(v) => setForm({ ...form, avgCost: v })}
          placeholder="172"
          inputMode="decimal"
        />
        <Field
          label="Price now / share"
          value={form.currentPrice}
          onChange={(v) => setForm({ ...form, currentPrice: v })}
          placeholder="205"
          inputMode="decimal"
        />
      </div>

      <Field
        label="Actual baht paid"
        value={form.costTHB}
        onChange={(v) => setForm({ ...form, costTHB: v })}
        placeholder="optional · overrides FX"
        inputMode="decimal"
      />

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[10.5px] tracking-wide text-[var(--label-dim)] uppercase">
            Currency
          </span>
          <select
            value={form.currency}
            onChange={(e) =>
              setForm({ ...form, currency: e.target.value as Currency })
            }
            className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-2 py-1.5 text-sm text-[var(--label)]"
          >
            <option value="USD">USD</option>
            <option value="THB">THB</option>
          </select>
        </label>

        <label className="block">
          <span className="text-[10.5px] tracking-wide text-[var(--label-dim)] uppercase">
            District
          </span>
          <select
            value={form.district}
            onChange={(e) =>
              setForm({ ...form, district: e.target.value as DistrictId })
            }
            className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-2 py-1.5 text-sm text-[var(--label)]"
          >
            <option value="mission">Mission (growth)</option>
            <option value="goldengoose">Golden Goose (dividends)</option>
          </select>
        </label>
      </div>

      <div className="flex gap-2 pt-0.5">
        <button
          type="submit"
          disabled={!valid}
          className="flex-1 rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[var(--accent-fg)] transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          {editing ? "Save changes" : "Build tower"}
        </button>
        {editing && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--label-dim)]"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "decimal";
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-[10.5px] tracking-wide text-[var(--label-dim)] uppercase">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-2 py-1.5 text-sm text-[var(--label)] placeholder:text-[var(--label-dim)]/50"
      />
      {hint && <span className="text-[10px] text-[var(--label-dim)]">{hint}</span>}
    </label>
  );
}
