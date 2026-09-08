namespace AgriMap.Web.Service.Presentation.Controllers;

[Authorize]
[ApiController]
[Route("api/user-manage")] // "api/{feature}" -> fixed and does not change by action or resource
public class UserManageController : ControllerBase
{
    private readonly IUserUseCase _userUseCase;

    public UserManageController(IUserUseCase userUseCase)
    {
        _userUseCase = userUseCase ?? throw new ArgumentNullException(nameof(userUseCase));
    }

    [ActionLogging]
    [HttpGet("users/search")] // "users/search" -> "{resource}/{action}" -> resource is a group of related endpoints, while action is the explicit operation
    [ProducesResponseType(typeof(PaginatedResultResponseDto<UserResponseDto>), StatusCodes.Status200OK)]
    public async Task<PaginatedResultResponseDto<UserResponseDto>> SearchUserAsync(
        [FromQuery] UserSearchRequestDto request)
    {
        return await _userUseCase.SearchUser(request);
    }

    [ActionLogging]
    [HttpPost("users")]
    [ProducesResponseType(typeof(DataMessageResponseDto<object>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status404NotFound)]
    public async Task<DataMessageResponseDto<object>> InsertUser([FromBody] UserCreateRequestDto request)
    {
        return await _userUseCase.InsertUser(request);
    }

    [ActionLogging]
    [HttpPut("users/{id:int}")]
    [ProducesResponseType(typeof(DataMessageResponseDto<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status404NotFound)]
    public async Task<DataMessageResponseDto<object>> UpdateUser(int id, [FromBody] UserUpdateRequestDto request)
    {
        if (request.UserId == 0)
        {
            request.UserId = id;
        }

        return await _userUseCase.UpdateUser(request);
    }

    [ActionLogging]
    [HttpDelete("users/{id:int}")]
    [ProducesResponseType(typeof(DataMessageResponseDto<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ErrorResponseDto), StatusCodes.Status404NotFound)]
    public async Task<DataMessageResponseDto<object>> DeleteUser(int id)
    {
        return await _userUseCase.DeleteUser(id);
    }
}
