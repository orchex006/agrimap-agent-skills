# SPEC v2 — Agent Collaboration Governance (ACG)

| Field | Value |
| --- | --- |
| Status | v2.2 (design reference) — งานที่เหลือ 4.7.0–4.9.0 ให้ทำตาม [acg-roadmap-4.7-4.9.md](acg-roadmap-4.7-4.9.md) (v3 runbook) ซึ่งมีลำดับความสำคัญสูงกว่าไฟล์นี้ |
| Date | 2026-09-18 |
| Baseline | package `4.5.5` (branch `release/4.5.5`, HEAD `9761da0`) |
| Target | P1 → `4.6.0`, P2 → `4.7.0`, P3 → `4.8.0`, P4 → `4.9.0` |
| Scope | runtime skill (`skills/agrimap-agent-skills/**`), hooks, bootstrap `AGENTS.md` template, tests |
| Audience | maintainer ที่จะ implement — อ่านจบแล้วลงมือได้โดยไม่ต้องเดา |

### Revision history

| Version | Date | การเปลี่ยนแปลง |
| --- | --- | --- |
| v1 | 2026-09-18 | C1–C8: target root, autonomy/card, workflow policy, work branch, delivery, integration intents, decision memory, hooks |
| v2 | 2026-09-18 | เพิ่ม **C9** (§19): development mode `code-first` (Not AI-First) / `spec-first` (AI-First) / `hybrid`, ถามก่อนเริ่มเมื่อไม่มั่นใจ, Spec Read/Sync Gate อัตโนมัติ ("สั่งครั้งเดียวพอ"), local memory `.agrimap-agent/local/memory.md` (gitignored) เก็บ path ของ spec ต่อเครื่อง; ปรับ §0–§3, §8.2, §12, §13, §16–§18 และ Appendix C ให้อ้าง §19 |
| v2.1 | 2026-09-18 | ตามคำตอบ Q7–Q10: phase ใหม่ (P2 spec sync 4.7.0, P3 C7 4.8.0, P4 guards 4.9.0); severity model `stop`/`self-fix`/`warn` + Warning contract (§2.4) และปรับ code ทั้งฉบับ; task status แบบ semantic (§19.7.1); ตัด spec ownership → กติกาเนื้องาน+คำสั่ง (§19.8.1); ขั้นตอนย้าย spec pack เข้า Git (§19.21); Appendix C มีคอลัมน์ Severity |
| v2.2 | 2026-09-19 | เพิ่ม §20: as-built 4.6.0 (module map, decision B1–B8, carry-over), spec ลงมือทำของ P2 4.7.0 / P3 4.8.0 / P4 4.9.0 พร้อมลำดับงาน ไฟล์ test และ AC23–AC31; เมื่อขัดกับ §4–§19 ให้ถือ §20 |

> ไฟล์นี้เป็น maintainer spec ไม่ถูกแจกจ่ายกับ runtime package (`tools/package-release.mjs` ใช้ allowlist และ root `specs/` ไม่อยู่ในนั้น) และไม่อยู่ใต้ `docs/` จึงไม่ต้องมี plugin mirror

หลักคิดหนึ่งบรรทัด: **Script คำนวณกลไก (deterministic, testable) · Agent ตัดสินความหมาย · มนุษย์ตัดสินสิทธิ์**

---

## 0. สารบัญและศัพท์

1. ปัญหาและหลักฐาน
2. เป้าหมาย, non-goals, หลักการ balance
3. ภาพรวมสถาปัตยกรรม
4. C1 Target root และ instruction chain (ข้อ 6)
5. C2 Autonomy matrix และ Decision Card (ข้อ 1)
6. C3 Team workflow policy — ถามครั้งแรกแล้วบันทึก (ข้อ 2)
7. C4 Work branch start (ข้อ 2)
8. C5 Delivery — commit & push เมื่อจบงาน (ข้อ 4)
9. C6 Integration intents และ Next-step card (ข้อ 5)
10. C7 Decision memory และ behavioral learning (ข้อ 3)
11. C8 Hook automation และ guards
12. รายการไฟล์ที่ต้องแก้ทีละไฟล์
13. ข้อความใหม่ใน bootstrap `AGENTS.md`
14. Token budget
15. Tests
16. Rollout, migration, feature flags
17. Acceptance criteria
18. Decisions ใน spec นี้ และคำถามที่ owner ต้องตอบ
19. **C9 Project development mode, spec sync และ local memory (ใหม่ใน V2)**
20. **Phase specs P2–P4 บน baseline as-built 4.6.0 (ใหม่ใน V2.2)**
- Appendix A ตัวอย่าง flow · B ตัวอย่าง JSON · C Error code catalog · D ร่าง reference ใหม่ (ร่าง `spec-driven.md` อยู่ใน §19.18)

| ศัพท์ | ความหมาย |
| --- | --- |
| Session cwd | directory ที่ host เปิด session (อาจอยู่นอก repo) |
| Target root | `git rev-parse --show-toplevel` ของไฟล์ที่งานจะแก้ |
| Instruction chain | `AGENTS.md` (+ pointer file ของ host) ทุกไฟล์ตั้งแต่ target root ขึ้นไปถึง root ของ drive รวมไฟล์ใน subdirectory ที่มีไฟล์ที่จะแก้ |
| Protected branch | branch ที่ policy ห้าม agent commit/push ตรง เช่น `develop`, `main`, `jenkins`, `jenkins-release` |
| Work branch | branch งานตาม prefix ของทีม เช่น `feature/…`, `fix/…`, `hotfix/…` |
| Policy | `.agrimap-agent/policy/workflow.json` — workflow ของทีม, committed |
| Decision Card | คำถามแบบมีโครงสร้าง: ผลกระทบ, สิ่งที่ตรวจแล้ว, ตัวเลือก 2–4 ข้อ, ข้อแนะนำ, ความมั่นใจ |
| Precedent | decision record ที่ `status: approved` และตรง topic/scope |
| Signal | บันทึก local ว่า requester เลือกอะไรจาก card หรือแก้การตัดสินใจของ agent อย่างไร |
| Delivery | commit + push work branch + verify remote |
| Integration | เปิด PR / merge work branch เข้า target |
| Development mode | `code-first` = Not AI-First (ของเดิมเอามาพัฒนาต่อ ยึด code/test), `spec-first` = AI-First (ยึด markdown spec), `hybrid` = ผสม — อยู่ใน `.agrimap-agent/policy/project.json` |
| Spec source | ชุด spec ที่ project อ้างถึง ทั้งใน repo (`kind: repo`) และนอก repo (`kind: external`, อ้างด้วย id + fingerprint) |
| Local memory | `.agrimap-agent/local/memory.md` — ความจำเฉพาะเครื่อง (path ของ spec/repo ข้างเคียง) ถูก gitignore |
| Spec Read / Sync Gate | อ่าน spec item ที่เกี่ยวข้องก่อนเขียน / อัปเดต status, evidence, changelog, manifest ของ spec หลัง verify |

---

## 1. ปัญหาและหลักฐาน (baseline 4.5.5)

| # | อาการที่ผู้ใช้เห็น | หลักฐานใน source/workspace | ผลกระทบ |
| --- | --- | --- | --- |
| 1 | Agent ถาม/ไม่ถามไม่สม่ำเสมอ ไม่รู้ว่าตัดสินใจจากอะไร | `elicitation.md`, `goal-rules.md` GR-1 และ `recommendations.md` บอกเพียง "ask only when material" ไม่มีเกณฑ์ risk × confidence ไม่มีรูปแบบคำถาม และไม่เชื่อมกับ decision เดิม | ถามซ้ำเรื่องที่เคยตอบ / ตัดสินใจเองในเรื่อง contract |
| 2 | ไม่แตก `feature/*` / `hotfix/*` | ไม่มี reference ใดสั่งสร้าง work branch สำหรับงาน dev; bootstrap `AGENTS.md` §3 ห้ามสร้าง worktree แต่ไม่บอกว่าให้ทำอะไรแทน; branch model มีเฉพาะใน `DEVELOPMENT.md` ซึ่งเป็น maintainer-only; ใน repo นี้ `fix/allow-develop-main-pr` ชี้ `eaed82c` ไม่มี commit ของตัวเอง ขณะที่การแก้เรื่อง develop→main เดียวกันค้าง uncommitted บน `release/4.5.5` | งานปนผิด branch, review ยาก |
| 3 | บันทึก project.md / decision แต่ไม่เอามาใช้ | `agm-workspace.mjs#updateProjectMemory()` append เข้า `## Completed work` อย่างเดียว; ไม่มี script ใดอ่าน `memory/project.md` หรือ `decisions/`; `hook-context.mjs` อ่านแค่ identity และ active state; `.agrimap-agent/memory/project.md` ของ repo นี้มีแค่ "No durable project context recorded." + completed list และไม่มี `decisions/` | เสีย token ตอนเขียนแต่ไม่ได้ประโยชน์; หลาย branch append `project.md` แล้ว conflict |
| 4 | จบงานแล้วไม่ commit & push | `DEVELOPMENT.md`: "An implementation request authorizes scoped local changes, not commits"; bootstrap §2 `develop-complete` ห้าม commit/push หากไม่ได้สั่ง | งานค้างใน working tree |
| 5 | สั่งรวม branch สั้นๆ แล้ว agent ไม่เข้าใจ | intent routing ใน bootstrap §2 มีแต่ release mode ไม่มี integrate/PR/next-step | developer ต้องพิมพ์ยาวและอธิบายซ้ำ |
| 6 | ข้าม `AGENTS.md` เมื่อเปิด session นอก repo | `hook-context.mjs#workspaceRoot()` fallback เป็น cwd เมื่อไม่ใช่ git; หลักฐานจริง: `AgriMapPlatform/.agrimap-agent/` (directory ที่ไม่ใช่ git) ถูกสร้างพร้อม log `2026-09-04.jsonl` และ prompt `codex-20260904-provisioning-scaffold`; โดยทั่วไป host โหลด instruction จาก cwd ขึ้นไปด้านบน จึงไม่รับประกันว่าจะโหลด `AGENTS.md` ของ repo ที่อยู่ใต้ cwd | กติกา repo ไม่ถูกใช้ และ state ไปอยู่ผิดที่ |
| + | ค่า token ของ instruction | bootstrap `AGENTS.md` ยาว 450 บรรทัด (~32k tokens) และ `CLAUDE.md` import ด้วย `@AGENTS.md` จึงเข้า context ทุก session ของ product repo แม้งานจะไม่ใช่ release | เปลือง token ทุก session (แก้ใน P3 §16.3) |
| 7–9 | (V2) project AI-First ต้องสั่งให้เช็ค/อัปเดต spec ทุกรอบ; path ของ spec นอก repo ต่างกันแต่ละเครื่อง; project Not AI-First กับ AI-First ถูกปฏิบัติเหมือนกัน | รายละเอียดและหลักฐานใน §19.1 (spec pack `agrimap-plus-operations-console-spec-v1.0.0` อยู่นอก git, `TASKS.yaml` 55 planned / 2 delivered, ไม่มีแนวคิด spec ใน skill 4.5.5) | spec drift และภาระเตือนซ้ำของมนุษย์ |

---

## 2. เป้าหมาย, non-goals, หลักการ balance

### 2.1 Goals

- G1 Agent ตัดสินใจเองในเรื่องที่ตนเป็นเจ้าของ และถามเฉพาะเรื่องที่ requester เป็นเจ้าของและหลักฐานยังไม่พอ ด้วยคำถามที่ช่วยให้ตัดสินใจได้ในรอบเดียว
- G2 งานใหม่ทุกงานอยู่บน work branch ตาม workflow ของทีม; ถามเรื่อง workflow **ครั้งเดียวต่อ project** แล้วบันทึกเป็น policy
- G3 memory/decision ถูกดึงมาใช้ **ณ จุดตัดสินใจ** (pull) ไม่ inject ตลอด (push) และเรียนรู้จากพฤติกรรมการเลือกของ requester
- G4 งานที่ verify ผ่านถูก commit + push เข้า work branch และ verify remote อัตโนมัติเมื่อ policy อนุญาต
- G5 คำสั่งสั้น (`1`, `merge`, `รวมเข้า develop`, `pr`) ถูกตีความได้ถูกต้องและดำเนินการได้ทันที
- G6 Agent resolve target repo และอ่าน `AGENTS.md` chain ครบก่อนเขียน แม้ session เปิดจาก directory แม่
- G7 ทำงานได้ทั้ง Claude Code, Codex, Antigravity/Gemini และ agent ที่ไม่มี skill (portable contract ใน bootstrap)
- G8 (V2) Agent รู้ว่า project เป็น Not AI-First หรือ AI-First; ถ้าไม่มั่นใจให้ถามก่อนเริ่มเขียน; ใน AI-First อ่าน spec ก่อนทำและอัปเดต spec เองทุกงาน — มนุษย์สั่งเรื่อง spec **ครั้งเดียว** แล้วกลายเป็นกติกาถาวร
- G9 (V2) path ของ spec/repo ที่อยู่นอก repo ถูกจำต่อเครื่องใน local memory ที่ไม่ commit; Agent ไม่ต้องค้นหาเองทุก session และไม่เอา path ของเครื่องหนึ่งไปใส่ repo

### 2.2 Non-goals

- ไม่เปลี่ยน release flow กลุ่ม A/B, `agm-release` และ confirmation ของ Production
- ไม่ให้สิทธิ์ database write ใดๆ (คงกติกา SQL read-only)
- ไม่ให้ agent สร้าง worktree/clone เอง (คง bootstrap §3)
- ไม่ push/merge protected branch โดยไม่มีคำสั่งตรงจากผู้ใช้ในรอบนั้น; ไม่มี force push ทุกกรณี
- ไม่ใช้ชื่อ model เป็นเกณฑ์ autonomy

### 2.3 หลักการ balance

| แกน | ถ้าเอียงไป autonomy | ถ้าเอียงไป control | จุดที่เลือก |
| --- | --- | --- | --- |
| ถาม vs ทำเอง | ตัดสิน contract ผิด | ถามทุกเรื่อง น่ารำคาญ | Owner × Risk × Confidence matrix (§5), investigate ก่อนถาม, รวมคำถามเป็นรอบเดียว |
| บันทึก vs token | ฉีด memory ทุก prompt | ไม่ใช้ memory เลย | pull ณ decision point (§10.5), digest ≤ 600 ตัวอักษรครั้งเดียวต่อ session |
| commit อัตโนมัติ vs สิทธิ์ | push ทุกที่ | ต้องสั่งทุกครั้ง | standing authorization ใน policy ที่มนุษย์ยืนยันแล้ว — **work branch เท่านั้น** |
| ยึด spec vs ยึด code (V2) | แก้เอกสารทุก project | ต้องคอยสั่งให้อัปเดต spec | โหมดต่อ project: ตรวจเอง, ถามเมื่อไม่มั่นใจ, sync อัตโนมัติเฉพาะ spec-first/hybrid ใน scope, คำสั่งครั้งเดียวกลายเป็นกติกา (§19) |
| path ร่วมทีม vs path ต่อเครื่อง (V2) | commit absolute path | ค้นหาทุก session | id + fingerprint ใน repo, path จริงใน local memory ที่ gitignore (§19.4) |
| หยุด vs ไปต่อ (V2.1) | ไปต่อทั้งที่ไม่ปลอดภัย | block บ่อยจนงานติด | severity 3 ระดับ §2.4: หยุดเฉพาะเรื่องที่ย้อนไม่ได้/ปลอดภัย; ที่เหลือ Agent แก้เองหรือไปต่อพร้อม warning ที่ชัด |

### 2.4 Severity model (V2.1): `stop` / `self-fix` / `warn`

ทุก code ใน spec นี้มี severity หนึ่งค่า (ดูคอลัมน์ Severity ใน Appendix C) — หลัก: **ไปต่อได้เป็นค่าเริ่มต้น หยุดเฉพาะเมื่อไปต่อแล้วย้อนไม่ได้หรือไม่ปลอดภัย**

| Severity | ความหมาย | ใช้เมื่อ | Agent ทำอะไร |
| --- | --- | --- | --- |
| `stop` | ต้องให้มนุษย์ตัดสินก่อน | ผลย้อนไม่ได้หรือออกนอกเครื่อง (push protected, secret, force), git อยู่ในสถานะไม่ปลอดภัย, conflict ที่ต้องเลือกทาง, สิทธิ์/credential | หยุดเฉพาะขั้นที่กระทบ ทำงานส่วนอื่นที่อิสระต่อ แล้วถามด้วย card |
| `self-fix` | Agent แก้เองได้โดยไม่ต้องถาม | ขาดสิ่งที่ Agent สร้างเองได้ (ack instruction, changelog entry, commit message, spec sync, แทน absolute path ด้วย id, plan เก่า) | แก้แล้วทำต่อทันที; ถ้าแก้ไม่สำเร็จให้ลดเป็น `warn` (ยกเว้น code ที่ระบุว่าแก้ไม่ได้ต้อง `stop`) |
| `warn` | ไปต่อได้ แต่ต้องบอกให้ชัด | คุณภาพ/drift/ข้อมูลไม่ครบที่ไม่ทำให้ผลเสียหายถาวร | ทำต่อ และแสดงตาม Warning contract ด้านล่าง |

**Warning contract** — warning ต้องไม่เงียบหาย:

1. Delivery summary มี section แยก (ไม่ปนกับรายการปกติ):

   ```text
   ⚠️ ต้องตามต่อ (2)
   - SPEC_NOT_SYNCED: FE-006 ยังไม่อัปเดต status เพราะอ่าน TASKS.yaml ไม่ได้ — แก้โดย: spec sync plan --tasks FE-006
   - DELIVERED_UNVERIFIED: test OrdersExportTests fail 1 case — ยังไม่เสนอ merge จนกว่าจะผ่าน
   ```

   แต่ละบรรทัดมี code, สิ่งที่เกิด, ผลกระทบ, วิธีแก้ (คำสั่งหรือคำพูดที่ผู้ใช้พิมพ์ได้)
2. log event ของ execution มี `warnings: [{code, subject, fix}]`
3. PR/MR body (C6) มี section `⚠️ Open warnings` เดียวกัน
4. `spec check` / `context` ครั้งแรกของ session ถัดไปแสดง warning ที่ยังไม่ถูกแก้ของ scope นั้นอีกครั้ง (≤ 5 บรรทัด)
5. warning ที่กระทบ integration (เช่น `DELIVERED_UNVERIFIED`) ทำให้ Next-step card ไม่เสนอ merge เป็นข้อ 1 จนกว่าจะแก้
| prose vs script | prose ยาว model ตีความต่างกัน | script แข็งเกิน | script ทำ plan/apply + คืน card; prose สั้นบอกแค่ว่าเรียกเมื่อไร |
| ความเร็ว vs ความถูกต้อง | ข้าม gate | gate ทุกจุด | บังคับ gate ที่ **จุดเกิดผล durable** (deliver/integrate) ไม่ใช่ตอนเริ่มงาน |

---

## 3. ภาพรวมสถาปัตยกรรม

```text
User prompt
  │ hook (Claude/Codex UserPromptSubmit, Gemini BeforeAgent)
  │   ├─ classifyRequest (เดิม)
  │   ├─ C8 short reply → map เข้า lastCard option / integration intent        [P1]
  │   ├─ C1 cwd อยู่นอก repo → เตือนให้ resolve target, ไม่เขียน state ที่ cwd  [P1]
  │   └─ C7 session digest ครั้งแรกหรือเมื่อ hash เปลี่ยน (≤ 600 chars)         [P3]
  ▼
Agent
  1. C1 context            → target root + instruction chain → อ่าน → ack
  1b. C9 (V2) context รวม project mode + spec paths จาก local memory → ไม่มั่นใจ: card ก่อนเริ่ม
  2. C3 policy show        → ไม่มี: policy infer → Decision Card (ครั้งเดียว) → decide record
  2b. C9 spec-first: spec context → อ่านเฉพาะ readFirst (≤ 8 ไฟล์)
  3. start (เดิม)          → + snapshot preexisting dirty paths
  4. C4 branch plan/apply  → work branch
  5. ทำงาน                 → ทุกจุดตัดสินใจ: C2 matrix; ถ้าต้องถาม: decide card (C7 recall ภายใน)
  6. verify (เดิม)
  7. C5 deliver plan/apply → commit + push work branch + verify remote
  8. complete (เดิม)        → Delivery summary + C6 Next-step card
User: "1" | "merge" | "รวมเข้า develop" | "pr"
  → hook map → C6 integrate plan/apply → PR/merge → verify → log integrated
```

| ID | Component | แก้ข้อ | Phase | ไฟล์หลัก (ใหม่) |
| --- | --- | --- | --- | --- |
| C1 | Target root & instruction chain | 6 | P1 | `scripts/instruction-chain.mjs` |
| C2 | Autonomy matrix & Decision Card | 1 | P1 (P3 เพิ่ม recall/calibration) | `references/autonomy.md`, `scripts/decision-card.mjs` |
| C3 | Team workflow policy | 2 | P1 | `scripts/workflow-policy.mjs` |
| C4 | Work branch start | 2 | P1 | `scripts/git-flow.mjs` |
| C5 | Delivery | 4 | P1 | `scripts/git-flow.mjs` |
| C6 | Integration intents & Next-step card | 5 | P1 | `scripts/git-flow.mjs`, `governance-policy.mjs` |
| C7 | Decision memory & behavioral learning | 3 | P3 | `scripts/decision-memory.mjs` |
| C8 | Hook automation & guards | ทุกข้อ | P1/P3/P4 | `hook-context.mjs`, `scripts/git-guard.mjs` (P4) |
| C9 | Development mode, spec sync & local memory (V2) | 7–9 | P1 (mode, local memory) / P2 (spec read/sync/check) | `scripts/project-profile.mjs`, `local-memory.mjs`, `spec-adapters.mjs`, `spec-sync.mjs` |

**Result envelope ของทุกคำสั่งใหม่** (สอดคล้องกับ `agm-workspace.mjs` เดิมที่คืน `ok/code/message`):

```json
{
  "ok": true,
  "code": null,
  "message": "human-readable summary",
  "warnings": [],
  "next": { "action": "run|read-and-ack|ask|report|none", "command": "…", "files": [] },
  "card": null
}
```

- `ok:false` + `code` = หยุด; agent ทำตาม `next`
- `card` ไม่ null = ต้องถาม requester ด้วย card นี้ (render ตาม §5.7)
- ทุก git call ใช้ `execFileSync('git', args, {cwd})` — ห้ามประกอบ shell string
- ทุกฟังก์ชันใน `git-flow.mjs` รับ dependency `{ run }` (default คือ wrapper ของ `execFileSync`) เพื่อให้ test stub `gh`/`glab` ได้

---

## 4. C1 — Target root และ instruction chain (ข้อ 6)

### 4.1 กติกาสำหรับ Agent

- R1.1 Target root คือ git top-level ของไฟล์ที่งานจะแก้ **ไม่ใช่** session cwd
- R1.2 ก่อน write แรกในแต่ละ target root ของ session: รัน `context`, อ่านทุกไฟล์ใน `readRequired` **ทั้งไฟล์**, แล้วรัน `context --ack`
- R1.3 ไฟล์ที่อยู่ใกล้ไฟล์เป้าหมายกว่ามี precedence เมื่อขัดกัน; system/user instruction ยังสูงกว่าทุกไฟล์; ไฟล์ที่มี marker `<!-- AGM-MAINTAINER-ONLY -->` ใช้เฉพาะงานพัฒนา package ที่ได้รับมอบหมายตรงๆ
- R1.4 งานหลาย repo: resolve + ack แยกต่อ root และ commit/push แยกต่อ root
- R1.5 ห้ามสร้าง `.agrimap-agent/` ใน directory ที่ไม่ใช่ git top-level

### 4.2 CLI `agm-workspace.mjs context`

| Arg | จำเป็น | ความหมาย |
| --- | --- | --- |
| `--cwd <dir>` | ไม่ (default `process.cwd()`) | session cwd |
| `--target <path>` | ไม่ | ระบุ repo/ไฟล์เป้าหมายตรง |
| `--paths <a,b>` | ไม่ | ไฟล์ที่วางแผนจะแก้ (relative กับ `--cwd` ได้) |
| `--hint <text>` | ไม่ | ชื่อโปรเจกต์จากคำขอ ใช้จัดลำดับตัวเลือก |
| `--session <id>` | จำเป็นเมื่อ `--ack` | session id |
| `--ack <sha12,…>` | ไม่ | บันทึกว่าอ่านไฟล์ที่ hash ตรงแล้ว |
| `--depth <n>` | ไม่ (default 3, max 4) | ความลึกในการ scan หา repo ใต้ cwd |

**Algorithm**

1. `sessionCwd = path.resolve(--cwd)`; `gitTop(dir)` = `git -C <dir> rev-parse --show-toplevel` (exit ≠ 0 → null)
2. หา candidate roots ตามลำดับแรกที่ใช้ได้:
   1. `--target` → `gitTop(target)`; null → `TARGET_NOT_GIT`
   2. `--paths` → set ของ `gitTop(dirname(p))`; มี path ใดไม่อยู่ใน git → `PATH_NOT_IN_GIT` พร้อมรายการ
   3. `gitTop(sessionCwd)` ถ้าไม่ null
   4. BFS จาก `sessionCwd` ลึกไม่เกิน `--depth`; ข้าม directory ใน `config.skip.directories` และชื่อที่ขึ้นต้นด้วย `.`; เก็บ directory ที่มี `.git` (directory หรือไฟล์ — linked worktree มี `.git` เป็นไฟล์); เจอ repo แล้วไม่ลงต่อ; หยุดที่ 200 directories
3. candidate = 1 → `targetRoot`; = 0 → `{ok:true, resolved:false, reason:"NO_REPOSITORY"}`; > 1 → `resolved:false` + card `kind:"root"`:
   - เรียงตัวเลือก: (a) basename หรือ remote name มี `--hint` (case-insensitive) (b) มี `AGENTS.md` (c) mtime ล่าสุดของ `.agrimap-agent/logs`
   - สูงสุด 4 ตัวเลือก (card รับ free text สำหรับ path อื่นอยู่แล้ว)
