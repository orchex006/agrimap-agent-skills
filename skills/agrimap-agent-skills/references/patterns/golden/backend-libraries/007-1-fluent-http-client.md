# AgriMap Fluent HTTP Client

Fluent HTTP Client สำหรับเรียก HTTP API ผ่าน `IHttpClientFactory` บน .NET 8 รองรับ JSON, XML,
ข้อความ, form, upload/download, named clients, cancellation และการอ่าน `HttpResponseMessage` โดยตรง

> ตัวอย่างสมมติว่ามี DTO เช่น `User`, `LoginResponse` และ `UploadResponse` อยู่แล้ว

## การลงทะเบียน

เพิ่ม reference ไปยัง `AgriMap.Platform` และ import namespace:

```csharp
using AgriMap.Platform.Http.Fluent;
```

### Default client

```csharp
builder.Services.AddFluentHttpClient();
```

กำหนดค่า default client:

```csharp
builder.Services.AddFluentHttpClient(httpClientBuilder =>
{
    httpClientBuilder.ConfigureHttpClient(client =>
    {
        client.Timeout = TimeSpan.FromSeconds(30);
    });
});
```

### Default และ named clients

```csharp
builder.Services.AddFluentHttpClient(
    ("Default", httpClientBuilder => httpClientBuilder.ConfigureHttpClient(client =>
        client.Timeout = TimeSpan.FromSeconds(30))),
    ("FileClient", httpClientBuilder => httpClientBuilder.ConfigureHttpClient(client =>
        client.Timeout = TimeSpan.FromMinutes(5)))
);
```

เมื่อลงทะเบียนด้วย overload แบบหลาย client จะลงทะเบียนเฉพาะชื่อที่ส่งเข้าไปเท่านั้น ถ้าต้องการใช้
`CreateRequest()` แบบไม่ระบุชื่อ ควรมี client ชื่อ `Default` ดังตัวอย่างข้างต้น

## การ Inject

```csharp
public sealed class UserService
{
    private readonly IFluentHttpClient _httpClient;

    public UserService(IFluentHttpClient httpClient)
    {
        _httpClient = httpClient;
    }
}
```

`CreateRequest()` สร้าง request จาก client ชื่อ `Default` ส่วน `CreateRequest("FileClient")`
สร้าง request จาก named client ที่กำหนด

## GET

### GET แบบง่าย

```csharp
List<User>? users = await _httpClient.CreateRequest()
    .WithUrl("https://api.example.com/users")
    .Get()
    .ExecuteAsync<List<User>>();
```

### Query parameters

สำหรับ GET และ HEAD ที่ไม่ได้กำหนด content type ค่าใน `WithParameters` จะถูก encode และต่อเป็น
query string โดยคง query string เดิมใน URL ไว้

```csharp
List<User>? users = await _httpClient.CreateRequest()
    .WithUrl("https://api.example.com/users?active=true")
    .Get()
    .WithParameters(parameters => parameters
        .Add("page", 1)
        .Add("limit", 10)
        .Add("search", "rice & corn"))
    .ExecuteAsync<List<User>>();
```

URL ที่ส่งจะมีค่าประมาณ
`https://api.example.com/users?active=true&page=1&limit=10&search=rice%20%26%20corn`

### Headers และ Bearer token

```csharp
List<User>? users = await _httpClient.CreateRequest()
    .WithUrl("https://api.example.com/users")
    .Get()
    .WithBearerToken("your-token-here")
    .WithHeader("X-Api-Version", "2.0")
    .ExecuteAsync<List<User>>();
```

เพิ่มหลาย header พร้อมกัน:

```csharp
List<User>? users = await _httpClient.CreateRequest()
    .WithUrl("https://api.example.com/users")
    .Get()
    .WithHeaders(headers =>
    {
        headers["X-Custom-Header"] = "value";
        headers["Accept-Language"] = "th-TH";
    })
    .ExecuteAsync<List<User>>();
```

## JSON requests

### POST object เป็น JSON

```csharp
var newUser = new User
{
    Name = "John",
    Email = "john@example.com"
};

User? createdUser = await _httpClient.CreateRequest()
    .WithUrl("https://api.example.com/users")
    .Post()
    .AsJson()
    .WithParameters(parameters => parameters.SetBody(newUser))
    .ExecuteAsync<User>();
```

### POST raw JSON

```csharp
User? createdUser = await _httpClient.CreateRequest()
    .WithUrl("https://api.example.com/users")
    .Post()
    .AsJson()
    .WithParameters(parameters => parameters.SetBody(
        "{\"name\":\"John\",\"email\":\"john@example.com\"}"))
    .ExecuteAsync<User>();
```

### สร้าง JSON object จาก parameters

```csharp
User? createdUser = await _httpClient.CreateRequest()
    .WithUrl("https://api.example.com/users")
    .Post()
    .AsJson()
    .WithParameters(parameters => parameters
        .Add("name", "John")
        .Add("email", "john@example.com"))
    .ExecuteAsync<User>();
```

### PUT และ PATCH

