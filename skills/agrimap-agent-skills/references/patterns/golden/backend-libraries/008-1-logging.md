# AgriMap Platform Logging

โมดูล `AgriMap.Platform.Logging` สำหรับสร้าง application logger, บันทึก metadata ของ HTTP
request/response, mask ข้อมูลสำคัญใน request และเลือก bypass การ buffer response สำหรับ endpoint
ที่ stream ไฟล์ขนาดใหญ่

โมดูลนี้ target .NET 8 และใช้ `Microsoft.Extensions.Logging` เป็น abstraction โดยโปรเจกต์ปัจจุบัน
อ้างอิง `NLog.Extensions.Logging` และ `NLog.Web.AspNetCore` เวอร์ชัน 5.3.15 เป็น logging provider

## ส่วนประกอบ

| ส่วนประกอบ | หน้าที่ |
| --- | --- |
| `ILoggerService` | สร้าง `ILogger` หรือ `ILogger<T>` จาก `ILoggerFactory` |
| `LoggerExtensions` | เพิ่ม `Information`, `Warning`, `Error` และ formatter สำหรับ request/response |
| `MaskSensitiveLoggingMiddleware` | อ่าน query string, JSON หรือ form และเก็บค่าที่ผ่านการ mask |
| `RequestLoggingMiddleware` | เขียน request log, จับเวลา, buffer response และเขียน response log |
| `LoggingServiceOptions` | ตั้งค่า path/extension ที่ไม่ต้อง buffer response |

`AddLoggingService` ลงทะเบียน service ของโมดูลเท่านั้น ไม่ได้กำหนด NLog target, rule หรือ output
ปลายทางให้ application

## การตั้งค่า NLog

Application ต้องตั้ง logging provider และมี NLog configuration ของตัวเอง ตัวอย่างการเริ่ม NLog
ตั้งแต่ก่อนสร้าง host เพื่อให้เก็บ startup error ได้:

```csharp
using AgriMap.Platform.Logging;
using NLog;
using NLog.Web;

string environment =
    Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production";
string nlogConfigFile = $"nlog.{environment}.config";

NLog.Logger bootstrapLogger = LogManager.Setup()
    .LoadConfigurationFromFile(nlogConfigFile)
    .GetCurrentClassLogger();

try
{
    WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

    builder.Logging.ClearProviders();
    builder.Host.UseNLog();

    // ลงทะเบียน AgriMap logging services ในหัวข้อถัดไป
}
catch (Exception exception)
{
    bootstrapLogger.Error(exception, "Application terminated unexpectedly");
    throw;
}
finally
{
    LogManager.Shutdown();
}
```

ต้องทำให้ `nlog.{Environment}.config` ถูก copy ไปยัง output/publish directory และชื่อ environment
ต้องตรงกับชื่อไฟล์ เช่น `Development`, `Local`, `Inhouse`, `Staging` หรือ `Production`

NLog configuration ต้องมี rule สำหรับ logger ชื่อ `Request` และ `Response` ถ้าต้องการเก็บ access log:

```xml
<?xml version="1.0" encoding="utf-8" ?>
<nlog xmlns="http://www.nlog-project.org/schemas/NLog.xsd"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      throwConfigExceptions="true">
  <targets>
    <target name="RequestConsole"
            xsi:type="Console"
            layout="${longdate}|${level:uppercase=true}|request|${message}|${gdc:item=UserId}" />
    <target name="ResponseConsole"
            xsi:type="Console"
            layout="${longdate}|${level:uppercase=true}|response|${message}" />
    <target name="ApplicationConsole"
            xsi:type="Console"
            layout="${longdate}|${level:uppercase=true}|${logger}|${message} ${exception:format=tostring}" />
  </targets>

  <rules>
    <logger name="Request" minlevel="Info" writeTo="RequestConsole" final="true" />
    <logger name="Response" minlevel="Info" writeTo="ResponseConsole" final="true" />
    <logger name="AgriMap.*" minlevel="Info" writeTo="ApplicationConsole" />
    <logger name="*" minlevel="Error" writeTo="ApplicationConsole" />
  </rules>
</nlog>
```

`RequestLoggingMiddleware` ตั้ง `UserId` ใน NLog `GlobalDiagnosticsContext` ดังนั้น layout ต้องใช้
`${gdc:item=UserId}` ไม่ใช่ `${mdlc:item=UserId}` โมดูลนี้ไม่ได้สร้าง `RequestId`; ถ้า layout ใช้
`${mdlc:item=RequestId}` application ต้องมี middleware อื่นกำหนดค่าเอง

## การลงทะเบียน service

Import namespace:

```csharp
using AgriMap.Platform.Logging;
```

### ค่าเริ่มต้น

```csharp
builder.Services.AddLoggingService();
```

