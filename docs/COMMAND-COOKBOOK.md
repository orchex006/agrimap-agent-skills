# ชุดคำสั่งสำหรับผู้เริ่มต้น

[เริ่มต้น](GETTING-STARTED.md) · [เลือกคำสั่ง](USAGE.md) · [Workflow](WORKFLOWS.md)

ทุกกล่องในหน้านี้คือ **Agent chat สำหรับ Codex** ไม่ใช่ Terminal ใช้ Claude เปลี่ยน `$agm-X` เป็น `/agrimap-agent-skills:agm-X`; ใช้ Antigravity เปลี่ยนเป็น `/agm-X` ส่งทีละโจทย์ ไม่ต้องส่งทั้งหมด

แทน `[...]` ด้วยข้อมูลจริงก่อนใช้ ไม่ใส่ password, token, connection string หรือข้อมูลส่วนบุคคลในโจทย์/ไฟล์แนบ

## 1. เพิ่งเข้าโครงการ ยังไม่รู้จะเริ่มตรงไหน — อ่านอย่างเดียว

```text
$agm-analyze
ช่วยอธิบายโครงการ AgriMap นี้สำหรับคนเพิ่งเข้าทีม
หา entry point, โฟลเดอร์หลัก และเส้นทาง request หนึ่งตัวอย่างจากไฟล์จริง
ระบุไฟล์ให้เปิดอ่านต่อ 3–5 ไฟล์ และแยกสิ่งที่ยังไม่รู้
ยังไม่แก้ไฟล์ ไม่สร้าง task และไม่รัน test
```

ควรได้: แผนที่โครงการแบบสั้นพร้อมหลักฐาน ไม่ใช่แผน refactor ทั้งระบบ

## 2. มี error แต่ยังไม่รู้สาเหตุ — วินิจฉัยก่อน

```text
$agm-diagnose
อาการ: [เช่น กดบันทึกแล้วได้ 500]
ขั้นตอนทำซ้ำ: [ขั้นตอนจริง]
log ที่ปกปิดข้อมูลแล้ว: [แนบ/ระบุไฟล์]
เริ่มจาก: [endpoint หรือไฟล์จริง]
หาสาเหตุจาก code และ caller แยกข้อเท็จจริงกับสมมติฐาน
ยังไม่แก้โค้ด ถ้าหลักฐานไม่พอให้บอกว่าขาดอะไร
```

ควรได้: สาเหตุพร้อมจุดอ้างอิง หรือช่องว่างหลักฐานที่ชัด ไม่สร้าง fix จากการเดา

## 3. แก้ frontend เรื่องเล็กที่ทราบแล้ว — เขียนไฟล์

```text
$agm-fe action=edit
ใน [component/page จริง] เพิ่ม empty state เมื่อรายการเป็นศูนย์
ใช้ component และข้อความตาม pattern ที่มีในโครงการ
คง behavior loading, error และกรณีมีข้อมูลไว้
ตรวจเฉพาะ behavior ที่กระทบ ไม่ redesign หน้าอื่น
ไม่ commit, push หรือ deploy
```

ควรได้: diff ใน scope และหลักฐานตรวจที่เหมาะกับ UI ที่เปลี่ยน

## 4. แก้ backend โดยไม่เปลี่ยน contract — เขียนไฟล์

```text
$agm-be action=edit
แก้ [endpoint/use case จริง] ให้จัดการ input ว่างตาม validation ของโครงการ
ใช้ response และ error contract เดิม
คงผลลัพธ์ของ input ที่ถูกต้อง และเพิ่ม regression ที่เกี่ยวข้องถ้ามี harness
ไม่เปลี่ยน schema ไม่เรียก DB write และไม่ commit/push/deploy
```

ถ้าจำเป็นต้องเปลี่ยน public contract Agent ต้องชี้ผลกระทบ ไม่ขยายงานเงียบ ๆ

## 5. Refactor เพื่อให้อ่านง่าย — เขียนโดยคง behavior

```text
$agm-be action=refactor
จัดระเบียบ [ไฟล์/symbol จริง] เพื่อให้อ่านง่ายขึ้น
คงเงื่อนไข ลำดับ side effects ผลลัพธ์ และ error mapping เดิม
ไม่ย้าย architecture หรือแก้ bug อื่นในรอบนี้
เลือก mode ที่ตรงโจทย์และบอกสั้น ๆ พร้อมตรวจ equivalence เฉพาะส่วนที่แก้
```

ไม่ต้องเลือกจากเมนูยาวถ้า intent ชัด หากต้องการเปลี่ยน logic ให้ระบุ behavior ใหม่โดยตรง

## 6. ตรวจงานที่ทำแล้ว — อ่านอย่างเดียว

```text
$agm-analyze
ตรวจ diff ของ [ไฟล์/commit จริง] เน้น correctness, regression และ contract
บอก findings เรียงตามผลกระทบ พร้อมไฟล์และเหตุผล
ถ้าไม่พบข้อผิดพลาดให้บอกตรง ๆ และระบุสิ่งที่ยังไม่ได้ตรวจ
อย่าแก้โค้ดตาม findings เอง
```

หากต้องการตรวจตาม acceptance ใช้:

```text
$agm-qa
ตรวจ [artifact/diff จริง] ตาม acceptance นี้: [รายการ]
ใช้ผลตรวจเดิมได้เมื่อ source, dependencies, config และ coverage ยังตรง
รันเฉพาะ local checks ที่จำเป็นและไม่ใช้ฐานข้อมูลจริง
รายงาน passed/failed/blocked ตามหลักฐาน ไม่แก้ product files
```