```csharp
User? updated = await _httpClient.CreateRequest()
    .WithUrl("https://api.example.com/users/123")
    .Put()
    .AsJson()
    .WithParameters(parameters => parameters.SetBody(updatedUser))
    .ExecuteAsync<User>();
```

```csharp
User? patched = await _httpClient.CreateRequest()
    .WithUrl("https://api.example.com/users/123")
    .Patch()
    .AsJson()
    .WithParameters(parameters => parameters.SetBody(partialUpdate))
    .ExecuteAsync<User>();
```

### DELETE

```csharp
string responseBody = await _httpClient.CreateRequest()
    .WithUrl("https://api.example.com/users/123")
    .Delete()
    .ExecuteAsync();
```

ใช้ `WithMethod(HttpMethod)` หรือ `WithMethod(string)` สำหรับ method อื่น:

```csharp
string responseBody = await _httpClient.CreateRequest()
    .WithUrl("https://api.example.com/resources")
    .WithMethod(HttpMethod.Options)
    .ExecuteAsync();
```

## Form requests

### application/x-www-form-urlencoded

```csharp
LoginResponse? login = await _httpClient.CreateRequest()
    .WithUrl("https://api.example.com/login")
    .Post()
    .AsFormUrlEncoded()
    .WithParameters(parameters => parameters
        .Add("username", "john")
        .Add("password", "secret"))
    .ExecuteAsync<LoginResponse>();
```

### multipart/form-data

```csharp
SubmitResponse? submitted = await _httpClient.CreateRequest()
    .WithUrl("https://api.example.com/submit")
    .Post()
    .AsFormData()
    .WithParameters(parameters => parameters
        .Add("name", "John")
        .Add("age", 30))
    .ExecuteAsync<SubmitResponse>();
```

## Upload files

### ไฟล์เดียวจาก byte array

```csharp
byte[] documentBytes = await File.ReadAllBytesAsync("document.pdf");

UploadResponse? upload = await _httpClient.CreateRequest()
    .WithUrl("https://api.example.com/upload")
    .Post()
    .UploadFileAsync<UploadResponse>("file", "document.pdf", documentBytes);
```

### ไฟล์เดียวจาก stream

```csharp
await using FileStream documentStream = File.OpenRead("document.pdf");

UploadResponse? upload = await _httpClient.CreateRequest()
    .WithUrl("https://api.example.com/upload")
    .Post()
    .UploadFileAsync<UploadResponse>("file", "document.pdf", documentStream);
```

### ไฟล์พร้อม form fields

```csharp
byte[] documentBytes = await File.ReadAllBytesAsync("document.pdf");

UploadResponse? upload = await _httpClient.CreateRequest()
    .WithUrl("https://api.example.com/upload")
    .Post()
    .AsFormData()
    .WithParameters(parameters => parameters
        .Add("title", "My Document")
        .AttachFile("file", "document.pdf", documentBytes))
    .ExecuteAsync<UploadResponse>();
```

### หลายไฟล์

```csharp
var files = new (string fileName, byte[] fileBytes)[]
{
    ("file1.pdf", await File.ReadAllBytesAsync("file1.pdf")),
    ("file2.pdf", await File.ReadAllBytesAsync("file2.pdf"))
};

UploadResponse? upload = await _httpClient.CreateRequest()
    .WithUrl("https://api.example.com/upload-multiple")
    .Post()
    .UploadFilesAsync<UploadResponse>("files", files);
```

`UploadFilesAsync` และ `AttachFiles` รองรับทั้ง tuple ที่เก็บ `byte[]` และ tuple ที่เก็บ `Stream`

## Download files

### Download เป็น byte array

```csharp
byte[] downloadedBytes = await _httpClient.CreateRequest("FileClient")
    .WithUrl("https://api.example.com/download/document.pdf")
    .Get()
    .DownloadAsync();

await File.WriteAllBytesAsync("downloaded.pdf", downloadedBytes);
```

### Download พร้อม progress

```csharp
var progress = new Progress<double>(percent =>
    Console.WriteLine($"Downloaded: {percent:F2}%"));

byte[] downloadedBytes = await _httpClient.CreateRequest("FileClient")
    .WithUrl("https://api.example.com/download/large-file.zip")
    .Get()
    .DownloadWithProgressAsync(progress);
```

Progress จะถูกรายงานเมื่อ response มี `Content-Length` เท่านั้น

### Download เป็น stream

เหมาะกับไฟล์ขนาดใหญ่และควร dispose stream หลังใช้งาน

```csharp
await using Stream source = await _httpClient.CreateRequest("FileClient")
    .WithUrl("https://api.example.com/download/large-file.zip")
    .Get()
    .DownloadAsStreamAsync();

await using FileStream destination = File.Create("downloaded.zip");
await source.CopyToAsync(destination);
```

## XML และข้อความ

### ส่งและรับ XML

```csharp
string xml = "<user><name>John</name></user>";

XDocument responseXml = await _httpClient.CreateRequest()
    .WithUrl("https://api.example.com/users")
    .Post()
    .AsXml()
    .WithParameters(parameters => parameters.SetBody(xml))
    .ExecuteAsXmlAsync();

string? userName = responseXml.Root?.Element("name")?.Value;
```

