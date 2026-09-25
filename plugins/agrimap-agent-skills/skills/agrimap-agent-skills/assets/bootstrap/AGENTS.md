# กติกากลาง Changelog, Release และ Deployment

<!-- AGRIMAP BOOTSTRAP VERSION: 4.9.3 -->

ไฟล์นี้เป็น canonical instruction ของ repository สำหรับ Codex, Claude Code, Gemini CLI, Cursor และผู้พัฒนา โดยไม่ต้องมี AgriMap skills หรือ local Git hook กติกา Markdown ช่วยกำกับพฤติกรรม; Agent ใช้ .NET Global Tool `agm-release` ตรวจ local gate และตรวจหลักฐาน Git ตามไฟล์นี้ ห้ามอนุมานว่า Jenkins บังคับ release gate อยู่ ส่วน GitLab Protected Branch/Tag ต้องตั้งค่าฝั่ง server แยกต่างหาก

## 0. Skill-first routing (บังคับทุก model ก่อนงาน code/SQL)

ใช้กับทุก Agent/model (GPT, Claude Opus/Sonnet, Gemini ฯลฯ) ไม่ขึ้นกับความมั่นใจหรือขนาดงาน คำขอไม่ต้องระบุชื่อ skill

1. ก่อนตอบ วิเคราะห์ อธิบาย review สร้าง แก้ หรือ refactor code/SQL ใน repository นี้ ให้จับคู่หลักฐานกับตาราง (แถวแรกที่ตรง) แล้วโหลด skill ผ่านกลไก skill ของ host (เช่น `/agm-sql`, `$agm-sql`) และอ่าน reference ที่ skill กำหนดก่อนเขียนบรรทัดแรก ห้ามใช้ความรู้ทั่วไปแทน golden pattern ของ AgriMap
2. งานหลาย lane ใช้ skill ของ lane นั้นกับไฟล์ของ lane นั้น (หนึ่งไฟล์มี skill เจ้าของเดียว)

| หลักฐาน (ชื่อ repo / path / คำในคำขอ) | Skill | Target / golden |
| --- | --- | --- |
| `*.sql`, `sql/**`, table/ตาราง, stored procedure/SP, view, function, DDL, column, index, `LUT_*` | `agm-sql` | `sql-table`/`sql-procedure`, `golden/sql/` + `sql-contract-preflight` |
| `agmws-*` หรือ ASP.NET Core host ที่มี Controllers | `agm-be` | `be-main` + `agmws`, `golden/backend-main/` |
| `agmbo-*` หรือ Quartz `JobScheduler.cs` | `agm-be` | `be-main` + `agmbo`, `golden/backend-main/` |
| .NET library (`*.csproj` ไม่มี web host, `AgriMap.Platform.*`, `libraries/netcore/**`) | `agm-be` | `be-library`, `golden/backend-libraries/` |
| `agmwa-*` หรือ Angular app (`src/app/` + `angular.json`) | `agm-fe` | `fe-main`, `golden/frontend-main/` |
| Angular library workspace (`projects/<lib>/ng-package.json`, `@agrimap/*`, `libraries/angular/**`) | `agm-fe` | `fe-library`, `golden/frontend-libraries/` |
| ไม่แน่ใจ | `agrimap-agent-skills` | router เลือก skill เดียว |

3. Golden format เป็นค่าเริ่มต้นตั้งแต่ร่างแรก: Table/SP/View ใช้ schema `[agrimap_app]`, header, column grouping, audit baseline, `CREATE OR ALTER PROCEDURE`, `GO` และ SQLFluff; BE/FE ตรงโครงสร้าง golden collection ที่เลือก ผู้ใช้ไม่ต้องสั่ง "ใช้ agm-sql" หรือ "ปรับตาม Golden Pattern" ซ้ำ
4. ก่อนเขียนไฟล์แสดงหนึ่งบรรทัด `Skill: <agm-*> · Target: <target_kind> · Golden: <entries ที่เปิดอ่านจริง>`; ก่อนส่งงานตรวจตัวเอง ถ้ายังไม่ได้โหลด skill หรือไม่ตรง golden ให้โหลดและปรับก่อนส่ง
5. Host ไม่มี AgriMap skills: แจ้งหนึ่งบรรทัดให้ติดตั้ง/อัปเดตผ่าน `agm-doctor` ห้ามอ้างว่า style ทั่วไปเป็น AgriMap style; คำถามที่ไม่อ้าง code/SQL ของ repo และชื่อ skill ที่ยกเป็นตัวอย่างไม่ต้องโหลด skill

## 1. ขอบเขตและ fixed ownership

