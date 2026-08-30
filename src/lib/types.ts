export type Currency = "USD" | "THB";

export type DistrictId = "mission" | "goldengoose";

/** หุ้น 1 ตัวที่ถืออยู่ — เก็บราคาต่อหุ้นเพราะเป็นเลขที่แอปโบรกโชว์ตรงๆ */
export type Holding = {
  id: string;
  ticker: string;
  name: string;
  shares: number;
  /** ต้นทุนเฉลี่ยต่อหุ้น ในสกุลของมันเอง — 0 ได้ (ของที่ได้มาฟรี) */
  avgCost: number;
  /** ราคาปัจจุบันต่อหุ้น ในสกุลของมันเอง */
  currentPrice: number;
  currency: Currency;
  district: DistrictId;
  /**
   * บาทที่จ่ายจริงตอนซื้อ (ทั้ง position) — ถ้ามี จะถูกใช้เป็น "เงินที่ลงไป" แทน
   *
   * ทำไมต้องมี: การเอาต้นทุน USD มาคูณค่าเงินวันนี้ ให้คำตอบคนละตัวกับ
   * บาทที่จ่ายไปจริง เพราะค่าเงินตอนแลกไม่เท่าวันนี้ (ต่างกันได้หลักหมื่นบาท)
   * และบาทคือสกุลที่ใช้วัดเป้าหมายจริง จึงต้องยอมให้บันทึกตัวเลขที่จ่ายจริงได้
   */
  costTHB?: number;
};

/**
 * เงินสดที่ยังไม่ได้ลงทุน — จงใจแยกจาก holdings เพราะมันยังไม่ใช่ความเป็นเจ้าของ
 * ห้ามนับรวมใน "เงินที่ลงไปแล้ว" ที่เป็นความสูงของเมือง
 */
export type Cash = {
  usd: number;
  thb: number;
};

export type CityState = {
  holdings: Holding[];
  cash?: Cash;
  /**
   * เงินเติมสะสม (บาท) — ทุกบาทที่โอนเข้าพอร์ตตั้งแต่ต้น รวมส่วนที่ยังไม่ได้ลงทุน
   *
   * ต่างจากต้นทุนหุ้น: ตัวนี้ไม่ขยับตอนซื้อ/ขาย ขยับเฉพาะตอนเติมเงินใหม่
   * ใช้เป็นตัวส่วนของผลตอบแทนรวมแบบเดียวกับในชีต
   * ⚠️ ห้ามเอาไปใช้เป็นความสูงของเมือง — ความสูงคือเงินที่กลายเป็นหุ้นแล้วเท่านั้น
   */
  deposits?: number;
  /** USD → THB */
  fxRate: number;
  /** true = เมืองตัวอย่าง ยังไม่ใช่พอร์ตจริง */
  isDemo: boolean;
  /**
   * เวลาที่ดึงราคาตลาดครั้งล่าสุด (ISO) — ไม่มี = ราคาเป็นค่าที่กรอกเอง
   * ต้องแสดงให้เห็นเสมอ ไม่งั้นราคาเก่าจะทำให้กำไร/ขาดทุนผิดแบบเงียบๆ
   */
  pricesUpdatedAt?: string;
};

/**
 * สิ่งปลูกสร้างแบบ generic ที่ renderer รู้จัก — จงใจไม่มีคำว่า "หุ้น" อยู่ในนี้
 * เพื่อให้ Kingdom เพิ่มกำแพง/ถนนได้โดยไม่ต้องรื้อ renderer
 */
export type Structure = {
  id: string;
  kind: StructureKind;
  label: string;
  sublabel: string;
  /** เงินที่ใส่เข้าไปจริง (THB) → ความสูง · โตทางเดียว ไม่ผูกกับราคาตลาด */
  invested: number;
  /** จำนวนชิ้นที่สะสม → เส้นแบ่งชั้น */
  units: number;
  /** สภาพ (กำไร/ขาดทุนเป็นสัดส่วน) → ความสว่างของไฟ · null = วัดไม่ได้ */
  health: number | null;
  /** ได้มาฟรี (ต้นทุน 0) — คิด % ไม่ได้ ไม่ใช่บั๊ก */
  isFree: boolean;
  district: string;
  /** มูลค่าตลาดตอนนี้ (THB) — ใช้โชว์ตัวเลข ไม่ใช้กำหนดขนาด */
  marketValue: number;
};

export type StructureKind = "tower" | "site";
// "site" = ไซต์ก่อสร้าง แทนเงินสดที่รอกลายเป็นตึก
// อนาคต (Kingdom): "wall" = เงินสำรอง · "road" = บิลจ่ายตรงเวลา · "district"

/** โซนของเงินสด — ไม่ใช่เขตของ holding จึงไม่อยู่ใน DistrictId */
export const CASH_ZONE = "cash";

export const DISTRICTS: Record<string, { label: string; note: string }> = {
  mission: {
    label: "Mission To The Moon",
    note: "เขตเติบโต — US growth",
  },
  goldengoose: {
    label: "Golden Goose",
    note: "เขตกระแสเงินสด — ปันผล",
  },
  [CASH_ZONE]: {
    label: "เงินสดรอลงทุน",
    note: "ไซต์ก่อสร้างนอกเมือง",
  },
};
