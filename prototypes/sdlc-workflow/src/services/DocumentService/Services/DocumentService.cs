using System.Text.Json;
using DocumentService.Infrastructure;

namespace DocumentService.Services;

public interface IDocumentService
{
    Task<Stream> DownloadAsync(string minioKey, CancellationToken ct = default);
    Task<UploadResult> UploadClientDocumentAsync(UploadRequest request, CancellationToken ct = default);
    Task<IEnumerable<PlanVersion>> GetSessionVersionsAsync(Guid sessionId);
    Task<string> GenerateAndStoreRequirementsDocAsync(Guid sessionId, Guid projectId, JsonDocument requirementsPackage, string actorId, CancellationToken ct = default);
    Task<string> GenerateAndStoreDesignDocAsync(Guid sessionId, Guid projectId, JsonDocument designPackage, string actorId, CancellationToken ct = default);
}

public class DocumentService(
    IDocumentStore       store,
    IPlanVersionRepository repo,
    IDocxGenerator       generator,
    IDiffEngine          diffEngine,
    IConfiguration       config,
    ILogger<DocumentService> logger
) : IDocumentService
{
    private string Bucket => config["Minio:PlansBucket"] ?? "sdlc-plans";

    public async Task<Stream> DownloadAsync(string minioKey, CancellationToken ct = default)
    {
        if (!await store.ExistsAsync(Bucket, minioKey, ct))
            throw new FileNotFoundException($"Document not found: {minioKey}");

        return await store.DownloadAsync(Bucket, minioKey, ct);
    }

    public async Task<UploadResult> UploadClientDocumentAsync(UploadRequest request, CancellationToken ct = default)
    {
        var minioKey = BuildMinioKey(request.SessionId, request.DocumentType, request.FileName);

        await store.UploadAsync(Bucket, minioKey, request.Content, request.ContentLength,
            ContentTypeFor(request.FileName), ct);

        // Diff against current generated version if one exists
        var diffs = new List<DocumentDiff>();
        bool requiresReapproval = false;

        var current = await repo.GetCurrentVersionAsync(request.SessionId);
        if (current is not null && current.DocumentType == "generated")
        {
            try
            {
                var originalStream = await store.DownloadAsync(Bucket, current.MinioKey, ct);
                request.Content.Position = 0;
                var uploadedStream = await store.DownloadAsync(Bucket, minioKey, ct);
                diffs = (await diffEngine.ComputeDiffAsync(originalStream, uploadedStream)).ToList();
                requiresReapproval = diffs.Any(d => d.RequiresReapproval);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Diff computation failed; treating upload as clean.");
            }
        }

        var version = await repo.CreateVersionAsync(
            request.SessionId, request.ProjectId, minioKey,
            request.DocumentType, request.UploadedBy);

        return new UploadResult(
            VersionId:         version.Id,
            MinioKey:          minioKey,
            VersionNumber:     version.VersionNumber,
            Diffs:             diffs,
            HasConflicts:      diffs.Any(d => d.ChangeType == "removal"),
            RequiresReapproval: requiresReapproval);
    }

    public Task<IEnumerable<PlanVersion>> GetSessionVersionsAsync(Guid sessionId) =>
        repo.GetSessionVersionsAsync(sessionId);

    public async Task<string> GenerateAndStoreRequirementsDocAsync(
        Guid sessionId, Guid projectId, JsonDocument requirementsPackage,
        string actorId, CancellationToken ct = default)
    {
        var docStream = generator.GenerateRequirementsDocument(requirementsPackage);
        var fileName  = $"requirements_{DateTime.UtcNow:yyyyMMddHHmmss}.docx";
        var minioKey  = BuildMinioKey(sessionId, "generated", fileName);

        await store.UploadAsync(Bucket, minioKey, docStream, docStream.Length,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ct);

        await repo.CreateVersionAsync(sessionId, projectId, minioKey, "generated", actorId);
        return minioKey;
    }

    public async Task<string> GenerateAndStoreDesignDocAsync(
        Guid sessionId, Guid projectId, JsonDocument designPackage,
        string actorId, CancellationToken ct = default)
    {
        var docStream = generator.GenerateDesignDocument(designPackage);
        var fileName  = $"design_{DateTime.UtcNow:yyyyMMddHHmmss}.docx";
        var minioKey  = BuildMinioKey(sessionId, "generated", fileName);

        await store.UploadAsync(Bucket, minioKey, docStream, docStream.Length,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ct);

        await repo.CreateVersionAsync(sessionId, projectId, minioKey, "generated", actorId);
        return minioKey;
    }

    private static string BuildMinioKey(Guid sessionId, string docType, string fileName) =>
        $"sessions/{sessionId}/{docType}/{fileName}";

    private static string ContentTypeFor(string fileName) =>
        Path.GetExtension(fileName).ToLowerInvariant() switch
        {
            ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".pdf"  => "application/pdf",
            ".json" => "application/json",
            _       => "application/octet-stream"
        };
}