- ทำตาม system/developer/owner instruction ที่มี authority สูงกว่า หากขัด contract อย่างมีนัยสำคัญให้หยุดพร้อมหลักฐาน
- ใช้ไฟล์มาตรฐาน: `changelog.md`, `release.md`, `release-notes/<VERSION>.md` ที่ root และ `.agrimap-agent/memory/project.md` เป็น project memory/index กลาง; ห้ามสร้าง root `project.md` หรือไฟล์ต่าง case ซ้ำ
- `CLAUDE.md` (Claude Code), `GEMINI.md` (Gemini CLI) และ `CURSOR.md` (Cursor) เป็น pointer file บาง ๆ ที่ชี้กลับมาที่ `AGENTS.md` เท่านั้น ห้าม copy กติกาลงไปซ้ำหรือเขียนกติกาเฉพาะ tool ที่ขัดกับไฟล์นี้ แก้กติกาให้แก้ที่ `AGENTS.md` จุดเดียว
- Mapping ห้ามเปลี่ยนหรือสลับกัน:
  - Inhouse: `Jenkinsfile` เป็น version owner และ target branch คือ `jenkins`
  - Production: `Jenkinsfile_Production` เป็น version owner และ target branch คือ `jenkins-release`
- Promotion order คือ `develop -> jenkins -> jenkins-release`; Staging/Jenkinsfile_Staging อยู่นอก scope
- คำว่า version หรือ release intent อนุญาตเฉพาะ version metadata pair ใน owner file ที่ระบุ: `IMAGE_TAG` และ `PROJECT_VERSION` เท่านั้น ห้ามแก้ Jenkins pipeline `stage`, stage order, shell command, image/registry configuration, credential, trigger หรือ pipeline behavior ใดๆ
- `Version Production` และ `Version + Tags` มี Jenkins write boundary เฉพาะสองบรรทัดข้างต้นใน `Jenkinsfile_Production`; ห้ามแก้ `Jenkinsfile`, `Jenkinsfile_Staging` หรือส่วนอื่นของ `Jenkinsfile_Production`
- Version intent ไม่ได้ให้สิทธิ์เขียนการแก้ release-governance implementation เช่น `AGENTS.md`, `README.md`, CLI, routing หรือ workflow rules ขึ้นใหม่; กลุ่ม B ให้สิทธิ์ commit งานเดิมที่ค้างรวม governance/pipeline changes ตาม §6.3 โดยแยกจาก version metadata commit และรวมประวัตินั้นไปกับ promotion/tag
- ใช้เลข Version/Patch ที่เจ้าของระบุชัดตาม environment ก่อน; PATCH+1 จาก `PROJECT_VERSION` เป็นค่าเริ่มต้นเมื่อไม่ได้ระบุเลขเท่านั้น รองรับการข้าม Patch และเปลี่ยน minor/major โดยไม่ขอรับผิดชอบหรือแก้ governance ซ้ำ คำสั่งตรงของผู้ใช้มีลำดับเหนือ default นี้ ตรวจรูปแบบเลขและ tag collision ตามจริง หาก CLI ไม่รองรับ ให้แก้ owner pair/artifacts ใน scope โดยตรงและตรวจรูปแบบและเลขที่ร้องขอ, pair equality, allowed diff, notes/index provenance, git diff --check และ resume evidence แทนเฉพาะ assertion PATCH+1 ที่ไม่รองรับ; รายงาน CLI incompatibility ตามจริงและไม่ยกเว้น gate อื่น; ห้ามสมมติว่ามี `--version` และ `--expected-version` เป็น assertion ไม่ใช่ตัวกำหนดเลข
- Both คำนวณ Inhouse/Production แยกจาก owner file ของตน เลขอาจต่างกัน Production tag ใช้ Production version เท่านั้น

## 2. Intent routing

| Intent | ทำอย่างไร |
| --- | --- |
| changelog, diff, backfill, project memory, version, prepare, deploy, Inhouse/Production/Both, release, tag, `นำขึ้น Jenkins` ทุกคำ | อ่าน `AGENTS.release.md` ทั้งไฟล์ก่อนเริ่ม แล้วทำตาม §2 ในไฟล์นั้น (§2, §4–§8 ของ contract นี้อยู่ในไฟล์นั้น เลข § คงเดิม) |
| `integrate`: `merge`, `รวม`, `รวมเข้า <branch>`, `pr`, `เปิด PR`, เลขตัวเลือกจาก Next-step card | ทำตาม §10.4 กับ work branch ปัจจุบัน; ห้าม promote `jenkins`/`jenkins-release`, tag, force push |

งานอื่นที่ไม่ใช่ release ใช้ §0, §1, §3, §9 และ §10 ของไฟล์นี้ (งาน code/SQL เริ่มจาก §0 เสมอ); การยก keyword เป็นตัวอย่างในคำขอตรวจ/แก้เอกสารไม่ใช่คำสั่ง release

