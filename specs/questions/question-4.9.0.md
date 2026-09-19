# Questions — 4.9.0 (P4)

การตัดสินใจที่ Agent ทำแทน owner ระหว่าง unattended run ของ P4 (roadmap §2.3) — ตอบ/สั่ง rewrite ได้ตาม §2.4

การไม่ติดตั้ง guard บน Codex และ Gemini/Antigravity ใช้ค่าที่ตัดสินล่วงหน้าใน roadmap §7.3 (ไม่สร้าง question) — ดูตาราง host ใน PR

| ID | หัวข้อ | Status | Chosen | Rewrite cost |
| --- | --- | --- | --- | --- |
| Q-4.9.0-01 | เปิด `governance.guards` ให้ config เดิมที่เขียน `false` ไว้ | decided | 1 — เปิดครั้งเดียวพร้อม marker | ต่ำ |
| Q-4.9.0-02 | ขอบเขตของ G5 เรื่อง tag และการลบ branch | decided | 1 — deny ทุกการลบ tag; ลบ branch ปกติได้ | ต่ำ |
| Q-4.9.0-03 | Stop reminder ใช้ flag เดียวกับ guard | decided | 1 — `governance.guards` คุมทั้งสอง hook | ต่ำ |

## Q-4.9.0-01 — เปิด `governance.guards` ให้ config เดิมที่เขียน `false` ไว้

- Status: decided
- Risk: R2 · Confidence: medium
- Context: roadmap §7.3 กำหนด default `true` "สำหรับ layout ใหม่และ project ที่ไม่มี key" แต่ `ensureLayout` ตั้งแต่ 4.6.0 เขียน `guards: false` ลง config ทุก project — ปัญหาเดียวกับ Q-4.7.0-01 / Q-4.8.0-01
- Options:
  1. (เลือกแล้ว / แนะนำ) เปิดครั้งเดียวตอน `init` เมื่อยังไม่มี `guardsDefault`, ใส่ `guardsDefault: "4.9.0"`; `false` ที่ตั้งภายหลังถูกเคารพ
  2. คง `false` ที่มีอยู่ — guard ทำงานเฉพาะ project ใหม่
- Chosen: 1 — สอดคล้องกับสองข้อก่อน; ค่า `false` เดิมเป็นค่าที่ script เขียน
- Affected: `agm-workspace.mjs#ensureLayout`, `governance-commands.mjs` (`GOVERNANCE_DEFAULTS.guards`); commit 0665f23 (trailer `AGM-Question: Q-4.9.0-01`)
- Rewrite cost: ต่ำ — `git revert 0665f23`; ไม่มี phase ถัดไป
- Owner answer: _(ว่างไว้ให้ owner)_

## Q-4.9.0-02 — ขอบเขตของ G5 เรื่อง tag และการลบ branch

- Status: decided
- Risk: R2 · Confidence: medium
- Context: D§11.2 G5 ระบุ `git branch -D <protected>`, `git push … --delete <protected>`, `git tag -d`, `git push … --delete` ที่เป็น tag แต่ไม่ได้บอกว่า branch ที่ไม่ protected ลบได้ไหม และจะรู้ได้อย่างไรว่า ref ที่ลบเป็น tag (ไม่รัน git ต่อ ref)
- Options:
  1. (เลือกแล้ว) deny `git tag -d` ทุกกรณี และ remote delete ที่ ref เป็น `refs/tags/*` หรือขึ้นต้นแบบเลขรุ่น (`v1.2`, `4.9.0`); ลบ work branch ที่ไม่ protected ได้ (flow abandon ของ AGM ใช้ script อยู่แล้ว) และ `-d`/`-D`/`--delete` ของ protected branch ถูก deny ทั้งหมด
  2. ถาม (ask) แทน deny สำหรับ tag — ผล: ผู้ใช้ยืนยันแล้วลบได้จาก agent
- Chosen: 1 — ตรงตาราง G5 (deny) และตรวจได้โดยไม่รัน git; ref ชื่อแปลกที่ไม่เข้า pattern จะผ่าน (ยอมรับได้เพราะ fail-open เป็นหลักของ guard)
- Affected: `git-guard.mjs#evaluate` (`isTag`); commit e6296f6
- Rewrite cost: ต่ำ — เปลี่ยน `DENY` → `ASK` หรือ pattern ของ `isTag` + test
- Owner answer: _(ว่างไว้ให้ owner)_

## Q-4.9.0-03 — Stop reminder ใช้ flag เดียวกับ guard

- Status: decided
- Risk: R1 · Confidence: high
- Context: AC30 กำหนดว่า `governance.guards:false` ทำให้ hook คืนค่าว่างทุกคำสั่ง แต่ไม่มี flag แยกของ Stop reminder
- Options:
  1. (เลือกแล้ว) `guards:false` ปิดทั้ง guard และ reminder; reminder ยังเคารพ `governance.delivery:false`
  2. เพิ่ม flag ใหม่ `governance.deliveryReminder`
- Chosen: 1 — ไม่เพิ่ม config ใหม่; ทั้งสองเป็น hook ของ C8
- Affected: `delivery-reminder.mjs#reminderFor`; commit e6296f6
- Rewrite cost: ต่ำ
- Owner answer: _(ว่างไว้ให้ owner)_
