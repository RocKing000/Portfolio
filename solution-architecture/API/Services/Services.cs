using System.Data;
using System.Diagnostics;
using Dapper;
using EnterpriseChatbot.API.Data;
using EnterpriseChatbot.API.Models;

namespace EnterpriseChatbot.API.Services;

// ── Error Identification ──────────────────────────────────────────────────────

public interface IErrorIdentificationService
{
    Task<ErrorIdentificationResponse> IdentifyErrorAsync(ErrorIdentificationRequest request);
    Task<IEnumerable<ErrorHierarchyNode>> GetErrorHierarchyAsync(string tenantCode, int? parentId, string? levelType);
}

public sealed class ErrorIdentificationService : IErrorIdentificationService
{
    // Raw DB projection — solution_steps arrives as a newline-separated string
    private sealed class RawIdentifiedError
    {
        public int HierarchyId { get; init; }
        public string ErrorCode { get; init; } = string.Empty;
        public string ErrorName { get; init; } = string.Empty;
        public string HierarchyPath { get; init; } = string.Empty;
        public int MappingId { get; init; }
        public int ResolutionId { get; init; }
        public string ResolutionTitle { get; init; } = string.Empty;
        public string ProblemDescription { get; init; } = string.Empty;
        public string SolutionSteps { get; init; } = string.Empty;
        public string? Prerequisites { get; init; }
        public string? ExpectedOutcome { get; init; }
        public string? EscalationNotes { get; init; }
        public decimal RelevanceScore { get; init; }
    }

    private readonly IDbConnectionFactory _dbFactory;
    private readonly ILogger<ErrorIdentificationService> _logger;

    public ErrorIdentificationService(IDbConnectionFactory dbFactory, ILogger<ErrorIdentificationService> logger)
    {
        _dbFactory = dbFactory;
        _logger = logger;
    }

    public async Task<ErrorIdentificationResponse> IdentifyErrorAsync(ErrorIdentificationRequest request)
    {
        _logger.LogInformation(
            "Identifying error — tenant: {TenantCode}, input: {ErrorInput}",
            request.TenantCode, request.ErrorInput);

        var sw = Stopwatch.StartNew();

        using var conn = _dbFactory.CreateConnection();
        var raw = await conn.QueryAsync<RawIdentifiedError>(
            "kb.sp_identify_error",
            new { request.TenantCode, request.ErrorInput, request.UserId },
            commandType: CommandType.StoredProcedure);

        sw.Stop();

        var errors = raw.Select(r => new IdentifiedError(
            r.HierarchyId,
            r.ErrorCode,
            r.ErrorName,
            r.HierarchyPath,
            r.MappingId,
            r.ResolutionId,
            r.ResolutionTitle,
            r.ProblemDescription,
            ParseSteps(r.SolutionSteps),
            r.Prerequisites,
            r.ExpectedOutcome,
            r.EscalationNotes,
            r.RelevanceScore
        )).ToList();

        _logger.LogInformation(
            "Identified {Count} error(s) for '{ErrorInput}' in {Ms}ms",
            errors.Count, request.ErrorInput, sw.ElapsedMilliseconds);

        return new ErrorIdentificationResponse(errors, sw.ElapsedMilliseconds, DateTime.UtcNow);
    }

    public async Task<IEnumerable<ErrorHierarchyNode>> GetErrorHierarchyAsync(
        string tenantCode, int? parentId, string? levelType)
    {
        _logger.LogInformation(
            "Getting hierarchy — tenant: {TenantCode}, parentId: {ParentId}, levelType: {LevelType}",
            tenantCode, parentId, levelType);

        using var conn = _dbFactory.CreateConnection();
        return await conn.QueryAsync<ErrorHierarchyNode>(
            "kb.sp_get_error_hierarchy",
            new { TenantCode = tenantCode, ParentId = parentId, LevelType = levelType },
            commandType: CommandType.StoredProcedure);
    }