ทำตาม governance ของไฟล์นี้และ `AGENTS.release.md` เป็นค่าเริ่มต้นทุกงาน; คำสั่งเฉพาะเจาะจงของมนุษย์ในคำขอปัจจุบัน (เช่น ระบุเลข version เอง ข้าม patch หรือข้ามขั้นที่เป็นค่าเริ่มต้น) มีลำดับเหนือค่าเริ่มต้นนั้นโดยไม่ต้องขออนุมัติซ้ำ แต่ไม่ยกเว้น safety invariants ใน §3 และบันทึกไว้ในรายงานว่าข้ามค่าเริ่มต้นใดตามคำสั่ง

## 3. Preflight และ safety invariants

- อ่าน `.agrimap-agent/memory/project.md` เป็น canonical project memory/index; หากไม่มี ในงาน indexing/prepare/release ที่ได้รับอนุญาตให้ทำ indexing ตามปกติและสร้าง `.agrimap-agent/memory/` พร้อม `project.md` จาก source, Git history และ dirty coverage ในขอบเขตงานก่อน gate ที่ต้องใช้ memory แล้วทำต่อใน invocation เดิม ไม่หยุดเพื่อขอ `Project Backfill` หรือ bootstrap แยก สร้างโฟลเดอร์บันทึกอื่นใต้ `.agrimap-agent/` ตาม §9 เมื่อจำเป็น รักษาไฟล์และประวัติเดิม ระบุ facts/capabilities, evidence, owner versions, coverage limits และ checkpoints จริง ไม่สร้าง placeholder เปล่าหรืออ้างว่าทำ full-history backfill แล้ว; `agm-release indexing` ถือเป็นคำสั่ง Project Backfill ตาม §5 โดยตรง รวม I step ภายใน composite release; standalone prepare ใช้ scoped indexing เท่าที่จำเป็น สำหรับ standalone pipeline/promote ให้ reconstruct memory จาก candidate ที่เตรียมแล้วและพิสูจน์ด้วย notes/diffs/Git ได้ ห้ามสร้าง candidate หรือ bump เพิ่มและห้ามแก้ frozen candidate หาก provenance ไม่ชัดให้หยุดเฉพาะขั้นที่พึ่งหลักฐานนั้น ห้ามสร้าง root `project.md`
- ก่อน network mutation รันและบันทึกผลจริง:

  ```text
  git fetch --prune --tags origin
  git branch --show-current
  git rev-parse HEAD
  git rev-parse --abbrev-ref --symbolic-full-name @{upstream}
  git status --short
  git diff --name-status
  git diff --cached --name-status
  git ls-files --others --exclude-standard
  git diff --check
  ```

- จำแนก staged/unstaged/untracked ทุกไฟล์ ห้ามทิ้ง/เขียนทับ unrelated changes และห้าม deploy จาก unknown dirty state
- ก่อนเขียน bootstrap/release artifacts ของ release ใหม่ ให้ fetch แล้วตรวจ local `develop`, `jenkins`, `jenkins-release` เทียบ remote branch ชื่อเดียวกันให้ครบ แยก equal/behind-only/ahead-only/diverged/missing; fetch อย่างเดียวไม่แปลว่า local pull แล้ว ใช้โฟลเดอร์ repository ที่ผู้ใช้ระบุ ไม่ clone/copy project หรือสร้าง worktree ใหม่อัตโนมัติ ไม่ใช้การมี develop เปิดอยู่หรือไฟล์ bootstrap/log ที่ Agent เพิ่งเขียนเป็นเหตุให้แยกโฟลเดอร์
- Branch ที่ behind-only ให้ `git switch <branch>` และ `git pull --ff-only <remote> <same-branch>` ในโฟลเดอร์เดิมเมื่อ switch ได้อย่างปลอดภัย ก่อนเตรียม candidate ให้กลับ develop; equal ไม่ต้อง pull ส่วน ahead-only ต้องตรวจ local commits และ diverged ต้องวิเคราะห์จริง ไม่ reset/force/stash เพื่อผ่าน gate หาก dirty ขวาง switch/pull ให้จำแนก run-owned กับ unrelated ก่อนและรายงานเฉพาะปัญหาที่ต้องตัดสิน ไม่ commit งานนอก scope เพื่อทำให้สะอาด การ sync local jenkins-release กับ remote ของมันไม่ใช่ merge จาก jenkins/develop และไม่ใช่สิทธิ์ push/promote Production
- Stage เฉพาะ path ที่ยืนยันแล้ว เช่น `git add -- <scoped-files>`; ห้าม `git add .` และ `git add -A`
- ห้าม force push, destructive reset, shared-history rewrite, tag move/delete/reuse ต่าง SHA หรือแก้ conflict ด้วยการเดา
- Divergence/conflict/failed verification/missing permission/tag collision/remote mismatch ให้หยุดเฉพาะ mutation ที่ได้รับผลกระทบและขั้นที่ขึ้นกับมัน แต่ต้องตรวจหลักฐานและทางเลือกที่ปลอดภัยต่อก่อนขอ decision; ห้ามจบเพียงข้อความว่าไปต่อไม่ได้ สำหรับ divergence ใช้ขั้นวิเคราะห์ใน §6.2 และรูปแบบข้อเสนอใน §8
- ทุกขั้น idempotent: checkpoint remote ที่ผ่านแล้วไม่ทำซ้ำ; resume จาก checkpoint ถัดไปและห้าม bump ซ้ำ
- งาน audit ต้องบันทึก branch/HEAD และ dirty inventory ก่อนเขียนแม้ไม่มี network mutation; worktree สะอาดไม่ได้แปลว่าไม่มี change ที่ยังขาด changelog

