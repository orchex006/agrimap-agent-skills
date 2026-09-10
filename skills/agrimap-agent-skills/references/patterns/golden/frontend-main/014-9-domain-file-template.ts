// xxx.model.ts — type ของ domain
export interface XxxItem { /* ... */ }

// xxx.store.ts — pure state
@Injectable()
export class XxxStore {
  private readonly state = signal<XxxState>({ items: [], loading: false, error: null })
  readonly items = computed(() => this.state().items)
  readonly loading = computed(() => this.state().loading)
  setItems(items: XxxItem[]): void { this.state.update((s) => ({ ...s, items })) }
}

// xxx.facade.ts — orchestration
@Injectable()
export class XxxFacade {
  private readonly store = inject(XxxStore)
  private readonly api = inject(AgmwsXxxApi)
  private readonly appService = inject(AppService)

  // ---------- SELECTORS ----------
  readonly items = this.store.items
  readonly loading = this.store.loading

  // ---------- USE CASES ----------
  loadItems(): void { /* api → convertToCamel → store, catchError → showError */ }
}

// xxx.facade.provider.ts — provider รวม
export const XxxProvider: Array<any> = [XxxFacade, XxxStore]