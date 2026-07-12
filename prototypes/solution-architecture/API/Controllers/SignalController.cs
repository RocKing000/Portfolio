using System.Security.Claims;
using EnterpriseChatbot.API.Models;
using EnterpriseChatbot.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EnterpriseChatbot.API.Controllers;

[ApiController]
[Route("api/signal")]
[Authorize]
public class SignalController : ControllerBase
{
    private readonly ISignalService          _signals;
    private readonly IUserConnectionTracker  _throttle;
    private readonly ILogger<SignalController> _logger;

    public SignalController(
        ISignalService         signals,
        IUserConnectionTracker throttle,
        ILogger<SignalController> logger)
    {
        _signals  = signals;
        _throttle = throttle;
        _logger   = logger;
    }

    /// <summary>Creates a new signal. ML classification runs in background.</summary>
    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateSignalRequest request,
        CancellationToken ct)
    {
        var userId     = GetUserId();
        var tenantCode = GetTenantCode();

        var signal = await _signals.CreateSignalAsync(tenantCode, userId, request, classifyAfterCreate: true, ct);
        if (signal is null)
            return StatusCode(500, ApiFail("Failed to create signal."));

        return Ok(ApiOk(signal));
    }

    /// <summary>Returns open and in-progress signals. Throttled to 2 concurrent per user.</summary>
    [HttpGet("open")]
    public async Task<IActionResult> GetOpen(
        [FromQuery] int     topN        = 50,
        [FromQuery] byte?   minSeverity = null,
        [FromQuery] string? signalType  = null,
        CancellationToken ct = default)
    {
        var userId     = GetUserId();
        var tenantCode = GetTenantCode();

        if (!await _throttle.TryAcquireAsync(userId, ct))
            return StatusCode(429, ApiFail("Too many concurrent requests. Please retry shortly."));

        try
        {
            var signals = await _signals.GetOpenSignalsAsync(tenantCode, topN, minSeverity, signalType, ct);
            return Ok(ApiOk(signals));
        }
        finally
        {
            _throttle.Release(userId);
        }
    }

    /// <summary>Returns signals currently assigned to the calling user.</summary>
    [HttpGet("assigned")]
    public async Task<IActionResult> GetAssigned(
        [FromQuery] int topN = 50,
        CancellationToken ct = default)
    {
        var userId     = GetUserId();
        var tenantCode = GetTenantCode();

        var signals = await _signals.GetAssignedSignalsAsync(tenantCode, userId, topN, ct);
        return Ok(ApiOk(signals));
    }

    /// <summary>Returns pre-computed aggregation stats for the tenant.</summary>
    [HttpGet("aggregations")]
    public async Task<IActionResult> GetAggregations(
        [FromQuery] string periodType = "DAY",
        [FromQuery] int    lastN      = 30,
        CancellationToken ct = default)
    {
        var tenantCode = GetTenantCode();
        var aggs       = await _signals.GetAggregationsAsync(tenantCode, periodType, lastN, ct);
        return Ok(ApiOk(aggs));
    }

    /// <summary>Returns full signal details including tags and comments.</summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetDetails(Guid id, CancellationToken ct)
    {
        var tenantCode = GetTenantCode();
        var details    = await _signals.GetSignalDetailsAsync(id, tenantCode, ct);

        return details is null
            ? NotFound(ApiFail($"Signal {id} not found."))
            : Ok(ApiOk(details));
    }

    /// <summary>Transitions signal status (OPEN → IN_PROGRESS → RESOLVED → CLOSED).</summary>
    [HttpPut("{id:guid}/status")]
    public async Task<IActionResult> UpdateStatus(
        Guid id,
        [FromBody] UpdateStatusRequest request,
        CancellationToken ct)
    {
        var userId     = GetUserId();
        var tenantCode = GetTenantCode();

        var signal = await _signals.UpdateSignalStatusAsync(
            id, tenantCode, request.Status, userId, request.ResolutionNotes, ct);

        return signal is null
            ? NotFound(ApiFail($"Signal {id} not found or already closed."))
            : Ok(ApiOk(signal));
    }

    /// <summary>Assigns signal to a user; auto-transitions OPEN → IN_PROGRESS.</summary>
    [HttpPut("{id:guid}/assign")]
    public async Task<IActionResult> Assign(
        Guid id,
        [FromBody] AssignSignalRequest request,
        CancellationToken ct)
    {
        var userId     = GetUserId();
        var tenantCode = GetTenantCode();

        var signal = await _signals.AssignSignalAsync(id, tenantCode, request.AssignToUserId, userId, ct);

        return signal is null
            ? NotFound(ApiFail($"Signal {id} not found or target user is invalid."))
            : Ok(ApiOk(signal));
    }

    /// <summary>Appends a comment to the signal thread.</summary>
    [HttpPost("{id:guid}/comment")]
    public async Task<IActionResult> AddComment(
        Guid id,
        [FromBody] AddCommentRequest request,
        CancellationToken ct)
    {
        var userId     = GetUserId();
        var tenantCode = GetTenantCode();

        var comment = await _signals.AddCommentAsync(
            id, tenantCode, request.CommentText, userId, request.IsInternal, ct);

        return comment is null
            ? NotFound(ApiFail($"Signal {id} not found."))
            : Ok(ApiOk(comment));
    }

    /// <summary>Triggers ML classification and persists result to signal.ml_outputs.</summary>
    [HttpPost("{id:guid}/classify")]
    public async Task<IActionResult> Classify(Guid id, CancellationToken ct)
    {
        var tenantCode = GetTenantCode();
        var result     = await _signals.ClassifySignalAsync(id, tenantCode, ct);
        return Ok(ApiOk(result));
    }

    private Guid   GetUserId()     => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private string GetTenantCode() => User.FindFirstValue("TenantCode")!;

    private static object ApiOk<T>(T data)    => new { success = true,  data,    message = (string?)null };
    private static object ApiFail(string msg) => new { success = false, data = (object?)null, message = msg };
}

public sealed record UpdateStatusRequest(string Status, string? ResolutionNotes);
public sealed record AssignSignalRequest(Guid AssignToUserId);
public sealed record AddCommentRequest(string CommentText, bool IsInternal = true);
