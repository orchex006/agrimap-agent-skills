// Example call stored procedure with parameters and handle queryResult
var queryResult = await _dataAccessConfig.CallProcedureAsync(
    _dbDataAccessService.DatabaseConfigure.DefaultDataSource,
    "dd_dashboard_draft_u",
    parameters);

// Check if stored procedure execution is successful, if not throw exception with error detail from output parameter
if (!queryResult.Success)
{
    throw queryResult.Message.ToProcedureException(queryResult.GetOutputParameter<string>("error_detail"));
}
