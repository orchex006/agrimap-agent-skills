# ContentProxy Module

`AgriMap.Platform.ContentProxy` คือโมดูลสำหรับรับ request จาก client แล้ว forward ต่อไปยัง target service
โดยรองรับทั้ง internal route และ external route สำหรับงานกลุ่ม Map/ArcGIS/REST proxy

## ภาพรวม

โมดูลนี้แยกหน้าที่หลักออกเป็น 4 ชั้น

- `ContentProxyAuthMiddleware` ตรวจสอบสิทธิ์ก่อนถึง controller
- `ContentProxyController` รับ route แล้วแปลงเป็น request DTO
- `ContentProxyUseCase` ประกอบ request, เติม auth, และ forward request
- `HttpForwarderService` ส่ง request ไป target service และ copy response กลับ

ส่วนข้อมูล route และสิทธิ์เข้าถึง content ถูกดึงจากฐานข้อมูลผ่าน `ContentProxyRepository`

---

## โครงสร้างไฟล์

```text
AgriMap.Platform/src/ContentProxy/
├── DTOs/
│   └── Requests/
│       ├── ContentProxyInternalRequestDto.cs
│       └── ContentProxyExternalRequestDto.cs
├── Middlewares/
│   └── ContentProxyAuthMiddleware.cs
├── Models/
│   ├── ProxyContext.cs
│   ├── ContentRouteDetailModel.cs
│   └── ContentPayloadConfig.cs
├── Repositories/
│   ├── ContentProxyRepository.cs
│   └── Interfaces/IContentProxyRepository.cs
├── Services/
│   ├── AuthHandlerFactory.cs
│   ├── HttpForwarderService.cs
│   ├── TokenCacheService.cs
│   └── Interfaces/
│       ├── IAuthHandler.cs
│       ├── IAuthHandlerFactory.cs
│       ├── IHttpForwarderService.cs
│       └── ITokenCacheService.cs
├── UseCases/
│   ├── ContentProxyUseCase.cs
│   └── Interfaces/IContentProxyUseCase.cs
├── ServiceCollectionExtensions.cs
└── README.md
```

---

## Route ที่รองรับ

### Internal Route

```text
GET|POST|PUT|DELETE|PATCH /api/content-proxy/{content_id}/{**proxy_path}
```

ตัวอย่าง

```text
/api/content-proxy/f788da21cf884c56816791f14fb79775/arcgis/rest/services/[FOLDER]/[SERVICE_ID]/[SERVICE_TYPE]
/api/content-proxy/f788da21cf884c56816791f14fb79775/arcgis/rest/services/[FOLDER]/[SERVICE_ID]/[SERVICE_TYPE]/0/query?where=1=1
```

### External Route

```text
GET|POST|PUT|DELETE|PATCH /api/content-proxy/{token}/{content_id}/{**proxy_path}
```

ตัวอย่าง

```text
/api/content-proxy/AAPTxy8I8jGZwQ/f788da21cf884c56816791f14fb79775/arcgis/rest/services/[FOLDER]/[SERVICE_ID]/[SERVICE_TYPE]
/api/content-proxy/AAPTxy8I8jGZwQ/f788da21cf884c56816791f14fb79775/arcgis/rest/services/[FOLDER]/[SERVICE_ID]/[SERVICE_TYPE]/0/query
```

### Desktop External Route

```text
GET|POST|PUT|DELETE|PATCH /api/content-proxy/{token}/{content_id}/arcgis/{**remaining_path}
```

ใช้รองรับ desktop / ArcGIS style path โดยตรง

---

## Request Flow

### Internal Route

1. Request เข้า `ContentProxyAuthMiddleware`
2. Middleware ตรวจว่า path เป็น `/api/content-proxy`
3. ถ้า `content_id` เป็น UUID 32 hex และ user authenticated แล้ว
4. Middleware ดึง `session_user_id` จาก `IAuthService`
5. ตรวจสิทธิ์ผ่าน `IContentProxyRepository.CheckContentAccessAsync(...)`
6. ถ้าผ่าน จะเก็บ `ContentRouteDetail` ไว้ใน `HttpContext.Items["ContentRouteDetail"]`
7. Controller สร้าง `ContentProxyInternalRequestDto`
8. Use case ตรวจ detail อีกครั้งแบบ fallback ถ้า `Items` ไม่มีค่า
9. Use case สร้าง target URL, compose headers/body, แล้ว forward request

