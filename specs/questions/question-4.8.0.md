# Questions — 4.8.0 (P3)

การตัดสินใจที่ Agent ทำแทน owner ระหว่าง unattended run ของ P3 (roadmap §2.3) — ตอบ/สั่ง rewrite ได้ตาม §2.4

| ID | หัวข้อ | Status | Chosen | Rewrite cost |
| --- | --- | --- | --- | --- |
| Q-4.8.0-01 | เปิด `governance.decisionMemory` ให้ config เดิมที่เขียน `false` ไว้ | answered | 1 — เปิดครั้งเดียวพร้อม marker | ต่ำ |
| Q-4.8.0-02 | ข้อความ §2 แบบสั้นใน core `AGENTS.md` (ข้อความใหม่ในงานย้ายไฟล์) | rewritten | ตาราง 2 แถว + ประโยค precedence ของคำสั่งมนุษย์ (860685d) | ต่ำ |
| Q-4.8.0-03 | ค่า default ของ promotion card | answered | 1 — non-blocking default "ไม่ต้อง" | ต่ำ |

## Q-4.8.0-01 — เปิด `governance.decisionMemory` ให้ config เดิมที่เขียน `false` ไว้

- Status: answered
- Risk: R2 · Confidence: medium
- Context: roadmap §6.3 กำหนด "project เดิมไม่มี key → `true`" แต่ `ensureLayout` 4.6.0/4.7.0 เขียน `decisionMemory: false` ลง config ของทุก project ที่ `init` แล้ว จึงไม่มี project เดิมที่ "ไม่มี key" จริง — เรื่องเดียวกับ Q-4.7.0-01
- Options:
  1. (เลือกแล้ว / แนะนำ) default `true`; config ที่ยังเป็น `false` และไม่มี `decisionMemoryDefault` ถูกเปิดครั้งเดียวตอน `init` แล้วใส่ `decisionMemoryDefault: "4.8.0"`; `false` ที่ตั้งภายหลังถูกเคารพ — ผล: project เดิมได้ recall/suppress ทันที
  2. คง `false` ที่มีอยู่ — ผล: ต้องแก้ config เองทุก project
- Chosen: 1 — สอดคล้องกับ Q-4.7.0-01 และเจตนา §6.3; ค่า `false` เดิมเป็นค่าที่ script เขียน
- Affected: `agm-workspace.mjs#ensureLayout`, `governance-commands.mjs` (`GOVERNANCE_DEFAULTS.decisionMemory`); commit 08c462a (trailer `AGM-Question: Q-4.8.0-01`)
- Rewrite cost: ต่ำ — ลบ 2 บรรทัดใน `ensureLayout`; P4 ไม่พึ่ง (P4 ใช้ `governance.guards` ที่มีปัญหาเดียวกัน — ถ้าเลือกข้อ 2 ให้ใช้ทางเดียวกันกับ guards)
- Owner answer: 1 — เปิดใช้ (2026-09-19)

## Q-4.8.0-02 — ข้อความ §2 แบบสั้นใน core `AGENTS.md`

- Status: rewritten
- Risk: R2 · Confidence: high
- Context: D§20.3.1 ข้อ 2 สั่งให้แทน §2 ใน core ด้วยหัวข้อสั้น + ตาราง 2 แถว (release intent → อ่าน `AGENTS.release.md`; แถว `integrate`) — ข้อความนี้เป็นข้อความใหม่เพียงส่วนเดียวของงานย้ายไฟล์ (ข้อ 8 ห้ามเปลี่ยนความหมายของกติกา release) Agent เขียนเองตาม spec: แถว integrate คงความหมายเดิม (ทำตาม §10.4; ห้าม promote `jenkins`/`jenkins-release`, tag, force push) และเพิ่มประโยคว่า keyword ที่ยกเป็นตัวอย่างไม่ใช่คำสั่ง release (ยกจาก §2 เดิม)
- Options:
  1. (เลือกแล้ว) ตาราง 2 แถวตาม spec + ประโยคเดียว — core 20,752 chars
  2. คงตาราง §2 เต็มไว้ใน core ด้วย (ซ้ำกับไฟล์ release) — core ~29,000 chars เกินเป้า 24,000
- Chosen: 1 — ตรง spec และผ่านเป้าขนาด
- Affected: `skills/agrimap-agent-skills/assets/bootstrap/AGENTS.md` §2, hash ที่ freeze ใน `tests/unit/bootstrap-contract.test.mjs`; commit bba6508
- Rewrite cost: ต่ำ — แก้ข้อความ §2 แล้ว `npm run sync` + อัปเดต hash ใน test; P4 ไม่พึ่ง
- Rewrite: commit 860685d (trailer `AGM-Question: Q-4.8.0-02`, `AGM-Rewrite: owner-answer`); core 21,074 chars
- Owner answer: เน้นทำตาม governance ที่ออกแบบ แต่มนุษย์สั่งเฉพาะเจาะจงแล้ว bypass บางอย่างได้ เช่น โดด version (2026-09-19)

## Q-4.8.0-03 — ค่า default ของ promotion card

- Status: answered
- Risk: R1 · Confidence: high
- Context: D§10.6 กำหนด card R1 สามตัวเลือก (ทีม/เฉพาะฉัน/ไม่ต้อง) แต่ไม่ได้บอกว่า block หรือ default ใด; `validateCard` บังคับ default เมื่อไม่ block
- Options:
  1. (เลือกแล้ว) non-blocking, default ข้อ 3 "ไม่ต้อง" — ไม่ตอบ = ไม่ตั้งค่าอะไร (แต่ยังไม่บันทึก decline จนกว่าจะตอบจริง)
  2. blocking — ต้องตอบก่อนทำงานต่อ
- Chosen: 1 — promotion เป็นเรื่องเสริม ไม่ควรขวางงาน
- Affected: `decision-memory.mjs#promotionCard`; commit 08c462a
- Rewrite cost: ต่ำ
- Owner answer: 1 (2026-09-19)
