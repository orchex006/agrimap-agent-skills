# AgriMap Agent Skills — Usage Guide

คู่มือนี้ใช้หลังติดตั้ง `agrimap-agent-skills` แล้ว จุดประสงค์คือทำให้ผู้ใช้เรียก dedicated skill ที่ตรง operation: alias โหลด compact runtime core + glossary + operation entrypoint ของตัวเอง แล้วเขียน memory/logs ลงโปรเจกต์ที่กำลังทำงาน ไม่ใช่ global install directory. `agrimap-agent-skills` เป็น router สำหรับเลือก alias เท่านั้นและไม่ execute งาน.

## 1. เรียก Skill ตามค่าย AI

แทน `<alias>` และ `<arguments>` ด้วย operation และรายละเอียดงานจากตารางด้านล่าง:

| Provider | Syntax |
| --- | --- |
| Codex — dedicated operation | `$<alias> <arguments>` |
| Codex — route only | `$agrimap-agent-skills <request>` |
| Claude Code plugin — dedicated operation | `/agrimap-agent-skills:<alias> <arguments>` |
| Claude Code plugin — route only | `/agrimap-agent-skills:agrimap-agent-skills <request>` |
| Claude standalone with alias folders | `/<alias> <arguments>` |
| Gemini CLI — dedicated operation | `/<alias> <arguments>` |

ตัวอย่างเดียวกันสามค่าย:

```text
# Codex
$agm-be action=analyze requested_by=Billy target_files=src/app.cs objective="Find the root cause; do not edit"

# Claude Code plugin
/agrimap-agent-skills:agm-be action=analyze requested_by=Billy target_files=src/app.cs objective="Find the root cause; do not edit"

# Gemini CLI
/agm-be action=analyze requested_by=Billy target_files=src/app.cs objective="Find the root cause; do not edit"
```

การคัดลอกเฉพาะ routing skill จะเลือก operation ได้แต่ execute ไม่ได้ ต้องติดตั้ง alias folders เช่น `agm-be/` ด้วยก่อนใช้รูปแบบ `/<alias>`.

### Gemini: การโหลด reference ผ่าน MCP

Gemini จำกัด (sandbox) file tool ไว้ที่ workspace ของผู้ใช้ ดังนั้น extension ที่ติดตั้งแบบ global จึงให้ model อ่านไฟล์กฎที่ bundle มาโดยตรงไม่ได้. แพ็กเกจจึงมี read-only MCP server (`skills/agrimap-agent-skills/scripts/mcp-server.mjs`) ประกาศใน `gemini-extension.json` ที่ `mcpServers.agrimap`. Gemini spawn เป็น stdio subprocess ตอน startup โดยแทนค่า `${extensionPath}` เป็นโฟลเดอร์ที่ติดตั้ง แล้วแต่ละคำสั่ง `/agm-*` จะโหลด `lifecycle-core.md`, operation entrypoint และ conditional reference ผ่าน tool `read_reference` (`mcp_agrimap_read_reference`); ส่วนไฟล์โปรเจกต์ของผู้ใช้ยังอ่านด้วย file tool ปกติ. ต้องมี `node` ใน `PATH` (dependency เดียวกับ hooks เดิม). Server เป็น read-only, stateless และแยก subprocess ต่อ Gemini หนึ่ง instance (ใช้ stdio ไม่ผูก port) เปิดหลาย project พร้อมกันจึงไม่ชนกัน. Codex/Claude ไม่เกี่ยวข้อง เพราะโหลด reference ผ่าน plugin host ของตัวเอง.

### ขอบเขตการ activate อัตโนมัติ

แม้ plugin/extension ถูกติดตั้งในระดับ global แต่ hook ของ non-candidate จะตรวจเฉพาะ activation inputs ได้แก่ชื่อ Git root/`origin`, activation config, explicit prompt syntax และ active-task marker จากนั้นจบโดยไม่ส่ง AgriMap context, ไม่อ่าน identity/memory และไม่เขียน workflow state. ตัว skill ที่ถูก model เลือกแบบ implicit ก็มี scope gate เดียวกันก่อนโหลด AgriMap lifecycle/reference. Hook/skill จะ active เฉพาะ candidate ต่อไปนี้:

- Git root หรือชื่อ repository จาก `origin` ตรง `agmwa-<letters-and-hyphens>-ng`, `agmws-<letters-and-hyphens>-netcore`, `agmbo-<letters-and-hyphens>-netcore`, `agrimap-<letters-and-hyphens>` หรือ `AgriMap.<dot-separated-letters>`;
- prompt ปัจจุบันเรียก alias ที่มีจริงด้วย syntax ของ provider ตามตารางด้านบน;
- session เดิมมี active tracked task; หรือ
- project ที่ถูกเปลี่ยนชื่อ opt-in ด้วย `activation.auto: true` ใน `.agrimap-agent/config.json`.

ชื่อที่มีตัวเลข/underscore, ข้อความ `agm-*` ที่ไม่ใช่ registered alias, การกล่าวถึง `agm-be` แบบข้อความธรรมดา และการมี directory `.agrimap-agent` เพียงอย่างเดียวไม่ทำให้ hook active. ค่า `activation.auto` เริ่มต้นเป็น `false` เพื่อไม่ให้ repo ภายนอกที่เคยเรียก skill กลายเป็น auto-active ถาวร.

เมื่อ candidate active และยังไม่มี explicit alias/active task, hook ตรวจแบบแคบเฉพาะ Primary SQL product intent ที่มีทั้ง action กับ SQL target ชัดเจน เช่น `.sql` path หรือ stored procedure แล้วกำหนดให้เรียก `agm-sql` ก่อน inspect/write โดยไม่ได้ให้ write authority เพิ่ม. ข้อความที่พูดถึง `agm-sql`, skill, hook, plugin, package หรือ routing ในเชิง meta จะไม่ถูกบังคับเป็น product SQL. Repository ของ package นี้ถูกตรวจจาก manifest + operation registry + lifecycle source เป็น `skill-package`; งานแก้ skill/contract/tooling/docs/tests ห้ามสร้าง root FE/BE/SQL product artifact เว้นแต่ requester ระบุ fixture/example path ชัดเจน.

