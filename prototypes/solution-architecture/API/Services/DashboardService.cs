using System.Data;
using System.Text.Json;
using Dapper;
using EnterpriseChatbot.API.Exceptions;
using EnterpriseChatbot.API.Models;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace EnterpriseChatbot.API.Services;

public class DashboardService : IDashboardService
{
    private readonly string        _connectionString;
    private readonly ICacheService _cache;
    private readonly ILogger<DashboardService> _logger;

    private static readonly TimeSpan LayoutListTtl    = TimeSpan.FromMinutes(2);
    private static readonly TimeSpan LayoutDetailsTtl = TimeSpan.FromMinutes(1);
    private static readonly TimeSpan TemplatesTtl     = TimeSpan.FromMinutes(30);

    public DashboardService(
        IConfiguration configuration,
        ICacheService  cache,
        ILogger<DashboardService> logger)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("DefaultConnection string is not configured.");
        _cache  = cache;
        _logger = logger;
    }

    public async Task<Layout?> CreateLayoutAsync(
        Guid userId,
        string tenantCode,
        CreateLayoutRequest request,
        CancellationToken ct = default)
    {
        using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(ct);

        // Serializable transaction + UPDLOCK prevents concurrent requests from
        // racing past the 5-layout guard and also enforces unique layout names.
        using var tx = await connection.BeginTransactionAsync(IsolationLevel.Serializable, ct);

        try
        {
            // Atomically check the layout count and uniqueness under lock
            var countRow = await connection.QueryFirstOrDefaultAsync<(int Count, int NameExists)>(
                @"SELECT
                    COUNT(*)                                                     AS Count,
                    SUM(CASE WHEN layout_name = @LayoutName THEN 1 ELSE 0 END)  AS NameExists
                  FROM dashboard.layouts WITH (UPDLOCK, HOLDLOCK)
                  WHERE user_id = @UserId AND is_active = 1",
                new { UserId = userId, LayoutName = request.LayoutName },
                transaction: tx);

            if (countRow.NameExists > 0)
            {
                await tx.RollbackAsync(ct);
                throw new ArgumentException($"A layout named '{request.LayoutName}' already exists.");
            }

            if (countRow.Count >= 5)
            {
                await tx.RollbackAsync(ct);
                _logger.LogWarning("User {UserId} hit the 5-layout limit for tenant {Tenant}.", userId, tenantCode);
                return null;
            }

            var p = new DynamicParameters();
            p.Add("@UserId",      userId);
            p.Add("@TenantCode",  tenantCode);
            p.Add("@LayoutName",  request.LayoutName);
            p.Add("@Description", request.Description);
            p.Add("@GridConfig",  request.GridConfig);
            p.Add("@IsDefault",   request.IsDefault);
            p.Add("@IsPublic",    request.IsPublic);
            p.Add("@LayoutId",    dbType: DbType.Guid, direction: ParameterDirection.Output);

            await connection.ExecuteAsync(
                "dashboard.sp_create_layout",
                p,
                commandType: CommandType.StoredProcedure,
                transaction: tx);

            var layoutId = p.Get<Guid>("@LayoutId");
            await tx.CommitAsync(ct);

            await InvalidateLayoutCacheAsync(tenantCode, userId);
            return await GetLayoutByIdAsync(connection, layoutId, userId);
        }
        catch (SqlException ex) when (ex.Message.Contains("Maximum of 5 layouts"))
        {
            await tx.RollbackAsync(ct);
            _logger.LogWarning("User {UserId} hit the 5-layout limit for tenant {Tenant}.", userId, tenantCode);
            return null;
        }
        catch (ArgumentException)
        {
            // Already rolled back above; re-throw so the controller can return 400
            throw;
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
    }

    public async Task<IEnumerable<Layout>> GetUserLayoutsAsync(
        Guid userId, string tenantCode, bool includeShared = true,
        CancellationToken ct = default)
    {
        var cacheKey = $"dashboard:layouts:{tenantCode}:{userId}:{includeShared}";
        var cached   = await _cache.GetAsync<List<Layout>>(cacheKey);
        if (cached is not null) return cached;

        using var connection = new SqlConnection(_connectionString);

        var p = new DynamicParameters();
        p.Add("@UserId",        userId);
        p.Add("@TenantCode",    tenantCode);
        p.Add("@IncludeShared", includeShared);

        var results = (await connection.QueryAsync<Layout>(
            "dashboard.sp_get_user_layouts",
            p,
            commandType: CommandType.StoredProcedure)).AsList();

        await _cache.SetAsync(cacheKey, results, LayoutListTtl);
        return results;
    }

    public async Task<LayoutDetails?> GetLayoutDetailsAsync(
        Guid layoutId, Guid userId, CancellationToken ct = default)
    {
        var cacheKey = $"dashboard:layout:{layoutId}:{userId}";
        var cached   = await _cache.GetAsync<LayoutDetails>(cacheKey);
        if (cached is not null) return cached;

        using var connection = new SqlConnection(_connectionString);

        var p = new DynamicParameters();
        p.Add("@LayoutId", layoutId);
        p.Add("@UserId",   userId);

        using var multi = await connection.QueryMultipleAsync(
            "dashboard.sp_get_layout_details",
            p,
            commandType: CommandType.StoredProcedure);

        var layout = await multi.ReadFirstOrDefaultAsync<LayoutDetails>();
        if (layout is null) return null;

        layout.Widgets = (await multi.ReadAsync<Widget>()).AsList();

        await _cache.SetAsync(cacheKey, layout, LayoutDetailsTtl);
        return layout;
    }

    public async Task<Widget?> AddWidgetAsync(
        Guid userId, string tenantCode, AddWidgetRequest request,
        CancellationToken ct = default)
    {
        if (!TryValidatePosition(request.Position, out var posError))
        {
            _logger.LogWarning("AddWidget: invalid position JSON — {Error}", posError);
            return null;
        }

        if (request.Config is not null && !IsValidJson(request.Config))
        {
            _logger.LogWarning("AddWidget: invalid config JSON.");
            return null;
        }

        using var connection = new SqlConnection(_connectionString);

        var p = new DynamicParameters();
        p.Add("@LayoutId",     request.LayoutId);
        p.Add("@UserId",       userId);
        p.Add("@TenantCode",   tenantCode);
        p.Add("@WidgetType",   request.WidgetType);
        p.Add("@Title",        request.Title);
        p.Add("@Position",     request.Position);
        p.Add("@Config",       request.Config);
        p.Add("@DisplayOrder", request.DisplayOrder);
        p.Add("@WidgetId",     dbType: DbType.Guid, direction: ParameterDirection.Output);

        await connection.ExecuteAsync(
            "dashboard.sp_add_widget",
            p,
            commandType: CommandType.StoredProcedure);

        var widgetId = p.Get<Guid>("@WidgetId");
        await InvalidateLayoutDetailsCacheAsync(request.LayoutId, userId);

        return await connection.QueryFirstOrDefaultAsync<Widget>(
            @"SELECT widget_id AS WidgetId, layout_id AS LayoutId, widget_type AS WidgetType,
                     title AS Title, position AS Position, config AS Config,
                     is_locked AS IsLocked, is_visible AS IsVisible,
                     display_order AS DisplayOrder, created_at AS CreatedAt
              FROM dashboard.widgets WHERE widget_id = @widgetId",
            new { widgetId });
    }

    public async Task<Widget?> UpdateWidgetPositionAsync(
        Guid widgetId, Guid userId, string tenantCode,
        string newPositionJson, CancellationToken ct = default)
    {
        if (!TryValidatePosition(newPositionJson, out var posError))
        {
            _logger.LogWarning("UpdateWidgetPosition: invalid position — {Error}", posError);
            return null;
        }

        using var connection = new SqlConnection(_connectionString);

        var p = new DynamicParameters();
        p.Add("@WidgetId",    widgetId);
        p.Add("@UserId",      userId);
        p.Add("@TenantCode",  tenantCode);
        p.Add("@NewPosition", newPositionJson);

        var result = await connection.QueryFirstOrDefaultAsync<Widget>(
            "dashboard.sp_update_widget_position",
            p,
            commandType: CommandType.StoredProcedure);

        if (result is not null)
        {
            var layoutId = await GetWidgetLayoutIdAsync(connection, widgetId);
            if (layoutId != Guid.Empty)
                await InvalidateLayoutDetailsCacheAsync(layoutId, userId);
        }

        return result;
    }

    public async Task<Widget?> UpdateWidgetConfigAsync(
        Guid widgetId, Guid userId, string tenantCode,
        UpdateWidgetRequest request, CancellationToken ct = default)
    {
        if (request.Position is not null && !TryValidatePosition(request.Position, out var posErr))
        {
            _logger.LogWarning("UpdateWidgetConfig: invalid position — {Error}", posErr);
            return null;
        }

        if (request.Config is not null && !IsValidJson(request.Config))
        {
            _logger.LogWarning("UpdateWidgetConfig: invalid config JSON.");
            return null;
        }

        using var connection = new SqlConnection(_connectionString);

        var p = new DynamicParameters();
        p.Add("@WidgetId",   widgetId);
        p.Add("@UserId",     userId);
        p.Add("@TenantCode", tenantCode);
        p.Add("@Title",      request.Title);
        p.Add("@Config",     request.Config);
        p.Add("@IsVisible",  request.IsVisible);
        p.Add("@IsLocked",   request.IsLocked);

        var result = await connection.QueryFirstOrDefaultAsync<Widget>(
            "dashboard.sp_update_widget_config",
            p,
            commandType: CommandType.StoredProcedure);

        if (result is not null)
        {
            if (request.Position is not null)
            {
                var pp = new DynamicParameters();
                pp.Add("@WidgetId",    widgetId);
                pp.Add("@UserId",      userId);
                pp.Add("@TenantCode",  tenantCode);
                pp.Add("@NewPosition", request.Position);

                await connection.ExecuteAsync(
                    "dashboard.sp_update_widget_position",
                    pp,
                    commandType: CommandType.StoredProcedure);
            }

            var layoutId = await GetWidgetLayoutIdAsync(connection, widgetId);
            if (layoutId != Guid.Empty)
                await InvalidateLayoutDetailsCacheAsync(layoutId, userId);
        }

        return result;
    }

    public async Task<bool> DeleteWidgetAsync(
        Guid widgetId, Guid userId, string tenantCode,
        CancellationToken ct = default)
    {
        using var connection = new SqlConnection(_connectionString);

        var layoutId = await GetWidgetLayoutIdAsync(connection, widgetId);

        var p = new DynamicParameters();
        p.Add("@WidgetId",   widgetId);
        p.Add("@UserId",     userId);
        p.Add("@TenantCode", tenantCode);

        var result = await connection.QueryFirstOrDefaultAsync<dynamic>(
            "dashboard.sp_delete_widget",
            p,
            commandType: CommandType.StoredProcedure);

        if (result is not null && layoutId != Guid.Empty)
            await InvalidateLayoutDetailsCacheAsync(layoutId, userId);

        return result is not null;
    }

    public async Task<bool> DeleteLayoutAsync(
        Guid layoutId, Guid userId, string tenantCode,
        CancellationToken ct = default)
    {
        using var connection = new SqlConnection(_connectionString);

        var p = new DynamicParameters();
        p.Add("@LayoutId",   layoutId);
        p.Add("@UserId",     userId);
        p.Add("@TenantCode", tenantCode);

        dynamic? result;
        try
        {
            result = await connection.QueryFirstOrDefaultAsync<dynamic>(
                "dashboard.sp_delete_layout",
                p,
                commandType: CommandType.StoredProcedure);
        }
        catch (SqlException ex)
        {
            _logger.LogWarning("DeleteLayout: SQL error {Number} for layout {LayoutId} — {Message}",
                ex.Number, layoutId, ex.Message);
            return false;
        }

        if (result is not null)
        {
            await InvalidateLayoutCacheAsync(tenantCode, userId);
            await _cache.RemoveAsync($"dashboard:layout:{layoutId}:{userId}");
        }

        return result is not null;
    }

    public async Task<LayoutShare?> ShareLayoutAsync(
        Guid layoutId, Guid sharedByUserId, string tenantCode,
        ShareLayoutRequest request, CancellationToken ct = default)
    {
        using var connection = new SqlConnection(_connectionString);

        var p = new DynamicParameters();
        p.Add("@LayoutId",         layoutId);
        p.Add("@SharedByUserId",   sharedByUserId);
        p.Add("@SharedWithUserId", request.SharedWithUserId);
        p.Add("@TenantCode",       tenantCode);
        p.Add("@PermissionLevel",  request.PermissionLevel);

        return await connection.QueryFirstOrDefaultAsync<LayoutShare>(
            "dashboard.sp_share_layout",
            p,
            commandType: CommandType.StoredProcedure);
    }

    public async Task<IEnumerable<WidgetTemplate>> GetWidgetTemplatesAsync(
        string? category = null, bool premiumOk = false,
        CancellationToken ct = default)
    {
        var cacheKey = $"dashboard:templates:{category}:{premiumOk}";
        var cached   = await _cache.GetAsync<List<WidgetTemplate>>(cacheKey);
        if (cached is not null) return cached;

        using var connection = new SqlConnection(_connectionString);

        const string sql = """
            SELECT
                template_id      AS TemplateId,
                template_name    AS TemplateName,
                widget_type      AS WidgetType,
                category         AS Category,
                description      AS Description,
                default_config   AS DefaultConfig,
                default_position AS DefaultPosition,
                is_premium       AS IsPremium,
                is_active        AS IsActive
            FROM dashboard.widget_templates
            WHERE is_active = 1
              AND (@Category  IS NULL OR category   = @Category)
              AND (@PremiumOk = 1     OR is_premium = 0)
            ORDER BY category, template_name;
            """;

        var results = (await connection.QueryAsync<WidgetTemplate>(
            sql,
            new { Category = category, PremiumOk = premiumOk })).AsList();

        await _cache.SetAsync(cacheKey, results, TemplatesTtl);
        return results;
    }

    private async Task<Layout?> GetLayoutByIdAsync(IDbConnection connection, Guid layoutId, Guid userId)
    {
        return await connection.QueryFirstOrDefaultAsync<Layout>(
            """
            SELECT
                l.layout_id     AS LayoutId,
                l.user_id       AS UserId,
                l.tenant_id     AS TenantId,
                l.layout_name   AS LayoutName,
                l.description   AS Description,
                l.grid_config   AS GridConfig,
                l.is_default    AS IsDefault,
                l.is_public     AS IsPublic,
                l.display_order AS DisplayOrder,
                l.created_at    AS CreatedAt,
                l.updated_at    AS UpdatedAt,
                CAST(CASE WHEN l.user_id = @UserId THEN 1 ELSE 0 END AS BIT) AS IsOwner,
                'EDIT'          AS PermissionLevel,
                u.full_name     AS OwnerName,
                (SELECT COUNT(*) FROM dashboard.widgets w WHERE w.layout_id = l.layout_id) AS WidgetCount
            FROM dashboard.layouts l
            INNER JOIN infrastructure.users u ON l.user_id = u.user_id
            WHERE l.layout_id = @LayoutId
            """,
            new { LayoutId = layoutId, UserId = userId });
    }

    private static async Task<Guid> GetWidgetLayoutIdAsync(IDbConnection connection, Guid widgetId)
    {
        return await connection.QueryFirstOrDefaultAsync<Guid>(
            "SELECT layout_id FROM dashboard.widgets WHERE widget_id = @widgetId",
            new { widgetId });
    }

    private async Task InvalidateLayoutCacheAsync(string tenantCode, Guid userId)
    {
        await _cache.RemoveByPrefixAsync($"dashboard:layouts:{tenantCode}:{userId}");
    }

    private async Task InvalidateLayoutDetailsCacheAsync(Guid layoutId, Guid userId)
    {
        await _cache.RemoveAsync($"dashboard:layout:{layoutId}:{userId}");
    }

    private static bool TryValidatePosition(string json, out string error)
    {
        error = string.Empty;
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            if (!root.TryGetProperty("row",    out _)) { error = "Missing 'row'";    return false; }
            if (!root.TryGetProperty("col",    out _)) { error = "Missing 'col'";    return false; }
            if (!root.TryGetProperty("width",  out var w)) { error = "Missing 'width'";  return false; }
            if (!root.TryGetProperty("height", out var h)) { error = "Missing 'height'"; return false; }

            int width  = w.GetInt32();
            int height = h.GetInt32();

            if (width  < 1 || width  > 12) { error = "width must be 1–12";  return false; }
            if (height < 1 || height > 20) { error = "height must be 1–20"; return false; }

            return true;
        }
        catch (JsonException ex)
        {
            error = ex.Message;
            return false;
        }
    }

    private static bool IsValidJson(string json)
    {
        try { using var _ = JsonDocument.Parse(json); return true; }
        catch (JsonException) { return false; }
    }
}
