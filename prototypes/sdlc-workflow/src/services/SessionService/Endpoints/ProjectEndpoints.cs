using SessionService.Services;

namespace SessionService.Endpoints;

public static class ProjectEndpoints
{
    public static void MapProjectEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/projects").RequireAuthorization();

        group.MapPost("/", async (CreateProjectRequest req, IProjectRepository repo) =>
        {
            var id = await repo.CreateAsync(req);
            return Results.Created($"/api/projects/{id}", new { id });
        });

        group.MapGet("/{id:guid}", async (Guid id, IProjectRepository repo) =>
        {
            var project = await repo.GetByIdAsync(id);
            return project is null ? Results.NotFound() : Results.Ok(project);
        });

        group.MapGet("/", async (IProjectRepository repo) =>
            Results.Ok(await repo.ListAsync()));

        group.MapPut("/{id:guid}", async (Guid id, UpdateProjectRequest req, IProjectRepository repo) =>
        {
            await repo.UpdateAsync(id, req);
            return Results.NoContent();
        });
    }
}

public record CreateProjectRequest(
    string Name,
    string? Description,
    Guid ClientId,
    string OperatingMode,
    string LLMProvider,
    string LLMModelTier,
    string SensitivityLevel,
    string ComplianceMode
);

public record UpdateProjectRequest(
    string? Name,
    string? OperatingMode,
    string? Status
);
