# AgriMap Platform MessagingQueue

`AgriMap.Platform.MessagingQueue` เป็น abstraction layer สำหรับ Queue และ Pub/Sub บน
RabbitMQ, Redis และ Kafka โดยแยก API ออกเป็น 2 แบบหลัก:

- Queue: publish / consume / manual ack / inspect queue
- Pub/Sub: publish / subscribe / unsubscribe

เอกสารนี้อ้างอิงจาก source code ปัจจุบันในโฟลเดอร์ `src/MessagingQueue` และตัวอย่างใช้งานใน
`AgriMap.Platform.Playground`

## ภาพรวมของโมดูล

| ส่วน | หน้าที่ |
| --- | --- |
| `Abstractions/Queue` | interface ของ queue, publisher, consumer และ manual ack context |
| `Abstractions/PubSub` | interface ของ pub/sub broadcaster, subscriber และ manager |
| `Core` | implementation ของ wrapper / factory / options |
| `Providers/Rabbit` | implementation สำหรับ RabbitMQ |
| `Providers/Redis` | implementation สำหรับ Redis |
| `Providers/Kafka` | implementation สำหรับ Kafka |
| `Extensions/ServiceCollectionExtensions.cs` | entry point สำหรับลงทะเบียน DI |

## Namespace ที่ใช้บ่อย

```csharp
using AgriMap.Platform.MessagingQueue;
using AgriMap.Platform.MessagingQueue.Abstractions;
using AgriMap.Platform.MessagingQueue.Abstractions.Queue;
using AgriMap.Platform.MessagingQueue.Abstractions.PubSub;
using AgriMap.Platform.MessagingQueue.Core;
```

## ชนิดข้อมูลและ interface หลัก

### `MessagingProviderType`

```csharp
public enum MessagingProviderType
{
    Redis,
    RabbitMQ,
    Kafka
}
```

### Queue

```csharp
public interface IMessageProvider
{
    void Connect();
    void Disconnect();

    void Create(string queueName, string message = "");
    void Create(string queueName, byte[] message);
    void Delete(string queueName);
    bool Exists(string queueName);

    string? PeekMessage(string queueName);
    byte[]? PeekMessageAsBytes(string queueName);

    void SendMessage(string queueName, string message);
    void SendMessage(string queueName, byte[] message);

    string? ReceiveMessage(string queueName);
    byte[]? ReceiveMessageAsBytes(string queueName);

    Task ManualAckAsync(string queueName, Func<ManualAckContext, string, Task> ackAction);
    Task ManualAckAsync(string queueName, Func<ManualAckContext, byte[], Task> ackAction);
    Task ManualAckAsync(string queueName, Action<string> ackAction);
    Task ManualAckAsync(string queueName, Func<byte[], Task> ackAction);

    int GetMessageCount(string queueName);
}
```

```csharp
public interface IMessageQueueManager
{
    IMessageProvider GetMessageProvider();
    void CreateQueue(string queueName);
    void DeleteQueue(string queueName);
    bool QueueExists(string queueName);
    void Connect();
    void Disconnect();
    string? PeekFirstMessage(string queueName);
    byte[]? PeekFirstMessageAsBytes(string queueName);
    int GetMessageCount(string queueName);
}
```

```csharp
public interface IMessagePublisher
{
    void SendMessage(string queueName, string message);
    void SendMessage(string queueName, byte[] message);
}
```

```csharp
public interface IMessageConsumer
{
    string? ReceiveMessage(string queueName);
    byte[]? ReceiveMessageAsBytes(string queueName);
    Task ManualAckAsync(string queueName, Func<ManualAckContext, string, Task> ackAction);
    Task ManualAckAsync(string queueName, Func<ManualAckContext, byte[], Task> ackAction);
    Task ManualAckAsync(string queueName, Action<string> ackAction);
    Task ManualAckAsync(string queueName, Func<byte[], Task> ackAction);
}
```

### Pub/Sub

```csharp
public interface IPubSubProvider
{
    Task PublishAsync(string topic, string message);
    Task PublishAsync(string topic, byte[] message);
    Task SubscribeAsync(string topic, Action<string> handler);
    Task SubscribeAsync(string topic, Action<byte[]> handler);
    Task UnsubscribeAsync(string topic);
}
```

```csharp
public interface IPubSubManager
{
    IPubSubProvider GetPubSubProvider();
    Task PublishAsync(string topic, string message);
    Task PublishAsync(string topic, byte[] message);
    Task SubscribeAsync(string topic, Action<string> handler);
    Task SubscribeAsync(string topic, Action<byte[]> handler);
    Task UnsubscribeAsync(string topic);
}
```

```csharp
public interface IMessageBroadcaster
{
    Task PublishAsync(string topic, string message);
    Task PublishAsync(string topic, byte[] message);
}
```

```csharp
public interface IMessageSubscriber
{
    Task SubscribeAsync(string topic, Action<string> handler);
    Task SubscribeAsync(string topic, Action<byte[]> handler);
    Task UnsubscribeAsync(string topic);
}
```

### `ManualAckContext`

