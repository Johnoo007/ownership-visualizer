"use client";

import { formatTHB, totals } from "@/lib/portfolio";
import type { CityState, DistrictId } from "@/lib/types";

export type CityView = "all" | DistrictId;

const NAV: { id: CityView; icon: string; label: string; note: string }[] = [
  { id: "all", icon: "🏙️", label: "ทั้งเมือง", note: "ทุกเขตรวมกัน" },
  { id: "mission", icon: "🚀", label: "Mission", note: "เขตเติบโต" },
  { id: "goldengoose", icon: "🪿", label: "Golden Goose", note: "เขตปันผล" },
];

export function Sidebar({
  state,
  view,
  onViewChange,
}: {
  state: CityState;
  view: CityView;
  onViewChange: (v: CityView) => void;
}) {
  const all = totals(state);

  return (
    <aside className="flex w-full shrink-0 flex-row items-center gap-3 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3 lg:w-[200px] lg:flex-col lg:items-stretch lg:overflow-x-visible lg:overflow-y-auto">
      <div className="flex shrink-0 items-center gap-2.5 px-1 lg:pt-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-bright)] bg-[var(--panel-raised)] text-lg">
          🏙️
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--label)]">
            Ownership
          </p>
          <p className="truncate text-[10.5px] text-[var(--label-dim)]">
            เมืองของฉัน
          </p>
        </div>
      </div>

      <nav className="flex flex-row gap-1 lg:flex-col">
        {NAV.map((item) => {
          const active = view === item.id;
          const t =
            item.id === "all" ? all : totals(state, item.id as DistrictId);

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onViewChange(item.id)}
              className={`flex shrink-0 items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition ${
                active
                  ? "border-[var(--accent)] bg-[var(--accent)]/12"
                  : "border-transparent hover:border-[var(--border)] hover:bg-[var(--panel-hover)]"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-xs font-medium ${
                    active ? "text-[var(--accent)]" : "text-[var(--label)]"
                  }`}
                >
                  {item.label}
                </span>
                <span className="block truncate text-[10px] text-[var(--label-dim)]">
                  {t.towerCount} ตึก · {formatTHB(t.invested)}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      {/* คู่มืออ่านเมือง — ซ่อนบนจอแคบ ให้เหลือแต่ตัวสลับมุมมอง */}
      <div className="hidden lg:mt-auto lg:block lg:space-y-2">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-raised)] p-2.5">
          <p className="text-[10px] tracking-wide text-[var(--label-dim)] uppercase">
            อ่านเมืองยังไง
          </p>
          <ul className="mt-1.5 space-y-1 text-[10.5px] leading-relaxed text-[var(--label-dim)]">
            <li>
              <span className="text-[var(--label)]">ความสูง</span> = เงินที่ซื้อหุ้นแล้ว
            </li>
            <li>
              <span className="text-[var(--label)]">ไซต์ก่อสร้าง</span> = เงินสดที่รอลงทุน
            </li>
            <li>
              <span className="text-[var(--label)]">จำนวนชั้น</span> = จำนวนหุ้น
            </li>
            <li>
              <span className="text-[var(--gain)]">ป้ายเขียว</span> /{" "}
              <span className="text-[var(--loss)]">แดง</span> = กำไร/ขาดทุน
            </li>
            <li>
              <span className="text-[var(--label)]">ไฟหน้าต่าง</span> = ยิ่งกำไรยิ่งสว่าง
            </li>
            <li>
              <span style={{ color: "var(--free)" }}>แถบทอง + เครน</span> = เพิ่งเติมสัปดาห์นี้
            </li>
            <li>
              <span className="text-[var(--accent)]">คลิกตึก</span> = ดูไม้ DCA ของตัวนั้น
            </li>
          </ul>
          <p className="mt-2 border-t border-[var(--border)] pt-2 text-[10px] leading-relaxed text-[var(--label-dim)]">
            ตลาดแดง = ไฟหรี่ลง
            <br />
            แต่ตึกไม่มีวันหด
          </p>
        </div>

      </div>
    </aside>
  );
}
