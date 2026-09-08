// T4 — RxJS
// Subject: กำหนด generic เสมอ (pattern debounced search)
private readonly searchSubject = new Subject<string>()

constructor() {
  this.searchSubject
    .pipe(debounceTime(300), takeUntilDestroyed()) // ใน constructor ไม่ต้องส่ง destroyRef
    .subscribe((keyword) => this.facade.search(keyword))
}

// Facade use case ที่คืน stream: ระบุ Observable<T> ที่ return type เสมอ
deleteContent$(payload: DeletePayload): Observable<boolean> {
  return this.api.deleteContent(payload).pipe(
    map((res) => res.success ?? false),
    catchError((err: HttpErrorResponse) => {
      this.appService.showError(err?.error?.message ?? 'เกิดข้อผิดพลาด')
      return of(false)
    }),
  )
}

// forkJoin: ใช้ object form — result มีชื่อ field ชัดเจน type ไหลอัตโนมัติ
forkJoin({
  lookup: this.dynamicLutFacade.load$([/* ... */]),
  dashboard: this.api.getDashboard(),
}).pipe(tap(({ dashboard }) => {/* dashboard: DashboardDto — infer แล้ว */}))

// operator ภายใน pipe: ห้าม annotate ซ้ำ — type ไหลจากต้นทางแล้ว
// ❌ map((items: ExampleItem[]) => items.length)
// ✅ map((items) => items.length)

// error callback: ระบุ HttpErrorResponse เสมอ — ห้าม any
catchError((err: HttpErrorResponse) => EMPTY)