หาก alias ไม่ปรากฏหลังติดตั้ง ให้เปิด session ใหม่ก่อน หากยังไม่พบ ให้ sync/reinstall package ห้ามใช้ router เป็น execution fallback:

```text
PACKAGE_ENTRYPOINT_MISSING: agm-be
npm run sync  # local package development; otherwise reinstall the plugin/extension
```

## Help แบบสั้นด้วย `-h`

ถ้าต้องการดูวิธีใช้ ให้เติม `-h` หรือ `--help`; การเรียกนี้เป็น light diagnostic และไม่สร้าง `tasks/**`:

```text
# Codex
$agm-be -h

# Claude Code plugin
/agrimap-agent-skills:agm-be -h

# Claude standalone ที่ติดตั้ง alias folder แล้ว
/agm-be -h

# Gemini CLI
/agm-be -h
```

Help ของ dedicated skill ต้องแสดง command, purpose, required/conditional inputs และ minimal example ของ operation นั้น. `$agrimap-agent-skills -h` หรือ `/agrimap-agent-skills:agrimap-agent-skills -h` แสดง catalog เพื่อเลือก alias เท่านั้น. หากต้องการเปิดคู่มือฉบับเต็มบน Windows ให้รันจาก PowerShell; เลือกอย่างใดอย่างหนึ่ง:

ทุก alias สร้างจาก `config/operations.json` และอ่านตรงเพียงสองไฟล์: `references/lifecycle-core.md` กับ `references/operations/<operation>.md`. Glossary/technical reference โหลดเมื่อ depth หรือ operation condition ตรงเท่านั้น; ห้ามอ่าน routing `SKILL.md` หรือรวม operation อื่น. หาก compact input สูญหาย/เสียหายให้หยุดด้วย `PACKAGE_ENTRYPOINT_MISSING`.

```powershell
# Browser — เปิดฉบับล่าสุดบน GitHub
Start-Process "https://github.com/gasxhermvc/agrimap-agent-skills/blob/main/docs/USAGE.md"

# VS Code — รันจาก repository root
code .\docs\USAGE.md

# Notepad — รันจาก repository root
notepad .\docs\USAGE.md
```

## 2. เลือก `light|standard|regulated` แล้วสร้าง workflow state ทุกครั้ง

ทุก dedicated operation ระบุ default/allowed depth จาก `config/operations.json` และใช้ selector กลางที่ `references/lifecycle-core.md`:

- `light`: help, history/read-only query และงาน bounded ใช้ agent เดียว + self-review + targeted verification; สร้าง memory/log/report ตาม lifecycle แต่ไม่สร้าง `tasks/` หรือ task artifact ใด ๆ;
- `standard`: งานต่อเนื่องที่ไม่เข้า regulated สร้าง task contract ครบ `brief.md`, `analysis.md`, `checklists.md`, `qa.md`, `result.md`; ใช้ `qa_mode: not-applicable|light` ตาม assurance ที่ต้องการ;
- `regulated`: งาน delegation, public/data/security/cross-service/shared generator, material owner decision หรือ commit/publish/release สร้าง task contract ห้าไฟล์เหมือน standard และใช้ `qa_mode: full` พร้อมแยก QA identity.

ทุก depth ต้องบันทึก requester, memory และ daily log; เฉพาะ `standard`/`regulated` เท่านั้นที่สร้าง task artifacts ส่วน `light` ห้ามสร้าง `tasks/**`:

```text
AgriMap skill active
Operation: analyze
Requested by: Billy
Input coverage: 1 file validated; full read pending
Pre-work checklist:
- [ ] Inspect target and affected callers
- [ ] Separate facts, inferences, and unknowns
- [ ] Present material solution trade-offs before editing
```

Receipt นี้ไม่ใช่ permission gate เพิ่มเติม. ถ้า `standard`/`regulated` ไม่รู้ชื่อผู้สั่งงานจึงถาม; `light` ไม่ถามเพื่อ attribution อย่างเดียว. หาก input ขาดให้ระบุสิ่งที่ขาด ห้ามแสดงว่า ready ทั้งที่ยังอ่านไม่ครบ.

`substantive work` รวมการอ่าน target code, task-specific grep, diagnostics, tests และการเขียน workflow state; ไม่รวมแค่การหา project root/อ่าน workflow config/ดู Git status เพื่อเตรียมงาน. `requester` คือผู้ขอ ส่วน `decision owner` คือผู้มีสิทธิ์อนุมัติ material trade-off—อาจเป็นคนละคนกัน. นิยามบังคับทั้งหมดอยู่ที่ `references/glossary.md`.

เมื่อเริ่ม `standard`/`regulated` ให้ตรวจที่ root ของโปรเจกต์เป้าหมาย:

```text
<target-project>/.agrimap-agent/
├── tasks/YYYY-MM/<ddHHmmss>/brief.md
├── memory/current/YYYY-MM/<ddHHmmss>-<slug>.md
└── logs/YYYY-MM/YYYY-MM-DD.jsonl
```

ใน log ต้องแยก `requestedBy`, `model`, `role`, `agent`, และ `provider`. Global installation ต้องไม่มี project logs/memory. สำหรับ repository ที่ใช้พัฒนา Skill นี้เอง `.agrimap-agent/` ทั้งก้อนถูก ignore และอยู่เฉพาะเครื่องผู้พัฒนา.

### Standard/regulated task artifact contract

ตารางนี้ generate จาก `skills/agrimap-agent-skills/assets/task-artifact-schema.json`; ให้แก้ schema/templates แล้วรัน `npm run sync` ไม่แก้ตารางด้วยมือ.

