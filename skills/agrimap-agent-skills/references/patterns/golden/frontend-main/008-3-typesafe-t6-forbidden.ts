// T6 — ข้อห้ามรวม
ห้าม any — ใช้ unknown แล้ว narrow ถ้าไม่รู้ type จริง
ห้าม non-null assertion (!) ยกเว้น @ViewChild ที่ static: true
Response จาก generated API ต้องแปลงเป็น domain model (convertToCamel + type จาก xxx.model.ts) ก่อนเขียนลง Store