using SessionService.Services;

namespace SessionService.Endpoints;

public static class SessionEndpoints
{
    public static void MapSessionEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/sessions").RequireAuthorization();

        group.MapPost("/", async (CreateSessionRequest req, ISessionService svc) =>
        {
            var session = await svc.CreateSessionAsync(req);
            return Results.Created($"/api/sessions/{session.Id}", session);
        });

        group.MapGet("/{id:guid}", async (Guid id, ISessionService svc) =>
        {
            var session = await svc.GetSessionAsync(id);
            return session is null ? Results.NotFound() : Results.Ok(session);
        });

        group.MapPut("/{id:guid}/status", async (Guid id, UpdateSessionStatusRequest req, ISessionService svc) =>
        {
            await svc.UpdateStatusAsync(id, req.Status);
            return Results.NoContent();
        });

        group.MapDelete("/{id:guid}", async (Guid id, ISessionService svc) =>
        {
            await svc.EndSessionAsync(id);
            return Results.NoContent();
        });
    }
}

public record CreateSessionRequest(
    Guid ProjectId,
    int Component,
    string OperatingMode,
    string RedisSessionKey
);

public record UpdateSessionStatusRequest(string Status);
