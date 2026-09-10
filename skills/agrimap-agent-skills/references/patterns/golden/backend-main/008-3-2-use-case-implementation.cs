namespace AgriMap.Web.Service.Application.UseCases;

public class UserUseCase : IUserUseCase
{
    private readonly IUserRepository _userRepository;
    public UserUseCase(IUserRepository userRepository)
    {
        _userRepository = userRepository ?? throw new ArgumentNullException(nameof(userRepository));
    }

    public async Task<PaginatedResultResponseDto<UserResponseDto>> SearchUser(UserSearchRequestDto request)
    {
        var (data, meta) = await _userRepository.SearchUserAsync(request);

        var rows = request.Rows <= 0 ? 10 : request.Rows;
        var page = request.Page <= 0 ? 1 : request.Page;

        return new PaginatedResultResponseDto<UserResponseDto>
        {
            Meta = new PaginationMetaResponseDto
            {
                Rows = meta?.Rows ?? rows,
                Page = meta?.Page ?? page,
                TotalRecords = meta?.TotalRecords ?? data.Count,
                TotalPages = meta?.TotalPages ?? (int)Math.Ceiling(data.Count / (double)rows)
            },
            Data = data.Select(u => new UserResponseDto
            {
                UserId = u.UserId,
                TitleId = u.TitleId,
                Name = u.Name,
                Surname = u.Surname,
                OrgId = u.OrgId,
                PositionId = u.PositionId,
                OrgName = u.OrgName,
                PositionName = u.PositionName,
                TelOrg = u.TelOrg,
                TelPersonal = u.TelPersonal,
                EmailOrg = u.EmailOrg,
                EmailPersonal = u.EmailPersonal,
                IdCard = u.IdCard,
                Status = u.Status,
                StatusName = u.StatusName,
                ImageProfile = u.ImageProfile,
                DateCreated = u.DateCreated,
                UserCreated = u.UserCreated,
                RoleList = u.RoleList
            }).ToList()
        };
    }

    public async Task<DataMessageResponseDto<List<UserSearchAllResponseDto>>> SearchAllUsers()
    {
        var data = await _userRepository.SearchAllUsersAsync();

        return new DataMessageResponseDto<List<UserSearchAllResponseDto>>
        {
            Data = data.Select(u => new UserSearchAllResponseDto
            {
                UserId = u.UserId,
                TitleId = u.TitleId,
                Name = u.Name,
                Surname = u.Surname,
                OrgId = u.OrgId,
                PositionId = u.PositionId,
                OrgName = u.OrgName,
                PositionName = u.PositionName,
                TelOrg = u.TelOrg,
                TelPersonal = u.TelPersonal,
                EmailOrg = u.EmailOrg,
                EmailPersonal = u.EmailPersonal,
                IdCard = u.IdCard,
                Status = u.Status,
                StatusName = u.StatusName,
                ImageProfile = u.ImageProfile,
                DateCreated = u.DateCreated,
                UserCreated = u.UserCreated,
                RoleList = u.RoleList
            }).ToList()
        };
    }

    public async Task<DataMessageResponseDto<List<UserOrganizationResponseDto>>> GetUserOrganization(UserOrganizationRequestDto request)
    {
        var data = await _userRepository.GetUserOrganizationAsync(request);

        return new DataMessageResponseDto<List<UserOrganizationResponseDto>>
        {
            Data = data.Select(u => new UserOrganizationResponseDto
            {
                Id = u.Id,
                IdCard = u.IdCard,
                FirstName = u.FirstName,
                LastName = u.LastName,
                PhoneNumber = u.PhoneNumber,
                Email = u.Email,
                Position = u.Position,
                OrgCode = u.OrgCode
            }).ToList(),
            Message = string.Empty
        };
    }

