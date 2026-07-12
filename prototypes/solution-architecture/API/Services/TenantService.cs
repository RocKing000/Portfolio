using Dapper;
using EnterpriseChatbot.API.Data;
using EnterpriseChatbot.API.Exceptions;
using EnterpriseChatbot.API.Models.Domain;

namespace EnterpriseChatbot.API.Services;

public interface ITenantService
{
    Task<IEnumerable<Tenant>> GetAllTenantsAsync();
    Task<Tenant> GetTenantAsync(string tenantCode);
}

public class TenantService : ITenantService
{
    private readonly IDbConnectionFactory _db;

    public TenantService(IDbConnectionFactory db)
    {
        _db = db;
    }

    public async Task<IEnumerable<Tenant>> GetAllTenantsAsync()
    {
        using var conn = _db.CreateConnection();
        return await conn.QueryAsync<Tenant>(@"
            SELECT tenant_id, tenant_code, tenant_name, contact_email, is_active, created_at
            FROM infrastructure.tenants
            ORDER BY tenant_name");
    }

    public async Task<Tenant> GetTenantAsync(string tenantCode)
    {
        using var conn = _db.CreateConnection();
        var tenant = await conn.QuerySingleOrDefaultAsync<Tenant>(@"
            SELECT tenant_id, tenant_code, tenant_name, contact_email, is_active, created_at
            FROM infrastructure.tenants
            WHERE tenant_code = @TenantCode",
            new { TenantCode = tenantCode });

        return tenant ?? throw new NotFoundException($"Tenant '{tenantCode}' not found");
    }
}