## 9. Portable `.agrimap-agent` recording contract โดยไม่ต้องมี skills

กติกาส่วนนี้ใช้กับ Gemini, GPT/Codex, Claude และ Agent อื่นทุกตัวโดยตรงจาก `AGENTS.md` ไม่ต้องติดตั้งหรือเรียก AgriMap Agent Skills, hook, plugin หรือ lifecycle CLI และห้ามใช้การไม่มีเครื่องมือเหล่านั้นเป็นเหตุผลที่จะไม่บันทึกงาน

### 9.1 Git allowlist และขอบเขต

- อนุญาตให้สร้าง/แก้และนำเข้า Git จาก `.agrimap-agent/**` เฉพาะ subtree ต่อไปนี้:
  - `.agrimap-agent/decisions/**`
  - `.agrimap-agent/instructions/**`
  - `.agrimap-agent/knowledge/**`
  - `.agrimap-agent/logs/**`
  - `.agrimap-agent/memory/**`
  - `.agrimap-agent/policy/**`
  - `.agrimap-agent/reports/**`
- คำว่า `decision` ในคำสั่งหมายถึง canonical directory `decisions/` ซึ่งเป็นพหูพจน์ ห้ามสร้าง `.agrimap-agent/decision/` ซ้ำ
- สำหรับกลุ่ม B อนุญาต stage/commit audit artifacts ที่มีอยู่ใน `.agrimap-agent/prompts/**` และ `.agrimap-agent/tasks/**` เพิ่มเติมหลังตรวจเนื้อหาและข้อมูลลับ เพื่อไม่ทิ้งงานที่ runtime สร้างไว้ สิทธิ์นี้ไม่สั่งให้สร้าง artifact เหล่านี้เพิ่ม; raw requester input คงอยู่เฉพาะ prompt history ตาม contract ของ host
- Mode อื่นยังห้ามสร้าง แก้ stage หรือ commit `.agrimap-agent/prompts/**`, `.agrimap-agent/tasks/**` เว้นแต่ owner สั่ง path นั้นชัดเจน; `.agrimap-agent/runtime/**` และ path อื่นนอก allowlist ไม่ถูก publish อัตโนมัติทุก mode หากปรากฏใน inventory ให้รายงาน blocked ตาม §6.3
- ไฟล์เดิมที่อยู่นอก allowlist ไม่ใช่สิทธิ์ให้ Agent แตะหรือลบ และห้ามล้าง artifact ของ Agent/ผู้พัฒนาคนอื่น
- `.agrimap-agent/local/**` เป็นความจำเฉพาะเครื่อง (เช่น path ของ spec นอก repo) ถูก ignore และห้าม stage/commit ทุก mode; ไฟล์ที่ commit อ้าง spec นอก repo ด้วย id ใน `policy/project.json` เท่านั้น ห้ามใส่ absolute path ของเครื่อง

### 9.2 Run identity และรูปแบบ path

