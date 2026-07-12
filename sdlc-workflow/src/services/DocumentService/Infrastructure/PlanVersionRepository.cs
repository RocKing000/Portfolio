using Dapper;

namespace DocumentService.Infrastructure;

public interface IPlanVersionRepository
{
    Task<PlanVersion?> GetCurrentVersionAsync(Guid sessionId);
    Task<IEnumerable<PlanVersion>> GetSessionVersionsAsync(Guid sessionId);
    Task<PlanVersion?> GetByIdAsync(Guid versionId);
    Task<PlanVersion> CreateVersionAsync(Guid sessionId, Guid projectId, string minioKey, string documentType, string uploadedBy);
    Task SetCurrentVersionAsync(Guid sessionId, Guid versionId);
}

public class PlanVersionRepository(IDbConnectionFactory factory) : IPlanVersionRepository
{
    public async Task<PlanVersion?> GetCurrentVersionAsync(Guid sessionId)
    {
        const string sql = """
            SELECT TOP 1 * FROM [dbo].[PlanVersions]
            WHERE [SessionId] = @SessionId AND [IsCurrentVersion] = 1
            ORDER BY [VersionNumber] DESC
            """;
        using var conn = factory.Create();
        return await conn.QueryFirstOrDefaultAsync<PlanVersion>(sql, new { SessionId = sessionId });
    }

    public async Task<IEnumerable<PlanVersion>> GetSessionVersionsAsync(Guid sessionId)
    {
        const string sql = """
            SELECT * FROM [dbo].[PlanVersions]
            WHERE [SessionId] = @SessionId
            ORDER BY [VersionNumber] ASC
            """;
        using var conn = factory.Create();
        return await conn.QueryAsync<PlanVersion>(sql, new { SessionId = sessionId });
    }

    public async Task<PlanVersion?> GetByIdAsync(Guid versionId)
    {
        const string sql = "SELECT * FROM [dbo].[PlanVersions] WHERE [Id] = @Id";
        using var conn = factory.Create();
        return await conn.QueryFirstOrDefaultAsync<PlanVersion>(sql, new { Id = versionId });
    }

    public async Task<PlanVersion> CreateVersionAsync(
        Guid sessionId, Guid projectId, string minioKey,
        string documentType, string uploadedBy)
    {
        const string sql = """
            DECLARE @NextVersion INT;
            SELECT @NextVersion = ISNULL(MAX([VersionNumber]), 0) + 1
            FROM [dbo].[PlanVersions] WHERE [SessionId] = @SessionId;

            -- Mark previous versions as non-current
            UPDATE [dbo].[PlanVersions]
            SET [IsCurrentVersion] = 0
            WHERE [SessionId] = @SessionId AND [IsCurrentVersion] = 1;

            INSERT INTO [dbo].[PlanVersions]
                ([Id],[SessionId],[ProjectId],[VersionNumber],[MinioKey],
                 [DocumentType],[UploadedBy],[IsCurrentVersion],[CreatedAt])
            VALUES
                (NEWID(),@SessionId,@ProjectId,@NextVersion,@MinioKey,
                 @DocumentType,@UploadedBy,1,GETUTCDATE());

            SELECT * FROM [dbo].[PlanVersions]
            WHERE [SessionId] = @SessionId AND [IsCurrentVersion] = 1;
            """;
        using var conn = factory.Create();
        return (await conn.QueryAsync<PlanVersion>(sql, new
        {
            SessionId    = sessionId,
            ProjectId    = projectId,
            MinioKey     = minioKey,
            DocumentType = documentType,
            UploadedBy   = uploadedBy
        })).First();
    }

    public async Task SetCurrentVersionAsync(Guid sessionId, Guid versionId)
    {
        const string sql = """
            UPDATE [dbo].[PlanVersions] SET [IsCurrentVersion] = 0
            WHERE [SessionId] = @SessionId;

            UPDATE [dbo].[PlanVersions] SET [IsCurrentVersion] = 1
            WHERE [Id] = @VersionId;
            """;
        using var conn = factory.Create();
        await conn.ExecuteAsync(sql, new { SessionId = sessionId, VersionId = versionId });
    }
}
