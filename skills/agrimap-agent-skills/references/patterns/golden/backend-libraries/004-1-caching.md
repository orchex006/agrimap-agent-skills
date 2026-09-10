# Caching Module

`AgriMap.Platform.Caching` รองรับ provider `InMemory` และ `Redis` ผ่าน interface เดียวกัน

## สถานะปัจจุบันของโค้ด

- `ServiceCollectionExtensions.AddCacheService(...)` อ่านค่า `Caching:Provider` จาก configuration
- ค่าที่รองรับคือ `InMemory` และ `Redis`
- `CacheKeyHelper` สร้าง cache key แบบ SHA-1 hex string ความยาว 40 ตัวอักษร
- `Redis` ต้องกำหนด `Caching:Connection`
- `AddInMemoryCacheProvider(...)` และ `AddRedisCacheProvider(...)` ลงทะเบียน `ICacheService` คนละ implementation แต่ expose contract เดียวกัน

---

## โครงสร้างไฟล์

```text
AgriMap.Platform/src/Caching/
├── Abstractions/
│   ├── ICacheService.cs          <- Interface กลาง (ใช้ร่วมกันทุก Provider)
│   └── CacheProvider.cs          <- Enum: InMemory, Redis
├── Memory/
│   ├── MemoryCacheService.cs     <- Implementation สำหรับ In-Memory Cache
│   └── MemoryCacheExtensions.cs  <- DI Extension: AddInMemoryCacheProvider
├── Redis/
│   ├── RedisCacheService.cs      <- Implementation สำหรับ Redis Cache
│   └── RedisCacheExtensions.cs   <- DI Extension: AddRedisCacheProvider
├── CacheKeyHelper.cs             <- Internal helper: SHA-1 hash cache key generator
├── ServiceCollectionExtensions.cs <- Entry point หลัก: AddCacheService (อ่าน appsettings)
└── README.md
```

---

## การตั้งค่า `appsettings.json`

### In-Memory Cache

```json
"Caching": {
  "Provider": "InMemory",
  "Connection": ""
}
```

### Redis Cache

```json
"Caching": {
  "Provider": "Redis",
  "Connection": "172.29.254.204:6379,password=your_password"
}
```

> `Connection` ใช้เฉพาะ `Redis`

---

## การลงทะเบียน DI

### วิธีที่ 1 - ใช้ `AddCacheService` (อ่าน Provider จาก appsettings อัตโนมัติ)

```csharp
// Program.cs หรือ SharedDependencyInjection.cs
builder.Services.AddCacheService(builder.Configuration);
```

### วิธีที่ 2 - ระบุ Provider ตรง ๆ

```csharp
// เลือก InMemory
builder.Services.AddInMemoryCacheProvider(builder.Configuration);

// เลือก Redis
builder.Services.AddRedisCacheProvider(builder.Configuration);
```

---

## Interface

```csharp
public interface ICacheService
{
    string MakeCacheKey(params string[] keyParts);

    Task<bool> ExistsAsync(string key);
    Task<string?> GetAsync(string key);
    Task<T?> GetAsync<T>(string key);
    Task SetAsync(string key, string value, TimeSpan? absoluteExpireTime = null);
    Task SetAsync<T>(string key, T value, TimeSpan? absoluteExpireTime = null);
    Task RemoveAsync(string key);

    Task<T> RememberAsync<T>(string key, TimeSpan? absoluteExpireTime, Func<Task<T>> factory);
    Task<T> RememberAsync<T>(string key, TimeSpan? absoluteExpireTime, Func<T> factory);
}
```

### พฤติกรรมสำคัญ

- `SetAsync<T>` จะ serialize ค่าเป็น JSON ก่อนเก็บ
- `GetAsync<T>` จะ deserialize JSON กลับเป็น object
- `RememberAsync` ทำ cache-aside: cache hit คืนค่าทันที, cache miss จะเรียก factory แล้วเก็บผลลัพธ์
- `MakeCacheKey` รวม key parts แล้ว hash ด้วย SHA-1 เพื่อให้ key สั้นและไม่เปิดเผยข้อมูลดิบ

---

## ตัวอย่างการใช้งาน

### 1. Inject ใน Service / UseCase

```csharp
public class ProductUseCase
{
    private readonly ICacheService _cache;

    public ProductUseCase(ICacheService cache)
    {
        _cache = cache ?? throw new ArgumentNullException(nameof(cache));
    }
}
```

### 2. Set / Get String

