# คู่มือคำสั่ง AgriMap 3.0

[หน้าหลัก](../README.md) · [เริ่มต้น](GETTING-STARTED.md) · [Cookbook](COMMAND-COOKBOOK.md)

หน้านี้สำหรับเลือกคำสั่งและเข้าใจผลลัพธ์ ไม่ใช่ชุด shell scripts สำหรับรันตามลำดับ

## พิมพ์คำสั่งที่ไหน

| ประเภท | พิมพ์ที่ | ตัวอย่าง |
| --- | --- | --- |
| คำสั่งให้ Agent ทำงาน | Agent chat | `$agm-be action=edit ...` ใน Codex |
| ติดตั้ง plugin | Terminal | `codex plugin add ...` |
| Runtime ภายใน | Terminal โดยผู้ดูแล/Agent ที่รู้ target | `node .../agm-workspace.mjs ...` |

ตัวอย่าง chat ด้านล่างใช้ **Codex** ถ้าใช้ host อื่น เปลี่ยนเฉพาะ prefix:

| Codex | Claude Code | Antigravity CLI |
| --- | --- | --- |
| `$agm-be` | `/agrimap-agent-skills:agm-be` | `/agm-be` |
| `$agm-prompt` | `/agrimap-agent-skills:agm-prompt` | `/agm-prompt` |
| `$agm-qa` | `/agrimap-agent-skills:agm-qa` | `/agm-qa` |

อย่าวาง `$agm-...` ใน PowerShell เพราะ `$` มีความหมายเป็นตัวแปรของ shell ข้อความ `action=edit` เป็นโจทย์ให้ Agent ไม่ใช่ flag ของ Node CLI

## เลือกคำสั่ง

