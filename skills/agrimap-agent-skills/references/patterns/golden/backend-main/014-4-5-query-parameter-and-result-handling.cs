// Example define parameters for stored procedure call
var parameters = new Dictionary<string, object>
{
    { "dashboard_content_id", dashboardContentId },
    { "session_user_id", _authService.UserId()! }
};

// Optional parameters, if value is not null or empty then add to parameters, otherwise ignore
if (!string.IsNullOrWhiteSpace(request.DashboardName))
    parameters["name"] = request.DashboardName;

if (!string.IsNullOrWhiteSpace(request.Detail))
    parameters["detail"] = request.Detail;

if (request.TemplateId.HasValue)
    parameters["template_id"] = request.TemplateId.Value;

if (!string.IsNullOrWhiteSpace(request.ConfigPayload))
    parameters["config_payload"] = request.ConfigPayload;
