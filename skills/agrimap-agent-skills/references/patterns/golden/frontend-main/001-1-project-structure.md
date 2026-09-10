## Project Structure
```
🔴 src/                        --> folder รวมสำหรับ build
│
├─ 🔵 app/                     --> folder หลักสำหรับ source code
│  │
│  ├─ 🔵 core/                 --> infrastructure + application core
│  │  ├─ 🟠 config/            --> authentication.config, local-storage.config
│  │  ├─ 🔵 services/          --> service + state (app, app-bar, download, local-storage,
│  │  │                            lookup, sidebar-template, initialize-app-config,
│  │  │                            menu-app.provider, service.provider)
│  │  ├─ 🔵 initializers/      --> logic ตอน app start (app.initialize.ts)
│  │  ├─ 🔵 interceptors/      --> http interceptor (header, avoid)
│  │  ├─ 🔵 middleware/        --> guard / pre-condition logic (ยังว่าง — มีแค่ .gitkeep)
│  │  ├─ ⚫ models/            --> interface / type กลาง (app-config.model.ts)
│  │  └─ 🔵 utils/             --> function กลาง (converter, css-util, date-util, validator-util)
│  │
│  ├─ 🟢 domain/               --> business logic + state (จัดกลุ่มตาม module)
│  │  ├─ data-management/      --> ~19 sub-domain (data-warehouse, data-import, dashboard-*,
│  │  │                            my-content, my-group, request, satellite, iot, lookup,
│  │  │                            share-content, shares-api-*, map-layout, ฯลฯ)
│  │  ├─ map-viewer/
│  │  ├─ open-metadata/
│  │  ├─ pincode/
│  │  ├─ register/
│  │  └─ user-management/      --> ~11 sub-domain (users, roles, permissions, pdpa,
│  │  │                            consent-pdpa, logs, statistics, position-account,
│  │  │                            system-notification, user-groups)
│  │  └─ (รูปแบบไฟล์ต่อ 1 เรื่อง — 4 ไฟล์)
│  │     ├─ xxx.facade.ts           --> logic หลักของเรื่องนั้น ๆ
│  │     ├─ xxx.facade.provider.ts  --> provider รวม logic + state
│  │     ├─ xxx.store.ts            --> state
│  │     └─ xxx.model.ts            --> interface / type ของ domain นั้น
│  │
│  ├─ 🟡 features/             --> pages + component (จัดกลุ่มตาม module ล้อกับ domain)
│  │  ├─ dashboard/            --> create-dashboard, dashboard-editor, dashboard-view
│  │  ├─ data-management/      --> ~29 feature (data-warehouse, map-viewer, my-content,
│  │  │                            my-group, request-* หลายตัว, satellite, iot, stat-*, ฯลฯ)
│  │  ├─ forget-pincode/
│  │  ├─ map-viewer/
│  │  ├─ open-metadata/
│  │  ├─ portal/               --> portal-header-bar
│  │  ├─ register/             --> register-form
│  │  ├─ set-password/
│  │  ├─ set-pincode/
│  │  └─ user-management/      --> users, roles, permissions, pdpa, profile, log, systems, ฯลฯ
│  │     └─ (รูปแบบ: xxx.component.ts / .html / .scss / .spec.ts + child component ซ้อนใน folder)
│  │
│  ├─ 🟣 generated-apis/       --> auto-generated จาก /tools (เครื่องมือแยก cli)
│  │  ├─ agmws-data-management/
│  │  ├─ agmws-dynamic-dashboard/
│  │  ├─ agmws-dynamic-form/
│  │  ├─ agmws-file-management/
│  │  ├─ agmws-identity/
│  │  ├─ agmws-initialize/
│  │  ├─ agmws-layer-management/
│  │  ├─ agmws-pdpa/
│  │  ├─ agmws-user-management/
│  │  ├─ generated-apis.provider.ts
│  │  ├─ generated-api-utils.ts
│  │  └─ .gitkeep
│  │
│  ├─ ⚫ shared/               --> reusable UI / logic ที่ไม่รู้จัก business
│  │  ├─ components/           --> chip-scroll-list, file-explorer-table, file-upload-zone,
│  │  │                            open-to-dialog, page-header, popover, share-data-dialog,
│  │  │                            storage-widget, upload-file-dialog
│  │  ├─ constants/            --> ค่าคงที่กลาง (มี map/)
│  │  ├─ directives/
│  │  ├─ enums/
│  │  ├─ layouts/              --> app-bar, app-main, app-sidebar, data-management-layout,
│  │  │                            profile-layout, user-management-layout
│  │  ├─ messages/
│  │  ├─ nls/                  --> service แปลภาษา
│  │  └─ pipes/
│  │
│  ├─ 🔴 app.component.*       --> component หลัก (html / scss / ts / spec.ts)
│  ├─ 🔴 app.config.ts         --> config ตั้งต้น
│  ├─ 🔴 app.routes.ts         --> routing ทั้งหมดของระบบ
│  └─ 🟡 theme.preset.ts       --> UI theme หลักของระบบ
│
├─ 🟠 environments/            --> env config ต่อ environment
│  ├─ environment.ts           --> default / base
│  ├─ environment.local.ts
│  ├─ environment.development.ts
│  ├─ environment.staging.ts
│  ├─ environment.inhouse.ts
│  ├─ environment.k8s.dev.ts   --> ✨ เพิ่มใหม่ (k8s dev)
│  └─ environment.prod.ts      --> production
│
└─ 🟡 styles/                  --> global styles / theme
   ├─ styles.scss              --> entry หลักของ global styles
   ├─ tailwind.css             --> Tailwind CSS
   ├─ primeng.scss             --> ✨ override สไตล์ PrimeNG
   ├─ theme-color.css          --> ✨ ตัวแปรสีของ theme
   ├─ variables.scss           --> ✨ ตัวแปร SCSS กลาง
   └─ env/                     --> ตัวแปร dynamic ต่อ environment
      ├─ local/_dynamic-var.scss
      ├─ development/_dynamic-var.scss
      ├─ staging/_dynamic-var.scss
      ├─ inhouse/_dynamic-var.scss
      ├─ k8s.dev/_dynamic-var.scss   --> ✨ เพิ่มใหม่
      └─ prod/_dynamic-var.scss
```