- งานที่แก้ repository หรือสร้างผลลัพธ์ durable ให้ใช้ human requester ที่ยืนยันแล้วในบทสนทนา/host context เดิมก่อน หากไม่มี local state ไม่ได้แปลว่าต้องถามชื่อซ้ำ ตรวจ session ปัจจุบัน, confirmed local-user record และ session ที่ยังใช้ได้ของเครื่อง/ผู้ใช้เดียวกันใน repository นี้ก่อนถาม; ถ้ามี runtime ใช้ `agm-workspace.mjs requester --cwd <project> --session <session>` แบบอ่านอย่างเดียว แล้วส่งชื่อที่ยืนยันแล้วผ่าน `--requested-by` ให้ start/identify เมื่อจำเป็น ไม่ยืนยันชื่อใหม่ทุกวันสำหรับ persistent confirmation และไม่เดาจาก Git author/OS user หรือ copied audit history เพียงอย่างเดียว ถ้าหลักฐานที่ยืนยันยังขาดหรือขัดกันจึงถามครั้งเดียว ตัวตนไม่ใช่สิทธิ์อนุมัติ release
- ใช้เวลา `Asia/Bangkok`; `RUN_ID` รูปแบบ `ddHHmmss` และ slug แบบ lowercase-kebab-case หาก ID/path ชนกับของเดิมให้ใช้วินาทีถัดไป ห้ามรวมสอง run
- ใช้ path มาตรฐาน:
  - decision: `decisions/YYYY-MM/<RUN_ID>-<slug>.md`
  - instruction: `instructions/YYYY-MM/<RUN_ID>/<name>.md`
  - log: `logs/YYYY-MM/YYYY-MM-DD/<RUN_ID>.jsonl` (ไฟล์รายวันแบบเดิม `logs/YYYY-MM/YYYY-MM-DD.jsonl` ยังอ่านได้ ห้ามย้ายหรือแก้)
  - current memory: `memory/current/YYYY-MM/<RUN_ID>-<slug>.md`
  - recent memory: `memory/recent/YYYY-MM/<RUN_ID>-<slug>.md`
  - report: `reports/YYYY-MM/<RUN_ID>-<slug>.md`
  - reusable knowledge: ใช้โครงสร้างเดิมใต้ `knowledge/references/`; หลักฐานที่ยังไม่ยืนยันอยู่ `knowledge/drafts/` และต้องติดป้าย `UNKNOWN` หรือ `tentative`

### 9.3 สิ่งที่ต้องบันทึก

| Artifact | เมื่อใด | เนื้อหาขั้นต่ำ |
| --- | --- | --- |
| `logs` | ทุก run: start, milestone ที่เปลี่ยน outcome และ terminal | JSONL append-only หนึ่ง object ต่อ event: `timestamp`, `runId`, `event`, `requestedBy`, `agent`, `model`, `summary`, `files`, `verification`; event ใช้ `created|decision|changed|verified|completed|blocked|cancelled` |
| `memory/current` | สร้างเมื่อเริ่มงาน | requester, objective, scope/non-goals, branch/HEAD, status, last milestone, changed files, verification, concern และ next action; อัปเดตเฉพาะ durable milestone ไม่เก็บ transcript/raw output |
| `memory/recent` | ทุก run | journal แบบสั้นของ created, material decision, changed, verified และ terminal พร้อม `RUN_ID` เดียวกัน |
| `reports` | เมื่อ `completed|blocked|cancelled` | status, requester, agent/model, scope, baseline/candidate SHA, changed files, evidence/changelog coverage, commands กับผลจริง, omitted actions, concerns และ next decision |
| `decisions` | เฉพาะเมื่อมี material trade-off/owner decision | context, options, selected decision, decision owner, rationale, consequences, evidence และ superseded decision ถ้ามี |
| `instructions` | เฉพาะเมื่อ owner อนุมัติ reusable/execution instruction | objective, authorized scope, inputs, exact steps, stop conditions, verification และ expected result; ห้ามเก็บ raw prompt หรือ transcript |
| `knowledge` | เฉพาะข้อเท็จจริง reusable ข้ามงาน | `FACT|UNKNOWN|tentative`, source path/commit/report, status/currentness และขอบเขตการใช้; ห้ามสรุปจาก commit subject อย่างเดียว |

ทุก run ที่แก้ repository ต้องสร้าง `logs + memory/current + memory/recent` ระหว่าง lifecycle และปิดด้วย `report`; current memory ลบได้เฉพาะ terminal rule ด้านล่าง ส่วน `decisions`, `instructions`, `knowledge` สร้างเมื่อเข้าเงื่อนไขเท่านั้น ห้ามสร้างไฟล์เปล่าเพื่อให้ดูว่าครบ

### 9.4 Portable lifecycle

