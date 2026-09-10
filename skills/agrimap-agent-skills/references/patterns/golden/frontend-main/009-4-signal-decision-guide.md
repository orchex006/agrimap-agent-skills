เลือกด้วยคำถามเดียว: **"ค่านี้มาจากไหน และไปไหน"**

| | `signal` | `computed` | `effect` |
|---|---|---|---|
| คืออะไร | source of truth | ค่าที่ *คำนวณจาก* signal อื่น | side effect เมื่อ signal เปลี่ยน |
| ใครเป็นคนเปลี่ยนค่า | โค้ดสั่ง `.set()/.update()` เอง | เปลี่ยนตาม dependency อัตโนมัติ | — (ไม่มีค่า มีแต่การกระทำ) |
| ต้นทุน | ถูก | ถูก (lazy + memoized) | **แพง** — รันทุกครั้งที่ dep เปลี่ยน |
| ความถี่ที่ควรใช้ | ตามจำนวน state จริง | **ใช้ได้อิสระ** — ยิ่งย้าย logic จาก template มาไว้นี่ยิ่งดี | **น้อยที่สุด** — ทางเลือกสุดท้าย |

### ใช้ `signal` เมื่อ
เป็นข้อมูลต้นทางที่โค้ดต้องเขียนทับเอง: ผล API, ค่าที่ผู้ใช้เลือก, สถานะ loading

```typescript
private readonly state = signal<XxxState>({ items: [], loading: false, error: null })
readonly selectedTab = signal<number>(0)
```

### ใช้ `computed` เมื่อ
ค่า *derive ได้* จาก signal อื่น — selector ใน store, การ filter/map/นับ, เงื่อนไขแสดงผล
`computed` เป็น lazy + memoized: คำนวณเฉพาะตอนถูกอ่านและ dep เปลี่ยนจริง
**มีกี่ตัวก็ได้ ไม่ใช่ภาระ performance** — ที่ห้ามคือ side effect ข้างใน (ต้อง pure)

```typescript
readonly items = computed(() => this.state().items)          // selector — pattern มาตรฐาน
readonly hasData = computed(() => this.items().length > 0)   // เงื่อนไขแสดงผล
readonly options = computed(() =>                             // แปลงรูปข้อมูล
  this.lut()['lut_organization_all_q']?.map(toOption) ?? [])

// ❌ ห้าม: side effect ใน computed
readonly bad = computed(() => { this.api.load(); return ... })
```

กฎง่าย ๆ: **ถ้าเผลอเขียน `effect` เพื่อเอาค่าไป `.set()` ใส่ signal อื่น → ที่ถูกคือ `computed`**

### กฎ state ที่ toggle / เขียนทับได้ — ห้ามใช้ `computed`

`computed` เป็น **read-only เสมอ** — มันคือ "ผลคำนวณ" ไม่ใช่ "state"
ถ้าค่านั้นต้องถูก toggle / set ทับโดยผู้ใช้หรือโค้ด แปลว่ามันคือ state → ต้องเป็น
`signal` หรือ `linkedSignal` ตั้งแต่แรก

**Anti-pattern ที่เคยเกิดจริงในทีม (ห้ามทำซ้ำ):**

```typescript
// ❌ ผิดตั้งแต่ต้น: เอา computed มาเป็น state ที่ต้อง toggle
readonly isOpen = computed(() => this.items().length > 0)
// → toggle ไม่ได้ เพราะ computed เป็น read-only

// ❌ แล้วแก้ด้วยท่าแปลก: สร้าง signal เงา + effect คอย copy ค่า
private readonly _isOpen = signal(false)
constructor() {
  effect(() => this._isOpen.set(this.items().length > 0))  // effect-copy = ออกแบบผิด
}
toggle() { this._isOpen.update((v) => !v) }
// → ได้ 2 sources of truth, effect ทับค่าที่ user toggle, ลำดับรันไม่การันตี
```

**ทางที่ถูก — เลือกตามธรรมชาติของค่า:**

```typescript
// เคส A: toggle ล้วน ๆ ไม่ derive จากใคร → signal ธรรมดา
readonly isOpen = signal<boolean>(false)
toggle(): void { this.isOpen.update((v) => !v) }

// เคส B: มีค่าตั้งต้น derive จาก signal อื่น แต่ user เขียนทับ/toggle ได้
//        → linkedSignal (Angular 19+): derive เป็น default, เขียนทับได้,
//          และ "reset กลับไปตาม source" อัตโนมัติเมื่อ source เปลี่ยน
readonly isOpen = linkedSignal(() => this.items().length > 0)
toggle(): void { this.isOpen.update((v) => !v) }

// เคส B แบบเก็บค่า user ไว้ข้าม source เปลี่ยน (เลือก item ในลิสต์ที่โหลดใหม่ได้)
readonly selected = linkedSignal<Item[], Item | undefined>({
  source: this.items,
  computation: (items, prev) =>
    items.find((i) => i.id === prev?.value?.id) ?? items[0],
})
```

ตารางตัดสินฉบับสมบูรณ์:

| ค่านั้น… | ใช้ |
|---|---|
| โค้ด/ผู้ใช้ set เองล้วน ๆ | `signal` |
| คำนวณจาก signal อื่น, ไม่มีใครเขียนทับ | `computed` |
| มี default จาก signal อื่น **และ** เขียนทับ/toggle ได้ | `linkedSignal` |
| ต้องพาออกไปนอกโลก signal (lib ภายนอก, DOM, storage) | `effect` |