ค่าเริ่มต้นไม่มี path หรือ extension ที่ bypass response buffering เพื่อรักษาพฤติกรรมเดิม

### อ่านค่าจาก IConfiguration

```csharp
builder.Services.AddLoggingService(builder.Configuration);
```

ใช้ section `LoggingService` จาก configuration และเป็นรูปแบบที่แนะนำเมื่อ application ตั้งค่า
response buffering bypass อย่างชัดเจน

### กำหนดค่าจาก code

```csharp
builder.Services.AddLoggingService(options =>
{
    options.ResponseBodyBuffering.BypassPathPrefixes =
    [
        "/files",
        "/downloads"
    ];

    options.ResponseBodyBuffering.BypassFileExtensions =
    [
        ".zip",
        ".pdf",
        ".xlsx"
    ];
});
```

เพื่อ backward compatibility ถ้าเรียก `AddLoggingService()` โดยไม่ส่ง configuration แต่มี section
`LoggingService` อยู่ `RequestLoggingMiddleware` จะลองอ่าน section นี้จาก `IConfiguration` เป็น fallback

## ลำดับ middleware

ลำดับขั้นต่ำสำหรับ request masking และ request/response logging:

```csharp
app.Use(async (context, next) =>
{
    context.Request.EnableBuffering();
    await next();
});

app.UseMiddleware<MaskSensitiveLoggingMiddleware>();
app.UseMiddleware<RequestLoggingMiddleware>();
```

เหตุผลของลำดับ:

1. `EnableBuffering` ต้องทำก่อน middleware อ่าน request body เพื่อให้ body อ่านซ้ำได้
2. `MaskSensitiveLoggingMiddleware` ต้องทำก่อน `RequestLoggingMiddleware` เพื่อให้ request log ใช้ค่าที่
   mask แล้ว
3. `RequestLoggingMiddleware` ต้องครอบ middleware/endpoint ที่ต้องการวัดเวลาและเก็บ response size

ถ้าต้องการให้ `UserId` มาจาก authenticated principal ต้องวาง `RequestLoggingMiddleware` หลัง
`UseAuthentication()` เพราะ middleware อ่าน `HttpContext.User` ก่อนเรียก middleware ถัดไป:

```csharp
app.UseRouting();
app.UseAuthentication();

app.UseMiddleware<MaskSensitiveLoggingMiddleware>();
app.UseMiddleware<RequestLoggingMiddleware>();

app.UseAuthorization();
app.MapControllers();
```

`EnableBuffering()` จะเก็บ request body ขนาดเล็กใน memory และย้าย body ที่เกิน threshold เริ่มต้นไปยัง
temporary file ส่วน response buffering ของโมดูลนี้ใช้ `MemoryStream` ทั้งก้อน

implementation ปัจจุบันอ่าน JSON stream และ `Request.Form` แบบ synchronous โปรเจกต์ Playground จึง
เปิด `KestrelServerOptions.AllowSynchronousIO` หาก host ปิด synchronous I/O แล้ว endpoint ที่มี body
ทำงานผิดพลาด ต้องเปิด option ที่ host รองรับหรือปรับ middleware ให้ใช้ asynchronous APIs ก่อนใช้งานจริง

## พฤติกรรม sensitive-data masking

โมดูลตรวจ query string, JSON object แบบ recursive และ form fields โดยเทียบชื่อ key แบบ
case-insensitive ถ้าตรงกับรายการ sensitive key ค่าจะถูกแทนด้วย `[MASKED]`

ตัวอย่าง key ที่รองรับ:

- Password/secret: `password`, `pass`, `pwd`, `old_password`, `new_password`,
  `confirm_password`, `secret`, `secret_key`
- Token/passport: `token`, `access_token`, `refresh_token`, `passport`, `refresh_passport`
- Contact: `email`, `email_address`, `tel`, `phone`, `phone_number`
- Identity/payment: `id_card`, `idcard`, `card_id`, `citizen`, `credit_card`, `creditcard`

ตัวอย่าง JSON:

```json
{
  "username": "john",
  "password": "[MASKED]",
  "profile": {
    "email": "[MASKED]"
  }
}
```

### พฤติกรรมตาม environment

ค่าของ `ASPNETCORE_ENVIRONMENT` ถูกเทียบแบบ exact และมีผลดังนี้:

| Environment | Query string/body ใน request log |
| --- | --- |
| `Development` | เก็บค่าจริงโดยไม่ mask |
| `Production` | ไม่เก็บข้อมูล โดยคืน `-` เสมอ |
| ค่าอื่น เช่น `Local`, `Inhouse`, `Staging` | เก็บข้อมูลโดย mask sensitive keys |

ห้ามใช้ `Development` กับ production traffic เพราะ query string และ body อาจมี credential หรือข้อมูล
ส่วนบุคคลแบบไม่ถูก mask

### Content types ที่อ่าน body