<!-- BEGIN GENERATED TASK ARTIFACT SCHEMA -->
<!-- Generated by npm run sync from skills/agrimap-agent-skills/assets/task-artifact-schema.json. -->
| Artifact | Write phase / owner | Required depths | Template | Purpose | Required fields | Required sections |
| --- | --- | --- | --- | --- | --- | --- |
| `brief.md` | `contract`<br>the leader starting a standard/regulated execution; agm-prompt is artifactless | `standard`<br>`regulated` | `task-brief.md` | Requester, authority, execution identity, objective, scope, ownership, and decisions. | `Task ID`<br>`Requested by`<br>`Identity source`<br>`Requester authority`<br>`Decision owner`<br>`Authority evidence`<br>`Model label`<br>`Actual model`<br>`Role`<br>`Agent`<br>`Provider`<br>`Operation`<br>`Workflow depth`<br>`Objective`<br>`Scope`<br>`Non-goals` | `File and logical-contract ownership`<br>`Inputs`<br>`Authorized decisions and trade-offs`<br>`Service ownership references`<br>`Concerns` |
| `analysis.md` | `contract`<br>leader or executor after target inspection and before implementation completion | `standard`<br>`regulated` | `analysis.md` | Evidence-backed current state, findings, impact, and approved approach for tracked work. | — | `Current State`<br>`Findings`<br>`Proposed Approach` |
| `checklists.md` | `contract`<br>the tracked execution leader initializes acceptance items; executor and leader update status | `standard`<br>`regulated` | `checklists.md` | Checked completion ledger derived from the task contract. | — | — |
| `qa.md` | `verification`<br>agm-qa after implementation evidence exists | `standard`<br>`regulated` | `qa.md` | Tracked QA evidence under the canonical product-read-only verifier contract. | `Status`<br>`QA mode`<br>`QA mode reason`<br>`Coverage key`<br>`Light sequence`<br>`Patterns`<br>`Requested by`<br>`Decision owner`<br>`QA model label`<br>`QA actual model`<br>`QA role`<br>`QA agent`<br>`QA provider`<br>`Product artifacts modified`<br>`Workflow artifacts written`<br>`Implementation model label`<br>`Implementation actual model`<br>`Implementation role`<br>`Implementation agent`<br>`Implementation provider` | `Requirement evidence`<br>`Commands and observed results`<br>`Limitations` |
| `result.md` | `closure`<br>leader after implementation, verification, and applicable QA | `standard`<br>`regulated` | `result.md` | Leader closure result, QA boundary, verification, memory, and outstanding work. | `Outcome`<br>`Requested by`<br>`Decision owner`<br>`Leader model label`<br>`Leader actual model`<br>`Leader role`<br>`Leader agent`<br>`Leader provider`<br>`Workflow depth`<br>`QA status`<br>`QA mode`<br>`Delivery boundary` | `Authorized decisions`<br>`Changes and verification`<br>`Checklist and memory`<br>`Concerns and commit boundary`<br>`Outstanding items` |

Completion cross-artifact gates:

- Depths `light` create no task directory or task artifacts.
- Tracked start scaffolds only `brief.md`<br>`checklists.md`; `analysis.md`, `qa.md`, and `result.md` are phase-owned completion artifacts.
- Standard completion writes `qa.md` with status `not-applicable` and records result QA status/mode as `not-applicable`.
- Regulated accepted QA statuses: `passed`<br>`not-applicable`.
- At regulated depth, `Requested by` and `Decision owner` match across brief, QA, and result.
- Regulated QA identity (`QA actual model`<br>`QA agent`<br>`QA provider`) must differ from implementation identity (`Implementation actual model`<br>`Implementation agent`<br>`Implementation provider`).
- Delivery boundaries `commit`<br>`publish`<br>`release` require regulated depth and `QA mode: full`.
- A regulated full run records `Light sequence: 0`; light runs may record only `1`<br>`2`.

Full QA is mandatory when any schema trigger applies:

1. commit, publish, or release boundary
2. same-task full re-QA after a qa-finding
3. third consecutive passed-light tracked closure for the same coverage key
4. explicit requester request for qa_mode=full or highest verification
<!-- END GENERATED TASK ARTIFACT SCHEMA -->

## 3. วิธีใช้หลัก — สั้นก่อน, สนทนาเมื่อจำเป็น, key=value คือทางลัด

### 3.1 แบบสั้น (แนะนำให้เริ่มแบบนี้)

ไม่ต้องรู้ parameter ก่อนใช้ — agent resolve ให้เองตาม discipline (อ้างอิง `references/elicitation.md`): ชี้ไฟล์ด้วย `@file` หรือเล่าเป็นภาษาคน ค่า default ที่ปลอดภัยถูกเติมให้ (เช่น review/analyze เป็น read-only เสมอ). งาน `standard`/`regulated` ประกาศค่าที่ infer ได้ใน activation receipt; งาน `light` สรุปเฉพาะ assumption ที่มีผลต่อผลลัพธ์:

```text
# ถามกว้าง ๆ ได้เลย — free text คือ objective
$agm-be action=analyze มีการเพิ่ม cache ที่ไหนบ้างของระบบ login

# ชี้ไฟล์ + ขยายความสั้น ๆ — @file คือ target, ข้อความคือการจำกัด scope
$agm-review @README.md ตรวจคำผิด

# อาการผิดปกติ = diagnose
$agm-diagnose กดบันทึกแล้วขึ้น 500 บางครั้ง
```

สิ่งที่ agent **ห้ามเดาเด็ดขาด** (ไม่มีหลักฐานตรง → ถาม): `target_kind`, `backend_profile`, `refactor_mode`, ชื่อ project/artifact ใหม่ และ objective ของงานสร้างของใหม่.

### 3.2 แบบสนทนา — ถามครั้งเดียว ตอบบรรทัดเดียว