4. Chain: เดินจาก `targetRoot` ขึ้นไปทีละระดับ หยุดเมื่อถึง drive root หรือครบ 8 ระดับ; **ข้าม `os.homedir()`** (instruction ระดับ user ให้ host จัดการ) ทุกระดับเก็บไฟล์ที่มีจริงจาก `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `CURSOR.md`:

   ```json
   { "path": "abs", "relative": "../AGENTS.md", "sha12": "first 12 hex of sha256",
     "bytes": 2802, "bootstrapVersion": "4.5.5|null", "maintainerOnly": false,
     "pointerOnly": false, "nested": false }
   ```

   - `bootstrapVersion` จาก regex `<!-- AGRIMAP BOOTSTRAP VERSION: ([^ >]+) -->`
   - `maintainerOnly` = มี `<!-- AGM-MAINTAINER-ONLY -->`
   - `pointerOnly` = ไม่ใช่ `AGENTS.md`, ขนาด ≤ 400 bytes และอ้าง `AGENTS.md`
   - เรียง outermost → innermost
5. Nested: ทุก path ใน `--paths` → directory ระหว่าง `targetRoot` (ไม่รวม) ถึง `dirname(path)` (รวม) ที่มี `AGENTS.md` → เพิ่มด้วย `nested:true`
6. Ack store: `<targetRoot>/.agrimap-agent/runtime/sessions/<session>.json` field `instructionsAck: { "<relative-to-targetRoot>": "<sha12>" }`
7. `readRequired` = รายการใน chain + nested ที่ `!pointerOnly && ack[rel] !== sha12`
8. `--ack`: ทุก sha ต้องตรงไฟล์ปัจจุบัน (ไม่ตรง → `ACK_HASH_MISMATCH`); เขียน ack (เป็นกรณีเดียวที่ `context` เขียนไฟล์ — เรียก `ensureLayout(targetRoot)` แบบไม่ bootstrap); เขียน session pointer ตาม §9.6
9. Output เพิ่ม: `sessionCwd`, `cwdIsRepo`, `targetRoot`, `isLinkedWorktree` (เทียบ `git rev-parse --path-format=absolute --git-dir` กับ `--git-common-dir`), `branch`, `stateRoot`, `strayStateRoots` (directory ที่มี `.agrimap-agent/` แต่ไม่ใช่ git top-level ภายใน scan ข้อ 2.4), `warnings`, และ (V2) `projectProfile` + `localMemory` ตาม §19.5 — spec path ที่ resolve แล้วมาใน output นี้ Agent จึงไม่ต้องค้นเอง

`context` ที่ไม่มี `--ack` เป็น read-only เสมอ

### 4.3 Enforcement

| จุด | พฤติกรรม |
| --- | --- |
| `start` | `readRequired` ของ target root ไม่ว่าง → คืน `warnings:["INSTRUCTIONS_UNACKNOWLEDGED"]` แต่ยังเริ่มได้ |
| `deliver plan`, `integrate plan` | `readRequired` ไม่ว่าง → `ok:false, code:"INSTRUCTIONS_NOT_ACKNOWLEDGED", next:{action:"read-and-ack", files:[…]}` |
| `goal-rules.md` pre-write gate | เพิ่มข้อ 7: instruction chain ของ target root ถูกอ่านและ ack แล้ว (ระบุ path + sha12) |

### 4.4 Hook (`hook-context.mjs`)

- H1.1 เปลี่ยน `workspaceRoot(cwd)` ให้คืน `{ root, isRepo }`. เมื่อ `!isRepo`: **ไม่** เรียก `archiveRawPrompt`, ไม่อ่าน `config.json` จาก cwd, ไม่เขียนไฟล์ใดๆ ใต้ cwd
- H1.2 `projectActivation`: เมื่อ `!isRepo` ให้ถือว่า recognized ถ้ามี child repo (ลึก ≤ 2, ≤ 200 dirs, time budget 150 ms) ที่ basename ตรง `AGRIMAP_PROJECT_PATTERNS`
- H1.3 เมื่อ `selection.active && !isRepo` เพิ่ม context หนึ่งบรรทัด:

  ```text
  Session cwd is outside any Git repository. Before any write run `agm-workspace.mjs context --cwd "<cwd>" --hint "<project>"`, then read and ack the target AGENTS.md chain. Repositories below: <≤5 basenames>.
  ```

- H1.4 เมื่อ cwd เป็น repo แต่ prompt อ้าง absolute path หรือ `../` ที่ `gitTop` ≠ root → เพิ่ม context: `The request references another repository (<basename>); resolve it with context --paths before writing.`

### 4.5 Doctor

เพิ่มแถวในตาราง check ของ `references/doctor-workflow.md`: `stray-state-roots` — แสดง `strayStateRoots` จาก `context --cwd <session cwd>`; สถานะ `recommended`; repair advice: "ย้ายไฟล์ที่ต้องการเก็บเข้า target repo ด้วยตนเอง" — doctor **ไม่ลบ/ไม่ย้ายเอง**

---

## 5. C2 — Autonomy matrix และ Decision Card (ข้อ 1)

### 5.1 เจ้าของการตัดสินใจ

| Agent-owned (ตัดสินเองได้ภายใน scope ที่อนุญาต) | Requester-owned |
| --- | --- |
| internal implementation, ตัวเลือก tier `FREE`, ชื่อ private, reuse helper, โครง test ตาม convention, ลำดับขั้นตอน, slug ของ branch, ถ้อยคำ commit message, work type เมื่อ base/target เหมือนกัน | scope, behavior ที่ผู้ใช้/ผู้เรียกเห็น, public/shared contract (API, DTO, SP signature, shared library API), data/schema, security boundary, dependency ใหม่, ownership ข้าม service, work type ที่ทำให้ base/target ต่างกัน (hotfix vs fix), integration และ publication |

### 5.2 Risk class

| Class | นิยาม | ตัวอย่าง AgriMap |
| --- | --- | --- |
| R0 | local, ย้อนได้, ภายใน | ชื่อ private method, แยก helper, จัด import |
| R1 | reviewer เห็นแต่ไม่ใช่ contract | โครงไฟล์ component ใหม่ใน `fe-main`, ข้อความ log, ตำแหน่งไฟล์ test |
| R2 | contract / behavior / data / scope | เพิ่ม parameter ให้ stored procedure, เปลี่ยน response DTO, เพิ่ม package, hotfix vs fix |
| R3 | outward หรือย้อนยาก | push/merge protected branch, เปิด/merge PR, ลบ remote branch, tag, git ที่ทำลายข้อมูล |

### 5.3 Confidence จาก evidence ladder

| ระดับ | แหล่ง |
| --- | --- |
| E1 | คำสั่งชัดของ requester ในรอบปัจจุบัน |
| E2 | precedent ที่ approved และตรง topic/scope (`recall` — P3) |
| E3 | workflow policy หรือกติกาใน AGENTS chain |
| E4 | golden `MUST` / checklist |
| E5 | convention ใน repo ≥ 3 ตัวอย่างที่สอดคล้องกัน (จากการค้นจริง) |
| E6 | general practice |

- **High** = E1–E3 หรือ E4 กับ E5 สอดคล้องกัน
- **Medium** = E4 หรือ E5 อย่างเดียว หรือ E6 ที่ไม่ขัดใคร (เฉพาะเรื่อง agent-owned)
- **Low** = แหล่งขัดกัน, ไม่มีหลักฐาน, หรือมีแค่ E6 สำหรับเรื่อง requester-owned
- แหล่งขัดกัน = Low เสมอ และต้องแสดงความขัดแย้ง ห้ามเลือกเงียบๆ
- (V2) spec item ที่ confirmed ใน project `spec-first` หรือ scope ของ `hybrid` นับเป็น **E3**; ใน `code-first` spec/เอกสารเป็นแค่ **E6** (hint) — ดู §19.13

### 5.4 Matrix การกระทำ (ใช้กับเรื่อง requester-owned)

| | High | Medium | Low |
| --- | --- | --- | --- |
| R0 | ตัดสินเอง | ตัดสินเอง | ค้นเพิ่ม แล้วตัดสินเอง |
| R1 | ตัดสินเอง, บอกสั้นๆ ถ้าไม่ชัดในตัว | ตัดสินเอง + ใส่ใน "ตัดสินใจแทนไว้" | ค้นเพิ่ม แล้ว card แบบ non-blocking |
| R2 | ตัดสินเอง + อ้างแหล่ง E1–E3 | card blocking เฉพาะส่วนที่กระทบ | card blocking + บอกหลักฐานที่ขาด |
| R3 | ทำได้เฉพาะเมื่อมีคำสั่งตรงในรอบนี้ หรือ policy confirmed ครอบคลุม; ไม่งั้น confirm | confirm | confirm |

เรื่อง agent-owned ที่เป็น R0/R1: ตัดสินเองทุกระดับ confidence (Low = ค้นเพิ่มก่อน) ไม่ต้องใช้ card

### 5.5 Investigate before ask

ก่อนสร้าง card ใดๆ ต้องทำอย่างน้อย: (1) ค้น repo หา convention ≥ 1 query (2) `policy show` และ `recall` (P3) (3) อ่าน AGENTS chain — card ต้องมี field `checked` บอกสิ่งที่ตรวจแล้ว **ห้ามถามสิ่งที่ repo/policy/memory ตอบได้**

### 5.6 จังหวะและการรวมคำถาม

- ทำ recon แบบ read-only ก่อน แล้วถาม blocking **สูงสุดหนึ่งรอบก่อน write แรก** ≤ `autonomy.maxQuestionsPerRound` (default 3) ข้อ แต่ละข้อตอบได้อิสระ
- คำถาม R2 ที่เกิดกลางงาน: หยุดเฉพาะ slice ที่กระทบ ทำส่วนที่อิสระต่อ แล้วถามที่ boundary ถัดไป ไม่ใช่หลังทุก tool call
- R1 non-blocking: ใช้ default ทำต่อ แล้วแสดงใน delivery summary ว่าเปลี่ยนได้
- ห้ามถามหลังทำไปแล้ว (เช่น "ok ไหมครับ" หลัง push)
- การสื่อสาร: เริ่ม = แผน 1–3 บรรทัด + assumption ที่มีผล; ระหว่างทำ = เงียบ เว้นแต่เจอ R2+ หรือความเสี่ยงใหม่; จบ = delivery summary (§8.6) + Next-step card

### 5.7 Decision Card

**Input** — เขียนไฟล์ `.agrimap-agent/runtime/tmp/card-<epochMs>.json` แล้วส่ง `--input <file>` (เพราะ `cli-args.mjs` ไม่รองรับ flag ซ้ำ และ JSON ใน argv ของ PowerShell quote ยาก):

```json
{
  "kind": "workflow|scope|contract|root|integration|convention|preference",
  "topic": "git/hotfix-base",
  "risk": "R2",
  "confidence": "medium",
  "question": "hotfix นี้ควรแตกจาก branch ไหน",
  "impact": "กำหนด base/target และลำดับ promotion",
  "checked": ["policy: ไม่มี hotfix base", "git branch -r: มี develop, jenkins-release"],
  "options": [
    { "id": "1", "label": "develop", "effect": "promote ผ่าน jenkins ตาม ff-only", "value": "develop" },
    { "id": "2", "label": "jenkins-release", "effect": "ff-only รอบหน้าจะ diverge", "value": "jenkins-release" }
  ],
  "recommended": "1",
  "recommendedReason": "promotion เป็น --ff-only จาก develop",
  "blocking": true,
  "default": null,
  "recordAs": "policy:branching.workTypes.hotfix.base",
  "paths": [],
  "expiresHours": 24
}
```

**Validation** (`CARD_INVALID` + รายการ): options 2–4 ข้อ, `id` ไม่ซ้ำ, `recommended` อยู่ใน options, `question` ≤ 160 ตัวอักษร, `label` ≤ 60, R3 ต้อง `blocking:true` และ `default:null`, `recordAs` ∈ `none|decision|preference|policy:<dot.path>` และ `policy:` path ต้องมีใน schema §6.2

**Render** — script คืน `render.markdown` และ `render.options` (สำหรับ host UI) โดยย้ายตัวเลือกที่แนะนำเป็นข้อ 1 เสมอ:

```text
**ต้องตัดสินใจ: <question>** — <impact>
ตรวจแล้ว: <checked joined by "; ">
1. <label> (แนะนำ) — <effect>
2. <label> — <effect>
ความมั่นใจ: <สูง|กลาง|ต่ำ> เพราะ <recommendedReason> · <ถ้าไม่ตอบจะใช้ข้อ N | รอคำตอบก่อนทำส่วนนี้>
ตอบเป็นเลข หรือพิมพ์คำตอบอื่นได้
```

- ใช้ structured-question tool ของ host เมื่อมี (เช่น `AskUserQuestion` ใน Claude Code) ไม่งั้นแสดง `render.markdown` ตามตัว
- หลาย card ในรอบเดียว: เรียงตามความ blocking แล้วแสดงต่อกัน

**Question quality checklist** (script ตรวจข้อ 1–4, agent รับผิดชอบข้อ 5–6):
1. มีผลกระทบที่บอกว่าทำไมต้องตัดสิน
2. มีสิ่งที่ตรวจแล้ว
3. ทุกตัวเลือกมี effect ต่างกันจริง
4. มีข้อแนะนำพร้อมเหตุผลและความมั่นใจ
5. ไม่ใช่คำถามปลายเปิด "อยากได้แบบไหน"
6. ไม่ใช่การขออนุญาตในสิ่งที่ได้รับอนุญาตแล้ว

### 5.8 "ตัดสินใจแทนไว้" (review at end)

Delivery summary แสดงการตัดสินใจ R1 ระดับ Medium ที่ agent ทำเอง สูงสุด 5 รายการ รูปแบบ `- <สิ่งที่เลือก> เพราะ <เหตุผล> — เปลี่ยนได้โดย <วิธี>` เกิน 5 ให้สรุปเป็นจำนวน

### 5.9 CLI `decide`

| Subcommand | Phase | พฤติกรรม |
| --- | --- | --- |
| `decide card --cwd T --session S --input card.json` | P1 | validate → (P3: recall + calibration §10.4, §10.6) → เก็บ `runtime/cards/<cardId>.json` และ `runtime/sessions/<S>.json` field `lastCard` → คืน `{cardId, render}` หรือ `{suppressed:{precedent}}` / `{autoDecided:{option, reason}}` |
| `decide record --cwd T --session S --card <id> --choice <optionId\|free:text> [--note t] [--requested-by X]` | P1 | ปิด card → apply `recordAs` → (P3: เขียน signal) → append log event `decision` พร้อม `card`, `choice`, `recommendedChosen` → ล้าง `lastCard` |
| `decide correction --topic T --from X --to Y [--paths a,b]` | P3 | บันทึก signal `source:"correction"` |
| `decide list [--status approved]` | P3 | รายการ decision จาก index |

- `cardId` = `<executionId หรือ session 8 ตัวแรก>-<kind>-<ลำดับ>`
- `lastCard` = `{cardId, kind, topic, risk, options:[{id,label,value}], recommended, recordAs, createdAt, expiresAt}`
- card หมดอายุ → `CARD_EXPIRED`; ไม่พบ → `CARD_NOT_FOUND`

`recordAs` apply:

| ค่า | ผล |
| --- | --- |
| `policy:<path>` | `setPolicyValue(path, option.value)`; ถ้า field จำเป็นครบให้ `status:"confirmed"`, `confirmedBy`, `confirmedAt`; สร้าง/อัปเดต decision `git-workflow-policy` (§6.4) |
| `decision` | สร้าง `decisions/YYYY-MM/<RUN_ID>-<slug>.md` จาก template §10.2 ด้วย `status: approved`, `origin: card` |
| `preference` | P1: log อย่างเดียว; P3: `runtime/preferences/<userKey>.json` |
| `none` | log อย่างเดียว |

---

## 6. C3 — Team workflow policy: ถามครั้งแรกแล้วบันทึก (ข้อ 2)

### 6.1 ไฟล์และความเป็นเจ้าของ

- Path: `.agrimap-agent/policy/workflow.json` — commit เข้า git, เป็นของทีม, แก้ผ่าน PR เหมือน code
- เลือก JSON ไม่ใช่ YAML: package ไม่มี dependency และ `config.json` เป็น JSON อยู่แล้ว
- bootstrap §9.1 allowlist เพิ่ม `.agrimap-agent/policy/**` (§13)
- ไม่มี personal override ใน v1 (preference ส่วนตัวอยู่ `runtime/` ใน P3)

### 6.2 Schema v1

```json
{
  "schemaVersion": 1,
  "status": "confirmed",
  "profile": "agrimap-jenkins",
  "confirmedBy": "orchex006",
  "confirmedAt": "2026-09-18",
  "decisionRef": "decisions/2026-09/18101530-git-workflow-policy.md",
  "branching": {
    "integrationBranch": "develop",
    "stableBranch": null,
    "protected": ["develop", "jenkins", "jenkins-release", "main", "master"],
    "workTypes": {
      "feature":  { "prefix": "feature/",  "base": "develop", "target": "develop", "backMerge": [] },
      "fix":      { "prefix": "fix/",      "base": "develop", "target": "develop", "backMerge": [] },
      "hotfix":   { "prefix": "hotfix/",   "base": "develop", "target": "develop", "backMerge": [] },
      "refactor": { "prefix": "refactor/", "base": "develop", "target": "develop", "backMerge": [] },
      "docs":     { "prefix": "docs/",     "base": "develop", "target": "develop", "backMerge": [] },
      "chore":    { "prefix": "chore/",    "base": "develop", "target": "develop", "backMerge": [] }
    },
    "slug": { "maxLength": 40, "ticketPattern": null },
    "hostBranchPatterns": ["^claude/", "^codex/", "^cursor/", "^gemini/", "^antigravity/", "^worktree-"],
    "hostWorktreeBranch": "push-as-team-name",
    "reuseMatchingWorkBranch": true
  },
  "delivery": {
    "commitOnComplete": true,
    "pushOnComplete": true,
    "commitConvention": "conventional",
    "commitLanguage": "en",
    "includeAuditArtifacts": true,
    "changelog": { "path": "changelog.md", "mode": "required-if-exists" },
    "trailers": ["AGM-Execution"]
  },
  "integration": {
    "method": "pull-request",
    "forge": "auto",
    "mergeStrategy": "merge-commit",
    "afterDelivery": "offer",
    "deleteBranchAfterMerge": "ask",
    "verifyBeforeMerge": true
  },
  "autonomy": {
    "maxQuestionsPerRound": 3,
    "reviewAtEnd": true,
    "calibration": true
  },
  "learning": { "promoteAfter": 2 }
}
```

| Field | ค่าได้ | Default | หมายเหตุ |
| --- | --- | --- | --- |
| `status` | `draft\|confirmed` | — | `draft` = ยังไม่ใช่ standing authorization |
| `profile` | `agrimap-jenkins\|gitflow\|trunk\|custom` | จาก infer | |
| `branching.stableBranch` | branch หรือ `null` | profile | `null` ใน agrimap-jenkins |
| `branching.hostWorktreeBranch` | `push-as-team-name\|rename\|keep` | `push-as-team-name` | ดู §7.3 ข้อ C |
| `delivery.changelog.mode` | `required-if-exists\|required\|none` | `required-if-exists` | ใช้กติกา §5 ของ project AGENTS |
| `integration.method` | `pull-request\|local-merge` | `pull-request` | |
| `integration.forge` | `auto\|github\|gitlab\|none` | `auto` | auto จาก remote URL |
| `integration.mergeStrategy` | `merge-commit\|squash\|ff-only` | `merge-commit` | ไม่มี rebase/force ใน v1 |
| `integration.afterDelivery` | `offer\|open-pr\|none` | `offer` | `open-pr` = เปิด PR อัตโนมัติหลัง push (R3 ที่ทีมยืนยันไว้) |
| `integration.deleteBranchAfterMerge` | `ask\|always\|never` | `ask` | local ใช้ `git branch -d` เท่านั้น |

**Profiles**

| Field | `agrimap-jenkins` | `gitflow` | `trunk` |
| --- | --- | --- | --- |
| integrationBranch | `develop` | `develop` | `main` (หรือ `master` ที่มีจริง) |
| stableBranch | `null` | `main` | `main` |
| protected | develop, jenkins, jenkins-release, main, master | develop, main, master, `release/*` | main, master |
| feature/fix/refactor/docs/chore | base/target `develop` | base/target `develop` | base/target `main` |
| hotfix | base/target `develop` (เพราะ promotion ff-only) | base `main`, target `main`, backMerge `["develop"]` | base/target `main` |

`protected` รองรับ glob ท้าย `/*` เท่านั้น

**Validation** (`POLICY_INVALID` + `details[]`):

- V1 `schemaVersion === 1`
- V2 ทุก prefix ลงท้าย `/`, ไม่ซ้ำกัน, ตรง `^[a-z][a-z0-9-]*/$`
- V3 ทุก `base`/`target`/`backMerge` เป็นชื่อ branch ที่ valid (`git check-ref-format --branch`)
- V4 `profile === "agrimap-jenkins"` → ทุก work type ต้อง base = target = `integrationBranch`; ถ้าไม่ใช่ → `POLICY_HOTFIX_BASE_BREAKS_FF_PROMOTION` (หรือ `POLICY_BASE_BREAKS_FF_PROMOTION` สำหรับ type อื่น)
- V5 `commitOnComplete === false` → `pushOnComplete` ต้องเป็น false
- V6 `integrationBranch` ต้องอยู่ใน `protected`
- V7 `status === "confirmed"` → ต้องมี `confirmedBy`, `confirmedAt`
- V8 enum ทุกตัวตามตาราง; key ที่ไม่รู้จักถูกเก็บไว้ (forward compatible) แต่คืน warning

### 6.3 Inference (`policy infer`, read-only)

| Signal | วิธีตรวจ | คะแนน |
| --- | --- | --- |
| S1 | มี `Jenkinsfile` และ `Jenkinsfile_Production` ที่ root | agrimap-jenkins +3 |
| S2 | `git branch -r --format=%(refname:short)` มี `origin/jenkins` หรือ `origin/jenkins-release` | agrimap-jenkins +2 |
| S3 | มีทั้ง `origin/develop` และ `origin/main\|master` | gitflow +2 |
| S4 | มีแค่ `origin/main\|master` ไม่มี develop | trunk +2 |
| S5 | `DEVELOPMENT.md` หรือ `CONTRIBUTING.md` มีคำว่า `feature/` และ `develop` | gitflow +1 |
| S6 | นับ prefix จาก `git branch -a --format=%(refname:short)` ที่ปรากฏ ≥ 2 ครั้ง | ใช้เป็น prefix จริงของ work type ที่ตรงชื่อ |
| S7 | remote URL: `github.com` → github, host มี `gitlab` → gitlab, อื่นๆ → none | `integration.forge` |

- confidence **high**: คะแนน profile สูงสุด ≥ 4 และห่างอันดับสองอย่างน้อย 3; **medium**: สูงสุด ≥ 2; **low**: ไม่มี remote หรือคะแนนสูงสุด < 2
- Output: `{proposal, confidence, evidence:[…], card}` โดย card:

```text
**ต้องตัดสินใจ: ใช้ workflow นี้กับโปรเจกต์นี้ไหม** — Agent จะแตก branch, commit และ push ตามนี้ทุกงาน (ถามครั้งเดียว)
ตรวจแล้ว: Jenkinsfile + Jenkinsfile_Production; origin/develop, origin/jenkins, origin/jenkins-release; feature/* 14 branches
1. ใช้ตามที่ตรวจพบ (แนะนำ) — feature|fix|hotfix/* แตกจาก develop → commit+push branch เมื่อเสร็จ → เปิด PR เมื่อสั่ง
2. ใช้แต่ไม่ push อัตโนมัติ — แตก branch + commit เมื่อเสร็จ, push เมื่อสั่ง
3. ไม่ใช้ work branch — ทำบน branch ปัจจุบัน, commit เมื่อสั่งเท่านั้น (พฤติกรรมเดิม)
ความมั่นใจ: สูง เพราะไฟล์และ remote branch ตรง profile agrimap-jenkins · รอคำตอบก่อนเริ่มแตก branch
```

- ตัวเลือก 2 → `pushOnComplete:false`; ตัวเลือก 3 → `workTypes` คงไว้แต่เพิ่ม `branching.disabled:true` และ `delivery.commitOnComplete:false`
- ตอบเป็น free text (เช่น "hotfix แตกจาก main") → agent แปลงเป็น `policy set` หลายคีย์แล้วแสดง proposal ใหม่หนึ่งครั้ง

### 6.4 First-time flow

1. งาน durable write แรกใน target root → `policy show` → `exists:false`
2. `policy infer` → รวม card นี้ในรอบคำถามแรก (§5.6) — เป็นหนึ่งใน ≤ 3 คำถาม
3. requester ตอบ → `decide record --card … --choice 1` ซึ่งเรียก `policy init --profile <p> --requested-by <X> --input <proposal.json>`:
   - เขียน `policy/workflow.json` ด้วย `status:"confirmed"`, `confirmedBy`, `confirmedAt` (วันที่ Asia/Bangkok)
   - เขียน decision `decisions/YYYY-MM/<RUN_ID>-git-workflow-policy.md` (`topic: git/workflow-policy`, `kind: workflow`, `origin: card`)
   - เพิ่มหนึ่งบรรทัดใน `memory/project.md` ใต้ `## Facts` (สร้าง heading ถ้าไม่มี): `- Workflow policy: \`.agrimap-agent/policy/workflow.json\` (<profile>, confirmed <date> by <X>)`
4. ไฟล์ทั้งสามเป็นส่วนหนึ่งของ delivery commit แรก
5. งานถัดไป: `policy show` → confirmed → ไม่ถามอีก

### 6.5 CLI `policy`

| Subcommand | Effect | Output |
| --- | --- | --- |
| `policy show --cwd T` | read-only | `{exists, status, policy, validation:{ok, details}}` |
| `policy infer --cwd T` | read-only | `{proposal, confidence, evidence, card}` |
| `policy init --cwd T --profile P --requested-by X [--input overrides.json]` | เขียน policy + decision + project fact | `{written:[paths]}` |
| `policy set --cwd T --key a.b.c --value v --requested-by X` | validate ทั้งไฟล์ก่อนเขียน; `value` parse เป็น JSON ถ้าได้ ไม่งั้นเป็น string | `{written, policy}` |

`policy set` บน policy ที่ confirmed แล้ว = การเปลี่ยน workflow ของทีม → ต้องมาจากคำสั่งตรงของผู้ใช้หรือ card `recordAs: policy:*` เท่านั้น และสร้าง decision ใหม่ที่ `supersedes` อันเดิม

---

## 7. C4 — Work branch start (ข้อ 2)

### 7.1 ใช้เมื่อไร

| Operation | แตก branch |
| --- | --- |
| `execute` | ใช่ |
| `fe`, `be`, `sql` ที่ action เขียนไฟล์ (`create`, `edit`, `refactor`, `test`) | ใช่ |
| `prompt` (เขียนเฉพาะ `.agrimap-agent/prompts`) | ไม่ |
| `release` (มี flow ของตัวเอง), `doctor update` | ไม่ |
| คำถาม/analysis/read-only | ไม่ |

ข้ามเมื่อ: policy `branching.disabled`, target ไม่ใช่ git, หรือผู้ใช้สั่งชัดว่า "ทำบน branch นี้"

### 7.2 เลือก work type (agent-owned ยกเว้นเมื่อ base/target ต่าง)

| สัญญาณในคำขอ | work type |
| --- | --- |
| ความสามารถใหม่ | `feature` |
| แก้ข้อบกพร่อง | `fix` |
| "hotfix", "ด่วน", "production พัง" | `hotfix` |
| ปรับโครงสร้าง ไม่เปลี่ยน behavior | `refactor` |
| เอกสารล้วน | `docs` |
| build/config/dependency/CI | `chore` |

- `feature` vs `fix` กำกวม และ base/target เหมือนกัน → agent เลือก (R0)
- `hotfix` vs `fix` และ policy ให้ base/target ต่างกัน → card R2 (เว้นแต่ผู้ใช้พูดคำว่า hotfix)
- slug: agent เขียนเป็นภาษาอังกฤษ kebab-case สรุปงาน ≤ `slug.maxLength` (เพราะ objective ภาษาไทยจะได้ slug ว่างจาก `taskSubjectSlug`); ถ้ามี ticket ตรง `ticketPattern` ให้ขึ้นต้นด้วย ticket ตัวพิมพ์เล็ก

### 7.3 `branch plan`

Args: `--cwd T --session S --type <workType> --slug <kebab> [--ticket <id>]`

1. โหลด policy: ไม่มี → `POLICY_REQUIRED` + `next:{action:"run", command:"policy infer"}`; invalid → `POLICY_INVALID`
2. เก็บ git facts:
   - `git branch --show-current` (ว่าง → `DETACHED_HEAD` + card)
   - มี `.git/MERGE_HEAD`, `.git/rebase-merge`, `.git/rebase-apply`, `.git/CHERRY_PICK_HEAD` → `OPERATION_IN_PROGRESS`
   - upstream: `git rev-parse --abbrev-ref --symbolic-full-name @{upstream}` (exit ≠ 0 = ไม่มี)
   - `git fetch --prune origin` (fail → warning `OFFLINE_FETCH_FAILED` แล้วใช้ ref local ต่อ; ไม่มี remote → warning `NO_REMOTE`)
   - dirty inventory จาก `git status --porcelain=v1 -z --untracked-files=all` (rename record มี path ใหม่แล้วตามด้วย path เดิม)
3. ชื่อ: `${prefix}${ticket ? ticket.toLowerCase() + "-" : ""}${slug}`; slug ต้องตรง `^[a-z0-9][a-z0-9-]*[a-z0-9]$`, ความยาวรวม ≤ `prefix.length + maxLength`, ผ่าน `git check-ref-format --branch`; ไม่ผ่าน → `BRANCH_NAME_INVALID`
4. Collision: มี `refs/heads/<name>` หรือ `refs/remotes/origin/<name>` → ถ้า active execution บันทึก branch นี้ไว้ → action `reuse`; ไม่ใช่ → เติม `-2` … `-9` (หมด → `BRANCH_NAME_EXHAUSTED`)
5. เลือก action:

| กรณี | Action | Commands |
| --- | --- | --- |
| A. อยู่บน branch ชื่อนี้แล้ว | `reuse` | — |
| B. อยู่บน work branch อื่น (prefix ตรง policy) ที่ active execution นี้บันทึกไว้ | `reuse` | — |
| B'. อยู่บน work branch ของงานอื่น | card R1: 1 แตก branch ใหม่จาก base (แนะนำ) 2 ทำต่อบน branch นี้ | ตามที่เลือก |
| C. branch ตรง `hostBranchPatterns` (host worktree/branch) | ตาม `hostWorktreeBranch`: `push-as-team-name` → คง local, บันทึก `remoteBranch=<name>` (ใช้ตอน push §8.2); `rename` → `git branch -m <name>` เฉพาะเมื่อไม่มี upstream; `keep` → ไม่ทำอะไร | ตามค่า |
| D1. อยู่บน protected/base, tree สะอาด | `create` | `git switch <base>` (ถ้ายังไม่อยู่) → ถ้า behind-only: `git merge --ff-only origin/<base>` → `git switch -c <name>` |
| D2. อยู่บน base, local base diverged จาก origin | card R2: 1 แตกจาก `origin/<base>` (แนะนำ; ไม่รวม N local commits) 2 แตกจาก local `<base>` | `git switch -c <name> origin/<base>` หรือ `git switch -c <name>` |
| D3. อยู่บน protected/base, tree dirty | `create-carry` | `git switch -c <name>` จาก HEAD ปัจจุบัน (พา dirty ไปด้วย ไม่ refresh base) + warning `BASE_NOT_REFRESHED_DIRTY` |
| D4. อยู่บน protected ที่ไม่ใช่ base (เช่น `jenkins`) และ dirty | card R2: 1 สร้างจาก HEAD ปัจจุบันพางานไปด้วย (base ไม่ตรง policy) 2 หยุดให้ผู้ใช้จัดการ | ตามที่เลือก |
| E. อยู่บน branch อื่นที่ไม่ใช่ protected/work (เช่น `release/4.5.5` ใน gitflow) | card R2: 1 แตก `<prefix><slug>` จาก `<base>` (แนะนำ) 2 ทำบน branch ปัจจุบันต่อ (งานเป็นส่วนของ branch นี้) | ตามที่เลือก |

- ห้าม `git stash`, `git reset`, สร้าง worktree หรือ clone ในทุกกรณี
- dirty ที่ไม่เกี่ยวกับงาน **ไม่ต้องถาม**: พาไปด้วยได้ เพราะ delivery stage เฉพาะ path ของงาน (§8.2) และถูกบันทึกเป็น preexisting

6. คืน plan พร้อม `planHash` = sha256 ของ JSON `{facts, action, commands}` (ไม่รวม timestamp)

### 7.4 `branch apply --plan-hash H`

1. คำนวณ plan ใหม่ → hash ไม่ตรง → `PLAN_STALE` (agent plan ใหม่)
2. รัน commands ตามลำดับ ตรวจ exit ทุกคำสั่ง; fail → หยุด คืน `failedStep`, `stderr` (redact แล้ว ≤ 2 KB)
3. บันทึกใน `runtime/active/<session>.json`: `branch`, `remoteBranch`, `base`, `baseSha`, `workType`, `branchAction`
4. append log event `changed` พร้อม `milestone:"work-branch"`, `message:"Work branch <name> ready from <base>@<sha7>"`

### 7.5 Snapshot preexisting dirty (แก้ใน `start`)

`start` บันทึก `active.preexistingDirty` เสมอ (แม้ไม่แตก branch):

```json
[{ "path": "src/a.ts", "status": "M", "hash": "<git hash-object -- path | deleted>" }]
```

- `hash` ใช้ `git hash-object -- <path>` สำหรับไฟล์ที่มีอยู่ (ใช้ได้กับ untracked), `"deleted"` สำหรับไฟล์ที่ถูกลบ
- ลำดับที่ถูกต้อง: `context` → `policy` → `start` (snapshot) → `branch plan/apply` → เริ่มแก้ไฟล์

### 7.6 Edge cases

| กรณี | พฤติกรรม |
| --- | --- |
| ไม่มี remote | แตก branch ได้; delivery commit อย่างเดียว; integration ใช้ได้เฉพาะ local-merge และจบแบบไม่ push |
| branch ถูก checkout อยู่ใน worktree อื่น | `git switch` fail → card R1 เลือกชื่อใหม่ |
| submodule / nested repo | อยู่นอก scope ของ v1 → รายงานเป็น warning |
| fetch fail (offline) | ทำต่อด้วย ref local + warning; delivery push จะ fail → `PUSH_NETWORK` |

---

## 8. C5 — Delivery: commit & push เมื่อจบงาน (ข้อ 4)

### 8.1 Authorization model

- Policy ที่ `status:"confirmed"` และ `delivery.commitOnComplete:true` = **standing authorization ที่มนุษย์ยืนยันแล้ว** ให้ commit (และ push ถ้า `pushOnComplete:true`) **เฉพาะ work branch ของ execution นี้** เมื่องานจบ — (V2.1) ถ้า verification ไม่ผ่านหรือไม่ได้รัน ยัง deliver ได้พร้อม warning `DELIVERED_UNVERIFIED` และ trailer `AGM-Verification: failed|not-run` (§8.2 ข้อ 6)
- ไม่ครอบคลุม: protected branch, PR/merge, tag, remote delete, force
- คำสั่งตรงของผู้ใช้ ("commit", "push ด้วย") ทำให้ deliver ได้แม้ policy ปิด
- Policy `draft` หรือไม่มี policy → ไม่ deliver อัตโนมัติ (พฤติกรรมเดิม: รายงาน local paths)

### 8.2 `deliver plan`

Args: `--cwd T --session S [--input message.json] [--changelog-na "<reason>"]`

**Preconditions** (ตรวจทุกข้อ; `stop` หยุดที่ขั้น deliver, `self-fix` คืน `next` ให้ Agent แก้แล้ว plan ใหม่, `warn` ทำต่อและใส่ใน `warnings`):

| # | ตรวจ | Code เมื่อไม่ผ่าน | Severity (§2.4) |
| --- | --- | --- | --- |
| 1 | มี active execution ของ session | `NO_ACTIVE_EXECUTION` | self-fix (`start` ย้อนหลังด้วย objective เดิม) |
| 2 | instruction chain ack ครบ (§4.3) | `INSTRUCTIONS_NOT_ACKNOWLEDGED` | self-fix |
| 3 | current branch = `active.branch` | `BRANCH_MISMATCH` | self-fix (switch กลับ ถ้า tree ยอม) ไม่งั้น stop |
| 4 | current branch ไม่อยู่ใน `protected` (รองรับ `/*`) | `PROTECTED_BRANCH` | stop (เสนอ branch plan แบบ carry ใน card เดียว) |
| 5 | ไม่มี merge/rebase/cherry-pick ค้าง | `OPERATION_IN_PROGRESS` | stop |
| 6 | verification ล่าสุดของ execution (event `verified` ใน log) มีสถานะ `passed` หรือ `not-applicable` | `DELIVERED_UNVERIFIED` | warn — (V2.1) ยัง commit/push **work branch** ได้ commit มี trailer `AGM-Verification: failed` หรือ `not-run`; Next-step card ไม่เสนอ merge จนกว่าจะผ่าน |
| 7 | (V2, P2) spec-first/hybrid ใน scope: spec sync ของ execution ถูก apply แล้ว หรือมี `--spec-na "<reason>"` (§19.9) | `SPEC_NOT_SYNCED` | self-fix (รัน `spec sync`) → ถ้า sync ทำไม่ได้ → warn; `SPEC_SYNC_REQUIRED` แบบ stop ใช้เฉพาะเมื่อทีมตั้ง `specs.enforcement:"block"` เอง |

**จำแนก path** (inventory ปัจจุบันจาก `git status --porcelain=v1 -z --untracked-files=all` เทียบ `active.preexistingDirty`):

| กลุ่ม | เงื่อนไข | ผล |
| --- | --- | --- |
| `own` | dirty ตอนนี้ และไม่อยู่ใน preexisting | stage |
| `foreign` | อยู่ใน preexisting และ hash ไม่เปลี่ยน | ไม่ stage, แสดงใน summary |
| `mixed` | อยู่ใน preexisting และ hash เปลี่ยน | card R2: 1 รวม (แนะนำ — งานนี้แก้ไฟล์นี้จริง แต่มีงานที่ค้างก่อนเริ่มปนอยู่) 2 ไม่รวม |
| `.agrimap-agent/**` | ต้องอยู่ใน `decisions/`, `instructions/`, `knowledge/`, `logs/`, `memory/`, `reports/`, `policy/` และเป็น `own` | stage เมื่อ `includeAuditArtifacts:true`; `runtime/`, `cache/`, `prompts/`, `tasks/` ไม่ stage |
| ignored | `git check-ignore` | ไม่ stage เด็ดขาด |
| `.agrimap-agent/local/**` (V2) | ทุกกรณี แม้ถูก track มาก่อนด้วย `git add -f` | ไม่ stage + warning `LOCAL_MEMORY_TRACKED` ถ้าพบว่าถูก track |

(V2) หลังจำแนก: ถ้าบรรทัดที่เพิ่มใน own path มี absolute path ใดที่อยู่ใน local memory → `LOCAL_PATH_LEAK` — self-fix: Agent แทน path ด้วย id ของ spec source แล้ว plan ใหม่; ถ้าแทนไม่ได้ (เช่น path เป็นค่าที่ code ต้องใช้จริง) → stop เพราะ push แล้วย้อนไม่ได้ (§19.4)

**Secret scan**: ทุก `own` path ที่เป็น text ≤ 1 MB → ดึงบรรทัดที่เพิ่ม (`git diff --no-color -U0 -- <path>` สำหรับ tracked, เนื้อหาทั้งไฟล์สำหรับ untracked) → `detectSensitive(text)` (export ใหม่ใน `sensitive-recording.mjs` ใช้ pattern ชุดเดียวกับ `redactText`) → พบ → ตัด path ออกจาก stage, คืน `SECRET_SUSPECTED` + card R3: 1 ไม่รวมไฟล์นี้ (แนะนำ) 2 เป็น false positive รวมได้ — ห้ามแสดงค่าที่ตรวจพบ แสดงแค่ `path:line` และชนิด

**Changelog**: `delivery.changelog.mode`
- `required-if-exists` และมีไฟล์ `changelog.path` ที่ target root → ไฟล์นั้นต้องเป็น `own` หรือมี `--changelog-na "<reason>"` (เหตุผลที่ project AGENTS §5 ยอมรับ เช่น formatting-only) → ไม่ผ่าน `CHANGELOG_REQUIRED` + `next:{action:"run", command:"add changelog entry per project AGENTS §5, then deliver plan"}` (self-fix: Agent เติม entry เองแล้ว plan ใหม่)
- `required` → ต้องมีไฟล์และเป็น own
- `none` → ข้าม

**Commit message**:
- `--input message.json` = `{ "type": "feat", "scope": "orders", "subject": "add export to CSV", "body": ["…"] }`
- ไม่มี input → generate: type จาก work type (`feature→feat`, `fix→fix`, `hotfix→fix`, `refactor→refactor`, `docs→docs`, `chore→chore`), scope = directory ระดับบนสุดที่มีไฟล์ own มากที่สุด (ไม่นับ `.agrimap-agent`), subject = objective ของ execution
- `commitLanguage:"en"` และ subject มีอักขระนอก ASCII → `MESSAGE_REQUIRED` (self-fix: agent เขียน message อังกฤษเองแล้วส่ง `--input`)
- Header ต้องตรง `^(feat|fix|refactor|docs|chore|test|perf|build|ci)(\([a-z0-9._/-]+\))?: \S.*$` และ ≤ 72 ตัวอักษร → ไม่ผ่าน `MESSAGE_INVALID`
- Body: บรรทัดว่าง + bullet จาก body (ไม่มี → จาก checkpoint `changed`/`verified` ของ execution สูงสุด 5 บรรทัด)
- Trailer: `AGM-Execution: <executionId>` (ตาม `delivery.trailers`)
- เขียนไฟล์ `.agrimap-agent/runtime/tmp/commit-<executionId>.txt` (LF)

**Commands**:

```text
git add -- <own paths…>                       # แบ่งครั้งละ ≤ 100 paths; รวม deletion
git diff --cached --check
git diff --cached --name-status
git commit -F .agrimap-agent/runtime/tmp/commit-<id>.txt
git push -u origin HEAD:refs/heads/<remoteBranch|branch>   # เมื่อ pushOnComplete และมี remote
git ls-remote --heads origin <remoteBranch|branch>
```

- ถ้า `git config --get commit.gpgsign` เป็น true ไม่ต้องเติมอะไร (git commit จัดการเอง)
- Output: plan + `planHash` + `counts:{own, foreign, mixed, excluded}` + `paths` ต่อกลุ่ม

### 8.3 `deliver apply --plan-hash H [--push-only]`

1. คำนวณใหม่ → `PLAN_STALE` ถ้า hash ไม่ตรง
2. **Idempotency**: HEAD มี commit ที่ trailer `AGM-Execution: <id>` และไม่มี own path ค้าง → ข้าม commit; remote SHA = HEAD → ข้าม push
3. รันตามลำดับ ตรวจ exit ทุกขั้น; fail → หยุดพร้อม `failedStep`
4. จำแนก push failure จาก stderr:

| stderr มี | Code | next |
| --- | --- | --- |
| `[rejected]` + `non-fast-forward` หรือ `fetch first` | `REMOTE_AHEAD` | `integrate plan --intent update-branch` แล้ว deliver `--push-only` |
| `Authentication failed`, `Permission denied`, `403` | `PUSH_AUTH` | รายงาน ให้ผู้ใช้แก้ credential (agent ไม่แตะ credential) |
| `Could not resolve host`, `timed out`, `Connection` | `PUSH_NETWORK` | `deliver apply --push-only` ภายหลัง; commit ยังอยู่ |
| อื่นๆ | `PUSH_FAILED` | รายงาน stderr |

5. Verify: SHA จาก `ls-remote` = `git rev-parse HEAD` → ไม่ตรง `REMOTE_MISMATCH`
6. บันทึก: log event `delivered` (`branch`, `remoteBranch`, `commit`, `remoteVerified`, `files`); `active.delivery = {commit, remoteSha, pushedAt}`; checkpoint current memory
7. `--push-only`: ข้าม stage/commit, ทำเฉพาะ push + verify

### 8.4 หลาย commit

- `light`: หนึ่ง commit ต่อ execution
- `standard`/`regulated`: `deliver apply --checkpoint` ได้ระหว่างทาง (trailer เพิ่ม `AGM-Checkpoint: <n>`; push ตาม policy); preexisting ยังคงเดิม

### 8.5 Audit artifact ที่ไม่ conflict ข้าม branch

ปัญหา: `logs/YYYY-MM/YYYY-MM-DD.jsonl` และ `## Completed work` ใน `project.md` ถูก append จากหลาย work branch ในวันเดียวกัน → merge conflict ตอนรวมเข้า develop เสมอ (server-side merge ของ GitHub/GitLab ไม่ช่วย union merge)

แก้:

1. `appendLog()` (`agm-workspace.mjs` บรรทัด ~662–664): เปลี่ยน path เป็น `logs/YYYY-MM/YYYY-MM-DD/<executionId>.jsonl`; event ที่ไม่มี executionId → `logs/YYYY-MM/YYYY-MM-DD/_session-<session8>.jsonl`
   - reader ทุกตัว (`filesUnder(logs)` ที่บรรทัด ~1066, 1088, 1116, 1282, 1892) อ่าน recursive อยู่แล้ว จึงอ่านได้ทั้งไฟล์เก่าและใหม่โดยไม่ต้องแก้
   - แก้ข้อความ checklist บรรทัด ~1665 และ `auditStorageStatus` ให้ตรง path ใหม่
2. `updateProjectMemory()`: หยุด append `## Completed work` เมื่อ `config.memory.completedWorkInProjectMd !== true` (default ของ layout ใหม่ = `false`); เนื้อหาเดิมไม่แตะ; รายการงานที่เสร็จดูได้จาก `history` + `memory/recent`
3. bootstrap §9.2 และ §9.4 ปรับตาม §13

### 8.6 Delivery summary (ข้อความจบงาน)

ไม่เกิน 12 บรรทัด:

```text
✅ เสร็จและส่งขึ้น branch แล้ว
- Branch: feature/order-export (จาก develop @a1b2c3d) → commit e4f5a6b · push แล้ว remote ตรงกัน
- เปลี่ยน: 4 ไฟล์ · Tests: 12 passed (dotnet test OrdersTests)
- ตัดสินใจแทนไว้: ใช้ CsvHelper ที่มีอยู่แล้วแทนเขียน serializer ใหม่ — เปลี่ยนได้โดยบอก "เขียนเอง"
- ไม่ได้รวม: 2 ไฟล์ที่ค้างก่อนเริ่มงาน (appsettings.Local.json, notes.md)

ถัดไป — ตอบเลขได้เลย
1. เปิด PR → develop (แนะนำ)
2. แก้ต่อ
3. พักไว้
```

ส่วน "ถัดไป" มาจาก `integrate options` (§9.1) ไม่ใช่เขียนเอง

---

## 9. C6 — Integration intents และ Next-step card (ข้อ 5)

### 9.1 Next-step card: `integrate options --cwd T --session S`

สร้าง card `kind:"integration"`, `risk:"R3"`, `topic:"git/integration"` แล้วเก็บเป็น `lastCard` (ผ่าน `decision-card.mjs#storeCard`) ตัวเลือกขึ้นกับ policy และสถานะ PR:

| สถานการณ์ | ตัวเลือก (ข้อ 1 = แนะนำ) |
| --- | --- |
| `method:"pull-request"`, ยังไม่มี PR | 1 เปิด PR → `<target>` · 2 แก้ต่อ · 3 พักไว้ |
| `method:"pull-request"`, มี PR เปิดอยู่ | 1 Merge PR #n (เมื่อ review ผ่าน) · 2 อัปเดต branch จาก `<target>` · 3 แก้ต่อ |
| `method:"local-merge"` | 1 Merge เข้า `<target>` (หลัง review) · 2 เปิด PR แทน (เมื่อมี forge) · 3 แก้ต่อ · 4 พักไว้ |
| (V2.1) execution มี `DELIVERED_UNVERIFIED` | 1 แก้ต่อให้ test ผ่าน · 2 เปิด PR แบบ draft (เมื่อมี forge) · 3 พักไว้ — ไม่มีตัวเลือก merge; ถ้าผู้ใช้พิมพ์ `merge` เอง ให้ card R3 ยืนยันพร้อมบอกว่ายังไม่ผ่านอะไร |
| hotfix ใน gitflow | label ของ merge บอกครบ: "Merge เข้า main แล้ว back-merge develop" |

`integration.afterDelivery:"open-pr"` → เปิด PR ทันทีหลัง delivery (ทีมยืนยันไว้ใน policy) แล้วแสดง card แถวที่สอง

### 9.2 Lexicon ของคำสั่งสั้น

ฟังก์ชัน pure ใหม่ใน `governance-policy.mjs`:

```js
export function resolveShortIntent(text, { lastCard = null, now = Date.now() } = {})
// → { intent, option?, target?, whenGreen?, reason }
```

ขั้นตอน:

1. `value = unquotedIntent(text).trim().toLowerCase()`; ตัดคำลงท้าย/สุภาพ: `ครับ|ค่ะ|คะ|นะ|จ้า|จ้ะ|เลย|ด้วย|หน่อย|please|pls` และเครื่องหมาย `.!` ท้ายประโยค
2. ความยาว > 60 ตัวอักษร → `{intent:"none", reason:"not-short"}` (agent ตีความตามปกติ โดยใช้ตารางนี้เป็นแนวทาง)
3. Question guard: มี `?` หรือคำ `ยังไง|อย่างไร|ไหม|มั้ย|หรือเปล่า|รึเปล่า|ได้ไหม|how|what|why|should|can i` → `{intent:"question"}` (ห้ามทำ action)
4. Match ตามลำดับ (ทั้งข้อความ):

| Intent | Pattern (regex, `u` flag) | หมายเหตุ |
| --- | --- | --- |
| `select-option` | `^(?:ข้อ\s*\|option\s*\|ตัวเลือก(?:ที่)?\s*)?([1-9])$` | ต้องมี `lastCard` ที่ยังไม่หมดอายุ และเลขอยู่ใน options; ไม่งั้น `none` |
| `integrate` | `^(?:merge\|รวม(?:ได้\|เลย)?\|ship(?: it)?\|lgtm(?: merge)?\|ผ่าน(?:แล้ว)?(?:\s*(?:รวม\|merge)(?:ได้\|เลย)?)?)$` | target จาก policy |
| `integrate` + target | `^(?:merge\|รวม\|เอา)\s*(?:เข้า\|to\|into\|ไป\|ขึ้น)?\s*([a-z0-9._/-]+)$` | capture target |
| `integrate` + whenGreen | pattern integrate ตามด้วย `\s*(?:เมื่อ\|when)\s*(?:ci\|pipeline\|checks?)\s*(?:ผ่าน\|green\|pass(?:es)?)` | อนุญาต auto-merge เฉพาะกรณีนี้ |
| `open-pr` | `^(?:pr\|mr\|เปิด\s*(?:pr\|mr)\|ส่ง\s*(?:รีวิว\|review)\|create\s+(?:pr\|mr))$` | |
| `update-branch` | `^(?:อัปเดต\|อัพเดท\|update\|sync)(?:\s*branch)?(?:\s*(?:กับ\|with\|จาก\|from)\s*[a-z0-9._/-]+)?$` หรือ `^rebase$` | ใช้ merge เสมอ ไม่ rebase/force |
| `continue` | `^(?:แก้ต่อ\|ทำต่อ\|continue\|ยังไม่\s*(?:merge\|รวม))$` | |
| `park` | `^(?:พัก(?:ไว้)?\|hold\|park\|รอก่อน)$` | |
| `abandon` | `^(?:ทิ้ง(?:\s*branch)?\|ยกเลิก\s*branch\|abandon\|discard)$` | card R3 เสมอ |

`\|` ในตารางเป็นการ escape ของ Markdown เท่านั้น — regex จริงใช้ `|` ปกติ; จับตามลำดับแถวและแถวแรกที่ตรงชนะ

5. Target alias: `dev→develop`, `prod→jenkins-release`, `inh|inhouse→jenkins`, `master|main` คงเดิม; target ต้องอยู่ใน `integrationBranch`, `stableBranch` หรือ `target`/`backMerge` ของ work type — ไม่อยู่ → `TARGET_NOT_ALLOWED`; `jenkins`/`jenkins-release` → ไม่ใช่ integration แต่เป็น release: ตอบให้ใช้ release intent ตาม project AGENTS §2 (`TARGET_IS_RELEASE_FLOW`)
6. target ต่างจาก policy target ของ work type (เช่น feature → main) → card R2 ยืนยัน

### 9.3 Authorization ของคำสั่งสั้น

- คำตอบสั้นที่ resolve ได้ (เลขใน card, `merge`, `pr` ฯลฯ) = **คำสั่งตรงของผู้ใช้สำหรับ action set ที่ plan คำนวณไว้เท่านั้น** ไม่ต้องถามซ้ำเมื่อ target ชัดและ precondition ผ่าน
- action ที่เกินจากนั้น (ลบ remote branch, back-merge ที่ policy ไม่ได้กำหนด, merge ขณะ check fail) ต้องมี card แยก
- ห้าม `--admin` / bypass review / auto-merge เว้นแต่ `whenGreen`

### 9.4 `integrate plan`

Args: `--cwd T --session S --intent integrate|open-pr|update-branch|park|abandon [--branch B] [--target X] [--when-green]`

**1. Source branch** (ลำดับแรกที่ได้): `--branch` → `active.branch` ของ session → branch ที่ `delivered` ล่าสุดใน session state → current branch ถ้าเป็น work branch → card R1 แสดง work branch ที่มี event `delivered` ใน 14 วัน (สูงสุด 4)

**2. Preconditions**: instruction ack ครบ; source ถูก push แล้วและ remote SHA = local (ไม่งั้น `DELIVERY_REQUIRED`); ไม่มี own dirty บน source (`DIRTY_TREE`)

**3. Forge**: `integration.forge:"auto"` → จาก `git remote get-url origin` (แปลง `git@host:group/repo.git` เป็น `https://host/group/repo`); CLI พร้อมใช้เมื่อ `gh auth status` / `glab auth status` exit 0

**4. แยกตาม intent และ method**

**open-pr**

| Forge | Commands |
| --- | --- |
| github + gh พร้อม | `gh pr list --head <remoteBranch> --base <target> --state open --json number,url` → มีแล้วใช้เดิม; ไม่มี: `gh pr create --base <target> --head <remoteBranch> --title "<commit header>" --body-file <tmp>` |
| gitlab + glab พร้อม | `glab mr list --source-branch <remoteBranch> --target-branch <target>` → ไม่มี: `glab mr create --source-branch <remoteBranch> --target-branch <target> --title "<header>" --description "<body>" --yes` |
| ไม่มี CLI / ไม่ auth / forge none | ไม่รันคำสั่ง; คืน `status:"manual-pr"` + `compareUrl` |

- compare URL: GitHub `https://github.com/<owner>/<repo>/compare/<target>...<remoteBranch>?expand=1`; GitLab `https://<host>/<path>/-/merge_requests/new?merge_request%5Bsource_branch%5D=<b>&merge_request%5Btarget_branch%5D=<t>`
- PR body: summary จาก delivery (objective, files, verification, "ตัดสินใจแทนไว้") เขียนลง `runtime/tmp/pr-<executionId>.md`
- **ต้องตรวจ flag ของ `glab` กับ `glab <cmd> --help` ของเวอร์ชันที่ติดตั้งตอน implement** และเขียน test ด้วย stub runner — spec นี้ยืนยัน flag ของ `gh` แต่ไม่ได้ทดสอบ `glab` จริง

**integrate — method `pull-request`**

1. หา PR ตามข้างบน; ไม่มี → สร้างก่อน (ผู้ใช้สั่ง merge แปลว่า review แล้ว)
2. ตรวจ `gh pr view <n> --json mergeStateStatus,reviewDecision,statusCheckRollup,url` (GitLab: `glab mr view <n> -F json`)
   - `mergeStateStatus` ∈ `CLEAN|HAS_HOOKS|UNSTABLE` (UNSTABLE = check ไม่บังคับ fail) → merge ได้
   - `BLOCKED`/`reviewDecision:"REVIEW_REQUIRED"` → `PR_BLOCKED`: รายงาน PR URL + สิ่งที่รอ; ไม่ bypass
   - check fail → `PR_CHECKS_FAILING` + card: 1 แก้ต่อบน branch (แนะนำ) 2 รอแล้วค่อยสั่งใหม่
   - check pending → ถ้า `whenGreen` → `gh pr merge <n> --<strategy> --auto`; ไม่งั้น card: 1 merge เมื่อ CI ผ่าน (ตั้ง auto-merge) 2 รอแล้วค่อยสั่งใหม่
3. `gh pr merge <n> --merge|--squash` (`ff-only` → `--rebase` ไม่ใช้; ใน PR mode ff-only map เป็น `--merge` + warning) และ `--delete-branch` เฉพาะ `deleteBranchAfterMerge:"always"`
4. หลัง merge: `git fetch --prune origin` → verify `origin/<target>` มี source SHA เป็น ancestor (`git merge-base --is-ancestor <sourceSha> origin/<target>`)

**integrate — method `local-merge`** (ไม่ checkout protected branch, ไม่ reset, push ครั้งเดียวแบบ atomic):

```text
# ขั้น A: ให้ work branch มี target ล่าสุด
git fetch --prune origin
git switch <branch>
git merge --no-edit origin/<target>        # ข้ามถ้า origin/<target> เป็น ancestor ของ branch อยู่แล้ว
#   conflict → รวบ path: git diff --name-only --diff-filter=U → git merge --abort → MERGE_CONFLICT + card
# ขั้น B: verify (เมื่อ target ขยับหรือ verifyBeforeMerge) — agent รันเองด้วย tool ของ host ตาม qa-and-done
#   script ไม่รันคำสั่ง shell จาก policy; plan คืน next:{action:"run-verification"} แล้วรอ integrate apply --stage push
git push origin HEAD:refs/heads/<remoteBranch>
# ขั้น C: สร้างผล merge โดยไม่แตะ local target
#   merge-commit: sha=$(git commit-tree <branch>^{tree} -p origin/<target> -p <branch> -F <msg>)
#   squash:       sha=$(git commit-tree <branch>^{tree} -p origin/<target> -F <msg>)
#   ff-only:      sha=<branch sha>
git push origin <sha>:refs/heads/<target>
git ls-remote --heads origin <target>      # ต้อง = sha
# ขั้น D: อัปเดต local target แบบ ff เท่านั้น (ข้ามถ้าถูก checkout ใน worktree ใด)
git fetch origin <target>:<target>
```

- ถูกต้องเพราะหลังขั้น A branch มี `origin/<target>` เป็น ancestor แล้ว ผล merge แบบ `--no-ff` จึงมี tree เท่ากับ `<branch>^{tree}` เสมอ
- push ขั้น C ถูก reject (target ขยับระหว่างนั้น) → ไม่มีอะไรเปลี่ยนใน local → `REMOTE_TARGET_ADVANCED` → rerun `integrate plan` ตั้งแต่ขั้น A
- server ปฏิเสธเพราะ branch protection → `PROTECTED_BY_SERVER` + แนะนำให้เปลี่ยน policy เป็น `pull-request`
- merge message: `Merge branch '<branch>' into <target>` + trailer `AGM-Execution: <id>`
- signing: ถ้า `commit.gpgsign=true` เติม `-S` ให้ `commit-tree`
- `backMerge`: ทำขั้น A–D ซ้ำกับแต่ละ backMerge target โดยใช้ source branch เดิม

**update-branch**: ขั้น A แล้ว push work branch (ไม่ merge เข้า target)

**park**: ไม่มีคำสั่ง git; บันทึก checkpoint `parked` ใน current memory; คง active state ให้ resume ได้

**abandon**: card R3 เสมอ: 1 ลบ local branch เก็บ remote ไว้ 2 ลบทั้ง local และ remote 3 ยกเลิก — commands: `git switch <base>`, `git branch -d <b>` (ถ้าไม่ merge แล้วต้องเลือกข้อ 1/2 อย่างชัดเจนจึงใช้ `-D`), `git push origin --delete <remoteBranch>`

**5. Output**: plan + `planHash` + `stages` (local-merge มี `merge-into-branch`, `push-branch`, `push-target`); `integrate apply --plan-hash H [--stage push]`

### 9.5 หลัง integration

- log event `integrated` (`source`, `target`, `method`, `pr`, `mergeSha`, `remoteVerified`) — **อนุญาตหลัง `completed` ของ execution เดียวกัน** (ไม่ใช่ terminal event; แก้ `auditEventIssues` ให้ยอมรับ)
- `deleteBranchAfterMerge`: `ask` → card R3 (1 ลบ local+remote (แนะนำ เพราะ merge แล้ว) 2 เก็บไว้); `always` → `git branch -d` + `git push origin --delete`; `never` → ไม่ทำ
- ลบ current memory ของ execution; append recent memory; ล้าง `lastCard`
- รายงาน ≤ 5 บรรทัด: target, merge SHA/PR URL, remote verified, branch ลบหรือไม่, pipeline `pending/not verified` (ห้ามอ้างว่า deploy)

### 9.6 Hook: short reply

ใน `hook-context.mjs` โหมด `task` **ก่อน** `classifyRequest` (เพราะข้อความ "1" ไม่ถูกจัดเป็น project intent):

1. หา session state: `<gitRoot>/.agrimap-agent/runtime/sessions/<session>.json`; ถ้า cwd ไม่ใช่ repo → อ่าน session pointer `path.join(os.tmpdir(), "agrimap-agent", "sessions", sha256(session).slice(0,16) + ".json")` = `{ targetRoots:[abs], updatedAt }` (เขียนโดย `context --ack` และ `decide card`; ลบได้โดยไม่เสียข้อมูล)
2. `resolveShortIntent(prompt, {lastCard})`:
   - `select-option` → inject: `User reply "<text>" selects option <n> "<label>" of card <cardId> (<kind>/<topic>). This is the explicit instruction for that option. Record it with decide record --card <cardId> --choice <n>, then continue.`
   - `integrate|open-pr|update-branch|park|abandon` และมี active/delivered branch → inject: `Short integration intent "<intent>" for <branch> → <target>. Run agm-workspace.mjs integrate plan --intent <intent> [--target <t>] and follow its result.`
   - `question` → inject: `The reply is a question about <intent>; answer it without running git actions.`
3. Hook ต้องไม่เรียก git หรือ network; อ่านไฟล์ JSON ≤ 2 ไฟล์เท่านั้น

---

## 10. C7 — Decision memory และ behavioral learning (ข้อ 3, P3)

### 10.1 หลักการ

- **Pull ไม่ใช่ push**: ไม่ฉีด `project.md`/decision ทุก prompt; ดึงเฉพาะ decision point (§10.5) และจำกัดขนาดผลลัพธ์
- **Markdown คือ source of truth**, index เป็น cache ที่ไม่ commit (ไม่ conflict ข้าม branch)
- **เรียนจากพฤติกรรม**: การเลือกจาก card และการแก้การตัดสินใจของ agent คือข้อมูลที่ดีที่สุดว่าทีมตัดสินใจอย่างไร
- **วัดได้**: บันทึก `precedents` และ `questions` ใน audit event เพื่อดูว่า memory ถูกใช้จริง

### 10.2 Decision record v2

Path เดิม: `decisions/YYYY-MM/<RUN_ID>-<slug>.md` แก้ `assets/templates/decision.md` เพิ่ม frontmatter (field เดิมคงไว้ทั้งหมด):

```yaml
kind: workflow # workflow|architecture|convention|contract|preference
summary: "hotfix แตกจาก develop เพราะ promotion เป็น ff-only" # ≤ 140 chars; ใช้ใน recall
scope_paths: [] # glob เช่น ["src/Orders/**", "db/procedures/ORDER_*.sql"]
applies_when: "" # เงื่อนไขสั้น เช่น "new stored procedure"
origin: card # explicit|card|correction|promoted
card_id: null
```

- Supersede: สร้างไฟล์ใหม่ `supersedes: <ไฟล์เดิม>`; แก้ไฟล์เดิมเฉพาะ `status: superseded` และ `superseded_by` (metadata correction ตาม bootstrap §9.4 ข้อ 7)
- ไฟล์ decision รุ่นเก่าที่ไม่มี field ใหม่: default `kind: convention`, `summary` = heading `# Decision: …`, `scope_paths: []`

### 10.3 Index cache

- `.agrimap-agent/cache/decisions-index.json` (`cache/` ถูก ignore ใน `.agrimap-agent/.gitignore` อยู่แล้ว)
- `{ builtAt, fileCount, maxMtimeMs, entries:[{ id, file, topic, kind, status, summary, scope_paths, applies_when, date, supersedes, superseded_by }] }`
- Rebuild เมื่อ `fileCount` หรือ `maxMtimeMs` ของ `decisions/**/*.md` ต่างจากเดิม
- Frontmatter parser (ไม่เพิ่ม dependency) `parseFrontmatter(text)`: อ่านระหว่าง `---` บรรทัดแรกกับ `---` ถัดไป; ทุกบรรทัด `key: value`; ตัด comment ` # …` ท้ายค่าเมื่อไม่อยู่ใน quote; `null` → null; `[a, "b"]` → array (split `,` แล้ว trim quote); ค่า quote → ตัด quote; อื่นๆ → string; บรรทัดที่ parse ไม่ได้ → ข้ามพร้อม warning

