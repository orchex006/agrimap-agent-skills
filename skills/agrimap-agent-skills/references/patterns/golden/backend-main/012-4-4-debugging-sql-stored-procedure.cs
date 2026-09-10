// Src/Shared/Extensions/LoggingExtensions.cs --- IGNORE ---
namespace AgriMap.Web.Service.Shared.Extensions;

using System.Text.Encodings.Web;
using System.Text.Json;
using Microsoft.Extensions.Logging;

public static class LoggingExtensions
{
    public static void LogProcedureCall(this ILogger logger, string operationName, string procedureName, object? parameters)
    {
        ArgumentNullException.ThrowIfNull(logger);

        if (!ShouldWriteProcedureLog())
        {
            return;
        }

        var payload = JsonSerializer.Serialize(
            parameters,
            new JsonSerializerOptions
            {
                WriteIndented = true,
                Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
            });

        logger.LogDebug("Exec: {Operation} | SP: {Procedure} | PI: {Parameters}", operationName, procedureName, payload);
        Console.WriteLine($"Exec: {operationName}");
        Console.WriteLine($"SP: {procedureName}");
        Console.WriteLine($"PI: {payload}");
    }

    private static bool ShouldWriteProcedureLog()
    {
        var environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT");

        return string.Equals(environment, "Development", StringComparison.OrdinalIgnoreCase)
            || string.Equals(environment, "Inhouse", StringComparison.OrdinalIgnoreCase);
    }
}