เมื่อขาดค่าที่ห้ามเดา agent จะรวมทุกคำถามเป็นชุดเดียว เป็นตัวเลือกตัวเลข พร้อมค่าแนะนำ แล้วให้ตอบกลับบรรทัดเดียว:

```text
Requester: $agm-prompt provider=codex context=publisher-project สร้าง project template ใหม่ให้หน่อย ขอชื่อ publisher

Agent: ขอ 3 คำตอบ ตอบบรรทัดเดียวเรียงลำดับ เช่น "1 2 approve":
  1) target: 1=main  2=library
  2) ประเภท: 1=webservice (agmws)  2=job worker (agmbo)
  3) ชื่อ: เสนอ agmbo-publisher-netcore (format: agmws|agmbo-<project_name>-netcore)
     ตอบ approve หรือพิมพ์ชื่อใหม่

Requester: 1 2 agmbo-job-publisher-netcore

Agent: จะบันทึก company template นี้ใน executor prompt — ยืนยันคำสั่งและ working directory:
  dotnet new agmbo --name "agmbo-job-publisher-netcore" --project-key "AGMBO-JOB-PUBLISHER"
    --image-name "agmbo_job_publisher_netcore" --port-number "5000" --https-port-number "5001"
  ตอบ approve หรือแก้ค่า

Decision owner: approve
Agent: สร้าง Prompt Result V1 แล้ว; ยังไม่รันคำสั่งจนกว่าจะเรียก $agm-exec
```

งานสร้างโปรเจกต์ใหม่ทั้งก้อนเกิน light implementation scope เสมอ จึงใช้ `agm-prompt` แบบ artifactless เพื่อบันทึก company template `dotnet new agmwa|agmws|agmbo`, ค่าที่ derive, คำสั่งเต็ม และ working directory เป็น Prompt Result แล้วรันภายหลังผ่าน `agm-exec` เมื่อ approve เท่านั้น ส่วน direct feature ในโปรเจกต์เดิม ทุก path ที่จะสร้าง/แก้ต้องเห็นครบใน slice plan ก่อนไฟล์แรกถูกเขียน.

`agm-fe` และ `agm-be` มี embedded test-decision capability ซึ่งเป็นความรู้และเกณฑ์ตัดสินใจที่ติดไปกับ action ที่เลือก: ตรวจ target, framework และจุดเสี่ยงเพื่อจัด coverage เป็น `required|recommended|not_applicable` ได้ทั้งงาน read-only และงานเขียนที่ได้รับอนุญาตแล้ว ตัว capability ไม่เลือก action หรือสร้างสิทธิ์เขียนเอง; การสร้างเทสต้องมาจาก `action=test`, ข้อความที่ขอสร้างเทสชัดเจน หรือ required regression coverage ที่อยู่ใน implementation scope เดิม ถ้าระบุ behavior มาแล้วทำได้เลย มิฉะนั้นเสนอรายการให้เลือก `approve` / `all` / เลข เช่น `1 2 5`. Refactor ใช้ `agm-fe|agm-be|agm-sql action=refactor`; ถ้าไม่ระบุ mode จะแสดงเมนูครบ 5 ระดับและหยุดก่อนเขียน — การรื้อใหม่ทั้งหมดไม่ใช่ refactor ให้ไป `agm-plan` แล้วใช้ domain create/edit หรือ `agm-prompt`.

### 3.3 เลือกคำสั่งไหน

| คำสั่ง | ใช้เมื่อเสียงในหัวคือ | จบที่ |
| --- | --- | --- |
| `agm-fe` | งาน frontend: analyze/design/create/edit/refactor/test | ผลตาม action; refactor ต้องมี mode |
| `agm-be` | งาน backend: analyze/design/create/edit/refactor/test | ผลตาม action; refactor ต้องมี mode |
| `agm-sql` | งาน SQL: analyze/design/create/edit/refactor/explain | ผลตาม action; explain ไม่ execute/แก้ SQL |
| `agm-diagnose` | "**ทำไม**มันพัง" — มีอาการอยู่จริง | root cause ที่พิสูจน์แล้ว |
| `agm-simulate` | "**ถ้า**ทำ X จะเกิดอะไร" | scenarios + risks + observables |
| `agm-plan` | "รู้แล้วจะทำอะไร ขอลำดับขั้น" | แผน execution ตรวจได้ |
| `agm-architect` | "ของนี้ควรอยู่ไหน ใครเป็นเจ้าของ contract" | decision record ถาวร ใช้ซ้ำได้ |
| `agm-review` | "ช่วยตรวจของที่มีอยู่" | findings เรียง severity ไม่แก้ให้ |
| `agm-history` | "ใครทำอะไรเมื่อไหร่" | คำตอบ audit จาก log จริง |
| `agm-qa` | "งานที่ว่าเสร็จ เสร็จจริงไหม" | passed/failed + evidence |
| `agm-prompt` | "ปรับ requirement/กระบวนการคิดให้เป็นโจทย์พร้อมรัน" | Prompt Result V1→VN หนึ่งไฟล์; light และไม่สร้าง tasks |
| `agm-exec` | "รัน prompt ที่ approve แล้วแบบมี rails" | Result Package รอ QA |

### 3.4 key=value minimal cases — ทุก operation (ทางลัด power user, ไม่บังคับ)

เริ่มจาก Codex syntax ด้านล่าง สำหรับ Claude/Gemini ให้เปลี่ยนเฉพาะ prefix ตามหัวข้อ 1 และคง arguments เดิม.

