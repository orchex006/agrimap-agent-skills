# BCrypt Cryptography

`BcryptService` ใช้สำหรับ hash และตรวจสอบรหัสผ่านด้วย BCrypt
โดยบริการนี้นำ `salt` ไปต่อท้าย `password` ก่อนทำ hash หรือ verify

## API

```csharp
string HashPassword(string password, string salt);
bool VerifyPassword(string password, string hashedPassword, string salt);
```

## แนวคิด

- `HashPassword` ใช้สำหรับสร้างค่า hash
- `VerifyPassword` ใช้ตรวจสอบว่า `password + salt` ตรงกับ hash ที่เก็บไว้หรือไม่

## วิธีใช้งาน

```csharp
var hash = bcryptService.HashPassword("P@ssw0rd!", "pepper");
var isValid = bcryptService.VerifyPassword("P@ssw0rd!", hash, "pepper");
```

## ข้อควรระวัง

- `salt` ใน implementation นี้เป็น string ที่ผู้เรียกส่งเข้ามาเอง
- อย่านำ `salt` เดียวกันไปใช้เป็นรหัสผ่าน
- ถ้า `password`, `hashedPassword`, หรือ `salt` ว่าง จะโยน exception
    