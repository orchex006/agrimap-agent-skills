# Abstractions

โฟลเดอร์นี้เก็บ exception / contract พื้นฐานที่ใช้ร่วมกันข้ามหลาย module
โดยปัจจุบันมี `AppException` เป็นตัวหลัก

## `AppException`

`AppException` คือ exception สำหรับส่ง error ที่ระบบคาดไว้กลับไปยัง layer ถัดไป
เช่น middleware, controller, หรือ use case

### สิ่งที่เก็บไว้

- `StatusCode`
- `ErrorCode`
- `Message`
- `InnerException` ในกรณีที่ห่อ exception ต้นทาง

### Constructor ที่มี

```csharp
new AppException(int? statusCode, string errorCode)
new AppException(int? statusCode, string errorCode, string message)
new AppException(string message)
new AppException(string message, Exception innerException)
```

### แนวคิดการใช้งาน

- ใช้ `statusCode` เพื่อกำหนด HTTP status หรือระดับ error ที่ต้องการสื่อ
- ใช้ `errorCode` เป็นรหัส error แบบ machine-readable
- ใช้ `message` เป็นข้อความเพิ่มเติมหรือ key สำหรับการแปลข้อความใน middleware

ตัวอย่าง:

```csharp
throw new AppException(400, "invalid_parameter", "device_id_required");
```

## พฤติกรรมที่ต้องรู้

- ถ้าใช้ constructor แบบ `statusCode + errorCode` อย่างเดียว `Message` จะไม่ถูกกำหนด
- `GlobalExceptionMiddleware` ใน Playground ใช้ `AppException.Message` เป็น key สำหรับ lookup ข้อความจาก `lut_app_message:{Message}`
- ถ้าไม่มีข้อความใน configuration ระบบจะ fallback ไปใช้ข้อความเดิมที่ exception ถืออยู่

## การใช้งานร่วมกับระบบ

ในโค้ดปัจจุบัน `AppException` ถูกใช้ในหลายจุด เช่น:

- Authentication / Authorization
- Anonymous session
- Content proxy
- Security demo endpoints
- Mail client และ HTTP demo endpoints

## วิธีใช้

```csharp
if (string.IsNullOrWhiteSpace(deviceId))
{
    throw new AppException(400, "device_id_required", "device_id_required");
}
```

ฝั่ง middleware จะ map เป็น response JSON ตาม status และ error code ที่กำหนดไว้

