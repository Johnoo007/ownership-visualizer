/**
 * "3 towers" / "1 tower" — ประกอบจำนวนกับคำนามให้ถูกพจน์
 *
 * ทำไมต้องมีตัวช่วย: ตอนแปล UI เป็นอังกฤษ เขียน `{n} towers` ตรงๆ ไว้ 13 จุด
 * แล้วเขต Golden Goose ที่มีตึกเดียวขึ้นว่า "1 towers" — John เห็นทันที
 * ภาษาไทยไม่มีพจน์ ความผิดแบบนี้จึงไม่มีทางเกิดในเวอร์ชันเดิม พอเปลี่ยนภาษา
 * เลยโผล่พร้อมกันทั้งแอป ⇒ รวมไว้ที่เดียว จะได้ไม่ต้องจำเป็นรายจุด
 *
 * เศษหุ้น (0.316) นับเป็นพหูพจน์ถูกต้องอยู่แล้ว เพราะเทียบ !== 1
 */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** เหมือน plural แต่ให้ข้อความจำนวนมาเอง (เช่นเลขที่ฟอร์แมตแล้ว) */
export function pluralize(count: number, one: string, many = `${one}s`): string {
  return count === 1 ? one : many;
}