> สัญญาณเตือนว่ากำลังเดินผิด: ถ้ามี `effect` ที่หน้าที่คือ **copy ค่าจาก signal หนึ่ง
> ไป `.set()` อีก signal หนึ่ง** — หยุดทันที คำตอบที่ถูกคือ `computed` (ถ้า read-only)
> หรือ `linkedSignal` (ถ้าเขียนทับได้)

### ใช้ `effect` เมื่อ (เท่านั้น)
ต้อง sync ค่าจาก signal ออกไป **นอกโลก signal** — DOM/third-party lib (map, chart),
`localStorage`, logging — และไม่มีวิธี declarative อื่นแล้ว

```typescript
constructor() {
  effect(() => {
    const groups = this.facade.layerGroups()
    this.mapInstance.setLayers(groups)   // imperative API ของ lib ภายนอก
  })
}
```

ข้อห้ามของ `effect`:
- ห้ามเขียน signal อื่นข้างใน (ถ้าต้องใช้ `allowSignalWrites` = ออกแบบผิด ให้เปลี่ยนเป็น `computed`)
- ห้ามมี business logic / HTTP อยู่ *ใน* effect — effect เป็นได้แค่ trigger บาง ๆ (ดูเคส 2)
- ห้ามใช้ใน Store (ขัด R3)
- ประกาศใน constructor / field initializer เท่านั้น (ต้องมี injection context)

### เคสจริงที่พบบ่อย — จับคู่โจทย์ → pattern ที่ถูก

agent ต้องเทียบโจทย์กับตารางนี้ก่อนเขียนโค้ดเสมอ ถ้าโจทย์ไม่ตรงเคสไหนเลย
ให้กลับไปใช้ตารางตัดสิน 4 ช่องด้านบน

| # | โจทย์ | ❌ ท่าผิดที่มักเห็น | ✅ pattern ที่ถูก |
|---|---|---|---|
| 1 | state toggle/เขียนทับได้ | `computed` + effect-copy | `signal` หรือ `linkedSignal` |
| 2 | โหลดข้อมูลใหม่เมื่อ `input()`/route เปลี่ยน | logic + HTTP ยัดใน effect | effect เป็น trigger บาง ๆ เรียก facade use case |
| 3 | เอาค่า `input()` มาแก้ไขต่อ (draft/form) | `ngOnChanges` + copy ใส่ตัวแปร | `linkedSignal(() => this.data())` |
| 4 | state ที่ parent-child แก้ได้ทั้งคู่ | `input()` + `output()` + สอง signal | `model()` — two-way signal ตัวเดียว |
| 5 | ค่าจาก RxJS stream มาแสดงผล | subscribe + `.set()` ใส่ signal | `toSignal(stream$, { initialValue })` |
| 6 | อ่าน signal ประกอบใน effect แต่ไม่อยากให้ re-run ตามมัน | ปล่อยให้ track ทุกตัว | ครอบด้วย `untracked(() => ...)` |

```typescript
// เคส 2 — โหลดข้อมูลเมื่อ input เปลี่ยน: effect เป็น "trigger" ได้อย่างเดียว
// logic ทั้งหมด (HTTP, แปลงข้อมูล, เขียน store, error) ต้องอยู่ใน facade ตาม R2/R4
readonly contentId = input.required<string>()
constructor() {
  effect(() => {
    const id = this.contentId()          // track แค่ตัว trigger
    untracked(() => this.facade.loadDetail(id))  // กัน signal อื่นใน use case ถูก track
  })
}

// เคส 3 — input → draft ที่แก้ไขได้ และ reset เองเมื่อ parent ส่งค่าใหม่
readonly user = input.required<User>()
readonly draftName = linkedSignal(() => this.user().name)
// ผู้ใช้พิมพ์แก้ draftName ได้อิสระ — parent เปลี่ยน user เมื่อไร draft reset ให้เอง

// เคส 4 — two-way ระหว่าง parent-child ใช้ model()
readonly visible = model<boolean>(false)     // child: this.visible.set(false)
// parent: <app-dialog [(visible)]="dialogVisible" />

// เคส 5 — RxJS → การแสดงผล: ห้าม subscribe แล้ว set — ใช้ toSignal
readonly currentUrl = toSignal(
  this.router.events.pipe(map(() => this.router.url)),
  { initialValue: this.router.url },
)

// เคส 6 — untracked: อ่านค่าประกอบโดยไม่ผูก dependency
effect(() => {
  const groups = this.facade.layerGroups()             // ตัวเดียวที่อยาก track
  const zoom = untracked(() => this.mapZoom())          // อ่านเฉย ๆ ไม่ track
  this.mapInstance.render(groups, zoom)
})
```

หลักที่ร้อยทุกเคส: **signal graph ต้อง declarative — ห้ามมี "ท่อ copy ค่า" ที่เขียนเอง**
เมื่อไรที่กำลังจะเขียน subscribe/effect เพื่อเอาค่าไป `.set()` ใส่ signal อื่น
ให้หยุดแล้วหา primitive ที่ตรงโจทย์: `computed` / `linkedSignal` / `toSignal` / `model`
มีเสมอ — effect ที่เหลืออยู่ในโค้ดควรเป็นแค่ 2 ชนิด: (ก) trigger บาง ๆ เรียก facade
(ข) พาค่าออกไปหา imperative API ภายนอก
