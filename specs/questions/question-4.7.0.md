# Questions — 4.7.0 (P2)

การตัดสินใจที่ Agent ทำแทน owner ระหว่าง unattended run ของ P2 (roadmap §2.3) — ตอบ/สั่ง rewrite ได้ตาม §2.4

| ID | หัวข้อ | Status | Chosen | Rewrite cost |
| --- | --- | --- | --- | --- |
| Q-4.7.0-01 | เปิด `governance.specSync` ให้ project เดิมที่ 4.6.0 เขียน `false` ไว้ | answered | 1 — เปิดครั้งเดียวพร้อม marker | ต่ำ |
| Q-4.7.0-02 | Audit ของ spec repo แยกถูกเขียนลง `.agrimap-agent/` ของ spec repo | answered | 1 — เขียน log `delivered` ใน spec repo | กลาง |
| Q-4.7.0-03 | ค่าของตัวเลือก "เฉพาะครั้งนี้" และ default ของ standing card | rewritten | ไม่มี card: ตั้งกติกาทุกงานทันที (ce85715) | ต่ำ |

## Q-4.7.0-01 — เปิด `governance.specSync` ให้ project เดิมที่ 4.6.0 เขียน `false` ไว้

- Status: answered
- Risk: R2 · Confidence: medium
- Context: D§16.5 กำหนด `specSync` false (P1) → true (P2) แต่ `ensureLayout` ของ 4.6.0 เขียน `specSync: false` ลง `.agrimap-agent/config.json` ของทุก project ที่ init แล้ว ถ้าคงค่าเดิม project 4.6.0 ทั้งหมดจะไม่มี Spec Read/Sync Gate เลย ขัดกับเป้าหมาย §5.1 ("AI-First ไม่ต้องสั่งซ้ำ")
- Options:
  1. (เลือกแล้ว / แนะนำ) default ใหม่เป็น `true`; config ที่ยังเป็น `false` และไม่มี `specSyncDefault` ถูกเปลี่ยนเป็น `true` ครั้งเดียวตอน `init` แล้วใส่ `specSyncDefault: "4.7.0"` — ค่า `false` ที่ตั้งหลังจากนั้นถูกเคารพ — ผล: project เดิมได้ feature ทันที; ถ้ามีใครตั้ง `false` เองใน 4.6.0 จะถูกเปิด (โอกาสต่ำ เพราะ 4.6.0 ยังไม่มี feature ให้ปิด)
  2. คง `false` ที่มีอยู่ เปิดเฉพาะ layout ใหม่ — ผล: ต้องบอกทุกทีมให้แก้ config เอง
- Chosen: 1 — ย้อนง่าย (ลบ 2 บรรทัด) และค่า `false` ของ 4.6.0 เป็นค่าที่ script เขียน ไม่ใช่ที่ทีมเลือก
- Affected: `skills/agrimap-agent-skills/scripts/agm-workspace.mjs#ensureLayout`, `governance-commands.mjs` (`GOVERNANCE_DEFAULTS.specSync`), test `4.6.0 configs with the unused specSync:false default…` ใน `tests/unit/git-flow.test.mjs`; commit 53c88a1 (trailer `AGM-Question: Q-4.7.0-01`)
- Rewrite cost: ต่ำ — `git revert 53c88a1` (default ใน `GOVERNANCE_DEFAULTS` อยู่ใน f7dbda3: ถ้าเลือกข้อ 2 ให้คง `true` สำหรับ config ที่ไม่มี key); P3/P4 ไม่พึ่ง
- Owner answer: 1 — เปิด (true) (2026-09-19)

## Q-4.7.0-02 — Audit ของ spec repo แยกถูกเขียนลง `.agrimap-agent/` ของ spec repo

- Status: answered
- Risk: R2 · Confidence: medium
- Context: D§19.9 บอกว่า spec repo ที่เป็น Git คือ target root ตัวที่สอง "ใช้ policy ของ repo นั้น, deliver แยก" แต่ไม่ได้บอกว่า execution/audit อยู่ที่ไหน implementation ใช้ `linkedExecution` ใน session state ของ spec repo และ `deliver apply` ใน spec repo เขียน log event `delivered` ลง `.agrimap-agent/logs/` ของ spec repo (ไฟล์เหล่านี้จะถูก commit ใน delivery ถัดไปของ spec repo ตาม R1)
- Options:
  1. (เลือกแล้ว) เขียน log `delivered` ใน spec repo เหมือน target root อื่น (ไม่เขียน recent memory) — ผล: spec repo มี audit ของตัวเอง, สอดคล้องกับ "target root อีกตัว"
  2. ไม่เขียน audit ใดๆ ใน spec repo; บันทึก commit ของ spec repo ใน log ของ repo code เท่านั้น — ผล: spec repo สะอาด แต่ไม่มีร่องรอยใน repo นั้น
- Chosen: 1 — ตรงกับ D§19.9 และกติกา audit เดิม
- Affected: `governance-commands.mjs` (`activeFor`, `deliverCommand`, `linkSpecRoots`), `session-state.mjs` (`linkedExecution`, `activeByRoot`, `specDeliveries`); commit f7dbda3
- Rewrite cost: กลาง — ข้อ 2 ต้องข้าม `logForActive` เมื่อ `linked` และย้าย event ไปเขียนใน source root (`active.sourceRoot`) + แก้ test AC23; P3 (digest/recall) ไม่พึ่ง
- Owner answer: 1 — ตามที่เสนอ (2026-09-19)

## Q-4.7.0-03 — ค่าของตัวเลือก "เฉพาะครั้งนี้" และ default ของ standing card

- Status: rewritten
- Risk: R1 · Confidence: high
- Context: D§19.10 กำหนด card R1 "ทำแบบนี้ทุกงานไหม" (1 ทุกงาน, 2 เฉพาะครั้งนี้) + `recordAs: "project:specs.sync"` แต่ `validateCard` ของ 4.6.0 บังคับว่า card ที่ไม่ block ต้องมี `default` และทุกตัวเลือกต้องมี value ที่ `recordAs` ใช้ได้
- Options:
  1. (เลือกแล้ว) ข้อ 2 value `"off"` (บันทึก decision ว่าคง sync ปิด) และ card เป็น non-blocking default ข้อ 2 — ผล: ไม่ตอบ = ไม่เปลี่ยนกติกา
  2. card เป็น blocking ไม่มี default — ผล: ต้องรอคำตอบก่อนทำงานต่อ
- Chosen: 1 — ผู้ใช้สั่งงานนี้แล้ว ไม่ควร block งาน; ไม่ตอบ = ทางที่เปลี่ยนน้อยที่สุด
- Affected: `project-profile.mjs#specStandingCard`, `decision-card.mjs` (object value → `applyProjectPatch`); commit bcf3d68 และแก้ default ใน f7dbda3
- Rewrite cost: ต่ำ — แก้ `blocking/default` ใน `specStandingCard`; ไม่มี phase ถัดไปพึ่ง (P3 recall จะอ่าน decision ที่ card นี้สร้าง ไม่ขึ้นกับ default)
- Rewrite: commit ce85715 (trailer `AGM-Question: Q-4.7.0-03`, `AGM-Rewrite: owner-answer`)
- Owner answer: ไม่ต้องมี card — ไม่ถามบ่อย เน้นให้เหมือนกันทุกงาน: `spec standing` ตั้งกติกาทุกงานทันทีและรายงานใน ตัดสินใจแทนไว้ (2026-09-19)
