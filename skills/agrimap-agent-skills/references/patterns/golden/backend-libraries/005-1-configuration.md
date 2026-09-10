# Configuration

`AgriMap.Platform.Configuration` is the configuration composition layer for the platform.
It loads values from the existing application configuration first, then augments them with values from the database.

## What this module provides

- `AddSystemConfigurationService(...)` registers the database-backed configuration pipeline.
- `SystemConfigurationRepository` reads active rows from the environment-specific `SYSTEM_CONFIG*` table.
- `AppMessageRepository` reads message rows from `LUT_APP_MESSAGES`.
- `SystemConfigurationProvider` exposes database rows as `system_config:{config_key}`.
- `AppMessageProvider` exposes database rows as `lut_app_message:{id}`.

## How it works

1. `Program.cs` builds the base `IConfiguration` from `appsettings.json`, environment-specific JSON, environment variables, and optionally user secrets.
2. `AddSystemConfigurationService(configuration)` is called after the base configuration is ready.
3. The service registers the repositories and replaces the resolved `IConfiguration` with a composite configuration.
4. The composite configuration keeps the original values and adds database-backed keys on top.

## Key format

- System configuration values are read as `system_config:{config_key}`.
- App messages are read as `lut_app_message:{id}`.

Example:

```csharp
var apiKey = configuration["system_config:test"];
var swaggerEnabled = configuration.GetValue<string>("system_config:enable_swagger");
var sqlErrorMessage = configuration["lut_app_message:sql_error"];
```

## Environment-specific system config table

`SystemConfigurationRepository` switches the source table by `ASPNETCORE_ENVIRONMENT`:

- `K8s.dev` -> `SYSTEM_CONFIG_K8S`
- `Staging` -> `SYSTEM_CONFIG_STAGING`
- `Production` -> `SYSTEM_CONFIG_PRODUCTION`
- any other value -> `SYSTEM_CONFIG`

All rows are filtered with `IS_ACTIVE = 1`.

## Demo endpoint

`AgriMap.Platform.Playground` exposes a smoke-test endpoint:

`GET /api/configuration/check-db-configuration`

It demonstrates three things at once:

- reading a database-backed system config value
- reading a database-backed app message
- querying the current system config table directly through the database access layer

The response shape is:

- `key`
- `db_name`
- `app_message`
- `total_records`

## Usage

Register the module after the base configuration has been built:

```csharp
builder.Services.AddSystemConfigurationService(builder.Configuration);
```

Then read values from `IConfiguration` the same way you would read any other configuration source.

## Notes

- The module is composition-only. It does not create the database connection or schema.
- The repositories execute synchronously from the consumer point of view, so the application will fail fast if the backing database is unavailable.
- `AddSystemConfigurationService(...)` replaces the resolved `IConfiguration`, so call it once the base configuration is complete.
- The Playground controller is a demo endpoint, not a full CRUD surface.