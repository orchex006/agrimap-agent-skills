/*
 Typesafe Rules
 
 หลักการเดียวที่ครอบทุกข้อ: ประกาศ type ที่ "ขอบ" แล้วปล่อยให้ "ภายใน" 
 infer ขอบ = ตัวแปร/property, parameter, return type, generic 
 ของ signal/subject/http ภายใน = callback ใน pipe, 
 ตัวแปรใน computed, destructured result
*/

// T1 — Class member
class ExampleClass {
  // กำหนด type ด้วย value (infer จาก inject / literal)
  private readonly appService = inject(AppService)
  private temperatureC = -10
  readonly id = 50

  // ไม่มี initial value → ต้องประกาศ type
  date?: string

  // function กำหนด type ของ parameter และ return เสมอ
  showSummary(): void {
    console.log(`${this.date}: ${this.temperatureC}°C`)
  }

  private getTempF(data: number[]): number {
    return this.temperatureC * (9 / 5) + 32
  }
}