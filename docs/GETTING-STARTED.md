# Getting Started — เริ่มใช้ AgriMap Skills

[หน้าหลัก](../README.md) · [คำสั่งทั้งหมด](USAGE.md) · [ตัวอย่างพร้อมใช้](COMMAND-COOKBOOK.md)

เป้าหมาย: ติดตั้งกับ host ที่ใช้อยู่ เปิดโครงการ และทดลองอ่านโค้ดหนึ่งครั้ง ไม่จำเป็นต้องรู้ชื่อ model, workflow_depth หรือคำสั่ง runtime

## 1. เตรียมเครื่อง

ต้องมี Git, Node.js 20 ขึ้นไป และ host อย่างใดอย่างหนึ่งที่ติดตั้ง/ลงชื่อเข้าใช้แล้ว: Codex, Claude Code หรือ Gemini CLI

**รันใน Terminal / PowerShell:**

```powershell
git --version
node --version
```

ถ้าไม่พบคำสั่ง ให้จัดเตรียม dependency ตามวิธีของทีมก่อน ไม่ต้องติดตั้งทั้งสาม host

## 2. ติดตั้งสำหรับ host ของคุณ

เลือกเพียงหนึ่งหัวข้อ คำสั่งในขั้นนี้ติดตั้ง plugin/extension จึงเปลี่ยน configuration ของ host ไม่ใช่คำสั่งถาม Agent และไม่แก้ source ของโครงการ

### Codex

**Terminal / PowerShell:**

```powershell
codex plugin marketplace add gasxhermvc/agrimap-agent-skills
codex plugin add agrimap-agent-skills@agrimap-agent-skills
```

ถ้ารุ่นที่ใช้ไม่รู้จัก subcommand ให้ตรวจ `codex plugin --help` และ [Troubleshooting](TROUBLESHOOTING.md) ก่อน ไม่ใช้ slash command ของ Claude แทน รูปแบบ CLI ข้างต้นตรวจจาก local CLI help เมื่อ 2026-09-08; การมองเห็น/ติดตั้ง plugin ยังขึ้นกับ host และ workspace configuration ดู [OpenAI plugin documentation](https://learn.chatgpt.com/docs/plugins)

### Claude Code

**Terminal / PowerShell:**

```powershell
claude plugin marketplace add gasxhermvc/agrimap-agent-skills
claude plugin install agrimap-agent-skills@agrimap-agent-skills
```

Claude ใช้ชื่อ plugin กำกับคำสั่ง เช่น `/agrimap-agent-skills:agm-analyze` การเพิ่ม marketplace อย่างเดียวยังไม่ใช่ติดตั้ง plugin ดู [Claude Code installation](https://code.claude.com/docs/en/discover-plugins)

### Gemini CLI

**Terminal / PowerShell ไม่ใช่ใน Gemini chat:**

```powershell
gemini extensions install https://github.com/gasxhermvc/agrimap-agent-skills
```

ตรวจคำขอความยินยอมของ host ตามปกติ ไม่ต้องเพิ่ม flag ข้าม consent ดู [Gemini extension reference](https://geminicli.com/docs/extensions/reference/)

### ถ้าต้องการ source ที่เพิ่งแก้ในเครื่อง

คำสั่งจาก GitHub ได้เฉพาะสิ่งที่เผยแพร่ไปแล้ว อาจยังไม่ใช่ 3.0.1 ที่อยู่ใน working copy ใช้ [การติดตั้ง local package](MAINTAINING.md#local-install) แทน อย่าคัดลอกไฟล์เข้า cache ด้วยมือ

## 3. เปิด session ใหม่ในโครงการเป้าหมาย

เปิด root ของ AgriMap project ที่ต้องการทำงาน ไม่ใช่ root ของ skill package นี้ หลังติดตั้ง/อัปเดต เปิด session ใหม่เพื่อให้ host โหลดคำสั่งและ instruction ใหม่

ยังไม่ต้อง init หรือ bootstrap เพื่อถามคำถาม การ bootstrap เอกสารลงโครงการเป็นงานแยกที่ต้องร้องขอ ดู [Bootstrap](RELEASE.md#bootstrap)

## 4. ทดลองอ่านอย่างเดียว

**พิมพ์ใน Agent chat — เลือก host:**

Codex:

```text
$agm-analyze ช่วยสรุปโครงสร้างโปรเจกต์นี้จากไฟล์จริง ระบุ entry point และโฟลเดอร์หลัก ยังไม่แก้ไฟล์และไม่รัน test
```

Claude Code:

```text
/agrimap-agent-skills:agm-analyze ช่วยสรุปโครงสร้างโปรเจกต์นี้จากไฟล์จริง ระบุ entry point และโฟลเดอร์หลัก ยังไม่แก้ไฟล์และไม่รัน test
```

Gemini CLI:

```text
/agm-analyze ช่วยสรุปโครงสร้างโปรเจกต์นี้จากไฟล์จริง ระบุ entry point และโฟลเดอร์หลัก ยังไม่แก้ไฟล์และไม่รัน test
```

ตรวจผลสามอย่าง: อ้างไฟล์ที่มีจริง, ไม่มี product diff ใหม่, ไม่สร้าง tasks สำหรับคำถามนี้ raw prompt history ที่เกี่ยวข้องอาจถูกเก็บโดย hook แยกจาก task

หากมีแต่การเดาข้อมูล หรือถามชื่อ owner ก่อนตอบคำถามนี้ อ่าน [Troubleshooting](TROUBLESHOOTING.md)

## 5. เริ่มงานแก้ไขเมื่อพร้อม

ใช้ [Cookbook](COMMAND-COOKBOOK.md) เลือก FE/BE/SQL ให้ตรงงาน เปลี่ยน path ตัวอย่างเป็นไฟล์จริง แล้วระบุผลลัพธ์ที่ต้องการ สิ่งที่ต้องคงเดิม และวิธีดูว่าทำเสร็จ

ไม่ต้องเรียก analyze → plan → prompt → exec → qa ให้ครบทุกครั้ง หากรู้สิ่งที่จะเปลี่ยนชัดแล้ว สั่ง `agm-fe action=edit` หรือ `agm-be action=edit` ได้ตรง ๆ

ก่อนงานที่ต้องบันทึก Agent อาจขอชื่อผู้สั่งที่ยังไม่เคยยืนยัน ยืนยันชื่อจริงที่ต้องการใช้อ้างอิง ไม่ต้องกรอก role=owner เพื่อให้ทุกคำสั่งทำงาน ชื่อไม่ใช่สิทธิ์ release

## ไปต่อ

- [ดูคำสั่งตามประเภทงาน](USAGE.md)
- [ลองโจทย์พร้อมใช้](COMMAND-COOKBOOK.md)
- [เข้าใจว่าเมื่อไรสร้าง task และทดสอบ](WORKFLOWS.md)