## 7. อยากเพิ่ม feature แต่ยังไม่เลือกวิธี — เสนอแบบ

```text
$agm-analyze
ออกแบบ behavior ของ [feature] ในโปรเจกต์นี้
ผู้ใช้ต้องทำ [งาน] และถือว่าสำเร็จเมื่อ [ผลที่สังเกตได้]
ตรวจของเดิมก่อน เสนอวิธีที่เรียบง่ายพร้อมข้อแลกเปลี่ยน
ระบุ loading/error/empty/recovery ที่เกี่ยวข้องและ acceptance
ยังไม่ implement
เสนอคำแนะนำเมื่อมีหลักฐานพอ ถ้าไม่พอให้บอก missing inputs และ limitations
แยก facts กับ assumptions; คำแนะนำชั่วคราวต้องระบุเงื่อนไขและ confidence
```

ใช้ `agm-plan` เมื่อต้องการลำดับลงมือทำจากแบบที่เลือกแล้ว ไม่จำเป็นต้องเรียกทั้งสองเสมอ

## 8. ต้องการคำสั่งส่งต่อให้ Agent — สร้าง Prompt Result

```text
$agm-prompt
กลั่นโจทย์ [รายละเอียดหรือไฟล์จริง] เป็นคำสั่งพร้อมลงมือทำ
ระบุ scope, non-goals, constraints, acceptance และหลักฐานที่ต้องอ่าน
ยังไม่ implement และไม่เพิ่มสิ่งที่ฉันไม่ได้ขอ
ถ้าไม่จำเป็นต้องแบ่งงาน ให้ Main รับผิดชอบทั้งหมด
```

หลังได้ V1 ถ้าแค่สงสัย ให้ถามว่า “อธิบาย acceptance ข้อ 2 ใน Prompt Result เดิม ยังไม่แก้เนื้อหา” ไม่ควรเกิด V2

เมื่อต้องการแก้จริง:

```text
$agm-prompt
แก้ Prompt Result [path เวอร์ชันล่าสุดจริง]
เพิ่มข้อกำหนด retry ไม่เกิน 3 ครั้งตามการตัดสินใจนี้
รักษาข้อกำหนดเดิมที่ยังใช้ได้ สร้างเวอร์ชันใหม่และสรุปเฉพาะสิ่งที่เปลี่ยน
ยังไม่ implement
```

## 9. อนุมัติให้ทำแล้ว — ลงมือโดยไม่ต้องสร้าง prompt ใหม่

```text
$agm-exec
ลงมือทำตาม [ข้อสรุปที่ระบุชัด หรือ path Prompt Result จริง]
ขอบเขตที่อนุมัติ: [รายการ]
ต้องคงเดิม: [behavior/contract]
เสร็จเมื่อ: [acceptance]
ตรวจผลตามความเสี่ยงจริง ไม่รวม commit/push/deploy
```

หากงานต้องส่งต่อหรือทำหลาย session เติม “เก็บ task เดียวสำหรับ resume/handoff” ไม่ต้องสั่งสร้าง brief/analysis/QA/result หลายไฟล์ล่วงหน้า แต่หาก project AGENTS กำหนด portable report/allowlist ให้ทำตาม contract ของ project นั้น

## 10. อ่าน SQL context — ไม่ execute routine

```text
$agm-sql action=explain
อธิบาย [schema.object หรือไฟล์ SQL จริง] และ caller ที่เกี่ยวข้อง
ใช้หลักฐาน local ก่อน หากขาดให้ใช้ sql-context-pack เฉพาะ profile ที่เชื่อมกับห้องนี้
อนุญาต metadata และ SELECT เฉพาะคอลัมน์ที่จำเป็น จำกัด 20 แถวและปกปิดข้อมูล
ห้าม DDL/DML, SELECT INTO, EXEC/CALL, metadata sync หรือ deploy routine
หากไม่มี profile ให้บอกข้อมูลที่ขาด ห้ามสร้าง connection เอง
```

ควรได้: ข้อมูลพร้อม source/freshness และ unknowns ไม่ใช่ dump ทั้งฐานข้อมูล

## 11. ดูงานย้อนหลัง — อ่าน audit

```text
$agm-analyze
ดูงานที่ requested_by=[ชื่อที่ยืนยันจริง] ในช่วง [วันเริ่ม] ถึง [วันสิ้นสุด]
ระบุ timezone ที่ใช้และแยก requester, agent executor, claimed files กับ Git author
ถ้า log หายหรือเสียให้บอกข้อจำกัด ไม่สรุปจากความจำใน chat อย่างเดียว
```

## 12. เตรียม release โดยยังไม่เผยแพร่ — อ่านอย่างเดียว

```text
$agm-be action=analyze
ตรวจความพร้อม release ของโปรเจกต์นี้
อ่าน AGENTS และ version owners จริง สรุป candidate, branch, version และสิ่งที่ยังขาด
อธิบาย develop -> jenkins/Inhouse -> jenkins-release/Production
ยังไม่ bump version, commit, merge, push, tag หรือ deploy
```

อย่าใช้ “Prepare Both” แทนคำว่า “ตรวจความพร้อม” เพราะ intent นั้นรวม bump และ push develop ดู [Release](RELEASE.md) ก่อนสั่งเผยแพร่จริง
