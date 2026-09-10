## Facade Flow Journey — ตามรอยโค้ดจริง 3 ระดับ

flow มาตรฐานของทุก feature คือเส้นเดียวกัน ต่างแค่ความซับซ้อนของ orchestration:

```
route (lazy load) → component เกิด (providers สร้าง Facade+Store)
  → ngOnInit เรียก facade use case → facade ยิง generated API
  → api ตอบ → facade แปลงข้อมูล → store mutator เขียน signal
  → signal เปลี่ยน → template @for/@if re-render → display
  → user กระทำ → component เรียก facade → วนรอบเดิม
```

ทั้ง 3 ตัวอย่างข้างล่างคือ **โค้ดจริงในโปรเจกต์** — เปิดไฟล์ตามได้ทุกจุด

### ระดับง่าย — Map Viewer (โหลดครั้งเดียว แสดงผล)

เส้นทาง: `features/map-viewer/` + `domain/map-viewer/map-viewer/`

```typescript
// [1] ROUTE — app.routes.ts: lazy load component
{ path: 'map-viewer',
  loadComponent: () => import('./features/map-viewer/map-viewer.component')
    .then((m) => m.MapViewerComponent) }

// [2] COMPONENT เกิด — providers สร้าง Facade + Store scope นี้เท่านั้น
@Component({ providers: [provideMapViewer(), MapViewerFacade, MapViewerStore], ... })
export class MapViewerComponent {
  private facade = inject(MapViewerFacade)
  myLayerGroups = this.facade.layerGroups   // [7] selector — ยังไม่มีข้อมูล ณ จุดนี้

  ngOnInit(): void {
    // [3] อ่าน query param แล้วสั่ง use case
    this.route.queryParamMap.subscribe((p) => {
      const contentId = p.get('id')
      if (contentId) this.facade.fetchLayerGroupConfig(contentId)
    })
  }
}

// [4] FACADE — orchestrate: loading → API → store → error → finalize
fetchLayerGroupConfig(contentId: string): void {
  this.store.startLoading('fetchLayerGroupConfig')
  this.store.setError(null)
  this.dataManagementApi
    .getContentManageContentsContentIdMapService({ content_id: contentId })  // [5] HTTP
    .pipe(
      tap((res) => this.store.setLayerGroupConfig(res?.data ?? null)),       // [6] เขียน store
      catchError((err) => { this.store.setError(err?.message ?? '...'); return EMPTY }),
      finalize(() => this.store.stopLoading('fetchLayerGroupConfig')),
    )
    .subscribe()
}

// [6] STORE — mutator แปลง DTO → core model แล้ว set signal
setLayerGroupConfig(data: LayerGroupConfigResponseDto[] | null): void {
  const coreModels = (data ?? []).map((group) => ({ id: ..., name: ..., layers: ... }))
  this.layerGroupState.set(coreModels)   // ← signal เปลี่ยน → UI ตื่นเอง
}

// [7] TEMPLATE — signal binding, ไม่มี async pipe
// <agrimap-map-viewer [layerGroups]="myLayerGroups()"
//   (addLayerGroup)="handleAddNewGroup($event)" />

// [8] USER ACTION — วนกลับเข้า facade (local mutation ไม่ผ่าน API)
handleAddNewGroup(newGroup: LayerGroupConfig) { this.facade.addLayerGroup(newGroup) }
```

จุดเรียนรู้: use case คืน `void` (fire-and-forget) — component ไม่ต้องรอผล
เพราะผลไหลกลับทาง signal อยู่แล้ว

### ระดับกลาง — Data Warehouse (forkJoin lookup + debounce search)

เส้นทาง: `features/data-management/data-warehouse/` + `domain/data-management/data-warehouse/`

```typescript
// [1] ROUTE — มี guard คั่นก่อนเข้า
{ path: 'data-warehouse',
  loadComponent: () => import('.../data-warehouse.component').then((m) => m.DataWarehouseComponent),
  canActivate: [functionsGuard] }

// [2] COMPONENT — wiring debounce search ใน constructor
private readonly searchSubject = new Subject<SearchFormValue>()
constructor() {
  this.searchSubject
    .pipe(debounceTime(400), takeUntilDestroyed())
    .subscribe((frmValue) => this.onSearch(frmValue))   // [6] user พิมพ์ → ค้นหา
}

// [3] ngOnInit — โหลด lookup + ผูก form เข้า subject
ngOnInit(): void {
  this.facade.loadPermissionsLookup()
  this.frmCtrl()?.formGroup.valueChanges.subscribe((v) => this.searchSubject.next(v))
}

// [4] FACADE — forkJoin หลาย source พร้อมกัน (lookup lib ภายนอก + API)
loadPermissionsLookup(): void {
  forkJoin({
    lookup: this.dynamicLutFacade.load$(['lut_organization_all_q', 'lut_file_type_q', ...]),
    dashboard: this.dataManagementApi.getDataWarehouseDatasetDashboard(),
  }).pipe(
    tap(({ dashboard }) => {
      const data = convertToCamel(dashboard) as DataWarehouseDashboard   // [5] แปลง case
      this.store.setDatasetWarehouseDashboard(data)
    }),
    catchError((err: HttpErrorResponse) => {
      this.appService.showError(err?.error?.message ?? 'เกิดข้อผิดพลาด')   // toast
      return EMPTY
    }),
  ).subscribe()
}

// [7] FACADE — derived options จาก lookup (computed ต่อยอดจาก facade อื่น)
readonly organizationOptions = computed(() =>
  (this.dynamicLutFacade.lut()['lut_organization_all_q'] ?? []).map((opt) => ({ ... })))

// [8] TEMPLATE — @for วน options + dashboard cards จาก signal
```

