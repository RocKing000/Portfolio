using EnterpriseChatbot.API.Models.Configuration;
using EnterpriseChatbot.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace EnterpriseChatbot.API.Controllers;

[ApiController]
[Route("api/v2/admin")]
[Authorize(Roles = "PLATFORM_ADMIN")]
public class AdminController : ControllerBase
{
    private readonly IAdminConfigService _adminService;
    private readonly ILogger<AdminController> _logger;

    public AdminController(IAdminConfigService adminService, ILogger<AdminController> logger)
    {
        _adminService = adminService;
        _logger = logger;
    }

    private string CurrentUser => User.FindFirst(ClaimTypes.Name)?.Value ?? "system";

    // ── App Config ────────────────────────────────────────────────────────────

    [HttpGet("config/app")]
    public async Task<IActionResult> GetAppConfigs([FromQuery] string? category = null)
    {
        var configs = await _adminService.GetAppConfigsAsync(category);
        return Ok(new { success = true, data = configs });
    }

    [HttpGet("config/app/{configKey}")]
    public async Task<IActionResult> GetAppConfigByKey(string configKey)
    {
        var config = await _adminService.GetAppConfigByKeyAsync(configKey);
        if (config == null) return NotFound(new { success = false, message = "Configuration not found" });
        return Ok(new { success = true, data = config });
    }

    [HttpPost("config/app")]
    public async Task<IActionResult> CreateAppConfig([FromBody] CreateAppConfigRequest request)
    {
        var ok = await _adminService.CreateAppConfigAsync(request, CurrentUser);
        if (!ok) return BadRequest(new { success = false, message = "Config key already exists" });
        return Ok(new { success = true, message = "Configuration created" });
    }

    [HttpPut("config/app")]
    public async Task<IActionResult> UpdateAppConfig([FromBody] UpdateAppConfigRequest request)
    {
        var ok = await _adminService.UpdateAppConfigAsync(request, CurrentUser);
        if (!ok) return BadRequest(new { success = false, message = "Update failed" });
        return Ok(new { success = true, message = "Configuration updated" });
    }

    [HttpDelete("config/app/{configId:int}")]
    public async Task<IActionResult> DeleteAppConfig(int configId)
    {
        var ok = await _adminService.DeleteAppConfigAsync(configId, CurrentUser);
        if (!ok) return BadRequest(new { success = false, message = "Delete failed" });
        return Ok(new { success = true, message = "Configuration deleted" });
    }

    // ── UI Config ─────────────────────────────────────────────────────────────

    [HttpGet("config/ui")]
    public async Task<IActionResult> GetUiConfigs([FromQuery] string? section = null)
    {
        var configs = await _adminService.GetUiConfigsAsync(section);
        return Ok(new { success = true, data = configs });
    }

    [HttpPut("config/ui/{configId:int}")]
    public async Task<IActionResult> UpdateUiConfig(int configId, [FromBody] UpdateUiConfigValueRequest request)
    {
        var ok = await _adminService.UpdateUiConfigAsync(configId, request.ConfigValue, CurrentUser);
        if (!ok) return BadRequest(new { success = false, message = "Update failed" });
        return Ok(new { success = true, message = "UI configuration updated" });
    }

    // ── Users ─────────────────────────────────────────────────────────────────

    [HttpGet("users")]
    public async Task<IActionResult> GetUsers([FromQuery] Guid? tenantId = null)
    {
        var users = await _adminService.GetUsersAsync(tenantId);
        return Ok(new { success = true, data = users });
    }

    [HttpGet("users/roles")]
    public async Task<IActionResult> GetRoles()
    {
        var roles = await _adminService.GetRolesAsync();
        return Ok(new { success = true, data = roles });
    }

    [HttpPost("users")]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
    {
        var ok = await _adminService.CreateUserAsync(request, CurrentUser);
        if (!ok) return BadRequest(new { success = false, message = "Username already exists" });
        return Ok(new { success = true, message = "User created" });
    }