implementation ปัจจุบันอ่าน body เมื่อ content type ตรงตามเงื่อนไขต่อไปนี้:

- JSON: ต้องเป็น `application/json` แบบ exact
- Form URL encoded: ต้องเป็น `application/x-www-form-urlencoded` แบบ exact
- Multipart form: ต้องขึ้นต้นด้วย `multipart/form-data`

ดังนั้น JSON ที่ส่งเป็น `application/json; charset=utf-8` หรือ media type แบบ `application/*+json`
ยังไม่ถูกอ่านโดย `MaskSensitiveLoggingMiddleware` และ request log จะมี body เป็น `-`

## รูปแบบ request log

Request log ถูกเขียนก่อนเรียก middleware ถัดไปผ่าน logger ชื่อ `Request`:

```json
{
  "method": "post",
  "path": "/api/users",
  "query_string": "page=1&token=[MASKED]",
  "body": "{...}",
  "headers": {
    "content_type": "application/json",
    "user_agent": "ExampleClient/1.0"
  },
  "BodySize": 128
}
```

รายละเอียด field:

| Field | ความหมาย |
| --- | --- |
| `method` | HTTP method ตัวพิมพ์เล็ก |
| `path` | `Request.Path` ไม่รวม scheme, host, PathBase และ query string |
| `query_string` | query string ที่ mask แล้ว หรือ `-` |
| `body` | JSON/form ที่ mask แล้ว หรือ `-` |
| `headers.content_type` | request content type หรือ `-` |
| `headers.user_agent` | ค่า `User-Agent` หรือ string ว่างเมื่อไม่มี header |
| `BodySize` | `Request.ContentLength`; เป็น `0` เมื่อไม่ทราบขนาด |

ชื่อ `BodySize` ใช้ตัวพิมพ์ตามนี้ เพราะ model ปัจจุบันไม่ได้กำหนด `JsonPropertyName`

## รูปแบบ response log

Response log ถูกเขียนผ่าน logger ชื่อ `Response` หลัง middleware ถัดไปทำงานเสร็จ

เมื่อ buffer response ตามปกติ:

```json
{
  "status_code": 200,
  "body_size": 1234,
  "process_time": 0.05
}
```

`body_size` คือขนาดจริงใน `MemoryStream` และ `process_time` มีหน่วยเป็นวินาที

เมื่อ bypass response buffering:

```json
{
  "status_code": 200,
  "body_size": 104857600,
  "process_time": 1.25,
  "path": "/downloads/report.pdf",
  "content_type": "application/pdf",
  "response_body_buffering_bypassed": true
}
```

เมื่อ bypass ค่า `body_size` มาจาก `Response.ContentLength`; ถ้า endpoint stream แบบ chunked หรือไม่ได้
กำหนด `Content-Length` ค่าจะเป็น `0` ไม่ใช่จำนวน byte ที่ส่งจริง

ถ้า middleware/endpoint ถัดไป throw exception ก่อนกลับมาที่ `RequestLoggingMiddleware` จะมี request log
แต่ไม่มี response log จาก middleware นี้ เว้นแต่ exception ถูกจัดการและสร้าง response ภายใน pipeline ที่
`RequestLoggingMiddleware` ครอบอยู่

## Response buffering และ large-file bypass

ค่าเริ่มต้น `RequestLoggingMiddleware` แทน `Response.Body` ด้วย `MemoryStream` เพื่อหาขนาด response
ก่อน copy กลับไปยัง stream เดิม วิธีนี้ใช้ได้กับ response ทั่วไป แต่ file download ขนาดใหญ่อาจใช้ memory
สูงหรือเกิด `OutOfMemoryException`

ตัวอย่าง stack trace:

```text
System.OutOfMemoryException
   at System.IO.MemoryStream.set_Capacity(Int32 value)
   at Microsoft.AspNetCore.StaticFiles.StaticFileContext.SendAsync()
```

ตั้งค่า endpoint ที่ stream ไฟล์ขนาดใหญ่ให้ bypass ผ่าน path หรือ file extension

### appsettings.json

```json
{
  "LoggingService": {
    "ResponseBodyBuffering": {
      "BypassPathPrefixes": [
        "/files",
        "/downloads",
        "/static/Installers"
      ],
      "BypassFileExtensions": [
        ".zip",
        ".pdf",
        ".xlsx",
        ".csv",
        ".jpg",
        ".jpeg",
        ".png",
        ".mp4"
      ]
    }
  }
}
```

### BypassPathPrefixes

ชื่อ option เป็น `BypassPathPrefixes` แต่ implementation รองรับทั้ง:

- path ที่ขึ้นต้นด้วยค่าที่กำหนด เช่น `/downloads/report.pdf`
- ลำดับ path segments เดียวกันที่อยู่หลัง gateway/service prefix เช่น
  `/gw/file-service/api/static/Installers/app.exe`

