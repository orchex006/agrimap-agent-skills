# Workflow — ทำงานเท่าที่โจทย์ต้องการ

[หน้าหลัก](../README.md) · [คำสั่ง](USAGE.md) · [Release](RELEASE.md)

## ไม่ใช่ทุกงานต้องมี workflow

ถามว่า “โค้ดนี้ทำอะไร” ให้ตอบจากหลักฐานได้เลย ไม่ต้อง identify, init, สร้าง task หรือรัน tests การเรียก skill ตรง ๆ ไม่ได้บังคับให้สร้างไฟล์ และอยู่ใน AgriMap repository ก็ไม่ได้ทำให้ทุกบทสนทนาเป็นงานโครงการ

| ลักษณะงาน | การบันทึกที่เหมาะสม |
| --- | --- |
| อธิบาย เปรียบเทียบ ขอ help หรือ review ที่ไม่ขอรายงานถาวร | ไม่มี execution/task; raw submit ที่เกี่ยวข้องอาจอยู่ใน prompt history |
| แก้งานขนาดจำกัดที่อนุมัติแล้ว | light: memory ปัจจุบัน/ล่าสุดและ milestone audit แบบสั้น ไม่มี tasks |
| ต้อง resume, handoff หรือผู้ใช้ขอติดตาม | standard: task.md หนึ่งไฟล์ |
| มี boundary ข้อมูล/ความปลอดภัย/public contract, external publication หรือ independent assurance จริง | regulated: task เดียวพร้อมหลักฐานที่ความเสี่ยงนั้นต้องใช้ |

จำนวนไฟล์และอายุ model ไม่ใช้ตัดสิน depth งานเอกสารหลายหน้าก็ไม่จำเป็นต้อง regulated ส่วนการแก้ contract เพียงไฟล์เดียวอาจต้องใช้ assurance สูง

## ไฟล์แต่ละอย่างมีไว้ทำอะไร

| ที่เก็บใต้ .agrimap-agent | ใช้เมื่อ |
| --- | --- |
| prompts/YYYY-MM/conversation/history.md | เก็บ raw user submissions ที่เกี่ยวข้อง ไม่ปนคำตอบ AI |
| prompts/YYYY-MM/conversation/context-vNNN.md | มี Prompt Result ที่พร้อมใช้; immutable |
| memory/current | สิ่งที่ต้องรู้เพื่อทำ execution ปัจจุบันต่อ |
| memory/recent | ผลและหลักฐานเมื่อจบ/เปลี่ยน milestone |
| memory/project.md | ความรู้ระยะยาวที่งานต่อไปนำกลับมาใช้ได้ |
| logs/YYYY-MM | attribution และเหตุการณ์ของ durable work |
| tasks/YYYY-MM/run-id/task.md | scope, acceptance, progress, evidence, result ของงาน tracked |
| reports / เอกสาร QA หรือ analysis แยก | มีผู้อ่าน/ผู้รับผลลัพธ์ต้องการจริง ไม่สร้างเพียงเพื่อครบชุด |

เมื่อจบงาน tracked จะย้ายไป tasks/complete; ไม่ย้ายหรือลบ prompt history งาน 2.x เดิมอาจมีห้าไฟล์และใช้ validator เดิม อย่าลบเพื่อให้เหมือนงานใหม่

สำหรับ repo ที่รับ bootstrap AGENTS ฉบับ owner-supplied ล่าสุด ให้ใช้ project-specific portable recording §9: งานแก้ repository ต้องมี terminal report และ allowlist ตาม contract นั้น ตารางข้างต้นเป็นค่าเริ่มต้นของ package ไม่ใช้ลบข้อกำหนด project หรือเปิด lifecycle ซ้ำ ดู [Release](RELEASE.md)

## Identity ไม่ใช่ authority

ชื่อผู้สั่งใช้บอกว่าใครขอทำงาน ส่วนสิทธิ์แก้โค้ด/เผยแพร่มาจากโจทย์ปัจจุบันและขอบเขตที่อนุมัติ ไม่ใช่ชื่อ OS หรือ Git config

ค่าเริ่มต้น v3 เก็บการยืนยันในขอบเขต local user/workspace โดยไม่หมดอายุรายวัน แต่โครงการเก่าที่ตั้ง confirmationHours ไว้ยังคงค่าของตน ดู [Migration](MIGRATION-3.0.md) ห้ามยืม identity หรือ DB profile ของอีกห้องสนทนา

## Prompt version เกิดเมื่อไร

1. V0 คือข้อความผู้ใช้ ไม่มี Prompt Result file
2. เมื่อกลั่นคำสั่งพร้อมใช้ครั้งแรก สร้าง V1
3. แก้เนื้อหาตามการตัดสินใจใหม่ของผู้ใช้ จึงสร้าง V2+ พร้อมที่มาของการเปลี่ยน
4. อธิบาย เปรียบเทียบ เสนอทางเลือก รับทราบ อนุมัติ หรือเนื้อหาเดิมซ้ำ ไม่สร้าง version ใหม่

