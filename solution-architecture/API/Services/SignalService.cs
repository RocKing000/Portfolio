using System.Data;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Dapper;
using EnterpriseChatbot.API.Exceptions;
using EnterpriseChatbot.API.Models;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace EnterpriseChatbot.API.Services;

public class SignalService : ISignalService
{
    private readonly string        _connectionString;
    private readonly HttpClient    _httpClient;
    private readonly ICacheService _cache;
    private readonly ILogger<SignalService> _logger;

    private static readonly TimeSpan OpenSignalsCacheTtl = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan AggregationCacheTtl = TimeSpan.FromMinutes(5);

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy        = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition      = JsonIgnoreCondition.WhenWritingNull,
        PropertyNameCaseInsensitive = true
    };

    public SignalService(
        IConfiguration  configuration,
        HttpClient      httpClient,
        ICacheService   cache,
        ILogger<SignalService> logger)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("DefaultConnection string is not configured.");
        _httpClient = httpClient;
        _cache      = cache;
        _logger     = logger;
    }

    public async Task<Signal?> CreateSignalAsync(
        string tenantCode, Guid createdBy, CreateSignalRequest request,
        bool classifyAfterCreate = true, CancellationToken ct = default)
    {
        using var connection = new SqlConnection(_connectionString);

        var p = new DynamicParameters();
        p.Add("@TenantCode",      tenantCode);
        p.Add("@SignalType",      request.SignalType);
        p.Add("@Source",          request.Source);
        p.Add("@Severity",        request.Severity);
        p.Add("@Priority",        request.Priority);
        p.Add("@Title",           request.Title);
        p.Add("@Description",     request.Description);
        p.Add("@Payload",         request.Payload);
        p.Add("@HierarchyNodeId", request.HierarchyNodeId);
        p.Add("@CreatedBy",       createdBy);
        p.Add("@SignalId",        dbType: DbType.Guid, direction: ParameterDirection.Output);

        try
        {
            await connection.ExecuteAsync(
                "analytics.sp_create_signal",
                p,
                commandType: CommandType.StoredProcedure);
        }
        catch (SqlException ex)
        {
            _logger.LogWarning("CreateSignal: SQL error {Number} — {Message}", ex.Number, ex.Message);
            throw new ValidationException(
                "Signal could not be saved. Ensure all fields contain characters supported by the database.");
        }

        var signalId = p.Get<Guid>("@SignalId");

        await _cache.RemoveByPrefixAsync($"signals:open:{tenantCode}");

        var signal = await GetSignalByIdInternalAsync(connection, signalId, tenantCode);

        if (signal is not null && classifyAfterCreate)
        {
            _ = ClassifyAndPersistAsync(signalId, tenantCode, signal);
        }

        return signal;
    }

    public async Task<IEnumerable<Signal>> GetOpenSignalsAsync(
        string tenantCode, int topN = 50, byte? minSeverity = null,
        string? signalType = null, CancellationToken ct = default)
    {
        var cacheKey = $"signals:open:{tenantCode}:{topN}:{minSeverity}:{signalType}";
        var cached   = await _cache.GetAsync<List<Signal>>(cacheKey);
        if (cached is not null) return cached;

        using var connection = new SqlConnection(_connectionString);

        var p = new DynamicParameters();
        p.Add("@TenantCode",  tenantCode);
        p.Add("@TopN",        topN);
        p.Add("@MinSeverity", minSeverity);
        p.Add("@SignalType",  signalType);

        var results = (await connection.QueryAsync<Signal>(
            "analytics.sp_get_open_signals",
            p,
            commandType: CommandType.StoredProcedure)).AsList();

        await _cache.SetAsync(cacheKey, results, OpenSignalsCacheTtl);
        return results;
    }

    public async Task<SignalDetails?> GetSignalDetailsAsync(
        Guid signalId, string tenantCode, CancellationToken ct = default)
    {
        using var connection = new SqlConnection(_connectionString);

        var p = new DynamicParameters();
        p.Add("@SignalId",   signalId);
        p.Add("@TenantCode", tenantCode);

        using var multi = await connection.QueryMultipleAsync(
            "analytics.sp_get_signal_details",
            p,
            commandType: CommandType.StoredProcedure);

        var signal = await multi.ReadFirstOrDefaultAsync<SignalDetails>();
        if (signal is null) return null;

        signal.Comments = (await multi.ReadAsync<SignalComment>()).AsList();
        signal.Tags     = (await multi.ReadAsync<SignalTag>()).AsList();

        return signal;
    }

    public async Task<Signal?> UpdateSignalStatusAsync(
        Guid signalId, string tenantCode, string newStatus, Guid updatedBy,
        string? resolutionNotes = null, CancellationToken ct = default)
    {
        using var connection = new SqlConnection(_connectionString);

        var p = new DynamicParameters();
        p.Add("@SignalId",        signalId);
        p.Add("@TenantCode",      tenantCode);
        p.Add("@NewStatus",       newStatus);
        p.Add("@ResolutionNotes", resolutionNotes);
        p.Add("@UpdatedBy",       updatedBy);

        var result = await connection.QueryFirstOrDefaultAsync<Signal>(
            "analytics.sp_update_signal_status",
            p,
            commandType: CommandType.StoredProcedure);

        if (result is not null)
            await _cache.RemoveByPrefixAsync($"signals:open:{tenantCode}");

        return result;
    }

    public async Task<Signal?> AssignSignalAsync(
        Guid signalId, string tenantCode, Guid assignToUserId, Guid assignedBy,
        CancellationToken ct = default)
    {
        using var connection = new SqlConnection(_connectionString);

        var p = new DynamicParameters();
        p.Add("@SignalId",       signalId);
        p.Add("@TenantCode",     tenantCode);
        p.Add("@AssignToUserId", assignToUserId);
        p.Add("@AssignedBy",     assignedBy);

        var result = await connection.QueryFirstOrDefaultAsync<Signal>(
            "analytics.sp_assign_signal",
            p,
            commandType: CommandType.StoredProcedure);

        if (result is not null)
            await _cache.RemoveByPrefixAsync($"signals:open:{tenantCode}");

        return result;
    }

    public async Task<SignalComment?> AddCommentAsync(
        Guid signalId, string tenantCode, string commentText,
        Guid createdBy, bool isInternal = true, CancellationToken ct = default)
    {
        using var connection = new SqlConnection(_connectionString);

        var p = new DynamicParameters();
        p.Add("@SignalId",    signalId);
        p.Add("@TenantCode",  tenantCode);
        p.Add("@CommentText", commentText);
        p.Add("@IsInternal",  isInternal);
        p.Add("@CreatedBy",   createdBy);

        return await connection.QueryFirstOrDefaultAsync<SignalComment>(
            "analytics.sp_add_signal_comment",
            p,
            commandType: CommandType.StoredProcedure);
    }

    public async Task<ClassificationResult> ClassifySignalAsync(
        Guid signalId, string tenantCode, CancellationToken ct = default)
    {
        var details = await GetSignalDetailsAsync(signalId, tenantCode, ct);
        if (details is null)
            return RulesClassifier.Classify(string.Empty, string.Empty, "MEDIUM");

        var result = await TryMlClassifyAsync(details, tenantCode, ct)
                  ?? RulesClassifier.Classify(details.Title, details.Source, details.Priority);

        await ClassifyAndPersistAsync(signalId, tenantCode, details, result);

        return result;
    }

    public async Task<IEnumerable<Signal>> GetAssignedSignalsAsync(
        string tenantCode, Guid assignedToUserId, int topN = 50,
        CancellationToken ct = default)
    {
        using var connection = new SqlConnection(_connectionString);

        var p = new DynamicParameters();
        p.Add("@TenantCode", tenantCode);
        p.Add("@TopN",       topN * 3);

        var all = await connection.QueryAsync<Signal>(
            "analytics.sp_get_open_signals",
            p,
            commandType: CommandType.StoredProcedure);

        return all.Where(s => s.AssignedTo == assignedToUserId).Take(topN);
    }

    public async Task<IEnumerable<SignalAggregation>> GetAggregationsAsync(
        string tenantCode, string periodType = "DAY", int lastN = 30,
        CancellationToken ct = default)
    {
        var cacheKey = $"signals:agg:{tenantCode}:{periodType}:{lastN}";
        var cached   = await _cache.GetAsync<List<SignalAggregation>>(cacheKey);
        if (cached is not null) return cached;

        using var connection = new SqlConnection(_connectionString);

        var p = new DynamicParameters();
        p.Add("@TenantCode", tenantCode);
        p.Add("@PeriodType", periodType);
        p.Add("@LastN",      lastN);

        var results = (await connection.QueryAsync<SignalAggregation>(
            "analytics.sp_get_signal_aggregations",
            p,
            commandType: CommandType.StoredProcedure)).AsList();

        await _cache.SetAsync(cacheKey, results, AggregationCacheTtl);
        return results;
    }

    private async Task<Signal?> GetSignalByIdInternalAsync(
        IDbConnection connection, Guid signalId, string tenantCode)
    {
        var p = new DynamicParameters();
        p.Add("@SignalId",   signalId);
        p.Add("@TenantCode", tenantCode);

        using var multi = await connection.QueryMultipleAsync(
            "analytics.sp_get_signal_details",
            p,
            commandType: CommandType.StoredProcedure);

        return await multi.ReadFirstOrDefaultAsync<Signal>();
    }

    private async Task<ClassificationResult?> TryMlClassifyAsync(
        Signal signal, string tenantCode, CancellationToken ct)
    {
        try
        {
            var query = $"{signal.Title} {signal.Description}".Trim();
            var body  = JsonSerializer.Serialize(new MlSearchRequest
            {
                query       = query,
                tenant_code = tenantCode,
                top_k       = 3
            }, JsonOpts);

            using var response = await _httpClient.PostAsync(
                "/search",
                new StringContent(body, Encoding.UTF8, "application/json"),
                ct);

            if (!response.IsSuccessStatusCode) return null;

            var json   = await response.Content.ReadAsStringAsync(ct);
            var mlResp = JsonSerializer.Deserialize<MlSearchResponse>(json, JsonOpts);

            if (mlResp?.results is not { Count: > 0 }) return null;

            var top  = mlResp.results[0];
            var alts = mlResp.results
                .Skip(1)
                .Select(r => new AlternativeClassification
                {
                    Classification = r.error_code ?? r.error_name ?? "UNKNOWN",
                    Confidence     = r.similarity_score
                })
                .ToList();

            return new ClassificationResult
            {
                Classification    = top.error_code ?? top.error_name ?? "UNKNOWN",
                Confidence        = top.similarity_score,
                SuggestedPriority = MapSeverityToPriority(signal.Severity),
                RecommendedAction = top.error_description,
                IsFromMl          = true,
                SuggestedNodeId   = null,
                Alternatives      = alts
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "ML classification unavailable for signal {SignalId}; using rules fallback.", signal.SignalId);
            return null;
        }
    }

    private async Task ClassifyAndPersistAsync(
        Guid signalId, string tenantCode, Signal signal,
        ClassificationResult? result = null)
    {
        try
        {
            result ??= await TryMlClassifyAsync(signal, tenantCode, CancellationToken.None)
                    ?? RulesClassifier.Classify(signal.Title, signal.Source, signal.Priority);

            var mlJson = JsonSerializer.Serialize(result, JsonOpts);

            using var connection = new SqlConnection(_connectionString);
            var p = new DynamicParameters();
            p.Add("@SignalId",          signalId);
            p.Add("@TenantCode",        tenantCode);
            p.Add("@MlOutputsJson",     mlJson);
            p.Add("@SuggestedPriority", result.SuggestedPriority);
            p.Add("@SuggestedNodeId",   result.SuggestedNodeId);

            await connection.ExecuteAsync(
                "analytics.sp_update_ml_outputs",
                p,
                commandType: CommandType.StoredProcedure);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to persist ML outputs for signal {SignalId}.", signalId);
        }
    }

    private static string MapSeverityToPriority(byte severity) => severity switch
    {
        1 => "CRITICAL",
        2 => "HIGH",
        3 => "MEDIUM",
        _ => "LOW"
    };
}

