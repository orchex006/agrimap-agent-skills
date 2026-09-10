## Component Layout — ลำดับ section ในไฟล์ component

ทุก component ใหม่เรียง section ตามนี้ (declare ก่อนใช้ — DI มาก่อนเพราะ selectors อ้าง facade):

```typescript
@Component({
  selector: 'agrimap-example-flow',
  imports: [JsonPipe],
  providers: [ExampleFlowProvider],
  templateUrl: './example-flow.component.html',
  styleUrl: './example-flow.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,   // บังคับใน component ใหม่
})
export class ExampleFlowComponent implements OnInit {
  // ---------- DI ----------
  private readonly facade = inject(ExampleFlowFacade)
  private readonly destroyRef = inject(DestroyRef)

  // ---------- component API (input / output / model / queries) ----------
  readonly firstName = input<string>('')
  readonly required = input<boolean>(false)
  readonly changeName = output<string>()
  readonly visible = model<boolean>(false)
  private readonly listRef = viewChild<ElementRef<HTMLPreElement>>('listRef')

  // ---------- state (signal / linkedSignal) ----------
  protected readonly revealed = signal<boolean>(false)

  // ---------- derived (computed / facade selectors) ----------
  protected readonly items = this.facade.items
  protected readonly loading = this.facade.loading
  protected readonly hasItems = computed(() => this.items().length > 0)

  // ---------- constructor (effects + stream wiring เท่านั้น) ----------
  constructor() {
    effect(() => {
      const el = this.listRef()?.nativeElement
      if (el) el.scrollTop = 0
    })
  }

  // ---------- ng lifecycle ----------
  ngOnInit(): void {
    this.facade.load()
  }

  // ---------- public functions (template เรียก) ----------
  protected onToggleRevealed(): void {
    this.revealed.update((v) => !v)
  }

  // ---------- private functions ----------
  private formatLabel(id: number): string {
    return `#${id}`
  }
}
```

กฎประกอบ:

| เรื่อง | กฎ |
|---|---|
| access modifier | template ใช้ = `protected` · ภายนอกใช้ (component API) = `public` · ที่เหลือ `private` — ทุก field เป็น `readonly` เว้นแต่จำเป็นจริง |
| decorator เก่า | ห้าม `@ViewChild` / `@Input` / `@Output` ใน component ใหม่ — ใช้ `viewChild()` / `input()` / `output()` / `model()` เท่านั้น |
| plain mutable field | ห้ามใช้เป็น template state (พังเมื่อ OnPush) — state ที่ UI ผูกต้องเป็น signal เสมอ |
| viewChild timing | ห้ามอ่านใน `ngOnInit` (อาจยัง undefined) — อ่านผ่าน `effect` หรือ `afterNextRender` |
| constructor | มีได้แค่ effect + stream wiring (debounce Subject) — ห้าม business logic; ถ้าว่างให้ลบทิ้ง |
| output naming | ชื่อเหตุการณ์ ไม่ใส่ prefix `on` (`changeName` ✓) — `on*` สงวนไว้ให้ handler method ฝั่งรับ |
| lifecycle | ใช้ hook ไหนให้ `implements` interface นั้นเสมอ |
| OnPush | `ChangeDetectionStrategy.OnPush` บังคับใน component ใหม่ทุกตัว (state เป็น signal หมดแล้ว ปลอดภัย และเป็นบันไดสู่ zoneless) |

---