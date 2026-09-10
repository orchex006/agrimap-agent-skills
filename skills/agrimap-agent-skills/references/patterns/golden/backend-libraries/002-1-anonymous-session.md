# AgriMap Platform Anonymous

`AgriMap.Platform.Security.Anonymous` เป็นโมดูลสำหรับสร้างและตรวจสอบ anonymous session โดยผูก
session เข้ากับ device fingerprint, รองรับ rate limit แบบ per-second และ daily creation limit และมี
middleware/filter สำหรับบังคับใช้กับ endpoint ที่ติด attribute ไว้

โมดูลนี้ถูกใช้งานร่วมกับ `AgriMap.Platform.Playground` ใน endpoint:

- `POST /api/anonymous/session`
- `GET /api/anonymous/session/me`

## ภาพรวมของโมดูล

| ส่วน | หน้าที่ |
| --- | --- |
| `AnonymousConfigurationService` | อ่านค่า config ของ anonymous flow |
| `AnonymousDeviceIdResolver` | หาค่า device id / client id จาก request |
| `AnonymousFingerprintService` | สร้าง fingerprint จาก device id และ user-agent |
| `AnonymousSessionService` | สร้างและตรวจสอบ anonymous session token |
| `AnonymousRateLimitService` | ตรวจ per-second และ per-day rate limit |
| `AnonymousSessionMiddleware` | บังคับ validate anonymous session ก่อนเข้า endpoint |
| `AnonymousRateLimitMiddleware` | บังคับ rate limit ก่อนเข้า endpoint |
| `AnonymousAuthorizeAttribute` / `AnonymousRateLimitAttribute` | ติดบน controller/action เพื่อเรียก filter ที่เกี่ยวข้อง |
| `AnonymousAuthorizeFilter` / `AnonymousRateLimitFilter` | filter สำหรับ integration กับ MVC pipeline |
| `AnonymousServiceCollectionExtensions` | `AddAnonymousProtection()` สำหรับลงทะเบียน service |
| `AnonymousApplicationBuilderExtensions` | `UseAnonymousProtection()` สำหรับลง middleware |

## การลงทะเบียน DI

```csharp
using AgriMap.Platform.Security.Anonymous;

builder.Services.AddAnonymousProtection();
```

`AddAnonymousProtection()` ลงทะเบียน service เหล่านี้:

- `IAnonymousFingerprintService`
- `IAnonymousConfigurationService`
- `IAnonymousRateLimitService`
- `IAnonymousSessionService`
- `IHttpContextAccessor`
- `AnonymousAuthorizeFilter`
- `AnonymousRateLimitFilter`

## การวาง middleware

ถ้าต้องการใช้ middleware mode ให้เรียก:

```csharp
app.UseRouting();
app.UseAuthentication();
app.UseAnonymousProtection();
app.UseAuthorization();
app.MapControllers();
```

ต้องวางหลัง `UseRouting()` เพราะ middleware ต้องอ่าน endpoint metadata จาก `context.GetEndpoint()`
และควรวางหลัง `UseAuthentication()` ถ้าต้องการให้ request ที่ authenticated ข้าม anonymous check ไปเลย

`UseAnonymousProtection()` เรียก middleware ตามลำดับนี้:

1. `AnonymousSessionMiddleware`
2. `AnonymousRateLimitMiddleware`

## Configuration

`AnonymousConfigurationService` อ่านค่าจาก `IConfiguration` โดยรองรับ fallback หลายชื่อ

### AES key

```text
anonymous_aes_key
Anonymous:anonymous_aes_key
ANONYMOUS_AES_KEY
system_config:anonymous_aes_key
AES_KEY
```

ถ้าไม่พบค่าที่ใช้งานได้ จะ throw `AppException(500, "internal_server_error", ...)`

### ค่าอื่น ๆ

| ค่า | ลำดับ fallback | Default / rule |
| --- | --- | --- |
| `anonymous_session_expire_hours` | `anonymous_session_expire_hours` → `Anonymous:anonymous_session_expire_hours` → `ANONYMOUS_SESSION_EXPIRE_HOURS` → `system_config:anonymous_session_expire_hours` | default `8`, clamp ระหว่าง `2..8` |
| `anonymous_session_max_per_day` | `anonymous_session_max_per_day` → `Anonymous:anonymous_session_max_per_day` → `ANONYMOUS_SESSION_MAX_PER_DAY` → `system_config:anonymous_session_max_per_day` | default `5`, ต่ำสุด `1` |
| `anonymous_rate_limit_per_second` | `anonymous_rate_limit_per_second` → `Anonymous:anonymous_rate_limit_per_second` → `ANONYMOUS_RATE_LIMIT_PER_SECOND` → `system_config:anonymous_rate_limit_per_second` | default `50`, ต่ำสุด `1` |
| `anonymous_cookie_name` | `anonymous_cookie_name` → `Anonymous:anonymous_cookie_name` → `ANONYMOUS_COOKIE_NAME` → `system_config:anonymous_cookie_name` | default `AgmAnonymousSession` |
| `anonymous_header_name` | `anonymous_header_name` → `Anonymous:anonymous_header_name` → `ANONYMOUS_HEADER_NAME` → `system_config:anonymous_header_name` | default `agm-anonymous-session-key` |
| `anonymous_enable_rate_limit` | `anonymous_enable_rate_limit` → `Anonymous:anonymous_enable_rate_limit` → `ANONYMOUS_ENABLE_RATE_LIMIT` → `system_config:anonymous_enable_rate_limit` | default `true` |

