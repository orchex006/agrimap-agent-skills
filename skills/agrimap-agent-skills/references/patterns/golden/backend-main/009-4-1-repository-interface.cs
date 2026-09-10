namespace AgriMap.Web.Service.Infrastructure.Persistence.Interfaces;

public interface IUserRepository
{
    Task<(List<UserSearchResponseDto> Items, PaginationMetaModel? Meta)> SearchUserAsync(UserSearchRequestDto request);
    // กรณีต้องมี Business Model ต้องประมวลผลบางอย่าง Model จะอยู่ที่ AgriMap.Web.Service.Domain.Entities
    Task<List<UserSearchTransformDataBusiness>> SearchAllUsersAsync();
    Task<List<UserOrganizationResponseDto>> GetUserOrganizationAsync(UserOrganizationRequestDto request);
    Task<UserDetailResponseDto?> GetUserByIdAsync(int userId);
    Task InsertUserAsync(UserCreateRequestDto request);
    Task UpdateUserAsync(UserUpdateRequestDto request);
    Task DeleteUserAsync(int userId);
}
