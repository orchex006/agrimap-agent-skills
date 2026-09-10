## Architecture Rules — Layered Facade Pattern

Dependency direction (ทางเดียวเท่านั้น):

```
Component (features/, shared/)
        │  inject Facade เท่านั้น
        ▼
Facade  (domain/xxx.facade.ts)  ← จุดเดียวที่ orchestrate
        │                    │
        ▼                    ▼
Store (signal state)   Generated API (HTTP)
```

### R1 — Component เข้าถึงได้แค่ Facade

Component ห้าม inject Store (`*Store`) หรือ generated API client (`Agmws*Api`) ตรง
อ่าน state ผ่าน Facade selectors, สั่งงานผ่าน Facade use case เท่านั้น

```typescript
// ❌ private store = inject(MapViewerStore)
// ❌ private api = inject(AgmwsDataManagementApi)
// ✅ private readonly facade = inject(MapViewerFacade)
```

> หมายเหตุ: การใส่ `Store` ใน `providers: [...]` ของ component ไม่ผิด (Facade ต้องใช้)
> ที่ห้ามคือการ *inject มาเรียกตรง*

**เพราะ:**
- **ห้ามเรียก API ตรง** — ถ้า component ยิง API เอง การแปลงข้อมูล (`convertToCamel`),
  error handling, และ loading state จะถูกเขียนซ้ำกระจายทุกหน้า พอ API เปลี่ยน spec
  ต้องไล่แก้ทุก component แทนที่จะแก้ facade จุดเดียว และ unit test ต้อง mock HTTP
  แทนที่จะ mock facade ตัวเดียว
- **ห้ามเรียก Store ตรง** — ถ้า component เขียน store เองได้ จะมี "คนเขียน state"
  สองทาง (facade + component) ตามหาไม่ได้ว่า state เปลี่ยนจากไหน — flow ต้องอ่านได้
  ทางเดียวเสมอ: component → facade → store

**Detect:** grep `inject\(\w+Store\)` และ `inject\(Agmws\w+Api\)` ใน `src/app/features`
และ `src/app/shared` — เจอ = violation

### R2 — Facade คือ orchestrator เดียว

Facade เป็นเจ้าของ use case ครบวงจร: เรียก API → แปลงข้อมูล (`convertToCamel`) →
เขียนผลลง Store → จัดการ error (`AppService.showError`)

Facade expose แค่ 2 อย่าง:
- **Selectors** — readonly `Signal<T>` ที่ re-export จาก Store
- **Use cases** — method คืน `void` (fire-and-forget) หรือ `Observable<T>`
  (เมื่อ caller ต้องรอผลเพื่อทำ UI follow-up)

### R3 — Store คือ pure state

Store มีได้แค่: private `signal<State>`, `computed` selectors, mutator แบบ synchronous
ห้าม inject service/API, ห้าม `.subscribe()`, ห้าม async logic ทุกชนิด
(รวมถึง `firstValueFrom` / `await` / `effect`)

**เพราะ:**
- **ห้าม async** — mutator แบบ synchronous การันตีว่า "เรียกแล้ว state เปลี่ยนทันที
  จบในบรรทัดนั้น" เทสได้โดยไม่ต้อง mock เวลา/network ถ้ามี async ใน store
  จะเกิด race condition ที่ตามไม่ได้ (สอง mutation แข่งกันเขียน) และไล่ debug
  ไม่ได้ว่า state ค้างเพราะใคร
- **ห้าม inject API** — วินาทีที่ store รู้จัก API มันจะกลายเป็น orchestrator ตัวที่สอง
  แข่งกับ facade (ขัด R2) — โปรเจกต์จะมีสองที่ที่ยิง HTTP ได้ และ error handling
  จะแตกเป็นสองมาตรฐานทันที store ที่ pure ยัง reuse ได้กับหลาย facade
  โดยไม่ลาก dependency ของ HTTP ตามไปด้วย

**Store มีมากกว่า 1 state signal ได้** — ไม่จำเป็นต้องยัดทุกอย่างใน object เดียว
แยกเมื่อ lifecycle ต่างกัน (เปลี่ยนคนละจังหวะ) เพื่อลด re-render ที่ไม่เกี่ยวข้อง:

```typescript
// ✅ ของจริงจาก MapViewerStore — 3 signals แยกตามจังหวะการเปลี่ยน
private readonly loadingStates = signal<string[]>([])
private readonly errorState = signal<string | null>(null)
private readonly layerGroupState = signal<LayerGroupConfig[]>([])

// ✅ หรือรวมเป็น state object เดียว (DataWarehouseStore) ก็ได้ ถ้าเปลี่ยนพร้อมกันเสมอ
private readonly state = signal<DataWarehouseState>({ items: [], loading: false, error: null })
```

เกณฑ์เลือก: field ที่เปลี่ยนพร้อมกันเสมอ → รวม object เดียว (mutation อัปเดตทีเดียว
ไม่มี state ครึ่ง ๆ กลาง ๆ) · field ที่เปลี่ยนอิสระ → แยก signal

**Detect:** grep `subscribe|firstValueFrom|await|inject\(|effect\(` ใน
`src/app/domain/**/*.store.ts` — ต้องว่าง

### R4 — Side effect อยู่ที่ Facade / Component ห้าม subscribe เพื่อรับ data

HTTP call, การเขียน state, และ user notification (toast/error) เกิดใน Facade เท่านั้น

**Component ห้าม subscribe เพื่อ "รับข้อมูลมาแสดง"** — data ทั้งหมดไหลเข้า UI
ทาง signal (facade selectors) ทางเดียว subscribe ใน component อนุญาตแค่ 2 กรณี:

1. **UI follow-up** จาก use case ที่คืน `Observable<boolean>` — ปิด dialog, navigate,
   reload (ห้าม mutate state / ยิง HTTP ใน callback)
2. **Wiring stream ภายใน UI** — debounce Subject, form `valueChanges`, route params
   (ปลายทางคือการเรียก facade เสมอ)

```typescript
// ❌ subscribe รับ data มาเก็บแสดงเอง
this.facade.loadUsers$().subscribe((users) => (this.users = users))

// ✅ data ไหลทาง signal — component แค่ประกาศ
readonly users = this.facade.users
```

**เพราะ:** ถ้า component subscribe รับ data เอง จะเกิด **สำเนา state ที่สอง**
นอก store (`this.users`) ซึ่ง (ก) ไม่ sync กับ store เมื่อคนอื่น mutate —
สอง component แสดงค่าต่างกันได้ (ข) เป็น plain field ที่ไม่ trigger OnPush —
UI ค้างแบบเงียบ ๆ (ค) business logic เริ่มรั่วเข้า callback จนกลายเป็น
orchestrator เถื่อนใน UI — จุดแข็งทั้งหมดของ R1/R2 หายทันที

### R5 — ทุก subscription ต้อง lifecycle-safe

- stream อายุยาว (Subject, valueChanges, router events):
  ต้องมี `takeUntilDestroyed()` — ไม่มีข้อยกเว้น
- HTTP observable แบบ single-shot จาก Facade: complete เองก็จริง
  แต่ยังต้องใส่ `takeUntilDestroyed(this.destroyRef)` กัน response
  ยิงใส่ component ที่ถูก destroy ไปแล้ว
- ห้ามใช้ `ngOnDestroy` + `Subscription` แบบ manual