    [HttpPut("users")]
    public async Task<IActionResult> UpdateUser([FromBody] UpdateUserRequest request)
    {
        var ok = await _adminService.UpdateUserAsync(request, CurrentUser);
        if (!ok) return BadRequest(new { success = false, message = "Update failed" });
        return Ok(new { success = true, message = "User updated" });
    }

    [HttpPost("users/reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        var ok = await _adminService.ResetPasswordAsync(request, CurrentUser);
        if (!ok) return BadRequest(new { success = false, message = "User not found" });
        return Ok(new { success = true, message = "Password reset" });
    }

    [HttpDelete("users/{userId:guid}")]
    public async Task<IActionResult> DeleteUser(Guid userId)
    {
        var ok = await _adminService.DeleteUserAsync(userId, CurrentUser);
        if (!ok) return BadRequest(new { success = false, message = "Delete failed" });
        return Ok(new { success = true, message = "User deactivated" });
    }

    // ── Tenants ───────────────────────────────────────────────────────────────

    [HttpGet("tenants")]
    public async Task<IActionResult> GetTenants()
    {
        var tenants = await _adminService.GetTenantsAsync();
        return Ok(new { success = true, data = tenants });
    }

    [HttpPost("tenants")]
    public async Task<IActionResult> CreateTenant([FromBody] CreateTenantRequest request)
    {
        var ok = await _adminService.CreateTenantAsync(request, CurrentUser);
        if (!ok) return BadRequest(new { success = false, message = "Tenant code already exists" });
        return Ok(new { success = true, message = "Tenant created" });
    }

    [HttpPut("tenants/{tenantId:guid}")]
    public async Task<IActionResult> UpdateTenant(Guid tenantId, [FromBody] UpdateTenantRequest request)
    {
        var ok = await _adminService.UpdateTenantAsync(tenantId, request.TenantName, request.Description, CurrentUser);
        if (!ok) return BadRequest(new { success = false, message = "Update failed" });
        return Ok(new { success = true, message = "Tenant updated" });
    }

    // ── Errors ────────────────────────────────────────────────────────────────

    [HttpGet("errors")]
    public async Task<IActionResult> GetErrors([FromQuery] string? tenantCode = null)
    {
        var errors = await _adminService.GetErrorsAsync(tenantCode);
        return Ok(new { success = true, data = errors });
    }

    [HttpPost("errors")]
    public async Task<IActionResult> CreateError([FromBody] CreateErrorRequest request)
    {
        var ok = await _adminService.CreateErrorAsync(request, CurrentUser);
        if (!ok) return BadRequest(new { success = false, message = "Error code already exists for this tenant" });
        return Ok(new { success = true, message = "Error created" });
    }

    [HttpPut("errors/{errorId:guid}")]
    public async Task<IActionResult> UpdateError(Guid errorId, [FromBody] CreateErrorRequest request)
    {
        var ok = await _adminService.UpdateErrorAsync(errorId, request, CurrentUser);
        if (!ok) return BadRequest(new { success = false, message = "Update failed" });
        return Ok(new { success = true, message = "Error updated" });
    }

    [HttpDelete("errors/{errorId:guid}")]
    public async Task<IActionResult> DeleteError(Guid errorId)
    {
        var ok = await _adminService.DeleteErrorAsync(errorId, CurrentUser);
        if (!ok) return BadRequest(new { success = false, message = "Delete failed" });
        return Ok(new { success = true, message = "Error deleted" });
    }

    // ── Audit Log ─────────────────────────────────────────────────────────────

    [HttpGet("audit")]
    public async Task<IActionResult> GetAuditLogs(
        [FromQuery] int pageSize = 100,
        [FromQuery] int pageNumber = 1)
    {
        var logs = await _adminService.GetAuditLogsAsync(pageSize, pageNumber);
        return Ok(new { success = true, data = logs });
    }
}

// ── Request DTOs ──────────────────────────────────────────────────────────────

public class UpdateUiConfigValueRequest
{
    public string ConfigValue { get; set; } = string.Empty;
}

public class UpdateTenantRequest
{
    public string TenantName { get; set; } = string.Empty;
    public string? Description { get; set; }
}