| Alias | Minimal case |
| --- | --- |
| `agm-analyze` | `$agm-analyze depth=light target_files=src/orders.ts objective="Explain duplicate requests; do not edit"` |
| `agm-design` | `$agm-design depth=light target=architecture objective="Design ownership and migration for order status"` |
| `agm-fe` | `$agm-fe action=edit depth=light target_files=src/order.component.ts objective="Handle the empty state"` |
| `agm-be` | `$agm-be action=create depth=light target_kind=be-main backend_profile=agmws objective="Add cancel-order endpoint"` |
| `agm-sql` | `$agm-sql action=explain depth=light target_files=sql/ORDER/ORDER_Q.sql` |
| `agm-sql` refactor | `$agm-sql action=refactor refactor_mode=performance-preserve-behavior target_files=sql/usp_Order_Search.sql` |
| `agm-diagnose` | `$agm-diagnose depth=light symptom="Save returns 500" target_files=src/orders.ts,tests/orders.test.ts implementation=false` |
| `agm-simulate` | `$agm-simulate depth=light scenario="Retry after timeout" inputs="timeout,retry-count" expected_output="state transitions and risks"` |
| `agm-plan` | `$agm-plan depth=light objective="Add order cancellation" target_files=src/orders.ts,tests/orders.test.ts output="reverse-engineered steps"` |
| `agm-architect` | `$agm-architect requested_by=Billy objective="Choose ownership boundary for order status" non_goals="implementation"` |
| `agm-review` | `$agm-review depth=light target_files=src/orders.ts review_scope="correctness,regression,tests"` |
| `agm-history` | `$agm-history requester=Billy days=5` |
| `agm-qa` | `$agm-qa depth=light qa_mode=light artifact="current integrated workspace" acceptance="cancellation remains idempotent"` |
| `agm-prompt` | `$agm-prompt requested_by=Billy context=cancel-order objective="Prepare complete cancel-order implementation instructions" target_kind=be-main backend_profile=agmws` |
| `agm-exec` | `$agm-exec requested_by=Billy prompt=.agrimap-agent/prompts/YYYY-MM/<conversation>/cancel-order-v001.md` |

งาน FE/BE จะ compose discipline ให้อัตโนมัติ ไม่มี `/agm-fe-engineer` หรือ `/agm-be-engineer`. `agmws|agmbo` เป็น `backend_profile` ของ `be-main`, ไม่ใช่ `target_kind`.

งาน BE ทั้ง main/library ที่อ่านหรือ refactor cookie/header/query/form/JSON body/device ID จะโหลด `013-1-extensions-request-value-normalize.md` แบบมีเงื่อนไข. Analyze/diagnose ตรวจ duplication และ semantic mismatch; `agm-be action=refactor` ห้าม mass-replace ก่อนพิสูจน์ precedence, blank→null/trim, multi-value และ buffering; `agm-qa` ตรวจ representative source/fallback. Static extensions ชุดนี้ไม่ต้องเพิ่ม DI registration.

`agm-history` ตอบจาก workflow evidence: `requestedBy` คือผู้ขอ, executor คือ model/role/agent/provider จาก versioned event ที่ผ่าน validation และ `recordedFiles` คือไฟล์จาก valid versioned non-terminal event เท่านั้น ส่วน `legacyClaimedFiles` เป็นข้อมูลวินิจฉัยที่ห้ามยกระดับเป็น versioned attribution ทั้งหมดนี้ไม่ใช่หลักฐานว่าใครเป็นผู้พิมพ์แก้หรือ author ของ commit. ถ้าถามผู้แก้จริงให้ตรวจ Git log/blame แยกต่างหาก และต้องดู `auditStorage` ก่อน—logs ที่ ignored/untracked เป็นข้อมูลเฉพาะเครื่องและจะไม่ตามไป clone ใหม่.

### Domain create/edit/test matrix

คำสั่งเขียนด้านล่างเป็น light/direct เท่านั้น ถ้า slice เกินสาม product artifacts หรือต้อง tracking/delegation/separate QA ให้ใช้ `agm-prompt` แล้วจึง `agm-exec`. SQL ไม่มี `action=test`; ใช้ `action=explain` สำหรับคำอธิบายแบบ read-only และให้ verification อยู่ใน create/edit/refactor contract:

| Case | Create/edit command | Explicit test command |
| --- | --- | --- |
| FE main | `$agm-fe action=create depth=light target_kind=fe-main objective="Add order table"` | `$agm-fe action=test target_files=src/order-table.component.ts objective="cover empty and error states"` |
| FE library | `$agm-fe action=create depth=light target_kind=fe-library objective="Add reusable status badge"` | `$agm-fe action=test target_files=projects/ui/status-badge.component.ts objective="cover public states"` |
| BE main web | `$agm-be action=create depth=light target_kind=be-main backend_profile=agmws objective="Add cancel endpoint"` | `$agm-be action=test backend_profile=agmws target_files=Application/Orders/CancelUseCase.cs objective="cover idempotency"` |
| BE main batch | `$agm-be action=create depth=light target_kind=be-main backend_profile=agmbo objective="Add stale-order job"` | `$agm-be action=test backend_profile=agmbo target_files=Application/Orders/StaleOrderJob.cs objective="cover retry behavior"` |
| BE library | `$agm-be action=create depth=light target_kind=be-library objective="Add order-id capability"` | `$agm-be action=test target_files=src/OrderId.cs objective="cover public contract"` |
| SQL table | `$agm-sql action=create depth=light target_kind=sql-table output_owner=product target_files=sql/ORDER/table/ORDER_RETRY.sql objective="Add ORDER_RETRY table"` | — |
| SQL procedure | `$agm-sql action=edit depth=light target_kind=sql-procedure target_files=sql/ORDER/procedure/ORDER_RETRY_Q.sql objective="Preserve result and failure contracts"` | — |
| SQL combined | `$agm-sql action=create depth=light target_kind=sql-table-and-procedure output_owner=product target_files=sql/ORDER/table/ORDER_RETRY.sql,sql/ORDER/procedure/ORDER_RETRY_I.sql objective="Add retry persistence slice"` | — |

