namespace AgriMap.Web.Service.Application.Interfaces;

public interface IUserUseCase
{
    Task<PaginatedResultResponseDto<UserResponseDto>> SearchUser(UserSearchRequestDto request);
    Task<DataMessageResponseDto<List<UserSearchAllResponseDto>>> SearchAllUsers();
    Task<DataMessageResponseDto<List<UserOrganizationResponseDto>>> GetUserOrganization(UserOrganizationRequestDto request);
    Task<DataMessageResponseDto<UserDetailResponseDto>> GetUserById(int id);
    Task<DataMessageResponseDto<object>> InsertUser(UserCreateRequestDto request);
    Task<DataMessageResponseDto<object>> UpdateUser(UserUpdateRequestDto request);
    Task<DataMessageResponseDto<object>> DeleteUser(int id);
    Task<DataMessageResponseDto<UserDashboardResponseDto>> QueryUserDashboardAsync();
}
