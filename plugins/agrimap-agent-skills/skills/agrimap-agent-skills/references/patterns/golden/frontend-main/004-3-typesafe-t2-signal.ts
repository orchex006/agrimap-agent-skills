// T2 — Signal
// ใช้ generic กำหนด type — ไม่ annotate ฝั่งซ้ายซ้ำ
private readonly count = signal<number>(0)
private readonly items = signal<Item[]>([])

// expose ออกนอกคลาสเป็น readonly Signal เสมอ — ห้าม expose WritableSignal
readonly countView: Signal<number> = this.count.asReadonly()

// computed ปล่อยให้ infer ได้ — ถ้า type ซับซ้อนให้ใส่ generic
readonly total = computed(() => this.items().length)
readonly options = computed<SelectOption[]>(() => /* ... */)