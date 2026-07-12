using System.Data;
using Dapper;
using EnterpriseChatbot.API.Data;
using EnterpriseChatbot.API.Models;

namespace EnterpriseChatbot.API.Services;

public interface IHierarchyService
{
    Task<IEnumerable<ErrorHierarchyNode>> GetHierarchyAsync(string tenantCode, int? parentId, string? levelType);
    Task<ErrorHierarchyNode?> GetNodeAsync(int hierarchyId);
}

public class HierarchyService : IHierarchyService
{
    private readonly IDbConnectionFactory _db;
    private readonly ILogger<HierarchyService> _logger;

    public HierarchyService(IDbConnectionFactory db, ILogger<HierarchyService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<IEnumerable<ErrorHierarchyNode>> GetHierarchyAsync(
        string tenantCode, int? parentId, string? levelType)
    {
        _logger.LogInformation("GetHierarchy — tenant: {TenantCode}, parent: {ParentId}, level: {LevelType}",
            tenantCode, parentId, levelType);

        var sql = @"
            SELECT
                CONVERT(NVARCHAR(36), h.node_id)        AS HierarchyId,
                CONVERT(NVARCHAR(36), h.parent_node_id) AS ParentId,
                h.node_type  AS LevelType,
                h.node_name  AS Name,
                h.node_order AS SortOrder,
                h.is_active  AS IsActive,
                COUNT(DISTINCT c.node_id) AS ChildCount
            FROM kb.error_hierarchy h
            LEFT JOIN kb.error_hierarchy c ON c.parent_node_id = h.node_id
            WHERE h.is_active = 1
              AND (@ParentId  IS NULL OR CONVERT(NVARCHAR(36), h.parent_node_id) = @ParentId)
              AND (@LevelType IS NULL OR h.node_type = @LevelType)
            GROUP BY
                h.node_id, h.parent_node_id, h.node_type,
                h.node_name, h.node_order, h.is_active
            ORDER BY h.node_order, h.node_name";

        using var conn = _db.CreateConnection();
        return await conn.QueryAsync<ErrorHierarchyNode>(sql,
            new { ParentId = (string?)null, LevelType = levelType });
    }

    public async Task<ErrorHierarchyNode?> GetNodeAsync(int hierarchyId)
    {
        using var conn = _db.CreateConnection();
        return await conn.QuerySingleOrDefaultAsync<ErrorHierarchyNode>(@"
            SELECT
                CONVERT(NVARCHAR(36), node_id)        AS HierarchyId,
                CONVERT(NVARCHAR(36), parent_node_id) AS ParentId,
                node_type  AS LevelType,
                node_name  AS Name,
                node_order AS SortOrder,
                is_active  AS IsActive,
                0          AS ChildCount
            FROM kb.error_hierarchy
            WHERE node_id = @HierarchyId",
            new { HierarchyId = hierarchyId });
    }
}