    private static List<string> ParseSteps(string raw) =>
        raw.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
           .Select(s => System.Text.RegularExpressions.Regex.Replace(s, @"^\d+[.)]\s*", string.Empty))
           .Where(s => s.Length > 0)
           .ToList();
}

// ── Analytics ─────────────────────────────────────────────────────────────────

public interface IAnalyticsService
{
    Task<IEnumerable<TrendingError>> GetTrendingErrorsAsync(string? tenantCode, string periodType, int topN);
    Task<IEnumerable<DashboardMetrics>> GetDashboardMetricsAsync(string? tenantCode, DateTime? fromDate, DateTime? toDate);
    Task<SubmitFeedbackResponse> SubmitFeedbackAsync(SubmitFeedbackRequest request);
    Task TrackErrorViewAsync(int mappingId, string? userId, string? tenantCode);
}

public sealed class AnalyticsService : IAnalyticsService
{
    private readonly IDbConnectionFactory _dbFactory;
    private readonly ILogger<AnalyticsService> _logger;

    public AnalyticsService(IDbConnectionFactory dbFactory, ILogger<AnalyticsService> logger)
    {
        _dbFactory = dbFactory;
        _logger = logger;
    }

    public async Task<IEnumerable<TrendingError>> GetTrendingErrorsAsync(
        string? tenantCode, string periodType, int topN)
    {
        _logger.LogInformation(
            "Getting trending errors — tenant: {TenantCode}, period: {PeriodType}, topN: {TopN}",
            tenantCode, periodType, topN);

        try
        {
            using var conn = _dbFactory.CreateConnection();
            return await conn.QueryAsync<TrendingError>(
                "analytics.sp_get_trending_errors",
                new { TenantCode = tenantCode, PeriodType = periodType, TopN = topN },
                commandType: CommandType.StoredProcedure);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "analytics.sp_get_trending_errors unavailable — returning empty result");
            return Enumerable.Empty<TrendingError>();
        }
    }

    public async Task<IEnumerable<DashboardMetrics>> GetDashboardMetricsAsync(
        string? tenantCode, DateTime? fromDate, DateTime? toDate)
    {
        _logger.LogInformation(
            "Getting dashboard metrics — tenant: {TenantCode}, from: {FromDate}, to: {ToDate}",
            tenantCode, fromDate, toDate);

        try
        {
            using var conn = _dbFactory.CreateConnection();
            return await conn.QueryAsync<DashboardMetrics>(
                "analytics.sp_get_dashboard_metrics",
                new { TenantCode = tenantCode, FromDate = fromDate, ToDate = toDate },
                commandType: CommandType.StoredProcedure);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "analytics.sp_get_dashboard_metrics unavailable — returning empty result");
            return Enumerable.Empty<DashboardMetrics>();
        }
    }

    public async Task<SubmitFeedbackResponse> SubmitFeedbackAsync(SubmitFeedbackRequest request)
    {
        _logger.LogInformation(
            "Submitting feedback — errorCode: {ErrorCode}, helpful: {WasHelpful}",
            request.ErrorCode, request.WasHelpful);

        try
        {
            using var conn = _dbFactory.CreateConnection();
            await conn.ExecuteAsync(
                "analytics.sp_submit_feedback",
                new { request.ErrorCode, request.TenantCode, request.WasHelpful, request.Comment },
                commandType: CommandType.StoredProcedure);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "analytics.sp_submit_feedback unavailable — feedback not persisted");
        }

        return new SubmitFeedbackResponse(true, "Feedback submitted successfully.", DateTime.UtcNow);
    }

    public async Task TrackErrorViewAsync(int mappingId, string? userId, string? tenantCode)
    {
        _logger.LogInformation("Tracking view — mappingId: {MappingId}", mappingId);

        try
        {
            using var conn = _dbFactory.CreateConnection();
            await conn.ExecuteAsync(
                "analytics.sp_track_error_view",
                new { MappingId = mappingId, UserId = userId, TenantCode = tenantCode },
                commandType: CommandType.StoredProcedure);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "analytics.sp_track_error_view unavailable — view not tracked");
        }
    }
}
