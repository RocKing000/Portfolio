using SessionService.Services;

namespace SessionService.Endpoints;

public static class ApprovalGateEndpoints
{
    public static void MapApprovalGateEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/approval-gates").RequireAuthorization();

        // Open a new approval gate
        group.MapPost("/", async (OpenGateRequest req, IApprovalGateRepository repo) =>
        {
            var id = await repo.OpenAsync(req);
            return Results.Created($"/api/approval-gates/{id}", new { id });
        });

        // Get gate status
        group.MapGet("/{id:guid}", async (Guid id, IApprovalGateRepository repo) =>
        {
            var gate = await repo.GetByIdAsync(id);
            return gate is null ? Results.NotFound() : Results.Ok(gate);
        });

        // Submit gate decision (approve / reject)
        group.MapPost("/{id:guid}/decision", async (Guid id, GateDecisionRequest req, IApprovalGateRepository repo) =>
        {
            await repo.CloseAsync(id, req);
            return Results.NoContent();
        });

        // List pending gates for a session
        group.MapGet("/session/{sessionId:guid}/pending", async (Guid sessionId, IApprovalGateRepository repo) =>
            Results.Ok(await repo.GetPendingAsync(sessionId)));
    }
}

public record OpenGateRequest(
    Guid SessionId,
    Guid ProjectId,
    int Component,
    int GateNumber,
    string GateName,
    int IterationNumber = 1
);

public record GateDecisionRequest(
    string Decision,       // Approved | Rejected
    Guid ApprovedByUserId,
    string? RejectionReason
);