### 10.4 `recall`

Args: `--cwd T [--topic area/subject] [--paths a,b] [--kind k] [--limit 5] [--session S]`

- เฉพาะ `status: approved` (ถ้าไม่มี approved เลยให้แสดง `proposed` พร้อม flag `proposed:true`); ไม่รวม `rejected`/`superseded`
- คะแนน: topic ตรงทั้งหมด +5; area (ก่อน `/`) ตรง +2; path ใดตรง glob ใน `scope_paths` +3; kind ตรง +1; อายุ ≤ 90 วัน +1
- เกณฑ์ ≥ 3; เรียงคะแนนมาก→น้อย แล้ววันที่ใหม่→เก่า; จำกัด `limit`
- Glob → regex: escape อักขระพิเศษ; `**/` → `(?:.*/)?`; `**` → `.*`; `*` → `[^/]*`; `?` → `[^/]`; เทียบกับ path แบบ `/` relative ต่อ target root
- Output ≤ 2,000 ตัวอักษร (ตัด summary ถ้าเกิน):

```json
{ "ok": true, "matches": [{ "id": "…", "summary": "…", "topic": "git/hotfix-base", "date": "2026-09-18", "file": "decisions/…", "score": 8 }],
  "promotable": [{ "topic": "sql/proc-naming", "value": "…", "count": 2 }],
  "calibration": { "convention": { "n": 7, "acceptRate": 0.86, "mode": "decide-and-report" } } }
```

- `decide card` เรียก recall อัตโนมัติ: มี match คะแนน ≥ 7 และ topic ตรง และ value ของ precedent ตรงกับ option หนึ่ง → คืน `{suppressed:{precedent, option}}` (agent ใช้ค่านั้น ไม่ถาม และอ้าง precedent ในรายงาน)
- การใช้งาน precedent ถูกบันทึก: `checkpoint`/`complete` รับ `--precedent <id,…>` → field `precedents` ใน audit event; `decide card` ที่ถูก suppress เพิ่ม `questionsAvoided` ใน active state แล้วเขียนลง event `completed`

### 10.5 Decision points (เรียก recall เฉพาะจุดนี้)

| DP | เมื่อ | topic/paths |
| --- | --- | --- |
| DP1 | ก่อน pre-write gate | area ของงาน + ไฟล์ที่วางแผนแก้ |
| DP2 | ก่อนทุก Decision Card | อัตโนมัติใน `decide card` |
| DP3 | ผู้ใช้อ้าง "แบบเดิม/เหมือนที่เคยตกลง" | จากข้อความ |
| DP4 | ตัดสินเรื่อง git (branch/integration) | อัตโนมัติใน `git-flow.mjs` ด้วย topic `git/*` |

นอกจุดเหล่านี้ไม่โหลด memory

### 10.6 Signals, preference promotion, calibration

**Signal** — `.agrimap-agent/runtime/signals/<userKey>.jsonl` (local, ไม่ commit; `userKey` = `identityKey(machine + "-" + osUser)` จาก `identity.mjs` — ต้อง export เพิ่ม):

```json
{"ts":"2026-09-18T03:15:30Z","cardId":"18101530-workflow-1","kind":"convention","topic":"sql/proc-naming","risk":"R1","confidence":"medium","recommended":"1","chosen":"2","chosenValue":"UM_<ENTITY>_Q","recommendedChosen":false,"source":"card"}
```

- `decide record` เขียนทุกครั้ง; `decide correction` เขียน `source:"correction"` (ใช้เมื่อผู้ใช้แก้สิ่งที่ agent ตัดสินเอง เช่น "ไม่เอา X ใช้ Y")

**Promotion**: `(topic, chosenValue)` เดียวกัน ≥ `learning.promoteAfter` (default 2) ครั้งติดกันโดยไม่มีค่าอื่นแทรก → `recall` คืนใน `promotable` → agent เสนอ card R1 หนึ่งครั้งต่อ session:

```text
**ต้องตัดสินใจ: ใช้ "<value>" เป็นค่าเริ่มต้นของ <topic> ไหม** — เลือกแบบนี้มาแล้ว <count> ครั้ง
1. ใช้เป็นค่าของทีม (แนะนำ) — บันทึก decision, commit ไปกับงาน
2. ใช้เฉพาะฉัน — บันทึก preference บนเครื่องนี้
3. ไม่ต้อง — ไม่ถามเรื่องนี้อีก
```

ข้อ 3 → signal `declinedPromotion` ทำให้ topic นี้ไม่ถูกเสนออีก

**Calibration** (เฉพาะ R1, `autonomy.calibration:true`): ต่อ `kind` จาก 10 signal ล่าสุดที่ `risk:"R1"`:
- `n ≥ 5` และ `acceptRate ≥ 0.8` → `mode:"decide-and-report"`: `decide card` ที่ R1 + confidence medium คืน `autoDecided` (agent ใช้ข้อแนะนำ แล้วใส่ใน "ตัดสินใจแทนไว้")
- `acceptRate ≤ 0.5` → `mode:"ask"`: R1 medium ของ kind นั้นต้องถามแม้ matrix บอกให้ตัดสินเอง
- อื่นๆ → `default`
- R2/R3 ไม่ถูก calibrate
- ผู้ใช้สั่ง "ถามก่อนเสมอเรื่อง <kind>" → `runtime/preferences/<userKey>.json` `{ "alwaysAsk": ["<kind>"] }` มี precedence เหนือ calibration

