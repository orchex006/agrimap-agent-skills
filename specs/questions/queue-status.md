# Queue status — ACG roadmap 4.7.0 → 4.9.0

จุด resume ของ unattended queue (roadmap §2.7) — อ่านไฟล์นี้ก่อนทำ phase ถัดไป

| Phase | Version | Status | Branch | Head | Draft PR | Tests | Questions (decided/skipped/deferred) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P2 | 4.7.0 | done (CI ubuntu/windows pass) | feature/acg-p2-4.7.0 | f227cea | #24 | 152/152, release 4/4, tokens 61/61 strict ok, package:build ok | 3/0/0 |
| P3 | 4.8.0 | done (CI pass) | feature/acg-p3-4.8.0 | b629e58 | #25 (base #24) | 163/163, release 4/4, tokens 61/61 strict ok, package:build ok; core AGENTS 61,058 → 20,752 chars | 3/0/0 |
| P4 | 4.9.0 | done (CI pass) | feature/acg-p4-4.9.0 | 8dd9672 | #26 (base #25) | 171/171, release 4/4, tokens 61/61 strict ok, package:build ok | 3/0/0 |

Head คือ commit ของงานก่อน commit ที่อัปเดตไฟล์นี้ · queue จบแล้ว (P2–P4 done)

## สิ่งที่ owner ต้องทำ (เรียงตามความสำคัญ)

1. อ่าน `specs/questions/question-4.7.0.md`, `question-4.8.0.md`, `question-4.9.0.md` (ไฟล์ละ 3 decided) — ตอบหรือสั่ง `rewrite Q-… → <n>`; Q-4.7.0-02 rewrite cost กลาง ที่เหลือต่ำ
2. ตรวจ CI ของ draft PR แล้ว merge ตามลำดับ #24 → #25 → #26 (stacked); หลัง merge แต่ละตัวเปลี่ยน base ของ PR ถัดไปเป็น `develop`
3. Release `v4.7.0`, `v4.8.0`, `v4.9.0` แยกกัน หรือรวมเป็นรุ่นเดียว (owner เลือก) — ไม่อยู่ใน queue
4. (ข้อเสนอ) ย้าย spec pack จริงเข้า Git ตาม D§19.21 เมื่อมี URL — ไม่อยู่ใน queue

## ⚠️ Warnings ที่ยังเปิด

- CI ubuntu ของ #25/#26 fail ระหว่างทางสองสาเหตุ แก้แล้วทั้งคู่ (test ไม่ใช่ runtime): execution id ของ 2 developer จำลองชนกันในวินาทีเดียว และ git gc --auto แย่ง cleanup — ความเสี่ยงจริงที่เหลือ: execution id ความละเอียดวินาที อาจชนกันได้ถ้าสองคนเริ่มงานวินาทีเดียวกันแล้ว local-merge (จะได้ MERGE_FAILED พร้อม stderr ไม่ใช่ข้อมูลเสีย)
- Guard ยังไม่ติดตั้งบน Codex, Gemini/Antigravity (`not-supported-on-host`)

- `GLAB_UNVERIFIED` (บางส่วน): flag ตรวจกับ glab 1.115 แล้ว; ฟิลด์ JSON ของ GitLab ยังทดสอบด้วย stub (ไม่มี GitLab login ในเครื่อง)
- ไฟล์ค้างใน working tree ที่ไม่ใช่ของ queue (`DEVELOPMENT.md`, `tests/unit/package-release.test.mjs`, `tools/check-package-pr.mjs`) ยังไม่ถูกแตะ/commit
- `npm run package:build` บน Windows ต้องรันจาก PowerShell (tar ของ Git Bash อ่าน path `D:` ไม่ได้)
