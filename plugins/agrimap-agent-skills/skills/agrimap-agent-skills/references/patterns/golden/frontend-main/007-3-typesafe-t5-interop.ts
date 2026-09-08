// T5 — Interop (RxJS ↔ Signal ↔ Promise)
// RxJS → Signal: type มาจาก generic หรือ initialValue
readonly currentUrl = toSignal(this.router.events.pipe(/* ... */), { initialValue: '' })

// RxJS → Promise: ใช้ first/lastValueFrom — ได้ Promise<T> จาก generic ของ http
const config = await lastValueFrom(this.http.get<AppConfig>(url))
// อนุญาตเฉพาะใน core/ (initializer) — ห้ามใช้ใน Store (ดู R3)