การอนุมัติผูกกับไฟล์/version/hash ที่แน่นอนในหลักฐาน ไม่แก้ไฟล์ immutable เดิม และไม่ให้ helper ตัดสิน authority แทนผู้ใช้

## QA ที่เพียงพอ

เอกสารตรวจเนื้อหา ลิงก์ โครงสร้าง และตัวอย่าง ส่วน implementation ตรวจ regression ที่กระทบและ consumer ของ contract ที่เปลี่ยน ไม่รันชุดใหญ่ซ้ำเพราะเปลี่ยน reviewer หรือครบจำนวนครั้ง

ใช้ evidence เดิมเมื่อ source, dependency, configuration, environment และ coverage ตรงกัน ถ้าต่างให้ตรวจเฉพาะช่องว่างที่เกิดใหม่ คำว่า simulation หรือ “น่าจะผ่าน” ไม่ใช่ผล test จริง

- passed: หลักฐานที่จำเป็นครบ
- failed: พบ defect
- blocked: ขาด prerequisite ที่ทำให้ตรวจต่อไม่ได้
- not-applicable: ไม่มี executable check ที่เกี่ยวข้อง พร้อมเหตุผล

Independent review ใช้เมื่อความเสี่ยงหรือคำขอต้องการ ไม่ใช่ทุก edit ต้องมี subagent โมเดลชื่อเดียวกันก็ยังต้องแยกผู้ลงมือกับผู้ตรวจหากอ้างว่า independent

## คำแนะนำและความไม่แน่นอนที่ต้องมองเห็น

Design เป็น passive capability ในทุก operation ที่เหลือ ไม่ต้องเรียกคำสั่ง design แยก: เมื่อหลักฐานเพียงพอ Agent ควรเสนอวิธีที่แนะนำพร้อมเหตุผลและ qualitative confidence หากข้อมูลไม่พอ ต้องบอกว่าตัดสินใจได้ไม่แน่นอน ขาดอะไร และส่งผลอย่างไร ไม่เดินต่อด้วย assumptions ที่ไม่เปิดเผย

เมื่อพอให้คำแนะนำชั่วคราวได้ ให้ระบุว่า provisional พร้อม assumptions, confidence และสิ่งที่จะทำให้เปลี่ยนคำแนะนำ แยก facts จาก inference/assumptions ไม่สร้างชื่อไฟล์ schema metrics หรือผล test ขึ้นเองเพื่อให้คำตอบครบ ใช้ prose สั้นที่เห็นได้ตามปกติ ไม่ต้องสร้างรายงานหรือหัวข้อว่างทุกครั้ง

คำแนะนำไม่ใช่การอนุมัติให้แก้โค้ดหรือ deploy; ความไม่แน่นอนที่กระทบ contract/data/security ต้องหยุดเฉพาะส่วนนั้นและบอกข้อมูลที่ต้องการ

## Passive skills

คือความรู้สนับสนุน operation ปัจจุบัน เช่น patterns, schema context, release rules ไม่ได้เปิด workflow ใหม่หรือขยายสิทธิ์ เพราะใช้ agm-be จึงไม่ต้องโหลด SQL context หากงานนั้นไม่เกี่ยวกับฐานข้อมูล

Agent อ่านเฉพาะ reference ที่เงื่อนไขตรง และใช้ golden/template ที่สัมพันธ์กับ target จริง ไม่อ่านคลังทั้งหมดหรือคัดลอกตัวอย่างที่คนละประเภทโครงการ

<a id="sql-context"></a>
## SQL context: อ่านได้ ไม่ mutate

ใช้ local schema/caller ก่อน เมื่อยังขาด ใช้ skill sql-context-pack ที่ติดตั้งและ profile ที่เชื่อมกับ conversation นี้ได้ ขอบเขตคือ metadata/index และ SELECT แบบจำกัดคอลัมน์/แถว มี masking; integration จำกัดไม่เกิน 500 แถว และควรขอน้อยกว่านั้นเมื่อพอ

ห้าม CREATE/ALTER/DROP/INSERT/UPDATE/DELETE/MERGE/TRUNCATE, SELECT INTO, EXEC/CALL, routine deployment หรือ metadata sync รวมถึงทางอ้อมที่เขียน DB ข้อห้ามนี้ไม่เปลี่ยนตาม model, depth หรือชื่อ owner

ถ้าไม่มี service/profile ให้แจ้งช่องว่าง ไม่สร้าง connection หรือขอ password เอง การเขียนไฟล์ .sql ตามคำสั่งผู้ใช้เป็นคนละเรื่องกับ execute บน DB

## Model profiles

- outcome: ให้เป้าหมาย constraints และ acceptance เปิดทางให้เลือก implementation
- guided: เพิ่ม checklist สั้นและตัวอย่างที่ตรงงาน เป็นค่าเริ่มต้นเมื่อยังไม่มีหลักฐานความสามารถ
- bounded: แบ่งหน่วยงานให้ชัด พร้อม input/output และข้อจำกัดที่ตรวจได้

เลือกจากผลที่สังเกตใน task family ไม่จัดอันดับด้วยยี่ห้อ รุ่น หรือจำนวน parameters ทุก profile ใช้ authority และ SQL boundary เดียวกัน
