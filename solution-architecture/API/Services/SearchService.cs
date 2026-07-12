using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Dapper;
using EnterpriseChatbot.API.Data;
using Microsoft.Extensions.Logging;

namespace EnterpriseChatbot.API.Services
{
    // Model returned from AI Search
    public class ErrorSearchResult
    {
        public string ErrorId { get; set; } = string.Empty;
        public string ErrorCode { get; set; } = string.Empty;
        public string ErrorTitle { get; set; } = string.Empty;
        public string ErrorDescription { get; set; } = string.Empty;
        public string Solution { get; set; } = string.Empty;
        public string? RootCause { get; set; }
        public string Severity { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string? ModuleName { get; set; }
        public string? ProductName { get; set; }
        public double SimilarityScore { get; set; }
    }
    
    public interface ISearchService
    {
        Task<IEnumerable<ErrorSearchResult>> SearchAsync(string tenantCode, string query, string? userId = null);
    }
    
    public class SearchService : ISearchService
    {
        private readonly HttpClient _httpClient;
        private readonly IDbConnectionFactory _dbFactory;
        private readonly ILogger<SearchService> _logger;
        private const string PythonApiUrl = "http://localhost:8000";

        public SearchService(
            IHttpClientFactory httpClientFactory,
            IDbConnectionFactory dbFactory,
            ILogger<SearchService> logger)
        {
            _httpClient = httpClientFactory.CreateClient();
            _httpClient.Timeout = TimeSpan.FromSeconds(30);
            _dbFactory = dbFactory;
            _logger    = logger;
        }

        public async Task<IEnumerable<ErrorSearchResult>> SearchAsync(
            string tenantCode,
            string query,
            string? userId = null)
        {
            var sw = Stopwatch.StartNew();
            List<ErrorSearchResult> results;

            try
            {
                _logger.LogInformation(
                    "Calling Python AI Search: Query='{Query}', Tenant='{TenantCode}'", query, tenantCode);

                var request = new { query, tenant_code = tenantCode, max_results = 5 };
                var response = await _httpClient.PostAsJsonAsync($"{PythonApiUrl}/search", request);

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("Python AI Search failed: {StatusCode}", response.StatusCode);
                    results = new List<ErrorSearchResult>();
                }
                else
                {
                    var parsed = await response.Content.ReadFromJsonAsync<PythonSearchResponse>();
                    if (parsed == null || !parsed.Success)
                    {
                        _logger.LogWarning("Python AI Search returned no results");
                        results = new List<ErrorSearchResult>();
                    }
                    else
                    {
                        _logger.LogInformation(
                            "Python AI Search returned {Count} results in {Time}ms",
                            parsed.TotalResults, parsed.ProcessingTimeMs);

                        results = parsed.Results.Select(r => new ErrorSearchResult
                        {
                            ErrorId          = r.ErrorId,
                            ErrorCode        = r.ErrorCode,
                            ErrorTitle       = r.ErrorTitle,
                            ErrorDescription = r.ErrorDescription ?? string.Empty,
                            Solution         = r.Solution         ?? string.Empty,
                            RootCause        = r.RootCause,
                            Severity         = r.Severity,
                            Category         = r.Category         ?? string.Empty,
                            ModuleName       = r.ModuleName,
                            ProductName      = r.ProductName,
                            SimilarityScore  = r.SimilarityScore
                        }).ToList();
                    }
                }
            }
            catch (HttpRequestException ex)
            {
                _logger.LogError(ex, "Failed to connect to Python AI Search service at {Url}", PythonApiUrl);
                results = new List<ErrorSearchResult>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in AI Search");
                results = new List<ErrorSearchResult>();
            }

            sw.Stop();
            await LogSearchAsync(tenantCode, query, userId, results, (int)sw.ElapsedMilliseconds);
            return results;
        }

        private async Task LogSearchAsync(
            string tenantCode,
            string query,
            string? userId,
            List<ErrorSearchResult> results,
            int durationMs)
        {
            try
            {
                using var conn = _dbFactory.CreateConnection();

                var tenantId = await conn.QuerySingleOrDefaultAsync<Guid?>(
                    "SELECT tenant_id FROM infrastructure.tenants WHERE tenant_code = @TenantCode AND is_active = 1",
                    new { TenantCode = tenantCode });

                if (tenantId == null) return;

                Guid? userGuid = Guid.TryParse(userId, out var g) ? g : null;
                var searchId  = Guid.NewGuid();

                await conn.ExecuteAsync(@"
                    INSERT INTO analytics.search_log
                        (search_id, tenant_id, user_id, search_query, normalized_query,
                         result_count, search_duration_ms, searched_at)
                    VALUES
                        (@SearchId, @TenantId, @UserId, @Query, @NormalizedQuery,
                         @ResultCount, @DurationMs, GETUTCDATE())",
                    new
                    {
                        SearchId       = searchId,
                        TenantId       = tenantId,
                        UserId         = userGuid,
                        Query          = query,
                        NormalizedQuery = query.ToLowerInvariant().Trim(),
                        ResultCount    = results.Count,
                        DurationMs     = durationMs
                    });

                foreach (var r in results.Where(r => !string.IsNullOrWhiteSpace(r.ErrorCode)))
                {
                    await conn.ExecuteAsync(@"
                        INSERT INTO analytics.search_result_log
                            (search_id, tenant_id, error_code, error_name, similarity_score, logged_at)
                        VALUES
                            (@SearchId, @TenantId, @ErrorCode, @ErrorName, @Score, GETUTCDATE())",
                        new
                        {
                            SearchId  = searchId,
                            TenantId  = tenantId,
                            ErrorCode = r.ErrorCode,
                            ErrorName = r.ErrorTitle,
                            Score     = r.SimilarityScore
                        });
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to log search analytics — non-critical, continuing");
            }
        }
    }
    
    // Response models for Python API
    internal class PythonSearchResponse
    {
        [JsonPropertyName("success")]   public bool Success { get; set; }
        [JsonPropertyName("results")]   public List<PythonErrorResult> Results { get; set; } = new();
        [JsonPropertyName("query")]     public string Query { get; set; } = string.Empty;
        [JsonPropertyName("total_results")]    public int TotalResults { get; set; }
        [JsonPropertyName("processing_time_ms")] public double ProcessingTimeMs { get; set; }
        [JsonPropertyName("cached")]    public bool Cached { get; set; }
    }

    internal class PythonErrorResult
    {
        [JsonPropertyName("error_id")]          public string ErrorId { get; set; } = string.Empty;
        [JsonPropertyName("error_code")]        public string ErrorCode { get; set; } = string.Empty;
        [JsonPropertyName("error_title")]       public string ErrorTitle { get; set; } = string.Empty;
        [JsonPropertyName("error_description")] public string ErrorDescription { get; set; } = string.Empty;
        [JsonPropertyName("solution")]          public string Solution { get; set; } = string.Empty;
        [JsonPropertyName("root_cause")]        public string? RootCause { get; set; }
        [JsonPropertyName("severity")]          public string Severity { get; set; } = string.Empty;
        [JsonPropertyName("category")]          public string Category { get; set; } = string.Empty;
        [JsonPropertyName("similarity_score")]  public double SimilarityScore { get; set; }
        [JsonPropertyName("module_name")]       public string? ModuleName { get; set; }
        [JsonPropertyName("product_name")]      public string? ProductName { get; set; }
    }
}