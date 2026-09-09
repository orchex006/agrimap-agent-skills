# Bootstrap, Version และ Release

[หน้าหลัก](../README.md) · [Workflow](WORKFLOWS.md) · [Cookbook](COMMAND-COOKBOOK.md)

กติกาฉบับเต็มคือ [canonical project AGENTS](../skills/agrimap-agent-skills/assets/bootstrap/AGENTS.md) ที่ owner ส่งมา หน้านี้เป็นคำอธิบายเพื่อเลือก intent ไม่แทนกฎฉบับเต็ม ไม่ใช่คำสั่ง release ตัว skill package และไม่อนุญาตให้ execute จากการอ่านตัวอย่าง

## ข้อจำกัดการนำไปใช้ใน 3.0.1

งานใน project เดิมต้องอ่าน AGENTS.md ของ target จริงก่อนเสมอ bundled AGENTS เป็นต้นทางสำหรับติดตั้ง ไม่ใช่คำสั่งให้ทับกฎของ project โดยอัตโนมัติ

ยังไม่ได้ยืนยันความตรงกันกับ CLI template ภายนอก และ runtime ยังไม่ได้ปรับ recording ให้รองรับ portable contract ทุกข้อโดยอัตโนมัติ โดยเฉพาะ report, prompts/tasks และ log schema ต้องเลือกวิธีบันทึกให้ตรง project contract โดยไม่เปิด lifecycle ซ้ำ ห้ามอ้างว่าการตรวจ package ผ่านพิสูจน์ integration เหล่านี้แล้ว

ก่อนนำไปทับหลาย repo ให้เทียบ canonical template, project instructions และ runtime พร้อม dry-run ราย target การอัปเดต plugin ไม่ได้อนุญาตให้ migrate project documents

## Branch, version และ pipeline

| Environment | Version owner | Target branch |
| --- | --- | --- |
| Inhouse | Jenkinsfile | jenkins |
| Production | Jenkinsfile_Production | jenkins-release |

แก้ IMAGE_TAG/PROJECT_VERSION ที่ develop เท่านั้น คำนวณ PATCH+1 จาก owner จริงแยกกัน ไม่รับเลข release ที่เลือกเอง และไม่เปลี่ยน pipeline behavior จาก version intent

Flow: develop → push/verify jenkins → push/verify jenkins-release โดยใช้ exact verified source SHA และ --ff-only ทีละขั้น ห้ามข้าม jenkins

**ไม่ต้องรอ pipeline เขียวก่อน promote ต่อ** jenkins gate เป็นกฎลำดับ branch ไม่ใช่ gate รอ Jenkins Agent ไม่เรียก Jenkins API ไม่ทำ rollout/remote server; trigger ตั้งฝั่ง server แยกต่างหาก

ตาม profile ใน AGENTS pipeline ทำ analysis/build/push image ไม่ใช่ server rollout จึงห้ามอนุมานว่า deploy สำเร็จ รายงาน pipeline pending/not verified เว้นแต่มีหลักฐานจริง ความสำเร็จของ mode วัดที่ remote checkpoints รวม tag/final audit ที่ร้องขอ ไม่ใช่ pipeline เขียว

## Intent สำหรับมนุษย์

ตั้งแต่ 3.2.0 คำสั่งใหม่ทั้ง 9 แบบใช้ [ขั้นตอนที่ล็อกไว้](../skills/agrimap-agent-skills/references/release-steps.md) โดย release-notes และ release.md ใช้ Production version เท่านั้น; Inhouse-only ไม่สร้าง versioned notes คำอธิบาย notes ตาม environment และ legacy intents ด้านล่างไม่ใช้แทน contract ใหม่นี้ ตั้งแต่ 3.2.1 แต่ละ stage ต้อง fetch/sync local branch กับ remote แบบ fast-forward-only แล้วประเมิน gate ใหม่ใน invocation เดิม เพื่อลด false gate จาก stale local state; remote divergence จริงยังต้องหยุดวิเคราะห์ ตรวจ [CLI compatibility](../skills/agrimap-agent-skills/references/release-tools.md) ก่อน mutation; การอัปเดต skill package ไม่ได้แก้ CLI หรือ migrate AGENTS ใน product repo

