# ACG Roadmap 4.7.0 → 4.9.0 — Unattended execution spec (v3)

| Field | Value |
| --- | --- |
| Status | v3 — runbook สำหรับทำต่อจนจบโดยไม่มีคนเฝ้า |
| Date | 2026-09-19 |
| Baseline | `develop` = package `4.6.0` (P1 implemented, PR #21); release `v4.6.0` ยังรอ approval |
| Design reference | [agent-collaboration-governance-v2.md](agent-collaboration-governance-v2.md) (v2.2) |
| Audience | Agent ที่รัน queue ต่อเนื่อง และ owner ที่กลับมาตรวจทีหลัง |

## 0. ลำดับความสำคัญของเอกสาร

1. คำสั่งของผู้ใช้ในแชท
2. **ไฟล์นี้** (roadmap v3) — รวมถึง unattended protocol (§2) และค่าที่ตัดสินล่วงหน้า (§5–§7)
3. design spec §20 (as-built 4.6.0 และรายละเอียด phase)
4. design spec §2–§19 (design เดิม)

ไฟล์นี้เรียบเรียงงานที่เหลือใหม่ทั้งหมดเป็นลำดับเดียว ไม่ต้องไล่อ่าน revision ของ design spec — เปิด design spec เฉพาะเมื่อไฟล์นี้อ้าง `§` ของมัน (เขียนว่า `D§n` = design spec section n)

---

## 1. สถานะปัจจุบัน (2026-09-19)

| เรื่อง | สถานะ |
| --- | --- |
| `develop` | 4.6.0 — C1–C6 + C9-A ครบ, CI ubuntu/windows ผ่าน |
| `main` | 4.6.0 (PR #22) |
| Release | ล่าสุดที่ publish = `v4.5.5`; run ของ 4.6.0 **รอ reviewer approval** — ไม่อยู่ใน queue (owner ทำเอง) |
| Spec branch | `feature/acg-phase-specs-4.7-4.9` (ไฟล์นี้ + design spec v2.2) ยังไม่ merge |
| Working tree | ไฟล์ค้างที่ไม่ใช่ของ queue: `DEVELOPMENT.md`, `tests/unit/package-release.test.mjs`, `tools/check-package-pr.mjs` — **ห้ามแตะ** |
| งานค้างจาก 4.6.0 | audit residue (bug), `glab` ยังไม่ verify, one-time spec card — อยู่ใน P2 (§5) |

---

## 2. Unattended protocol

### 2.1 หลักการ

Owner ไม่อยู่หลายชั่วโมง Agent ต้อง **ทำต่อจนจบ queue** โดย:
- ไม่หยุดรอคำตอบ — เรื่องที่ปกติต้องถาม ให้ **เลือกเอง** (ใช้ข้อแนะนำ) หรือ **ข้าม** ตาม §2.2 แล้วบันทึกใน question file (§2.3)
- ทำทุกอย่างให้ **ย้อน/เขียนใหม่ได้ง่าย** เพราะ owner อาจสั่ง rewrite การตัดสินใจทีหลัง (§2.4)
- ไม่ทำสิ่งที่ย้อนไม่ได้หรือออกนอกขอบเขต (§2.5)

### 2.2 เมื่อเจอจุดที่ต้องตัดสินใจ

| ชนิด (D§2.4, D§5) | ปกติ | Unattended |
| --- | --- | --- |
| agent-owned, R0/R1 | ตัดสินเอง | ตัดสินเอง ไม่ต้องบันทึก question (บันทึกใน PR "decided for you" ได้) |
| requester-owned R1/R2 ที่มีค่าในตาราง "ค่าที่ตัดสินล่วงหน้า" (§5.3, §6.3, §7.3) | card | ใช้ค่านั้น **ไม่ต้องบันทึก question** (owner ตัดสินผ่าน spec นี้แล้ว) |
| requester-owned R1/R2 ที่ไม่มีค่าล่วงหน้า | card | **เลือกข้อแนะนำ** + บันทึก question status `decided` |
| ข้อมูลไม่พอจะเลือกอย่างมีเหตุผล (Low confidence และทุกทางมีผลต่อ contract) | card | **ข้าม** ส่วนนั้น (ทำส่วนอื่นต่อ) + บันทึก question status `skipped` พร้อมสิ่งที่ข้าม |
| R3 / `stop` (D§2.4) | confirm | **ไม่ทำ** + บันทึก question status `deferred` — ดูรายการ §2.5 |

กติกาการเลือกเพื่อให้ rewrite ง่าย:
1. เลือกทางที่ **ย้อนง่ายที่สุด** เมื่อสองทางใกล้เคียงกัน (config/flag ดีกว่า hard-code, เพิ่มดีกว่าลบ)
2. แยกผลของการตัดสินใจแต่ละข้อไว้ใน **commit ของตัวเอง** เมื่อทำได้ และใส่ trailer `AGM-Question: Q-<version>-<nn>`
3. ห้ามทำการตัดสินใจที่ทำให้ phase ถัดไปพังถ้า owner เลือกทางอื่น — ถ้าเลี่ยงไม่ได้ ให้เขียนใน question ว่า "rewrite แล้วต้องแก้ phase ไหนต่อ"

### 2.3 Question file

- Path: `specs/questions/question-<version>.md` เช่น `specs/questions/question-4.7.0.md` — หนึ่งไฟล์ต่อ version, commit ไปกับ phase นั้น
- ID: `Q-<version>-<nn>` เลขสองหลักเรียงตามเวลาที่เกิด
- ไม่มีคำถามเลย → ยังสร้างไฟล์ โดยเขียนว่า "ไม่มีการตัดสินใจแทน owner ใน phase นี้"

รูปแบบแต่ละข้อ (ภาษาไทย, identifier เป็นอังกฤษ):

```markdown
## Q-4.7.0-03 — <หัวข้อสั้น>

- Status: decided | skipped | deferred | answered | rewritten
- Risk: R1 | R2 | R3 · Confidence: high | medium | low
- Context: <เจอตอนทำอะไร ทำไมต้องตัดสิน 1–3 บรรทัด>
- Options:
  1. <ทางที่เลือก> (เลือกแล้ว / แนะนำ) — <ผล>
  2. <ทางอื่น> — <ผล>
- Chosen: 1 — <เหตุผล>
- Affected: <ไฟล์/ฟังก์ชัน>, commits <sha7,…> (trailer `AGM-Question: Q-4.7.0-03`)
- Skipped work (เฉพาะ skipped/deferred): <สิ่งที่ยังไม่ได้ทำ>
- Rewrite cost: ต่ำ | กลาง | สูง — <ต้องแก้อะไรบ้างถ้าเลือกข้ออื่น รวม phase ถัดไป>
- Owner answer: _(ว่างไว้ให้ owner)_
```

ด้านบนของไฟล์มีตารางสรุป: `| ID | หัวข้อ | Status | Chosen | Rewrite cost |`

### 2.4 Rewrite protocol (ใช้เมื่อ owner กลับมา)

Owner สั่งได้สั้นๆ เช่น:
- `rewrite Q-4.7.0-03 → 2`
- `Q-4.7.0-03: ใช้ <ข้อความ>`
- `ตอบ question-4.7.0 ตามที่เขียนในไฟล์` (owner กรอก `Owner answer` แล้ว)
- `ok ทั้งหมด` (ยอมรับทุกข้อที่ `decided`)

Agent ทำตามลำดับ:
1. อ่าน question และ `Affected`/commit ที่มี trailer ของ ID นั้น
2. ถ้าคำตอบตรงกับ `Chosen` → status `answered` ไม่แก้โค้ด
3. ถ้าต่าง → checkout branch ของ phase นั้น, แก้ตามคำตอบ (ใช้ `git revert` ของ commit ที่แยกไว้ได้เมื่อเหมาะ ห้าม force push/rewrite history), รัน test ที่เกี่ยวข้อง, commit ใหม่ trailer `AGM-Question: Q-…` + `AGM-Rewrite: <n>`, push
4. ถ้า phase ถัดไปพึ่งค่านั้น (ดู `Rewrite cost`) → merge branch ที่แก้เข้า branch ของ phase ถัดไปแล้วแก้ต่อจนเขียว
5. อัปเดต question: status `rewritten`, `Owner answer`, commit ใหม่
6. `skipped`/`deferred` ที่ owner ตอบแล้ว = งานใหม่ในขอบเขตเดิม ทำให้จบตาม phase นั้น

### 2.5 ห้ามทำใน unattended mode

| ห้าม | ทำแทน |
| --- | --- |
| merge PR, push `develop`/`main`/`release/*`, สร้าง tag, release, approve workflow/environment | บันทึก `deferred` + ใส่ใน queue-status |
| force push, rewrite history, ลบ branch/remote branch | — |
| แตะไฟล์ค้าง 3 ไฟล์ใน §1 | — |
| ย้าย spec pack จริงเข้า Git (D§19.21) | งาน operator แยก |
| เปลี่ยน GitHub settings (default branch, protection) | บันทึกเป็นข้อเสนอใน queue-status |
| ติดตั้ง tool ใหม่บนเครื่อง (เช่น `glab`) | ใช้ stub + warning |

ที่ **ทำได้**: สร้าง/commit/push work branch ของ queue (§3), เปิด **draft PR**, อ่าน `--help`/เอกสาร, รัน test/build ในเครื่อง

### 2.6 เมื่อทำไม่สำเร็จ

- แก้ test ที่ fail ได้ไม่เกิน **3 แนวทาง** ต่อปัญหา (ตาม `references/qa-and-done.md`: ล้มเหลวซ้ำแบบเดิมต้องเปลี่ยนวิธี)
- ยังไม่ผ่าน → commit งานที่ทำได้ (trailer `AGM-Verification: failed`), บันทึก question `skipped` + blocker, แล้ว:
  - ถ้า phase ถัดไป **ไม่** พึ่งส่วนที่พัง → ไปต่อ
  - ถ้าพึ่ง → หยุด queue, เขียน queue-status `blocked` พร้อมสิ่งที่ owner ต้องตัดสิน
- CI ของ draft PR fail → อ่าน log, แก้ตามกติกาเดียวกัน

### 2.7 Queue status

- Path: `specs/questions/queue-status.md` บน branch ของ phase ล่าสุด (เพราะ branch ต่อกันแบบ stack ไฟล์นี้จะอยู่ครบใน branch สุดท้าย)
- อัปเดตทุกครั้งที่ phase จบ และก่อนหยุด:

```markdown
| Phase | Version | Status | Branch | Head | Draft PR | Tests | Questions (decided/skipped/deferred) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P2 | 4.7.0 | done | feature/acg-p2-4.7.0 | abc1234 | #23 | 140/140, release 4/4, tokens ok | 3/1/0 |

## สิ่งที่ owner ต้องทำ (เรียงตามความสำคัญ)
1. อ่าน specs/questions/question-4.7.0.md …
2. merge PR ตามลำดับ #23 → #24 → #25 (stacked)
3. …
```

- ใช้เป็นจุด resume ด้วย: ถ้า context ถูกย่อหรือ session ใหม่ ให้อ่านไฟล์นี้ก่อนแล้วทำต่อจาก phase ที่ยังไม่ `done`

---

## 3. Branch และ PR แบบ stack

เพราะ queue ห้าม merge เข้า `develop` (§2.5) แต่ P3 ต้องใช้ของ P2 และ P4 ต้องใช้ของ P3 จึงต่อ branch กันเป็นชั้น:

```text
origin/develop (4.6.0)
  └─ feature/acg-p2-4.7.0   ← เริ่มจาก develop + นำ spec 2 ไฟล์เข้ามาเป็น commit แรก
       └─ feature/acg-p3-4.8.0
            └─ feature/acg-p4-4.9.0
```

| Branch | สร้างจาก | Draft PR base | หมายเหตุ |
| --- | --- | --- | --- |
| `feature/acg-p2-4.7.0` | `origin/develop` | `develop` | commit แรก: `git checkout origin/feature/acg-phase-specs-4.7-4.9 -- specs/` แล้ว commit `docs(spec): bring roadmap and design spec` |
| `feature/acg-p3-4.8.0` | `feature/acg-p2-4.7.0` (HEAD ล่าสุด) | `feature/acg-p2-4.7.0` | route check ยอมรับ base ที่ไม่ใช่ `develop`/`main` |
| `feature/acg-p4-4.9.0` | `feature/acg-p3-4.8.0` | `feature/acg-p3-4.8.0` | |

- สร้างด้วย `git switch --no-track -c <new> <from>` (ไม่ checkout protected branch — D§20.1 B1)
- Owner merge ตามลำดับ P2 → P3 → P4 และเปลี่ยน base ของ PR ถัดไปเป็น `develop` หลัง merge ตัวก่อน (เขียนไว้ใน queue-status)
- ถ้า `feature/acg-phase-specs-4.7-4.9` ถูก merge เข้า develop ก่อนเริ่ม → ข้าม commit แรกของ P2

---

## 4. ขั้นตอนร่วมของทุก phase

1. **Resume check**: อ่าน `specs/questions/queue-status.md` (ถ้ามี) — phase ที่ `done` แล้วข้าม
2. สร้าง branch ตาม §3
3. แก้ `package.json` version เป็นเลขของ phase **ก่อน** `npm run sync` ครั้งแรก (D§16.2) แล้วตรวจ `skills/agrimap-agent-skills/assets/bootstrap/manifest.json` มี `previous` ของรุ่นก่อน
4. ทำงานตามตารางของ phase — commit เป็นก้อนตามงาน (Conventional Commits ภาษาอังกฤษ, stage ทีละ path)
5. ตรวจ: `npm run sync` → `git diff` ต้องไม่มี drift → `npm test` → `npm run test:release` (Windows: รันจาก PowerShell) → `npm run audit:tokens:strict` → `npm run package:build`
6. budget direct/required ห้ามเพิ่ม; ถ้า audit ไม่ผ่านให้ตัด prose ก่อน
7. เขียน `specs/questions/question-<version>.md` และ `CHANGELOG.md` entry
8. ถ้าทำต่างจาก design spec: เพิ่มแถวในตาราง "As-built P<N>" ท้ายไฟล์นี้ (§9)
9. push branch → ตรวจ `git ls-remote` ตรง HEAD → เปิด **draft PR** ตาม §3 (body: สรุปตาม component, AC → หลักฐาน, คำสั่ง+ผล, ลิงก์ question file, ⚠️ open warnings)
10. อัปเดต queue-status (§2.7) commit + push แล้วไป phase ถัดไป

---

## 5. P2 — 4.7.0: Spec sync + งานค้างของ 4.6.0

### 5.1 เป้าหมาย

AI-First project ไม่ต้องสั่งอัปเดต spec ซ้ำ: อ่าน spec ก่อนเขียน, sync status/evidence/changelog/manifest หลัง verify, ปัญหาของ spec ไม่ block การส่งงานแต่เตือนชัด — และปิด bug audit residue

### 5.2 งาน (ลำดับ)

| # | งาน | ไฟล์ | สิ่งที่ต้องได้ | รายละเอียด |
| --- | --- | --- | --- | --- |
| 1 | Audit residue (bug) | `git-flow.mjs` (`snapshotDirty`, `classifyPaths`) | audit ที่เขียนหลัง delivery ถูก commit ในรอบถัดไป | D§20.2 R1 |
| 2 | YAML line-subset | `scripts/yaml-lines.mjs` (ใหม่) | อ่าน/แก้ task block ได้โดย diff หนึ่งบรรทัด | D§20.2.1 |
| 3 | Spec adapters | `scripts/spec-adapters.mjs` (ใหม่) | `morynth-context-index@1` + `generic-markdown` + fallback warning | D§19.7, D§20.2 ข้อ 2 |
| 4 | Sync engine | `scripts/spec-sync.mjs` (ใหม่) | `specContext`, `planSpecSync`, `applySpecSync`, `specCheck`, `chooseStatusValue` | D§19.7.1, D§19.8–19.9, D§19.11 |
| 5 | Commands | `governance-commands.mjs` | `spec context`, `spec sync plan/apply`, `spec check` | D§19.12 |
| 6 | Delivery gate + summary | `git-flow.mjs#planDelivery` | `SPEC_NOT_SYNCED` self-fix→warn, `--spec-na`, block opt-in, บรรทัด `- Spec:` | D§8.2 ข้อ 7 |
| 7 | Spec repo แยก | `git-flow.mjs`, `session-state.mjs` | สอง target root ใน session เดียว, สอง commit ใน summary, `SPEC_SOURCE_NOT_GIT` | D§19.9, D§20.2 ข้อ 6 |
| 8 | Semantic pending | `spec-sync.mjs` | `SPEC_DECISION_PENDING` แต่ mechanical sync ยังทำ | D§19.8.1 |
| 9 | Warning surfacing | `git-flow.mjs`, `governance-commands.mjs` | `warnings[]` ใน event, `openWarnings` ครั้งแรกของ session | D§2.4, D§20.2 ข้อ 8 |
| 10 | One-time spec card | `project-profile.mjs#specStandingCard` | code-first สั่งครั้งเดียว → card → กติกาถาวร | D§19.10 |
| 11 | glab | `git-flow.mjs` | ตรวจ flag กับ `glab … --help` ถ้ามีในเครื่อง | D§20.2 R2 |
| 12 | Refs/docs | `references/goal-rules.md` (ข้อ 9), `references/spec-driven.md`, `docs/WORKFLOWS.md`, `docs/USAGE.md` | | D§19.18 |
| 13 | Fixture + tests | `tests/fixtures/spec-pack-morynth/`, `tests/unit/yaml-lines.test.mjs`, `tests/unit/spec-sync.test.mjs`, เพิ่มใน `git-flow`/`project-profile` tests | | D§20.2.2 |

### 5.3 ค่าที่ตัดสินล่วงหน้า (ไม่ต้องสร้าง question)

| จุดตัดสินใจ | ค่า |
| --- | --- |
| audit path ที่รวมในรอบถัดไป | `logs/**`, `memory/recent/**`, `reports/**`, `decisions/**` เท่านั้น |
| YAML construct ที่ไม่รองรับ | คืน `ADAPTER_PARSE_FAILED` เฉพาะ construct → warn, ไม่ throw |
| tab indent / anchor / multi-line scalar | ไม่รองรับ → parse fail ของ construct นั้น |
| status ที่ไม่มีบรรทัด | แทรกใต้ `- id:` + `TASK_STATUS_LINE_ADDED` |
| คำ status | ตามตาราง D§19.7.1; `statusMap` override |
| format spec-kit/kiro/openspec | generic + `SPEC_FORMAT_FALLBACK` |
| `specs.enforcement` default | `warn` |
| `readFirst` สูงสุด | 8 ไฟล์ |
| `spec check` ครั้งแรกของ session | bounded 50 รายการ, แสดง ≤ 5 บรรทัด |
| manifest | `sha256` hex ตัวเล็ก + สองช่องว่าง + path `/`, LF, คงลำดับ, ไฟล์ใหม่ต่อท้าย |
| เขียนไฟล์ spec | temp + rename ต่อไฟล์, คง line ending เดิม |
| ไม่มี `glab` ในเครื่อง | คง stub และ warning `GLAB_UNVERIFIED` ต่อไป P3 (ไม่สร้าง question) |
| fixture | สังเคราะห์ ห้ามคัดลอกเนื้อหาจริงของ pack |

### 5.4 Done เมื่อ

AC18–AC21, AC23–AC26 (D§19.20, D§20.2.3) มีหลักฐาน, ตรวจ §4 ข้อ 5 ผ่าน, draft PR เปิดแล้ว, question-4.7.0.md + queue-status อัปเดต

---

## 6. P3 — 4.8.0: Decision memory + digest + instruction diet

### 6.1 เป้าหมาย

Agent ไม่ถามเรื่องที่เคยตัดสินแล้ว, เรียนจากคำตอบ, ได้บริบทสั้นครั้งเดียวต่อ session และ bootstrap `AGENTS.md` ที่ host โหลดทุก session เล็กลงมาก

### 6.2 งาน (ลำดับ)

| # | งาน | ไฟล์ | สิ่งที่ต้องได้ | รายละเอียด |
| --- | --- | --- | --- | --- |
| 1 | Frontmatter + index | `scripts/decision-memory.mjs` (ใหม่) | round-trip กับ `decision-records.mjs#writeDecision` | D§10.2–10.3 |
| 2 | Recall | `decision-memory.mjs` | `recall()` คะแนน/threshold/glob/cap | D§10.4 |
| 3 | Signals/learning | `decision-memory.mjs` | signal, promotable, calibration, `alwaysAsk` | D§10.6 |
| 4 | Card integration | `decision-card.mjs` | `suppressed` / `autoDecided`, เคารพ `governance.decisionMemory` | D§20.3 ข้อ 4 |
| 5 | Commands | `governance-commands.mjs` | `recall`, `decide correction`, `decide list` | D§5.9 |
| 6 | Audit fields | `agm-workspace.mjs` | `precedents`, `questionsAvoided` | D§20.3 ข้อ 6 |
| 7 | Git precedent | `git-flow.mjs`, `workflow-policy.mjs` | recall `git/*` ก่อน card | D§10.5 DP4 |
| 8 | Digest | `hook-context.mjs` | ≤ 600 chars ครั้งเดียว/เมื่อ hash เปลี่ยน | D§10.7 |
| 9 | Autonomy ref | `references/autonomy.md` | ≤ 450 words | D§20.3 ข้อ 9 |
| 10 | Instruction diet | bootstrap `AGENTS.md` + `AGENTS.release.md` (ใหม่), `manifest.json`, `project-bootstrap.mjs`, `tools/sync-adapters.mjs`, `references/release-*.md`, `lifecycle-core.md` | core ≤ 24,000 chars | D§20.3.1 |
| 11 | Tests | `tests/unit/decision-memory.test.mjs`, hook digest, `bootstrap-contract.test.mjs` | | D§20.3.2 |

### 6.3 ค่าที่ตัดสินล่วงหน้า

| จุดตัดสินใจ | ค่า |
| --- | --- |
| ส่วนที่อยู่ core vs release | ตามตาราง D§20.3.1 ข้อ 1 |
| เลข § หลังแยกไฟล์ | คงเลขเดิมทั้งสองไฟล์ |
| core ยังเกิน 24,000 chars หลังย้ายตามตาราง | ห้ามย่อ/เขียนกติกาใหม่เพื่อให้ผ่าน → บันทึก question `decided` "ยอมรับขนาดจริง" + รายงานขนาด; test ใช้ค่าจริง + ส่วนเผื่อ 5% |
| `governance.decisionMemory` default | `true` สำหรับ layout ใหม่; project เดิมไม่มี key → `true` |
| calibration window/threshold | 10 / n ≥ 5 / 0.8 / 0.5 ตาม D§10.6 |
| promotion | `promoteAfter` 2, หนึ่ง card ต่อ session |
| recall suppress threshold | score ≥ 7 + topic ตรง + value ตรง option |
| digest ต้องการ target root ที่รู้แล้ว | ไม่รู้ → ไม่ส่ง digest (ไม่ scan) |
| `glab` ยังไม่ verify | คง warning ใน PR; ไม่เป็น blocker |

### 6.4 Done เมื่อ

AC10–AC12, AC27–AC29 มีหลักฐาน, รายงานขนาด core ก่อน/หลัง, ตรวจ §4 ข้อ 5 ผ่าน, draft PR (base `feature/acg-p2-4.7.0`), question-4.8.0.md + queue-status อัปเดต

---

## 7. P4 — 4.9.0: Guards + Stop reminder

### 7.1 เป้าหมาย

ป้องกันคำสั่ง git อันตรายที่ Agent พิมพ์เองในระดับ hook บน host ที่ยืนยันรูปแบบได้ และเตือนเมื่อจบ session โดยยังไม่ส่งงาน

### 7.2 งาน (ลำดับ)

| # | งาน | ไฟล์ | สิ่งที่ต้องได้ | รายละเอียด |
| --- | --- | --- | --- | --- |
| 0 | ยืนยัน host | — (ตารางใน PR) | host × event × format × แหล่ง | D§20.4 ขั้น 0 |
| 1 | Guard | `scripts/git-guard.mjs` (ใหม่) | G1–G6 + local/, Bash+PowerShell, release exception, fail-open, flag | D§11.2, D§20.4 |
| 2 | Stop reminder | `scripts/delivery-reminder.mjs` (ใหม่) | เตือนครั้งเดียว, ไม่ loop | D§11.3 |
| 3 | Hook generation | `tools/sync-adapters.mjs#providerHooks`, `hooks/hooks.json` | เฉพาะ host ที่ยืนยัน | D§20.4 ข้อ 3 |
| 4 | Validator | `tools/validate-package.mjs` | ตรวจ event ใหม่ + `--provider` | |
| 5 | Doctor | `references/doctor-workflow.md` | แถว `guards` | |
| 6 | Config | `agm-workspace.mjs#ensureLayout` | `governance.guards` | |
| 7 | Docs/tests | `docs/TROUBLESHOOTING.md`, `tests/unit/git-guard.test.mjs`, `tests/unit/delivery-reminder.test.mjs` | | |

### 7.3 ค่าที่ตัดสินล่วงหน้า

| จุดตัดสินใจ | ค่า |
| --- | --- |
| host ที่ยืนยันรูปแบบไม่ได้ (เอกสาร/`--help` ไม่ชัด) | ไม่ติดตั้ง hook ของ host นั้น + doctor `not-supported-on-host` (ไม่สร้าง question) |
| Claude Code | ติดตั้ง `PreToolUse` (matcher `Bash\|PowerShell`) และ `Stop` ถ้าเอกสารยืนยันรูปแบบใน D§11.2–11.3 |
| `governance.guards` default | `true` สำหรับ layout ใหม่และ project ที่ไม่มี key; `false` = no-op |
| G4 / G6 | `ask` (ไม่ใช่ deny) |
| parse คำสั่งไม่ได้ | allow (fail-open) + stderr หนึ่งบรรทัด |
| release exception | active operation = `release` ใน session state |

### 7.4 Done เมื่อ

AC13, AC30, AC31 มีหลักฐาน, ตาราง host ใน PR, ตรวจ §4 ข้อ 5 ผ่าน, draft PR (base `feature/acg-p3-4.8.0`), question-4.9.0.md + queue-status อัปเดต

---

## 8. จบ queue — รายงานสุดท้าย

เมื่อ P4 จบ (หรือ queue หยุดเพราะ blocked) Agent ตอบในแชทเป็นภาษาไทย ≤ 30 บรรทัด:

1. ตาราง phase จาก queue-status
2. จำนวน question ต่อไฟล์ แยก decided/skipped/deferred พร้อม 3 ข้อที่ **rewrite cost สูงสุด** ให้ owner อ่านก่อน
3. ลำดับที่ owner ต้องทำ: อ่าน question → ตอบ/rewrite → merge draft PR ตามลำดับ → release แต่ละเวอร์ชัน (หรือรวมเป็นรุ่นเดียว — owner เลือก)
4. ⚠️ warnings ที่ยังเปิด (เช่น `GLAB_UNVERIFIED`)
5. คำสั่งตัวอย่างสำหรับ rewrite (§2.4)

---

## 9. As-built ของ queue (เติมระหว่างทำ)

| Phase | # | ต่างจาก spec อย่างไร | เหตุผล | Question |
| --- | --- | --- | --- | --- |
| — | — | — | — | — |

---

## Appendix — ข้อความสำหรับใส่ Queue

ใส่ทีละข้อความตามลำดับ (แต่ละข้อความรันต่อจากข้อความก่อนเสร็จ) — ข้อความ 2–4 ทำงานได้เองแม้ข้อความก่อนหน้าจะหยุดกลางทาง เพราะเริ่มจาก resume check

**ข้อความ 1 — P2**

```text
Unattended mode: owner ไม่อยู่ ทำต่อจนจบโดยไม่ถาม
Repo: current checkout of this skill package (run from its root; follow AGENTS.md and DEVELOPMENT.md)
อ่าน specs/acg-roadmap-4.7-4.9.md ทั้งไฟล์ (ถ้ายังไม่มีใน working tree: git fetch แล้ว git checkout origin/feature/acg-phase-specs-4.7-4.9 -- specs/) และทำตามนั้นอย่างเคร่งครัด
ทำ P2 (4.7.0) ตาม §4 และ §5 ใช้ unattended protocol §2: ห้ามรอคำตอบ — เลือกเอง/ข้าม แล้วบันทึกใน specs/questions/question-4.7.0.md; ห้ามทำรายการใน §2.5
จบด้วย queue-status และสรุปสั้นภาษาไทย
```

**ข้อความ 2 — P3**

```text
Unattended mode ต่อ: อ่าน specs/acg-roadmap-4.7-4.9.md และ specs/questions/queue-status.md ก่อน (resume check §4 ข้อ 1)
ทำ P3 (4.8.0) ตาม §3, §4, §6 บน branch ที่ stack จาก feature/acg-p2-4.7.0 — ใช้ protocol §2, บันทึก specs/questions/question-4.8.0.md
ถ้า P2 ยัง blocked ในส่วนที่ P3 พึ่ง ให้หยุดและเขียน queue-status ตาม §2.6
```

**ข้อความ 3 — P4**

```text
Unattended mode ต่อ: อ่าน specs/acg-roadmap-4.7-4.9.md และ specs/questions/queue-status.md ก่อน
ทำ P4 (4.9.0) ตาม §3, §4, §7 บน branch ที่ stack จาก feature/acg-p3-4.8.0 — ใช้ protocol §2, บันทึก specs/questions/question-4.9.0.md
```

**ข้อความ 4 — รายงานสุดท้าย**

```text
ทำรายงานสุดท้ายตาม §8 ของ specs/acg-roadmap-4.7-4.9.md จาก queue-status และ question files ทุกไฟล์ ห้ามแก้โค้ดเพิ่ม
```
