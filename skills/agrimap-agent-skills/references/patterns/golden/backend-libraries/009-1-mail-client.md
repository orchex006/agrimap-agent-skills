# AgriMap Platform MailClient

`AgriMap.Platform.MailClient` เป็นโมดูลสำหรับสร้าง `MailMessage` จาก `QueryParameter` และส่งอีเมลผ่าน
SMTP โดยอ้างอิงค่าจาก `IConfiguration` ของ application

โมดูลนี้เหมาะกับงานที่ต้อง map ค่าจาก request/form/query ไปเป็นอีเมลจริง เช่น notification, approval,
report หรือ task ที่ต้องแนบไฟล์ก่อนส่ง

## ส่วนประกอบ

| ส่วนประกอบ                    | หน้าที่                                                           |
| ----------------------------- | ----------------------------------------------------------------- |
| `IMailClientService`          | interface กลางสำหรับสร้างและส่งอีเมล                              |
| `MailClientService`           | implementation สำหรับสร้าง `MailMessage` และส่งผ่าน SMTP          |
| `MailClientExtensions`        | extension สำหรับแปลง string เป็น `MailAddress` และ `MailPriority` |
| `ServiceCollectionExtensions` | `AddMailClientService()` สำหรับลงทะเบียน DI                       |

## การลงทะเบียน

เพิ่ม reference ไปยัง `AgriMap.Platform` และ import namespace:

```csharp
using AgriMap.Platform.MailClient;
```

ลงทะเบียน service:

```csharp
builder.Services.AddMailClientService();
```

`AddMailClientService()` ลงทะเบียน `IMailClientService` แบบ singleton

## การตั้งค่า `appsettings.json`

`MailClientService` อ่านค่าจาก section `WebServiceSettings:Email`

```json
{
  "WebServiceSettings": {
    "Email": {
      "Server": "smtp.example.com",
      "Port": 587,
      "EnableSSL": true,
      "Skip": false,
      "DefaultCredential": false,
      "SendWithWindowsCredential": false,
      "Username": "smtp-user",
      "Password": "smtp-password",
      "MailListSplitter": ";",
      "SenderAddress": "noreply@example.com|AgriMap Noreply",
      "FromParameter": "from",
      "ToParameter": "to",
      "CcParameter": "cc",
      "BccParameter": "bcc",
      "SubjectParameter": "subject",
      "BodyParameter": "body",
      "PriorityParameter": "priority"
    }
  }
}
```

ความหมายหลักของค่าที่ใช้:

| Key                                                              | ความหมาย                                  |
| ---------------------------------------------------------------- | ----------------------------------------- | ------------- |
| `Server`                                                         | SMTP host                                 |
| `Port`                                                           | SMTP port                                 |
| `EnableSSL`                                                      | เปิด/ปิด SSL                              |
| `Skip`                                                           | ถ้า `true` จะไม่เรียก `SmtpClient.Send()` |
| `DefaultCredential`                                              | ใช้ default credential ของเครื่อง         |
| `SendWithWindowsCredential`                                      | บังคับใช้ Windows credential              |
| `Username` / `Password`                                          | credential สำหรับ SMTP                    |
| `MailListSplitter`                                               | ตัวคั่นรายชื่อผู้รับ เช่น `;`             |
| `SenderAddress`                                                  | ค่า sender เริ่มต้น รูปแบบ `email         | display name` |
| `FromParameter` / `ToParameter` / `CcParameter` / `BccParameter` | ชื่อ key ใน `QueryParameter`              |
| `SubjectParameter` / `BodyParameter` / `PriorityParameter`       | ชื่อ key สำหรับ subject, body, priority   |

ถ้า `SenderAddress` ไม่มี display name จะใช้ email เดียวกันเป็น display name

## ตัวอย่างใช้งานพื้นฐาน

```csharp
using AgriMap.Platform.MailClient;
using AtlasX.Engine.Connector;

public sealed class NotificationService
{
    private readonly IMailClientService _mailClientService;

    public NotificationService(IMailClientService mailClientService)
    {
        _mailClientService = mailClientService;
    }

    public void SendWelcomeMail()
    {
        var parameters = new Dictionary<string, object>
        {
            ["from"] = "noreply@example.com",
            ["to"] = "john@example.com;jane@example.com",
            ["subject"] = "Welcome",
            ["body"] = "<p>Hello</p>",
            ["priority"] = "High"
        };

        QueryParameter queryParameter = new(parameters);
        MailMessage? mailMessage = _mailClientService.CreateMessageFromRequest(queryParameter);

        if (mailMessage is null)
        {
            throw new InvalidOperationException("Receiver is required");
        }

        _mailClientService.Send(mailMessage);
    }
}
```