1. อ่าน `AGENTS.md`, `.agrimap-agent/memory/project.md` ถ้ามี, `git status --short`, staged/unstaged/untracked และ branch/HEAD ก่อนเขียน; หาก memory ไม่มีให้ทำ indexing และสร้าง path ตาม §3 ภายในงานที่ได้รับอนุญาต
2. ใช้ requester ที่ยืนยันไว้ตาม §9.2 ก่อนถามซ้ำ แล้วสร้าง `RUN_ID`, current/recent memory และ append `created` log โดยไม่บังคับให้มี skill หรือ helper script
3. ก่อน mutation ระบุ objective/non-goals, exact write boundary, logic ที่เปลี่ยน/ต้องคงเดิม, วิธีที่เล็กสุด และ acceptance/verification
4. ระหว่างทำงาน บันทึกเฉพาะ material decision หรือ milestone ที่ outcome เปลี่ยน; raw command output อยู่ใน terminal ไม่คัดลอกลง memory/log
5. ก่อนปิดงานรัน verification ที่เหมาะสมและ `git diff --check`; docs-only ใช้ `tests: not applicable` ได้แต่ห้ามอ้างว่าทดสอบ feature แล้ว
6. ปิดงานด้วย report, terminal log, recent-memory event และเพิ่ม fact ใน `memory/project.md` `## Facts` เฉพาะเมื่อเป็นข้อเท็จจริงที่ใช้ซ้ำข้ามงาน (ไม่ใช่รายการงานที่เสร็จ); `completed|cancelled` ให้ลบ current memory ของ run นั้น ส่วน `blocked` ต้องเก็บ current memory พร้อม blocker/next action
7. Artifact เป็น append-only ตามธรรมชาติของ log/history; การแก้ข้อเท็จจริงใช้ correction/supersedes ที่อ้างไฟล์เดิม ห้าม rewrite audit history หรือลบหลักฐานเพื่อให้ผลดูผ่าน

### 9.5 Git coverage gate

- ก่อน commit แสดงไฟล์ allowlist ที่ modified/untracked จริงด้วย `git status --short -- <allowlisted-subtrees>` และตรวจว่าทุก artifact ของ run ถูกนับครบ
- Stage ด้วย exact file paths ที่ตรวจแล้วเท่านั้น เช่น `git add -- <file-1> <file-2>`; ห้าม `git add .`, `git add -A` หรือ `git add -- .agrimap-agent`
- ห้าม stage path นอก allowlist เพียงเพราะอยู่ใน worktree; หากงานจำเป็นต้องใช้ path นอก allowlist ให้หยุดและขอ owner authority ก่อน
- ห้าม complete หากมี artifact ที่ run นี้สร้าง/แก้ใน allowlist แต่ตกหล่นจาก intended commit หรือ report ไม่ตรงกับ Git diff/status จริง
- หาก policy §10 ไม่เปิด delivery และไม่ได้สั่ง commit ให้รายงาน exact modified/untracked paths เป็น local deliverables; กลุ่ม B ต้อง commit/push final audit artifacts ตาม §6.3
- ห้ามเก็บ secret, token, credential, ข้อมูลส่วนบุคคลที่ไม่จำเป็น, hidden reasoning, transcript หรือ raw telemetry ใน artifact ใด ๆ; raw requester input อนุญาตเฉพาะ prompt history ตามข้อยกเว้น §9.1 และ contract ของ host ห้ามคัดลอกเข้า memory/log/report

## 10. Team workflow: repository, work branch, delivery และ integration

### 10.1 Repository และ instruction chain

- Target repository คือ `git rev-parse --show-toplevel` ของไฟล์ที่จะแก้ ไม่ใช่ directory ที่เปิด session; ถ้า session อยู่นอก repo และมีหลาย repo ให้ถามว่าเป็น repo ไหนก่อนเขียน
- ก่อนเขียนครั้งแรกใน repository อ่าน `AGENTS.md` ทุกไฟล์ตั้งแต่ root ของ repo ขึ้นไปถึง root ของ drive และ `AGENTS.md` ใน subdirectory ที่มีไฟล์ที่จะแก้ ไฟล์ที่ใกล้ไฟล์เป้าหมายกว่ามีผลเหนือกว่าเมื่อขัดกัน
- ห้ามสร้าง `.agrimap-agent/` ใน directory ที่ไม่ใช่ root ของ Git repository

### 10.2 Policy

- `.agrimap-agent/policy/workflow.json` คือ workflow ของทีม (prefix/base/target ของ branch, delivery, integration) อ่านก่อนงานที่แก้ repository ทุกครั้ง
- ถ้าไม่มี: ตรวจ `Jenkinsfile*`, `git branch -a` และ remote แล้วเสนอ workflow ที่ตรวจพบเป็นคำถามเดียวพร้อมตัวเลือก ก่อนเขียนครั้งแรก เมื่อ owner ตอบ ให้สร้างไฟล์ `status: confirmed` และ decision record แล้วไม่ถามซ้ำ
- Policy ที่ confirmed เป็นสิทธิ์ถาวรให้ commit และ push **work branch** เมื่องานผ่าน verification เท่านั้น ไม่ใช่สิทธิ์ push/merge `develop`, `jenkins`, `jenkins-release`, `main` หรือสร้าง tag
- Integration ค่าเริ่มต้นคือ `local-merge` ไม่ต้องเปิด MR/PR: `merge`/`รวม` คือ merge เข้า target แล้ว push เมื่อ test ในเครื่องผ่าน; MR/PR เฉพาะเมื่อสั่ง `pr`/`mr` หรือ policy เป็น `pull-request`
- Repository ที่ promote `develop -> jenkins -> jenkins-release` แบบ `--ff-only` (§6.2): ทุก work type รวม hotfix แตกจาก `develop` และรวมกลับ `develop`

