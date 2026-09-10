## Naming Patterns

รวบจากการสำรวจโค้ดจริงทั้งโปรเจกต์ — แบ่งเป็น 10 กลุ่ม
(ตัวเลขในวงเล็บ = จำนวนที่พบจริง ณ วันที่สำรวจ)

### N1 — ไฟล์และโฟลเดอร์: kebab-case + suffix บอกชนิด

```
xxx.component.ts / .html / .scss / .spec.ts    # component
xxx.facade.ts / xxx.facade.provider.ts         # domain logic
xxx.store.ts / xxx.model.ts                    # state + type
xxx.service.ts / xxx.provider.ts               # core service
xxx.interceptor.ts / xxx.config.ts             # infrastructure
xxx.enum.ts                                    # enum (เช่น dashboard-principal-type.enum.ts)
xxx-util.ts                                    # utility (เช่น date-util.ts, validator-util.ts)
environment.<env>.ts                           # env config
```

### N2 — คลาส: PascalCase + suffix ตรงกับชนิดไฟล์

```typescript
DataWarehouseComponent   // .component.ts
DataWarehouseFacade      // .facade.ts
DataWarehouseStore       // .store.ts
AppBarService            // .service.ts
HeaderInterceptor        // .interceptor.ts
AgmwsDataManagementApi   // generated — ห้ามตั้งเอง
export const DataWarehouseProvider: Array<any> = [...]   // provider = const PascalCase
```

### N3 — Component selector: prefix `agrimap-`

พบจริง: `agrimap-` 113 ตัว / `app-` 5 ตัว (legacy)

```typescript
// ✅ selector: 'agrimap-data-warehouse'
// ❌ selector: 'app-map-layout-editor'   ← legacy ห้ามเพิ่มใหม่
```

### N4 — Input / Output / Model

```typescript
// input: camelCase คำนาม บอกความหมายของค่า — ไม่มี prefix
readonly displayName = input<string>('')
readonly maxCount = input<number>(10)

// output: เหตุการณ์ "ที่เกิดแล้ว" — past tense หรือ noun+Change
readonly closed = output<void>()          // พบจริง 9
readonly created = output<Item>()         // พบจริง 6
readonly uploaded = output<File>()        // พบจริง 2
readonly filterChange = output<string>()
// ❌ ห้าม prefix on: onClose, onAddService (พบ 2 จุด — legacy ห้ามเพิ่ม)

// model: คำนามสถานะที่แชร์สองทาง
readonly visible = model<boolean>(false)
```

```html
<!-- ฝั่ง parent: property binding รับ signal, event binding เข้า handler on* -->
<agrimap-child
  [displayName]="title()"
  [maxCount]="limit()"
  (itemSelected)="onItemSelected($event)"
  (filterChange)="onFilterChange($event)" />
```

กติกาจำง่าย: **output = สิ่งที่เกิด (`created`) · handler ฝั่งรับ = การตอบสนอง (`onCreated`)**

### N5 — Method ใน component: handler ใช้ `on*`

พบจริง: `on*` ~530 จุด / `handle*` ~100 จุด → มาตรฐานคือ **`on*`** ตัวเดียว

```typescript
protected onSelectItem(item: Item): void { ... }   // ✅
protected onSearch(value: SearchValue): void { ... }
// handle* — โค้ดเก่ามีอยู่ ไม่ต้องไล่แก้ แต่ห้ามเขียนเพิ่ม
```

### N6 — Facade use case: verb นำหน้า สื่อชนิดงาน

verb ที่ใช้จริง (เรียงตามความถี่): `get` 31 · `load` 30 · `fetch` 23 · `delete` 17 ·
`search` 12 · `update` 9 · `add` 9 · `set` 6 · `create` 5 · `clear` 5

| verb | ความหมาย | return |
|---|---|---|
| `load*` / `fetch*` | ดึงจาก server → เขียน store | `void` (fire-and-forget) |
| `get*` | อ่านค่า/คำนวณ ไม่แตะ server หรือคืน stream ให้ caller | ค่า หรือ `Observable<T>` |
| `create*` / `update*` / `delete*` / `save*` | เขียน server, caller รอผล follow-up | `Observable<boolean>` |
| `add*` / `remove*` / `set*` / `clear*` / `reset*` | local mutation → store ตรง | `void` |
| `search*` | query ใหม่ → เขียน store | `void` |

method ใหม่ที่คืน `Observable` แนะนำลงท้าย `$` (`deleteContent$`) เพื่อสื่อชนิด —
โค้ดเก่าไม่ใส่ ไม่ต้องไล่แก้

### N7 — Boolean: prefix บอกบริบท

พบจริง: `show*` 18 · `is*` 13 · `loading` 3

```typescript
readonly showVerifyPinDialog = signal<boolean>(false)  // show* = การมองเห็นของ UI
readonly isEditing = signal<boolean>(false)            // is*/has* = สถานะ/ข้อเท็จจริง
readonly loading = computed(() => ...)                  // loading = มาตรฐานของ store
```

### N8 — Signal / Subject / Observable

```typescript
// state ภายใน store: `state` หรือ `xxxState` (private เสมอ)
private readonly state = signal<XxxState>({...})
private readonly layerGroupState = signal<LayerGroupConfig[]>([])

// selector: คำนามล้วน ไม่มี prefix/suffix
readonly items = computed(() => this.state().items)

// ห้าม `_` prefix — ถ้ากำลังตั้ง `_isOpen` คู่กับ computed = กำลังทำ effect-copy (ดู Signal Guide)

// Subject: ลงท้าย Subject
private readonly searchSubject = new Subject<string>()

// ตัวแปร/property ที่ถือ Observable: ลงท้าย $
readonly register$ = ...
```

### N9 — Type / Interface / Enum / Const

```typescript
// interface & type: PascalCase ไม่มี prefix I/T
export interface AppConfig { ... }
export interface LookupItem { ... }
// (TSymbol เป็น legacy 1 จุด — ห้ามใช้ prefix T เพิ่ม)

// enum: PascalCase + สมาชิก PascalCase, ไฟล์ .enum.ts
export enum DashboardPrincipalType { ... }

// const กลาง (shared/constants): camelCase — ไม่ใช้ SCREAMING_SNAKE
export const menuApp = ...
export const mapConfig = ...
export const lutContentType = ...

// DTO จาก generated-apis: suffix Dto (auto-gen — ห้ามตั้งเลียนแบบใน domain)
// domain model ใช้ชื่อสะอาดใน xxx.model.ts: DataWarehouse, MapLayoutItem
```

### N10 — Route path: kebab-case สื่อ resource

```typescript
{ path: 'data-warehouse' }
{ path: 'data-warehouse/data-import-export' }
{ path: 'my-data' }
{ path: 'tools/map-viewer' }
```