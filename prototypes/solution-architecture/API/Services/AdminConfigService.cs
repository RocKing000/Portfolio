using System.Data;
using System.Security.Cryptography;
using System.Text;
using Dapper;
using EnterpriseChatbot.API.Data;
using EnterpriseChatbot.API.Models.Configuration;

namespace EnterpriseChatbot.API.Services;

public interface IAdminConfigService
{
    // App Config
    Task<IEnumerable<AppConfigItem>> GetAppConfigsAsync(string? category = null);
    Task<AppConfigItem?> GetAppConfigByKeyAsync(string configKey);
    Task<bool> CreateAppConfigAsync(CreateAppConfigRequest request, string createdBy);
    Task<bool> UpdateAppConfigAsync(UpdateAppConfigRequest request, string updatedBy);
    Task<bool> DeleteAppConfigAsync(int configId, string deletedBy);

    // UI Config
    Task<IEnumerable<UiConfigItem>> GetUiConfigsAsync(string? section = null);
    Task<bool> UpdateUiConfigAsync(int configId, string configValue, string updatedBy);

    // User Management
    Task<IEnumerable<UserListItem>> GetUsersAsync(Guid? tenantId = null);
    Task<IEnumerable<RoleListItem>> GetRolesAsync();
    Task<bool> CreateUserAsync(CreateUserRequest request, string createdBy);
    Task<bool> UpdateUserAsync(UpdateUserRequest request, string updatedBy);
    Task<bool> ResetPasswordAsync(ResetPasswordRequest request, string updatedBy);
    Task<bool> DeleteUserAsync(Guid userId, string deletedBy);

    // Tenant Management
    Task<IEnumerable<TenantListItem>> GetTenantsAsync();
    Task<bool> CreateTenantAsync(CreateTenantRequest request, string createdBy);
    Task<bool> UpdateTenantAsync(Guid tenantId, string tenantName, string? description, string updatedBy);

    // Error Management
    Task<IEnumerable<ErrorListItem>> GetErrorsAsync(string? tenantCode = null);
    Task<bool> CreateErrorAsync(CreateErrorRequest request, string createdBy);
    Task<bool> UpdateErrorAsync(Guid errorId, CreateErrorRequest request, string updatedBy);
    Task<bool> DeleteErrorAsync(Guid errorId, string deletedBy);

    // Audit Log
    Task<IEnumerable<AuditLogEntry>> GetAuditLogsAsync(int pageSize = 100, int pageNumber = 1);
}

public class AdminConfigService : IAdminConfigService
{
    private readonly IDbConnectionFactory _dbFactory;
    private readonly ILogger<AdminConfigService> _logger;

    public AdminConfigService(IDbConnectionFactory dbFactory, ILogger<AdminConfigService> logger)
    {
        _dbFactory = dbFactory;
        _logger = logger;
    }

    #region App Config

    public async Task<IEnumerable<AppConfigItem>> GetAppConfigsAsync(string? category = null)
    {
        using var conn = _dbFactory.CreateConnection();
        return await conn.QueryAsync<AppConfigItem>(@"
            SELECT config_id AS ConfigId, config_key AS ConfigKey, config_value AS ConfigValue,
                   description AS Description, category AS Category, data_type AS DataType,
                   is_encrypted AS IsEncrypted, is_active AS IsActive,
                   created_at AS CreatedAt, updated_at AS UpdatedAt
            FROM infrastructure.app_config
            WHERE (@Category IS NULL OR category = @Category)
            ORDER BY category, config_key",
            new { Category = category });
    }

    public async Task<AppConfigItem?> GetAppConfigByKeyAsync(string configKey)
    {
        using var conn = _dbFactory.CreateConnection();
        return await conn.QueryFirstOrDefaultAsync<AppConfigItem>(@"
            SELECT config_id AS ConfigId, config_key AS ConfigKey, config_value AS ConfigValue,
                   description AS Description, category AS Category, data_type AS DataType,
                   is_encrypted AS IsEncrypted, is_active AS IsActive,
                   created_at AS CreatedAt, updated_at AS UpdatedAt
            FROM infrastructure.app_config
            WHERE config_key = @ConfigKey",
            new { ConfigKey = configKey });
    }