การ match ไม่สนตัวพิมพ์เล็ก/ใหญ่, เติม `/` ด้านหน้าให้โดยอัตโนมัติ และตัด `/` ท้ายค่า config

| Config | Request path | ผลลัพธ์ |
| --- | --- | --- |
| `/files` | `/files/123/download` | Match |
| `/static/Installers` | `/api/static/Installers/app.exe` | Match |
| `/static/Installers` | `/gw/file-service/api/static/Installers/app.exe` | Match |
| `/static/Installers` | `/api/static/InstallersX/app.exe` | ไม่ match |
| `/static/Installers` | `/api/foo-static/Installers/app.exe` | ไม่ match |

ระบบตรวจทั้ง `Request.Path` และ `Request.PathBase + Request.Path` จึงรองรับ application ที่ใช้
`UsePathBase` หรือถูกเรียกผ่าน reverse proxy ตราบใดที่ path ที่ถึง service ยังมี segment ที่กำหนด

### BypassFileExtensions

ระบบใช้ `Path.GetExtension(Request.Path)` และเทียบแบบ case-insensitive สามารถกำหนดแบบมีหรือไม่มี `.`:

| Config | Request path | ผลลัพธ์ |
| --- | --- | --- |
| `.pdf` | `/files/report.pdf` | Match |
| `xlsx` | `/exports/monthly.XLSX` | Match |
| `.zip` | `/downloads/archive.zip` | Match |
| `.pdf` | `/files/123` ที่ response เป็น PDF | ไม่ match |

การตัดสินใจ bypass เกิดก่อนเรียก endpoint จึงตรวจจาก request path/extension เท่านั้น ไม่ได้ตรวจจาก
response `Content-Type` แนะนำใช้ path เป็นหลักสำหรับ endpoint ที่ URL ไม่มีนามสกุลไฟล์

## Application logging

Application สามารถ inject `ILogger<T>` ตามมาตรฐาน หรือใช้ `ILoggerService`:

```csharp
public sealed class ExampleService
{
    private readonly ILogger<ExampleService> _logger;

    public ExampleService(ILoggerService loggerService)
    {
        _logger = loggerService.CreateLogger<ExampleService>();
    }

    public void Run(string jobId)
    {
        _logger.LogInformation("Starting job {JobId}", jobId);
    }
}
```

Extension methods ที่โมดูลเพิ่ม:

```csharp
_logger.Information("Starting job {0}", jobId);
_logger.Warning("Job completed with warning");
_logger.Error("Job failed", exception);
```

สำหรับ structured logging ให้ใช้ `LogInformation`, `LogWarning` และ `LogError` ของ
`Microsoft.Extensions.Logging` โดยส่ง message template กับ arguments แยกกัน เพราะ extension บางตัวของ
โมดูลประกอบ exception เป็นข้อความธรรมดา

## ข้อจำกัดและข้อควรระวัง

- response ที่ไม่ bypass ถูก buffer ใน memory ทั้งก้อน โมดูลไม่มี size threshold
- bypass ไม่ปิด request logging และไม่ลด overhead จากการอ่าน request body
- JSON content type ที่มี charset หรือ suffix `+json` ยังไม่ถูกอ่านเพื่อ mask
- `Development` เก็บ query string/body แบบไม่ mask และ `Production` ซ่อนทั้งสอง field เสมอ
- sensitive key ใช้รายการแบบกำหนดไว้ล่วงหน้า key ใหม่ที่ไม่อยู่ในรายการจะไม่ถูก mask
- multipart form อาจทำให้ ASP.NET Core parse/upload form ก่อน endpoint; ควรทดสอบกับไฟล์ขนาดใหญ่
- request body/form ถูกอ่านแบบ synchronous ซึ่งอาจต้องเปิด `AllowSynchronousIO` และอาจกระทบ throughput
- `GlobalDiagnosticsContext` เป็น global state ไม่ใช่ request-local state จึงไม่ควรใช้ `UserId` นี้เป็น
  หลักฐาน audit ที่ต้องรับประกันความถูกต้องภายใต้ concurrent requests
- `UserIdLoggingMiddleware` ปัจจุบันเป็น placeholder และไม่ได้เพิ่มข้อมูลลง log

## เอกสารอ้างอิง

- [ASP.NET Core: EnableBuffering](https://learn.microsoft.com/en-us/dotnet/api/microsoft.aspnetcore.http.httprequestrewindextensions.enablebuffering?view=aspnetcore-8.0)
- [ASP.NET Core: Read request body](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/use-http-context?view=aspnetcore-8.0#enable-request-body-buffering)
- [NLog: Getting started with ASP.NET Core](https://github.com/NLog/NLog/wiki/Getting-started-with-ASP.NET-Core-6)
- [NLog configuration reference](https://nlog-project.org/config/)
