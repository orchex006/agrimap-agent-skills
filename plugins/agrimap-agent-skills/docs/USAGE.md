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

## Golden checklist และระดับความเข้ม MUST / SHOULD / FREE (4.5.5)

ก่อนหน้านี้ golden pattern เข้าถึงได้ยาก: operation อ้างถึง golden ตรง ๆ แค่ไฟล์เดียว ส่วน `fe` กับ `sql`
ไม่อ้างเลย และ `agm-exec` ไม่โหลด pattern contract ของ FE/SQL ทำให้ agent เขียนงานตามวิจารณญาณตัวเองได้
โดยไม่ขัดกับ contract ที่เขียนไว้

4.5.5 เพิ่ม `references/patterns/checklists/` หนึ่งไฟล์ต่อหนึ่ง golden collection แต่ละไฟล์คือ **สาระ
ระดับ `MUST`** ของ collection นั้น พร้อมบอกว่า rule ไหนมาจาก entry ไหน และตรวจด้วยคำสั่งอะไร operation
จะโหลด checklist ที่ตรงกับ `target_kind` ที่ตรวจพบโดยอัตโนมัติ — เปิด golden entry เต็ม ๆ เมื่อ checklist
ชี้ไป หรือเมื่อมีข้อขัดแย้งเท่านั้น

| ระดับ | ความหมาย | เบี่ยงได้ไหม |
| --- | --- | --- |
| `MUST` | โครงสร้าง การวางไฟล์ naming และ public contract | ไม่ใช่เรื่องรสนิยม — ไม่ตรงคือ defect ต้องแก้หรือหยุดแล้วรายงาน |
| `SHOULD` | สำนวนและรูปทรงภายในโครงสร้างที่ถูกแล้ว | เบี่ยงได้เมื่อ active contract หรือไฟล์ข้างเคียงบังคับ แล้วบันทึกเหตุผลใน receipt |
| `FREE` | ตรรกะภายใน layer ที่วางถูกแล้ว: อัลกอริทึม validation body การแตกฟังก์ชัน | ใช้วิจารณญาณวิศวกรรมได้เต็มที่ ห้ามบล็อกหรือถาม owner เพราะเรื่องนี้ |

สิ่งที่เปลี่ยนในทางปฏิบัติ:

- `agm-fe` / `agm-be` / `agm-sql` โหลด checklist ตาม target kind แล้ว และ `agm-exec` โหลด pattern
  contract ของ FE/BE/SQL เข้าไปด้วย จากเดิมที่ไม่โหลดอะไรเลยสำหรับงาน FE และ SQL
- Pre-write gate ใน `goal-rules.md` เพิ่มข้อ 6: ต้องระบุ checklist ที่โหลด entry ที่**เปิดจริง** และ `MUST`
  ข้อที่ขัดกับโค้ดปัจจุบันพร้อมเหตุผล — อ้างจากความจำไม่นับ
- คำสั่งที่ generate ออกมาไม่จัด golden เป็น "background link" อีกต่อไป

checklist ไม่ได้อยู่เหนือ [conflict-resolution.md](../skills/agrimap-agent-skills/references/patterns/conflict-resolution.md):
เมื่อ `MUST` ขัดกับพฤติกรรมที่ deploy อยู่หรือกับการตัดสินใจของ owner ลำดับความสำคัญในไฟล์นั้นยังเป็นตัวตัดสิน
และความขัดแย้งต้องถูกรายงาน

## ตอบสั้นหลังส่งงาน (4.6.0)

จบงานแต่ละครั้ง Agent สรุปไม่เกิน 12 บรรทัดและปิดด้วยตัวเลือกมีเลข ตอบสั้นได้เลย:

