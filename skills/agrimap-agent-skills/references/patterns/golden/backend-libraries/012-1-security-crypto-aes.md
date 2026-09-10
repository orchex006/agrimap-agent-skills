# AES Cryptography

`AesService` ให้ฟังก์ชันเข้ารหัสและถอดรหัสข้อความด้วย AES-256-CBC
โดยใช้ key ที่ส่งเข้ามาในรูป Base64 string

## แนวคิด

- รับ `plainText` และ `base64Key`
- ถอด `base64Key` เป็น byte array
- ตรวจว่าคีย์ยาว 32 bytes
- สร้าง IV จาก key ด้วย SHA256 แบบ deterministic
- เข้ารหัสด้วย `AES-256-CBC` และ `PKCS7 padding`
- ใส่ IV ไว้หน้าข้อมูลก่อนแปลงเป็น Base64

## API

```csharp
string Encrypt(string plainText, string base64Key);
string Decrypt(string cipherText, string base64Key);
```

## วิธีใช้งาน

```csharp
var keyBytes = RandomNumberGenerator.GetBytes(32);
var base64Key = Convert.ToBase64String(keyBytes);

var cipherText = aesService.Encrypt("hello", base64Key);
var plainText = aesService.Decrypt(cipherText, base64Key);
```

## ข้อกำหนดของ key

- ต้องเป็น Base64 ที่ decode แล้วได้ 32 bytes
- ถ้า key ว่างหรือ decode ไม่ได้ จะโยน exception

## ข้อควรระวัง

- IV ถูก derive จาก key เดิมทุกครั้ง จึงได้ ciphertext เดิมเมื่อใช้ key และข้อความเดิม
- พฤติกรรมนี้เหมาะกับงานที่ต้องการผลลัพธ์คงที่ แต่ไม่ใช่รูปแบบ encrypt แบบสุ่ม
- ถ้าใช้ key คนละค่า จะถอดรหัสไม่ได้