### 10.7 Session digest (hook)

เงื่อนไขทั้งหมด: hook active; มี change intent หรือ explicit invocation; รู้ target root; `digestHash` ต่างจาก `runtime/sessions/<S>.json.digestHash`

`digestHash` = sha256 ของ `policy.json sha + decisions fileCount/maxMtime + current branch + active executionId/status`

เนื้อหา ≤ 3 บรรทัด ≤ 600 ตัวอักษร:

```text
AGM digest: target agmws-orders-netcore · branch feature/order-export (feature, base develop) · policy agrimap-jenkins (commit+push on complete: yes; integrate: PR→develop)
Decisions: 7 approved; recent topics: git/hotfix-base, sql/proc-naming, api/error-shape. Recall at decision points: agm-workspace.mjs recall --topic <t> --paths <p>.
Open execution: 18101530 "Add order CSV export" (verified, not delivered)
```

ไม่ฉีดเนื้อหา `project.md` — agent อ่าน `project.md` เองเมื่อต้องใช้ fact

### 10.8 บทบาทใหม่ของ `project.md`

- เก็บ `## Facts` (ข้อเท็จจริงที่ใช้ซ้ำ ≤ 30 บรรทัด) และ `## Checkpoints` (release ตาม bootstrap §8) เท่านั้น
- ไม่ append งานที่เสร็จอีก (§8.5 ข้อ 2); เนื้อหา `## Completed work` เดิมคงไว้ ไม่ rewrite
- `references/memory-and-logs.md` ระบุบทบาทนี้

---

## 11. C8 — Hook automation และ guards

### 11.1 Matrix ของ hook

| Host | Event | Handler | Phase | หมายเหตุ |
| --- | --- | --- | --- | --- |
| Claude, Codex | `UserPromptSubmit` | `hook-context.mjs --mode task` (+ short reply §9.6, root warning §4.4) | P1 | generate จาก `providerHooks()` ใน `tools/sync-adapters.mjs` |
| Gemini/Antigravity | `BeforeAgent` | เหมือนกัน | P1 | แก้มือที่ root `hooks/hooks.json` |
| ทุก host | เหมือนข้างบน | + session digest §10.7 | P3 | |
| Claude | `PreToolUse` matcher `Bash\|PowerShell` | `git-guard.mjs --provider claude` | P4 | |
| Gemini/Antigravity | `BeforeTool` (shell tool) | `git-guard.mjs --provider gemini` | P4 | เปิดเฉพาะเมื่อยืนยันรูปแบบ input/output กับเอกสาร host แล้ว |
| Codex | pre-tool hook ถ้า host รองรับ | `git-guard.mjs --provider codex` | P4 | เปิดเฉพาะเมื่อ `agm-doctor check` ยืนยันว่า host รองรับ |
| Claude | `Stop` | `delivery-reminder.mjs` | P4 | |

`tools/validate-package.mjs` บรรทัด ~310–317 ตรวจชุด hook: เมื่อเพิ่ม event ใหม่ต้องแก้ validator ให้ตรวจ event ใหม่ด้วย (และยังคงบังคับ `--provider <host>`)

### 11.2 `git-guard.mjs` (P4)

อ่าน stdin JSON ของ host → ดึง command string (Claude: `tool_input.command`) → แยกทุก `git …` invocation (split ด้วย `&&`, `||`, `;`, `|`, newline) → ตัดสิน:

| Rule | Pattern | ผล |
| --- | --- | --- |
| G1 | `git push` ที่มี `--force`, `-f`, `--force-with-lease`, `--mirror`, หรือ refspec ขึ้นต้น `+` | deny |
| G2 | `git push` ไป protected branch (refspec `…:<protected>`, `origin <protected>`, หรือไม่มี refspec แต่ current branch เป็น protected) | deny — เว้นแต่ `runtime/active/<session>.json.operation === "release"` (release flow ใน project AGENTS สั่ง push develop/jenkins ตรง) |
| G3 | `git add -A`, `git add --all`, `git add .`, `git add -- .agrimap-agent` | deny (bootstrap §3, §9.5) |
| G4 | `git reset --hard`, `git clean -f…`, `git checkout -- .`, `git restore .` | ask |
| G5 | `git branch -D <protected>`, `git push … --delete <protected>`, `git tag -d`, `git push … --delete` ที่เป็น tag | deny |
| G6 | `git stash` (ทุก subcommand ยกเว้น `list`/`show`) | ask |

- Output Claude: `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny|ask","permissionDecisionReason":"AGM guard G2: push to protected branch develop. Use integrate plan/apply or the project release flow."}}`; allow = ไม่ output อะไร
- Script ของ package (`git-flow.mjs`) เรียก git ผ่าน `execFileSync` ไม่ผ่าน tool ของ agent จึงไม่โดน guard — guard คุมเฉพาะคำสั่งที่ agent พิมพ์เอง
- Fail-open: parse error/exception → allow และเขียน stderr หนึ่งบรรทัด (ไม่ block งานเพราะ guard พัง)
- โหลด protected list จาก policy ของ `gitTop(tool cwd)`; ไม่มี policy → ใช้ `["main","master","develop","jenkins","jenkins-release"]`

### 11.3 `delivery-reminder.mjs` (Claude `Stop`, P4)

- input `stop_hook_active === true` → allow (กัน loop)
- block เมื่อครบทุกข้อ: มี active execution; policy `commitOnComplete:true`; มี event `verified` passed; ไม่มี `delivered`; มี own dirty path; ยังไม่เคยเตือน execution นี้ (marker `runtime/reminders/<executionId>`)
- Output: `{"decision":"block","reason":"AGM: work is verified but not delivered. Run deliver plan/apply per workflow policy, or tell the user why delivery is skipped."}` แล้วเขียน marker

---

## 12. รายการไฟล์ที่ต้องแก้ทีละไฟล์

> Path ทั้งหมด relative กับ repo root. ไฟล์ใต้ `skills/agrimap-agent-skills/` คือ canonical; ห้ามแก้ mirror ใต้ `plugins/agrimap-agent-skills/**`, `commands/*.toml`, `skills/agm-*.md`, `references/operations/*.md` ด้วยมือ — ให้ `npm run sync` generate

### 12.1 Phase P1 (4.6.0)

| # | ไฟล์ | การเปลี่ยนแปลง |
| --- | --- | --- |
| 1 | `package.json` | `version` → `4.6.0` **ก่อน** `npm run sync` ครั้งแรก (เหตุผล §16.2); เพิ่ม test ใหม่ใน `scripts.test:unit` (§15) |
| 2 | `skills/agrimap-agent-skills/scripts/instruction-chain.mjs` (ใหม่) | export `resolveTargetRoots({sessionCwd, target, paths, hint, depth})`, `instructionChain(targetRoot, paths)`, `readRequired(targetRoot, session, chain)`, `acknowledge(targetRoot, session, sha12s)`, `findStrayStateRoots(sessionCwd, depth)`, `writeSessionPointer(session, targetRoots)` |
| 3 | `.../scripts/workflow-policy.mjs` (ใหม่) | export `PROFILES`, `POLICY_PATH`, `loadPolicy(root)`, `validatePolicy(policy)`, `inferPolicy(root, {run})`, `setPolicyValue(root, key, value, requestedBy)`, `initPolicy(root, profile, overrides, requestedBy)`, `isProtected(policy, branch)` |
| 4 | `.../scripts/decision-card.mjs` (ใหม่) | export `validateCard(card)`, `renderCard(card)`, `storeCard(state, session, card)`, `loadLastCard(state, session)`, `recordChoice(state, {session, cardId, choice, note, requestedBy})` |
| 5 | `.../scripts/git-flow.mjs` (ใหม่) | export `gitFacts(root, {run})`, `planBranch`, `applyBranch`, `planDelivery`, `applyDelivery`, `integrationOptions`, `planIntegration`, `applyIntegration`, `forgeOf(remoteUrl)`, `compareUrl(forge, remote, source, target)`; ทุกฟังก์ชันรับ `{run}` |
| 6 | `.../scripts/agm-workspace.mjs` | (a) dispatch `context`, `policy`, `decide`, `branch`, `deliver`, `integrate` ใน `switch (command)` บรรทัด ~2163 และแก้ข้อความ default (b) `start`: บันทึก `preexistingDirty` + warning ack (c) `appendLog`: path ต่อ execution (§8.5) (d) `updateProjectMemory`: flag `completedWorkInProjectMd` (e) `ensureLayout`: เพิ่ม `policy` ใน `directories` เมื่อ bootstrap, เพิ่ม `memory.completedWorkInProjectMd:false` และ `governance:{workflowPolicy:true, delivery:true, decisionMemory:false, guards:false, projectMode:true, specSync:false}` (สอง flag หลังเพิ่มใน V2) ใน `nextConfig` (คง key เดิมด้วย spread) (f) `checkpoint`/`complete`: รับ `--precedent` (g) ยอมรับ event `integrated` หลัง `completed` |
| 7 | `.../scripts/log-events.mjs` | `LOG_EVENTS` เพิ่ม `delivered`, `integrated`; `MILESTONE_TYPES` เพิ่ม `work-branch`, `delivery`, `integration` |
| 8 | `.../scripts/governance-policy.mjs` | เพิ่ม `resolveShortIntent`, `QUESTION_PATTERN`, `TARGET_ALIASES` (pure, ไม่มี effect) |
| 9 | `.../scripts/hook-context.mjs` | H1.1–H1.4 (§4.4) และ short reply (§9.6); import `resolveShortIntent`, `loadLastCard` |
| 10 | `.../scripts/sensitive-recording.mjs` | export `detectSensitive(text) → [{kind, line}]` ใช้ pattern ชุดเดียวกับ `redactText` |
| 11 | `.../scripts/identity.mjs` | export `identityKey` (ใช้ใน P3 แต่ export ตั้งแต่ P1 ได้) |
| 12 | `.../references/autonomy.md` (ใหม่) | ร่างใน Appendix D.1 (≤ 450 words) |
| 13 | `.../references/git-workflow.md` (ใหม่) | ร่างใน Appendix D.2 (≤ 650 words) |
| 14 | `.../references/elicitation.md` | ย่อหน้าแรกแทนด้วย "Use [autonomy.md](autonomy.md) to decide, ask or confirm." คงบรรทัดเรื่อง refactor mode, SQL target, prompt continuation, quoted keywords |
| 15 | `.../references/lifecycle-core.md` | ใต้ `## Durable work` เพิ่ม (net ≤ +40 words): "Before the first write in a repository run `agm-workspace.mjs context` and read/ack its AGENTS chain; never write state outside a Git root. Follow the confirmed workflow policy for branch and delivery (git-workflow.md)." — ตัดคำซ้ำในย่อหน้าเดิมเพื่อชดเชย · **V2: ใช้ประโยคใน §19.17 แทนประโยคนี้** (รวมเรื่อง project mode โดยไม่เพิ่มจำนวนคำ) |
| 16 | `.../references/goal-rules.md` | pre-write gate เพิ่มข้อ 7 (instruction chain ack) และข้อ 8 (work branch ตาม policy หรือเหตุผลที่ข้าม) |
| 17 | `.../references/memory-and-logs.md` | log ต่อ execution; `project.md` = facts + checkpoints; `policy/` เป็น team state; `cache/` เป็น derived |
| 18 | `.../references/qa-and-done.md` | เพิ่มหนึ่งประโยค: "Completion includes delivery when the confirmed workflow policy enables it; an undelivered verified change is reported with its exact paths." |
| 19 | `.../references/subagents-and-branches.md` | เพิ่มสองบรรทัดใต้ Workspace contract: host-created worktree branch ใช้ตาม `hostWorktreeBranch`; subagent ไม่ deliver/integrate เอง Leader เป็นผู้ทำ |
| 20 | `.../references/doctor-workflow.md` | แถว check `stray-state-roots` (§4.5) และ `workflow-policy` (มี/valid/confirmed) |
| 21 | `.../references/skill-registry.md` | เพิ่ม `agm:autonomy`, `agm:git-workflow` |
| 22 | `config/operations.json` | ตาราง §12.3 |
| 23 | `.../assets/templates/decision.md` | frontmatter v2 (§10.2) |
| 24 | `.../assets/bootstrap/AGENTS.md` | §13 |
| 25 | `.../assets/token-coverage-scenarios.json` | scenario ใหม่ §14.2 |
| 26 | `CHANGELOG.md` | entry `## 4.6.0 — <date>` |
| 27 | `docs/WORKFLOWS.md`, `docs/USAGE.md`, `docs/COMMAND-COOKBOOK.md` | user docs: policy file, short replies, delivery summary; mirror ผ่าน `npm run sync` |
| 28 | `tests/unit/*.test.mjs` (ใหม่) | §15 |

### 12.2 Phase P3 (4.8.0) และ P4 (4.9.0) — ไฟล์ของ P2 (4.7.0) อยู่ใน §19.15

| Phase | ไฟล์ | การเปลี่ยนแปลง |
| --- | --- | --- |
| P3 | `.../scripts/decision-memory.mjs` (ใหม่) | `parseFrontmatter`, `buildIndex`, `recall`, `recordSignal`, `promotable`, `calibration`, `writeDecision` |
| P3 | `.../scripts/decision-card.mjs` | ต่อ recall suppression + calibration + signals |
| P3 | `.../scripts/agm-workspace.mjs` | dispatch `recall`, `decide correction`, `decide list`; config `governance.decisionMemory:true` |
| P3 | `.../scripts/hook-context.mjs` | session digest §10.7 |
| P3 | `.../references/autonomy.md` | เพิ่มบรรทัด recall/promotion (ยังอยู่ใน ≤ 450 words) |
| P3 | `.../assets/bootstrap/AGENTS.md` + ไฟล์ใหม่ `AGENTS.release.md` | instruction diet §16.3 |
| P4 | `.../scripts/git-guard.mjs`, `.../scripts/delivery-reminder.mjs` (ใหม่) | §11.2, §11.3 |
| P4 | `tools/sync-adapters.mjs#providerHooks` | เพิ่ม `PreToolUse` (claude), `Stop` (claude), codex ตามผล doctor |
| P4 | `hooks/hooks.json` | `BeforeTool` ของ Gemini |
| P4 | `tools/validate-package.mjs` | ตรวจ hook ชุดใหม่ |

### 12.3 `config/operations.json`

| Operation | `references` เพิ่ม | `conditionalReferences` เพิ่ม |
| --- | --- | --- |
| `execute` | `autonomy.md` ("decide, ask or confirm; decision card format") | `git-workflow.md` when "the authorized work writes files in a Git repository"; `git-workflow.md` when "the request is a short integration reply (merge, pr, รวม or a card option) for a delivered work branch" |
| `fe`, `be`, `sql` | — | `autonomy.md` when "an action writes files or a requester decision is needed"; `git-workflow.md` when "the action writes product files in a Git repository" |
| `analyze`, `diagnose`, `plan`, `architect`, `qa`, `prompt`, `doctor` | — | `autonomy.md` when "you are about to ask the requester a question" |
| `release` | — | — (มี confirmation contract ของตัวเอง) |

`git-workflow.md` ต้องอยู่ใน `conditionalReferences` ของทุก operation ที่ scenario ใน §14.2 activate ไม่งั้น `routeCoverageIssues()` คืน `ROUTE_REFERENCE_MISSING`

---

## 13. ข้อความใหม่ใน bootstrap `AGENTS.md`

ไฟล์: `skills/agrimap-agent-skills/assets/bootstrap/AGENTS.md` — ส่วนนี้เป็น portable contract สำหรับ agent ที่ **ไม่มี** skill ด้วย จึงต้องมีขั้นตอน git ดิบกำกับเสมอ (V2 เพิ่ม §10.5 และ bullet ใน §9.1 — ข้อความอยู่ใน §19.16)

### 13.1 §2 ตาราง intent routing

- แถว `develop-complete` คอลัมน์ "สิ่งที่ห้าม" เปลี่ยนเป็น: `version, push protected branch, merge, deploy หากไม่ได้สั่ง; commit/push work branch ทำตาม §10`
- เพิ่มแถวก่อน `ambiguous`:

```markdown
| `integrate` | `merge`, `รวม`, `รวมเข้า <branch>`, `pr`, `เปิด PR`, เลขตัวเลือกจาก Next-step card | ทำตาม §10.4 กับ work branch ปัจจุบัน | promote `jenkins`/`jenkins-release`, tag, force push |
```

### 13.2 §9.1 allowlist

เพิ่มบรรทัด `  - \`.agrimap-agent/policy/**\`` ต่อจาก `memory/**`

### 13.3 §9.2 path

แทนบรรทัด log เป็น:

```markdown
  - log: `logs/YYYY-MM/YYYY-MM-DD/<RUN_ID>.jsonl` (ไฟล์รายวันแบบเดิม `logs/YYYY-MM/YYYY-MM-DD.jsonl` ยังอ่านได้ ห้ามย้ายหรือแก้)
```

### 13.4 §9.4 ข้อ 6

แทน "และหนึ่งบรรทัดสั้นใน `memory/project.md` เมื่อผลนั้น reusable ข้ามงาน" ด้วย "และเพิ่ม fact ใน `memory/project.md` `## Facts` เฉพาะเมื่อเป็นข้อเท็จจริงที่ใช้ซ้ำข้ามงาน (ไม่ใช่รายการงานที่เสร็จ)"

### 13.5 §9.5 bullet "หากไม่ได้สั่ง commit …"

แทนด้วย: "หาก policy §10 ไม่เปิด delivery และไม่ได้สั่ง commit ให้รายงาน exact modified/untracked paths เป็น local deliverables; กลุ่ม B ต้อง commit/push final audit artifacts ตาม §6.3"

### 13.6 §10 ใหม่ (วางก่อน `## Bootstrap contract freshness`)

