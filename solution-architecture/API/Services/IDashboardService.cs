using EnterpriseChatbot.API.Models;

namespace EnterpriseChatbot.API.Services;

public interface IDashboardService
{
    Task<Layout?> CreateLayoutAsync(Guid userId, string tenantCode, CreateLayoutRequest request,
        CancellationToken ct = default);

    Task<IEnumerable<Layout>> GetUserLayoutsAsync(Guid userId, string tenantCode,
        bool includeShared = true, CancellationToken ct = default);

    Task<LayoutDetails?> GetLayoutDetailsAsync(Guid layoutId, Guid userId,
        CancellationToken ct = default);

    Task<Widget?> AddWidgetAsync(Guid userId, string tenantCode, AddWidgetRequest request,
        CancellationToken ct = default);

    Task<Widget?> UpdateWidgetPositionAsync(Guid widgetId, Guid userId, string tenantCode,
        string newPositionJson, CancellationToken ct = default);

    Task<Widget?> UpdateWidgetConfigAsync(Guid widgetId, Guid userId, string tenantCode,
        UpdateWidgetRequest request, CancellationToken ct = default);

    Task<bool> DeleteWidgetAsync(Guid widgetId, Guid userId, string tenantCode,
        CancellationToken ct = default);

    Task<bool> DeleteLayoutAsync(Guid layoutId, Guid userId, string tenantCode,
        CancellationToken ct = default);

    Task<LayoutShare?> ShareLayoutAsync(Guid layoutId, Guid sharedByUserId, string tenantCode,
        ShareLayoutRequest request, CancellationToken ct = default);

    Task<IEnumerable<WidgetTemplate>> GetWidgetTemplatesAsync(string? category = null,
        bool premiumOk = false, CancellationToken ct = default);
}