| คำสั่ง | เหมาะกับ | ผลลัพธ์ / ขอบเขต |
| --- | --- | --- |
| `agm-analyze` | ทำความเข้าใจงาน ผลกระทบ ทางเลือก | ข้อค้นพบจากหลักฐาน; ไม่แก้ product |
| `agm-diagnose` | มี error/อาการผิดปกติ | สาเหตุที่พิสูจน์ได้หรือหลักฐานที่ยังขาด; ไม่แก้ |
| `agm-plan` | ต้องการลำดับทำงานและ dependency | แผน; ไม่เริ่ม implementation |
| `agm-architect` | ตัดสินใจ boundary, contract, migration | trade-off และแบบระบบ; ไม่แก้ product |
| `agm-fe` | งาน frontend | action เป็นตัวกำหนดว่าอ่านหรือเขียน |
| `agm-be` | งาน backend | action เป็นตัวกำหนดว่าอ่านหรือเขียน |
| `agm-sql` | อธิบาย/ออกแบบ/แก้ **ไฟล์ SQL** | ไม่อนุญาต execute database writes |
| `agm-qa` | ตรวจตาม acceptance | หลักฐานผ่าน/ไม่ผ่าน/ติดข้อจำกัด; ไม่แก้ product |
| `agm-prompt` | กลั่นโจทย์เป็นคำสั่งเก็บและส่งต่อ | Prompt Result เมื่อพร้อม; ไม่ implement |
| `agm-exec` | ลงมือทำโจทย์ที่อนุมัติแล้ว | แก้ไขใน scope และตรวจผล; ไม่บังคับมี prompt file |
| `agm-doctor` | ตรวจรุ่น ความพร้อม และอัปเดต AGM ตาม host | status/version/check อ่านอย่างเดียว; update เปลี่ยนเฉพาะแพ็กเกจ ดู [ตารางคำสั่ง](DOCTOR.md) |
| `agm-release` | bootstrap upgrade, upgrade, indexing, prepare, pipeline, promote และ release full/production/inhouse | ตรวจ/ติดตั้งเครื่องมือที่ขาด; ใช้เลขที่เจ้าของระบุ หรือเพิ่ม PATCH ตาม owner; ขอคำยืนยันก่อน Production/tag ดู [ตารางครบทุกคำสั่ง](../README.md#agm-release) |

`agrimap-agent-skills` เป็น router สำหรับกรณียังเลือกไม่ได้ มันเลือกหนึ่ง operation แล้วหยุด ไม่ใช่ executor อีกตัว และไม่จำเป็นต้องเรียกก่อนคำสั่งตรง

## Passive recommendations

Design ไม่ใช่คำสั่งแยกอีกต่อไป Agent เสนอคำแนะนำที่เกี่ยวข้องกับงานปัจจุบันได้เองเมื่อมีหลักฐานเพียงพอ โดยบอกเหตุผลและระดับความมั่นใจ ถ้าข้อมูลไม่พอต้องระบุสิ่งที่ขาด แยก facts/assumptions และแจ้ง limitations; คำแนะนำชั่วคราวต้องมีเงื่อนไขและ confidence ชัดเจน ห้ามเติมข้อเท็จจริงขึ้นเอง

ใช้ agm-analyze สำหรับการประเมิน/ตรวจโค้ด/พิจารณาสถานการณ์แบบอ่านอย่างเดียว หรือ domain action=design เมื่อตั้งใจขอออกแบบ งานดู audit ใช้คำขออ่านหลักฐานโดยไม่ต้องมี alias แยก ความสามารถออกแบบแบบ passive ทำงานได้แม้ไม่สั่ง action=design และไม่อนุญาตให้ implement โดยอัตโนมัติ

## Actions ของ FE / BE / SQL

| Action | FE / BE | SQL | ผลต่อไฟล์ |
| --- | --- | --- | --- |
| analyze | มี | มี | อ่าน/อธิบาย |
| design | มี | มี | เสนอแบบ |
| create | มี | มี | สร้างไฟล์ใน scope |
| edit | มี | มี | แก้ไฟล์ใน scope |
| refactor | มี | มี | ปรับโครงสร้างตาม boundary ที่ตกลง |
| test | มี | ไม่มี action นี้ | สร้าง/แก้ test ที่ร้องขอ; ตรวจผลตาม scope |
| explain | ใช้ analyze | มี | อธิบาย SQL |

สำหรับ SQL คำว่า create/edit หมายถึง authoring ไฟล์เท่านั้น ไม่ใช่สิทธิ์ CREATE/ALTER/INSERT/UPDATE/DELETE บน DB ดู [SQL context](WORKFLOWS.md#sql-context)

## เขียนโจทย์ให้ชัดโดยไม่ต้องกรอกทุก field

เริ่มจากสี่อย่าง: **ทำอะไร — ที่ไหน — ต้องคงอะไร — ผลที่ถือว่าเสร็จ** ระบุ path จริงหรือแนบไฟล์ ไม่จำเป็นต้องกรอก requester, model, depth ทุกคำถาม

```text
$agm-be action=edit
เป้าหมาย: ให้ endpoint คืน validation error เมื่อ input ว่าง
ไฟล์เป้าหมาย: [แทนด้วย path จริง]
ต้องคงเดิม: รูปแบบ response และ behavior ของ input ที่ถูกต้อง
เสร็จเมื่อ: กรณี input ว่างถูกตรวจและ regression ที่เกี่ยวข้องผ่าน
ไม่รวม: เปลี่ยน schema, commit, push หรือ deploy
```

เนื้อหาใน `[...]` คือ placeholder ที่ต้องแทนก่อนส่ง ถ้าไม่รู้ไฟล์ให้ขอค้นหาจากโครงการก่อน ห้ามสร้าง path หรือ object ให้ดูเหมือนมีจริง

`target_kind` ใช้เมื่อแบ่งชนิดจาก repository ไม่ได้: fe-main, fe-library, be-main, be-library; งาน SQL ใช้ contract SQL ของโครงการ ไม่ต้องเดาชนิดเอง ส่วน workflow_depth ให้ Agent อธิบายจากความเสี่ยงจริง ดู [Workflow](WORKFLOWS.md)

## ไฟล์ยาว รูปภาพ และหลายแหล่งข้อมูล

แนบผ่าน host ตามปกติ แล้วระบุว่าไฟล์ใดเป็นข้อกำหนด/ตัวอย่าง/ของเดิม ระบุ symbol หรือบรรทัดเป็นตัวช่วย ไม่ใช้เลขบรรทัดแทนการอ่าน context

ใช้ [LONG-REQUEST](../examples/inputs/LONG-REQUEST.md) เป็นตัวอย่างโจทย์หลายส่วน พร้อม [แผนภาพ](../examples/inputs/references/checkout-flow.svg) และ [หมายเหตุ](../examples/inputs/references/feature-note.md) ทั้งหมดเป็น fixture ไม่ใช่ข้อมูล production หรือคำอนุมัติจริง

## ขอ help

**Agent chat (Codex):**

```text
$agm-be -h
```

เปลี่ยน prefix สำหรับ host อื่นตามตารางด้านบน help ควรอธิบาย operation, inputs, actions และตัวอย่าง ไม่เริ่ม task หรือแก้ไฟล์

## Artifact contract

<!-- BEGIN GENERATED TASK ARTIFACT SCHEMA -->
Ordinary answers: no execution/task artifacts. Bounded writes: concise memory/audit.
Tracked v3 work: one task.md with scope, acceptance, progress, evidence and result.
Separate analysis/QA/results/reports are consumer-requested deliverables, not a five-file gate.
Legacy v2 five-file validation remains in assets/task-artifact-schema.json for existing executions only; it is not the new-work checklist.
<!-- END GENERATED TASK ARTIFACT SCHEMA -->

อ่าน [Cookbook](COMMAND-COOKBOOK.md) เพื่อคัดลอกโจทย์ หรือ [คู่มือผู้ดูแล](MAINTAINING.md) เมื่อต้องใช้ runtime scripts โดยตรง

## Antigravity CLI recording example

For new runs in Antigravity CLI, record `provider: antigravity`. Keep `model` as the actual runtime-reported model ID, or `unknown` when unavailable; `modelLabel` is only an optional configured label. Never put Antigravity CLI in the model field or infer a Gemini version from the host. Existing Gemini CLI records retain `provider: gemini` and their original model evidence.

```json
{
  "provider": "antigravity",
  "model": "unknown",
  "modelLabel": "not-configured",
  "role": "leader",
  "agent": "primary"
}
```

Example human-readable report: `Host: Antigravity CLI; Provider: antigravity; Actual model: unknown`. This is recording metadata, not a claim that a particular model executed the work. The AgriMap runtime accepts `--provider antigravity --model unknown` on its existing identity/recording commands; use the confirmed requester and actual session, never an example identity.

Official host reference: [Using AGY CLI](https://www.antigravity.google/docs/cli/using). Version 4.1.0 supplies root plugin.json and generated flat skills/agm-*.md for native `agy plugin install`. Keep legacy Gemini adapters and GEMINI.md for compatibility. Verify actual aliases through the host UI; use a qualified identifier if shown. AGY hooks/MCP parity and end-to-end installation remain unverified until exercised on that host; no legacy hook payload is silently reused.
