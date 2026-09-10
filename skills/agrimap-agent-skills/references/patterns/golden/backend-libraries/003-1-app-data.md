# AppData

โฟลเดอร์นี้รวม helper สำหรับเรียกใช้งาน data access ของแพ็กเกจ
ครอบคลุมการลงทะเบียน service, การเรียก stored procedure, การรัน SQL statement,
การแปลง parameter/response และ exception wrapper ที่ใช้ใน flow ของ `AppDataController`

## ภาพรวมแนวคิด

`AppData` ถูกออกแบบให้เป็นชั้นบาง ๆ ระหว่าง controller/use case กับ AtlasX data access
โดยมีหน้าที่หลัก 3 อย่าง

- แปลง configuration ของ database ให้พร้อมใช้งานกับ `AtlasX.Engine`
- ทำ normalize parameter ก่อนส่งเข้า procedure หรือ SQL
- แปลงผลลัพธ์กลับมาเป็น `Dictionary<string, object>` หรือ `List<Dictionary<string, object>>`

จุดเด่นของ module นี้คือ controller จะเรียกใช้งานได้แบบ chain สั้น ๆ:

```csharp
var request = new QueryParameter(Request);
var data = await _dataAccessConfig.CallProcedureAsync(
    _dbDataAccessService.DatabaseConfigure!.DefaultDataSource,
    request[_dbDataAccessService.DatabaseConfigure!.ProcedureParameter]?.ToString() ?? string.Empty,
    request.ToParameter());

return Ok(data.ToResponse());
```

## โครงสร้างหลัก

### `ServiceCollectionExtensions.AddDataAccess(...)`

ลงทะเบียน dependency ของ data access จาก section:

`WebServiceSettings:Database`

สิ่งที่เมธอดนี้ทำ

- bind configuration เป็น `AtlasX.Engine.Connector.Models.Database`
- สร้าง `DataAccessConfiguration`
- map `ProviderFactory`
  - `MSSQL` -> `SqlServer`
  - `Oracle` -> `Oracle`
  - `PostgreSQL` -> `PostgreSql`
- ถ้า datasource มี `UserId` และ `Password` จะ append เข้า connection string
- register `Database`, `DataAccessConfiguration`, และ `IDbDataAccessService`

ตัวอย่าง configuration:

```json
{
  "WebServiceSettings": {
    "Database": {
      "DefaultDataSource": "Main",
      "ProcedureParameter": "app_data_procedure",
      "DataSourceParameter": "app_data_source",
      "NotiOutputParameter": "noti_output",
      "UserIdProcedureParameter": "user_id",
      "ConnectionLookupSource": "Main",
      "DataSource": {
        "Main": {
          "Provider": "MSSQL",
          "ConnectionString": "Server=.;Database=AgriMap;",
          "UserId": "sa",
          "Password": "secret"
        }
      }
    }
  }
}
```

การใช้งาน:

```csharp
builder.Services.AddDataAccess(builder.Configuration);
```

### `AppDataExtensions.CallProcedureAsync(...)`

ใช้เรียก stored procedure ผ่าน `DataAccessConfiguration`

พฤติกรรมสำคัญ:

- ถ้า `dataAccessConfig` เป็น `null` จะโยน `ArgumentNullException` และถูก wrap เป็น `AppDataException("operation_error", ex)`
- ตัด parameter ที่ชื่อ `app_data_procedure` และ `app_data_source` ออก
- รองรับ key ที่ส่งมาเป็น `snake_lower_case` หรือ `pi_snake_lower_case`
- ก่อนส่งเข้า AtlasX จะ
  - แปลง key เป็นตัวพิมพ์เล็ก
  - ถ้า key เริ่มด้วย `pi_` จะตัด prefix นี้ออก
  - แปลงเป็นตัวพิมพ์ใหญ่ก่อนส่งเข้า stored procedure
- procedure name จะถูกแปลงเป็นตัวพิมพ์ใหญ่
- ปิด connector ใน `finally` เสมอ

ตัวอย่าง:

