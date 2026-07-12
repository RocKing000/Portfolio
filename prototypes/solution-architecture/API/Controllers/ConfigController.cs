using System.Data;
using Dapper;
using EnterpriseChatbot.API.Data;
using EnterpriseChatbot.API.Models;
using EnterpriseChatbot.API.Models.DTOs;
using EnterpriseChatbot.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EnterpriseChatbot.API.Controllers;

[ApiController]
[Route("api/v2/config")]
[Authorize(Roles = "PLATFORM_ADMIN")]
public class ConfigController : ControllerBase
{
    private readonly IConfigurationService _configService;
    private readonly IDbConnectionFactory _db;

    public ConfigController(IConfigurationService configService, IDbConnectionFactory db)
    {
        _configService = configService;
        _db = db;
    }

    /// <summary>Get all configuration keys (sensitive values masked).</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        using var conn = _db.CreateConnection();
        var configs = await conn.QueryAsync(@"
            SELECT
                config_key,
                CASE WHEN is_sensitive = 1 THEN '***' ELSE config_value END AS config_value,
                config_type,
                is_sensitive,
                is_active,
                description,
                updated_at
            FROM infrastructure.app_config
            ORDER BY config_key");
        return Ok(ApiResponse<object>.Ok(configs));
    }

    /// <summary>Update a configuration value by key.</summary>
    [HttpPut("{key}")]
    public async Task<IActionResult> Update(string key, [FromBody] UpdateConfigRequest request)
    {
        using var conn = _db.CreateConnection();
        await conn.ExecuteAsync(
            "infrastructure.sp_update_config",
            new { ConfigKey = key, ConfigValue = request.Value },
            commandType: CommandType.StoredProcedure);

        return Ok(ApiResponse<string>.Ok("Updated", $"Config '{key}' updated"));
    }

    /// <summary>Reload configuration cache from database.</summary>
    [HttpPost("reload")]
    public async Task<IActionResult> Reload()
    {
        await _configService.ReloadAsync();
        return Ok(ApiResponse<string>.Ok("Reloaded", "Configuration cache refreshed"));
    }
}