internal static class RulesClassifier
{
    private static readonly (string[] Keywords, string Classification, string Action)[] Rules =
    [
        (["biometric","fingerprint","face","liveness","k-100","k100"],
            "BIOMETRIC_FAILURE",
            "Check biometric device drivers and recalibrate scanner"),

        (["timeout","connection","network","unreachable","503","504","607"],
            "NETWORK_CONNECTIVITY",
            "Check network path to target service and review firewall rules"),

        (["cibil","credit","score","bureau","cibil-low"],
            "CREDIT_CHECK_FAILURE",
            "Review customer credit profile and applicable loan policy thresholds"),

        (["otp","sms","mobile","phone","enach","mandate"],
            "OTP_OR_MANDATE_FAILURE",
            "Verify mobile number and check SMS gateway provider status"),

        (["kyc","document","pan","aadhaar","id","verification"],
            "KYC_VERIFICATION_FAILURE",
            "Request fresh documents from customer and retry verification"),

        (["auth","token","jwt","unauthorized","401","403"],
            "AUTHENTICATION_ERROR",
            "Check token validity and re-authenticate"),
    ];

    public static ClassificationResult Classify(string title, string source, string currentPriority)
    {
        var text = $"{title} {source}".ToLowerInvariant();

        foreach (var (keywords, classification, action) in Rules)
        {
            if (keywords.Any(k => text.Contains(k)))
            {
                return new ClassificationResult
                {
                    Classification    = classification,
                    Confidence        = 0.72,
                    SuggestedPriority = currentPriority,
                    RecommendedAction = action,
                    IsFromMl          = false
                };
            }
        }

        return new ClassificationResult
        {
            Classification    = "UNCLASSIFIED",
            Confidence        = 0.0,
            SuggestedPriority = currentPriority,
            RecommendedAction = "Manual review required — no matching rule found.",
            IsFromMl          = false
        };
    }
}

file sealed class MlSearchRequest
{
    public string query       { get; set; } = string.Empty;
    public string tenant_code { get; set; } = string.Empty;
    public int    top_k       { get; set; } = 3;
}

file sealed class MlSearchResponse
{
    public List<MlSearchResult> results { get; set; } = [];
}

file sealed class MlSearchResult
{
    public string? error_code        { get; set; }
    public string? error_name        { get; set; }
    public double  similarity_score  { get; set; }
    public string? error_description { get; set; }
}
