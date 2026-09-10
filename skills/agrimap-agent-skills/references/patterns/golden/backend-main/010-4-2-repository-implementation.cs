namespace AgriMap.Web.Service.Infrastructure.Persistence.Repositories;

public class UserRepository : IUserRepository
{
    private readonly IDbDataAccessService _dbDataAccessService;
    private readonly DataAccessConfiguration _dataAccessConfiguration;
    private readonly IAuthService _authService;
    private readonly IAesService _aesService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<UserRepository> _logger;

    public UserRepository(
        IDbDataAccessService dbDataAccessService,
        DataAccessConfiguration dataAccessConfiguration,
        IAuthService authService,
        IAesService aesService,
        IConfiguration configuration,
        ILogger<UserRepository> logger)
    {
        _dbDataAccessService = dbDataAccessService
            ?? throw new ArgumentNullException(nameof(dbDataAccessService));

        _dataAccessConfiguration = dataAccessConfiguration
            ?? throw new ArgumentNullException(nameof(dataAccessConfiguration));

        _authService = authService
            ?? throw new ArgumentNullException(nameof(authService));

        _aesService = aesService
            ?? throw new ArgumentNullException(nameof(aesService));

        _configuration = configuration
            ?? throw new ArgumentNullException(nameof(configuration));

        _logger = logger
            ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<(
        List<UserSearchResponseDto> Items,
        PaginationMetaModel? Meta)> SearchUserAsync(
            UserSearchRequestDto request)
    {
        var parameters = new Dictionary<string, object>
        {
            { "keyword", request.Keyword! },
            { "status", request.Status! },
            { "rows", request.Rows },
            { "page", request.Page },
            { "field_name", request.FieldName! },
            { "sorting", request.Sorting! }
        };

        _logger.LogProcedureCall(
            nameof(SearchUserAsync),
            "um_user_search_q",
            parameters);

        var result = await _dataAccessConfiguration.CallProcedureAsync(
            _dbDataAccessService.DatabaseConfigure.DefaultDataSource,
            "um_user_search_q",
            parameters);

        if (!result.Success)
        {
            throw result.Message.ToProcedureException(
                result.GetOutputParameter<string>("error_detail"));
        }

        var items = result.DataTable
            .ToList<UserSearchResponseDto>();

        PaginationMetaModel? meta = null;

        if (items.Count > 0)
        {
            var metaList = result
                .GetOutputParameter<DataTable>("data2")!
                .ToList<PaginationMetaModel>();

            meta = metaList.FirstOrDefault();
        }

        return (items, meta);
    }

    public async Task<List<UserSearchTransformDataBusiness>>
        SearchAllUsersAsync()
    {
        var parameters = new Dictionary<string, object>();

        _logger.LogProcedureCall(
            nameof(SearchAllUsersAsync),
            "um_user_search_all_q",
            parameters);

        var result = await _dataAccessConfiguration.CallProcedureAsync(
            _dbDataAccessService.DatabaseConfigure.DefaultDataSource,
            "um_user_search_all_q",
            parameters);

        if (!result.Success)
        {
            throw result.Message.ToProcedureException(
                result.GetOutputParameter<string>("error_detail"));
        }

        var data = result.DataTable
            .ToList<UserSearchTransformDataBusiness>();

        return data;
    }

    public async Task<List<UserOrganizationResponseDto>>
        GetUserOrganizationAsync(
            UserOrganizationRequestDto request)
    {
        var parameters = new Dictionary<string, object>
        {
            { "user_id", request.UserId }
        };

        _logger.LogProcedureCall(
            nameof(GetUserOrganizationAsync),
            "um_user_organization_q",
            parameters);

        var result = await _dataAccessConfiguration.CallProcedureAsync(
            _dbDataAccessService.DatabaseConfigure.DefaultDataSource,
            "um_user_organization_q",
            parameters);

        if (!result.Success)
        {
            throw result.Message.ToProcedureException(
                result.GetOutputParameter<string>("error_detail"));
        }

        var data = result.DataTable
            .ToList<UserOrganizationResponseDto>();

        return data;
    }

    public async Task<UserDetailResponseDto?> GetUserByIdAsync(
        int userId)
    {
        var parameters = new Dictionary<string, object>
        {
            { "user_id", userId }
        };

        _logger.LogProcedureCall(
            nameof(GetUserByIdAsync),
            "um_user_q",
            parameters);

        var result = await _dataAccessConfiguration.CallProcedureAsync(
            _dbDataAccessService.DatabaseConfigure.DefaultDataSource,
            "um_user_q",
            parameters);

        if (!result.Success)
        {
            throw result.Message.ToProcedureException(
                result.GetOutputParameter<string>("error_detail"));
        }

        var data = result.DataTable
            .ToList<UserDetailResponseDto>();

        return data.FirstOrDefault();
    }

    public async Task InsertUserAsync(
        UserCreateRequestDto request)
    {
        var parameters = new Dictionary<string, object>
        {
            { "username", request.Username },
            {
                "password",
                _aesService.Encrypt(
                    request.Password,
                    _configuration["AES_KEY"]!)
            },
            { "title", request.Title! },
            { "name", request.Name },
            { "surname", request.Surname },
            { "dept", request.Dept! },
            { "position", request.Position! },
            { "address", request.Address! },
            { "tel", request.Tel! },
            { "email", request.Email },
            { "id_card", request.IdCard! },
            { "status", request.Status! },
            { "image", request.Image! },
            { "source", request.Source! },
            { "role_list", request.RoleList! },
            {
                "permission_function_list",
                request.PermissionFunctionList!
            },
            { "session_user_id", _authService.UserId()! }
        };

        _logger.LogProcedureCall(
            nameof(InsertUserAsync),
            "um_user_i",
            parameters);

        var result = await _dataAccessConfiguration.CallProcedureAsync(
            _dbDataAccessService.DatabaseConfigure.DefaultDataSource,
            "um_user_i",
            parameters);

        if (!result.Success)
        {
            throw result.Message.ToProcedureException(
                result.GetOutputParameter<string>("error_detail"));
        }
    }

    public async Task UpdateUserAsync(
        UserUpdateRequestDto request)
    {
        var parameters = new Dictionary<string, object>
        {
            { "user_id", request.UserId },
            { "title", request.Title! },
            { "name", request.Name! },
            { "surname", request.Surname! },
            { "dept", request.Dept! },
            { "position", request.Position! },
            { "address", request.Address! },
            { "tel", request.Tel! },
            { "email", request.Email! },
            { "id_card", request.IdCard! },
            { "status", request.Status! },
            { "image", request.Image! },
            { "source", request.Source! },
            { "role_list", request.RoleList! },
            {
                "permission_function_list",
                request.PermissionFunctionList!
            },
            { "session_user_id", _authService.UserId()! }
        };

        _logger.LogProcedureCall(
            nameof(UpdateUserAsync),
            "um_user_u",
            parameters);

        var result = await _dataAccessConfiguration.CallProcedureAsync(
            _dbDataAccessService.DatabaseConfigure.DefaultDataSource,
            "um_user_u",
            parameters);

        if (!result.Success)
        {
            throw result.Message.ToProcedureException(
                result.GetOutputParameter<string>("error_detail"));
        }
    }

    public async Task DeleteUserAsync(int userId)
    {
        var parameters = new Dictionary<string, object>
        {
            { "user_id", userId },
            { "session_user_id", _authService.UserId()! }
        };

        _logger.LogProcedureCall(
            nameof(DeleteUserAsync),
            "um_user_d",
            parameters);

        var result = await _dataAccessConfiguration.CallProcedureAsync(
            _dbDataAccessService.DatabaseConfigure.DefaultDataSource,
            "um_user_d",
            parameters);

        if (!result.Success)
        {
            throw result.Message.ToProcedureException(
                result.GetOutputParameter<string>("error_detail"));
        }
    }
}