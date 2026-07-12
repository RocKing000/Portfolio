namespace EnterpriseChatbot.API.Models.Configuration;

public class AppConfigItem
{
    public int ConfigId { get; set; }
    public string ConfigKey { get; set; } = string.Empty;
    public string ConfigValue { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Category { get; set; } = string.Empty;
    public string DataType { get; set; } = "string";
    public bool IsEncrypted { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class UiConfigItem
{
    public int ConfigId { get; set; }
    public string ConfigKey { get; set; } = string.Empty;
    public string ConfigValue { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string ComponentType { get; set; } = string.Empty;
    public string Section { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class CreateAppConfigRequest
{
    public string ConfigKey { get; set; } = string.Empty;
    public string ConfigValue { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Category { get; set; } = string.Empty;
    public string DataType { get; set; } = "string";
    public bool IsEncrypted { get; set; }
}

public class UpdateAppConfigRequest
{
    public int ConfigId { get; set; }
    public string ConfigValue { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; }
}

public class CreateUserRequest
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Mobile { get; set; }
    public Guid RoleId { get; set; }
    public Guid TenantId { get; set; }
}

public class UpdateUserRequest
{
    public Guid UserId { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Mobile { get; set; }
    public Guid RoleId { get; set; }
    public bool IsActive { get; set; }
}

public class ResetPasswordRequest
{
    public Guid UserId { get; set; }
    public string NewPassword { get; set; } = string.Empty;
    public bool RequirePasswordChange { get; set; } = true;
}

public class CreateTenantRequest
{
    public string TenantCode { get; set; } = string.Empty;
    public string TenantName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ContactEmail { get; set; }
}

public class CreateErrorRequest
{
    public string ErrorCode { get; set; } = string.Empty;
    public string ErrorTitle { get; set; } = string.Empty;
    public string ErrorDescription { get; set; } = string.Empty;
    public string Solution { get; set; } = string.Empty;
    public string? RootCause { get; set; }
    public string Severity { get; set; } = "MEDIUM";
    public string Category { get; set; } = string.Empty;
    public Guid? ModuleId { get; set; }
    public string TenantCode { get; set; } = string.Empty;
}