    public async Task<bool> CreateAppConfigAsync(CreateAppConfigRequest request, string createdBy)
    {
        using var conn = _dbFactory.CreateConnection();

        var exists = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM infrastructure.app_config WHERE config_key = @ConfigKey",
            new { request.ConfigKey });

        if (exists > 0)
        {
            _logger.LogWarning("Config key already exists: {ConfigKey}", request.ConfigKey);
            return false;
        }

        var rows = await conn.ExecuteAsync(@"
            INSERT INTO infrastructure.app_config
                (config_key, config_value, description, category, data_type, is_encrypted, is_active, created_at)
            VALUES
                (@ConfigKey, @ConfigValue, @Description, @Category, @DataType, @IsEncrypted, 1, GETUTCDATE())",
            request);

        await LogAuditAsync(conn, "app_config", "CREATE", $"Created config: {request.ConfigKey}", createdBy);
        return rows > 0;
    }

    public async Task<bool> UpdateAppConfigAsync(UpdateAppConfigRequest request, string updatedBy)
    {
        using var conn = _dbFactory.CreateConnection();

        var rows = await conn.ExecuteAsync(@"
            UPDATE infrastructure.app_config
            SET config_value = @ConfigValue, description = @Description,
                is_active = @IsActive, updated_at = GETUTCDATE()
            WHERE config_id = @ConfigId",
            request);

        await LogAuditAsync(conn, "app_config", "UPDATE", $"Updated config ID: {request.ConfigId}", updatedBy);
        return rows > 0;
    }

    public async Task<bool> DeleteAppConfigAsync(int configId, string deletedBy)
    {
        using var conn = _dbFactory.CreateConnection();

        var rows = await conn.ExecuteAsync(
            "DELETE FROM infrastructure.app_config WHERE config_id = @ConfigId",
            new { ConfigId = configId });

        await LogAuditAsync(conn, "app_config", "DELETE", $"Deleted config ID: {configId}", deletedBy);
        return rows > 0;
    }

    #endregion

    #region UI Config

    public async Task<IEnumerable<UiConfigItem>> GetUiConfigsAsync(string? section = null)
    {
        using var conn = _dbFactory.CreateConnection();
        return await conn.QueryAsync<UiConfigItem>(@"
            SELECT config_id AS ConfigId, config_key AS ConfigKey, config_value AS ConfigValue,
                   description AS Description, component_type AS ComponentType,
                   section AS Section, is_active AS IsActive,
                   created_at AS CreatedAt, updated_at AS UpdatedAt
            FROM infrastructure.ui_config
            WHERE (@Section IS NULL OR section = @Section)
            ORDER BY section, config_key",
            new { Section = section });
    }

    public async Task<bool> UpdateUiConfigAsync(int configId, string configValue, string updatedBy)
    {
        using var conn = _dbFactory.CreateConnection();

        var rows = await conn.ExecuteAsync(@"
            UPDATE infrastructure.ui_config
            SET config_value = @ConfigValue, updated_at = GETUTCDATE()
            WHERE config_id = @ConfigId",
            new { ConfigId = configId, ConfigValue = configValue });

        await LogAuditAsync(conn, "ui_config", "UPDATE", $"Updated UI config ID: {configId}", updatedBy);
        return rows > 0;
    }

    #endregion

    #region User Management

    public async Task<IEnumerable<UserListItem>> GetUsersAsync(Guid? tenantId = null)
    {
        using var conn = _dbFactory.CreateConnection();
        return await conn.QueryAsync<UserListItem>(@"
            SELECT u.user_id AS UserId, u.username AS Username,
                   ISNULL(u.first_name, '') AS FirstName, ISNULL(u.last_name, '') AS LastName,
                   u.email AS Email, u.mobile AS Mobile,
                   u.role_id AS RoleId,
                   ISNULL(r.role_name, u.role) AS RoleName,
                   u.tenant_id AS TenantId,
                   t.tenant_name AS TenantName, u.is_active AS IsActive, u.created_at AS CreatedAt
            FROM infrastructure.users u
            LEFT JOIN infrastructure.roles r ON u.role_id = r.role_id
            INNER JOIN infrastructure.tenants t ON u.tenant_id = t.tenant_id
            WHERE (@TenantId IS NULL OR u.tenant_id = @TenantId)
            ORDER BY u.created_at DESC",
            new { TenantId = tenantId });
    }

    public async Task<IEnumerable<RoleListItem>> GetRolesAsync()
    {
        using var conn = _dbFactory.CreateConnection();
        return await conn.QueryAsync<RoleListItem>(@"
            SELECT role_id AS RoleId, role_name AS RoleName
            FROM infrastructure.roles
            WHERE is_active = 1
            ORDER BY role_name");
    }

    public async Task<bool> CreateUserAsync(CreateUserRequest request, string createdBy)
    {
        using var conn = _dbFactory.CreateConnection();

        var exists = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM infrastructure.users WHERE username = @Username",
            new { request.Username });

        if (exists > 0)
        {
            _logger.LogWarning("Username already exists: {Username}", request.Username);
            return false;
        }

        var passwordHash = HashPasswordMD5(request.Username, request.Password);

        var rows = await conn.ExecuteAsync(@"
            INSERT INTO infrastructure.users
                (user_id, username, password_hash, first_name, last_name, email, mobile,
                 role_id, tenant_id, is_active, created_at)
            VALUES
                (NEWID(), @Username, @PasswordHash, @FirstName, @LastName, @Email, @Mobile,
                 @RoleId, @TenantId, 1, GETUTCDATE())",
            new
            {
                request.Username,
                PasswordHash = passwordHash,
                request.FirstName,
                request.LastName,
                request.Email,
                request.Mobile,
                request.RoleId,
                request.TenantId
            });

        await LogAuditAsync(conn, "users", "CREATE", $"Created user: {request.Username}", createdBy);
        return rows > 0;
    }

    public async Task<bool> UpdateUserAsync(UpdateUserRequest request, string updatedBy)
    {
        using var conn = _dbFactory.CreateConnection();

        var rows = await conn.ExecuteAsync(@"
            UPDATE infrastructure.users
            SET first_name = @FirstName, last_name = @LastName,
                email = @Email, mobile = @Mobile,
                role_id = @RoleId, is_active = @IsActive, updated_at = GETUTCDATE()
            WHERE user_id = @UserId",
            request);

        await LogAuditAsync(conn, "users", "UPDATE", $"Updated user: {request.UserId}", updatedBy);
        return rows > 0;
    }

    public async Task<bool> ResetPasswordAsync(ResetPasswordRequest request, string updatedBy)
    {
        using var conn = _dbFactory.CreateConnection();

        var username = await conn.ExecuteScalarAsync<string>(
            "SELECT username FROM infrastructure.users WHERE user_id = @UserId",
            new { request.UserId });

        if (string.IsNullOrEmpty(username)) return false;

        var passwordHash = HashPasswordMD5(username, request.NewPassword);

        var rows = await conn.ExecuteAsync(@"
            UPDATE infrastructure.users
            SET password_hash = @PasswordHash, updated_at = GETUTCDATE()
            WHERE user_id = @UserId",
            new { request.UserId, PasswordHash = passwordHash });

        await LogAuditAsync(conn, "users", "PASSWORD_RESET", $"Reset password for user: {request.UserId}", updatedBy);
        return rows > 0;
    }

    public async Task<bool> DeleteUserAsync(Guid userId, string deletedBy)
    {
        using var conn = _dbFactory.CreateConnection();

        var rows = await conn.ExecuteAsync(@"
            UPDATE infrastructure.users
            SET is_active = 0, updated_at = GETUTCDATE()
            WHERE user_id = @UserId",
            new { UserId = userId });

        await LogAuditAsync(conn, "users", "DELETE", $"Deactivated user: {userId}", deletedBy);
        return rows > 0;
    }

    #endregion

    #region Tenant Management

    public async Task<IEnumerable<TenantListItem>> GetTenantsAsync()
    {
        using var conn = _dbFactory.CreateConnection();
        return await conn.QueryAsync<TenantListItem>(@"
            SELECT tenant_id AS TenantId, tenant_code AS TenantCode, tenant_name AS TenantName,
                   description AS Description, contact_email AS ContactEmail,
                   is_active AS IsActive, created_at AS CreatedAt
            FROM infrastructure.tenants
            ORDER BY created_at DESC");
    }

    public async Task<bool> CreateTenantAsync(CreateTenantRequest request, string createdBy)
    {
        using var conn = _dbFactory.CreateConnection();

        var exists = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM infrastructure.tenants WHERE tenant_code = @TenantCode",
            new { request.TenantCode });

        if (exists > 0)
        {
            _logger.LogWarning("Tenant code already exists: {TenantCode}", request.TenantCode);
            return false;
        }

        var rows = await conn.ExecuteAsync(@"
            INSERT INTO infrastructure.tenants
                (tenant_id, tenant_code, tenant_name, description, contact_email, is_active, created_at)
            VALUES
                (NEWID(), @TenantCode, @TenantName, @Description, @ContactEmail, 1, GETUTCDATE())",
            request);

        await LogAuditAsync(conn, "tenants", "CREATE", $"Created tenant: {request.TenantCode}", createdBy);
        return rows > 0;
    }

    public async Task<bool> UpdateTenantAsync(Guid tenantId, string tenantName, string? description, string updatedBy)
    {
        using var conn = _dbFactory.CreateConnection();

        var rows = await conn.ExecuteAsync(@"
            UPDATE infrastructure.tenants
            SET tenant_name = @TenantName, description = @Description, updated_at = GETUTCDATE()
            WHERE tenant_id = @TenantId",
            new { TenantId = tenantId, TenantName = tenantName, Description = description });

        await LogAuditAsync(conn, "tenants", "UPDATE", $"Updated tenant: {tenantId}", updatedBy);
        return rows > 0;
    }

    #endregion

    #region Error Management

    public async Task<IEnumerable<ErrorListItem>> GetErrorsAsync(string? tenantCode = null)
    {
        using var conn = _dbFactory.CreateConnection();
        return await conn.QueryAsync<ErrorListItem>(@"
            SELECT error_id AS ErrorId, error_code AS ErrorCode, error_title AS ErrorTitle,
                   error_description AS ErrorDescription, solution AS Solution,
                   root_cause AS RootCause, severity AS Severity, category AS Category,
                   tenant_code AS TenantCode, is_active AS IsActive, created_at AS CreatedAt
            FROM kb.error_library
            WHERE (@TenantCode IS NULL OR tenant_code = @TenantCode)
              AND is_active = 1
            ORDER BY created_at DESC",
            new { TenantCode = tenantCode });
    }

    public async Task<bool> CreateErrorAsync(CreateErrorRequest request, string createdBy)
    {
        using var conn = _dbFactory.CreateConnection();

        var exists = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM kb.error_library WHERE error_code = @ErrorCode AND tenant_code = @TenantCode",
            new { request.ErrorCode, request.TenantCode });

        if (exists > 0)
        {
            _logger.LogWarning("Error code already exists: {ErrorCode}", request.ErrorCode);
            return false;
        }

        var rows = await conn.ExecuteAsync(@"
            INSERT INTO kb.error_library
                (error_id, error_code, error_title, error_description, solution, root_cause,
                 severity, category, module_id, tenant_code, is_active, created_at)
            VALUES
                (NEWID(), @ErrorCode, @ErrorTitle, @ErrorDescription, @Solution, @RootCause,
                 @Severity, @Category, @ModuleId, @TenantCode, 1, GETUTCDATE())",
            request);

        await LogAuditAsync(conn, "error_library", "CREATE", $"Created error: {request.ErrorCode}", createdBy);
        return rows > 0;
    }

    public async Task<bool> UpdateErrorAsync(Guid errorId, CreateErrorRequest request, string updatedBy)
    {
        using var conn = _dbFactory.CreateConnection();

        var rows = await conn.ExecuteAsync(@"
            UPDATE kb.error_library
            SET error_title = @ErrorTitle, error_description = @ErrorDescription,
                solution = @Solution, root_cause = @RootCause,
                severity = @Severity, category = @Category, module_id = @ModuleId,
                updated_at = GETUTCDATE()
            WHERE error_id = @ErrorId",
            new
            {
                ErrorId = errorId,
                request.ErrorTitle, request.ErrorDescription, request.Solution,
                request.RootCause, request.Severity, request.Category, request.ModuleId
            });

        await LogAuditAsync(conn, "error_library", "UPDATE", $"Updated error: {errorId}", updatedBy);
        return rows > 0;
    }

    public async Task<bool> DeleteErrorAsync(Guid errorId, string deletedBy)
    {
        using var conn = _dbFactory.CreateConnection();

        var rows = await conn.ExecuteAsync(@"
            UPDATE kb.error_library
            SET is_active = 0, updated_at = GETUTCDATE()
            WHERE error_id = @ErrorId",
            new { ErrorId = errorId });

        await LogAuditAsync(conn, "error_library", "DELETE", $"Deleted error: {errorId}", deletedBy);
        return rows > 0;
    }

    #endregion

    #region Audit Log

    public async Task<IEnumerable<AuditLogEntry>> GetAuditLogsAsync(int pageSize = 100, int pageNumber = 1)
    {
        using var conn = _dbFactory.CreateConnection();
        return await conn.QueryAsync<AuditLogEntry>(@"
            SELECT audit_id AS AuditId, table_name AS TableName, action AS Action,
                   details AS Details, performed_by AS PerformedBy, performed_at AS PerformedAt
            FROM infrastructure.audit_log
            ORDER BY performed_at DESC
            OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY",
            new { Offset = (pageNumber - 1) * pageSize, PageSize = pageSize });
    }

    #endregion

    #region Helpers

    private static string HashPasswordMD5(string username, string password)
    {
        var bytes = Encoding.ASCII.GetBytes(username + password);
        var hash  = MD5.HashData(bytes);
        return string.Join("-", hash.Select(b => b.ToString("X2")));
    }

    private static async Task LogAuditAsync(IDbConnection conn, string tableName, string action, string details, string performedBy)
    {
        try
        {
            await conn.ExecuteAsync(@"
                INSERT INTO infrastructure.audit_log
                    (audit_id, table_name, action, details, performed_by, performed_at)
                VALUES
                    (NEWID(), @TableName, @Action, @Details, @PerformedBy, GETUTCDATE())",
                new { TableName = tableName, Action = action, Details = details, PerformedBy = performedBy });
        }
        catch
        {
            // Audit failures must not break the main operation
        }
    }

    #endregion
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

public class UserListItem
{
    public Guid UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Mobile { get; set; }
    public Guid? RoleId { get; set; }
    public string RoleName { get; set; } = string.Empty;
    public Guid? TenantId { get; set; }
    public string TenantName { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class RoleListItem
{
    public Guid RoleId { get; set; }
    public string RoleName { get; set; } = string.Empty;
}

public class TenantListItem
{
    public Guid TenantId { get; set; }
    public string TenantCode { get; set; } = string.Empty;
    public string TenantName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ContactEmail { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class ErrorListItem
{
    public Guid ErrorId { get; set; }
    public string ErrorCode { get; set; } = string.Empty;
    public string ErrorTitle { get; set; } = string.Empty;
    public string ErrorDescription { get; set; } = string.Empty;
    public string Solution { get; set; } = string.Empty;
    public string? RootCause { get; set; }
    public string Severity { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string TenantCode { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class AuditLogEntry
{
    public Guid AuditId { get; set; }
    public string TableName { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string? Details { get; set; }
    public string PerformedBy { get; set; } = string.Empty;
    public DateTime PerformedAt { get; set; }
}
