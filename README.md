# AgriMap Agent Skills 3.2.3

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

<a id="agm-release"></a>

## Release ด้วย `$agm-release`

ระบุโครงการเป้าหมาย แล้วพิมพ์คำสั่งในช่องสนทนา Agent ตัวอย่าง `$agm-release release production` คำสั่งในตารางเป็นคำสั่งของสกิล ไม่ใช่คำสั่ง PowerShell ของ CLI

ทุก Flow ตรวจ Git, .NET และ CLI `agm-release` ก่อน หากขาดจะติดตั้งจากแหล่งทางการ/แหล่งของโครงการและตรวจซ้ำ หากขาดสิทธิ์หรือเข้าแหล่งติดตั้งไม่ได้ Agent จะแจ้งสาเหตุจริงและขั้นที่ค้าง เครื่องมือที่ใช้งานได้อยู่แล้วจะใช้ต่อ

| คำสั่ง | สิ่งที่ Agent ทำตามลำดับ | เพิ่มเวอร์ชัน | Push ไปที่ใด | ต้องยืนยันก่อน Production/tag |
| --- | --- | --- | --- | --- |
| `$agm-release indexing` | ตรวจ source/diff/history → อัปเดต project index และ changelog | ไม่เพิ่ม | ไม่มี; แก้ไฟล์ในเครื่อง | ไม่เกี่ยวข้อง |
| `$agm-release prepare inhouse` | เตรียม Inhouse version → อัปเดต index/changelog → ตรวจความถูกต้อง; ไม่สร้าง release notes | Inhouse +0.0.1 | ไม่มี; เตรียมในเครื่อง | ไม่เกี่ยวข้อง |
| `$agm-release prepare production` | เตรียม version และ notes → ตรวจความถูกต้อง | Production +0.0.1 | ไม่มี; เตรียมในเครื่อง | ยังไม่ถึงขั้น promote |
| `$agm-release pipeline inhouse` | ตรวจ candidate ที่เตรียมแล้ว → commit → push/ตรวจ SHA | ไม่เพิ่มซ้ำ | `develop → jenkins` | ไม่เกี่ยวข้อง |
| `$agm-release pipeline production` | ตรวจ Production candidate → commit → push/ตรวจ SHA → เตรียมแผนส่ง Production | ไม่เพิ่มซ้ำ | `develop → jenkins`; ยังไม่ push Production | รอคำสั่ง promote |
| `$agm-release promote` | แสดง SHA/version/notes/tag → ขอคำยืนยัน → push Production → สร้างและ push annotated tag | ไม่เพิ่ม | `jenkins-release` และ tag ของ Production เท่านั้น | **ต้องยืนยันทุกครั้งก่อนทำจริง** |
| `$agm-release release full` | indexing → prepare ทั้งสองฝั่ง → notes เฉพาะ Production → pipeline Inhouse/Production ใช้ candidate เดียว → ยืนยัน → promote | Inhouse และ Production +0.0.1 แยกกัน | `develop → jenkins → jenkins-release` + Production tag | **ต้องยืนยันก่อน promote** |
| `$agm-release release production` | indexing → prepare Production → pipeline Production → ยืนยัน → promote | Production +0.0.1; Inhouse คงเดิม | ผ่าน `develop → jenkins` ไป `jenkins-release` + Production tag | **ต้องยืนยันก่อน promote** |
| `$agm-release release inhouse` | indexing → prepare Inhouse → pipeline Inhouse | Inhouse +0.0.1 | `develop → jenkins`; ไม่มี Production/tag | ไม่เกี่ยวข้อง |

`project.md` ใน Flow นี้คือ `.agrimap-agent/memory/project.md` ส่วน changelog คือ `changelog.md` ที่ root ของโครงการ เปลี่ยน PATCH เช่น `1.2.9 → 1.2.10` โดยอ่าน Inhouse จาก `Jenkinsfile` และ Production จาก `Jenkinsfile_Production` หากทำต่อจาก candidate เดิมจะไม่เพิ่มเลขซ้ำ

