"use client";

import { formatPercent, formatTHB, totals } from "@/lib/portfolio";
import type { CityState, DistrictId } from "@/lib/types";
import { plural } from "@/lib/text";

export type CityView = "all" | DistrictId;

const NAV: { id: CityView; icon: string; label: string; note: string }[] = [
  { id: "all", icon: "🏙️", label: "Whole city", note: "All districts" },
  { id: "mission", icon: "🚀", label: "Mission", note: "Growth" },
  { id: "goldengoose", icon: "🪿", label: "Golden Goose", note: "Dividends" },
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
            My city
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
                {/*
                  แยกสองบรรทัด: ยอดเงินเป็นเลขที่ต้องอ่านได้เสมอ ห้ามโดนตัดท้าย
                  (บรรทัดเดียวยาวเกินความกว้าง sidebar แล้วกลายเป็น "฿34…")
                */}
                <span className="block truncate text-[10px] text-[var(--label-dim)]">
                  {plural(t.towerCount, "tower")}
                  {/* ของฟรีไม่มีตึก ต้องบอกแยก ไม่งั้นเลขจะไม่ตรงกับที่นับได้ในเมือง */}
                  {t.landCount > 0 && ` + ${plural(t.landCount, "plot")}`}
                </span>
                {/*
                  ⚠️ ต้องเป็น "มูลค่าตลาด" ไม่ใช่ต้นทุน — เลขลอยๆ ข้างชื่อเขต
                  คนอ่านว่า "เขตนี้มีค่าเท่าไหร่" เสมอ ไม่มีใครอ่านว่าต้นทุน
                  (เคยโชว์ต้นทุน ฿300,000 ทั้งที่มูลค่าจริง ฿330,000 — ต่างกัน ฿30,000)
                  ใส่ % กำกับด้วย จะได้ชัดว่าเป็นมูลค่า ไม่ใช่เงินที่ลงไป
                  ไม่รวมเงินสด ทั้ง 3 แถวจึงบวกกันได้ลงตัว (เงินสดมีการ์ดของตัวเอง)
                */}
                <span className="flex items-baseline gap-1.5 truncate font-mono text-[10.5px]">
                  <span className="text-[var(--label-dim)]">
                    {formatTHB(t.marketValue)}
                  </span>
                  {t.pnlRatio !== null && (
                    <span
                      style={{
                        color: t.pnlRatio >= 0 ? "var(--gain)" : "var(--loss)",
                      }}
                    >
                      {formatPercent(t.pnlRatio)}
                    </span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

    </aside>
  );
}