```markdown
## 10. Team workflow: repository, work branch, delivery และ integration

### 10.1 Repository และ instruction chain

- Target repository คือ `git rev-parse --show-toplevel` ของไฟล์ที่จะแก้ ไม่ใช่ directory ที่เปิด session; ถ้า session อยู่นอก repo และมีหลาย repo ให้ถามว่าเป็น repo ไหนก่อนเขียน
- ก่อนเขียนครั้งแรกใน repository อ่าน `AGENTS.md` ทุกไฟล์ตั้งแต่ root ของ repo ขึ้นไปถึง root ของ drive และ `AGENTS.md` ใน subdirectory ที่มีไฟล์ที่จะแก้ ไฟล์ที่ใกล้ไฟล์เป้าหมายกว่ามีผลเหนือกว่าเมื่อขัดกัน
- ห้ามสร้าง `.agrimap-agent/` ใน directory ที่ไม่ใช่ root ของ Git repository

### 10.2 Policy

- `.agrimap-agent/policy/workflow.json` คือ workflow ของทีม (prefix/base/target ของ branch, delivery, integration) อ่านก่อนงานที่แก้ repository ทุกครั้ง
- ถ้าไม่มี: ตรวจ `Jenkinsfile*`, `git branch -a` และ remote แล้วเสนอ workflow ที่ตรวจพบเป็นคำถามเดียวพร้อมตัวเลือก ก่อนเขียนครั้งแรก เมื่อ owner ตอบ ให้สร้างไฟล์ `status: confirmed` และ decision record แล้วไม่ถามซ้ำ
- Policy ที่ confirmed เป็นสิทธิ์ถาวรให้ commit และ push **work branch** เมื่องานผ่าน verification เท่านั้น ไม่ใช่สิทธิ์ push/merge `develop`, `jenkins`, `jenkins-release`, `main` หรือสร้าง tag
- Repository ที่ promote `develop -> jenkins -> jenkins-release` แบบ `--ff-only` (§6.2): ทุก work type รวม hotfix แตกจาก `develop` และรวมกลับ `develop`

### 10.3 เริ่มงานและส่งงาน

1. ก่อนเขียน: บันทึก `git status --porcelain` ไว้เป็นรายการไฟล์ที่ค้างก่อนเริ่ม
2. ถ้าอยู่บน protected branch: `git fetch origin`, ถ้า tree สะอาดให้ `git merge --ff-only origin/<base>` แล้ว `git switch -c <prefix><english-kebab-slug>`; ถ้า tree ไม่สะอาดให้ `git switch -c` จาก HEAD เดิมโดยไม่ pull ห้าม stash/reset/สร้าง worktree
3. Branch ที่ host สร้างเอง (เช่น `claude/*`, `codex/*`) ไม่ต้องเปลี่ยนชื่อ local แต่ push ด้วยชื่อทีม: `git push -u origin HEAD:refs/heads/<prefix><slug>`
4. เมื่อ verification ผ่าน: เติม changelog ตาม §5, stage เฉพาะไฟล์ของงานนี้ด้วย `git add -- <paths>` (ห้ามรวมไฟล์ที่ค้างก่อนเริ่มโดยไม่ถาม), `git diff --cached --check`, commit แบบ Conventional Commits ภาษาอังกฤษ header ≤ 72 ตัวอักษร, push work branch แล้วตรวจ `git ls-remote --heads origin <branch>` ให้ SHA ตรง
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
```

(ประมาณ 45 บรรทัด ภาษาไทยตามที่ทีมใช้; English identifier ตาม §5.2)

---

## 14. Token budget

### 14.1 ค่าปัจจุบัน (`npm run audit:tokens`, 2026-09-18)

| Budget | Limit (words) | สูงสุดตอนนี้ | Headroom |
| --- | --- | --- | --- |
| direct | 1,320 | `release` 1,265 | 55 |
| required | 6,400 | `release` 5,935; `sql` 5,659; `be` 5,074; `fe` 4,560; `execute` 2,017 | 465 (release) |
| scenario | 9,200 (default) | `release-publication-sequence` 10,028 (มี budget เฉพาะ 10,120) | — |

### 14.2 แผน

| สิ่งที่เพิ่ม | กระทบ budget | จำนวน words | ผลหลังเพิ่ม |
| --- | --- | --- | --- |
| `lifecycle-core.md` +≤ 40 net | direct ทุก op | +40 | release 1,305 ≤ 1,320 |
| `goal-rules.md` ข้อ 7–8 | required ของ op ที่ map goal-rules | +≤ 50 | release ≤ 5,985 |
| `autonomy.md` ใน `execute.references` | required ของ execute | +≤ 450 | ≤ 2,467 |
| `autonomy.md`/`git-workflow.md` แบบ conditional | scenario | +≤ 1,100 | ต้องอยู่ใต้ 9,200 |

Scenario ใหม่ใน `assets/token-coverage-scenarios.json`:

| id | operation | depth | activate | mustLoad |
| --- | --- | --- | --- | --- |
| `execute-git-delivery-light` | execute | light | `git-workflow.md` | `goal-rules.md`, `recommendations.md`, `autonomy.md`, `git-workflow.md` |
| `execute-short-integration-light` | execute | light | `git-workflow.md` | `autonomy.md`, `git-workflow.md` |
| `fe-edit-git-delivery-light` | fe | light | `frontend-engineer.md`, `patterns/frontend.md`, `patterns/checklists/frontend-main.md`, `autonomy.md`, `git-workflow.md` | ทั้งหมดใน activate |
| `sql-edit-git-delivery-light` | sql | light | `patterns/sql.md`, `autonomy.md`, `git-workflow.md` | ทั้งหมดใน activate |
| `analyze-question-autonomy-light` | analyze | light | `autonomy.md` | `autonomy.md` |

กติกา: ถ้า `npm run audit:tokens:strict` ไม่ผ่าน ให้ **ตัด prose** ก่อน ห้ามเพิ่ม direct/required budget; การเพิ่ม scenario budget ต้องมีเหตุผลใน `description` ของ scenario และบรรทัดใน CHANGELOG (แบบเดียวกับ 4.5.5)

### 14.3 ค่า runtime ต่อ session (เป้าหมาย)

| แหล่ง | ก่อน | หลัง |
| --- | --- | --- |
| hook context ต่อ prompt ที่ active | ~8 บรรทัด (~120 tokens) | เท่าเดิม + short-reply 1 บรรทัดเมื่อเกี่ยวข้อง |
| memory injection | 0 (ไม่เคยใช้) | digest ≤ 600 chars ครั้งเดียว/เมื่อเปลี่ยน (P3) |
| recall | — | ≤ 2,000 chars ต่อ decision point (P3) |
| bootstrap `AGENTS.md` ที่ host โหลด | ~32k tokens ทุก session | P1 +~1.5k; P3 ลดเหลือ core ≤ 8k (§16.3) |

---

## 15. Tests

### 15.1 Fixture กลาง: `tests/helpers/git-fixture.mjs` (ใหม่)

```js
export async function createGitFixture(h, { branches = ["develop"], jenkins = false, files = {} } = {})
// 1. git init --bare <temp>/remote.git
// 2. git init <temp>/repo ; git -C repo config user.name "AGM Test" ; git -C repo config user.email "agm@test.local"
// 3. git -C repo config commit.gpgsign false ; core.autocrlf false
// 4. เขียน files (+ Jenkinsfile/Jenkinsfile_Production ถ้า jenkins) → commit "chore: init" บน main
// 5. git remote add origin ../remote.git ; push main ; สร้างและ push แต่ละ branch ใน branches
// return { repo, remote, git(args) }
```

ทุก test ใช้ `createHarness()` เดิม (temp dir) และ stub `run` สำหรับ `gh`/`glab`; ห้ามเรียก network จริง

### 15.2 รายการ test (P1)

**`tests/unit/instruction-chain.test.mjs`**
1. session cwd ที่ไม่ใช่ git มีสอง repo ลูก → `resolved:false` + card `root`; `--hint` ชื่อ repo ที่สองทำให้เป็นข้อ 1
2. `--paths` ชี้ไฟล์ใน repo ลูก → resolve ได้ root เดียว
3. chain เรียง outer → inner, `sha12` ถูก, `maintainerOnly` จับ marker ได้, `CLAUDE.md` ที่มีแค่ `@AGENTS.md` เป็น `pointerOnly`
4. `--ack` แล้ว `readRequired` ว่าง; แก้ `AGENTS.md` หนึ่ง byte → กลับมา required
5. `context` ไม่มี `--ack` ไม่สร้างไฟล์ใดเลย (snapshot directory ก่อน/หลังเท่ากัน)
6. `--ack` ใน cwd ที่ไม่ใช่ git โดยไม่มี `--target` → error และไม่สร้าง `.agrimap-agent` ที่ cwd
7. `strayStateRoots` รายงาน `.agrimap-agent` ใน parent ที่ไม่ใช่ git

**`tests/unit/workflow-policy.test.mjs`**
1. สาม profile ผ่าน `validatePolicy`
2. agrimap-jenkins + hotfix base `jenkins-release` → `POLICY_HOTFIX_BASE_BREAKS_FF_PROMOTION`
3. `commitOnComplete:false, pushOnComplete:true` → invalid (V5)
4. infer: Jenkinsfiles + `origin/jenkins` → agrimap-jenkins confidence high; develop+main → gitflow; main อย่างเดียว → trunk; ไม่มี remote → low
5. infer นับ prefix `feature/` 3 branch → ใช้ใน proposal
6. `setPolicyValue` เก็บ key ที่ไม่รู้จักไว้ และปฏิเสธค่าที่ทำให้ invalid โดยไม่เขียนไฟล์

**`tests/unit/decision-card.test.mjs`**
1. validation ทุกข้อใน §5.7 (options 1 ข้อ, 5 ข้อ, recommended ไม่อยู่ใน options, R3 มี default)
2. render ย้ายข้อแนะนำเป็นข้อ 1 และมี "(แนะนำ)"
3. `storeCard` + `resolveShortIntent("2", {lastCard})` → option 2; "ข้อ 2" และ "option 2" ได้ผลเดียวกัน; card หมดอายุ → `none`
4. `recordChoice` กับ `policy:branching.workTypes.hotfix.base` เขียน policy และ decision; `none` เขียนเฉพาะ log

**`tests/unit/short-intent.test.mjs`** (table-driven อย่างน้อย 30 กรณี)
- action: `merge`, `Merge ครับ`, `รวมเลย`, `รวมเข้า dev` (target develop), `ผ่านแล้ว รวมได้`, `LGTM`, `pr`, `เปิด PR`, `ส่งรีวิว`, `อัปเดต branch`, `sync กับ develop`, `แก้ต่อ`, `พักไว้`, `ทิ้ง branch`, `merge เมื่อ CI ผ่าน` (whenGreen)
- ไม่ใช่ action: `merge ยังไง`, `ควร merge ไหม?`, `"merge"` (quoted), ข้อความยาว > 60 ตัวอักษร, `1` เมื่อไม่มี lastCard
- `รวมเข้า jenkins` → `TARGET_IS_RELEASE_FLOW`

**`tests/unit/git-flow.test.mjs`** (ใช้ git fixture)
1. อยู่บน develop สะอาด → plan `create` → apply → อยู่บน `feature/<slug>` และ `baseSha` = origin/develop
2. develop dirty → `create-carry` + warning; ไฟล์ dirty ยังอยู่; `preexistingDirty` บันทึกไว้ (จาก `start`)
3. branch `claude/abc` ไม่มี upstream + `push-as-team-name` → `remoteBranch = feature/<slug>`; `rename` → `git branch -m`
4. ชื่อซ้ำ → suffix `-2`
5. `PLAN_STALE` เมื่อแก้ไฟล์ระหว่าง plan กับ apply
6. deliver: own ถูก stage, foreign ไม่ถูก stage, mixed → card, `.agrimap-agent/runtime/**` ไม่ถูก stage
7. deliver บน develop → `PROTECTED_BRANCH`; verification ไม่ผ่าน → deliver ได้พร้อม warning `DELIVERED_UNVERIFIED` + trailer `AGM-Verification: failed` และ `integrate options` ไม่มี merge เป็นข้อ 1; ไม่ ack → `INSTRUCTIONS_NOT_ACKNOWLEDGED`
8. ไฟล์มี `password=...` ที่ `detectSensitive` จับได้ → `SECRET_SUSPECTED` และข้อความ error ไม่มีค่าจริง
9. มี `changelog.md` แต่ไม่แก้ → `CHANGELOG_REQUIRED`; `--changelog-na` → ผ่าน
10. apply: commit header ตรง regex, มี trailer `AGM-Execution`, push แล้ว `ls-remote` ตรง HEAD; รันซ้ำเป็น no-op
11. remote ahead → `REMOTE_AHEAD`
12. local-merge merge-commit: `origin/develop` ได้ merge commit ที่ parent = [develop เดิม, branch] และ tree = branch tree; local develop ไม่ถูก checkout
13. local-merge เมื่อ develop ขยับ (commit ใหม่ใน remote) → ขั้น A merge เข้า branch ก่อน แล้วผลถูกต้อง
14. conflict → `MERGE_CONFLICT` + รายชื่อ path + `git merge --abort` แล้ว (ไม่มี MERGE_HEAD ค้าง)
15. push target ถูก reject (สร้าง commit ใน remote ระหว่าง plan/apply) → `REMOTE_TARGET_ADVANCED`, local ไม่เปลี่ยน
16. open-pr ไม่มี gh → `manual-pr` + compare URL ถูกทั้ง GitHub (`https`, `git@`) และ GitLab
17. open-pr/integrate กับ stub gh: `CLEAN` → เรียก `gh pr merge <n> --merge`; `BLOCKED` → `PR_BLOCKED` ไม่เรียก merge; pending + ไม่มี whenGreen → card; ไม่มีการเรียก `--admin` ในทุกกรณี

**`tests/unit/v3-governance.test.mjs` (เพิ่ม)**
1. hook ใน cwd ที่ไม่ใช่ git: ไม่มี `.agrimap-agent` ถูกสร้าง, context มีบรรทัด "outside any Git repository"
2. hook รับ prompt `1` ขณะมี `lastCard` → inject "selects option 1"; ไม่มี lastCard → เงียบ
3. hook รับ `merge ยังไง` → inject question guard ไม่ใช่ integrate
4. `complete` ไม่ append `## Completed work` เมื่อ config ใหม่; config เดิมที่ตั้ง `completedWorkInProjectMd:true` ยัง append
5. log ใหม่อยู่ที่ `logs/YYYY-MM/YYYY-MM-DD/<id>.jsonl`; `history` อ่านได้ทั้งไฟล์ใหม่และไฟล์รายวันเดิม
6. event `integrated` หลัง `completed` ผ่าน validation

**`tests/unit/bootstrap-contract.test.mjs` (เพิ่ม)**
- template มี `## 10. Team workflow`, allowlist มี `policy/**`, log path ใหม่, และ manifest มี `previous` hash ของ 4.5.5

เพิ่มไฟล์ใหม่ทั้งหมดใน `package.json` `scripts.test:unit` (รายการ explicit)

### 15.3 P3 / P4 (test ของ P2 อยู่ใน §19.19)

- `decision-memory.test.mjs`: frontmatter parser (comment ท้ายค่า, array, null), index rebuild ตาม mtime, scoring/threshold, glob, output ≤ 2,000 chars, suppression, promotion หลัง 2 ครั้ง, `declinedPromotion`, calibration thresholds, `alwaysAsk` override
- hook digest: ครั้งแรกมี ≤ 600 chars, prompt ถัดไปไม่มี, เปลี่ยน branch แล้วมีใหม่
- `git-guard.test.mjs`: ทุก rule G1–G6 ทั้ง Bash และ PowerShell syntax, release exception, fail-open
- `delivery-reminder.test.mjs`: block ครั้งเดียว, `stop_hook_active` ไม่ block

---

## 16. Rollout, migration, feature flags

### 16.1 Phase

| Phase | Version | เนื้อหา | Dependency |
| --- | --- | --- | --- |
| P1 | 4.6.0 | C1, C2 (card ไม่มี recall), C3, C4, C5 (+ log ต่อ execution, หยุด append project.md), C6, hook short-reply + root fix, bootstrap §10; **V2: C9 ส่วน A** — `project.json`, infer + card development mode, local memory + gitignore, spec location resolution ใน `context`, `LOCAL_PATH_LEAK`, bootstrap §10.5, `spec-driven.md` ส่วน Locations/Standing instructions | — |
| P2 | 4.7.0 | **V2: C9 ส่วน B** — spec adapters, `spec context`/`sync`/`check`, `SPEC_NOT_SYNCED` (self-fix → warn), pre-write gate ข้อ 9 | P1 (card/signal/`context` มาจาก P1) |
| P3 | 4.8.0 | C7 ทั้งหมด, digest, instruction diet (§16.3) | P1 (card/signal มาจาก P1) |
| P4 | 4.9.0 | guards + Stop reminder หลังยืนยัน host support | P1 policy |

แต่ละ phase ทำบน `feature/<name>` จาก `develop` ตาม `DEVELOPMENT.md` แล้ว PR เข้า develop

### 16.2 ลำดับที่ต้องทำใน P1 (กัน pitfall ของ bootstrap manifest)

1. แตก branch `feature/agent-collaboration-governance-4.6.0` จาก `develop`
2. แก้ `package.json` version เป็น `4.6.0` **ก่อน** รัน `npm run sync` — `tools/sync-adapters.mjs` บรรทัด 48–56 บันทึก hash เดิมลง `manifest.files[].previous` **เฉพาะเมื่อ** `manifest.version !== packageVersion`; ถ้า sync ขณะยังเป็น 4.5.5 หลังแก้ template, hash ของ 4.5.5 จะหายไป และ project ที่ใช้ template 4.5.5 จะถูกมองว่า "modified" จน auto-upgrade ไม่ทำงาน
3. เขียน script + test (§12, §15) → `npm run test:unit` ผ่าน
4. แก้ references, `config/operations.json`, bootstrap template, scenarios
5. `npm run sync` ครั้งเดียว → ตรวจ `git diff -- skills/agrimap-agent-skills/assets/bootstrap/manifest.json` ว่ามี `previous: [{version:"4.5.5", sha256:…}]` ของ `AGENTS.md`
6. `npm test`, `npm run test:release`, `npm run audit:tokens:strict`, `npm run package:build`
7. CHANGELOG 4.6.0 แล้ว PR

### 16.3 Instruction diet (P3)

- ย้าย §2 (ตาราง release ยกเว้นแถว `integrate`), §4–§8 และ §9.x ที่เป็น release-only ของ bootstrap `AGENTS.md` ไปไฟล์ใหม่ `AGENTS.release.md` (bootstrap ติดตั้งเพิ่ม; host ไม่โหลดอัตโนมัติเพราะไม่ใช่ชื่อมาตรฐาน)
- `AGENTS.md` core คง §1, §3 (safety invariants), §9 (recording), §10 และบรรทัดเดียว: "งาน release/version/deploy/backfill ทุก intent ใน `AGENTS.release.md`: อ่านทั้งไฟล์ก่อนเริ่ม"
- เป้าหมาย core ≤ 8k tokens; ต้องเพิ่ม entry ใน `assets/bootstrap/manifest.json` และทดสอบ upgrade จาก template 4.6.0 ที่ไม่ได้แก้ (auto) และที่แก้ (scoped merge)
- `references/release-and-bootstrap.md` และ `release-workflow.md` ชี้ `AGENTS.release.md` แทน

### 16.4 Migration ของ project เดิม

| สิ่งเดิม | หลัง 4.6.0 |
| --- | --- |
| template `AGENTS.md` 4.5.5 ที่ไม่ได้แก้ | freshness check อัปเดตอัตโนมัติพร้อม backup (กลไกเดิม) |
| template ที่ทีมแก้เอง | scoped merge ตามกลไกเดิม; §10 เป็นส่วนใหม่ทั้งก้อนจึง merge ง่าย |
| ไม่มี policy | งาน durable แรกถาม card เดียว (§6.4) |
| `logs/YYYY-MM/YYYY-MM-DD.jsonl` เดิม | อ่านได้ ไม่ย้าย ไม่แก้ |
| `## Completed work` ใน `project.md` | คงไว้ ไม่ rewrite |
| `decisions/*.md` รุ่นเก่า | index ได้ด้วย default (§10.2) |
| `AgriMapPlatform/.agrimap-agent` (stray) | doctor รายงาน; ผู้ใช้ตัดสินเอง |
| (V2) `.agrimap-agent/.gitignore` เดิมที่มีแค่ `runtime/`, `cache/` | `ensureLayout` append `local/` ครั้งแรกที่ runtime ทำงาน (idempotent) |
| (V2) project ที่ยังไม่มี `project.json` | งาน durable แรก: infer → High = `inferred` + แจ้งบรรทัดเดียว; ไม่มั่นใจ = card ก่อนเริ่ม (§19.6) |
| (V2) spec pack นอก git ที่ใช้อยู่ | ย้ายเข้า Git repo ของตัวเองตาม §19.21 (Q8); ระหว่างยังไม่ย้าย อ้างด้วย id ใน `project.json` และทุก delivery มี warning `SPEC_SOURCE_NOT_GIT`; หลังย้าย ทุกเครื่องได้ path จาก discovery หรือ clone ครั้งแรกแล้วจำใน local memory |

### 16.5 Feature flags (`.agrimap-agent/config.json` → `governance`)

| Flag | Default P1 | ผลเมื่อ false |
| --- | --- | --- |
| `workflowPolicy` | true | ไม่ถาม policy, ไม่แตก branch (พฤติกรรม 4.5.5) |
| `delivery` | true | ไม่ deliver อัตโนมัติแม้ policy เปิด |
| `decisionMemory` | false (P3 → true) | `decide card` ไม่ recall/calibrate |
| `guards` | false (P4 → true) | ไม่ติดตั้ง/ข้าม guard hook |
| `projectMode` (V2) | true | ไม่ infer/ถามโหมด; ถือเป็น `code-first` เสมอ |
| `specSync` (V2) | false (P2 → true) | ไม่มี Spec Read/Sync Gate และ `deliver` ไม่ตรวจ `SPEC_NOT_SYNCED` |

Script ทุกตัวอ่าน flag ก่อนทำงาน (kill switch ต่อ project โดยไม่ต้อง downgrade package)

---

## 17. Acceptance criteria

| ID | Phase | เกณฑ์ | วิธีพิสูจน์ |
| --- | --- | --- | --- |
| AC1 | P1 | session ที่ parent ไม่ใช่ git มีสอง repo: งาน durable แรกได้ root card, ไม่มี `.agrimap-agent` ที่ parent | test instruction-chain 1, 6 + hook test 1 |
| AC2 | P1 | project ที่ไม่มี policy: ถาม policy หนึ่งครั้งในงานแรก และศูนย์ครั้งในงานที่สอง | flow A.1 + test policy |
| AC3 | P1 | งานเริ่มบน develop จบด้วย commit บน `feature/<slug>` ที่ push และ remote ตรง; develop local/remote ไม่เปลี่ยน | git-flow 1, 10 |
| AC4 | P1 | ไฟล์ที่ค้างก่อนเริ่มงานไม่อยู่ใน delivery commit | git-flow 6 |
| AC5 | P1 | หลัง delivery ตอบ `1` หรือ `merge` → integration ทำงานโดยไม่ถามเพิ่ม เมื่อ target ชัดและ check ผ่าน | hook test 2 + git-flow 12/17 |
| AC6 | P1 | `merge ยังไง` ไม่ทำให้เกิด git action | short-intent + hook test 3 |
| AC7 | P1 | สอง feature branch ส่งงานวันเดียวกันแล้ว merge เข้า develop ไม่มี conflict ใน `.agrimap-agent/` | test เพิ่ม: สอง branch → local-merge ทั้งคู่ |
| AC8 | P1 | ไม่มี force push, ไม่มี `git add -A/.`, ไม่มี checkout protected branch ใน script ใดๆ | grep test ใน `git-flow.test.mjs` บน source ของ script |
| AC9 | P1 | test เดิมทั้งหมด + ใหม่ผ่าน; `audit:tokens:strict` ผ่านโดย direct/required budget ไม่เปลี่ยน | CI |
| AC10 | P3 | card ที่มี precedent ตรงถูก suppress (0 คำถาม) และ id ของ precedent อยู่ใน audit event | decision-memory test |
| AC11 | P3 | digest ≤ 600 chars ครั้งเดียวต่อ session เว้นแต่ hash เปลี่ยน | hook digest test |
| AC12 | P3 | เลือกค่าเดิมสองครั้ง → มี promotion card หนึ่งครั้ง; ตอบ "ไม่ต้อง" แล้วไม่ถามอีก | decision-memory test |
| AC13 | P4 | agent พิมพ์ `git push origin develop` เองนอก release → ถูก deny พร้อมเหตุผล; ใน release execution → allow | git-guard test |
| AC14–AC20 | P1/P2 | (V2) development mode, local memory และ spec sync | §19.20 |

---

## 18. Decisions ใน spec นี้ และคำถามที่ owner ต้องตอบ

### 18.1 Decisions (พร้อมเหตุผล)

| ID | Decision | เหตุผล |
| --- | --- | --- |
| D1 | Policy เป็น JSON ใน `.agrimap-agent/policy/` | ไม่มี dependency, สอดคล้อง `config.json`, แยกจาก runtime ที่ถูก ignore |
| D2 | Policy เป็นของทีมและ commit; preference ส่วนตัวอยู่ `runtime/` | workflow ต้องเหมือนกันทุกคน; ความชอบส่วนตัวไม่ควรเข้า git |
| D3 | Standing authorization ครอบคลุมเฉพาะ work branch | push work branch ย้อนได้และไม่กระทบคนอื่น; protected branch ต้องมีคำสั่งตรง |
| D4 | agrimap-jenkins: hotfix แตกจาก develop | promotion เป็น `--ff-only` จาก develop; hotfix จาก `jenkins-release` ทำให้ diverge |
| D5 | Default `merge-commit`, update ด้วย merge, ไม่มี rebase/force | สอดคล้อง bootstrap §3 ที่ห้าม force/history rewrite |
| D6 | บังคับ gate ที่ deliver/integrate ไม่ใช่ที่ start | ไม่ขวางการอ่าน/วิเคราะห์ แต่กันผล durable |
| D7 | Local-merge ใช้ `commit-tree` + push atomic | ไม่ checkout protected branch, ไม่ต้อง reset เมื่อ push ถูก reject |
| D8 | Log ต่อ execution และหยุด append `project.md` | ตัดต้นเหตุ conflict ข้าม branch; reader recursive อยู่แล้ว |
| D9 | Host worktree branch: push ด้วยชื่อทีม ไม่ rename local | ไม่รบกวน host ที่อาจอ้างชื่อ branch; remote (ที่ทีมเห็น) ตรง convention |
| D10 | Script ไม่รันคำสั่ง shell จาก policy | คำสั่ง verify ให้ agent รันผ่าน tool ของ host ที่ผู้ใช้เห็นและอนุมัติได้ |
| D11 | Memory แบบ pull ณ decision point + calibration เฉพาะ R1 | ประหยัด token และไม่ให้การเรียนรู้ขยายไปถึง contract/outward |
| D12 | Guards เป็น P4 หลังยืนยัน host | รูปแบบ hook ของแต่ละ host ต่างกัน; enforcement หลักอยู่ใน script แล้ว |
| D13 (V2) | โหมดอยู่ใน `policy/project.json` แยกจาก `workflow.json` | source of truth กับ git workflow เป็นคนละเรื่องและเปลี่ยนคนละจังหวะ |
| D14 (V2) | infer High → บันทึก `inferred` และแจ้ง ไม่ถาม; Medium/Low → ถามก่อนเริ่ม | ตามที่ผู้ใช้ต้องการ (ไม่มั่นใจค่อยถาม) และตาม matrix C2 (R2 + High = ตัดสิน + อ้างหลักฐาน) |
| D15 (V2) | Local memory เป็น Markdown ใน `.agrimap-agent/local/` ไม่ใช่ `runtime/` | คนแก้ด้วยมือได้ แยกชัดจาก state ที่ script สร้าง; ignore ด้วย `.agrimap-agent/.gitignore` จึงไม่ต้องแตะ `.gitignore` ของ repo |
| D16 (V2) | External spec อ้างด้วย id + fingerprint; ค้นหาแบบ bounded เท่านั้น | แก้ path ต่างเครื่องโดยไม่ commit absolute path และไม่เปลือง token ค้นทั้ง disk |
| D17 (V2) | Script ทำส่วน mechanical ของ spec sync (status, evidence, changelog, manifest); Agent ทำส่วนเนื้อหา (requirement/AC) | ตามหลัก script คำนวณกลไก Agent ตัดสินความหมาย; ลดความผิดพลาดของการแก้ YAML/manifest ด้วยมือ |
| D18 (V2) | ไม่เพิ่ม npm dependency สำหรับ YAML | runtime ติดตั้งเป็น plugin โดยไม่มี `npm install`; ใช้ line-subset reader และ degrade เมื่อ parse ไม่ได้ |
| D19 (V2.1) | หยุดเฉพาะ `stop`; ที่เหลือ self-fix หรือ warn | ตาม Q9: งานต้องไปต่อได้ แต่ warning ต้องเห็นชัดใน summary, log, PR body และ session ถัดไป |
| D20 (V2.1) | verification fail ยัง push work branch ได้ | work branch ย้อนได้และไม่กระทบคนอื่น; gate คุณภาพย้ายไปอยู่ที่ integration (ไม่เสนอ merge) |
| D21 (V2.1) | ตัด ownership ของ spec ใช้ชนิดการแก้ + คำสั่งแทน | ตาม Q10: บทบาทอาจเป็นคนเดียวกัน; สิ่งที่ตัดสินได้จริงคือ "ผู้ใช้สั่งเปลี่ยน behavior นี้หรือไม่" |
| D22 (V2.1) | spec pack เป็น Git repo แยก | ตาม Q8 และเพราะหลาย repo (FE/BE/desktop) ใช้ pack เดียวกัน |

### 18.2 คำถามที่ owner ต้องตอบก่อน/ระหว่าง P1

| ID | คำถาม | ตัวเลือก | ข้อแนะนำ |
| --- | --- | --- | --- |
| Q1 | Product repo บน GitLab ใช้ integration แบบไหนเป็น default | MR ผ่าน `glab` / local-merge / แค่ compare URL | MR ถ้าทีมติดตั้ง `glab`; ไม่งั้น compare URL (ปลอดภัยกว่า local-merge เมื่อ server protect develop) |
| Q2 | Audit artifact ของงานรวมใน commit เดียวกับ code ไหม | same-commit / separate-commit / ไม่ commit | same-commit (review เห็นบริบทครบ, log ต่อ execution ไม่ conflict แล้ว) |
| Q3 | Merge strategy เข้า develop | merge-commit / squash | merge-commit (รักษา `AGM-Execution` trailer ทุก commit) |
| Q4 | ชื่อ branch มี ticket ID ไหม | ไม่มี / มี pattern `<KEY>-\d+` | ไม่มีเป็น default; เปิดผ่าน `slug.ticketPattern` ต่อ project |
| Q5 | Repo นี้ (skill package) ใช้ policy ด้วยไหม | ใช้ profile `gitflow` + ปรับ `DEVELOPMENT.md` / คงกติกาเดิม | ใช้ — `DEVELOPMENT.md` ตอนนี้ห้าม commit โดยไม่สั่ง จึงต้องแก้คู่กัน |
| Q6 | ทำ instruction diet (§16.3) ใน P3 หรือเร็วกว่า | P1 / P3 | P3 — แยกความเสี่ยงของ upgrade template ออกจาก P1 |
### 18.3 คำถามที่ owner ตอบแล้ว (V2.1)

| ID | คำตอบ | ผลใน spec |
| --- | --- | --- |
| Q7 | แยก spec sync ออกมาก่อนตามข้อแนะนำ | P2 = 4.7.0 C9-B, P3 = 4.8.0 C7 + digest + diet, P4 = 4.9.0 guards (§16.1) |
| Q8 | ย้าย spec pack เข้า Git | Git repo แยกของ pack; ขั้นตอนใน §19.21; ระหว่างยังไม่ย้ายมี warning `SPEC_SOURCE_NOT_GIT`; เครื่องใหม่ clone ได้จาก card (§19.5) |
| Q9 | ออกแบบ status เอง แต่ไม่ block — ไปต่อได้พร้อม warning ชัด | severity model §2.4 (stop/self-fix/warn) + Warning contract; task status แบบ semantic + ใช้คำที่ไฟล์ใช้อยู่ (§19.7.1); `specs.enforcement` default `warn`; verification fail ยัง deliver work branch ได้ (`DELIVERED_UNVERIFIED`) แต่ไม่เสนอ merge |
| Q10 | ไม่แยก ownership — DEV/BA/QA อาจเป็นคนเดียวกัน ให้ดูเนื้องานและคำสั่ง ไม่มั่นใจให้ถาม | ลบ `ownership` ออกจาก schema; กติกา §19.8.1 (mechanical ทำเอง, semantic ตามคำสั่ง, ที่งานเผยออกมาหรือไม่มั่นใจ → card R2) |


---

## 19. C9 — Project development mode, spec sync และ local memory (ใหม่ใน V2)

### 19.1 ปัญหาและหลักฐาน

| # | อาการ | หลักฐาน | ผลกระทบ |
| --- | --- | --- | --- |
| 7 | project แบบ AI-First (ยึด markdown spec) ต้องคอยสั่ง "เช็ค spec แล้วอัปเดต" ทุกรอบ | skill 4.5.5 ไม่มีแนวคิด development mode หรือ spec เลย (`grep -i "spec-first\|spec-driven\|source of truth" references/*.md` ไม่พบ); spec pack จริง `AgriMapPlatform/agrimap-plus-operations-console-spec-v1.0.0/` มี `06-agent/TASKS.yaml` (`schema: task-manifest@1`, 55 task `status: planned`, 2 task `status: delivered`), `TRACEABILITY.md` เขียนว่า "Agent must expand this matrix with concrete test evidence or links during implementation" และ `manifest.sha256` ที่ต้องตรงกับไฟล์ — ไม่มีกลไกใดอัปเดตสิ่งเหล่านี้ให้อัตโนมัติ | spec drift จาก code; มนุษย์ต้องเป็นคนเตือนทุกครั้ง |
| 8 | Agent หา path ของ spec เองทุก session และ path ไม่ตรงกันระหว่างเครื่องของนักพัฒนา | spec pack อยู่ **นอก git** (`git rev-parse` fail) และอยู่คนละระดับกับ repo ที่ implement (เช่น `apps/web/agmwa-license-management-ng` อยู่ลึกกว่า 3 ระดับ); ไม่มีที่เก็บ path ต่อเครื่อง | เปลือง token กับ `Get-ChildItem`/`rg`, เจอผิดที่, หรือ commit absolute path ของเครื่องหนึ่งลง repo |
| 9 | project เก่าที่เอามาพัฒนาต่อด้วย AI (Not AI-First) ถูกปฏิบัติแบบเดียวกับ project ที่เกิดจาก spec | ไม่มีการแยก source of truth | Agent อาจแก้เอกสารที่ไม่มีใครดูแล หรือกลับกัน ไม่ยึด spec ใน project ที่ควรยึด |

### 19.2 โหมดการพัฒนา

| Mode | ชื่อที่ทีมเรียก | Source of truth (เรียงความสำคัญ) | พฤติกรรม Agent |
| --- | --- | --- | --- |
| `code-first` | Not AI-First (ของเดิมเอามาพัฒนาต่อ) | tests → code → DB schema (sql-context read-only) → เอกสาร | อ่าน code เป็นหลัก; ก่อนเปลี่ยน behavior ของ code เดิมที่ไม่มี test ให้เขียน characterization test ถ้ามี harness; **ไม่แก้ spec/เอกสารเอง** นอกจาก changelog/README ตาม project AGENTS; เจอเอกสารขัด code ให้บอกหนึ่งบรรทัดใน summary |
| `spec-first` | AI-First (Base on markdown spec) | spec ที่ confirmed → tests → code | Spec Read Gate ก่อนเขียน (§19.8) → implement → Spec Sync Gate ก่อน deliver (§19.9) **อัตโนมัติทุกงาน** |
| `hybrid` | ของเดิม + งานใหม่ทำจาก spec | spec สำหรับ path ใน `specs.scopes`, code สำหรับที่เหลือ | ใช้พฤติกรรม spec-first เมื่อไฟล์ที่แก้อยู่ใน scope; code-first นอก scope; งานใหม่ที่ยังไม่มี scope ทำตาม `hybrid.newWork` |

หลัก "สั่งครั้งเดียวพอ": ถ้าผู้ใช้สั่งให้ตรวจ/อัปเดต spec **หนึ่งครั้ง** Agent ต้องทำให้กลายเป็นกติกาถาวร (§19.10) ไม่ใช่ทำครั้งเดียวแล้วลืม

### 19.3 `.agrimap-agent/policy/project.json` (committed, ของทีม)

แยกจาก `workflow.json` เพราะคนละเรื่อง (git workflow กับ source of truth) และแก้คนละจังหวะ

```json
{
  "schemaVersion": 1,
  "status": "confirmed",
  "developmentMode": "spec-first",
  "confirmedBy": "orchex006",
  "confirmedAt": "2026-09-18",
  "decisionRef": "decisions/2026-09/18103012-development-mode.md",
  "inference": null,
  "specs": {
    "sources": [
      {
        "id": "agrimap-plus-operations-console",
        "kind": "external",
        "format": "morynth-context-index@1",
        "version": "1.0.0",
        "fingerprint": { "file": "06-agent/CONTEXT-INDEX.yaml", "contains": "id: agrimap-plus-operations-console" },
        "remote": "<URL ของ spec repo หลังย้ายเข้า Git — §19.21>",
        "statusMap": null
      },
      {
        "id": "repo-docs",
        "kind": "repo",
        "path": "docs/specs",
        "format": "generic-markdown"
      }
    ],
    "scopes": [
      { "source": "agrimap-plus-operations-console", "covers": ["src/app/features/license-management/**"] }
    ],
    "sync": "auto",
    "enforcement": "warn"
  },
  "hybrid": { "newWork": "spec-first" }
}
```

| Field | ค่าได้ | Default | หมายเหตุ |
| --- | --- | --- | --- |
| `status` | `inferred\|confirmed` | — | `inferred` = Agent ตรวจพบด้วย confidence สูงแล้วบอกผู้ใช้ แต่ยังไม่ได้ยืนยัน; เปลี่ยนเป็น `confirmed` เมื่อผู้ใช้ตอบรับหรือไม่คัดค้านใน 3 งาน (ดูข้อ 19.6) |
| `developmentMode` | `code-first\|spec-first\|hybrid` | จาก infer | |
| `inference` | object หรือ `null` | — | `{confidence, evidence[], at}` เมื่อ `status:"inferred"` |
| `specs.sources[].kind` | `repo\|external` | — | `repo` ใช้ `path` relative กับ repo root; `external` **ห้ามมี path** — path จริงอยู่ใน local memory |
| `specs.sources[].format` | `generic-markdown\|morynth-context-index@1` | `generic-markdown` | adapter §19.7; format อื่น (spec-kit, kiro, openspec) ตรวจจับได้แต่ใช้ generic + warning |
| `specs.sources[].fingerprint` | `{file, contains}` | จาก init | ใช้ยืนยันว่า path ในเครื่องคือ spec ตัวเดียวกัน |
| `specs.sources[].remote` | git URL หรือ `null` | URL ของ spec repo (Q8) | ใช้ยืนยันเพิ่ม (`git -C <path> remote get-url origin`) และใช้ clone เมื่อเครื่องนั้นยังไม่มี spec (§19.5 ข้อ 2.6) |
| `specs.sources[].statusMap` | object หรือ `null` | `null` | override คำของ status ต่อ semantic (§19.7.1) |
| `specs.sources[].version` | string หรือ `null` | จาก index | ไม่ตรงกับเครื่อง → card R2 (§19.5) |
| `specs.scopes[].covers` | glob relative กับ repo root | `[]` | ใช้ตัดสินว่าไฟล์ที่แก้ "อยู่ใต้ spec" |
| `specs.sync` | `auto\|ask\|off` | spec-first: `auto`; hybrid: `auto`; code-first: `off` | |
| `specs.enforcement` | `warn\|block` | `warn` (V2.1) | `warn` = self-fix ก่อน ถ้า sync ไม่ได้ก็ส่งงานได้พร้อม warning; `block` = opt-in ของทีมที่ต้องการบังคับ (`SPEC_SYNC_REQUIRED` แบบ stop) |
| `hybrid.newWork` | `spec-first\|code-first` | `spec-first` | งานใหม่นอก scope เดิม |

Validation (`PROJECT_PROFILE_INVALID` + details): external source ห้ามมี `path`; `id` ตรง `^[a-z0-9][a-z0-9-]{1,63}$` และไม่ซ้ำ; `scopes[].source` ต้องมีใน sources; `status:"confirmed"` ต้องมี `confirmedBy`/`confirmedAt`; code-first + `sync:"auto"` ได้เฉพาะเมื่อผู้ใช้สั่งตรง (§19.10) และต้องมี `decisionRef`

### 19.4 Local memory: `.agrimap-agent/local/memory.md` (ไม่ commit)

**จุดประสงค์**: เก็บสิ่งที่ "ถูกต้องเฉพาะเครื่องนี้" โดยเฉพาะ absolute path ของ spec และ repo ที่เกี่ยวข้อง เพื่อให้ Agent ไม่ต้องค้นหาเองทุก session และไม่เอา path ของเครื่องหนึ่งไปใส่ใน repo ที่ทุกคนใช้

**Git**: `ensureLayout()` ต้องทำให้ `.agrimap-agent/.gitignore` มีบรรทัด `local/` เสมอ — ไฟล์เดิมมีแค่ `runtime/` และ `cache/` และโค้ดปัจจุบันเขียน `.gitignore` เฉพาะเมื่อไม่มีไฟล์ จึงต้องเพิ่ม logic append บรรทัดที่ขาดแบบ idempotent (ไม่แตะบรรทัดอื่น)

**Format** (Markdown ที่คนแก้ด้วยมือได้ และ script parse ได้):

```markdown
# AGM local memory — เครื่องนี้เท่านั้น ไม่ commit

<!-- agm-local-memory: v1 -->
<!-- แก้ด้วยมือได้ Agent อ่านผ่าน `agm-workspace.mjs context` -->

## Spec locations

| id | path | version | verified |
| --- | --- | --- | --- |
| agrimap-plus-operations-console | D:/Projects/46_ArgiMap/Projects/AgriMapPlatform/agrimap-plus-operations-console-spec-v1.0.0 | 1.0.0 | 2026-09-18 |

## Related repositories

| id | path | verified |
| --- | --- | --- |
| agmws-license-management-netcore | D:/Projects/46_ArgiMap/Projects/AgriMapPlatform/services/agmws-license-management-netcore | 2026-09-18 |

## Working notes

- (agm 2026-09-18) กำลังทำ FE-005..FE-007 บน feature/registry-summary
```

**Parser rules** (`local-memory.mjs#parseLocalMemory`):
- ต้องมี marker `<!-- agm-local-memory: v1 -->` ไม่มี → ถือว่าไม่มี local memory (ไม่ throw) และคืน warning `LOCAL_MEMORY_UNRECOGNIZED`
- อ่านตารางใต้ heading `## Spec locations` และ `## Related repositories` จนถึง heading ถัดไป; แถวข้อมูลตรง `^\|\s*([a-z0-9][a-z0-9-]*)\s*\|\s*(.+?)\s*\|` แล้วตามด้วย cell ที่เหลือ; ข้ามแถว header และ `---`
- path เก็บแบบ forward slash; ตอนใช้ `path.resolve()` ตาม OS
- `## Working notes`: บรรทัด agent ขึ้นต้น `- (agm YYYY-MM-DD)`; บรรทัดอื่นเป็นของคน ห้ามแก้/ลบ

**Writer rules** (`setLocalPath`, `addWorkingNote`):
- เขียนเฉพาะแถวของ `id` ที่ระบุ รักษาทุกอย่างที่เหลือ (รวมบรรทัดที่คนเขียนเอง)
- `verified` อัปเดตไม่เกินวันละครั้งต่อ id (กัน churn)
- working notes ของ agent เก็บสูงสุด 10 บรรทัด ตัดของ agent ที่เก่าสุดก่อน; ขนาดไฟล์รวม ≤ 4 KB (เกิน → ตัด working notes ของ agent เท่านั้น)
- สร้างไฟล์ใหม่จาก template ข้างบนเมื่อยังไม่มี

**Privacy**: absolute path อาจมีชื่อผู้ใช้ของเครื่อง → ไฟล์ที่ commit (log, report, decision, spec, code) อ้าง external spec ด้วย `id` เท่านั้น; `deliver plan` คืน `LOCAL_PATH_LEAK` (self-fix, §8.2) ถ้าบรรทัดที่เพิ่มมี path ใดๆ ที่อยู่ใน local memory (เทียบแบบ exact, case-insensitive, ทั้ง `/` และ `\`)

**ความต่างจาก memory เดิม**: `memory/project.md` เป็นความจำของทีม (commit); `local/memory.md` เป็นความจำของเครื่องนี้ (ไม่ commit); `runtime/` เป็น state ของเครื่องที่ script สร้าง (JSON, คนไม่ต้องอ่าน)

### 19.5 Spec location resolution

เรียกภายใน `context` (C1) ทุกครั้งที่มี `project.json` — Agent **ไม่ต้องค้น path เอง**

1. `kind:"repo"` → `<targetRoot>/<path>`; ไม่มี → warning `SPEC_SOURCE_MISSING`
2. `kind:"external"` → อ่าน local memory แถว `id`:
   1. มีและ path มีจริงและ fingerprint ผ่าน → ใช้ (`source:"local-memory"`)
   2. มีแต่ path ไม่มี/fingerprint ไม่ผ่าน → ถือว่าไม่รู้ ไปข้อ 3 พร้อม warning `LOCAL_PATH_STALE`
   3. **Bounded discovery** (ห้ามค้นทั้ง disk): สำหรับ ancestor ระดับ 1–4 ของ `targetRoot` และ `sessionCwd` ตัวมันเอง → list **เฉพาะ child directory ชั้นเดียว** (≤ 200 ต่อระดับ) → ตัวที่ชื่อมี `id` หรือมีคำว่า `spec` → ทดสอบ fingerprint; ใช้เวลาไม่เกิน 1 วินาที
   4. เจอหนึ่งตัวที่ fingerprint ผ่าน → เขียน local memory อัตโนมัติ (R0: local และย้อนได้) + แจ้งหนึ่งบรรทัดในแผนงาน
   5. เจอหลายตัว (เช่น v1.0.0 กับ v1.1.0) → card R2 ให้เลือก พร้อม version ของแต่ละตัว
   6. ไม่เจอ → card R1 "spec `<id>` อยู่ที่ไหนในเครื่องนี้": 1 clone จาก `remote` ไปที่ `<parent ของ targetRoot>/<id>` (แนะนำ; มีเมื่อ `remote` ไม่ null) 2 ระบุ path ที่มีอยู่แล้ว (free text) 3 ทำต่อโดยไม่มี spec ในรอบนี้ (warning `SPEC_SOURCE_UNRESOLVED`) → validate fingerprint → เขียน local memory; clone ใช้ `git clone <remote> <path>` แล้วตรวจ fingerprint ก่อนบันทึก
3. Version: `version` ใน policy ≠ version ที่อ่านจาก index ของเครื่องนี้ → card R2: 1 ใช้ของเครื่องนี้และอัปเดต `version` ใน policy (แนะนำเมื่อเครื่องนี้ใหม่กว่า) 2 หยุด ใช้ spec ให้ตรงกับ repo ก่อน
4. Fingerprint check: อ่าน `fingerprint.file` (≤ 64 KB) แล้วหา `contains`; ถ้ามี `remote` ให้ตรวจ remote URL (normalize แบบ §9.4 ข้อ 3) ด้วย

ผลใน `context` output (เพิ่มจาก §4.2):

```json
"projectProfile": {
  "exists": true, "status": "confirmed", "developmentMode": "spec-first",
  "sources": [
    { "id": "agrimap-plus-operations-console", "kind": "external", "resolved": true,
      "path": "D:/Projects/46_ArgiMap/Projects/AgriMapPlatform/agrimap-plus-operations-console-spec-v1.0.0",
      "via": "local-memory", "format": "morynth-context-index@1", "version": "1.0.0",
      "entry": "06-agent/AGENT-START-HERE.md" }
  ],
  "coversChangedPaths": null
},
"localMemory": { "exists": true, "path": ".agrimap-agent/local/memory.md", "warnings": [] }
```

### 19.6 ตรวจจับโหมด และจังหวะถาม

`project infer --cwd T` (read-only) ให้คะแนน:

| Signal | วิธีตรวจ (bounded) | คะแนน |
| --- | --- | --- |
| A1 | มี `.specify/`, `.kiro/specs/`, `openspec/` หรือ `specs/*/spec.md` ใน `git ls-files` | spec-first +4 |
| A2 | markdown ใต้ `spec/`, `specs/`, `requirements/`, `prd/` หรือชื่อ `*.spec.md`, `SPEC*.md`, `PRD*.md` ≥ 3 ไฟล์ และ ≥ 5% ของ source file (นับจาก `git ls-files`) | spec-first +2 |
| A3 | `AGENTS.md`/`README.md` มีวลี `spec-driven`, `source of truth`, `ตาม spec`, `AGENT-START-HERE` | spec-first +2 |
| A4 | ไฟล์ spec แรกถูกเพิ่มในช่วง 10% แรกของ commit (`git log --diff-filter=A --reverse --format=%H -- <spec globs>` เทียบ `git rev-list --count HEAD`) | spec-first +2; ถ้าเพิ่มหลัง 80% ของ history → hybrid +2 |
| A5 | spec มี ID แบบ `REQ-\d+`, `AC-[A-Z]+-\d+`, `FE-\d{3}`, `BE-\d{3}` หรือ heading `Acceptance` | spec-first +1 |
| A6 | bounded discovery (§19.5 ข้อ 2.3) เจอ spec pack ที่ `project.id`/ชื่อ folder มี token ร่วมกับชื่อ repo ≥ 2 token | spec-first +2 (เป็น candidate เท่านั้น ยังไม่ผูก) |
| C1 | ไม่มีไฟล์ spec ใน repo และ (`git rev-list --count HEAD` ≥ 50 หรือ commit แรกเก่ากว่า 6 เดือน) | code-first +3 |
| C2 | เอกสารมีแค่ README/changelog/usage | code-first +1 |

- **High**: คะแนนสูงสุด ≥ 5 และห่างอันดับสอง ≥ 3 → เขียน `project.json` ด้วย `status:"inferred"` แล้วบอกในแผนงานบรรทัดเดียว เช่น "ถือว่าเป็น Not AI-First (code-first): ไม่มี spec ใน repo, 214 commits ตั้งแต่ 2024-03 — ถ้าไม่ใช่บอกได้" **ไม่ถาม** (C2: R2 + High → ตัดสิน + อ้างหลักฐาน)
- **Medium/Low** → card blocking ในรอบคำถามแรกก่อน write แรก (ตามที่ผู้ใช้ต้องการ: ไม่มั่นใจให้ถามก่อนเริ่ม):

```text
**ต้องตัดสินใจ: โปรเจกต์นี้พัฒนาแบบไหน** — กำหนดว่า Agent ยึด code หรือ spec และจะอัปเดต spec ให้เองทุกงานหรือไม่ (ถามครั้งเดียว)
ตรวจแล้ว: ไม่มีโฟลเดอร์ spec ใน repo; 214 commits ตั้งแต่ 2024-03; พบ spec pack ข้างนอก agrimap-plus-operations-console-spec-v1.0.0 (ยังไม่แน่ใจว่าเกี่ยวกับ repo นี้)
1. AI-First — spec pack ข้างต้นเป็นหลัก ตรวจก่อนทำและอัปเดต spec ให้เองทุกงาน (แนะนำ)
2. Not AI-First — code เดิมเป็นหลัก ไม่แตะ spec เอง
3. ผสม — ของเดิมยึด code งานใหม่ทำจาก spec
ความมั่นใจ: ต่ำ เพราะหลักฐานขัดกัน (history ยาว แต่มี spec pack ชื่อตรง) · รอคำตอบก่อนเริ่มเขียน
ตอบเป็นเลข หรือพิมพ์ path ของ spec ได้เลย
```

- ผู้ใช้ตอบ AI-First/ผสม แต่ยังไม่รู้ตำแหน่ง spec → card ต่อเนื่อง "spec อยู่ที่ไหน" (ตัวเลือก = candidate จาก discovery + free text) — นับรวมใน ≤ 3 คำถามของรอบแรกร่วมกับ card workflow policy (§6.4)
- `decide record` ของ card นี้ใช้ `recordAs:"project:developmentMode"` (namespace ใหม่ของ card: `project:<dot.path>` เขียนลง `project.json`) และสร้าง decision `development-mode`
- `inferred` → `confirmed`: เมื่อผู้ใช้ตอบรับตรงๆ หรือครบ 3 execution ที่ delivered โดยไม่มีการแก้โหมด (นับจาก log event `delivered` ที่มี `developmentMode` เดียวกัน) → Agent เปลี่ยนเป็น `confirmed` พร้อม `confirmedBy:"implicit:<requester>"` และบอกหนึ่งบรรทัด
- ผู้ใช้แก้โหมดเมื่อไรก็ได้ ("โปรเจกต์นี้เป็น AI-First นะ") → E1 → `project set` + decision ใหม่ที่ supersede ของเดิม

### 19.7 Spec format adapters (`scripts/spec-adapters.mjs`)

Adapter แต่ละตัว implement interface เดียวกัน:

```js
{
  format: "generic-markdown",
  detect(root) → boolean,
  readIndex(root) → { projectId, version, entry, readOrder: [rel], canonical: {name: rel} },
  findItems(root, { ids, query, paths }) → [{ id, kind: "task|requirement|acceptance|question", file, line, title, status }],
  planStatus(root, id, status) → { file, edits: [{ line, before, after }] },
  planEvidence(root, { id, evidence, executionId, date }) → { file, edits },
  planChangelog(root, { date, executionId, summary }) → { file, edits } | null,
  planManifest(root, changedFiles) → { file, edits } | null
}
```

ไม่เพิ่ม npm dependency (runtime ถูกติดตั้งเป็น plugin โดยไม่มี `npm install`) — YAML ใช้ **line-based subset reader/editor** เท่านั้น; อ่านไม่ได้ → คืน `ADAPTER_PARSE_FAILED` + ให้ Agent อ่าน entry file เองตามปกติ (warn: ไม่ block การอ่านและการส่งงาน — ข้ามเฉพาะ sync อัตโนมัติของไฟล์นั้น แล้วแสดงใน ⚠️ ของ delivery summary)

**`morynth-context-index@1`** (ตรวจจาก `06-agent/CONTEXT-INDEX.yaml` บรรทัด `schema: morynth-context-index@1`)

| ส่วน | ที่มา | วิธีอ่าน/แก้ |
| --- | --- | --- |
| project id/version | `CONTEXT-INDEX.yaml` `project.id`, `project.version` | อ่าน key ใต้ `project:` ที่ indent 2 ช่อง |
| entry | `06-agent/AGENT-START-HERE.md` | คงที่ |
| read order | `read_order:` list | path relative กับ `06-agent/` → normalize เป็น relative กับ root ของ pack |
| canonical files | `canonical_files:` mapping | เช่นเดียวกัน |
| tasks | `06-agent/TASKS.yaml` (`schema: task-manifest@1`) | block เริ่มที่บรรทัด `- id: <ID>` ภายใต้ `tasks:` จบที่ `- id:` ถัดไปหรือ key ระดับบนสุด (เช่น `execution_packets:`); status คือบรรทัด `status: <v>` ภายใน block ที่ indent เท่ากับ `id` |
| status edit | เดียวกัน | แทนเฉพาะค่าหลัง `status: ` ของ block นั้น; ค่าที่เขียนเลือกตาม §19.7.1; ไม่พบบรรทัด status → เพิ่มบรรทัด `status:` ใต้ `- id:` ด้วย indent ของ field ถัดไป + warning `TASK_STATUS_LINE_ADDED` |
| requirements | `06-agent/REQUIREMENTS.yaml` (`requirement-catalog@1`) groups `id`, `ids` (เช่น `AUTH-001..AUTH-009`) | ขยาย range ตอน match |
| open questions | `06-agent/OPEN-QUESTIONS.yaml` | บรรทัดที่อ้าง ID ของงาน → ส่งกลับเป็น `kind:"question"` |
| evidence | `00-source-of-truth/TRACEABILITY.md` | ต่อท้าย section `## Implementation evidence` (สร้างถ้าไม่มี) ตาราง 4 คอลัมน์ `ID`, `Evidence`, `Execution`, `Date` — ไม่แก้ตาราง matrix เดิม |
| changelog | `CHANGELOG.md` ของ pack | เพิ่มบรรทัดใต้ heading วันที่ (สร้าง heading ถ้าไม่มี, newest-first) |
| manifest | `manifest.sha256` | บรรทัด `<sha256>  <relative path>`; คำนวณใหม่เฉพาะไฟล์ที่ sync นี้แก้; ไฟล์ใหม่ต่อท้าย; คงลำดับเดิม |
| goals override | `AGENT-START-HERE.md` บอกว่า `goals/<name>/README.md` supersede tasks เดิม | `readIndex` ใส่ `goals/*/README.md` ที่ตรง query ไว้หน้าสุดของ `readOrder` |