หากยังไม่มี Project Memory คำสั่ง indexing/prepare/release จะทำ indexing จากหลักฐานและสร้าง `.agrimap-agent/memory/project.md` พร้อมโฟลเดอร์ที่จำเป็นให้ใน flow เดิม ไม่ต้องสั่ง Project Backfill หรือ bootstrap แยก และไม่อ้างว่าได้ backfill ประวัติทั้งโครงการแล้ว ส่วน standalone pipeline/promote ต้องพิสูจน์ candidate ที่เตรียมแล้วก่อน reconstruct memory

**Release notes และ tag เป็นของ Production เท่านั้น:** ถ้า candidate Inhouse เป็น `1.0.6` และ Production เป็น `1.0.3` ให้สร้าง `release-notes/1.0.3.md` และใช้ tag `v1.0.3` ห้ามนำเลข Inhouse ไปสร้าง `release-notes/1.0.6.md` งาน Inhouse-only ไม่แก้ `release.md` หรือ versioned notes ประวัติเดิมต้องคงอยู่

คำสั่ง `pipeline` และ `promote` แบบแยกขั้นต้องมี candidate ที่เตรียมแล้ว หากยังไม่มี Agent จะแจ้ง prerequisite ไม่เลือก `prepare both` หรือเพิ่มเลขเอง ส่วน `release full/production/inhouse` ทำทุกขั้นที่อนุญาตต่อเนื่อง AI หา SHA ตรวจเครื่องมือ และแก้ปัญหาตามหลักฐานเอง มนุษย์ไม่ต้องสร้าง SHA หรือรัน Git

สกิลตรวจความเข้ากันได้ของ CLI ก่อน prepare ด้วย: source CLI ที่ตรวจพบยังสร้าง notes ตาม environment ในบาง mode และตรวจ Tag metadata ใน notes จึงไม่ถือว่า CLI ที่ติดตั้งได้จะรองรับ Flow ใหม่ครบโดยอัตโนมัติ หากเป็นข้อขัดแย้งกับ gate ที่ target บังคับ จะเก็บหลักฐานและหยุดขั้นที่เกี่ยวข้อง ไม่สร้าง notes ผิดฝั่งหรืออ้างว่าตรวจผ่าน

**จุดยืนยันอยู่ก่อน push Production จริง:** `pipeline production` เตรียมจนพร้อม แล้ว `promote` จึงถามยืนยัน SHA ปลายทางและ tag ที่แน่นอน การพิมพ์ `promote` หรือ `release` ยังไม่ใช่คำยืนยันนี้ หาก candidate เปลี่ยนต้องยืนยันแผนใหม่

Pipeline ในตารางหมายถึงส่ง Git branch ตามลำดับภายใต้ trigger ที่ server ตั้งไว้ ไม่ต้องรอ Jenkins เขียว และไม่ใช่หลักฐานว่า deploy ขึ้น server สำเร็จ หลังจบจะบันทึกผล audit ตามกฎของโครงการ; audit commit บน develop จะไม่ถูก promote/tag เพิ่ม คำสั่งใหม่ไม่เหมารวมสิทธิ์เผยแพร่งานค้างที่ไม่เกี่ยวข้อง

รายละเอียดสำหรับ Agent: [Release contract](skills/agrimap-agent-skills/references/release-workflow.md) · [Flow เดิมและ Bootstrap](docs/RELEASE.md)

ขั้นตอนครบทั้ง 9 คำสั่ง: [Release steps](skills/agrimap-agent-skills/references/release-steps.md) · ตรวจ/ติดตั้ง .NET Tool และแก้ปัญหา: [Release tools](skills/agrimap-agent-skills/references/release-tools.md)

กฎเดียวกันใช้กับกลุ่มโมเดลที่ผู้ใช้ระบุ: GPT-5.4/5.5, GPT-5.6 Luna/Terra/Sol, GPT-6 Astra ขึ้นไป; Claude Sonnet 5, Opus 4.8/5; Gemini 3.6 Flash ขึ้นไป รายชื่อนี้เป็นเป้าหมายการใช้งาน ไม่ใช่ผลรับรองว่าทดลองทุกโมเดลแล้ว

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
