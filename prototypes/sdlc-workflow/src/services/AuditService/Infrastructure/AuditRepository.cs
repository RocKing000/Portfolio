using Dapper;
using Microsoft.Data.SqlClient;

namespace AuditService.Infrastructure;

public interface IAuditRepository
{
    Task WriteEventAsync(AuditEventRecord record);
    Task<IEnumerable<AuditEventRecord>> QueryAsync(AuditQuery query);
    Task<IEnumerable<AuditEventRecord>> GetSessionTrailAsync(Guid sessionId);
    Task<IEnumerable<LLMUsageRecord>> GetLLMUsageAsync(Guid sessionId);
}

public class AuditRepository(IDbConnectionFactory factory) : IAuditRepository
{
    public async Task WriteEventAsync(AuditEventRecord record)
    {
        const string sql = """
            INSERT INTO [dbo].[AuditEvents]
                ([SessionId],[ProjectId],[EventType],[Component],[ActorType],[ActorId],
                 [AgentName],[Action],[Details],[InputSummary],[OutputSummary],[IsAnonymized],[OccurredAt])
            VALUES
                (@SessionId,@ProjectId,@EventType,@Component,@ActorType,@ActorId,
                 @AgentName,@Action,@Details,@InputSummary,@OutputSummary,@IsAnonymized,@OccurredAt)
            """;
        using var conn = factory.Create();
        await conn.ExecuteAsync(sql, record);
    }

    public async Task<IEnumerable<AuditEventRecord>> QueryAsync(AuditQuery query)
    {
        var where = new List<string>();
        if (query.SessionId.HasValue) where.Add("[SessionId] = @SessionId");
        if (query.ProjectId.HasValue) where.Add("[ProjectId] = @ProjectId");
        if (query.EventType is not null) where.Add("[EventType] = @EventType");
        if (query.Component.HasValue) where.Add("[Component] = @Component");
        if (query.From.HasValue) where.Add("[OccurredAt] >= @From");
        if (query.To.HasValue)   where.Add("[OccurredAt] <= @To");

        var whereClause = where.Count > 0 ? "WHERE " + string.Join(" AND ", where) : "";
        var sql = $"""
            SELECT TOP (@Limit) * FROM [dbo].[AuditEvents]
            {whereClause}
            ORDER BY [OccurredAt] DESC
            """;

        using var conn = factory.Create();
        return await conn.QueryAsync<AuditEventRecord>(sql, new
        {
            query.SessionId, query.ProjectId, query.EventType,
            query.Component, query.From, query.To,
            Limit = query.Limit > 0 ? query.Limit : 1000,
        });
    }

    public async Task<IEnumerable<AuditEventRecord>> GetSessionTrailAsync(Guid sessionId)
    {
        const string sql = """
            SELECT * FROM [dbo].[AuditEvents]
            WHERE [SessionId] = @SessionId
            ORDER BY [OccurredAt] ASC
            """;
        using var conn = factory.Create();
        return await conn.QueryAsync<AuditEventRecord>(sql, new { SessionId = sessionId });
    }

    public async Task<IEnumerable<LLMUsageRecord>> GetLLMUsageAsync(Guid sessionId)
    {
        const string sql = """
            SELECT * FROM [dbo].[LLMUsage]
            WHERE [SessionId] = @SessionId
            ORDER BY [CalledAt] ASC
            """;
        using var conn = factory.Create();
        return await conn.QueryAsync<LLMUsageRecord>(sql, new { SessionId = sessionId });
    }
}

// Records
public record AuditEventRecord(
    Guid?  SessionId, Guid?  ProjectId,
    string EventType, int?   Component,
    string ActorType, string? ActorId,
    string? AgentName, string Action,
    string? Details, string? InputSummary, string? OutputSummary,
    bool IsAnonymized, DateTime OccurredAt
);

public record LLMUsageRecord(
    Guid SessionId, Guid ProjectId,
    string AgentName, string Provider, string Model,
    int PromptTokens, int CompletionTokens, int TotalTokens,
    decimal EstimatedCostUSD, int? LatencyMs, bool Success,
    string? ErrorMessage, DateTime CalledAt
);

public record AuditQuery(
    Guid?    SessionId  = null,
    Guid?    ProjectId  = null,
    string?  EventType  = null,
    int?     Component  = null,
    DateTime? From      = null,
    DateTime? To        = null,
    int      Limit      = 1000
);
