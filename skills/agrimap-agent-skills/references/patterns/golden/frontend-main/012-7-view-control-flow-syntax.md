## Template Control Flow

โปรเจกต์ใช้ built-in control flow (Angular 17+) **100%** — ห้ามใช้ `*ngIf` / `*ngFor` /
`*ngSwitch` เด็ดขาด (ตรวจแล้ว: 0 จุดในโค้ดปัจจุบัน ต้องคงไว้แบบนี้)

สถิติการใช้จริง: `@if` 157 · `@else` 47 · `@for` 42 · `@case` 23 · `@else if` 10 ·
`@switch` 6 · `@empty` 5 · `@default` 2

### @if / @else if / @else

```html
@if (loading()) {
  <app-spinner />
} @else if (error()) {
  <p>{{ error() }}</p>
} @else {
  <app-content />
}
```

```html
<!-- alias ด้วย as: อ่านค่า signal/expression ครั้งเดียว ใช้ซ้ำใน block -->
@if (selectedUser(); as user) {
  <p>{{ user.name }} — {{ user.email }}</p>
}
```

### @for + track + @empty

```html
@for (item of items(); track item.id) {
  <li>{{ item.name }}</li>
} @empty {
  <li>ไม่พบข้อมูล</li>
}
```

กฎ `track` (บังคับโดย compiler):
- มี unique id → `track item.id` (ดีสุด)
- ไม่มี id และลิสต์ไม่ reorder → `track $index`
- ห้าม `track item` (identity) กับ object ที่สร้างใหม่ทุกรอบ (เช่นผลจาก `computed().map()`)
  — จะ re-render ทั้งลิสต์ทุกครั้ง

ตัวแปรใน scope ของ `@for` (ใช้ได้เลย ไม่ต้องประกาศ):

```html
@for (item of items(); track item.id; let i = $index, isLast = $last) {
  <li [class.divider]="!isLast">{{ i + 1 }}. {{ item.name }}</li>
}
<!-- มีให้ครบ: $index $count $first $last $even $odd -->
```

### Pattern มาตรฐาน: loading → error → data (ซ้อน block ได้)

โครงหลักของทุกหน้า feature — ลำดับเช็กคงที่: `loading()` ก่อน → `error()` → data
และ block ซ้อนกันได้อิสระ (`@for` ใน `@else`, `@if` ใน `@for`):

```html
@if (loading()) {
  <p>กำลังโหลด...</p>
} @else if (error()) {
  <p class="error">{{ error() }}</p>
} @else {
  <ul>
    @for (item of items(); track item.id) {
      <li>
        {{ item.name }}
        @if (item.active) {
          <span> (ใช้งาน)</span>
        } @else {
          <button (click)="onSelectItem(item)">เลือก</button>
        }
      </li>
    } @empty {
      <li>ไม่พบข้อมูล</li>
    }
  </ul>
}
```

ข้อกำหนด:
- `loading()` / `error()` / `items()` คือ selectors จาก facade (มาจาก store pattern
  เดียวกันทุก feature — ดู Domain file template)
- ซ้อนได้ไม่จำกัด แต่ **เกิน 3 ชั้นเมื่อไร ให้แตกเป็น child component** —
  ความลึกของ template คือสัญญาณว่า component ใหญ่เกินไป
- เงื่อนไขใน block ซ้อน (เช่น `item.active`) เป็น property ธรรมดาได้
  เพราะ re-render มาจาก signal ต้นทาง (`items()`) อยู่แล้ว

### @switch / @case / @default

```html
@switch (status()) {
  @case ('loading') { <p>Loading...</p> }
  @case ('error')   { <p>Error</p> }
  @default          { <p>Done</p> }
}
```

ใช้ `@switch` เมื่อแตกแขนงจาก **ค่าเดียว ≥ 3 ทาง** — ถ้าแค่ 2 ทางใช้ `@if/@else`
(`@case` เทียบแบบ `===` ไม่มี fall-through)

### @let — ยังไม่ใช้ในโปรเจกต์ (อนุญาตเมื่อเหมาะ)

ใช้ลดการเรียก expression ซ้ำใน template — อย่าใช้แทน `computed`
(logic ที่ซับซ้อนต้องอยู่ในคลาสเป็น `computed` ตาม Signal Guide)

```html
@let fullName = firstName() + ' ' + lastName();
<p>{{ fullName }}</p>
```

### @defer — ยังไม่ใช้ในโปรเจกต์ (พิจารณาเมื่อมีของหนัก)

เหมาะกับ component หนักที่อยู่นอกจอแรก (chart, map, editor) — lazy load ระดับ template

```html
@defer (on viewport) {
  <app-heavy-chart [data]="chartData()" />
} @placeholder {
  <div class="chart-skeleton"></div>
} @loading (minimum 300ms) {
  <app-spinner />
} @error {
  <p>โหลดไม่สำเร็จ</p>
}
```

### กฎรวม

| กฎ | เหตุผล |
|---|---|
| ห้าม `*ngIf` / `*ngFor` / `*ngSwitch` | โค้ดปัจจุบัน 0 จุด — ต้องคงไว้ |
| expression ใน block อ่านจาก signal เรียก `()` เสมอ | ไม่มี async pipe ในโปรเจกต์ (0 จุด) |
| เงื่อนไขซับซ้อน → ย้ายไป `computed` ในคลาส | template มีได้แค่ expression ตื้น ๆ |
| `@if ... as` เมื่อใช้ค่าซ้ำ ≥ 2 ครั้งใน block | อ่านค่าเดียว, จัดการ null ในตัว |
| `track` ต้องเป็น unique id ก่อนเสมอ | กัน re-render ทั้งลิสต์ |

---