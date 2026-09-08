// ---------- STORE ----------
@Injectable()
export class ExampleStore {
  private readonly state = signal<{
    items: ExampleItem[]
    loading: boolean
    error: string | null
  }>({ items: [], loading: false, error: null })

  // SELECTORS
  readonly items = computed(() => this.state().items)
  readonly loading = computed(() => this.state().loading)
  readonly error = computed(() => this.state().error)

  // MUTATORS
  startLoad(): void {
    this.state.update((s) => ({ ...s, loading: true, error: null }))
  }
  setItems(items: ExampleItem[]): void {
    this.state.update((s) => ({ ...s, items, loading: false, error: null }))
  }
  setError(message: string | null): void {
    this.state.update((s) => ({ ...s, error: message, loading: false }))
  }
}