    public async Task<DataMessageResponseDto<UserDetailResponseDto>> GetUserById(int userId)
    {
        var user = await _userRepository.GetUserByIdAsync(userId);

        if (user is null)
        {
            throw new AppException(404, "user_not_found", $"User with ID {userId} not found.");
        }

        return new DataMessageResponseDto<UserDetailResponseDto>
        {
            Data = new UserDetailResponseDto
            {
                UserId = user.UserId,
                UsernameMain = user.UsernameMain,
                TitleId = user.TitleId,
                Name = user.Name,
                Surname = user.Surname,
                OrgId = user.OrgId,
                Position = user.Position,
                Address = user.Address,
                TelOrg = user.TelOrg,
                TelPersonal = user.TelPersonal,
                EmailOrg = user.EmailOrg,
                EmailPersonal = user.EmailPersonal,
                IdCard = user.IdCard,
                Status = user.Status,
                ImageProfile = user.ImageProfile,
                ForceChangePassword = user.ForceChangePassword,
                UserSource = user.UserSource,
                UserTypeId = user.UserTypeId,
                IsRegister = user.IsRegister,
                IsThaidVerify = user.IsThaidVerify,
                IsFarmer = user.IsFarmer,
                RoleList = !string.IsNullOrEmpty(user.RoleList)
                            ? JsonSerializer.Deserialize<List<UserRoleItemResponseDto>>(user.RoleList) ?? new()
                            : new(),
                ProvinceList = !string.IsNullOrEmpty(user.ProvinceList)
                            ? JsonSerializer.Deserialize<List<UserZoneProvinceItemResponseDto>>(user.ProvinceList) ?? new()
                            : new(),
                DateCreated = user.DateCreated,
                UserCreated = user.UserCreated,
                DateModified = user.DateModified,
                UserModified = user.UserModified,
                RoleId = user.RoleId
            },
            Message = string.Empty
        };
    }

    public async Task<DataMessageResponseDto<object>> InsertUser(UserCreateRequestDto request)
    {
        await _userRepository.InsertUserAsync(request);
        return new DataMessageResponseDto<object>
        {
            Data = new
            {
                Success = true
            },
            Message = string.Empty
        };
    }

    public async Task<DataMessageResponseDto<object>> UpdateUser(UserUpdateRequestDto request)
    {
        await _userRepository.UpdateUserAsync(request);
        return new DataMessageResponseDto<object>
        {
            Data = new
            {
                UserId = request.UserId,
                Success = true
            },
            Message = string.Empty
        };
    }

    public async Task<DataMessageResponseDto<object>> DeleteUser(int userId)
    {
        await _userRepository.DeleteUserAsync(userId);
        return new DataMessageResponseDto<object>
        {
            Data = new
            {
                UserId = userId,
                Success = true
            },
            Message = string.Empty
        };
    }

    public async Task<DataMessageResponseDto<UserDashboardResponseDto>> QueryUserDashboardAsync()
    {
        var (dashboardSummary, dashboardSummaryUserInRole, dashboardSummaryUserHierarchy) = await _userRepository.GetUserDashboardAsync();


        return new DataMessageResponseDto<UserDashboardResponseDto>
        {
            Data = new UserDashboardResponseDto
            {
                DashboardSummary = new DashboardSummaryResponseDto
                {
                    TotalUsers = dashboardSummary.TotalUsers,
                    ActiveUsers = dashboardSummary.ActiveUsers,
                    InactiveUsers = dashboardSummary.InactiveUsers,
                    TotalOrgs = dashboardSummary.TotalOrgs
                },
                DashboardSummaryUserInRole = dashboardSummaryUserInRole.Select(item => new DashboardSummaryUserInRoleResponseDto
                {
                    RoleLevel = item.RoleLevel,
                    RoleLevelName = item.RoleLevelName,
                    RoleName = item.RoleName,
                    RoleAliasName = item.RoleAliasName,
                    UserCount = item.UserCount
                }).ToList(),
                DashboardSummaryUserHierarchy = dashboardSummaryUserHierarchy.Select(item => new DashboardSummaryUserHierarchyResponseDto
                {
                    GroupLevel = item.GroupLevel,
                    GroupName = item.GroupName,
                    UserCount = item.UserCount
                }).ToList()
            },
            Message = string.Empty
        };
    }
}
