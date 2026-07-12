using System.Security.Claims;
using EnterpriseChatbot.API.Models;
using EnterpriseChatbot.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EnterpriseChatbot.API.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize]
public class DashboardBuilderController : ControllerBase
{
    private readonly IDashboardService              _dashboard;
    private readonly IUserConnectionTracker         _throttle;
    private readonly ILogger<DashboardBuilderController> _logger;

    public DashboardBuilderController(
        IDashboardService              dashboard,
        IUserConnectionTracker         throttle,
        ILogger<DashboardBuilderController> logger)
    {
        _dashboard = dashboard;
        _throttle  = throttle;
        _logger    = logger;
    }

    // ── POST /api/dashboard/layouts ─────────────────────────────────────────
    /// <summary>Creates a new layout (max 5 per user).</summary>
    [HttpPost("layouts")]
    public async Task<IActionResult> CreateLayout(
        [FromBody] CreateLayoutRequest request,
        CancellationToken ct)
    {
        var userId     = GetUserId();
        var tenantCode = GetTenantCode();

        try
        {
            var layout = await _dashboard.CreateLayoutAsync(userId, tenantCode, request, ct);

            return layout is null
                ? BadRequest(ApiFail("Maximum of 5 layouts per user reached. Delete an existing layout first."))
                : Ok(ApiOk(layout));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiFail(ex.Message));
        }
    }

    // ── GET /api/dashboard/layouts ──────────────────────────────────────────
    /// <summary>Returns layouts owned by the user plus shared layouts.</summary>
    [HttpGet("layouts")]
    public async Task<IActionResult> GetLayouts(
        [FromQuery] bool includeShared = true,
        CancellationToken ct = default)
    {
        var userId     = GetUserId();
        var tenantCode = GetTenantCode();

        var layouts = await _dashboard.GetUserLayoutsAsync(userId, tenantCode, includeShared, ct);
        return Ok(ApiOk(layouts));
    }

    // ── GET /api/dashboard/layouts/{id} ─────────────────────────────────────
    /// <summary>Returns full layout with all widgets.</summary>
    [HttpGet("layouts/{id:guid}")]
    public async Task<IActionResult> GetLayoutDetails(Guid id, CancellationToken ct)
    {
        var userId  = GetUserId();
        var details = await _dashboard.GetLayoutDetailsAsync(id, userId, ct);

        return details is null
            ? NotFound(ApiFail($"Layout {id} not found or access denied."))
            : Ok(ApiOk(details));
    }

    // ── DELETE /api/dashboard/layouts/{id} ──────────────────────────────────
    /// <summary>Soft-deletes a layout (owner only).</summary>
    [HttpDelete("layouts/{id:guid}")]
    public async Task<IActionResult> DeleteLayout(Guid id, CancellationToken ct)
    {
        var userId     = GetUserId();
        var tenantCode = GetTenantCode();

        var deleted = await _dashboard.DeleteLayoutAsync(id, userId, tenantCode, ct);

        return deleted
            ? Ok(ApiOk<object?>(null))
            : NotFound(ApiFail($"Layout {id} not found or you are not the owner."));
    }

    // ── POST /api/dashboard/layouts/{id}/share ───────────────────────────────
    /// <summary>Shares a layout with another tenant user (owner only).</summary>
    [HttpPost("layouts/{id:guid}/share")]
    public async Task<IActionResult> ShareLayout(
        Guid id,
        [FromBody] ShareLayoutRequest request,
        CancellationToken ct)
    {
        var userId     = GetUserId();
        var tenantCode = GetTenantCode();

        var share = await _dashboard.ShareLayoutAsync(id, userId, tenantCode, request, ct);

        return share is null
            ? BadRequest(ApiFail("Layout not found, you are not the owner, or target user is invalid."))
            : Ok(ApiOk(share));
    }

    // ── POST /api/dashboard/widgets ─────────────────────────────────────────
    /// <summary>Adds a widget to a layout.</summary>
    [HttpPost("widgets")]
    public async Task<IActionResult> AddWidget(
        [FromBody] AddWidgetRequest request,
        CancellationToken ct)
    {
        var userId     = GetUserId();
        var tenantCode = GetTenantCode();

        var widget = await _dashboard.AddWidgetAsync(userId, tenantCode, request, ct);

        return widget is null
            ? BadRequest(ApiFail("Failed to add widget. Check layout access and position JSON."))
            : Ok(ApiOk(widget));
    }

    // ── PUT /api/dashboard/widgets/{id}/position ─────────────────────────────
    /// <summary>Updates widget grid position (drag-and-drop).</summary>
    [HttpPut("widgets/{id:guid}/position")]
    public async Task<IActionResult> UpdateWidgetPosition(
        Guid id,
        [FromBody] WidgetPositionRequest request,
        CancellationToken ct)
    {
        var userId     = GetUserId();
        var tenantCode = GetTenantCode();

        var widget = await _dashboard.UpdateWidgetPositionAsync(
            id, userId, tenantCode, request.Position, ct);

        return widget is null
            ? BadRequest(ApiFail("Widget not found, locked, or invalid position JSON."))
            : Ok(ApiOk(widget));
    }

    // ── PUT /api/dashboard/widgets/{id}/config ───────────────────────────────
    /// <summary>Updates widget title, config, visibility, or lock state.</summary>
    [HttpPut("widgets/{id:guid}/config")]
    public async Task<IActionResult> UpdateWidgetConfig(
        Guid id,
        [FromBody] UpdateWidgetRequest request,
        CancellationToken ct)
    {
        var userId     = GetUserId();
        var tenantCode = GetTenantCode();

        var widget = await _dashboard.UpdateWidgetConfigAsync(id, userId, tenantCode, request, ct);

        return widget is null
            ? BadRequest(ApiFail("Widget not found or invalid JSON in config/position."))
            : Ok(ApiOk(widget));
    }

    // ── DELETE /api/dashboard/widgets/{id} ──────────────────────────────────
    /// <summary>Removes a widget from its layout.</summary>
    [HttpDelete("widgets/{id:guid}")]
    public async Task<IActionResult> DeleteWidget(Guid id, CancellationToken ct)
    {
        var userId     = GetUserId();
        var tenantCode = GetTenantCode();

        var deleted = await _dashboard.DeleteWidgetAsync(id, userId, tenantCode, ct);

        return deleted
            ? Ok(ApiOk<object?>(null))
            : NotFound(ApiFail($"Widget {id} not found or access denied."));
    }

    // ── GET /api/dashboard/templates ────────────────────────────────────────
    /// <summary>Returns available widget templates, optionally filtered by category.</summary>
    [HttpGet("templates")]
    public async Task<IActionResult> GetTemplates(
        [FromQuery] string? category  = null,
        [FromQuery] bool    premiumOk = false,
        CancellationToken ct = default)
    {
        var templates = await _dashboard.GetWidgetTemplatesAsync(category, premiumOk, ct);
        return Ok(ApiOk(templates));
    }

    private Guid   GetUserId()     => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private string GetTenantCode() => User.FindFirstValue("TenantCode")!;

    private static object ApiOk<T>(T data)    => new { success = true,  data,    message = (string?)null };
    private static object ApiFail(string msg) => new { success = false, data = (object?)null, message = msg };
}

public sealed record WidgetPositionRequest(string Position);