```csharp
Dictionary<string, object> parameters = new()
{
    ["app_data_procedure"] = "GET_USER",
    ["pi_user_id"] = 123,
    ["session_id"] = "abc"
};

var result = await dataAccessConfig.CallProcedureAsync(
    "Main",
    "get_user",
    parameters);
```

### `AppDataExtensions.QuerySqlStatementAsync(...)`

ใช้รัน SQL statement แบบคืนค่าเป็นรายการแถว

พฤติกรรมเหมือน `CallProcedureAsync` ในส่วนของการ normalize parameter และการ wrap exception
แต่ผลลัพธ์จะถูกแปลงเป็น `List<Dictionary<string, object>>`

ข้อควรทราบ

- helper ภายใน `ToSnakeLowerCase()` แปลง key ไปเป็น snake_case
- มี logic เฉพาะกับ `LV1`, `LV2`, `LV3`
- key บางกลุ่ม เช่น `status_msg_text`, `msg_detail`, `error_detail` ถูกตัดออกจากผลลัพธ์
- helper นี้เป็น internal detail ของ module จึงควรใช้ผ่าน `QuerySqlStatementAsync()` มากกว่าการเรียกตรง

### `ToParameter(...)`

มี 2 overload:

- `ToParameter(this QueryParameter queryParameter)`
- `ToParameter(this Dictionary<string, object>? queryParameter)`

หน้าที่คือ

- lower-case ทุก key
- ตัด `app_data_procedure` ออก
- ถ้า input เป็น `null` จะคืน dictionary ว่าง

ตัวอย่าง:

```csharp
var request = new QueryParameter(Request);
var parameters = request.ToParameter();
```

### `ToResponse(...)`

แปลง `QueryResult` เป็น dictionary สำหรับส่งกลับ controller

key ที่ได้เป็นมาตรฐาน:

- `success`
- `total`
- `message`
- `data`

และจะคง output parameters ที่มาจาก AtlasX ไว้ตามชื่อเดิม

ถ้า output parameter เป็น `DataTable` จะถูกแปลงเป็นรายการ dictionary ก่อน

ตัวอย่าง:

```csharp
var response = queryResult.ToResponse();
return Ok(response);
```

### `AppDataException`

exception wrapper ของ module นี้

- ใช้ห่อ error ที่เกิดจาก data access layer
- เปิดทางให้ middleware หรือ controller แยก `operation_error` ออกจาก error ต้นทาง

## ตัวอย่างใช้งานใน Playground

`AgriMap.Platform.Playground\Src\Presentation\Controllers\AppDataController.cs`
เป็นตัวอย่างการใช้ module นี้แบบครบ flow

1. อ่าน request ด้วย `QueryParameter`
2. ดึงชื่อ procedure จาก `Database.ProcedureParameter`
3. เรียก `_dataAccessConfig.CallProcedureAsync(...)`
4. แปลงผลลัพธ์ด้วย `ToResponse()`
5. ส่งกลับ `Ok(...)`

## Test case ที่ควรมี

ชุดทดสอบที่เหมาะกับ module นี้คือ

- `AddDataAccess` registers service และ map provider/connection string ถูกต้อง
- `ToParameter(QueryParameter)` และ `ToParameter(Dictionary<,>)` lower-case key และตัด `app_data_procedure`
- `ToResponse(QueryResult)` คืนโครงสร้างมาตรฐานและแปลง output `DataTable`
- `CallProcedureAsync` เมื่อ `DataAccessConfiguration` เป็น `null` ต้อง throw `AppDataException`

## ข้อควรระวัง

- เมธอด public ของ module นี้ทำงานกับ AtlasX โดยตรง ดังนั้น shape ของ configuration ต้องตรงกับ model ที่ binder คาดไว้
- `ToSnakeLowerCase()` เป็น helper ภายในที่มีการ mutate dictionary ต้นทางระหว่างแปลงผลลัพธ์ จึงไม่ควรนำไปใช้กับ dictionary ที่ต้อง reuse ต่อ
- หาก datasource ไม่รองรับ provider ที่กำหนด `AddDataAccess(...)` จะ throw `NotSupportedException`
