using EnterpriseChatbot.API.Models;
using EnterpriseChatbot.API.Models.Domain;
using EnterpriseChatbot.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EnterpriseChatbot.API.Controllers;

[ApiController]
[Route("api/v2/tenants")]
[Authorize]
public class TenantController : ControllerBase
{
    private readonly ITenantService _tenantService;

    public TenantController(ITenantService tenantService)
    {
        _tenantService = tenantService;
    }

    /// <summary>List all tenants. Platform admins only.</summary>
    [HttpGet]
    [Authorize(Roles = "PLATFORM_ADMIN")]
    public async Task<IActionResult> GetAll()
    {
        var tenants = await _tenantService.GetAllTenantsAsync();
        return Ok(ApiResponse<IEnumerable<Tenant>>.Ok(tenants));
    }

    /// <summary>Get a tenant by code.</summary>
    [HttpGet("{tenantCode}")]
    public async Task<IActionResult> GetTenant(string tenantCode)
    {
        var tenant = await _tenantService.GetTenantAsync(tenantCode);
        return Ok(ApiResponse<Tenant>.Ok(tenant));
    }
}
