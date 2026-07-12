using System.Security.Claims;
using EnterpriseChatbot.API.Models;
using EnterpriseChatbot.API.Models.Domain;
using EnterpriseChatbot.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EnterpriseChatbot.API.Controllers;

[ApiController]
[Route("api/v2/analytics")]
[AllowAnonymous]
public class AnalyticsController : ControllerBase
{
    private readonly IAnalyticsService _analyticsService;

    public AnalyticsController(IAnalyticsService analyticsService)
    {
        _analyticsService = analyticsService;
    }

    /// <summary>Get analytics overview summary for a time range.</summary>
    [HttpGet("overview")]
    public async Task<IActionResult> GetOverview([FromQuery] string timeRange = "7d")
    {
        var tenantCode = User.FindFirst("TenantCode")?.Value;
        var role       = User.FindFirst(ClaimTypes.Role)?.Value;

        var days         = ParseTimeRangeDays(timeRange);
        var fromDate     = DateTime.UtcNow.AddDays(-days);
        var tenantFilter = role == "PLATFORM_ADMIN" ? null : tenantCode;

        var metrics  = await _analyticsService.GetDashboardMetricsAsync(tenantFilter, fromDate, DateTime.UtcNow);
        var overview = new AnalyticsOverview
        {
            Summary = new AnalyticsSummary
            {
                TotalSearches   = metrics.Sum(m => m.TotalSearches),
                ActiveUsers     = metrics.Sum(m => m.TotalUsersActive),
                ActiveTenants   = metrics.Select(m => m.TenantCode).Distinct().Count(),
                ResolvedSearches = metrics.Sum(m => m.TotalErrorsIdentified),
                AvgResponseTime = metrics.Any() ? metrics.Average(m => (double)(m.AvgSearchDurationMs ?? 0)) : 0
            }
        };

        return Ok(ApiResponse<AnalyticsOverview>.Ok(overview));
    }

    /// <summary>Get trending errors for a period.</summary>
    [HttpGet("trending")]
    public async Task<IActionResult> GetTrending(
        [FromQuery] string period = "DAY",
        [FromQuery] int limit = 10,
        [FromQuery] string? tenantCode = null)
    {
        var validPeriods = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "DAY", "WEEK", "MONTH" };
        if (!validPeriods.Contains(period))
            return BadRequest(ApiResponse<object>.Fail("period must be DAY, WEEK, or MONTH"));

        var resolved = User.FindFirst(ClaimTypes.Role)?.Value == "PLATFORM_ADMIN"
            ? null
            : (User.FindFirst("TenantCode")?.Value ?? tenantCode);

        var trending = await _analyticsService.GetTrendingErrorsAsync(resolved, period.ToUpper(), limit);
        return Ok(ApiResponse<IEnumerable<TrendingError>>.Ok(trending));
    }

    /// <summary>Get dashboard metrics for a date range.</summary>
    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard(
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] string? tenantCode = null)
    {
        var resolved = User.FindFirst(ClaimTypes.Role)?.Value == "PLATFORM_ADMIN"
            ? null
            : (User.FindFirst("TenantCode")?.Value ?? tenantCode);

        var metrics = await _analyticsService.GetDashboardMetricsAsync(resolved, fromDate, toDate);
        return Ok(ApiResponse<IEnumerable<DashboardMetrics>>.Ok(metrics));
    }

    /// <summary>Submit feedback for a resolution.</summary>
    [HttpPost("feedback")]
    public async Task<IActionResult> SubmitFeedback([FromBody] SubmitFeedbackRequest request)
    {
        var result = await _analyticsService.SubmitFeedbackAsync(request);
        return Ok(ApiResponse<SubmitFeedbackResponse>.Ok(result));
    }

    /// <summary>Track that a user viewed an error mapping.</summary>
    [HttpPost("track/{mappingId:int}")]
    public async Task<IActionResult> TrackView(int mappingId)
    {
        var userId     = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var tenantCode = User.FindFirst("TenantCode")?.Value;
        await _analyticsService.TrackErrorViewAsync(mappingId, userId, tenantCode);
        return Ok(ApiResponse<string>.Ok("Tracked"));
    }

    private static int ParseTimeRangeDays(string range) => range switch
    {
        "7d"  => 7,
        "30d" => 30,
        "90d" => 90,
        _     => 7
    };
}