#### 19.7.1 Task status design (ตอบ Q9 — ไปต่อได้ + warning ชัด)

Agent คิดเป็น **สถานะเชิงความหมาย 5 ค่า** แล้วแปลงเป็นคำที่ไฟล์นั้นใช้อยู่จริง ไม่บังคับ enum ตายตัว:

| Semantic | คำที่ยอมรับ (ไม่สนตัวพิมพ์) | ค่าเริ่มต้นเมื่อไฟล์ยังไม่เคยใช้ | ใช้เมื่อ |
| --- | --- | --- | --- |
| `planned` | planned, todo, open, backlog, not-started | `planned` | ยังไม่เริ่ม (Agent ไม่เขียนค่านี้กลับเอง) |
| `inProgress` | in-progress, in_progress, doing, wip, started | `in-progress` | ส่งงานบางส่วน หรือ `DELIVERED_UNVERIFIED` |
| `done` | delivered, done, completed, implemented, closed | `delivered` (ตามที่ pack นี้ใช้) | verification ผ่าน และ AC ของ task มี evidence |
| `blocked` | blocked, on-hold, waiting | `blocked` | งานหยุดด้วยเหตุ `stop` ที่ยังไม่แก้ |
| `dropped` | dropped, cancelled, canceled, wontfix | `dropped` | เฉพาะเมื่อผู้ใช้สั่งยกเลิก task |

กติกาการเลือกคำ (`chooseStatusValue(semantic, observedValues, statusMap)`):

1. `statusMap[semantic]` ใน `project.json` ถ้ามี (optional override ของทีม)
2. ไม่งั้น คำในคอลัมน์ "คำที่ยอมรับ" ที่ **มีอยู่แล้วในไฟล์เดียวกัน** (`observedValues` = ทุกค่าหลัง `status:` ในไฟล์) — เลือกตัวที่ใช้บ่อยที่สุด
3. ไม่งั้น ค่าเริ่มต้น + warning `STATUS_VALUE_NEW` ("เพิ่มค่า status ใหม่ `in-progress` ใน TASKS.yaml ครั้งแรก — ถ้าทีมใช้คำอื่นให้ตั้ง `specs.sources[].statusMap`") แล้ว **เขียนต่อ ไม่หยุด**

สถานะที่ไม่รู้จักในไฟล์ (เช่น `review`) → อ่านเป็น `unknown` ไม่แก้ task นั้นยกเว้นถูกสั่งตรง และแสดง warning `STATUS_VALUE_UNKNOWN` ครั้งเดียวต่อค่า

ทุก warning ข้างบนเป็น severity `warn` (§2.4) — การอัปเดต spec ไม่เคยทำให้ส่งงานไม่ได้เว้นแต่ทีมตั้ง `enforcement:"block"`

**`generic-markdown`**

| ส่วน | วิธี |
| --- | --- |
| read order | `README.md` ของ source ก่อน แล้วไฟล์ที่ match query/ID (≤ 8 ไฟล์) |
| IDs | regex `\b[A-Z][A-Z0-9]{1,9}-\d{2,4}\b` |
| task status | checkbox `- [ ] <ID> …` → `- [x] <ID> …`; บรรทัดที่มี `Status: <v>` ใน section ของ ID → แทนค่า |
| evidence | `TRACEABILITY.md` ใน source ถ้ามี ไม่งั้นเพิ่ม `## Implementation evidence` ท้ายไฟล์ที่มี ID นั้น |
| changelog/manifest | ใช้เมื่อมีไฟล์ชื่อ `CHANGELOG.md` / `manifest.sha256` ที่ root ของ source |

### 19.8 Spec Read Gate (ก่อนเขียน) — `spec context`

`spec context --cwd T [--tasks FE-005,FE-006] [--query "<คำขอ>"] [--paths a,b]`

1. เลือก source: source ที่ `scopes.covers` match `--paths`; ไม่งั้นทุก source
2. `findItems` ด้วย `--tasks` (ID ตรง) หรือ `--query` (keyword ≥ 3 ตัวอักษร จาก title ของ task/requirement; เรียงตามจำนวนคำที่ตรง; ≤ 10 รายการ)
3. คืน:
   - `readFirst`: entry + canonical ที่เกี่ยวข้อง + ไฟล์ของ item ที่ match — **สูงสุด 8 ไฟล์** พร้อม `reason`
   - `items`: task/requirement/AC ที่เกี่ยวข้องพร้อม status
   - `blockingQuestions`: open question ที่อ้าง ID ของงานนี้
4. Agent อ่าน `readFirst` (ไม่อ่านทั้ง pack) แล้วระบุในแผนงาน: "ทำ FE-005..FE-007 ตาม SPEC §… / AC-REG-001..004"
5. มี `blockingQuestions` → card R2 พร้อมข้อความคำถามจาก pack; ห้ามเดาแทน
6. บันทึก `active.spec = { sources, items: [ids], readAt }`

Pre-write gate (`goal-rules.md`) เพิ่มข้อ 9: "spec-first/hybrid ในscope: spec items ที่อ่านแล้ว (ID + ไฟล์) หรือเหตุผลว่าไม่มี spec ครอบคลุม"

**คำขอเทียบกับ spec**

| กรณี | พฤติกรรม |
| --- | --- |
| ทำตาม spec ที่มีอยู่ | implement |
| คำขอเพิ่ม/เปลี่ยน behavior ที่ spec ยังไม่มี | แก้ spec ก่อน (requirement/AC/task) ใน branch เดียวกัน แล้วค่อย implement — คำขอตรงของผู้ใช้คือ authority (E1) จึงไม่ต้องถาม แต่ต้องแจ้งใน summary |
| คำขอขัดกับ spec | card R2: 1 ทำตามคำขอและแก้ spec (แนะนำเมื่อผู้ขอเป็นเจ้าของ spec) 2 ทำตาม spec 3 ขอคำอธิบายเพิ่ม |
| spec กำกวม หรือมี open question ที่ block | card R2 อ้าง ID ของ open question |
| งานใหม่ใน spec-first ที่ไม่มี spec ครอบคลุมเลย | สร้าง spec item ขั้นต่ำ (requirement + AC + task) จากคำขอก่อน implement และแจ้งใน summary; ถ้าคำขอไม่พอจะเขียน AC ที่วัดได้ → card R2 |
| implementation เจอว่า spec ผิด/ขาด (ไม่ใช่สิ่งที่ผู้ใช้สั่งเปลี่ยน) | แก้ส่วน mechanical ได้เอง; ส่วนเนื้อหา (requirement/AC/design) ให้ดู §19.8.1 |

#### 19.8.1 แก้ spec ส่วนไหนได้เอง — ดูเนื้องานและคำสั่ง (ตอบ Q10)

ไม่ใช้บทบาทหรือ ownership (DEV/BA/QA อาจเป็นคนเดียวกัน) — ตัดสินจาก **ชนิดของการแก้** กับ **คำสั่งในรอบนั้น**:

| ชนิดการแก้ | ตัวอย่าง | Agent ทำเองได้เมื่อ | ไม่มั่นใจ |
| --- | --- | --- | --- |
| Mechanical | status ของ task, evidence ใน traceability, changelog ของ spec, manifest | spec-first/hybrid ใน scope — ทำทุกงานอัตโนมัติ | ไม่ต้องถาม (ผิดพลาดเป็น warning) |
| Semantic ตามคำสั่ง | requirement/AC/task ใหม่หรือเปลี่ยนตามที่ผู้ใช้ขอในรอบนี้ | คำสั่งระบุ behavior ชัด (E1) | card R2 เมื่อคำสั่งยังตีความได้หลายทางว่าต้องเปลี่ยน spec แค่ไหน |
| Semantic ที่งานเผยออกมา | implement แล้วพบว่า spec ขัดกันเอง ขาดกรณี หรือ design ใช้ไม่ได้ | ไม่ทำเอง | card R2 เสมอ: 1 แก้ spec ตามที่ implement (แนะนำเมื่อมีหลักฐานจาก test/code) 2 แก้ code ให้ตรง spec 3 บันทึกเป็น open question แล้วไปต่อ |
| Wording/format | พิมพ์ผิด, ลิงก์เสีย, จัดรูปแบบ | อยู่ในไฟล์ที่งานนี้แก้อยู่แล้ว | ไม่แตะ ถ้าไม่ได้อยู่ในไฟล์ที่แก้ |

ทุกการแก้ semantic ต้องอยู่ใน branch เดียวกับ code, แสดงในบรรทัด `- Spec:` ของ delivery summary และมี decision เมื่อเกิดจาก card

### 19.9 Spec Sync Gate (หลัง verify ก่อน deliver) — `spec sync plan|apply`

`spec sync plan --cwd T --session S [--tasks FE-005,FE-006] [--status done|inProgress|blocked] [--evidence "AC-REG-001=tests/registry/summary.spec.ts"] [--deviation "<text>"]`

1. Task: default = `active.spec.items` ที่เป็น task; status default = `done` เมื่อ verification ของ execution ผ่าน, `inProgress` เมื่อ acceptance ผ่านบางส่วน (`--status inProgress`)
2. Evidence: ทุก `--evidence ID=<path-or-test>`; path ต้องอยู่ใน repo (relative) — ห้าม absolute path
3. Deviation: implementation ต่างจาก design ใน spec → บันทึกเป็น decision ใน `.agrimap-agent/decisions/` ของ repo (committed) + บรรทัดใน changelog ของ pack ที่อ้าง decision id
4. Changelog/manifest ของ pack ตาม adapter (manifest คำนวณหลังการแก้อื่นทั้งหมดใน plan)
5. คืน plan: `[{file, edits}]` + `planHash`; `apply` ตรวจ hash ใหม่ (`PLAN_STALE`) แล้วเขียนแบบ atomic ต่อไฟล์ (เขียน temp แล้ว rename)
6. Semantic change ที่ยังไม่ได้รับคำตอบจาก card ใน §19.8.1 → ไม่เขียนลง spec; บันทึกเป็น warning `SPEC_DECISION_PENDING` พร้อม card id แล้วทำ mechanical sync ส่วนที่เหลือต่อ
7. บันทึก `active.specSync = { appliedAt, files, items }` และ log event `changed` `milestone:"spec-sync"`

**การ commit ผล sync**

| Source | ผล |
| --- | --- |
| `kind:"repo"` | ไฟล์ spec เป็น own path → เข้า delivery commit เดียวกับ code |
| external ที่เป็น git repo | เป็น target root อีกตัว (C1 R1.4): ack AGENTS ของ repo นั้น, ใช้ policy ของ repo นั้น (ไม่มี → ถามครั้งแรกตาม §6.4), deliver แยก, รายงานสอง commit |
| external ที่ยังไม่ใช่ git (สถานะชั่วคราวก่อนย้ายตาม §19.21) | แก้ไฟล์ในเครื่องเท่านั้น + warning `SPEC_SOURCE_NOT_GIT` ในทุก delivery summary จนกว่าจะย้ายเสร็จ |

**Enforcement ใน `deliver plan`** (เพิ่มใน precondition §8.2 เป็นข้อ 7):
- spec-first หรือ hybrid ที่ไฟล์ที่แก้อยู่ใน `scopes.covers` หรือ `active.spec.items` ไม่ว่าง
- และยังไม่มี `active.specSync.appliedAt` และไม่ได้ส่ง `--spec-na "<reason>"`
- → default (`enforcement:"warn"`): self-fix — plan คืน `SPEC_NOT_SYNCED` + `next:{action:"run", command:"spec sync plan …"}` ให้ Agent sync แล้ว plan ใหม่; ถ้า sync ทำไม่ได้ (parse fail, ไฟล์หาย, path ไม่เจอ) ส่งงานต่อได้พร้อม warning ตาม Warning contract (§2.4); `enforcement:"block"` (opt-in ของทีม) → `SPEC_SYNC_REQUIRED` แบบ stop
- code-first และ `specs.sync:"off"`: ไม่ตรวจ

### 19.10 "สั่งครั้งเดียวพอ" (one-time instruction becomes standing rule)

| ผู้ใช้พูด | ผล |
| --- | --- |
| "ต่อไปเช็ค spec แล้วอัปเดตด้วยทุกครั้ง", "อัปเดต spec ให้เองเลย" (ในโหมดใดก็ได้) | E1 → `project set specs.sync auto` (+ ถ้า code-first และยังไม่มี source: ถามตำแหน่ง spec ครั้งเดียว) + decision; ทำทันทีในงานนี้ ไม่ถามซ้ำงานหน้า |
| "อัปเดต spec ด้วย" ครั้งเดียวในงานหนึ่ง (ไม่บอกว่าทุกครั้ง) ในโหมด code-first | ทำในงานนี้ แล้ว card R1 หนึ่งครั้ง: 1 ทำแบบนี้ทุกงาน (เปลี่ยนเป็น `hybrid` + `sync:auto` สำหรับ scope นี้) (แนะนำ) 2 เฉพาะครั้งนี้ |
| "ไม่ต้องแตะ spec" | `project set specs.sync off` + decision |
| "เช็คว่า spec ตรงกับ code ไหม" | `spec check` (§19.11) แล้วรายงาน; ไม่แก้จนกว่าจะสั่ง (เว้นแต่ `sync:auto` และ drift เป็นของงานที่เพิ่ง deliver) |

กลไกนี้ใช้ได้ตั้งแต่ P1-C9 โดยไม่ต้องรอ signal learning ของ C7

### 19.11 `spec check` (drift report, read-only)

`spec check --cwd T [--source <id>] [--limit 50]` ตรวจ:

| Check | วิธี | ผล |
| --- | --- | --- |
| manifest | sha256 ของทุกไฟล์ใน `manifest.sha256` เทียบค่าในไฟล์ | `MANIFEST_MISMATCH` ต่อไฟล์ |
| evidence path | path ใน `## Implementation evidence` ที่ไม่มีใน repo | `EVIDENCE_MISSING` |
| delivered without evidence | task `done` ที่ไม่มี evidence ของ AC ใน group เดียวกัน | `DONE_WITHOUT_EVIDENCE` |
| code without task | commit ที่มี trailer `AGM-Execution` แตะ `scopes.covers` แต่ execution นั้นไม่มี `spec-sync` milestone | `UNSYNCED_EXECUTION` |

- เรียกอัตโนมัติ: ครั้งแรกของ session เมื่อเริ่มงานใน scope ของ spec-first (ผลสรุป ≤ 5 บรรทัดในแผนงาน) — ไม่เรียกซ้ำใน session
- ผล drift ที่ไม่ใช่ของงานนี้: รายงาน ไม่แก้เอง (เป็นงานของคนอื่น) เว้นแต่ผู้ใช้สั่ง

### 19.12 CLI ใหม่

| Command | Effect | หมายเหตุ |
| --- | --- | --- |
| `project show --cwd T` | read-only | `{exists, status, profile, validation}` |
| `project infer --cwd T` | read-only | `{proposal, confidence, evidence, card}` |
| `project init --cwd T --mode <m> --requested-by X [--input profile.json]` | เขียน `project.json` + decision + fact ใน `project.md` | |
| `project set --cwd T --key k --value v --requested-by X` | validate แล้วเขียน | |
| `local show --cwd T` | read-only | parse `local/memory.md` |
| `local set-path --cwd T --kind spec\|repo --id X --path P` | ตรวจ path + fingerprint แล้วเขียน | ไม่ต้องมี identity (ไฟล์ส่วนตัว) |
| `local note --cwd T --text "<t>"` | เพิ่ม working note ของ agent | |
| `spec context …` | read-only | §19.8 |
| `spec sync plan\|apply …` | apply เขียนไฟล์ spec | §19.9 |
| `spec check …` | read-only | §19.11 |

Card `recordAs` เพิ่ม namespace `project:<dot.path>` (เขียน `project.json`) และ `local:spec:<id>` (เขียน local memory จาก free-text path)

### 19.13 ผลต่อ component เดิม

| Component | การเปลี่ยนแปลง |
| --- | --- |
| C1 `context` | เพิ่ม `projectProfile` และ `localMemory` ใน output (§19.5); `readRequired` ไม่รวมไฟล์ spec (spec อ่านตาม §19.8 ไม่ใช่ instruction) |
| C2 evidence ladder | spec-first/hybrid ใน scope: spec item ที่ confirmed = **E3**; code-first: spec/เอกสาร = **E6** (hint) |
| C3 รอบคำถามแรก | ลำดับ: workflow policy → development mode → ตำแหน่ง spec (รวม ≤ 3) |
| C5 deliver | precondition ข้อ 7 `SPEC_NOT_SYNCED` (self-fix → warn); `LOCAL_PATH_LEAK`; `.agrimap-agent/local/**` อยู่ในกลุ่ม excluded เสมอ |
| C6 delivery summary | เพิ่มบรรทัด `- Spec: FE-005, FE-006 → delivered · evidence 3 รายการ · manifest อัปเดต` หรือ `- Spec: ไม่เกี่ยว (code-first)` |
| C7 digest (P3) | เพิ่ม `mode spec-first · specs: agrimap-plus-operations-console v1.0.0 (local ok)` |
| C8 git-guard (P4) | G3 เพิ่ม `git add -- .agrimap-agent/local` และ `git add -f` ใต้ `local/` เป็น deny |

### 19.14 ตัวอย่าง flow

**A. AI-First ครั้งแรก (ไม่มั่นใจ → ถาม)**

```text
User: ทำหน้า registry summary ตาม spec
Agent: context → project.json ไม่มี → project infer: low (history ยาว + เจอ spec pack ชื่อตรง)
       [card workflow policy] + [card development mode] ในรอบเดียว
User: 1 แล้ว 1
Agent: project init spec-first + source agrimap-plus-operations-console (fingerprint จาก CONTEXT-INDEX)
       local set-path → เขียน local/memory.md
       spec context --query "registry summary" → readFirst 6 ไฟล์, items FE-005..FE-007, AC-REG-001..004
       … implement + test → spec sync: FE-005..007 → delivered, evidence 4 แถว, CHANGELOG, manifest
       deliver → summary มีบรรทัด Spec
```

**B. นักพัฒนาอีกคน เครื่องอื่น path ต่าง**

```text
Dev B pull repo (มี project.json ที่อ้าง id ไม่มี path)
Agent: context → local memory ไม่มี → bounded discovery เจอ E:/Work/agrimap/agrimap-plus-operations-console-spec-v1.0.0
       fingerprint ผ่าน → เขียน local/memory.md ของเครื่อง B → ไม่ถาม
```

**C. Not AI-First แล้วผู้ใช้ขอครั้งเดียว**

```text
User: แก้ bug คำนวณวันหมดอายุ แล้วอัปเดตเอกสาร spec ด้วย
Agent: ทำ + อัปเดต → card R1: ทำแบบนี้ทุกงานไหม 1 ทุกงาน (แนะนำ) 2 ครั้งนี้
User: 1 → project set hybrid + scope + sync:auto → งานหน้าไม่ต้องสั่ง
```

### 19.15 ไฟล์ที่ต้องแก้ (เพิ่มจาก §12)

| # | ไฟล์ | การเปลี่ยนแปลง | Phase |
| --- | --- | --- | --- |
| 29 | `.../scripts/project-profile.mjs` (ใหม่) | `PROJECT_PATH`, `loadProject`, `validateProject`, `inferProject({run})`, `initProject`, `setProjectValue`, `resolveSpecSources(targetRoot, sessionCwd, localMemory)` | P1 |
| 30 | `.../scripts/local-memory.mjs` (ใหม่) | `LOCAL_MEMORY_PATH`, `parseLocalMemory`, `renderLocalMemory`, `setLocalPath`, `addWorkingNote`, `localPathsForLeakCheck` | P1 |
| 31 | `.../scripts/spec-adapters.mjs` (ใหม่) | adapter `generic-markdown`, `morynth-context-index@1`; YAML line-subset reader/editor | P2 |
| 32 | `.../scripts/spec-sync.mjs` (ใหม่) | `specContext`, `planSpecSync`, `applySpecSync`, `specCheck` | P2 |
| 33 | `.../scripts/agm-workspace.mjs` | dispatch `project`, `local` (P1), `spec` (P2); `ensureLayout` append `local/` ใน `.agrimap-agent/.gitignore` แบบ idempotent; `context` รวม `projectProfile`/`localMemory` | P1/P2 |
| 34 | `.../scripts/decision-card.mjs` | `recordAs` namespace `project:` และ `local:spec:` | P1 |
| 35 | `.../scripts/git-flow.mjs` | deliver: exclude `local/`, `LOCAL_PATH_LEAK` (P1), `SPEC_NOT_SYNCED` + `--spec-na` (P2) | P1/P2 |
| 36 | `.../references/spec-driven.md` (ใหม่, ≤ 500 words) | ร่าง §19.18 | P1 (โหมด+local) / P2 (sync) |
| 37 | `.../references/lifecycle-core.md` | ประโยคเดียวจาก §19.17 แทนประโยค V1 ใน §12.1 แถว 15 | P1 |
| 38 | `.../references/goal-rules.md` | pre-write gate ข้อ 9 | P2 |
| 39 | `.../references/memory-and-logs.md` | ความต่าง `memory/` vs `local/` vs `runtime/`; ห้าม absolute path ในไฟล์ที่ commit | P1 |
| 40 | `.../references/input-and-scope.md` | ใต้ Pointed files: external spec ใช้ path จาก `context` ไม่ค้นเอง | P1 |
| 41 | `config/operations.json` | `spec-driven.md` conditional สำหรับ `execute`, `fe`, `be`, `sql` เมื่อ "the project profile is spec-first or hybrid"; `analyze`, `plan`, `architect`, `qa` เมื่อ "the project profile is spec-first or hybrid and the question concerns specified behavior" | P1 |
| 42 | `.../assets/bootstrap/AGENTS.md` | §10.5 (§19.16) + bullet §9.1 เรื่อง `local/` | P1 |
| 43 | `tests/fixtures/spec-pack-morynth/` (ใหม่) | ชุดย่อจาก pack จริง: `06-agent/CONTEXT-INDEX.yaml`, `TASKS.yaml` (3 task), `REQUIREMENTS.yaml`, `OPEN-QUESTIONS.yaml`, `00-source-of-truth/TRACEABILITY.md`, `CHANGELOG.md`, `manifest.sha256` — เนื้อหาสังเคราะห์ ไม่คัดลอกข้อมูลจริงเกินจำเป็น | P2 |