## Model ที่ใช้

```csharp
public sealed class AnonymousSessionCreateRequest
{
    public string DeviceId { get; set; } = string.Empty;
    public string? AppId { get; set; }
    public bool AllowWebDeviceId { get; set; }
    public string UserAgent { get; set; } = string.Empty;
    public string? RemoteIpAddress { get; set; }
}
```

```csharp
public sealed class AnonymousSessionCreateResult
{
    public string AnonymousSessionKey { get; set; } = string.Empty;
    public DateTime ExpiredAt { get; set; }
    public string CookieName { get; set; } = AnonymousConstants.DefaultCookieName;
}
```

```csharp
public sealed class AnonymousSessionContext
{
    public string SessionId { get; set; } = string.Empty;
    public string Fingerprint { get; set; } = string.Empty;
    public DateTime ExpiredAt { get; set; }
    public bool IsAnonymous { get; set; }
    public string? ClientId { get; set; }
    public string? DeviceId { get; set; }
}
```

```csharp
public sealed class AnonymousSessionPayload
{
    public int Version { get; set; } = 1;
    public string SessionId { get; set; } = string.Empty;
    public string Fingerprint { get; set; } = string.Empty;
    public DateTime IssuedAt { get; set; }
    public DateTime ExpiredAt { get; set; }
    public string? DeviceId { get; set; }
    public string? IpHash { get; set; }
}
```

## Device id และ client id resolution

### `AnonymousDeviceIdResolver.Resolve(...)`

`Resolve()` เลือก device id ตามลำดับนี้:

1. cookie `AgmTraceId`
2. query string `device_id`
3. body device id ที่ส่งเข้า method

ถ้ามี `AgmTraceId` cookie จะใช้ค่านั้นก่อนเสมอ แม้ request จะส่ง device id มาใน query หรือ body ด้วย

`ResolveClientId()` เลือก client id ตามลำดับนี้:

1. header `agm-client-id`
2. query string `client_id`

### App id ที่รองรับ

| กลุ่ม | App id |
| --- | --- |
| Web | `agrimap-platform`, `agrimap-ex`, `agrimap-online`, `agrimap-pro` |
| Native | `agrimap-mobile`, `agrimap-plus` |

### กติกาของ device binding

- ถ้าใช้ `AgmTraceId` cookie ต้องมี web app id หรือ native app id
- ถ้า device id มาจาก query string หรือ body ต้องเป็น `agrimap-mobile` หรือ `agrimap-plus`
- `agrimap-mobile` ต้องมี user-agent ที่ขึ้นต้นด้วย `agm-mobile ` และมี `; Android ` หรือ `; iOS `
- `agrimap-plus` ต้องมี user-agent ที่ขึ้นต้นด้วย `agm-plus `
- ถ้า `allowWebDeviceId = true` body device id สามารถใช้ร่วมกับ web app id ได้

## Fingerprint

`AnonymousFingerprintService` สร้าง fingerprint จาก

```text
trim(deviceId) + ":" + trim(userAgent-or-unknown-user-agent)
```

แล้ว hash ด้วย SHA-256 ผ่าน helper ใน `AtlasX.Engine.Extensions`

## Session lifecycle

### Create

`AnonymousSessionService.CreateAsync()`:

1. resolve device id จาก request + `HttpContext`
2. validate device/app/user-agent
3. สร้าง fingerprint
4. ตรวจ daily creation limit
5. สร้าง payload
6. encrypt payload ด้วย AES
7. เก็บ `AnonymousSessionContext` ลง cache
8. คืน token + cookie name + expiry

payload ที่ถูกสร้างจะมี:

- `Version = 1`
- `SessionId = Guid.NewGuid()`
- `IssuedAt = DateTime.UtcNow`
- `ExpiredAt = issuedAt + sessionExpireHours`
- `IpHash` เป็น SHA-256 ของ IP ถ้ามี `RemoteIpAddress`

cache key ที่ใช้เก็บ session คือ:

```text
anonymous:session:{sessionId}
```

### Validate

`AnonymousSessionService.ValidateAsync(HttpContext)`:

1. อ่าน token จาก header ก่อน
2. ถ้าไม่มี header จะอ่าน cookie token
3. decrypt token
4. deserialize payload
5. ตรวจ version / session id / fingerprint / expiry
6. resolve device id ใหม่จาก request ปัจจุบัน
7. เทียบ fingerprint กับ request ปัจจุบัน
8. เก็บ `AnonymousSessionContext` ไว้ใน `HttpContext.Items[AnonymousConstants.ContextKey]`
9. ถ้า cache ยังไม่มี context จะเขียนกลับเข้า cache

