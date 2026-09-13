# ตรวจและอัปเดต AGM ด้วย agm-doctor

[เริ่มใช้งาน](GETTING-STARTED.md) · [คำสั่งทั้งหมด](USAGE.md) · [Bootstrap และ Release](RELEASE.md)

`agm-doctor` ดูแลแพ็กเกจ AGM ที่ติดตั้งในเครื่อง แยกจากรุ่นของ host และเอกสาร bootstrap ในโครงการ คำสั่งในตารางพิมพ์ใน **Agent chat** ไม่ใช่ PowerShell executable

| คำสั่ง | สิ่งที่ได้ | เปลี่ยนแปลงเครื่องหรือไม่ |
| --- | --- | --- |
| `agm-doctor` | สรุปรุ่นที่โหลด/ติดตั้ง host และความพร้อมในเครื่อง | ไม่เปลี่ยน |
| `agm-doctor version` | รุ่นที่ติดตั้งเทียบแหล่งที่ติดตั้งได้ พร้อม source/ref และวันที่ตรวจ | ไม่เปลี่ยน |
| `agm-doctor check` | ตรวจ compatibility, configuration และ dependency ตาม workflow พร้อมวิธีแก้ | ไม่เปลี่ยน |
| `agm-doctor update` | อัปเดต AGM สำหรับ host ปัจจุบันเป็นรุ่น stable ที่ตรวจสอบได้ | เปลี่ยนเฉพาะการติดตั้ง AGM ของ host นั้น |
| `agm-doctor update --host claude` | เลือกอัปเดต AGM ใน Claude Code | เช่นเดียวกับ update |
| `agm-doctor update --to 4.1.0` | ติดตั้ง AGM รุ่นที่ระบุ หากแหล่งติดตั้งมีรุ่นนั้นจริง | เช่นเดียวกับ update |

`--host` รับ `codex`, `claude`, `antigravity` หรือชื่อย่อ `agy` ใช้เลือก host สำหรับการตรวจได้ด้วย เช่น `agm-doctor version --host antigravity` ส่วน `--to` ใช้กับ update เท่านั้น หากระบุ `gemini` จะตรวจ legacy installation และแนะนำ migration โดยไม่สลับไปแก้ Antigravity เอง

ตัวอย่างเลือก syntax ตาม host:

```text
$agm-doctor check
/agrimap-agent-skills:agm-doctor check
/agm-doctor check
```

สามบรรทัดคือ Codex, Claude Code และ Antigravity ตามลำดับ เลือกเพียงบรรทัดเดียว ใช้ชื่อ qualified ที่ UI ลงทะเบียนจริงหากแตกต่างจากตัวอย่าง

## อ่านผลความพร้อม

| สถานะ | ความหมาย | ตัวอย่าง |
| --- | --- | --- |
| ready | ตรวจรายการนั้นแล้วผ่าน | Node ตรงขั้นต่ำและอ่าน entrypoint ได้ |
| recommended | แนะนำให้เพิ่ม แต่ไม่ขวางงานที่เลือก | dependency ของ workflow ที่ยังไม่ใช้ |
| missing-required | ขาดหรือรุ่นไม่ตรงสำหรับ workflow ที่ระบุ | SQLFluff ไม่ตรง pin สำหรับ SQL formatting |
| unknown | ยังพิสูจน์ไม่ได้ พร้อมบอกเหตุผล | เข้า remote ไม่ได้ หรือตรวจ host registration ไม่ได้ |

SQLFluff ตรวจเทียบ `assets/tool-versions.json` ไม่ติดตั้งให้จาก check; sql-context-pack ต้องมี service/profile แยกต่างหาก การขาดเครื่องมือ SQL ไม่ทำให้ FE/BE ทั้งหมดใช้งานไม่ได้ และ .NET/release CLI ไม่จำเป็นสำหรับการอัปเดตแพ็กเกจ AGM

รายงานแยก **รุ่นที่ session โหลด**, **รุ่นที่ติดตั้งสำหรับ host ที่เลือก** และ **รุ่นจากแหล่งที่ตรวจได้** หากอ่าน remote ไม่ได้จะแสดง unknown ไม่สรุปว่าเป็นรุ่นล่าสุด รุ่นใน working copy ไม่ได้แปลว่าเผยแพร่แล้ว และ branch snapshot จะระบุแยกจาก tagged release

## การอัปเดตและการกู้คืน

