namespace AgriMap.Web.Service.Presentation.Controllers;

[Authorize]
[ApiController]
[Route("api/{feature}")] // "api/{feature}" -> fixed and does not change by action or resource
public class {Feature}Controller : ControllerBase
{
    private readonly I{Feature}UseCase _{feature}UseCase;

    public {Feature}Controller(I{Feature}UseCase {feature}UseCase)
    {
        _{feature}UseCase = {feature}UseCase ?? throw new ArgumentNullException(nameof({feature}UseCase));
    }

    // Paginated
    [ActionLogging]
    [HttpGet("{resource}/{action}")] // "{resource}/{action}" -> resource is a group of related endpoints and action is the explicit operation
    public async Task<PaginatedResultResponseDto<YourResponseDto>> YourActionAsync([FromQuery] YourRequestDto request)
    {
        return await _{feature}UseCase.YourAction(request);
    }

    // Other
    [ActionLogging]
    [HttpGet("{resource}/{action}")]
    public async Task<DataMessageResponseDto<YourResponseDto>> YourActionAsync([FromQuery] YourRequestDto request)
    {
        return await _{feature}UseCase.YourAction(request);
    }
}