| พิมพ์ | ผล |
| --- | --- |
| `1`, `2`, … | ทำตามตัวเลือกนั้นของคำถามล่าสุด |
| `merge`, `รวม`, `รวมเข้า dev`, `LGTM` | รวม work branch เข้า target ตาม policy |
| `pr`, `เปิด PR`, `ส่งรีวิว` | เปิด PR/MR |
| `อัปเดต branch`, `sync` | merge target ล่าสุดเข้า work branch แล้ว push |
| `แก้ต่อ`, `พักไว้`, `ทิ้ง branch` | ทำต่อ / หยุดไว้ / ถามก่อนลบ branch |

คำถามเช่น `merge ยังไง?` หรือข้อความในเครื่องหมายคำพูดไม่ใช่คำสั่ง; `jenkins` และ `jenkins-release` ใช้ release intent เท่านั้น

## Spec ใน project AI-First (4.7.0)

ไม่ต้องสั่ง "เช็ค spec แล้วอัปเดต" ทุกรอบ: Agent อ่าน spec ที่เกี่ยวก่อนทำ และอัปเดต status/evidence/changelog/manifest ของ spec หลัง test ผ่านเอง บรรทัด `- Spec:` ใน summary บอกว่าอัปเดตอะไร ถ้าอัปเดตไม่ได้จะอยู่ใต้ `⚠️ ต้องตามต่อ`

| พิมพ์ | ผล |
| --- | --- |
| `ต่อไปอัปเดต spec ให้ทุกครั้ง` | ตั้งเป็นกติกาของ project ไม่ต้องสั่งซ้ำ |
| `อัปเดต spec ด้วย` (project code-first) | ทำในงานนี้ แล้วถามครั้งเดียวว่าจะทำทุกงานไหม |
| `ไม่ต้องแตะ spec` | ปิด spec sync ของ project |
| `เช็คว่า spec ตรงกับ code ไหม` | รายงาน drift (`spec check`) โดยไม่แก้ |

## ไม่ต้องตอบคำถามเดิมซ้ำ (4.8.0)

| พิมพ์ | ผล |
| --- | --- |
| `แบบเดิม`, `เหมือนที่เคยตกลง` | Agent ดึง decision ที่เกี่ยวข้อง (`recall`) แล้วทำตาม |
| `ไม่เอา X ใช้ Y` หลัง Agent ตัดสินเอง | บันทึกเป็นการแก้ (`decide correction`) ให้ Agent เรียนรู้ |
| `ถามก่อนเสมอเรื่อง <ประเภท>` | Agent ไม่ตัดสินเรื่องประเภทนั้นเองอีก |

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

## Sensitive data in recording (4.5.4)

Built-in recording redacts recognized sensitive values before writing history/logs, workspace memory/state and new Prompt Results. Markers such as `[REDACTED:CREDENTIAL]`, `[REDACTED:TOKEN]` and `[REDACTED:EMAIL]` show where values were removed. The filter runs locally and keeps no raw-value recovery map. Workspace inputs are filtered before shortening summaries or deriving objective filenames. Unmodified retry submissions remain deduplicated; Prompt Result hashes describe the redacted bytes.

Coverage includes common GitHub/OpenAI token formats, AWS access-key IDs, JWTs, private-key blocks, Basic/Bearer authorization, cookie headers, URL user/password pairs, labelled passwords/API keys/tokens/connection strings, email addresses, and labelled phone/identity/card numbers (including selected Thai labels). Quoted values keep their boundaries; an unquoted sensitive assignment may mask the rest of its line up to a query/connection-string delimiter to avoid exposing spaced values. This may remove adjacent harmless text.

This is best-effort pattern detection, not a guarantee that all confidential data is recognized. Arbitrary business data, unlabeled personal identifiers, obfuscated/encoded secrets and unknown token formats may need manual masking. Direct agent-written history/log/memory must use the same bundled redaction helper before persistence. A private repository is not permission to record credentials. The host conversation, shell argument handling and other tools are outside this recorder; do not paste real secrets to test it.

This change applies to new recording. It does not erase old logs, immutable Prompt Results, Git history, downloads or caches, and does not modify application source/configuration. Separately authorize existing-data cleanup; rotate an exposed credential rather than rely only on masking a later record.