### 19.16 ข้อความเพิ่มใน bootstrap `AGENTS.md`

เพิ่ม bullet ท้าย §9.1:

```markdown
- `.agrimap-agent/local/**` เป็นความจำเฉพาะเครื่อง (เช่น path ของ spec นอก repo) ถูก ignore และห้าม stage/commit ทุก mode; ไฟล์ที่ commit อ้าง spec นอก repo ด้วย id ใน `policy/project.json` เท่านั้น ห้ามใส่ absolute path ของเครื่อง
```

เพิ่มท้าย §10 (ต่อจาก §10.4 ใน §13.6):

```markdown
### 10.5 โหมดการพัฒนาและ spec

- `.agrimap-agent/policy/project.json` บอก `developmentMode`: `code-first` (Not AI-First: ของเดิม ยึด code และ test), `spec-first` (AI-First: ยึด markdown spec) หรือ `hybrid` (ของเดิมยึด code งานใหม่หรือ path ใน `specs.scopes` ยึด spec)
- ไม่มีไฟล์: ตรวจหลักฐานใน repo, history และ spec pack ข้างเคียง ถ้ามั่นใจให้บันทึก `status: inferred` แล้วบอกผู้ใช้บรรทัดเดียว ถ้าไม่มั่นใจให้ถามก่อนเริ่มเขียนพร้อมให้ระบุตำแหน่ง spec
- Spec นอก repo อ้างด้วย id และ fingerprint ใน policy; path จริงของแต่ละเครื่องอยู่ใน `.agrimap-agent/local/memory.md` อ่านจากไฟล์นั้นก่อน ค้นหาเฉพาะ directory ข้างเคียงเมื่อไม่มี และถามเมื่อหาไม่เจอ ห้ามค้นทั้ง disk
- `spec-first` หรือไฟล์ใน scope ของ `hybrid`: อ่าน spec item ที่เกี่ยวข้องก่อนเขียน; คำขอที่เพิ่ม/เปลี่ยน requirement ให้แก้ spec ก่อนใน branch เดียวกัน; คำขอที่ขัดกับ spec หรือ open question ที่ block ให้ถาม; หลัง verify ให้อัปเดต status ของ task, evidence ใน traceability, changelog และ manifest ของ spec เองทุกงานโดยไม่ต้องรอสั่ง; ส่วนที่เป็นเนื้อหา (requirement, acceptance criteria, design) แก้ตามคำสั่งในรอบนั้นเท่านั้น ถ้างานเผยว่า spec ผิดหรือขาดโดยไม่ได้สั่ง หรือไม่มั่นใจว่าคำสั่งครอบคลุมแค่ไหน ให้ถามก่อน; ปัญหาในการอัปเดต spec ไม่ทำให้ส่งงานไม่ได้ แต่ต้องแจ้งเป็น warning ให้ชัด
- `code-first`: ยึด code และ test; ไม่แก้ spec หรือเอกสารเองนอกจาก changelog/README ตาม §5; เจอเอกสารขัด code ให้บอกบรรทัดเดียว
- ผู้ใช้สั่งเรื่อง spec ครั้งเดียว (เช่น "อัปเดต spec ด้วย") ให้ถามว่าจะทำทุกงานไหม แล้วบันทึกลง `project.json` เพื่อไม่ต้องสั่งซ้ำ
```

### 19.17 Token budget ของ C9

- `lifecycle-core.md`: **แทน** ประโยค V1 (§12.1 แถว 15) ด้วยประโยคเดียวนี้ (38 words ไม่เพิ่มจาก V1):

  > Before the first repository write run `agm-workspace.mjs context`: read and ack its AGENTS chain, then follow its project mode (load spec-driven.md for spec-first or hybrid) and confirmed workflow policy (git-workflow.md). Never write state outside a Git root.

- `spec-driven.md` เป็น conditional เท่านั้น (ไม่กระทบ direct/required)
- `goal-rules.md` ข้อ 9 ≤ 30 words → release required ≤ 6,015 (budget 6,400)
- scenario ใหม่:

| id | operation | depth | activate | mustLoad |
| --- | --- | --- | --- | --- |
| `execute-spec-first-sync-light` | execute | light | `spec-driven.md`, `git-workflow.md` | `autonomy.md`, `spec-driven.md`, `git-workflow.md` |
| `fe-spec-first-edit-light` | fe | light | `frontend-engineer.md`, `patterns/frontend.md`, `spec-driven.md`, `git-workflow.md` | ทั้งหมดใน activate |
| `analyze-spec-first-question-light` | analyze | light | `spec-driven.md` | `spec-driven.md` |

- runtime: `context` output เพิ่ม ≤ 800 chars (profile + sources); `spec context` คืนรายการไฟล์ ≤ 8 แทนการที่ Agent list/read ทั้ง pack (pack ตัวอย่างมี ~40 ไฟล์ และไฟล์ใน `06-agent` รวม ~1,000 บรรทัด)

### 19.18 ร่าง `references/spec-driven.md`

```markdown
# Spec-driven work

Load when `context` reports `developmentMode` spec-first, or hybrid with changed files inside `specs.scopes`. In code-first projects, tests and code are the source of truth: do not edit specs or documents beyond the changelog/README the project AGENTS requires, and mention a contradiction you notice in one line.

## Locations

Use the spec paths returned by `context`; never search the disk. A missing external path is resolved by `context` from local memory, bounded discovery or a card. Committed files refer to external specs by id, never by an absolute path.

## Before writing

Run `spec context --query "<request>"` (or `--tasks <ids>`). Read every `readFirst` file, not the whole pack. Name the task, requirement and acceptance IDs you implement in your plan. Blocking open questions become an R2 card quoting the question.

- Request matches the spec: implement it.
- Request adds or changes behavior: update the spec items first in the same branch, then implement; report the change.
- Request contradicts the spec: R2 card (follow the request and update the spec, follow the spec, or clarify).
- No spec covers new spec-first work: add a minimal requirement, acceptance criteria and task first; ask when acceptance cannot be made measurable.
- Mechanical updates (task status, evidence, spec changelog, manifest) are always yours. Semantic changes (requirements, acceptance criteria, design) follow the current instruction; when implementation reveals a spec gap the instruction does not cover, or you are unsure how far it reaches, ask with an R2 card. Judge by the work and the instruction, not by who owns the file.

## After verification

Run `spec sync plan` with the delivered task IDs, `--evidence ID=<repo-relative test or file>` for each verified acceptance item and `--deviation` for design differences, then `spec sync apply`. `deliver` reports `SPEC_NOT_SYNCED` for covered work until you sync or pass `--spec-na "<reason>"`; if sync is impossible, deliver anyway and list the warning under ⚠️ with its fix. Report the spec line in the delivery summary. A non-Git spec pack is updated locally only; say so.

## Standing instructions

An instruction about specs given once becomes the project rule: `project set specs.sync auto|off`, or a one-time R1 card asking whether it applies to every task. Never require the requester to repeat it.
```

### 19.19 Tests ของ C9

**P1 — `tests/unit/project-profile.test.mjs`**
1. infer: repo ที่มี `specs/001-x/spec.md` + `.specify/` → spec-first high → `status:"inferred"` ไม่มี card
2. infer: 60 commits ไม่มี spec → code-first high
3. infer: history ยาว + sibling spec pack ชื่อตรง → confidence low → card ที่มีสามตัวเลือกและรองรับ free text
4. validate: external source ที่มี `path` → `PROJECT_PROFILE_INVALID`
5. `decide record` ด้วย `recordAs:"project:developmentMode"` เขียน `project.json` + decision

**P1 — `tests/unit/local-memory.test.mjs`**
1. parse/render round-trip รักษาบรรทัดที่คนเขียนเอง
2. ไม่มี marker → `LOCAL_MEMORY_UNRECOGNIZED` ไม่ throw
3. `setLocalPath` แก้เฉพาะแถว id นั้น; `verified` ไม่เปลี่ยนซ้ำในวันเดียว
4. working notes ของ agent เกิน 10 → ตัดของ agent ที่เก่าสุด ไม่แตะของคน
5. `ensureLayout` append `local/` ใน `.gitignore` เดิมที่มี `runtime/\ncache/\n` และรันซ้ำไม่เพิ่มซ้ำ; `git check-ignore .agrimap-agent/local/memory.md` exit 0

**P1 — เพิ่มใน `instruction-chain.test.mjs`**
- `context` resolve external spec จาก local memory; path stale → discovery เจอ sibling ที่ fingerprint ผ่าน → เขียน local memory; สอง version → card; ไม่เจอ → card free text

**P1 — เพิ่มใน `git-flow.test.mjs`**
- own file ที่มี absolute path จาก local memory → `LOCAL_PATH_LEAK`; `.agrimap-agent/local/memory.md` ไม่ถูก stage แม้ถูก `git add -f` มาก่อน (ต้องอยู่ใน excluded และ plan คืน warning)

**P2 — `tests/unit/spec-sync.test.mjs`** (fixture `tests/fixtures/spec-pack-morynth/`)
1. `spec context --tasks FE-002` คืน `readFirst` ≤ 8 และ `goals/*/README.md` มาก่อนเมื่อ query ตรง
2. open question ที่อ้าง FE-002 → `blockingQuestions`
3. sync: status `planned` → `delivered` เฉพาะ block ของ FE-002 (diff เปลี่ยนบรรทัดเดียว); ไฟล์ที่ใช้ `done` อยู่แล้วได้ `done`; ไฟล์ที่ยังไม่มีค่า `in-progress` ได้ค่าเริ่มต้น + `STATUS_VALUE_NEW` และ apply สำเร็จ; `statusMap` override ชนะ; task ที่มี status `review` ไม่ถูกแก้ + `STATUS_VALUE_UNKNOWN`; block ไม่มีบรรทัด status → เพิ่มบรรทัด + `TASK_STATUS_LINE_ADDED`
4. evidence ต่อท้าย `## Implementation evidence` สร้าง section เมื่อไม่มี; absolute path ใน `--evidence` ถูกปฏิเสธ
5. manifest: เฉพาะไฟล์ที่แก้ได้ hash ใหม่ ลำดับเดิม; `spec check` หลัง apply ไม่มี `MANIFEST_MISMATCH`
6. semantic change ที่งานเผยออกมา → card R2 และระหว่างรอคำตอบ mechanical sync ยัง apply ได้ + warning `SPEC_DECISION_PENDING`
7. deliver ใน scope ที่ยังไม่ sync → `SPEC_NOT_SYNCED` + next = spec sync; sync fail → ส่งงานได้และ `warnings` มี code; `--spec-na` → ผ่าน; `enforcement:"block"` → `SPEC_SYNC_REQUIRED`; code-first → ไม่ตรวจ
8. YAML ที่ parse ไม่ได้ → warning `ADAPTER_PARSE_FAILED`, deliver ไม่ถูก block และ `spec context` ยังคืน entry ให้ Agent อ่านเอง

### 19.20 Acceptance criteria ของ C9

| ID | Phase | เกณฑ์ |
| --- | --- | --- |
| AC14 | P1 | project ที่หลักฐานไม่ชัด: มี card development mode ก่อน write แรก และไม่มีไฟล์ product ถูกแก้ก่อนได้คำตอบ |
| AC15 | P1 | project ที่หลักฐานชัด: ไม่ถาม, `project.json` เป็น `inferred`, แผนงานมีบรรทัดบอกโหมดพร้อมเหตุผล |
| AC16 | P1 | นักพัฒนาคนที่สองที่ path ต่างกัน: ได้ spec path จาก discovery + fingerprint โดยไม่มีคำถาม และไม่มี absolute path ในไฟล์ที่ commit |
| AC17 | P1 | `.agrimap-agent/local/` ถูก ignore ทั้ง project ใหม่และ project เดิมหลัง upgrade |
| AC18 | P2 | spec-first: ส่งงาน FE-005 ที่ verify ผ่านแล้ว TASKS/TRACEABILITY/CHANGELOG/manifest ของ pack อัปเดตครบ **โดยผู้ใช้ไม่ต้องสั่ง** |
| AC19 | P2 | code-first: ไฟล์ spec ไม่ถูกแก้ถ้าไม่ได้สั่ง; สั่งครั้งเดียวแล้วมี card "ทำทุกงานไหม" หนึ่งครั้ง และงานถัดไปไม่ต้องสั่งอีก |
| AC20 | P2 | คำขอที่ขัดกับ spec ได้ card R2 ก่อนเขียน ไม่ถูก implement แบบเงียบ |
| AC21 | P2 | (V2.1) TASKS.yaml ที่ parse ไม่ได้ หรือค่า status ใหม่ ไม่ทำให้ส่งงานไม่ได้: commit/push สำเร็จ และ delivery summary มี section ⚠️ ที่บอก code, ผลกระทบ, วิธีแก้ |
| AC22 | P1 | (V2.1) verification fail: work branch ถูก commit/push พร้อม trailer `AGM-Verification: failed` และ Next-step card ไม่มี merge เป็นข้อ 1 |

### 19.21 ย้าย spec pack เข้า Git (ตอบ Q8)

เป้าหมาย: `agrimap-plus-operations-console-spec-v1.0.0/` (ตอนนี้อยู่นอก git) เป็น **Git repo แยก** เพราะ FE (`apps/web/*`), BE (`services/*`) และ desktop หลาย repo ใช้ pack เดียวกัน — การย้ายนี้เป็นงานที่ต้องสั่งแยก (ต้องมี URL ของ remote) spec นี้กำหนดขั้นตอนไว้ให้ทำได้ทันทีเมื่อสั่ง

1. **ตรวจก่อน commit** (read-only): pack มี state ของ agent อยู่ที่ `.agrimap-agent/`, `memory/`, `logs/`, `reports/` และ `.agrimap-agent/prompts/**` ซึ่งอาจมีข้อความคำขอดิบ → แยกเป็น 3 กลุ่ม: spec (commit), agent audit ที่ทีมต้องการเก็บ (commit หลังตรวจ secret ด้วย `detectSensitive`), runtime/raw prompt (ignore)
2. สร้าง `.gitignore` ของ spec repo:

   ```gitignore
   .agrimap-agent/runtime/
   .agrimap-agent/cache/
   .agrimap-agent/local/
   .agrimap-agent/prompts/
   ```

3. ชื่อ folder/repo ไม่มีเลข version: `agrimap-plus-operations-console-spec` — version อยู่ใน `06-agent/CONTEXT-INDEX.yaml` (`project.version`) และ Git tag `v1.0.0` (fingerprint ใช้ `project.id` จึงไม่พังเมื่อเปลี่ยนชื่อ folder)
4. คำสั่ง (รันใน folder ของ pack หลังผู้ใช้ให้ URL):

   ```text
   git init -b main
   git add -- <paths ที่ผ่านข้อ 1 ทีละรายการ>
   git diff --cached --check
   git commit -m "docs: import operations console spec pack v1.0.0"
   git tag -a v1.0.0 -m "Spec pack v1.0.0"
   git remote add origin <URL>
   git push -u origin main
   git push origin v1.0.0
   git ls-remote --heads --tags origin
   ```

5. สร้าง `.agrimap-agent/policy/workflow.json` ของ spec repo (ถามครั้งแรกตาม §6.4; ค่าแนะนำ profile `trunk` — spec เปลี่ยนผ่าน `docs/<slug>` แล้ว PR เข้า `main`)
6. ใน repo ที่ implement แต่ละตัว: `project set specs.sources[<id>].remote <URL>` → commit ไปกับงานถัดไป
7. `manifest.sha256`: คงไว้ (ใช้ตรวจความครบของ pack สำหรับคนที่ไม่ได้ใช้ git) และให้ `spec sync` สร้างใหม่ทุกครั้งที่แก้ไฟล์ใน pack
8. หลังย้าย: เครื่องที่มี folder เดิม → `context` เจอ `LOCAL_PATH_STALE` (ถ้าย้ายที่) หรือยังใช้ได้ (ถ้า `git init` ที่เดิม); เครื่องใหม่ → card clone (§19.5 ข้อ 2.6)
9. warning `SPEC_SOURCE_NOT_GIT` หายไปเองเมื่อ `git -C <path> rev-parse` สำเร็จ


---

## 20. Phase specs P2–P4 บน baseline as-built 4.6.0 (V2.2)

