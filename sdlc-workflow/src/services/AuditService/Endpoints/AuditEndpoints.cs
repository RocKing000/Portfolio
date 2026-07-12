using AuditService.Infrastructure;

namespace AuditService.Endpoints;

public static class AuditEndpointsExtensions
{
    public static void MapAuditEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/audit").RequireAuthorization();

        // Full audit trail for a session
        group.MapGet("/session/{sessionId:guid}", async (Guid sessionId, IAuditRepository repo) =>
            Results.Ok(await repo.GetSessionTrailAsync(sessionId)));

        // LLM usage for a session (billing visibility)
        group.MapGet("/session/{sessionId:guid}/llm-usage", async (Guid sessionId, IAuditRepository repo) =>
            Results.Ok(await repo.GetLLMUsageAsync(sessionId)));

        // Filtered query
        group.MapGet("/query", async (
            Guid?    sessionId,
            Guid?    projectId,
            string?  eventType,
            int?     component,
            DateTime? from,
            DateTime? to,
            int      limit,
            IAuditRepository repo
        ) =>
        {
            var query = new AuditQuery(sessionId, projectId, eventType, component, from, to, limit == 0 ? 1000 : limit);
            return Results.Ok(await repo.QueryAsync(query));
        });

        // Approval decisions only (for compliance reports)
        group.MapGet("/session/{sessionId:guid}/approvals", async (Guid sessionId, IAuditRepository repo) =>
        {
            var all = await repo.QueryAsync(new AuditQuery(
                SessionId: sessionId,
                EventType: "ClientApproval"));
            return Results.Ok(all);
        });
    }
}

public interface IAuditQueryService { }
public class AuditQueryService : IAuditQueryService { }
