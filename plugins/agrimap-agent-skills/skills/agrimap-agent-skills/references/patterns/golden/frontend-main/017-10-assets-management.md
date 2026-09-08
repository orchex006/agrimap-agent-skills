## Assets & Images

### โครงสร้าง

```
public/                       # static assets — copy ตรงไป build output
├─ css/  ├─ fonts/  ├─ favicon.ico  ├─ loadingLottie.json
└─ images/
   ├─ icons/            # icon ทั่วไป
   ├─ layouts/          # รูปของ layout (sidebar bg, ...)
   ├─ portal/           # รูปหน้า portal
   ├─ register/         # รูป flow สมัครสมาชิก
   └─ data-management/  # รูปตาม feature — เพิ่มโฟลเดอร์ตาม module
```

### กลไก base path ต่อ environment (ต้องเข้าใจก่อนเขียน)

แอปถูก deploy ไว้ **คนละ path ต่อ env** — angular.json กำหนด `baseHref`/`deployUrl`
และ SCSS มีตัวแปร `$base-path` ที่สลับตาม env ผ่าน `stylePreprocessorOptions.includePaths`:

| env | baseHref (angular.json) | `$base-path` (styles/env) |
|---|---|---|
| local / development / inhouse | `/agrimap-platform-wa/` | `/agrimap-platform-wa` |
| k8s.dev / production | `/` | `''` (ว่าง) |
| staging | ไม่ override (ตกเป็น `/agrimap-platform-wa/`) | `''` ⚠️ ไม่ตรงกัน — ต้องตรวจ |

chain ของ SCSS: `styles/env/<env>/_dynamic-var.scss` (กำหนด `$base-path`)
→ `styles/variables.scss` (`@use 'dynamic-var'` + re-export)
→ component scss (`@use '@styles/variables.scss' as *`)

### กฎการอ้างรูปใน HTML

ใช้ **relative path ไม่มี `/` นำหน้า** — browser resolve ผ่าน `<base href>`
ที่ Angular ฉีดให้ตอน build จึงถูกทุก env อัตโนมัติ:

```html
<!-- ✅ relative — resolve ผ่าน <base href> -->
<img src="images/icons/icon-check.png" alt="สถานะถูกต้อง" />
<img src="images/portal/hero.png" alt="ภาพหน้าแรก" />

<!-- ❌ absolute — พังบน env ที่มี subpath (/agrimap-platform-wa/) -->
<img src="/images/icons/icon-check.png" alt="..." />

<!-- ❌ assets/ — โครงเก่าของ Angular ไม่มีในโปรเจกต์นี้ (public/ ไม่มีโฟลเดอร์ assets) -->
<img src="assets/images/logo.png" alt="..." />
```

path จาก TypeScript (bind เข้า `[src]`) ใช้กติกาเดียวกัน — เก็บเป็น relative string
`'images/...'` เสมอ

### กฎการอ้างรูปใน SCSS

CSS ไม่รู้จัก `<base href>` — **ต้องประกอบ path ด้วย `$base-path` เสมอ**:

```scss
// ✅ pattern เดียวที่ถูก
@use '@styles/variables.scss' as *;

.hero {
  background: url(#{$base-path}/images/portal/portal-bg.png) center/cover no-repeat;
}

// ❌ hardcode absolute — พังบน local/dev/inhouse ที่ deploy ใต้ /agrimap-platform-wa/
.hero {
  background-image: url('/images/portal/portal-bg.png');
}
```

**Detect:** grep `url\(['"]?/images` ใน `src/**/*.scss` — เจอ = violation

### สรุปกติกาต่อชนิดไฟล์

| ที่ใช้ | รูปแบบ | ตัวแปลง path |
|---|---|---|
| HTML `<img src>` | `images/...` (relative) | `<base href>` จาก angular.json |
| TS bind `[src]` | `'images/...'` (relative) | `<base href>` เช่นกัน |
| SCSS `url()` | `url(#{$base-path}/images/...)` | `$base-path` จาก styles/env |
| ไฟล์ใหม่ | วางใต้ `public/images/<module>/` kebab-case | — |