header / cookie ที่อ่าน token:

- header: ชื่อที่ได้จาก `anonymous_header_name` หรือ default `agm-anonymous-session-key`
- cookie: ชื่อที่ได้จาก `anonymous_cookie_name` หรือ default `AgmAnonymousSession`
- ถ้า cookie ชื่อไม่มีจุดนำหน้า ระบบจะลองอ่าน `.CookieName` เพิ่มให้อัตโนมัติ

### Rate limit

`AnonymousRateLimitService` มี 2 แบบ:

- `ValidateAsync(sessionId)` — per-second rate limit
- `ValidateDailyCreationAsync(fingerprint)` — daily create limit

cache key ที่ใช้:

```text
anonymous:rate:{sessionId}:{yyyyMMddHHmmss}
anonymous:create:{yyyyMMdd}:{fingerprint}
```

`ValidateAsync()` จะไม่ทำงานถ้า rate limit ถูกปิดใน config

## Middleware และ attribute

### `AnonymousAuthorizeAttribute`

เมื่อติดบน controller/action:

- ถ้า request authenticated อยู่แล้ว จะข้าม
- ถ้าไม่ได้ authenticated จะเรียก `IAnonymousSessionService.ValidateAsync()`

### `AnonymousRateLimitAttribute`

เมื่อติดบน controller/action:

- ถ้า request authenticated อยู่แล้ว จะข้าม
- ถ้าไม่ได้ authenticated จะ validate session ก่อน ถ้ายังไม่มี context ใน `HttpContext.Items`
- จากนั้นจะเรียก `IAnonymousRateLimitService.ValidateAsync(sessionId)`

### Middleware

- `AnonymousSessionMiddleware` validate เฉพาะ endpoint ที่มี `AnonymousAuthorizeAttribute`
- `AnonymousRateLimitMiddleware` validate เฉพาะ endpoint ที่มี `AnonymousRateLimitAttribute`

ถ้า endpoint ไม่มี metadata ที่ตรงกัน middleware จะปล่อยผ่าน

## ตัวอย่างใน Playground

### สร้าง session

Controller ที่ใช้อยู่คือ `AgriMap.Platform.Playground.Presentation.Controllers.AnonymousSessionController`

`POST /api/anonymous/session`

flow ที่ controller ใช้:

1. อ่าน `app_id` จาก body หรือ header
2. สำหรับ web client จะใช้ `AgmTraceId` cookie เป็น trace id ถ้ามี
3. สำหรับ native client จะต้องมี device id
4. เรียก `IAnonymousSessionUseCase.CreateAsync(...)`
5. set cookie anonymous session
6. ถ้าเป็น web client และยังไม่มี trace cookie จะ issue `AgmTraceId` cookie เพิ่ม

request body ตัวอย่าง:

```json
{
  "app_id": "agrimap-mobile",
  "device_id": "mobile-device-id-001"
}
```

response ตัวอย่าง:

```json
{
  "anonymous_session_key": "....",
  "trace_id": "mobile-device-id-001",
  "expired_at": "2026-07-15T12:00:00Z"
}
```

### อ่าน anonymous context

`GET /api/anonymous/session/me`

endpoint นี้ติด:

- `[AnonymousAuthorize]`
- `[AnonymousRateLimit]`

และคืนค่าข้อมูลจาก `HttpContext.Items[AnonymousConstants.ContextKey]`

## ตัวอย่างการใช้งานในโค้ด

```csharp
builder.Services.AddAnonymousProtection();
```

```csharp
[AnonymousAuthorize]
[AnonymousRateLimit]
[HttpGet("session/me")]
public IActionResult GetCurrent()
{
    var context = HttpContext.Items[AnonymousConstants.ContextKey] as AnonymousSessionContext;
    return Ok(context);
}
```

## ข้อควรระวัง

- `AnonymousSessionService.ValidateAsync()` ไม่อ่าน `device_id` จาก query/body โดยตรง; มันอ่าน `AgmTraceId`, query `device_id` และ body device id ตามลำดับผ่าน resolver
- `CreateAsync()` ต้องมี `IHttpContextAccessor.HttpContext`
- token/token-cookie ถูกอ่านจาก header ก่อน cookie
- `AnonymousSessionService` ใช้ AES แบบ deterministic IV จาก key ที่กำหนดไว้
- ถ้า payload หมดอายุจะ throw `AppException(401, "anonymous_token_expired", ...)`
- ถ้า fingerprint ไม่ตรงจะ throw `AppException(401, "anonymous_fingerprint_mismatch", ...)`
- `AnonymousRateLimitService` ใช้ cache เป็น state store หลัก; ถ้า cache backend มีปัญหา validation จะกระทบโดยตรง
- ควรวาง middleware หลัง `UseRouting()` และ `UseAuthentication()` เพื่อให้ endpoint metadata และ authenticated short-circuit ทำงานถูกต้อง
