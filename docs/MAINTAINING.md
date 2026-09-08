# ดูแลและพัฒนา skill package

[หน้าหลัก](../README.md) · [เริ่มใช้งาน](GETTING-STARTED.md) · [Migration](MIGRATION-3.0.md)

หน้านี้สำหรับผู้ดูแล package หรือ Agent ที่ต้องใช้ runtime โดยตรง ผู้ใช้ทั่วไปไม่ต้องรัน start/checkpoint/complete เอง และไม่ต้อง clone repository เพื่อถามคำถาม

## แผนที่ source

| ตำแหน่ง | เจ้าของเนื้อหา |
| --- | --- |
| config/operations.json | ชื่อ/description/actions/ตัวอย่าง/เส้นทาง references ของ operation |
| skills/agrimap-agent-skills/SKILL.md | Router เท่านั้น |
| skills/agrimap-agent-skills/references | กฎและความรู้ที่ Agent โหลดตามงาน |
| skills/agrimap-agent-skills/scripts | Runtime, hooks, validators และ bootstrap |
| skills/agrimap-agent-skills/assets/bootstrap | เอกสารโครงการ canonical พร้อม hashes |
| docs และ examples | คู่มือผู้ใช้/ผู้ดูแลและโจทย์ตัวอย่าง |
| commands, plugins/agrimap-agent-skills | Generated adapters และ mirror; ไม่แก้โดยตรง |
| tests | Regression/fixture tests ไม่ใช่ project service |
| .agrimap-agent | Local evidence ของการพัฒนา package ไม่ใช่ไฟล์แจกจ่าย |

Golden patterns และ manifests เป็นหลักฐานอ้างอิง ไม่เปลี่ยน bytes หรือ rehash เพื่อให้ validator ผ่านโดยไม่ตรวจ provenance เอกสารเก่าใน CHANGELOG และ v2 fixtures เป็นประวัติ ไม่ใช่กฎ v3

## แก้ไขและตรวจให้พอดี

**Terminal จาก root ของ package:**

```powershell
npm run sync
npm run validate
```

sync สร้าง operation entrypoints, aliases, Gemini commands, manifests และสำเนาเอกสารจากต้นฉบับ จึงเขียนทับ generated files ตรวจ diff ต้นฉบับก่อนสั่ง ไม่ใช้ sync กับโครงการ product

- เอกสารอย่างเดียว: ตรวจลิงก์ ความถูกต้องของคำสั่ง และ generated mirrors
- `npm run test:docs` ตรวจเอกสารและ negative fixtures โดยไม่ execute ตัวอย่าง install/release
- Runtime/script เปลี่ยน: รัน targeted tests ที่เกี่ยวข้อง
- ก่อนส่ง package ที่เปลี่ยนหลาย contract: `npm test` เป็น release gate ของ package
- Routes/budgets เปลี่ยน: `npm run audit:tokens:strict`
- อย่ารัน test:workspace, test:usage, test:integration ต่อกันโดยอัตโนมัติ ทั้งสามเป็นชื่อ compatibility ที่เรียก v3 fixture suite เดียวกัน
- test:legacy-v2 เก็บ expectations รุ่นเก่าไว้ ไม่ใช่ v3 acceptance gate

Token estimates ไม่ใช่ผล benchmark model จริง และ npm test ไม่ใช่การ test against database หรือ Jenkins

<a id="local-install"></a>
## ติดตั้งจาก working copy

ใช้เมื่อต้องลอง source ที่ยังไม่ publish สั่ง sync และ validate ก่อน แล้วเลือก host เดียว **คำสั่งนี้เปลี่ยน host installation/configuration** ไม่ใช่ส่วนบังคับของการตรวจ docs

Terminal ต้องอยู่ root package ที่มี package.json และ marketplace manifests:

Codex:

```powershell
codex plugin marketplace add .
codex plugin add agrimap-agent-skills@agrimap-agent-skills
```

Claude Code:

```powershell
claude plugin marketplace add .
claude plugin install agrimap-agent-skills@agrimap-agent-skills
```

Gemini CLI (development link):

```powershell
gemini extensions link .
```

หาก marketplace ชื่อเดียวกันชี้ remote อยู่แล้ว ให้ตรวจรายการและ source ที่ host เลือกก่อน อย่าสมมติว่ารัน add ซ้ำแล้วเปลี่ยน source/cache สำเร็จ ใช้ help ของรุ่นนั้นและขั้นตอนจัดการ marketplace ของ host ไม่ลบ cache เอง

เปิด session ใหม่และตรวจ installed version/path การ sync repository ไม่ refresh cached plugin ของ session เดิม และไม่เท่ากับเผยแพร่ GitHub