```csharp
public enum ManualAckDecision
{
    Retry = 0,
    Commit = 1,
    Fail = 2
}

public sealed class ManualAckContext
{
    public ManualAckDecision Decision { get; private set; } = ManualAckDecision.Retry;
    public void Commit() => Decision = ManualAckDecision.Commit;
    public void Retry() => Decision = ManualAckDecision.Retry;
    public void Fail() => Decision = ManualAckDecision.Fail;
}
```

ค่าเริ่มต้นของ manual ack คือ `Retry`

## การลงทะเบียน DI

### 1) Multi-channel แบบ fluent

รูปแบบนี้เป็นตัวที่ README เดิมอ้างถึง แต่ source ปัจจุบันรองรับผ่าน `AddMessaging(Action<MessagingOptions>)`

```csharp
builder.Services.AddMessaging(opts =>
{
    opts.AddQueue("orders", MessagingProviderType.RabbitMQ, "amqp://user:pass@localhost/");
    opts.AddQueue("notify", MessagingProviderType.Redis, "localhost:6379");
    opts.AddQueue("analytics", MessagingProviderType.Kafka, "localhost:9092", groupId: "analytics-group");

    opts.AddPubSub("events", MessagingProviderType.Kafka, "localhost:9092");
    opts.AddPubSub("alerts", MessagingProviderType.Redis, "localhost:6379");
});
```

`AddQueue` และ `AddPubSub` เป็น fluent API และคืน `MessagingOptions` เดิมเพื่อ chain ต่อได้

### 2) Single-channel แบบ backward compatible

```json
{
  "MessagingQueue": {
    "Provider": "RabbitMQ",
    "Connection": "amqp://user:pass@localhost/",
    "GroupId": "my-group"
  },
  "MessagingPubSub": {
    "Provider": "Redis",
    "Connection": "localhost:6379"
  }
}
```

```csharp
builder.Services.AddMessagingQueue(builder.Configuration);
builder.Services.AddMessagingPubSub(builder.Configuration);
// หรือ
builder.Services.AddMessaging(builder.Configuration);
```

### 3) Config-driven multi-channel

```json
{
  "Messaging": {
    "Queue": {
      "orders": {
        "Provider": "RabbitMQ",
        "Connection": "amqp://user:pass@localhost/"
      },
      "analytics": {
        "Provider": "Kafka",
        "Connection": "localhost:9092",
        "GroupId": "analytics-group"
      }
    },
    "PubSub": {
      "events": {
        "Provider": "Kafka",
        "Connection": "localhost:9092"
      }
    }
  }
}
```

```csharp
builder.Services.AddMessaging(builder.Configuration, "Messaging");
```

## การ resolve channel

เมื่อใช้ multi-channel factory:

```csharp
IMessagingFactory factory = app.Services.GetRequiredService<IMessagingFactory>();

IMessagePublisher publisher = factory.GetPublisher("orders");
IMessageConsumer consumer = factory.GetConsumer("orders");
IMessageQueueManager queueManager = factory.GetQueueManager("orders");

IMessageBroadcaster broadcaster = factory.GetBroadcaster("events");
IMessageSubscriber subscriber = factory.GetSubscriber("events");
```

`channelName` ค่าเริ่มต้นคือ `"default"` แต่จะใช้งานได้ก็ต่อเมื่อมี channel ชื่อนี้ถูกลงทะเบียนไว้จริง

ถ้า channel ไม่มีอยู่จริง `MessagingFactory` จะ throw `KeyNotFoundException` พร้อมรายชื่อ channel ที่ลงทะเบียนไว้

## Queue API

### `MessagePublisher`

`MessagePublisher` จะ validate `queueName` ก่อนส่ง และจะ auto-create queue ถ้ายังไม่มี

```csharp
publisher.SendMessage("orders-queue", "hello");
publisher.SendMessage("orders-queue", Encoding.UTF8.GetBytes("hello"));
```

### `MessageConsumer`

`MessageConsumer` จะเช็กว่า queue มีอยู่ก่อนอ่าน ถ้าไม่มีจะ throw `InvalidOperationException`

```csharp
string? message = consumer.ReceiveMessage("orders-queue");
byte[]? body = consumer.ReceiveMessageAsBytes("orders-queue");
```

### Manual ack

```csharp
await consumer.ManualAckAsync("orders-queue", (ack, msg) =>
{
    try
    {
        await ProcessAsync(msg);
        ack.Commit();
    }
    catch
    {
        ack.Retry();
    }
});
```

Overload แบบ `Action<string>` และ `Func<byte[], Task>` จะ commit ให้อัตโนมัติถ้า callback ไม่ throw

## Pub/Sub API

```csharp
await broadcaster.PublishAsync("order-events", "created");

await subscriber.SubscribeAsync("order-events", msg =>
{
    Console.WriteLine(msg);
});

await subscriber.UnsubscribeAsync("order-events");
```

## พฤติกรรมของ provider แต่ละตัว

### RabbitMQ Queue