SQL write boundary ใช้ `output_owner=product|owner-reference|knowledge-draft` สำหรับ artifact ใหม่. ถ้าไม่รู้ owner/path ให้หยุด `SQL_OUTPUT_OWNER_REQUIRED`; ถ้า `action=edit|refactor` แล้ว target ไม่มี ให้หยุด `SQL_EDIT_TARGET_NOT_FOUND` และห้ามสร้าง directory/file ทดแทน. `owner-reference` รับเฉพาะ DDL ที่ requester ให้มาหรือ decision owner อนุมัติแล้วใต้ `.agrimap-agent/knowledge/references/db-schema/`; SQL ที่ AI สร้างหรือยังเป็น draft ต้องอยู่ใต้ `.agrimap-agent/knowledge/drafts/sql/` และห้ามโหลดเป็น schema `FACT`.

### Refactor mode matrix

ห้ามใช้คำว่า “refactor ให้ดีขึ้น” อย่างเดียว ต้องเลือก mode หนึ่งค่า:

| Mode | Runnable example |
| --- | --- |
| `performance-preserve-behavior` | `$agm-sql action=refactor refactor_mode=performance-preserve-behavior target_files=sql/usp_Order_Search.sql metric="duration and logical reads"` |
| `readability-organization` | `$agm-fe action=refactor refactor_mode=readability-organization target_files=src/order-table.component.ts` |
| `strict-preserve-logic` | `$agm-be action=refactor backend_profile=agmws refactor_mode=strict-preserve-logic target_files=Application/Orders/OrderUseCase.cs` |
| `strict-allow-logic-change` | `$agm-be action=refactor backend_profile=agmws refactor_mode=strict-allow-logic-change objective="Change retry rule after decision-owner trade-off"` |
| `targeted-bug-fix` | `$agm-fe action=refactor refactor_mode=targeted-bug-fix symptom="double submit after timeout"` |

ถ้า `$agm-sql action=refactor` ยังระบุ mode ไม่ได้ ต้องแสดงทั้ง 5 enum พร้อมขอบเขตหนึ่งบรรทัดและ mark ค่าแนะนำในคำตอบแรก แล้วหยุดก่อนเขียน ห้ามตอบเพียง recommendation. Writer เขียน SQL ให้ parse ได้และครบ semantic contract จากนั้นรวบรวมทุกไฟล์ที่สร้างหรือแก้เป็น `format_set`, รัน `sqlfluff format` ให้ครบ และรายงาน `formatted N/N`.

`agm-analyze` และ unified `agm-design target=fe|be|sql|architecture` อยู่ใน primary surface. `agm-create-feature`, `agm-create-unit-test`, `agm-create-prompt`, `agm-refactor`, และ `agm-refactor-fe|be|sql` ถูกถอดจาก package แล้ว; ให้ใช้ `agm-prompt`, domain `action=refactor`, และ embedded unit-test decision capability. Historical operation strings ยังอ่านย้อนหลังได้แต่ไม่มี callable alias.

### Mandatory Goal Rules และ Embedded Passive Capabilities

Passive capability คือ embedded supporting skill: ความรู้ ระเบียบ เกณฑ์ตรวจสอบ และหลักตัดสินใจที่ Agent นำมาใช้โดยอัตโนมัติเมื่อเงื่อนไขตรง มันหนุน operation/action ปัจจุบันได้ทั้งงาน read-only และงานเขียนที่ได้รับอนุญาตแล้ว แต่ไม่แทนที่บริบทเดิม ไม่เลือก action และไม่สร้าง write intent ขึ้นเอง. ทุก `agm-analyze|architect|be|design|diagnose|fe|sql|review|simulate|exec|plan|qa|prompt` ต้องโหลด Goal Rules 4 ข้อก่อนทำงาน: Think Before Coding, Simplicity First, Surgical Changes และ Goal-Driven Execution. Routing canonical อยู่ที่ `assets/passive-skill-map.json` ครอบคลุม `goal-rules`, `refactor-guard`, `test-decision`, `design-discipline`, `sql-explain`; `grantsProductWrite=false` หมายถึง capability ไม่ได้ให้อำนาจเขียนโดยตัวมันเอง ไม่ได้หมายความว่า capability ใช้ได้เฉพาะงาน read-only.

งาน FE/BE ที่เกี่ยวข้องกับการต่อ domain, redirect หรือ callback ต้องเลือก `application + mode + environment + url_kind` จาก `references/application-url-matrix.md` แบบ exact. ห้ามประกอบ URL ด้วย generic string concatenation เมื่อมีค่าใน matrix และค่าที่เป็น `—` ต้องตอบ unsupported ห้าม fallback ไป environment/application อื่น.

งานใดก็ตามที่แตะข้อมูลผ่าน stored procedure, view, table หรือ inline SQL ต้องโหลด `references/db-schema-context.md` ก่อนสรุป. Agent ต้องหาไฟล์ DDL ตามชื่อ object จาก `.agrimap-agent/knowledge/references/db-schema/**/*.sql` (owner = `FACT`) แล้วต่อด้วย `sql/<GROUP_OR_DOMAIN>/` ในโปรเจกต์; `.agrimap-agent/knowledge/drafts/sql/` เป็น `tentative` ใช้เป็นหลักฐานไม่ได้. การเปิดเฉพาะ procedure ไม่พอ ต้องเปิด table และ `LUT_*` ที่ procedure นั้นอ่าน/เขียนต่ออีกหนึ่งชั้นเสมอ. เมื่อ API พัง 500 จาก SP ให้ไล่ตามลำดับ: error code ที่ BE map → `PO_*` output ของ repository → `THROW <number>, '<error_code>'` ใน procedure → section `Validate ...` ที่คุม throw นั้น → predicate/คอลัมน์/`DEL_FLAG` ที่เงื่อนไขใช้ → DDL ของ table ปลายทาง แล้วรายงาน `db-schema: <loaded>/<expected>` พร้อม object ที่หาไม่เจอ. Schema ที่ขาดคือ `UNKNOWN` ที่ต้องถาม owner ห้ามเดา table/column/type/constraint และห้ามต่อฐานข้อมูลจริง.

