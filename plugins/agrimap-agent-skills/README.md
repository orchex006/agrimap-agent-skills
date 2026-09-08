# AgriMap Agent Skills 3.0.1

ชุดคำสั่งสำหรับให้ Agent ช่วยงาน AgriMap ตั้งแต่วิเคราะห์ ออกแบบ แก้โค้ด ตรวจงาน จนถึงเตรียม release ใช้กับ Codex, Claude Code และ Gemini CLI โดยเลือกคำสั่งตามงาน ไม่ต้องเดินครบทุก workflow

**เริ่มที่ [Getting Started](docs/GETTING-STARTED.md)** — ติดตั้งให้ตรง host แล้วทดลองคำสั่งอ่านอย่างเดียวก่อน

## เลือกอ่านตามสิ่งที่ต้องการ

| ต้องการ | ไปที่ |
| --- | --- |
| ติดตั้งและทดลองครั้งแรก | [Getting Started](docs/GETTING-STARTED.md) |
| เลือกคำสั่ง / ดูความต่างของ analyze, prompt, exec, QA | [คู่มือคำสั่ง](docs/USAGE.md) |
| คัดลอกโจทย์ไปใช้กับงานจริง | [ชุดคำสั่งสำหรับผู้เริ่มต้น](docs/COMMAND-COOKBOOK.md) |
| เข้าใจ task, memory, identity, QA และ SQL context | [Workflow](docs/WORKFLOWS.md) |
| เตรียมโครงการ / ส่ง Inhouse / ส่ง Production | [Bootstrap และ Release](docs/RELEASE.md) |
| คำสั่งไม่ขึ้น / ยังเจอพฤติกรรมรุ่นเก่า | [Troubleshooting](docs/TROUBLESHOOTING.md) |
| เคยใช้ 2.x | [Migration 3.0](docs/MIGRATION-3.0.md) |
| แก้ไขหรือแจกจ่าย skill package นี้ | [คู่มือผู้ดูแล](docs/MAINTAINING.md) |

## ทดลองหนึ่งคำสั่ง

พิมพ์ **ในช่องสนทนา Agent** ไม่ใช่ PowerShell เลือกเพียงบรรทัดของ host ที่ใช้:

| Host | คำสั่งอ่านอย่างเดียว |
| --- | --- |
| Codex | `$agm-analyze ช่วยสรุปโครงสร้างโปรเจกต์นี้จากไฟล์จริง ยังไม่แก้ไฟล์` |
| Claude Code | `/agrimap-agent-skills:agm-analyze ช่วยสรุปโครงสร้างโปรเจกต์นี้จากไฟล์จริง ยังไม่แก้ไฟล์` |
| Gemini CLI | `/agm-analyze ช่วยสรุปโครงสร้างโปรเจกต์นี้จากไฟล์จริง ยังไม่แก้ไฟล์` |

สิ่งที่ควรได้: คำอธิบายพร้อมตำแหน่งไฟล์ ไม่ใช่การแก้โค้ด สร้าง task หรือรัน test ทั้งโครงการ คำถามทั่วไปพิมพ์ได้ตามปกติ ไม่จำเป็นต้องเรียก skill

## คำแนะนำที่มีหลักฐาน

Design ทำงานแบบ passive ในคำสั่งที่เหลือ: เสนอเมื่อข้อมูลพอ หากไม่พอให้แจ้งสิ่งที่ขาด แยกข้อเท็จจริงจากสมมติฐาน และบอกข้อจำกัด/ความมั่นใจ คำแนะนำชั่วคราวต้องมีเงื่อนไขชัดเจน ไม่เดาข้อมูลเพื่อเติมคำตอบ และไม่ถือเป็นสิทธิ์ implement

## ขอบเขตที่ควรรู้

- คำสั่งวิเคราะห์ไม่อนุญาตให้แก้โค้ด; คำสั่งแก้โค้ดไม่อนุญาตให้ push หรือ deploy โดยอัตโนมัติ
- ไม่ต้องสร้าง Prompt Result ก่อนทุกงาน ใช้ `agm-prompt` เมื่อต้องการคำสั่งที่เก็บและส่งต่อได้จริง
- SQL context อ่าน metadata และ SELECT แบบจำกัด/ปกปิดข้อมูลได้ แต่ห้าม execute database writes หรือ stored procedures
- Bootstrap ติดตั้งเอกสารโครงการ ไม่สร้าง pipeline หรือ deploy; flow release คือ `develop → jenkins → jenkins-release`
- คำสั่งที่ยกตัวอย่างในเอกสารไม่ใช่การอนุมัติให้ Agent รัน

## การบันทึกงาน

<!-- BEGIN GENERATED TASK ARTIFACT SCHEMA -->
Ordinary answers: no execution/task artifacts. Bounded writes: concise memory/audit.
Tracked v3 work: one task.md with scope, acceptance, progress, evidence and result.
Separate analysis/QA/results/reports are consumer-requested deliverables, not a five-file gate.
Legacy v2 five-file validation remains in assets/task-artifact-schema.json for existing executions only; it is not the new-work checklist.
<!-- END GENERATED TASK ARTIFACT SCHEMA -->

## สำหรับผู้ดูแล package

ต้นฉบับอยู่ใน `config/operations.json`, `skills/agrimap-agent-skills/`, `docs/` และ `examples/` แก้ต้นฉบับแล้วใช้ `npm run sync`; อย่าแก้ generated mirror แยกเอง อ่าน [วิธีตรวจและแจกจ่าย](docs/MAINTAINING.md) ก่อนรันคำสั่งผู้ดูแล

Repository: [gasxhermvc/agrimap-agent-skills](https://github.com/gasxhermvc/agrimap-agent-skills) · [Changelog](CHANGELOG.md)

เลขเวอร์ชันใน source ไม่ได้ยืนยันว่า remote หรือ plugin cache ของผู้ใช้ได้รับเวอร์ชันนั้นแล้ว