## Provider adapters

Codex/Claude เลือก hooks คนละไฟล์ผ่าน manifest ไม่สร้าง default hooks/hooks.json ร่วมใน plugin root ส่วน Gemini ใช้ root extension hooks และ read-only stdio MCP เพื่ออ่าน bundled references

MCP ของ package นี้ให้ reference text ไม่ใช่ SQL connection ไม่มีการติดตั้ง sql-context-pack แฝงไปด้วย ต้องมี external skill/service และ connected profile ที่ใช้ได้อยู่แล้ว

## Runtime: ใช้เฉพาะเมื่อจำเป็น

คำสั่งด้านล่างเป็นตัวอย่าง **PowerShell** แทน path, session, ชื่อคนและ model ด้วยค่าจริงก่อนรัน:

```powershell
$agmPackage = 'D:\path\to\agrimap-agent-skills'
$agmProject = 'D:\path\to\target-project'
$agmScripts = Join-Path $agmPackage 'skills/agrimap-agent-skills/scripts'
```

**ยืนยันผู้สั่งงาน** เมื่อได้รับชื่อจากคนนั้นแล้วเท่านั้น; ตัวอย่างนี้เลือก persistent confirmation อย่างชัดเจน:

```powershell
node "$agmScripts/agm-workspace.mjs" identify --cwd "$agmProject" --session "[actual-session]" --owner "[confirmed-human]" --model "[host-reported-model]" --provider codex --confirmation-hours 0
```

เปลี่ยน provider ตาม host จริง ไม่ใช้ชื่อ model เป็น provider และไม่เอา OS/Git username มาแทนการยืนยัน

**เริ่มงาน bounded ที่อนุมัติแล้ว**:

```powershell
node "$agmScripts/agm-workspace.mjs" start --cwd "$agmProject" --session "[actual-session]" --operation execute --title "Implement the authorized bounded change"
```

ต้องการ resume/handoff เพิ่ม `--tracking` ส่วน `--risk` ใช้เฉพาะเหตุผลจริง: external-publication, persisted-data-change, public-contract-change, independent-assurance, security-boundary ไม่ใช่สิทธิ์ execute SQL writes

ไม่ต้องระบุ --depth ตามอำเภอใจ runtime ตรวจว่า depth ตรงกับ tracking/risk ส่วนคำถาม read-only ไม่ start เว้นแต่ร้องขอ persistent deliverable

**บันทึกหลักฐานหลังตรวจจริง** ใช้ executionId ที่ start คืนมา:

```powershell
node "$agmScripts/agm-workspace.mjs" checkpoint --cwd "$agmProject" --session "[actual-session]" --execution "[returned-execution-id]" --event verified --status passed --summary "[observed-outcome]" --verification "[actual-check-and-result]"
node "$agmScripts/agm-workspace.mjs" complete --cwd "$agmProject" --session "[actual-session]" --execution "[returned-execution-id]"
```

อย่าใส่ passed ล่วงหน้า ถ้าล้มเหลวใช้ failed หรือ blocked ตามจริง สำหรับ tracked work ต้องทำ acceptance/result ใน task.md ให้เสร็จด้วย complete จะไม่ใช้ไฟล์เปล่าเป็นหลักฐานสำเร็จ ใช้ --report เฉพาะมีผู้รับรายงานแยกจริง

<a id="bootstrap-cli"></a>
## Bootstrap CLI

ใช้ตัวแปร path ที่กำหนดด้านบนและชนิด target จริง: fe-main, be-main, fe-library หรือ be-library

**Preview อ่านอย่างเดียว:**

```powershell
node "$agmScripts/project-bootstrap.mjs" plan --target "$agmProject" --kind be-main
```

**Apply เขียนเอกสาร — หลังอนุมัติ target/adoption แล้ว:**

```powershell
node "$agmScripts/agm-workspace.mjs" init --cwd "$agmProject" --bootstrap --kind be-main
```

Plain init เตรียม local knowledge ไม่ติดตั้ง project documents ส่วน identify ไม่ bootstrap เลย ถ้า plan มี conflict ให้แก้ adoption decision ก่อน ไม่รันซ้ำหวังให้ overwrite

## แหล่งอ้างอิงการติดตั้ง

รูปแบบการติดตั้งแยกตาม host อยู่ที่ [Getting Started](GETTING-STARTED.md) ซึ่งระบุ official sources และวันที่ตรวจ CLI help แล้ว ไม่คัดลอกคู่มือ host ทั้งชุดลง reference ของ Agent