### External Route

1. Request เข้า middleware เหมือนกัน
2. ปัจจุบัน middleware ยังปล่อยให้ผ่านไปที่ controller
3. Use case ตรวจ token, referer/origin, และ token expiry แบบ phase ปัจจุบัน
4. จากนั้น forward request เหมือน internal route

---

## Data Model

### `ContentProxyInternalRequestDto`

- `ContentId`
- `ServiceName`
- `MapType`
- `RemainingPath`
- `QueryString`

### `ContentProxyExternalRequestDto`

สืบทอดจาก internal request และเพิ่ม

- `Token`

### `ContentRouteDetailModel`

ข้อมูลที่ได้จาก stored procedure `content_route_detail_q`

- `Id`
- `ContentId`
- `Name`
- `ContentTypeId`
- `ContentTypeName`
- `AuthTypeId`
- `AuthTypeName`
- `UserCreated`
- `ContentPayload`

### `ContentPayloadConfig`

ข้อมูล JSON payload ที่ใช้บอกวิธี forward

- `service_name`
- `service_url`
- `map_service_type_id`
- `auth_type_id`
- `auth_type_name`
- `headers`
- `parameters`
- `credential`

---

## Content Payload

ตัวอย่าง payload ที่โค้ดคาดหวัง

```json
{
  "service_name": "MyService",
  "service_url": "https://example.com/arcgis/rest/services/MyService",
  "map_service_type_id": "wms",
  "auth_type_id": 3,
  "auth_type_name": "ArcGIS",
  "headers": [
    { "key": "x-api-key", "value": "abc" }
  ],
  "parameters": [
    { "key": "f", "value": "json" }
  ],
  "credential": {
    "auth_url": "https://example.com/generateToken",
    "username": "user",
    "password": "encrypted-password",
    "parameters": [
      { "key": "expiration", "value": "60" }
    ],
    "meta": {
      "token_send_mode": "query"
    }
  }
}
```

---

## การทำงานของ Use Case

`ContentProxyUseCase` ทำงานตามลำดับนี้

1. หา `ContentRouteDetailModel` จาก `HttpContext.Items` ก่อน
2. ถ้าไม่เจอ จะ fallback ไปอ่านจาก repository
3. ตรวจว่า `service_name` ใน route ตรงกับข้อมูลจาก DB
4. สร้าง `remainingUrl` จาก `RemainingPath` + `QueryString`
5. อ่าน `ContentPayloadConfig` จาก `ContentPayload`
6. ถ้า `service_url` ไม่มี จะ throw `AppException(500, "invalid_content_payload", ...)`
7. ถ้า `auth_type_id == 3`
   - decrypt password ด้วย `IAesService`
   - ขอ token จาก auth endpoint
   - cache token ผ่าน `ITokenCacheService`
   - append token เข้า target URL
8. สร้าง `HttpRequestMessage`
9. copy request headers/body จาก client ไปยัง target
10. forward ผ่าน `IHttpForwarderService`

---

## Header และ Body Handling

### Headers ที่ถูก block

โมดูลจะไม่ forward headers กลุ่มต่อไปนี้

- `Host`
- `Connection`
- `Keep-Alive`
- `Proxy-Authenticate`
- `Proxy-Authorization`
- `TE`
- `Trailer`
- `Transfer-Encoding`
- `Upgrade`
- `Accept-Encoding`
- `Content-Length`
- `Authorization`
- `Cookie`
- `Set-Cookie`

### Header override จาก config

ถ้า `ContentPayloadConfig.Headers` มีค่า จะถูกใช้ override header ที่ส่งมาจาก client

### Body handling

- `application/json`
  - อ่าน body เป็น JSON
  - merge กับ `ContentPayloadConfig.Parameters`
  - serialize กลับเป็น JSON ก่อนส่งต่อ
