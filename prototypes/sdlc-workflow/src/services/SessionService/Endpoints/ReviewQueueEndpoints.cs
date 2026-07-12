using SessionService.Services;

namespace SessionService.Endpoints;

public static class ReviewQueueEndpoints
{
    public static void MapReviewQueueEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/review").RequireAuthorization();

        // List available queue items for this user's authorized review types
        group.MapGet("/queue", async (IReviewQueueService svc) =>
            Results.Ok(await svc.GetAvailableItemsAsync()));

        // Claim an item from the queue
        group.MapPost("/queue/{id:guid}/claim", async (Guid id, ClaimReviewRequest req, IReviewQueueService svc) =>
        {
            var success = await svc.ClaimItemAsync(id, req.ReviewerUserId);
            return success ? Results.Ok() : Results.Conflict("Item already claimed.");
        });

        // Submit a review decision
        group.MapPost("/queue/{id:guid}/decision", async (Guid id, ReviewDecisionRequest req, IReviewQueueService svc) =>
        {
            await svc.SubmitDecisionAsync(id, req);
            return Results.NoContent();
        });

        // Escalate a review item
        group.MapPost("/queue/{id:guid}/escalate", async (Guid id, EscalateRequest req, IReviewQueueService svc) =>
        {
            await svc.EscalateItemAsync(id, req.EscalateToUserId, req.Reason);
            return Results.NoContent();
        });

        // Get review history for a session
        group.MapGet("/session/{sessionId:guid}", async (Guid sessionId, IReviewQueueService svc) =>
            Results.Ok(await svc.GetSessionReviewHistoryAsync(sessionId)));
    }
}

public record ClaimReviewRequest(Guid ReviewerUserId);
public record ReviewDecisionRequest(string Decision, string? Comments, string? ModifiedOutputMinioKey);
public record EscalateRequest(Guid EscalateToUserId, string Reason);