Agent ตรวจ source/scope รุ่นเป้าหมายและความต่าง เตรียมแพ็กเกจพร้อมวิธีกู้คืนก่อนใช้ตัวจัดการ plugin ของ host รักษาการแก้ไขเฉพาะเครื่องและการตั้งค่าที่ไม่เกี่ยวข้อง จากนั้นอ่าน manifest/path ที่ติดตั้งซ้ำเพื่อยืนยันก่อน–หลัง หากคำสั่งล้มเหลวให้หยุดขั้นที่พึ่งพาและรายงานผล recovery ตามจริง ไม่เขียนทับ cache ด้วยมือ

update ไม่อัปเกรดตัว Codex/Claude/Antigravity ไม่ติดตั้ง dependency ของ workflow ไม่อัปเดตอีก host และไม่แก้ bootstrap ในโครงการ หลังสำเร็จเปิด session ใหม่เพื่อโหลดคำสั่งรุ่นใหม่ หากรุ่น `--to` ยังไม่เผยแพร่หรือ host เลือกรุ่นนั้นไม่ได้ Agent ต้องแจ้งข้อจำกัดและทางเลือกที่ตรวจได้ ไม่เปลี่ยนเป็น latest โดยเงียบ ๆ

สำหรับ Antigravity ใช้ `agy plugin install` ตาม [เอกสารทางการ](https://antigravity.google/docs/cli/plugins) และตรวจ `agy plugin --help` ของรุ่นที่ติดตั้งก่อนเลือกวิธีแทนที่ ไม่สมมติว่ามี subcommand update เอกสาร [migration](https://antigravity.google/docs/cli/gcli-migration) ยังคงรองรับ `GEMINI.md`

## อัปเดต bootstrap หลังอัปเดตแพ็กเกจ

เมื่ออยากอัปเกรดเอกสารของโครงการ ให้เปิดโครงการเป้าหมายแล้วใช้:

```text
$agm-release bootstrap upgrade
```

Agent ตรวจ diff ก่อน โดยขอบเขต bootstrap ใน bundle 4.5.1 มีไฟล์ต่อไปนี้ (path อ้างอิงจาก root ของโครงการเป้าหมาย ไม่ใช่โฟลเดอร์ cache ของ skill):

| ไฟล์ | สิ่งที่ Agent จะอัปเดต |
| --- | --- |
| `AGENTS.md` | อัปเดตกฎ bootstrap และ version marker โดยรักษา/merge กฎเฉพาะโปรเจกต์ |
| `CLAUDE.md` | อัปเดต pointer ไปยัง `AGENTS.md` สำหรับ Claude โดยรักษาข้อกำหนดเฉพาะที่มีอยู่ |
| `GEMINI.md` | อัปเดต pointer ไปยัง `AGENTS.md`; ยังคงใช้ชื่อไฟล์นี้สำหรับ Antigravity |
| `CURSOR.md` | อัปเดต pointer ไปยัง `AGENTS.md` สำหรับ Cursor |
| `README.md` | เพิ่มหรืออัปเดตเฉพาะ Deployment block ระหว่าง `<!-- BEGIN AGRIMAP DEPLOYMENT -->` และ `<!-- END AGRIMAP DEPLOYMENT -->` โดยรักษาเนื้อหาส่วนอื่น |
| `release-notes/README.md` | อัปเดตคู่มือ release notes ไม่แก้ไฟล์ notes ของรุ่นที่เคยออกแล้ว |

ไฟล์ที่ขาดจะถูกสร้าง ส่วนไฟล์ที่ตรงกับ bundle หรือ reviewed merge เดิมแล้วจะไม่ถูกเขียนซ้ำ รายการนี้เป็นขอบเขตที่ตรวจ ไม่ได้หมายความว่าทุกไฟล์จะเปลี่ยนทุกครั้ง หากพบ custom rules จะ merge อย่างเจาะจงและถามเฉพาะข้อขัดแย้งที่ตัดสินไม่ได้ ไม่เขียนทับกฎเฉพาะโดยเงียบ ๆ

หลักฐานที่เกี่ยวข้องกับการอัปเดต:

| Path | หน้าที่ |
| --- | --- |
| `.agrimap-agent/runtime/bootstrap.json` | สร้าง/อัปเดต receipt หลัง apply สำเร็จ บันทึกรุ่น ชนิดโครงการ รายการไฟล์และ hash |
| `.agrimap-agent/runtime/bootstrap-backups/<hash>/<path เดิม>` | สำรองเนื้อหาเดิมก่อนแทนที่ไฟล์หรือ merge กฎเฉพาะ; ไม่ใช่การ clone โครงการ |

คำสั่งนี้ไม่แก้ Jenkinsfiles, version ของ product, changelog หรือ release notes รุ่นเก่า และไม่ commit/push/tag ส่วน `agm-release upgrade` เดิมเป็นโหมดแทนที่ contract ใน bundle พร้อม backup ดูขอบเขตใน [Release](RELEASE.md#bootstrap)
