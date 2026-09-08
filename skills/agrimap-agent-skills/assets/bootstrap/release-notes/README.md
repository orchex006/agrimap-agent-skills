# Release notes schema

ใช้ [AGENTS.md](../AGENTS.md) เป็นเจ้าของกติกา release, ภาษา, baseline, tag และ completion gate ไฟล์นี้กำหนด schema เท่านั้น ไม่สร้าง workflow อีกชุด

ไฟล์ต่อ version คือ `release-notes/<VERSION>.md` ไม่มี v ในชื่อ ส่วน annotated tag เป็น `v<VERSION>` เฉพาะเมื่อร้องขอ Version + Tags และ `release.md` เป็น cumulative newest-first พร้อม section `## v<VERSION>` ที่ link notes ตรงกัน

```markdown
# Release 1.0.1

- Version: `1.0.1`
- Date: `YYYY-MM-DD`
- Source baseline: `<verified-production-tag-or-first-adoption>`
- Source candidate: `<code-sha-before-release-metadata-commit>`
- Tag: `v1.0.1` หรือ `not requested`

## Deployment targets

- Inhouse: `Jenkinsfile` -> `jenkins`
- Production: `Jenkinsfile_Production` -> `jenkins-release`

## Added

- ความสามารถที่พิสูจน์ได้จาก route/path/symbol ของ deployment SHA

## Changed

- พฤติกรรมที่เปลี่ยนตามหลักฐานในช่วงที่รายงาน

## Fixed

- ปัญหาที่แก้ได้จริง หรือระบุว่าไม่มีรายการที่พิสูจน์ได้

## Verification

- คำสั่งที่รันจริงและผลที่สังเกตได้ รวมสิ่งที่ยังตรวจไม่ได้
```

แทน placeholder ทุกตัวก่อน verification ใช้เฉพาะ environment ที่เกี่ยวข้องและเลขของ owner จริง ทั้งสอง environment อาจมีเลขต่างกัน

หัวข้อ/fields ข้างต้นคงภาษาอังกฤษ เนื้อความ release notes, release.md และ tag annotation ใช้ไทยเป็นหลัก คง technical identifiers ตามจริง ส่วน changelog.md ใช้ English entries ตาม AGENTS §5 ห้ามคัดลอกประโยคไทยไปลง changelog

Baseline แรกเป็น cumulative capability inventory ณ deployment SHA ที่พิสูจน์ได้ รุ่นถัดไปใช้ exact delta หลัง published Production baseline ไม่ใช้ working-tree notes ที่หายเป็นหลักฐาน first-adoption และไม่เดาจาก commit subject

ก่อน tag ต้องตรวจ notes blob จาก exact verified Production SHA และ annotation body ให้ตรงกันตาม AGENTS §7 โดยอนุญาต normalize CRLF/LF เท่านั้น ใช้ --cleanup=verbatim ห้ามเปลี่ยน notes/annotation ของ published tag ย้อนหลังเพื่อแก้ภาษา ให้บันทึก correction ใหม่ ไม่สร้าง GitLab Release object โดยอัตโนมัติ
