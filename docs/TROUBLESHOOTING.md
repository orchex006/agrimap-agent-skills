# Troubleshooting

[เริ่มต้น](GETTING-STARTED.md) · [Workflow](WORKFLOWS.md) · [ผู้ดูแล package](MAINTAINING.md)

เริ่มจากตรวจอย่างเดียว อย่าลบ .agrimap-agent, cache หรือ reinstall ทั้งหมดเป็นขั้นแรก

## คำสั่งไม่ขึ้นหรือพิมพ์แล้วไม่ทำงาน

1. ตรวจว่าพิมพ์ใน Agent chat ไม่ใช่ Terminal
2. Codex ใช้ $agm-X; Claude ใช้ /agrimap-agent-skills:agm-X; Antigravity ใช้ /agm-X
3. ตรวจว่าติดตั้ง plugin แล้ว ไม่ใช่แค่เพิ่ม marketplace
4. เปิด session ใหม่ ตรวจรายการ skill/command ของ host
5. ขอ help ของ alias โดยไม่สั่งงาน เช่น Codex: `$agm-be -h`

ถ้า terminal ไม่รู้จัก plugin subcommand ให้ดู `codex plugin --help`, `claude plugin --help` หรือ `agy plugin --help` สำหรับ host ที่ใช้ ไม่คัดลอก flag จากอีก host

## Source เป็น 3.0 แต่ Agent ยังทำแบบ 2.x

Repository, installed cache และ session ที่โหลดแล้วเป็นคนละสิ่ง ตรวจ version/path ใน installation ที่ host ใช้ ถ้า 3.0 ยังไม่เผยแพร่บน remote การ install จาก GitHub จะไม่ได้ working copy ล่าสุด ใช้ [local install](MAINTAINING.md#local-install)

ไม่แก้ cached SKILL.md เอง เพราะจะ drift จากต้นฉบับและหายเมื่อ host อัปเดต

## ถามทั่วไปแต่สร้าง tasks / ถาม owner / รัน tests

ตรวจสองแหล่ง: installed package รุ่นไหน และ AGENTS ของ project มีคำสั่ง legacy บังคับทุก request หรือไม่ การเปลี่ยน package ไม่ลบกฎของ project เดิมโดยอัตโนมัติ

บอก Agent ว่า “เป็นคำถามอ่านอย่างเดียว ไม่ขอ durable report/tracking” หากยังเกิด ให้ส่ง prompt ที่ปกปิดข้อมูลแล้ว พร้อม host, installed version/path และชื่อ artifacts ที่ถูกสร้าง อย่าส่ง raw log ทั้งชุดที่มีข้อมูลส่วนบุคคล

## ยังขอชื่อใหม่ทุกวัน

ใน 4.1.0 ให้ใช้ชื่อที่ยืนยันแล้วในบทสนทนาก่อน แล้วตรวจ `agm-workspace.mjs requester --session <actual-session>` ใน project เดิม ไม่ใช้ init เป็นคำสั่งตรวจเพราะ init เขียน layout รุ่นนี้แก้ `start --requested-by` ที่เคยถูกมองข้าม และรวม resolver ของ hook/runtime ให้ใช้ session/local confirmation แบบเดียวกัน Persistent confirmation ไม่หมดอายุรายวัน ส่วน expired/revoked หรือข้อมูลจากเครื่องอื่นไม่ใช่ confirmation ใหม่

ถ้า `project-bootstrap.mjs` แจ้ง `args._` undefined ให้ตรวจ path/version ของ bundle ที่โหลด รุ่น 4.1.0 แก้ CLI caller แล้ว อัปเดตจาก canonical package ผ่าน host manager; การแก้ source ไม่เปลี่ยน cache 3.6.1 ของ session ที่ยังเปิดอยู่

v3 default ไม่หมดอายุรายวัน แต่ existing .agrimap-agent/config.json อาจมี identity.confirmationHours เป็น 24 หรือค่าอื่น หรือยังโหลด hook เก่า ตรวจค่าก่อน การยกเลิก expiry เป็นนโยบาย workspace ที่ควรเลือกชัดเจน ไม่เปลี่ยนชื่อผู้สั่งแทนเพื่อผ่าน gate ดู [Migration](MIGRATION-3.0.md)

## PACKAGE_ENTRYPOINT_MISSING

Generated operation file ขาด/เสีย ใน source package ผู้ดูแลใช้ sync และ validate แล้วติดตั้งรุ่นที่ตรงกันใหม่ ใน project อย่าแก้โดยให้ router ลงมือแทนหรือสร้างไฟล์ service เพิ่ม

## WORKFLOW_DEPTH_REASON_MISMATCH

มีการระบุ --depth ไม่ตรงกับ tracking/risk จริง ตัด depth ที่เดาออก ให้เลือกจากงาน: bounded=light, resume/handoff=standard, actual risk=regulated อย่าเพิ่ม risk ปลอมเพื่อให้คำสั่งผ่าน

## PROMPT_SOURCE_CONFIRM_REQUIRED / version ไม่เพิ่ม

- แหล่ง source ไม่ชัดหรือมีหลาย family: ระบุ path Prompt Result ล่าสุดใน family ที่ตั้งใจ
- ต้องการแค่ explain/approve หรือเนื้อหาเดิม: ไม่เพิ่ม version เป็นพฤติกรรมที่ถูกต้อง
- PROMPT_CHANGE_EVIDENCE_REQUIRED: revision ต้องมี requester-backed delta; อย่าเติม requirements เองให้ดูต่าง
- Approval ผูก exact source/hash ใน audit ไม่ใช่แก้ status ใน immutable file

## Bootstrap conflict / hash mismatch

Conflict คือพบเอกสารเดิมต่างจาก bundle ไม่ใช่สัญญาณให้ force overwrite ตรวจ plan และตกลง merge/adopt ก่อน

BOOTSTRAP_BUNDLE_HASH_MISMATCH หมายถึง source bundle ไม่ตรง manifest ให้ผู้ดูแลตรวจ bytes/provenance และ regenerated package อย่า rehash อัตโนมัติโดยไม่รู้ว่าเนื้อหาเปลี่ยนเพราะอะไร

## SQL context ใช้ไม่ได้

ตรวจว่า external sql-context-pack/service พร้อมและ conversation นี้มี connected profile หากไม่มีให้ส่ง sanitized schema หรือ local file ที่มี authority แทน ไม่สร้าง connection เอง ไม่เรียก EXEC เพื่อทดสอบ และไม่ sync metadata เพื่อแก้ปัญหา read access

## Push สำเร็จแต่ไม่รู้ว่า deploy ผ่านไหม

ดู pipeline/run ของ environment ที่ push ไป: jenkins=Inhouse, jenkins-release=Production Remote SHA ยืนยัน Git publication เท่านั้น หากไม่มีสิทธิ์ดู Jenkins ให้รายงาน deployment unverified ไม่อ้าง success ดู [Release](RELEASE.md)

## ข้อมูลที่ช่วยให้ตรวจปัญหาได้เร็ว

ส่งเฉพาะ host/version, installed package version/path, project kind, คำสั่งที่ใช้, expected/observed behavior และ error ที่ปกปิดข้อมูล ห้ามส่ง credentials หรือ SQL connection string