ต้อง import `System.Xml.Linq` เมื่อใช้ `XDocument`

### ส่ง plain text

```csharp
string responseBody = await _httpClient.CreateRequest()
    .WithUrl("https://api.example.com/messages")
    .Post()
    .AsText()
    .WithParameters(parameters => parameters.SetBody("hello"))
    .ExecuteAsync();
```

ใช้ `WithContentType(ContentType)` แทน `AsJson`, `AsXml`, `AsText`, `AsFormData` หรือ
`AsFormUrlEncoded` ได้เมื่อจำเป็น

## Cancellation

```csharp
public async Task<List<User>?> GetUsersAsync(CancellationToken cancellationToken)
{
    return await _httpClient.CreateRequest()
        .WithUrl("https://api.example.com/users")
        .Get()
        .WithCancellationToken(cancellationToken)
        .ExecuteAsync<List<User>>();
}
```

Cancellation ถูกส่งต่อไปยังการส่ง request การอ่าน response และการ download

## Response และ error handling

### ตรวจสอบ success status อัตโนมัติ

`ExecuteAsync<T>`, `ExecuteAsync()`, `ExecuteAsXmlAsync` และเมธอด download/upload จะเรียก
`EnsureSuccessStatusCode()` จึง throw `HttpRequestException` เมื่อ status ไม่อยู่ในช่วง 200–299

```csharp
try
{
    List<User>? users = await _httpClient.CreateRequest()
        .WithUrl("https://api.example.com/users")
        .Get()
        .ExecuteAsync<List<User>>();
}
catch (HttpRequestException exception)
{
    Console.WriteLine($"HTTP request failed: {exception.Message}");
}
catch (OperationCanceledException)
{
    Console.WriteLine("HTTP request was canceled or timed out");
}
```

### อ่าน body โดยไม่ validate HTTP status

```csharp
string errorBody = await _httpClient.CreateRequest()
    .WithUrl("https://api.example.com/users")
    .Get()
    .ExecuteWithoutValidationAsync<string>() ?? string.Empty;
```

`ExecuteWithoutValidationAsync<T>` ข้ามเฉพาะ `EnsureSuccessStatusCode()` จึงยัง throw ได้จาก network,
cancellation หรือการ deserialize และไม่คืน status code/headers

### อ่าน HttpResponseMessage โดยตรง

ใช้เมื่อต้องตรวจ status code, headers และ body ด้วยตนเอง ผู้เรียกต้อง dispose response

```csharp
using HttpResponseMessage response = await _httpClient.CreateRequest()
    .WithUrl("https://api.example.com/users/123")
    .Get()
    .ExecuteAsHttpResponseAsync();

string responseBody = await response.Content.ReadAsStringAsync();

if (!response.IsSuccessStatusCode)
{
    Console.WriteLine($"Request failed with status {(int)response.StatusCode}");
}
```

## Advanced usage

ปรับ `HttpRequestMessage` ก่อน execute:

```csharp
FluentHttpRequest request = _httpClient.CreateRequest()
    .WithUrl("https://api.example.com/users")
    .Get();

HttpRequestMessage requestMessage = request.GetHttpRequestMessage();
requestMessage.Version = HttpVersion.Version20;
requestMessage.VersionPolicy = HttpVersionPolicy.RequestVersionOrLower;

List<User>? users = await request.ExecuteAsync<List<User>>();
```

เข้าถึง client ที่ request นี้ใช้งาน:

```csharp
FluentHttpRequest request = _httpClient.CreateRequest("FileClient")
    .WithUrl("https://api.example.com/files")
    .Get();

request.GetHttpClient().DefaultRequestHeaders.UserAgent.ParseAdd("AgriMap/1.0");
string responseBody = await request.ExecuteAsync();
```

ไม่ควรสร้าง `HttpRequestMessage` ใหม่แล้วเรียก `SendAsync` จาก `GetHttpClient()` เพราะจะข้าม method,
headers, parameters และ content ที่กำหนดไว้ใน `FluentHttpRequest`

## ข้อควรทราบ

- สร้าง `FluentHttpRequest` ใหม่สำหรับแต่ละการส่ง ไม่ควร execute request เดิมซ้ำ
- `ExecuteAsync<T>` และ `SetBody<T>` ใช้ค่าเริ่มต้นของ `System.Text.Json`; การจับคู่ชื่อ property
  ตอน deserialize เป็นแบบ case-sensitive ควรใช้ชื่อให้ตรง JSON หรือกำหนด `JsonPropertyNameAttribute`
- เมธอดที่คืน `T?` อาจคืน `null` ได้ ผู้เรียกควรรองรับ nullable result
- `WithUrl` ต้องได้รับ absolute URL ที่ถูกต้องก่อน execute
- ผู้เรียกต้อง dispose stream ที่ส่งเข้า upload, stream ที่ได้จาก download และ `HttpResponseMessage`
  ที่ได้จาก `ExecuteAsHttpResponseAsync`