ส่วนนี้คือ spec สำหรับลงมือทำ 4.7.0 → 4.8.0 → 4.9.0 โดยอิงโค้ดจริงของ 4.6.0 (PR #21) — เมื่อข้อความใน §4–§19 ขัดกับ §20 ให้ถือ §20

### 20.1 As-built 4.6.0 ที่ phase ถัดไปต้องยึด

**Module map** (อย่าสร้างซ้ำ — ต่อยอดจากของเดิม):

| หน้าที่ | ไฟล์ (ใต้ `skills/agrimap-agent-skills/scripts/`) | export ที่ใช้ต่อ |
| --- | --- | --- |
| dispatch คำสั่ง governance | `governance-commands.mjs` | `GOVERNANCE_COMMANDS` (ตอนนี้: context, policy, decide, branch, deliver, integrate, project, local), `runGovernanceCommand` — **คำสั่งใหม่เพิ่มที่นี่** ไม่ใช่ใน `switch` ของ `agm-workspace.mjs` |
| session state + pointer | `session-state.mjs` | `readSessionState`, `updateSessionState`, `writeSessionPointer`, `GOVERNANCE_SESSION_FIELDS` |
| git runner | `run-command.mjs` | `defaultRun`, `gitRunner`, `trimStderr` |
| decision card | `decision-card.mjs` | `CARD_KINDS`, `validateCard`, `normalizeOptions`, `renderCard`, `storeCard`, `loadLastCard`, `recordChoice` |
| decision file / project fact | `decision-records.mjs` | `writeDecision`, `upsertProjectFact`, `bangkokParts` |
| git flow | `git-flow.mjs` | `planHashOf`, `dirtyInventory`, `snapshotDirty`, `gitFacts`, `planBranch/applyBranch`, `classifyPaths`, `planDelivery/applyDelivery`, `forgeOf`, `compareUrl`, `prDecision`, `integrationOptions`, `planIntegration/applyIntegration` |
| project mode / spec location | `project-profile.mjs` | `loadProject`, `validateProject`, `specIndexInfo`, `fingerprintMatches`, `discoverSpecCandidates`, `verifySpecPath`, `resolveSpecSources`, `inferProject`, `initProject`, `setProjectValue` |
| local memory | `local-memory.mjs` | `loadLocalMemory`, `setLocalPath`, `addWorkingNote`, `localPathsForLeakCheck`, `ensureStateIgnore` |
| workflow policy | `workflow-policy.mjs` | `loadPolicy`, `isProtected`, `workTypeOf`, `policyCard`, `setPolicyValue` |
| instruction chain | `instruction-chain.mjs` | `resolveTargetRoots`, `instructionChain`, `readRequired`, `acknowledge`, `rootCard` |
| identity | `identity.mjs` | `identityKey` (export แล้ว) |

**Decision ของ 4.6.0 ที่ override spec เดิม**:

| # | As-built | Override |
| --- | --- | --- |
| B1 | work branch สร้างด้วย `git switch --no-track -c <name> origin/<base>`; local protected branch ไม่ถูก checkout/เลื่อน | §7.3 D1 |
| B2 | `context` read-only เสมอ; ผล discovery เขียน local memory เฉพาะตอน `--ack`; นอก repo ต้องมี `--target` (`ACK_TARGET_REQUIRED`) | §19.5 ข้อ 2.4 |
| B3 | mode confidence high = คะแนนสูงสุด ≥ 4 และนำ ≥ 3; หลักฐาน spec/code ขัดกัน = low เสมอ | §19.6 |
| B4 | policy card ใช้ `recordAs: "policy:init"`; card kind มี `project` และ namespace `project:` / `local:spec:` | §5.7, §19.12 |
| B5 | `memory/current/**` ไม่ถูก deliver; `.agrimap-agent/.gitignore` stage ได้; commit ที่มี trailer ของ execution แล้วจะไม่ commit audit-only ซ้ำ | §8.2 |
| B6 | local-merge ใช้ verification ของ delivery ซ้ำ ตรวจใหม่เมื่อ target ขยับหรือ delivery unverified; `backMerge` คืนเป็นคำสั่ง follow-up ไม่รันเอง | §9.4 |
| B7 | root card นอก repo render แต่ไม่เก็บเป็น `lastCard` | §4.2, §9.6 |
| B8 | marker maintainer-only ประกอบ string ตอน runtime (`package:build` ปฏิเสธไฟล์ที่มี literal) | §4.2 |

**Carry-over ที่ต้องปิดใน P2** (§20.2 งาน R):
- `GLAB_UNVERIFIED` — flag ของ `glab` ทดสอบแค่ stub
- **Audit residue**: event ที่เขียนหลัง delivery (`delivered`, `completed`, `integrated`, recent memory) ค้าง dirty; `ownDirty()` ข้าม `.agrimap-agent/` จึงไม่ block integrate แต่ `start` ของงานถัดไป snapshot เป็น `preexistingDirty` → **ไม่มีวันถูก commit** (audit หาย)
- one-time card ของ §19.10 ("ทำแบบนี้ทุกงานไหม" เมื่อ code-first สั่งอัปเดต spec) ยังไม่มีในโค้ด

### 20.2 P2 — 4.7.0: Spec sync (C9-B) + carry-over

**Scope**: §19.7, §19.7.1, §19.8, §19.8.1, §19.9, §19.10, §19.11, `spec` commands ของ §19.12, แถว C5/C6 ของ §19.13, pre-write gate ข้อ 9, `spec-driven.md` ส่วน Before writing / After verification, tests §19.19 (P2), AC18–AC21 + AC23–AC26 ด้านล่าง
**นอก scope**: recall/signals/digest (P3), guards (P4), การย้าย spec pack จริงเข้า Git (§19.21 — งาน operator ที่ต้องมี URL แยกต่างหาก)

**ลำดับงาน**

| # | งาน | ไฟล์ | รายละเอียดที่ต้องทำ |
| --- | --- | --- | --- |
| 1 | YAML line-subset | `scripts/yaml-lines.mjs` (ใหม่) | ดู §20.2.1 |
| 2 | Adapters | `scripts/spec-adapters.mjs` (ใหม่) | interface §19.7; `morynth-context-index@1` ตรวจจากบรรทัด `schema: morynth-context-index@1` ใน `06-agent/CONTEXT-INDEX.yaml`; `generic-markdown` เป็น fallback; เจอ `.specify/`, `.kiro/specs/`, `openspec/` → generic + warning `SPEC_FORMAT_FALLBACK` |
| 3 | Sync engine | `scripts/spec-sync.mjs` (ใหม่) | `specContext`, `planSpecSync`, `applySpecSync`, `specCheck`, `chooseStatusValue` (§19.7.1); เขียนไฟล์แบบ temp + rename ต่อไฟล์; `planHashOf` จาก `git-flow.mjs`; manifest: `sha256(bytes)` + สองช่องว่าง + path แบบ `/`, LF, คงลำดับเดิม ไฟล์ใหม่ต่อท้าย |
| 4 | Commands | `governance-commands.mjs` | เพิ่ม `spec` ใน `GOVERNANCE_COMMANDS`: `spec context`, `spec sync plan`, `spec sync apply --plan-hash H`, `spec check`; args ตาม §19.8, §19.9, §19.11 |
| 5 | Delivery gate | `git-flow.mjs#planDelivery` | precondition 7: `SPEC_NOT_SYNCED` (self-fix → warn) + `--spec-na "<reason>"`; `specs.enforcement:"block"` → `SPEC_SYNC_REQUIRED` (stop); เพิ่ม `specLine` ให้ summary (`- Spec: FE-005 → delivered · evidence 3 · manifest updated` หรือ `- Spec: ไม่เกี่ยว (code-first)`) |
| 6 | Spec repo แยก | `git-flow.mjs`, `session-state.mjs` | external source ที่ `git rev-parse` ผ่าน = target root ที่สอง: session state เก็บ execution ต่อ root (`activeByRoot[<root>]`); `deliver plan --cwd <specRoot>` ใช้ policy ของ spec repo (ไม่มี → card policy ตาม §6.4); summary รายงานสอง commit; non-git → warning `SPEC_SOURCE_NOT_GIT` ทุก delivery |
| 7 | Semantic pending | `spec-sync.mjs` | semantic change ที่รอ card (§19.8.1) → ไม่เขียน, warning `SPEC_DECISION_PENDING` + card id, mechanical sync ทำต่อ |
| 8 | Warning surfacing | `git-flow.mjs`, `governance-commands.mjs` | event `delivered` มี `warnings[]`; `context` ครั้งแรกของ session ใน scope spec-first เรียก `specCheck` แบบ bounded (≤ 50 รายการ) แล้วคืน `openWarnings` ≤ 5 บรรทัด; บันทึกว่าเรียกแล้วใน session state (`specCheckedAt`) |
| 9 | One-time card §19.10 | `project-profile.mjs` + `spec-driven.md` | ฟังก์ชัน `specStandingCard({mode})` คืน card R1 "ทำแบบนี้ทุกงานไหม" (`recordAs: "project:specs.sync"` + ตั้ง `hybrid` + scope ของไฟล์ที่แตะ เมื่อเลือกข้อ 1); agent เรียกเมื่อผู้ใช้สั่งอัปเดต spec ในโหมด code-first |
| 10 | Pre-write gate / refs | `references/goal-rules.md`, `references/spec-driven.md` | ข้อ 9 (≤ 30 words); `spec-driven.md` ให้ตรง §19.18 + ประโยค `SPEC_NOT_SYNCED` แบบ V2.1 |
| R1 | Audit residue | `git-flow.mjs#snapshotDirty`, `classifyPaths` | path ใน allowlist audit (`logs/**`, `memory/recent/**`, `reports/**`, `decisions/**`) **ไม่ถูกนับเป็น preexisting** และถูก classify เป็น `own` ใน delivery ถัดไปเสมอ (audit เป็น append-only จึงรวมได้ปลอดภัย); `memory/current/**`, `runtime/**`, `cache/**`, `local/**`, `prompts/**`, `tasks/**` คงถูกตัด |
| R2 | glab | `git-flow.mjs` | ถ้าเครื่องที่ทำมี `glab` ให้ตรวจ flag กับ `glab mr <cmd> --help` แล้วแก้ให้ตรง; ไม่มี → คง stub และคง warning `GLAB_UNVERIFIED` ใน PR |
| 11 | Fixture | `tests/fixtures/spec-pack-morynth/` | สังเคราะห์: `06-agent/CONTEXT-INDEX.yaml` (มี `read_order`, `canonical_files`, `project.id/version`), `06-agent/TASKS.yaml` (3 task: `planned`, `delivered`, และหนึ่ง block ไม่มีบรรทัด status), `06-agent/REQUIREMENTS.yaml`, `06-agent/OPEN-QUESTIONS.yaml` (อ้าง FE-002), `00-source-of-truth/TRACEABILITY.md`, `CHANGELOG.md`, `manifest.sha256`, `goals/login/README.md` — ห้ามคัดลอกเนื้อหาจริงของ pack |
| 12 | Docs/version | `package.json`, `CHANGELOG.md`, `docs/WORKFLOWS.md`, `docs/USAGE.md` | bump 4.7.0 ก่อน sync; เอกสารผู้ใช้เรื่อง spec sync และ warning |

#### 20.2.1 `yaml-lines.mjs` — contract

ไม่ใช่ YAML parser เต็ม — รองรับเฉพาะรูปแบบที่ spec pack ใช้; ส่วนที่ไม่รองรับคืน `{ ok:false, code:"ADAPTER_PARSE_FAILED", line }` เฉพาะ construct นั้น

| API | พฤติกรรม |
| --- | --- |
| `topLevelScalar(text, key)` | ค่า scalar ของ `key:` ที่ indent 0 |
| `mappingUnder(text, key)` | mapping ระดับถัดไป (indent 2) ของ key → `{k: v}` เฉพาะ scalar |
| `listUnder(text, key)` | list ของ scalar (`- x`) หรือ inline `[a, b]` |
| `listItemBlocks(text, listKey, idKey = "id")` | block ของ item `- id: X` ใต้ `listKey` → `[{ id, startLine, endLine, fieldIndent, fields: { <name>: { line, value } } }]`; block จบเมื่อเจอ `- id:` ถัดไปที่ indent เท่ากันหรือ key ที่ indent น้อยกว่า |
| `setBlockScalar(text, block, field, value)` | แทนเฉพาะค่าหลัง `field: ` (คง comment ท้ายบรรทัด) คืน `{ text, edit: {line, before, after} }` |
| `insertBlockScalar(text, block, field, value)` | แทรก `field: value` ถัดจากบรรทัด `- id:` ด้วย `fieldIndent` |

กติกา: indent เป็นช่องว่างเท่านั้น (tab → parse fail), รองรับ quote `'..'`/`".."`, comment `#` นอก quote, CRLF อ่านได้และเขียนกลับด้วย line ending เดิมของไฟล์

#### 20.2.2 Tests P2 (เพิ่มจาก §19.19)

| ไฟล์ | กรณี |
| --- | --- |
| `tests/unit/yaml-lines.test.mjs` | ทุก API ข้างบน, comment ท้ายบรรทัด, quote, CRLF round-trip, tab → fail เฉพาะ construct |
| `tests/unit/spec-sync.test.mjs` | §19.19 ข้อ 1–8 + `SPEC_FORMAT_FALLBACK` + `chooseStatusValue` ครบ 5 semantic + `STATUS_VALUE_UNKNOWN` |
| `tests/unit/git-flow.test.mjs` (เพิ่ม) | `SPEC_NOT_SYNCED` → self-fix → warn; `enforcement:"block"` → stop; spec repo แยก = สอง commit ใน summary; `SPEC_SOURCE_NOT_GIT`; **R1**: หลัง integrate แล้วเริ่มงานใหม่ ไฟล์ audit ค้างถูกรวมใน delivery ถัดไป |
| `tests/unit/project-profile.test.mjs` (เพิ่ม) | `specStandingCard` → ตอบ 1 แล้ว `project.json` เป็น hybrid + `sync:"auto"` + decision |

เพิ่มไฟล์ใหม่ใน `scripts.test:unit`

#### 20.2.3 Acceptance P2

AC18–AC21 (§19.20) และ:

| ID | เกณฑ์ |
| --- | --- |
| AC23 | spec pack ที่เป็น Git repo แยก: งานเดียวได้สอง commit (repo code และ spec repo) push และ verify ทั้งคู่ |
| AC24 | audit event หลัง delivery (`delivered`/`completed`/`integrated`) ถูก commit ใน delivery ถัดไป ไม่ค้างถาวร |
| AC25 | `yaml-lines` แก้ status ของ task เดียวแล้ว `git diff` เปลี่ยนหนึ่งบรรทัด และคง comment/line ending |
| AC26 | code-first + ผู้ใช้สั่ง "อัปเดต spec ด้วย" ครั้งเดียว → card หนึ่งครั้ง → งานถัดไปไม่ต้องสั่ง |

### 20.3 P3 — 4.8.0: Decision memory (C7) + digest + instruction diet

**Scope**: §10 ทั้งหมด, แถว P3 ของ §5.9 (`decide correction`, `decide list`, recall/calibration ใน `decide card`), `recall`, digest ใน hook (§10.7), instruction diet (§16.3), AC10–AC12 + AC27–AC29 ด้านล่าง
**นอก scope**: guards/Stop hook (P4)

| # | งาน | ไฟล์ | รายละเอียด |
| --- | --- | --- | --- |
| 1 | Frontmatter + index | `scripts/decision-memory.mjs` (ใหม่) | `parseFrontmatter` ต้องอ่านสิ่งที่ `decision-records.mjs#writeDecision` เขียนได้ครบ (เขียน round-trip test); index cache `.agrimap-agent/cache/decisions-index.json` rebuild ตาม `fileCount`/`maxMtimeMs` (§10.3); decision รุ่นเก่าใช้ default §10.2 |
| 2 | Recall | `decision-memory.mjs` | scoring/threshold/glob/cap 2,000 chars ตาม §10.4; export `recall({ root, topic, paths, kind, limit })` |
| 3 | Signals/learning | `decision-memory.mjs` | `recordSignal`, `promotable`, `calibration`, preference file `runtime/preferences/<identityKey(machine-osUser)>.json` (`alwaysAsk`, `declinedPromotion`) ตาม §10.6; ทุกไฟล์อยู่ใต้ `runtime/` (ไม่ commit) |
| 4 | Card integration | `decision-card.mjs` | `storeCard` ก่อนเก็บ: recall → `suppressed` (score ≥ 7, topic ตรง, value ตรง option); calibration → `autoDecided` เฉพาะ R1 + medium + mode `decide-and-report` และไม่อยู่ใน `alwaysAsk`; `recordChoice` เขียน signal; ต้องอ่าน config `governance.decisionMemory` — false = พฤติกรรม 4.7.0 |
| 5 | Commands | `governance-commands.mjs` | เพิ่ม `recall`; `decide correction --topic --from --to [--paths]`; `decide list [--status]` |
| 6 | Audit fields | `agm-workspace.mjs` (`checkpoint`, `complete`, `normalizeAuditEvent`) | `--precedent <id,…>` → field `precedents`; `questionsAvoided` จาก session state ลง event `completed`; field ใหม่ผ่าน `auditEventIssues` ได้ |
| 7 | Git decisions ใช้ precedent | `git-flow.mjs`, `workflow-policy.mjs` | DP4 (§10.5): ก่อนสร้าง card เรื่อง git ให้ recall topic `git/*` |
| 8 | Digest | `hook-context.mjs` | หลัง `shortReplyContext()`; เงื่อนไข/เนื้อหา/hash ตาม §10.7 + บรรทัด mode/spec ของ §19.13; `digestHash` ใน session state; ≤ 600 chars; ห้าม git/network ใน hook (อ่านไฟล์ JSON/markdown ≤ 5 ไฟล์) |
| 9 | Reference | `references/autonomy.md` | เพิ่ม recall/promotion/"ถามก่อนเสมอเรื่อง X" ภายใน ≤ 450 words |
| 10 | Instruction diet | `assets/bootstrap/AGENTS.md`, `assets/bootstrap/AGENTS.release.md` (ใหม่), `assets/bootstrap/manifest.json`, `scripts/project-bootstrap.mjs`, `references/release-*.md` | ดู §20.3.1 |
| 11 | Version/docs | `package.json` 4.8.0 ก่อน sync, `CHANGELOG.md`, `docs/WORKFLOWS.md`, `docs/USAGE.md` | |

#### 20.3.1 Instruction diet — ขั้นตอน

ขนาดปัจจุบันของ bootstrap `AGENTS.md` บน develop: 501 บรรทัด / 103,014 bytes (ภาษาไทยเป็น multi-byte) และถูก `CLAUDE.md` import ทุก session

1. แยกไฟล์ (ย้ายข้อความทั้งก้อน ไม่เขียนใหม่ และ **คงเลข §** เดิม เพื่อไม่ให้ reference พัง):

   | อยู่ใน `AGENTS.md` (core) | ย้ายไป `AGENTS.release.md` |
   | --- | --- |
   | §1, §3, §9, §10, Bootstrap contract freshness, Host recording example | §2 (ทั้งตารางและ §2.1–§2.3), §4, §5 (รวม §5.1–§5.2), §6 (รวม §6.1–§6.3), §7, §8 (รวม §8.1) |

2. ใน core แทน §2 ด้วยหัวข้อสั้น `## 2. Intent routing` + ตาราง 2 แถว: (a) intent เรื่อง changelog/backfill/version/deploy/release/tag ทุกคำ → "อ่าน `AGENTS.release.md` ทั้งไฟล์ก่อนเริ่ม แล้วทำตาม §2 ในไฟล์นั้น" (b) แถว `integrate` (คงไว้ใน core) และบรรทัดว่า section ที่อ้าง §4–§8 อยู่ใน `AGENTS.release.md`
3. `AGENTS.release.md` ขึ้นต้นด้วย marker `<!-- AGRIMAP BOOTSTRAP VERSION: … -->` แบบเดียวกัน และประโยคว่าใช้ร่วมกับ `AGENTS.md` core
4. `manifest.json`: เพิ่ม entry `AGENTS.release.md` (source/target/sha256); `tools/sync-adapters.mjs` อัปเดต marker ของทั้งสองไฟล์ (ตอนนี้ทำเฉพาะ `AGENTS.md` — ต้องขยาย)
5. `project-bootstrap.mjs`: plan/apply ติดตั้งไฟล์ใหม่ด้วย; โปรเจกต์ที่มี `AGENTS.md` 4.7.0 แบบไม่แก้ → auto update ทั้งคู่; แบบแก้แล้ว → scoped merge เดิม (ไฟล์ release ใหม่เป็น `create`)
6. อัปเดต reference ที่อ้าง §2/§4–§8 ของ project AGENTS (`references/release-and-bootstrap.md`, `release-workflow.md`, `release-steps.md`, `release-flash.md`, `lifecycle-core.md`) ให้ระบุว่าอยู่ใน `AGENTS.release.md`
7. Test ใหม่ใน `bootstrap-contract.test.mjs`: core ≤ 24,000 characters (≈ ≤ 8k tokens ที่ 3 chars/token); union ของ core + release มีทุกหัวข้อเดิม; upgrade จาก template 4.7.0 ทั้งแบบไม่แก้และแบบแก้; hash ที่ freeze ใน test ปรับโดยตั้งใจ
8. ห้ามเปลี่ยนความหมายของกติกา release ใดๆ ในงานนี้ — เป็นการย้ายไฟล์ล้วน

#### 20.3.2 Tests / Acceptance P3

Tests: §15.3 (P3) + round-trip `writeDecision` → `parseFrontmatter` + digest test + diet tests (§20.3.1 ข้อ 7) + `governance.decisionMemory:false` = ไม่ recall

| ID | เกณฑ์ |
| --- | --- |
| AC10–AC12 | ตาม §17 |
| AC27 | precedent id อยู่ใน event `completed` (`precedents`) และ `questionsAvoided` นับตรง |
| AC28 | core `AGENTS.md` ≤ 24,000 chars และทุก release intent ยังทำงานได้ (release tests ผ่าน) |
| AC29 | "ถามก่อนเสมอเรื่อง convention" ทำให้ R1 convention card ไม่ถูก auto-decide แม้ acceptRate สูง |

### 20.4 P4 — 4.9.0: Guards + Stop reminder (C8)

**Scope**: §11.2, §11.3, แถว C8 ของ §19.13, แถว P4 ของ §11.1, AC13 + AC30–AC31

**ขั้น 0 — ยืนยัน host ก่อนเขียนโค้ด** (บันทึกผลใน PR เป็นตาราง host × event × input/output format × แหล่งอ้างอิง):
- Claude Code: `PreToolUse` (`hookSpecificOutput.permissionDecision: allow|deny|ask`, `permissionDecisionReason`) และ `Stop` (`decision: "block"`, `reason`, input `stop_hook_active`) — ตรวจกับเอกสาร Claude Code รุ่นที่ติดตั้ง
- Codex: ตรวจว่ามี pre-tool hook และรูปแบบ output หรือไม่ (`codex --help`, เอกสารทางการ) — ไม่มี = ไม่ติดตั้ง
- Antigravity/Gemini: ตรวจ `BeforeTool` และรูปแบบ output — ไม่แน่ใจ = ไม่ติดตั้ง
- host ที่ไม่ยืนยัน: doctor รายงาน `guards: not-supported-on-host` และ enforcement ยังอยู่ใน script (deliver/integrate) ตามเดิม

| # | งาน | ไฟล์ | รายละเอียด |
| --- | --- | --- | --- |
| 1 | Guard | `scripts/git-guard.mjs` (ใหม่) | parser แยก git invocation จาก Bash และ PowerShell (`;`, `&&`, `\|\|`, `\|`, newline, `&` ของ PowerShell call operator, backtick continuation); rule G1–G6 (§11.2) + G3 เพิ่ม `.agrimap-agent/local` และ `git add -f` ใต้ `local/`; release exception อ่าน active operation จาก `session-state.mjs`; protected list จาก `workflow-policy.mjs#loadPolicy` ของ `gitTop(tool cwd)`; fail-open; ต้องอ่าน `governance.guards` — false = no-op |
| 2 | Stop reminder | `scripts/delivery-reminder.mjs` (ใหม่) | §11.3; marker `runtime/reminders/<executionId>` |
| 3 | Hook generation | `tools/sync-adapters.mjs#providerHooks` | เพิ่ม `PreToolUse` (matcher `Bash\|PowerShell`) และ `Stop` ให้ claude; codex เฉพาะที่ยืนยันแล้ว; `hooks/hooks.json` (Gemini) เพิ่ม `BeforeTool` เฉพาะที่ยืนยัน |
| 4 | Validator | `tools/validate-package.mjs` (~บรรทัด 310–317) | ตรวจ event ใหม่ + `--provider <host>` ทุก command |
| 5 | Doctor | `references/doctor-workflow.md` | แถว `guards`: flag, host support, hook ที่ติดตั้ง |
| 6 | Config default | `agm-workspace.mjs#ensureLayout` | `governance.guards` default true สำหรับ layout ใหม่; project เดิมคงค่าที่มี (ไม่มี key → true) |
| 7 | Version/docs | `package.json` 4.9.0 ก่อน sync, `CHANGELOG.md`, `docs/TROUBLESHOOTING.md` (วิธีปิด guard ต่อ project) | |

Tests: `tests/unit/git-guard.test.mjs` (ทุก rule ทั้ง Bash/PowerShell, release exception, fail-open, flag false), `tests/unit/delivery-reminder.test.mjs` (block ครั้งเดียว, `stop_hook_active`), `validate-package` กับ hook ชุดใหม่

| ID | เกณฑ์ |
| --- | --- |
| AC13 | ตาม §17 |
| AC30 | `governance.guards:false` → hook คืนค่าว่างทุกคำสั่ง |
| AC31 | Stop reminder เตือนครั้งเดียวต่อ execution และไม่ loop |

### 20.5 กติการ่วมทุก phase

1. Branch `feature/acg-p<N>-<version>` จาก `origin/develop` (ใช้ B1: `git switch --no-track -c … origin/develop`); ห้าม stage ไฟล์ค้างที่ไม่เกี่ยว (`DEVELOPMENT.md`, `tests/unit/package-release.test.mjs`, `tools/check-package-pr.mjs` ถ้ายังค้าง)
2. `package.json` version ใหม่ **ก่อน** `npm run sync` (§16.2) แล้วตรวจ `manifest.json` มี `previous` ของรุ่นก่อน
3. ตรวจก่อน PR: `npm run sync` → ไม่มี drift → `npm test` → `npm run test:release` (บน Windows รันจาก PowerShell) → `npm run audit:tokens:strict` → `npm run package:build`
4. Budget direct/required ห้ามเพิ่ม; scenario ใหม่ถ้าจำเป็นต้องมีเหตุผลใน description + CHANGELOG
5. เจอ spec ขัดโค้ดจริง → ตัดสินตาม §2.4 และ **เพิ่มแถวในตาราง as-built ของ phase นั้น** (สร้าง §20.1-P<N> ใน spec) ใน PR เดียวกัน
6. PR เข้า `develop` (ไม่ใช่ `main` — route check จะ fail) body: สรุปตาม component, AC → หลักฐาน, คำสั่ง+ผล, assumptions, ⚠️ open warnings, deferred
7. Release หลัง merge: `release/<version>` → PR เข้า `main` → `package-release.yml` (`version`, `promote_latest=true`) → reviewer approve — ไม่อยู่ในงาน implement
8. Phase ต้องทำตามลำดับ P2 → P3 → P4 เพราะแก้ไฟล์ร่วมกัน (`decision-card.mjs`, `hook-context.mjs`, `governance-commands.mjs`, `sync-adapters.mjs`)

---

## Appendix A — ตัวอย่าง flow

### A.1 งานแรกใน project ที่ยังไม่มี policy

```text
User: เพิ่ม export CSV ให้หน้า order ใน agmws-orders-netcore
Agent: context → root = agmws-orders-netcore, อ่าน/ack AGENTS.md → policy show: ไม่มี → policy infer (high)
Agent: แผน: เพิ่ม endpoint GET /api/orders/export ใช้ CsvHelper ที่มีอยู่ + test
       **ต้องตัดสินใจ: ใช้ workflow นี้กับโปรเจกต์นี้ไหม** — ถามครั้งเดียว
       ตรวจแล้ว: Jenkinsfile + Jenkinsfile_Production; origin/develop, jenkins, jenkins-release; feature/* 9 branches
       1. ใช้ตามที่ตรวจพบ (แนะนำ) — feature|fix|hotfix/* จาก develop → commit+push เมื่อเสร็จ → PR เมื่อสั่ง
       2. ใช้แต่ไม่ push อัตโนมัติ
       3. ไม่ใช้ work branch
User: 1
Hook: inject "selects option 1 of card …"
Agent: decide record → policy/workflow.json confirmed → start → branch plan/apply → feature/order-csv-export
       … แก้ code, test ผ่าน, changelog → deliver plan/apply → integrate options
Agent: ✅ เสร็จและส่งขึ้น branch แล้ว … ถัดไป 1. เปิด PR → develop (แนะนำ) 2. แก้ต่อ 3. พักไว้
```

### A.2 งานถัดไป (policy มีแล้ว)

```text
User: แก้ bug วันที่ export เป็น UTC
Agent: (ไม่ถาม workflow) → fix/export-date-timezone จาก develop → แก้ + regression test → deliver
Agent: ✅ … ถัดไป 1. เปิด PR → develop (แนะนำ) 2. แก้ต่อ 3. พักไว้
User: pr
Agent: integrate plan --intent open-pr → gh pr create … → "PR #42 → develop: <url>" + card 1. Merge PR #42 เมื่อ review ผ่าน …
User: merge
Agent: gh pr view 42 → CLEAN → gh pr merge 42 --merge → verify origin/develop มี commit → card ลบ branch ไหม
```

### A.3 Local-merge แล้ว conflict

```text
User: รวมเข้า develop
Agent: integrate plan (local-merge) → ขั้น A: git merge --no-edit origin/develop → conflict src/Orders/Export.cs
       → git merge --abort
       **ต้องตัดสินใจ: develop มีการแก้ Export.cs ชนกับงานนี้** — ยังไม่ได้ merge อะไรเข้า develop
       ตรวจแล้ว: conflict 1 ไฟล์ (src/Orders/Export.cs) จาก commit 7c1d2e0 ของ develop
       1. แก้ conflict บน work branch แล้ว test ใหม่ (แนะนำ) — develop ไม่ถูกแตะจนกว่าจะผ่าน
       2. หยุดไว้ให้ดูเอง
```

### A.4 Session เปิดที่ directory แม่

```text
cwd = D:\Projects\46_ArgiMap\Projects\AgriMapPlatform (ไม่ใช่ git)
User: แก้ validation ใน dynamic form service
Hook: "Session cwd is outside any Git repository … Repositories below: agmws-dynamic-form-netcore, agmws-ckan-netcore, …"
Agent: context --hint "dynamic form" → ถ้ามีคู่ที่ตรงชัด 1 repo → resolve; ไม่ชัด → root card
       อ่าน/ack services/agmws-dynamic-form-netcore/AGENTS.md → ทำงานต่อใน repo นั้น; ไม่มีไฟล์ใดถูกเขียนที่ AgriMapPlatform/
```

### A.5 Precedent ตัดคำถาม (P3)

```text
Agent: ต้องเลือกชื่อ SP ใหม่ → decide card (topic sql/proc-naming)
Script: recall → decision 14093012 approved score 9 → suppressed
Agent: ใช้ UM_ORDER_EXPORT_Q ตาม decision 14093012 (ไม่ถาม) → รายงานอ้าง decision นั้น
```

---

## Appendix B — ตัวอย่าง JSON

### B.1 `context` (cwd ไม่ใช่ git, มี hint)

```json
{
  "ok": true, "resolved": true,
  "sessionCwd": "D:/Projects/46_ArgiMap/Projects/AgriMapPlatform",
  "cwdIsRepo": false,
  "targetRoot": "D:/Projects/46_ArgiMap/Projects/AgriMapPlatform/services/agmws-dynamic-form-netcore",
  "isLinkedWorktree": false, "branch": "develop",
  "stateRoot": "…/agmws-dynamic-form-netcore/.agrimap-agent",
  "chain": [
    { "relative": "AGENTS.md", "sha12": "3f9a0c11b2d4", "bytes": 41210, "bootstrapVersion": "4.5.5", "maintainerOnly": false, "pointerOnly": false, "nested": false },
    { "relative": "CLAUDE.md", "sha12": "a81e22c9d0f1", "bytes": 64, "bootstrapVersion": null, "maintainerOnly": false, "pointerOnly": true, "nested": false }
  ],
  "readRequired": ["AGENTS.md"],
  "strayStateRoots": ["D:/Projects/46_ArgiMap/Projects/AgriMapPlatform/.agrimap-agent"],
  "warnings": ["STRAY_STATE_ROOT"],
  "next": { "action": "read-and-ack", "files": ["AGENTS.md"], "command": "context --target <root> --session <id> --ack 3f9a0c11b2d4" }
}
```

### B.2 `branch plan`

```json
{
  "ok": true, "action": "create", "planHash": "9c2e…",
  "facts": { "current": "develop", "base": "develop", "behind": 2, "ahead": 0, "dirty": 0, "remote": true },
  "branch": "feature/order-csv-export", "remoteBranch": "feature/order-csv-export",
  "commands": [
    ["git", "merge", "--ff-only", "origin/develop"],
    ["git", "switch", "-c", "feature/order-csv-export"]
  ],
  "warnings": [], "card": null
}
```

### B.3 `deliver plan`

```json
{
  "ok": true, "planHash": "41aa…",
  "counts": { "own": 5, "foreign": 1, "mixed": 0, "excluded": 1 },
  "paths": {
    "own": ["src/Orders/ExportController.cs", "src/Orders/OrderCsvWriter.cs", "tests/Orders/OrderCsvWriterTests.cs", "changelog.md", ".agrimap-agent/logs/2026-09/2026-09-18/18101530.jsonl"],
    "foreign": ["appsettings.Local.json"],
    "excluded": [".agrimap-agent/runtime/sessions/abc.json"]
  },
  "message": { "header": "feat(orders): add CSV export endpoint", "trailers": ["AGM-Execution: 18101530"] },
  "push": { "enabled": true, "refspec": "HEAD:refs/heads/feature/order-csv-export" }
}
```

### B.4 `lastCard` ใน `runtime/sessions/<S>.json`

```json
{
  "lastCard": {
    "cardId": "18101530-integration-1", "kind": "integration", "topic": "git/integration", "risk": "R3",
    "options": [
      { "id": "1", "label": "เปิด PR → develop", "value": "open-pr" },
      { "id": "2", "label": "แก้ต่อ", "value": "continue" },
      { "id": "3", "label": "พักไว้", "value": "park" }
    ],
    "recommended": "1", "recordAs": "none",
    "createdAt": "2026-09-18T03:40:00Z", "expiresAt": "2026-09-19T03:40:00Z"
  }
}
```

---

## Appendix C — Error code catalog

| Code | Severity (§2.4) | ความหมาย | Agent ทำต่อ |
| --- | --- | --- | --- |
| `TARGET_NOT_GIT` | stop | `--target` ไม่อยู่ใน git | ถามผู้ใช้ path ที่ถูก |
| `PATH_NOT_IN_GIT` | stop | path ในงานไม่อยู่ใน git | แจ้ง path; ไม่เขียน |
| `ACK_HASH_MISMATCH` | self-fix | ไฟล์เปลี่ยนหลังอ่าน | อ่านใหม่แล้ว ack |
| `INSTRUCTIONS_NOT_ACKNOWLEDGED` | self-fix | ยังไม่ได้อ่าน chain | อ่านตาม `next.files` แล้ว ack |
| `POLICY_REQUIRED` | self-fix (ครั้งแรกเป็น card ในรอบคำถามแรก) | ไม่มี policy | `policy infer` → card |
| `POLICY_INVALID` | warn (ทำงานแบบไม่มี policy: ไม่ commit อัตโนมัติ) | policy ผิด schema | แสดง `details`; ไม่ deliver |
| `POLICY_HOTFIX_BASE_BREAKS_FF_PROMOTION` / `POLICY_BASE_BREAKS_FF_PROMOTION` | warn | base ขัดกับ ff-only promotion | อธิบายและเสนอ develop |
| `CARD_INVALID` / `CARD_NOT_FOUND` / `CARD_EXPIRED` | self-fix | card ใช้ไม่ได้ | สร้าง card ใหม่ |
| `DETACHED_HEAD` / `OPERATION_IN_PROGRESS` | stop | สถานะ git ไม่พร้อม | card ให้ผู้ใช้เลือก; ไม่ abort งานของผู้ใช้เอง |
| `BRANCH_NAME_INVALID` / `BRANCH_NAME_EXHAUSTED` | self-fix | ชื่อ branch ใช้ไม่ได้ | เปลี่ยน slug |
| `PLAN_STALE` | self-fix | สถานะเปลี่ยนหลัง plan | plan ใหม่ |
| `NO_ACTIVE_EXECUTION` | self-fix | ยังไม่ `start` | start ก่อน |
| `BRANCH_MISMATCH` | self-fix → stop ถ้า switch ไม่ได้ | อยู่คนละ branch กับที่บันทึก | switch กลับหรือ plan ใหม่ |
| `PROTECTED_BRANCH` | stop | พยายาม deliver บน protected | branch plan |
| `DELIVERED_UNVERIFIED` (V2.1 แทน `VERIFICATION_NOT_PASSED`) | warn | verification ไม่ผ่านหรือไม่ได้รัน | deliver work branch พร้อม trailer `AGM-Verification`; ไม่เสนอ merge จนกว่าจะผ่าน |
| `SECRET_SUSPECTED` | stop | พบข้อมูลลับ | card R3; ห้ามแสดงค่า |
| `CHANGELOG_REQUIRED` | self-fix | ขาด changelog | เติมตาม project AGENTS §5 |
| `MESSAGE_REQUIRED` / `MESSAGE_INVALID` | self-fix | commit message ไม่ได้มาตรฐาน | เขียน `--input` |
| `REMOTE_AHEAD` | self-fix → stop ถ้า conflict | remote work branch ขยับ | `update-branch` แล้ว push |
| `PUSH_AUTH` / `PUSH_NETWORK` / `PUSH_FAILED` | stop (AUTH/FAILED) · warn (NETWORK: commit อยู่ครบ retry ได้) | push ไม่สำเร็จ | รายงาน; retry `--push-only` เมื่อแก้แล้ว |
| `REMOTE_MISMATCH` | stop | remote SHA ไม่ตรง | ตรวจ `ls-remote` แล้วรายงาน |
| `DELIVERY_REQUIRED` | self-fix | ยังไม่ได้ push ก่อน integrate | deliver |
| `DIRTY_TREE` | self-fix → stop ถ้าเป็นงานที่ค้างก่อนเริ่ม | มีงานค้างบน branch | deliver หรือถาม |
| `MERGE_CONFLICT` | stop | conflict ตอน update | card §A.3 |
| `TARGET_NOT_ALLOWED` / `TARGET_IS_RELEASE_FLOW` | stop | target ไม่อยู่ใน policy / เป็น release branch | อธิบาย + release intent |
| `REMOTE_TARGET_ADVANCED` | self-fix | target ขยับระหว่าง integrate | plan ใหม่ |
| `PROTECTED_BY_SERVER` | stop | server ปฏิเสธ push | แนะนำ PR |
| `PR_BLOCKED` / `PR_CHECKS_FAILING` | stop (ห้าม bypass) | PR ยัง merge ไม่ได้ | รายงานสิ่งที่รอ; ไม่ bypass |
| `NO_REMOTE` (warning) | warn | ไม่มี origin | commit อย่างเดียว |
| `PROJECT_PROFILE_INVALID` (V2) | warn | `project.json` ผิด schema | แสดง details; ถือเป็น code-first จนกว่าจะแก้ |
| `LOCAL_MEMORY_UNRECOGNIZED` (V2, warning) | warn | `local/memory.md` ไม่มี marker | ทำงานต่อโดยไม่ใช้ไฟล์นั้น; เสนอสร้างใหม่ |
| `LOCAL_PATH_STALE` (V2, warning) | warn | path ใน local memory ไม่มีแล้วหรือ fingerprint ไม่ตรง | bounded discovery แล้ว card ถ้าไม่เจอ |
| `LOCAL_MEMORY_TRACKED` (V2, warning) | warn | `local/` ถูก track ใน git | แนะนำ `git rm --cached` (ให้ผู้ใช้ตัดสิน) |
| `LOCAL_PATH_LEAK` (V2) | self-fix → stop ถ้าแทนไม่ได้ | ไฟล์ที่จะ commit มี absolute path จาก local memory | เปลี่ยนเป็น id ของ spec source |
| `SPEC_SOURCE_MISSING` (V2, warning) | warn | source แบบ repo ไม่มี path นั้น | รายงาน; ถามถ้างานต้องใช้ spec |
| `SPEC_SYNC_REQUIRED` (V2) | stop (เฉพาะ `enforcement:"block"` ที่ทีมเปิดเอง) | งานใน scope ของ spec ยังไม่ sync | `spec sync plan/apply` หรือ `--spec-na` พร้อมเหตุผล |
| `ADAPTER_PARSE_FAILED` (V2) | warn | อ่าน index/task YAML ไม่ได้ | อ่าน entry เอง; sync ไฟล์นั้นไม่ได้ ต้องรายงาน |
| `TASK_STATUS_LINE_ADDED` (V2.1 แทน `TASK_STATUS_LINE_MISSING`) | warn | task block ไม่มีบรรทัด status | เพิ่มบรรทัดแล้วแจ้งใน ⚠️ |
| `SPEC_NOT_SYNCED` (V2.1) | self-fix → warn | งานใน scope ยังไม่ sync spec | รัน `spec sync`; ทำไม่ได้ → ส่งงานพร้อม warning |
| `STATUS_VALUE_NEW` (V2.1) | warn | เขียนค่า status ที่ไฟล์ยังไม่เคยใช้ | แจ้งค่าที่ใช้และวิธีตั้ง `statusMap` |
| `STATUS_VALUE_UNKNOWN` (V2.1) | warn | ไฟล์มีค่า status ที่แปลความหมายไม่ได้ | ไม่แก้ task นั้น แจ้งครั้งเดียว |
| `SPEC_DECISION_PENDING` (V2.1) | warn | semantic change รอคำตอบจาก card | sync ส่วน mechanical ต่อ; แก้เนื้อหาเมื่อได้คำตอบ |
| `SPEC_SOURCE_NOT_GIT` (V2.1) | warn | spec pack ยังไม่อยู่ใน Git | แก้ในเครื่องเท่านั้น; ชี้ §19.21 |
| `SPEC_SOURCE_UNRESOLVED` (V2.1) | warn | หา spec ในเครื่องไม่เจอและผู้ใช้เลือกทำต่อ | ทำงานต่อแบบไม่มี spec; แจ้งให้ clone/ระบุ path |
| `MANIFEST_MISMATCH` / `EVIDENCE_MISSING` / `DONE_WITHOUT_EVIDENCE` / `UNSYNCED_EXECUTION` (V2) | warn | ผลของ `spec check` | รายงาน; แก้เองเฉพาะของงานนี้ |

---

## Appendix D — ร่าง reference ใหม่ (ภาษาอังกฤษตาม convention ของ `references/`)

### D.1 `references/autonomy.md`

```markdown
# Autonomy: decide, ask or confirm

Load before the first requester question or product write. Scripts compute git mechanics; you decide meaning; the requester decides authority.

## Classify each consequential choice

- Owner. Agent-owned: internal implementation inside the authorized scope, FREE-tier choices, private names, helper reuse, test layout by convention, step order, branch slug, commit wording. Requester-owned: scope, observable behavior, shared/public contracts, data, security, new dependencies, cross-service ownership, base/target branch, integration, publication.
- Risk. R0 local and reversible; R1 reviewable, not a contract; R2 contract, behavior, data or scope; R3 outward or irreversible (push/merge protected branches, PR merge, remote delete, tags, destructive git).
- Confidence. High: explicit current instruction, approved precedent, confirmed workflow policy or AGENTS chain rule, or a golden MUST agreeing with at least three repository instances. Medium: one golden rule, convention or general practice without conflict. Low: conflicting or missing evidence. Surface conflicts; never resolve them silently.

## Act

Agent-owned R0/R1: decide (investigate first when Low). Requester-owned:

| | High | Medium | Low |
| --- | --- | --- | --- |
| R0 | decide | decide | investigate, decide |
| R1 | decide, mention | decide, list under "decided for you" | investigate, non-blocking card |
| R2 | decide, cite the source | blocking card for the affected slice | blocking card naming missing evidence |
| R3 | only under an explicit current command or confirmed policy | confirm | confirm |

Investigate before asking: search the repository, run `policy show` (and `recall` when available), read the AGENTS chain. Never ask what they already answer.

## Ask well

- At most one blocking round before the first write, up to three independent questions. A later R2 question pauses only its slice.
- Create each question with `agm-workspace.mjs decide card --input <file>`; render with the host's structured-question tool when available, otherwise the returned Markdown. Option 1 is the recommendation.
- Every card states impact, what you checked, options with different effects, the recommendation with reason and confidence, and its default or that it blocks.
- Never ask for permission already granted, a choice between equivalent options, an open-ended preference, or approval after acting.
- Record the answer with `decide record`; its `recordAs` prevents asking again.

## Report

Start: a 1–3 line plan and consequential assumptions. During: silent unless an R2+ decision or new risk appears. End: the delivery summary, up to five "decided for you" items with how to change them, and the next-step card.
```

### D.2 `references/git-workflow.md`

```markdown
# Team git workflow

Load for product writes in a Git repository or for a short integration reply. Scripts plan; run `apply` only with the returned `planHash`. On any non-ok result stop and follow its `next` or card. Never create worktrees or clones, stash, reset, force-push or stage with `git add -A`/`.`.

## Repository and policy

1. `agm-workspace.mjs context --cwd <session cwd> [--paths <files>] [--hint <project>]`. Read every `readRequired` file completely, then `context --ack <sha12,…>`. Each repository you write needs its own ack; never write `.agrimap-agent` outside a Git root.
2. `policy show`. Missing: `policy infer` and put its card in the first question round, then `decide record`. Never guess prefixes, bases or targets.

## Start

After `start`, run `branch plan --type feature|fix|hotfix|refactor|docs|chore --slug <english-kebab>` then `branch apply`. The work type is yours unless it changes base or target (hotfix vs fix); then use a card. Pre-existing dirty files are carried but never delivered. Host-created worktree branches follow `hostWorktreeBranch`.

## Deliver

After verification passes, add the changelog entry required by the project AGENTS, then `deliver plan [--input message.json]` and `deliver apply`. Messages are Conventional Commits in English with a header of at most 72 characters. The script stages exact own paths and verifies the remote SHA; it refuses protected branches, suspected secrets, missing acknowledgement or changelog. If the policy disables delivery, report exact paths and commit only when asked. Then run `integrate options` and end with the delivery summary and its next-step card.

## Short replies

| Reply | Intent |
| --- | --- |
| an option number | the stored card option |
| merge, รวม, รวมเข้า <branch>, ship, ผ่าน รวมได้, LGTM | integrate |
| pr, mr, เปิด PR, ส่งรีวิว | open-pr |
| อัปเดต branch, sync | update-branch (merge, never rebase or force) |
| แก้ต่อ, พักไว้ | continue, park |
| ทิ้ง, ยกเลิก branch | abandon (R3 card) |

Questions ("merge ยังไง?") and quoted text are not commands. A resolved reply is the explicit instruction for exactly the planned action; deleting branches, other targets or merging with failing checks needs its own card. Run `integrate plan --intent <intent>` then `integrate apply`. For local merge, run the verification the plan requests before `--stage push`. Report blocked reviews, failing checks, conflicts and server rejections with evidence; never bypass reviews or enable auto-merge unless the reply asked for it. `jenkins` and `jenkins-release` are release targets: use the project release intents.
```
