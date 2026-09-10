# HMAC SHA Cryptography

`HmacShaService` ใช้สำหรับสร้าง hash แบบ HMAC ด้วย SHA256 หรือ SHA512

## API

```csharp
string Compute256(string message, string secretKey);
string Compute512(string message, string secretKey);
```

## แนวคิด

- รับ `message` และ `secretKey`
- เข้ารหัสด้วย `HMACSHA256` หรือ `HMACSHA512`
- แปลงผลลัพธ์เป็น hexadecimal string ตัวพิมพ์เล็ก

## วิธีใช้งาน

```csharp
var sha256 = hmacShaService.Compute256("hello", "secret-key");
var sha512 = hmacShaService.Compute512("hello", "secret-key");
```

## ข้อควรระวัง

- ถ้า `message` หรือ `secretKey` ว่าง จะโยน exception
- ค่าที่คืนมาเป็น string hex lowercase ไม่ใช่ Base64
- ใช้ HMAC สำหรับความถูกต้องของข้อมูลหรือการยืนยันข้อความ ไม่ใช่การเข้ารหัสกลับ