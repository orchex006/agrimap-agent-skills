// T3 — Signal-based component API
// ใช้ generic เสมอ
readonly userId = input.required<number>()
readonly name = input<string>('')
readonly saved = output<Item>()
readonly menu = viewChild<Menu>('menu')