- `application/x-www-form-urlencoded`
  - parse query string
  - merge parameters จาก config
  - สร้าง `FormUrlEncodedContent`
- content type อื่น
  - forward body แบบ passthrough

---

## ArcGIS / Response Normalization

`ContentProxyUseCase` จะ normalize request สำหรับ resource บางประเภท

- image export / tile → `Accept: image/*`
- vector tile → `Accept: application/x-protobuf`
- scene binary → `Accept: application/octet-stream`
- OGC service → `Accept: application/xml`
- กรณีอื่น → `Accept: application/json`

นอกจากนี้จะ set `User-Agent` เป็น

```text
Konect-GIS-Gateway/1.0
```

`HttpForwarderService` จะ copy response headers และ body กลับไปยัง client พร้อมใส่ `X-Correlation-ID`

---

## DI Registration

เรียกใช้งานผ่าน

```csharp
builder.Services.AddContentProxy();
```

สิ่งที่ถูกลงทะเบียนโดย extension นี้

- `IContentProxyUseCase -> ContentProxyUseCase`
- `IContentProxyRepository -> ContentProxyRepository`
- `IHttpForwarderService -> HttpForwarderService`
- `ITokenCacheService -> TokenCacheService`
- `IMemoryCache`

### Host Dependencies

Host application ยังต้องมี service และ dependency ต่อไปนี้ด้วย

- `HttpClient`
- `IAesService`
- `IAuthService`
- `IDbDataAccessService`
- `DataAccessConfiguration`
- logging infrastructure

> `ContentProxyUseCase` และ `HttpForwarderService` รับ `HttpClient` ผ่าน DI ดังนั้น host ต้องเตรียม registration ให้พร้อม

---

## Middleware Order ที่ใช้ใน Playground

ใน `Program.cs` ปัจจุบันลำดับสำคัญคือ

```csharp
app.UseRouting();
app.UseMiddleware<GlobalExceptionMiddleware>();
app.UseMiddleware<AuthorizationMiddleware>();
app.UseAuthentication();
app.UseMiddleware<ContentProxyAuthMiddleware>();
app.UseAuthorization();
app.MapControllers();
```

ลำดับนี้สำคัญเพราะ `ContentProxyAuthMiddleware` ต้องเห็น `HttpContext.User` หลัง `UseAuthentication()`

---

## Repository Behavior

`ContentProxyRepository` ใช้ stored procedure หลัก 2 ตัว

- `content_route_detail_q`
  - ดึงข้อมูล content route detail
- `content_share_q`
  - ตรวจสิทธิ์ share ระหว่าง owner / user / group

ถ้า stored procedure fail repository จะ throw exception จาก output parameter ของ procedure นั้น

---

## Current Limitations

- External token validation ยังเป็น hardcoded phase
- token whitelist / referer rule ยังอยู่ใน use case ไม่ได้อ่านจาก database
- `IAuthHandler` และ `AuthHandlerFactory` มีอยู่เป็น extension point แต่ยังไม่มี concrete handler ใน tree ปัจจุบัน
- `ContentProxyAuthMiddleware` สำหรับ external route ยังปล่อยให้ผ่านไปที่ controller แล้วให้ use case ตัดสินอีกชั้น

---

## Suggested Test Cases

- internal route ผ่าน `ContentProxyAuthMiddleware` แล้วเก็บ `ContentRouteDetail` ใน `HttpContext.Items`
- internal route ปฏิเสธเมื่อ user ยังไม่ได้ authenticated
- internal route ปฏิเสธเมื่อ user ไม่มีสิทธิ์เข้าถึง content
- use case ต้อง fallback ไป repository เมื่อ `HttpContext.Items` ไม่มี detail
- use case ต้อง throw เมื่อ `service_name` ไม่ตรงกับ content route detail
- `ContentPayloadConfig` ต้อง parse JSON ได้ครบ
- `TokenCacheService` ต้อง cache token ตาม expiration
- `HttpForwarderService` ต้องไม่ forward hop-by-hop headers

