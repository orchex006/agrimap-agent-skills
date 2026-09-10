private readonly IDbDataAccessService _dbDataAccessService;
private readonly DataAccessConfiguration _dataAccessConfig;
private readonly IAuthService _authService;

public DashboardConfigRepository(IDbDataAccessService dbDataAccessService
    , DataAccessConfiguration dataAccessConfig
    , IAuthService authService)
{
    _dbDataAccessService = dbDataAccessService ?? throw new ArgumentNullException(nameof(dbDataAccessService));
    _dataAccessConfig = dataAccessConfig ?? throw new ArgumentNullException(nameof(dataAccessConfig));
    _authService = authService ?? throw new ArgumentNullException(nameof(authService));
}
