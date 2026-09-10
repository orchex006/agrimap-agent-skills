namespace AgriMap.Web.Service.Shared.Extensions;

using AgriMap.Platform.Abstractions;

public static class ProcedureExtensions
{
    public static AppException ToProcedureException(this string? errorCode, string? errorDetail)
    {
        return new AppException(
            500,
            string.IsNullOrWhiteSpace(errorCode) ? "database_procedure_failed" : errorCode,
            string.IsNullOrWhiteSpace(errorDetail) ? "Stored procedure execution failed." : errorDetail);
    }
}
