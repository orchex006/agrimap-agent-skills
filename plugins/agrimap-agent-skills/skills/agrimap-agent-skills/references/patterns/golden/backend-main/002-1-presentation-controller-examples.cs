namespace AgriMap.Web.Service.Presentation.Controllers;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using AgriMap.Web.Service.Application.Interfaces;
using AgriMap.Web.Service.Presentation.DTOs.Responses;
using AgriMap.Web.Service.Presentation.DTOs.Responses;
using AgriMap.Web.Service.Presentation.Filters;

[Authorize]
[ApiController]
[Route("api/dashboards")]
public class DashboardTemplateController : ControllerBase
{
    private readonly IDashboardTemplateUseCase _dashboardTemplateUseCase;

    public DashboardTemplateController(IDashboardTemplateUseCase dashboardTemplateUseCase)
    {
        _dashboardTemplateUseCase = dashboardTemplateUseCase ?? throw new ArgumentNullException(nameof(dashboardTemplateUseCase));
    }

    [ActionLogging]
    [HttpGet("templates")]
    [ProducesResponseType(typeof(DataMessageResponseDto<List<DashboardTemplateResponseDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status500InternalServerError)]
    public async Task<DataMessageResponseDto<List<DashboardTemplateResponseDto>>> GetAll()
    {
        return await _dashboardTemplateUseCase.GetAllTemplatesAsync();
    }

    [ActionLogging]
    [HttpGet("templates/{template_id:int}")]
    [ProducesResponseType(typeof(DataMessageResponseDto<DashboardTemplateResponseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status500InternalServerError)]
    public async Task<DataMessageResponseDto<DashboardTemplateResponseDto>> GetById([FromRoute] int template_id)
    {
        return await _dashboardTemplateUseCase.GetByIdAsync(template_id);
    }
}