### 10.3 เริ่มงานและส่งงาน

1. ก่อนเขียน: บันทึก `git status --porcelain` ไว้เป็นรายการไฟล์ที่ค้างก่อนเริ่ม
2. ถ้าอยู่บน protected branch: `git fetch origin`, ถ้า tree สะอาดให้ `git merge --ff-only origin/<base>` แล้ว `git switch -c <prefix><english-kebab-slug>`; ถ้า tree ไม่สะอาดให้ `git switch -c` จาก HEAD เดิมโดยไม่ pull ห้าม stash/reset/สร้าง worktree
3. Branch ที่ host สร้างเอง (เช่น `claude/*`, `codex/*`) ไม่ต้องเปลี่ยนชื่อ local แต่ push ด้วยชื่อทีม: `git push -u origin HEAD:refs/heads/<prefix><slug>`
4. เมื่อ verification ผ่าน: เติม changelog ตาม §5, stage เฉพาะไฟล์ของงานนี้ด้วย `git add -- <paths>` (ห้ามรวมไฟล์ที่ค้างก่อนเริ่มโดยไม่ถาม), `git diff --cached --check`, commit ตามรูปแบบ commit ของทีมใน §10.6, push work branch แล้วตรวจ `git ls-remote --heads origin <branch>` ให้ SHA ตรง
5. สรุปจบงานไม่เกิน 12 บรรทัด: branch/commit/remote, ไฟล์และผลทดสอบ, สิ่งที่ตัดสินใจแทน, ไฟล์ที่ไม่ได้รวม แล้วปิดด้วยตัวเลือกถัดไปแบบมีเลข (ข้อ 1 คือที่แนะนำ)
6. หยุดถามเฉพาะเรื่องที่ย้อนไม่ได้หรือไม่ปลอดภัย (push/merge branch หลัก, ข้อมูลลับ, conflict, สิทธิ์); ปัญหาอื่น เช่น test ไม่ผ่าน หรืออัปเดต spec ไม่ได้ ให้ส่งงานเข้า work branch ต่อ (commit ระบุ `AGM-Verification: failed` เมื่อ test ไม่ผ่าน) แล้วสรุปใน section `⚠️ ต้องตามต่อ` ที่บอกสิ่งที่เกิด ผลกระทบ และวิธีแก้ — ห้ามเสนอ merge จนกว่า test ผ่าน

### 10.4 คำสั่งสั้นหลังส่งงาน

| ผู้ใช้พิมพ์ | ความหมาย |
| --- | --- |
| เลขตัวเลือก | ทำตามตัวเลือกนั้นของคำถามล่าสุด |
| `merge`, `รวม`, `รวมเข้า <branch>`, `ship`, `ผ่าน รวมได้`, `LGTM` | รวม work branch เข้า target ตาม policy |
| `pr`, `mr`, `เปิด PR`, `ส่งรีวิว` | เปิด PR/MR เข้า target |
| `อัปเดต branch`, `sync` | merge target ล่าสุดเข้า work branch แล้ว push |
| `แก้ต่อ`, `พักไว้` | ทำงานต่อ / หยุดไว้ให้ resume |
| `ทิ้ง`, `ยกเลิก branch` | ถามก่อนว่าจะลบ local หรือทั้ง local และ remote |

- ข้อความที่เป็นคำถาม ("merge ยังไง?") หรือยกตัวอย่างในเครื่องหมายคำพูด ไม่ใช่คำสั่ง
- คำสั่งสั้นเป็นการยืนยันเฉพาะ action นั้น: รวมเข้า target ที่ policy กำหนดและ push/verify remote; การลบ branch, target อื่น หรือ merge ขณะ check ไม่ผ่าน ต้องถามแยก
- รวมแบบ local: merge `origin/<target>` เข้า work branch ก่อน (conflict ให้ `git merge --abort` แล้วรายงาน path), ทดสอบ, push work branch แล้ว push ผล merge เข้า target โดยไม่ force; ถ้า remote ปฏิเสธให้รายงาน ห้าม force/bypass review/เปิด auto-merge เว้นแต่ผู้ใช้สั่ง
- `jenkins` และ `jenkins-release` ไม่ใช่ target ของ integration ให้ใช้ release intent ใน §2

### 10.5 โหมดการพัฒนาและ spec

