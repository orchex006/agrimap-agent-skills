# Queue status — ACG roadmap 4.7.0 → 4.9.0

จุด resume ของ unattended queue (roadmap §2.7) — อ่านไฟล์นี้ก่อนทำ phase ถัดไป

| Phase | Version | Status | Branch | Head | Draft PR | Tests | Questions (decided/skipped/deferred) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P2 | 4.7.0 | done | feature/acg-p2-4.7.0 | f227cea | #24 | 152/152, release 4/4, tokens 61/61 strict ok, package:build ok | 3/0/0 |
| P3 | 4.8.0 | pending | — | — | — | — | — |
| P4 | 4.9.0 | pending | — | — | — | — | — |

Head คือ commit ของงาน P2 ก่อน commit ของไฟล์นี้ (ไฟล์นี้อยู่ commit ถัดไปบน branch เดียวกัน)

## สิ่งที่ owner ต้องทำ (เรียงตามความสำคัญ)

1. อ่าน `specs/questions/question-4.7.0.md` (3 ข้อ decided) — ตอบหรือสั่ง `rewrite Q-4.7.0-0N → <n>`; Q-4.7.0-02 rewrite cost กลาง
2. ตรวจ CI ของ draft PR #24 (base `develop`) แล้ว merge ตามลำดับ #24 → P3 → P4 (stacked); หลัง merge #24 เปลี่ยน base ของ PR P3 เป็น `develop`
3. Release `v4.7.0` (หรือรวมกับ 4.8.0/4.9.0 เป็นรุ่นเดียว) — ไม่อยู่ใน queue
4. (ข้อเสนอ) ย้าย spec pack จริงเข้า Git ตาม D§19.21 เมื่อมี URL — ไม่อยู่ใน queue

## ⚠️ Warnings ที่ยังเปิด

- `GLAB_UNVERIFIED` (บางส่วน): flag ตรวจกับ glab 1.115 แล้ว; ฟิลด์ JSON ของ GitLab ยังทดสอบด้วย stub (ไม่มี GitLab login ในเครื่อง)
- ไฟล์ค้างใน working tree ที่ไม่ใช่ของ queue (`DEVELOPMENT.md`, `tests/unit/package-release.test.mjs`, `tools/check-package-pr.mjs`) ยังไม่ถูกแตะ/commit
- `npm run package:build` บน Windows ต้องรันจาก PowerShell (tar ของ Git Bash อ่าน path `D:` ไม่ได้)