## 4. Larger text / ข้อความยาว

วิธีแนะนำคือเก็บข้อความในไฟล์ Markdown ภายในโปรเจกต์แล้วชี้ path เพื่อรักษาหัวข้อ, line references และตรวจ coverage ได้. ตัวอย่าง fixture อยู่ที่ [LONG-REQUEST.md](../examples/inputs/LONG-REQUEST.md):

```text
$agm-plan requested_by=Billy input_file=examples/inputs/LONG-REQUEST.md input_kind=large-text coverage_required=full objective="Create an execution plan only; do not edit"
```

Agent ต้องวัดขนาด, อ่านเต็มเมื่อทำได้ หรือแบ่ง chunk ด้วย heading/line range แล้วรายงาน `read` และ `unread`. ห้ามบอกว่าอ่านครบเมื่ออ่านเพียงบางส่วน.

ถ้าจำเป็นต้อง paste ใน chat ให้ใช้ขอบเขตที่ชัดเจน:

```text
$agm-be action=analyze requested_by=Billy objective="Analyze all content between markers; do not edit"

--- BEGIN OWNER INPUT: order-cancellation-v2 ---
<large text>
--- END OWNER INPUT: order-cancellation-v2 ---
```

ถ้า interface ตัดข้อความหรือไม่รับทั้งหมด ให้หยุดและขอเป็นไฟล์ ไม่เดาส่วนที่หาย.

## 5. รูปภาพและ visual reference

ใช้ปุ่ม/คำสั่งแนบไฟล์ของ Codex, Claude หรือ Gemini ก่อน แล้วบอก label, intent, priority และสิ่งที่ต้องสังเกตใน prompt. ไม่มี attachment token กลางที่ใช้เหมือนกันทุกค่าย.

```text
$agm-fe action=design requested_by=Billy target_kind=fe-main phase=foundation objective="Design the checkout states from the attached flow"

inputs:
- id: checkout-flow
  kind: image
  source: attached checkout-flow.svg
  priority: required
  requester_intent: preserve every state and transition; visual styling may change
```

ใช้ [checkout-flow.svg](../examples/inputs/references/checkout-flow.svg) เป็นไฟล์ทดลองได้. หลังตรวจภาพ agent จึงบันทึก `loaded=visual-inspection`, แยก visible fact ออกจาก interpretation และบอกจุดที่ภาพไม่ชัด. หาก host/model มองภาพไม่ได้ ให้บันทึก `loaded=unavailable` และขอ text alternative เช่น [feature-note.md](../examples/inputs/references/feature-note.md) แทน.

## 6. Attachments, pointed files, directories, and exact lines

ไฟล์แนบทั่วไปให้ใช้ native attachment ของ host แล้วอ้างชื่อไฟล์ใน manifest. ไฟล์ใน repository ให้ใช้ relative path; หลีกเลี่ยง path เฉพาะเครื่องเมื่อคนอื่นต้องทำงานต่อ.

```text
$agm-diagnose requested_by=Billy symptom="Duplicate submit after timeout" implementation=false

inputs:
- id: requester-note
  kind: file
  source: examples/inputs/references/feature-note.md
  priority: required
  requester_intent: treat acceptance criteria as requested; material acceptance changes still require decision-owner authority
- id: submit-handler
  kind: file
  source: src/checkout/submit-order.ts
  lines: 80-145
  anchor: submitOrder
  priority: required
- id: checkout-tests
  kind: directory
  source: tests/checkout
  priority: supporting
```

Line numbers เป็น navigation hint; ต้องให้ stable symbol/heading/SQL object ควบคู่เสมอ. การชี้ directory ไม่ได้อนุญาตให้ agent dump ทุกไฟล์เข้า context: agent ต้องตรวจ scope, ignore generated/dependency output และรายงาน coverage.

## 7. End-to-end case: feature + references + QA

1. แนบ `examples/inputs/references/checkout-flow.svg` ผ่าน host.
2. งานนี้มีหลาย input และต้อง QA จึงสร้าง Prompt Result แบบ light/artifactless ก่อน:

```text
$agm-prompt requested_by=Billy context=checkout-retry target_kind=fe-main phase=active-development objective="Implement checkout retry states without duplicating shared UI"

inputs:
- { id: requirements, kind: large-text, source: examples/inputs/LONG-REQUEST.md, priority: required, requester_intent: preserve acceptance criteria }
- { id: flow, kind: image, source: attached checkout-flow.svg, priority: required, requester_intent: preserve states and transitions }
- { id: note, kind: file, source: examples/inputs/references/feature-note.md, priority: supporting, requester_intent: clarify retry behavior }
tests: ask before implementation if existing coverage is insufficient
```

3. ตรวจและ approve `.agrimap-agent/prompts/YYYY-MM/<conversation>/checkout-retry-v001.md`; ขั้น `agm-prompt` ไม่มี task folder, `qa.md` หรือ `result.md`.
4. รัน Prompt Result ที่ approve แล้วด้วย `$agm-exec`; `agm-exec` เริ่ม regulated task ของตัวเองและ implementation checkpoint ต้องเกิดก่อน QA.
5. หลัง integration เรียก QA แยก ซึ่งเป็นผู้สร้าง `qa.md`:

```text
$agm-qa depth=regulated qa_mode=light requested_by=Billy task_id=<feature-task-id> artifact="integrated workspace" acceptance="all authorized states covered; shared UI reused; regression evidence is present"
```

6. Leader เขียน `result.md` เป็นไฟล์สุดท้ายหลัง QA แล้วจึง complete task. ตรวจ result, milestone memory และ JSONL log ก่อนรับคำว่าเสร็จ.

## 8. Prompt delegation, execution, and workspace isolation

