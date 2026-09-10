// ---------- FACADE ----------
@Injectable()
export class ExampleFacade {
  private readonly store = inject(ExampleStore)
  private readonly api = inject(AgmwsExampleApi)
  private readonly appService = inject(AppService)
  private readonly destroyRef = inject(DestroyRef)

  // SELECTORS
  readonly items = this.store.items
  readonly loading = this.store.loading
  readonly error = this.store.error

  // USE CASES — สไตล์หลักของโปรเจกต์: pipe + tap/catchError/finalize
  load(): void {
    this.store.startLoad()
    this.api.getItems()
      .pipe(
        tap((res) => this.store.setItems(convertToCamel(res.data) as ExampleItem[])),
        catchError((err: HttpErrorResponse) => {
          this.store.setError(err?.error?.message ?? 'เกิดข้อผิดพลาด')  // inline UI
          this.appService.showError(err?.error?.message ?? 'เกิดข้อผิดพลาด')  // toast (เลือกตามเคส)
          return EMPTY
        }),
        finalize(() => {/* stop loading รวมไว้ใน setItems/setError แล้ว */}),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe()
  }
}