ตั้งแต่ 3.1.0 ใช้ `$agm-release` ตาม [ตารางคำสั่งใน README](../README.md#agm-release) และ [contract ของสกิล](../skills/agrimap-agent-skills/references/release-workflow.md) ได้โดยตรง คำสั่งใหม่นี้มีขอบเขตแยกจาก legacy intents ด้านล่าง: prepare เก็บ candidate ในเครื่อง, pipeline production หยุดก่อน push Production และ promote ต้องขอยืนยัน SHA/branch/tag ที่เตรียมแล้วเสมอ ไม่รับสิทธิ์อัตโนมัติจากกลุ่ม B

พิมพ์ใน Agent chat หลังระบุโครงการเป้าหมาย Agent เป็นผู้รัน agm-release และ Git เอง ไม่ส่งคู่มือให้คนไปรันต่อ

| Intent | ผลหลัก | จุดจบ |
| --- | --- | --- |
| Diff เท่านั้น / Diff + Changelog | audit/reconcile changelog และ project index | ไม่มี version/publication |
| Project Backfill | diff ทั้ง reachable history, dirty inventory, historical changelog, catalog และ README capability/API tables | coverage ครบ ไม่มี publication |
| Release Baseline | cumulative notes ของ current Production SHA ที่พิสูจน์ได้ | ไม่ bump/push/tag |
| Prepare Inhouse / Production / Both | bump owner ที่เลือกแยกกัน ตรวจผล | commit/push/verify develop เท่านั้น |
| Version Inhouse | bump Inhouse เท่านั้น | develop → jenkins + final audit develop |
| Version Both | bump owners แยกกัน | develop → jenkins → jenkins-release + final audit develop |
| Version Production | bump Production เท่านั้น; Inhouse version ไม่ขึ้น | ผ่าน jenkins ถึง Production + final audit develop |
| Version + Tags | Version Production และ annotated tag จาก Production notes | remote tag object/peeled SHA + final audit develop |

Deploy aliases และ ambiguous routing ดู AGENTS §2 ใช้ exact phrase ที่เจาะจงที่สุด การยก keyword ในคำขอแก้เอกสารไม่ใช่การอนุมัติ release

## กลุ่ม B รวมงานค้างที่ตรวจแล้ว

สี่ intent Version Inhouse / Version Both / Version Production / Version + Tags รวม staged, unstaged, untracked และ deletion ทั้ง repository ที่ตรวจแล้วตาม §6.3 ไม่จำกัดเฉพาะ release files และไม่ข้ามเพราะเป็นงานก่อนหน้า

ต้องตรวจ secrets, ignored/generated outputs, nested repos และ allowlist จัด publish/blocked ราย path ใช้ exact-path staging ไม่ git add . หรือ -A ไม่ stash ซ่อนงานและไม่ force-add ignored files

แยก content commit ของงานเดิมออกจาก version metadata commit ยังห้ามเขียน pipeline behavior/source ใหม่จาก version intent เฉย ๆ กลุ่ม A และ deploy aliases ไม่ได้รับ expanded publication scope นี้

หลัง release/tag checkpoint ทำ final audit commit/push เฉพาะ artifacts ที่ตรวจแล้วบน develop **ไม่ promote audit commit ไม่ย้าย tag และไม่ bump ซ้ำ** รายงาน release SHA กับ final develop SHA แยกกัน inventory ของ publishable changes ต้องไม่ตกหล่น

Exact group-B intent ที่ owner สั่งเองยืนยัน branch pushes รวม final audit; tag push เฉพาะ Version + Tags กรณีอื่นใช้ confirmation ตาม §2.1 ไม่ถามซ้ำเมื่อ authority เดิมครอบคลุมและไม่มี stop condition

## หลักฐานและภาษา

- changelog.md: English entries, newest-first, หนึ่ง heading ต่อวัน; map actual diff ไม่ใช้ commit subject อย่างเดียว
- release.md และ release-notes/<VERSION>.md: prose ไทย, schema headings/fields อังกฤษ; tag annotation ต้องตรง notes จาก Production SHA
- Project Backfill ต้องมี README capability/API tables และ full-history coverage ที่พิสูจน์ได้; audit exit 0 อย่างเดียวไม่ใช่สำเร็จ
- Version + Tags ต้องตรวจ annotation equality, remote tag object และ peeled SHA; ห้ามแก้ published tag/notes ย้อนหลัง
- ทุก external command ตรวจ exit code ทันทีก่อนทำขั้นถัดไป; divergence/conflict ให้ตรวจหลักฐานและเสนอวิธีรักษาประวัติก่อนขอ decision

## Portable recording ของ repo ที่รับ contract นี้

AGENTS §9 ใช้ได้โดยไม่มี skills หรือ hooks สำหรับงานแก้ repository ต้องมี logs + current/recent memory และ terminal report; decisions/instructions/knowledge เฉพาะเมื่อเข้าเงื่อนไข ไม่สร้างไฟล์เปล่า

นี่เป็น project contract ที่เข้มกว่าค่าเริ่มต้น optional report ของ skill package ไม่เปิด lifecycle ซ้ำ และไม่เปลี่ยนกฎทุก repository โดยอัตโนมัติ อ่าน allowlist และ group-B exception ในฉบับเต็มก่อน publication

<a id="bootstrap"></a>
## Bootstrap ไม่ใช่ release

ติดตั้งเมื่อ explicit init/adopt หรือเป็น prerequisite ที่ตรงขอบเขตคำสั่ง agm-release ของ product target ไม่ทำเมื่อ identify หรือเปิด session:

- Copy byte-exact: AGENTS.md, GEMINI.md, CLAUDE.md, CURSOR.md, release-notes/README.md
- Pointer files ชี้ AGENTS เท่านั้น ไม่คัดกฎซ้ำ
- README แทรกเฉพาะ Deployment block; ไม่ copy ทั้งไฟล์
- ไม่ copy .gitignore/Jenkinsfiles/changelog/notes ราย version ไม่ reset version หรือสร้าง branches
- Existing differing content เป็น conflict ต้องตกลง adoption ก่อน ไม่ overwrite เงียบ ๆ

ตั้งแต่ 3.2.2 Agent ตรวจและ plan/apply ไฟล์ bootstrap ที่ขาดและเข้ากันได้ก่อน audit ได้เอง แล้วตรวจซ้ำและทำคำสั่งเดิมต่อ ไม่ต้องให้ผู้ใช้เรียก init หรือ restore/commit เอง หากต้องแทนที่ไฟล์เดิมที่ขัดแย้ง ให้แสดง diff และขอยืนยัน adoption ตามจำเป็น กฎยืนยัน Production/tag ยังเหมือนเดิม; standalone pipeline/promote ไม่เพิ่มเวอร์ชันหรือเปลี่ยน candidate ที่เตรียมไว้โดยอัตโนมัติ ดู [ขอบเขตการซ่อม prerequisite](../skills/agrimap-agent-skills/references/release-and-bootstrap.md#release-prerequisite-repair)

ตัวอย่าง **Agent chat / Codex**:

```text
$agm-be
วางแผน bootstrap เอกสาร AgriMap สำหรับ [project path จริง] ชนิด be-main
แสดงไฟล์ที่จะสร้างและ conflicts โดยยังไม่ apply
ใช้ canonical AGENTS ฉบับ owner-supplied ล่าสุด
ห้ามเปลี่ยน version, Jenkinsfiles หรือทำ Git publication
```

เปลี่ยน prefix ตาม [Usage](USAGE.md) หากใช้ host อื่น Runtime preview/apply อยู่ใน [Maintaining](MAINTAINING.md#bootstrap-cli)

AGENTS ที่ส่งมาอธิบาย .NET main-service profile จึงต้องตรวจความเข้ากันได้ของ FE/libraries และ server configuration จริง ไม่สมมติว่า stage/tool/trigger เหมือนกัน ค่า scaffold ใหม่ของ main FE/BE ยังคือ 1.0.0, libraries 0.0.x; adoption ไม่เปลี่ยนเลขเดิม