- `.agrimap-agent/policy/project.json` บอก `developmentMode`: `code-first` (Not AI-First: ของเดิม ยึด code และ test), `spec-first` (AI-First: ยึด markdown spec) หรือ `hybrid` (ของเดิมยึด code งานใหม่หรือ path ใน `specs.scopes` ยึด spec)
- ไม่มีไฟล์: ตรวจหลักฐานใน repo, history และ spec pack ข้างเคียง ถ้ามั่นใจให้บันทึก `status: inferred` แล้วบอกผู้ใช้บรรทัดเดียว ถ้าไม่มั่นใจให้ถามก่อนเริ่มเขียนพร้อมให้ระบุตำแหน่ง spec
- Spec นอก repo อ้างด้วย id และ fingerprint ใน policy; path จริงของแต่ละเครื่องอยู่ใน `.agrimap-agent/local/memory.md` อ่านจากไฟล์นั้นก่อน ค้นหาเฉพาะ directory ข้างเคียงเมื่อไม่มี และถามเมื่อหาไม่เจอ ห้ามค้นทั้ง disk
- `spec-first` หรือไฟล์ใน scope ของ `hybrid`: อ่าน spec item ที่เกี่ยวข้องก่อนเขียน; คำขอที่เพิ่ม/เปลี่ยน requirement ให้แก้ spec ก่อนใน branch เดียวกัน; คำขอที่ขัดกับ spec หรือ open question ที่ block ให้ถาม; หลัง verify ให้อัปเดต status ของ task, evidence ใน traceability, changelog และ manifest ของ spec เองทุกงานโดยไม่ต้องรอสั่ง; ส่วนที่เป็นเนื้อหา (requirement, acceptance criteria, design) แก้ตามคำสั่งในรอบนั้นเท่านั้น ถ้างานเผยว่า spec ผิดหรือขาดโดยไม่ได้สั่ง หรือไม่มั่นใจว่าคำสั่งครอบคลุมแค่ไหน ให้ถามก่อน; ปัญหาในการอัปเดต spec ไม่ทำให้ส่งงานไม่ได้ แต่ต้องแจ้งเป็น warning ให้ชัด
- `code-first`: ยึด code และ test; ไม่แก้ spec หรือเอกสารเองนอกจาก changelog/README ตาม §5; เจอเอกสารขัด code ให้บอกบรรทัดเดียว
- ผู้ใช้สั่งเรื่อง spec ครั้งเดียว (เช่น "อัปเดต spec ด้วย") ให้ถามว่าจะทำทุกงานไหม แล้วบันทึกลง `project.json` เพื่อไม่ต้องสั่งซ้ำ

### 10.6 รูปแบบ commit ของทีม

- Header `<type>: <คำอธิบายภาษาคน>` ≤ 100 ตัวอักษร ไม่มี scope เขียนให้ App Leader/BA/ลูกค้าอ่านรู้เรื่อง เทคนิคใส่ body
- งานพัฒนา: `feature:` ความสามารถใหม่, `fix:` แก้สิ่งที่ผิด, `comment:` ปรับตาม comment/ปรับปรุง (หน้าตา ข้อความ โครงสร้าง เอกสาร); agm-release: `bump:` version, `audit:` บันทึก `.agrimap-agent`, `ci:` pipeline/governance/bootstrap
- ตัวอย่าง: `feature: เพิ่มรับ User หลายช่องทาง`, `fix: แก้ dynamic form เพิ่มวันที่ ช่วงเวลา`

## Bootstrap contract freshness

Before relevant durable project work, compare the AGRIMAP BOOTSTRAP VERSION marker and `.agrimap-agent/runtime/bootstrap.json` with the active skill bootstrap manifest. Missing markers mean legacy/untracked, not current. Use the active skill project-bootstrap plan/apply to update recognized unmodified installed templates automatically, with backup and receipt; do not require a separate bootstrap invocation. Preserve project-specific rules: unknown or modified content requires a scoped merge from the actual prior/current templates, never blanket replacement or merely changing the version marker. Verify the installed contract after update before continuing. Read-only questions do not write files. Explicit owner version targets remain authoritative during migration.

### Host recording example

สำหรับงานใน Antigravity CLI ให้บันทึก `provider: antigravity`, `model: <actual runtime model ID>` หรือ `unknown` เมื่อไม่มีหลักฐาน และ `modelLabel: not-configured` เมื่อไม่ได้กำหนด label; Antigravity CLI เป็นชื่อ host ไม่ใช่ชื่อ model ห้ามเดา Gemini version จากชื่อ host ประวัติ Gemini CLI เดิมคง provider/model ตามหลักฐานเดิม ตัวอย่าง: `Provider: antigravity | Actual model: unknown`