จุดเรียนรู้เพิ่มจากระดับง่าย: (ก) รวมหลาย async source ด้วย `forkJoin` object form
(ข) user input ไหลผ่าน `Subject + debounceTime + takeUntilDestroyed`
(ค) facade ต่อยอด state จาก facade ของ library อื่นด้วย `computed`

### ระดับยาก — My Content (CRUD + upload + UI follow-up + bulk)

เส้นทาง: `features/data-management/my-content/` + `domain/data-management/my-content/`

```typescript
// [1] ROUTE — guard + functionId
{ path: 'my-data',
  loadComponent: () => import('.../my-content.component').then((m) => m.MyContentComponent),
  canActivate: [functionsGuard], data: { functionId: 'platform-101' } }

// [2] FACADE — use case คืน Observable<boolean> เพราะ component ต้องรอผลไป follow-up
deleteContent(req: DeleteContentReq): Observable<boolean> {
  const loadKey = 'deleteContent_' + Date.now()
  this.appService.showLoading(loadKey)          // global loading overlay
  this.store.startLoading('deleteContent')       // local loading state
  this.store.setError(null)
  return this.dataManagementApi
    .deleteContentManageContents({ body: { content_ids: req.contentIds } })
    .pipe(
      map(() => true),                            // แปลงเป็นสัญญาณสำเร็จ
      catchError((err) => {
        this.store.setError(err?.error?.message ?? 'Failed to delete content')
        return of(false)                          // ไม่ throw — คืน false ให้ caller ตัดสิน
      }),
      finalize(() => {
        this.store.stopLoading('deleteContent')
        this.appService.hideLoading(loadKey)
      }),
    )
}

// [3] COMPONENT — subscribe เพื่อ UI follow-up เท่านั้น (R4): reload เมื่อสำเร็จ
onDeleteConfirmed(items: ContentItem[]): void {
  const contentIds = items.map((i) => i.contentId).join(',')
  this.facade.deleteContent({ contentIds }).subscribe((ok) => {
    if (ok) this.reloadCurrentFolder()   // follow-up — ไม่มี HTTP/mutate state ตรงนี้
  })
}

// [4] BULK — หลาย use case พร้อมกันด้วย forkJoin ฝั่ง component
const uploads = files.map((file) =>
  this.facade.uploadAndCreateContent(file, CONTENT_TYPE.FILE, parentNumericId))
forkJoin(uploads).subscribe((results) => { /* สรุปผลรวมแล้ว reload */ })

// [5] FACADE upload — chain 2 API (create content → upload file) ใน use case เดียว
uploadAndCreateContent(file: File, contentType: number, ...): Observable<boolean> {
  this.appService.showLoading(loadKey)
  this.store.startLoading('uploadFile')
  return this.dataManagementApi.postContentManageContents({ name, content_type, file, ... })
    .pipe(/* ... → fileManagementApi → map(true) / catchError(of(false)) / finalize */)
}
```

จุดเรียนรู้เพิ่ม: (ก) use case คืน `Observable<boolean>` เมื่อ caller ต้องทำ follow-up —
error ถูก "กลืน" ใน facade แล้วคืน `false` แทนการ throw (ข) loading 2 ชั้น:
`appService.showLoading` (overlay ทั้งแอป) + `store.startLoading` (state ของ feature)
(ค) bulk operation ใช้ `forkJoin` รวม Observable จาก use case เดียวกันหลายตัว

### สรุปการเลือกรูปแบบ use case

| สถานการณ์ | signature | component ทำอะไร |
|---|---|---|
| โหลดข้อมูลมาแสดง | `load(): void` | เรียกทิ้งไว้ — ผลไหลกลับทาง signal |
| action ที่ต้องรอผลไป follow-up (ปิด dialog, reload, navigate) | `doX$(...): Observable<boolean>` | subscribe เพื่อ follow-up เท่านั้น |
| bulk action | component `forkJoin` หลาย use case | subscribe สรุปผลรวม |
| local mutation (ไม่แตะ server) | `addX(item): void` → store โดยตรง | เรียกเฉย ๆ |

---