## ตัวอย่างการแนบไฟล์

`CreateMessageFromRequest()` จะอ่าน `parameter.FileParameters` แล้วเพิ่มเป็น attachment ให้อัตโนมัติ

```csharp
var parameters = new Dictionary<string, object>
{
    ["from"] = "noreply@example.com",
    ["to"] = "john@example.com",
    ["subject"] = "Report",
    ["body"] = "<p>Please see attached file</p>"
};

var queryParameter = new QueryParameter(parameters);
queryParameter.FileParameters.Add(new FileParameter
{
    FileId = "report",
    FileName = "report.pdf",
    FileContent = await File.ReadAllBytesAsync("report.pdf")
});

MailMessage? message = _mailClientService.CreateMessageFromRequest(queryParameter);
```

## ตัวอย่างจาก Playground

ตัวอย่างที่ใช้งานจริงอยู่ที่
`AgriMap.Platform.Playground\Src\Presentation\Controllers\MailClientController.cs`

endpoint หลักคือ:

```http
POST /api/mail-client/send
```

controller นี้รับข้อมูลจาก form แล้วแปลงเป็น `QueryParameter` ก่อนเรียก `IMailClientService`
ขั้นตอนหลักคือ:

1. อ่าน `Sender` และ `MockReceivers` จาก configuration
2. ใช้ `receipients`, `subject`, `body`, `is_base64_body`, `attachments` และ `insert_attachments`
   จาก request
3. ถ้า `is_base64_body` เป็น `true` จะ decode body จาก Base64 ก่อน
4. สร้าง `QueryParameter`
5. เรียก `CreateMessageFromRequest()` แล้วตามด้วย `Send()`

ตัวอย่าง form fields ที่ controller คาดหวัง:

| Field                | ประเภท | ความหมาย                           |
| -------------------- | ------ | ---------------------------------- | --------------- | --------- |
| `receipients`        | string | รายชื่อผู้รับหลัก                  |
| `subject`            | string | subject                            |
| `body`               | string | body ของอีเมล                      |
| `is_base64_body`     | bool   | ระบุว่า body เป็น Base64 หรือไม่   |
| `attachments`        | string | รายการไฟล์แบบ `fileId              | fileName^fileId | fileName` |
| `insert_attachments` | file[] | ไฟล์ที่ upload เข้ามาพร้อม request |

## Helper methods

### `ToMailAddress()`

แปลง string เป็น `MailAddress`

```csharp
MailAddress sender = "noreply@example.com|AgriMap Noreply".ToMailAddress();
MailAddress receiver = "john@example.com".ToMailAddress();
```

รูปแบบที่รองรับ:

- `email|display name`
- `email`

ถ้าไม่มี display name จะใช้ email เป็น display name

### `ToMailPriority()`

```csharp
MailPriority high = "High".ToMailPriority();
MailPriority normal = "unknown-value".ToMailPriority();
```

ถ้า parse ไม่ได้จะ fallback เป็น `MailPriority.Normal`

## พฤติกรรมที่ควรรู้

- `CreateMessageFromRequest()` จะคืน `null` ถ้าไม่มีผู้รับใน key ที่กำหนดด้วย `ToParameter`
- `Subject` และ `Body` ถูกเข้ารหัสเป็น UTF-8
- `Body` ถูกตั้งเป็น HTML (`IsBodyHtml = true`)
- `Priority` ค่าเริ่มต้นเป็น `Normal`
- `Send()` เป็น synchronous และถ้าเกิด error จะ throw `InvalidOperationException("SEND_EMAIL_ERROR", ex)`
- ถ้า `Skip = true` จะไม่ส่งออก SMTP แต่ `Send()` ยังคืนค่า `true`

## ข้อควรระวัง

- ควรตั้งค่า `MailListSplitter` ให้ตรงกับรูปแบบรายชื่อผู้รับในระบบจริง
- `SenderAddress` ต้องเป็น email ที่ถูกต้อง ไม่เช่นนั้น `ToMailAddress()` จะ throw
- ถ้า `SendWithWindowsCredential = true` หรือ `DefaultCredential = true` ต้องแน่ใจว่า runtime environment รองรับ credential ที่ตั้งไว้
- `MailMessage` และ attachment ที่สร้างจาก stream ควร dispose หลังใช้งานเมื่อไม่ต้องใช้ต่อ