`agm-prompt` ใช้ Goal Rules และ embedded supporting disciplines เพื่อสรุป requirement/analysis/design/review/plan เป็น Prompt Result พร้อมรัน แต่ไม่รันเอง. V0 คือ prompt ที่ requester ส่งเข้ามาและไม่มีไฟล์; คำตอบ Model ครั้งแรกสร้าง V1 ทันที. เมื่อ requester โฟกัสผลเดิมแล้วปรับ requirement ให้สร้าง V2…VN โดยใช้ไฟล์เดิมเป็นฐานและห้าม overwrite:

```text
.agrimap-agent/prompts/YYYY-MM/<conversation-id>/<context>-v001.md
.agrimap-agent/prompts/YYYY-MM/<conversation-id>/<context>-v002.md
.agrimap-agent/prompts/YYYY-MM/<conversation>/history.md  # raw requester submits only; no AI answers
```

หนึ่ง version เป็น Prompt Package ไฟล์เดียวที่มี `## Main Assignment` และ `## Subagent Assignments` (หรือระบุว่าไม่มี Subagent). ถ้าไม่ระบุ source file จะต่ออัตโนมัติเฉพาะเมื่อพบ family ที่เชื่อถือได้เพียงหนึ่ง family ใน conversation/context เดียวกัน; ถ้าไม่แน่ใจต้องหยุด `PROMPT_SOURCE_CONFIRM_REQUIRED`. Family ใช้ month เดิมตลอดแม้แก้ข้ามเดือน. เมื่อ decision owner approve (`prompt_status: owner-approved`) จึงนำไปรันด้วย `agm-exec`:

```text
$agm-exec requested_by=Billy prompt=.agrimap-agent/prompts/YYYY-MM/<conversation-id>/<context>-vNNN.md
```

`agm-exec` ปฏิเสธ Prompt Result ที่ยัง `draft` หรือถูก `superseded`. การปิด task ไม่ย้าย raw history, Prompt Result หรือ generated execution instruction. Raw history อยู่ `prompts/YYYY-MM/<conversation>/history.md`; Prompt Results อยู่ `prompts/YYYY-MM/...-vNNN.md`; role instructions ที่เกิดระหว่าง execution เท่านั้นอยู่ `instructions/`.

เมื่อ `agm-prompt` แตกงานใหญ่เป็น Subagent assignments, Main ต้องใส่ `workspace_need` ครบ ไม่พึ่งให้ executor เดาว่า Codex/Claude รองรับ worktree หรือไม่:

```yaml
workspace_need:
  isolation: preferred
  requested_mode: isolated-worktree
  base_ref: feat/order-cancel
  base_commit: <exact-sha-containing-required-state>
  provider_instruction: <exact provider command or agent configuration>
  visibility_check: report cwd, git ref, and integration return path
  integration_return: commit-sha
  fallback_mode: sequential
```

ถ้า mode ที่ขอใช้ไม่ได้ ต้องใช้ `fallback_mode` เท่านั้น. หนึ่งไฟล์/หนึ่ง logical contract มี writer model เดียวต่อ integration wave. เฉพาะ regulated QA ใช้สัญญาที่ [`qa-and-done.md`](../skills/agrimap-agent-skills/references/qa-and-done.md); prompt/role/subagent docs ต้องอ้างอิงและไม่คัดลอก policy ซ้ำ.

### ดูว่า subagent กำลังทำอะไร

Codex รุ่นปัจจุบันเปิด subagent workflow โดย default. ก่อน spawn Leader ต้องแสดงรายการ `ชื่อ agent — งานที่ทำ — output ที่จะคืน` และช่องทางดูสถานะ:

- Codex app: เปิด agent thread จาก activity ใน main task;
- Codex CLI: ใช้ `/agent` เพื่อดู/สลับ active thread;
- Codex IDE: ขยาย background-agent panel เหนือ composer แล้วเปิด agent ที่ต้องการ.

ถ้า Leader ไม่มีงานอิสระให้ทำระหว่างรอ ต้อง poll ไม่เกินครั้งละ 60 วินาทีและรายงาน `running|completed|blocked` พร้อมชื่อ agent/งาน ห้ามปล่อย “Waiting for subagent…” เปล่า ๆ 5–7 นาที. `.agrimap-agent/runtime/progress/<task-id>.jsonl` ใช้เฉพาะ fallback เมื่อ surface นั้นไม่มี native activity จริง และเขียนเฉพาะ start, phase/status transition, finish/block—ไม่เขียนทุก step/tool call; unchanged liveness ไม่ถี่กว่าทุก 5 นาที. ดูเอกสารทางการ [Codex Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents).

## 9. Automated smoke test vs. live-provider check

ใน source repository รัน:

```powershell
npm run sync
npm run audit:tokens
npm run test:usage
npm test
npm run validate
```

`test:usage` ตรวจครบทุก alias ว่ามี Codex/Claude dedicated skill, Gemini command, operation-specific entrypoint, ข้อห้ามโหลด router/รวม operation อื่น, fail-closed package error, documentation case และ multimodal fixtures. มันไม่สามารถพิสูจน์ UI/session ของ provider ที่ไม่ได้ติดตั้งบนเครื่องนั้นได้. หลัง install จึงต้องทำ live check อย่างน้อยหนึ่ง alias, เห็น activation receipt ตามหัวข้อ 2 และเมื่อใช้ subagent ต้องเปิดดู native agent thread ได้.

`audit:tokens` ตรวจ progressive-disclosure path ของทุก operation baseline และ scenario สำคัญ โดยแยก direct alias preload, cumulative `Load now`, conditional discipline และ selected manifest/golden พร้อม words, characters และช่วง token โดยประมาณ. ใช้ `npm run audit:tokens -- --scenario <id> --details` เพื่อดูไฟล์ที่ถูกนับ หรือ `npm run audit:tokens:strict` เพื่อให้ missing route/reference และ budget overflow คืน exit code 1 สำหรับ CI. Token เป็นค่าประมาณ 3–4 characters/token เพราะแต่ละ provider ใช้ tokenizer ต่างกัน.
