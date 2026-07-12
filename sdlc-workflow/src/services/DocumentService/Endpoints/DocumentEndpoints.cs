using System.Text.Json;
using DocumentService.Infrastructure;
using DocumentService.Services;
using Microsoft.AspNetCore.Mvc;

namespace DocumentService.Endpoints;

public static class DocumentEndpointsExtensions
{
    public static void MapDocumentEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/documents").RequireAuthorization();

        // Download a document by its MinIO key (URL-encoded)
        group.MapGet("/download/{*minioKey}", async (
            string minioKey,
            IDocumentService svc,
            CancellationToken ct) =>
        {
            try
            {
                var stream   = await svc.DownloadAsync(Uri.UnescapeDataString(minioKey), ct);
                var fileName = Path.GetFileName(minioKey);
                return Results.File(stream,
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    fileName);
            }
            catch (FileNotFoundException ex)
            {
                return Results.NotFound(new { ex.Message });
            }
        });

        // All versions for a session
        group.MapGet("/session/{sessionId:guid}/versions", async (
            Guid sessionId,
            IDocumentService svc) =>
        {
            var versions = await svc.GetSessionVersionsAsync(sessionId);
            return Results.Ok(versions);
        });

        // Client uploads a revised plan document
        group.MapPost("/upload", async (
            HttpRequest request,
            [FromQuery] Guid sessionId,
            [FromQuery] Guid projectId,
            [FromQuery] string uploadedBy,
            IDocumentService svc,
            CancellationToken ct) =>
        {
            if (!request.HasFormContentType)
                return Results.BadRequest("multipart/form-data required");

            var form = await request.ReadFormAsync(ct);
            var file = form.Files.GetFile("file");
            if (file is null)
                return Results.BadRequest("No file provided");

            var uploadReq = new UploadRequest(
                SessionId:     sessionId,
                ProjectId:     projectId,
                DocumentType:  "client_upload",
                UploadedBy:    uploadedBy,
                FileName:      file.FileName,
                Content:       file.OpenReadStream(),
                ContentLength: file.Length);

            var result = await svc.UploadClientDocumentAsync(uploadReq, ct);
            return Results.Ok(result);
        });

        // Internal: agent calls this to store a generated requirements doc
        group.MapPost("/generate/requirements", async (
            [FromBody] GenerateDocRequest req,
            IDocumentService svc,
            CancellationToken ct) =>
        {
            using var json = JsonDocument.Parse(req.PackageJson);
            var key = await svc.GenerateAndStoreRequirementsDocAsync(
                req.SessionId, req.ProjectId, json, req.ActorId, ct);
            return Results.Ok(new { MinioKey = key });
        });

        // Internal: agent calls this to store a generated design doc
        group.MapPost("/generate/design", async (
            [FromBody] GenerateDocRequest req,
            IDocumentService svc,
            CancellationToken ct) =>
        {
            using var json = JsonDocument.Parse(req.PackageJson);
            var key = await svc.GenerateAndStoreDesignDocAsync(
                req.SessionId, req.ProjectId, json, req.ActorId, ct);
            return Results.Ok(new { MinioKey = key });
        });
    }
}

public record GenerateDocRequest(
    Guid   SessionId,
    Guid   ProjectId,
    string ActorId,
    string PackageJson
);
