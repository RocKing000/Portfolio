using System.Security.Claims;
using EnterpriseChatbot.API.Models;
using EnterpriseChatbot.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EnterpriseChatbot.API.Controllers;

[ApiController]
[Route("api/v2/dashboard")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly IAnalyticsService _analyticsService;

    public DashboardController(IAnalyticsService analyticsService)
    {
        _analyticsService = analyticsService;
    }

    /// <summary>Get dashboard summary for the last 30 days.</summary>
    [HttpGet]
    public async Task<IActionResult> GetSummary()
    {
        var role       = User.FindFirst(ClaimTypes.Role)?.Value;
        var tenantCode = role == "PLATFORM_ADMIN" ? null : User.FindFirst("TenantCode")?.Value;

        var fromDate = DateTime.UtcNow.AddDays(-30);
        var metrics  = await _analyticsService.GetDashboardMetricsAsync(tenantCode, fromDate, DateTime.UtcNow);
        var trending = await _analyticsService.GetTrendingErrorsAsync(tenantCode, "WEEK", 5);

        return Ok(ApiResponse<object>.Ok(new
        {
            Metrics  = metrics,
            Trending = trending
        }));
    }
}