- ใช้ durable queue
- message เป็น persistent
- `PeekMessage()` ใช้ `BasicGet` แล้ว `Nack(requeue: true)` เพื่อคืน message กลับ queue
- `ManualAckAsync(..., ack => ack.Fail())` จะ `BasicNack(requeue: false)` เพื่อส่งต่อ flow ของ dead-letter ใน broker
- รองรับ auto recovery และ topology recovery

### Redis Queue

- ใช้ Redis List เป็น FIFO queue
- `SendMessage()` จะสร้าง list key ให้อัตโนมัติถ้ายังไม่มี
- `PeekMessage()` ใช้ pop แล้ว push กลับ
- `ManualAckAsync(..., ack => ack.Fail())` จะ push ไปที่ `queueName:dlq`
- ถ้า key เดิมไม่ใช่ list จะลบ key เดิมแล้วสร้างใหม่

### Kafka Queue

- ใช้ consumer group semantics
- `ReceiveMessage()` จะ commit offset เมื่ออ่านสำเร็จ
- `ManualAckAsync(..., ack => ack.Commit())` commit offset
- `ManualAckAsync(..., ack => ack.Fail())` จะ produce ไปที่ `topic.dlq` แล้ว commit offset ถ้าส่ง DLQ สำเร็จ
- `Exists()` คืนค่า `true` สำหรับชื่อ queue ที่ไม่ว่างเท่านั้น
- `Delete()` เป็น no-op และ log warning
- `GetMessageCount()` คืน `-1`

### RabbitMQ Pub/Sub

- ใช้ fanout exchange
- subscriber แต่ละตัวได้ queue แบบ exclusive / auto-delete
- ทุก subscriber ที่ active จะได้รับ message ทุกตัว

### Redis Pub/Sub

- ใช้ native `PUBLISH` / `SUBSCRIBE`
- message ไม่ถูกเก็บถ้าไม่มี subscriber
- handler ที่ throw จะถูก log แล้วระบบไปต่อ

### Kafka Pub/Sub

- subscriber แต่ละตัวใช้ consumer group ID แยกกัน เพื่อให้ได้ broadcast semantics
- `AutoOffsetReset = Latest` ทำให้ subscriber เห็นเฉพาะ message หลังจาก subscribe แล้ว
- `UnsubscribeAsync()` จะ cancel loop ของ subscription นั้น

## ตัวอย่างการใช้งานใน Playground

ตัวอย่างอยู่ใน:

- `AgriMap.Platform.Playground\Src\Presentation\Controllers\RabbitMQQueueController.cs`
- `AgriMap.Platform.Playground\Src\Presentation\Controllers\RedisQueueController.cs`
- `AgriMap.Platform.Playground\Src\Presentation\Controllers\KafkaQueueController.cs`
- `AgriMap.Platform.Playground\Src\Presentation\Controllers\RabbitMQPubSubController.cs`
- `AgriMap.Platform.Playground\Src\Presentation\Controllers\RedisPubSubController.cs`

ตัวอย่าง API ที่เปิดไว้ใน Playground:

- `POST /api/queue/rabbitmq-queue/send`
- `POST /api/queue/redis-queue/send`
- `POST /api/queue/kafka-queue/produce`
- `POST /api/queue/*/receive-ack-decision`
- `POST /api/pubsub/*/publish`
- `POST /api/pubsub/*/subscribe-demo`

ไม่มีตัวอย่าง `KafkaPubSubController` ใน Playground ปัจจุบัน แม้ provider ฝั่ง Kafka Pub/Sub จะมีอยู่ใน source

## ข้อควรระวัง

- `MessageConsumer` จะ throw ถ้า queue ไม่มีอยู่
- `MessagePublisher` auto-create queue เฉพาะตอนส่ง ไม่ได้ validate broker availability ล่วงหน้า
- `KafkaQueueProvider.Exists()` ไม่ได้ตรวจ broker จริง
- `KafkaQueueProvider.GetMessageCount()` ไม่ได้ให้ค่าจำนวนจริง
- Pub/Sub เป็น pattern แบบ broadcast ไม่ใช่ durable queue
- `RedisPubSubProvider` และ `RabbitMQPubSubProvider` ควรใช้ใน service ที่ long-lived เช่น `IHostedService`
- `RabbitMQQueueProvider` และ `KafkaQueueProvider` มีงาน network/blocking ภายใน implementation ปัจจุบัน
- `ManualAckAsync` มี overload หลายแบบ แต่ไม่มี `ManualAck(...)` แบบ sync ใน interface ปัจจุบัน

## สรุปสั้น ๆ

ถ้าต้องการ queue-like semantics:

- RabbitMQ: เหมาะกับ queue มาตรฐานและ manual ack แบบ broker-native
- Redis: เหมาะกับ lightweight FIFO queue และงานภายในระบบ
- Kafka: เหมาะกับ stream / event log / consumer group processing

ถ้าต้องการ broadcast:

- RabbitMQ Pub/Sub: fanout exchange
- Redis Pub/Sub: เบาและตรงไปตรงมา แต่ไม่ durable
- Kafka Pub/Sub: เหมาะกับ subscriber หลายตัวที่แยก consumer group