```csharp
// เก็บค่าแบบ String (หมดอายุ 10 นาที)
await _cache.SetAsync("greeting", "สวัสดี", TimeSpan.FromMinutes(10));

// ดึงค่า
var value = await _cache.GetAsync("greeting");
// value = "สวัสดี"
```

### 3. Set / Get Typed Object

```csharp
var user = new UserDto { Id = 1, Name = "John" };

// เก็บ Object (serialize เป็น JSON อัตโนมัติ)
await _cache.SetAsync("user:1", user, TimeSpan.FromMinutes(30));

// ดึงกลับเป็น Object
var cached = await _cache.GetAsync<UserDto>("user:1");
```

### 4. Cache-Aside Pattern (Get-Or-Set)

```csharp
public async Task<UserDto?> GetUserAsync(int userId)
{
    var key = $"user:{userId}";

    var cached = await _cache.GetAsync<UserDto>(key);
    if (cached is not null)
        return cached;

    var user = await _userRepository.GetUserByIdAsync(userId);
    if (user is not null)
        await _cache.SetAsync(key, user, TimeSpan.FromMinutes(15));

    return user;
}
```

### 5. Invalidate Cache หลัง Update

```csharp
public async Task UpdateUserAsync(UserUpdateRequestDto request)
{
    await _userRepository.UpdateUserAsync(request);

    await _cache.RemoveAsync($"user:{request.UserId}");
}
```

### 6. ตรวจสอบ Key

```csharp
var exists = await _cache.ExistsAsync("user:1");
if (!exists)
{
    // ยังไม่มีใน Cache
}
```

### 7. RememberAsync - Cache-Aside แบบ Inline

```csharp
var result = await _cache.RememberAsync<MyResponseDto>(
    cacheKey,
    TimeSpan.FromMinutes(10),
    async () => await _myUseCase.ExecuteAsync(request));
```

### 8. MakeCacheKey - สร้าง Hash Cache Key สำหรับ Multiple Channels

```csharp
var cacheKey = _cache.MakeCacheKey(userId, "profile-summary");
var reportKey = _cache.MakeCacheKey(userId, "amr-report", queryString);
var aggregatedKey = _cache.MakeCacheKey(userId, "aggregated-amr", queryString, requestBodyJson);
```

### 9. ใช้ MakeCacheKey ร่วมกับ RememberAsync

```csharp
public async Task<IActionResult> GetAggregatedData([FromQuery] MyRequestDto request)
{
    var cacheKey = _cache.MakeCacheKey(
        _authService.UserId(),
        JsonSerializer.Serialize(request));

    var result = await _cache.RememberAsync<object>(
        cacheKey,
        TimeSpan.FromMinutes(10),
        async () =>
        {
            var data = await _myUseCase.ExecuteAsync(request);
            return data is not null
                ? new { STATUS_CODE = 200, DATA = data }
                : new { STATUS_CODE = 200, MESSAGE = "NO_CONTENT" };
        });

    return Ok(result);
}
```

---

## การเลือก Provider

| Criteria | InMemory | Redis |
|---|---|---|
| Single-instance app | เหมาะสม | ใช้ได้ |
| Multi-instance / Load balanced | Cache ไม่ sync ข้าม instance | เหมาะสม |
| ต้องการ persistence | ไม่เหมาะ | เหมาะสม |
| Low latency (same process) | เร็วกว่า | มี network overhead |
| Dev / Local environment | ไม่ต้องติดตั้งเพิ่ม | ต้องมี Redis |

---

## NuGet Packages ที่ต้องการ

```xml
<!-- In-Memory -->
<PackageReference Include="Microsoft.Extensions.Caching.Memory" Version="*" />

<!-- Redis -->
<PackageReference Include="Microsoft.Extensions.Caching.StackExchangeRedis" Version="*" />
```

> แนะนำให้ pin version ให้ตรงกับ target framework ของ solution แทนการใช้ `*` ใน production

---

## Suggested Test Cases

- `AddCacheService(...)` ต้องเลือก `MemoryCacheService` เมื่อ `Caching:Provider = InMemory`
- `AddCacheService(...)` ต้องเลือก `RedisCacheService` เมื่อ `Caching:Provider = Redis`
- `AddCacheService(...)` ต้อง throw เมื่อไม่ได้กำหนด `Caching:Provider`
- `MakeCacheKey(...)` ต้องให้ผลลัพธ์ deterministic และความยาวคงที่
- `RememberAsync(...)` ต้องเรียก factory แค่ครั้งแรกเมื่อ cache miss
- `SetAsync<T>` / `GetAsync<T>` ต้อง round-trip object ได้ถูกต้อง
