using System.Text.Json;
using Dapper;
using EnterpriseChatbot.API.Models.Config;
using Microsoft.Data.SqlClient;

namespace EnterpriseChatbot.API.Services;

public interface IConfigurationService
{
    Task LoadConfigurationAsync();
    T GetConfig<T>(string key, T defaultValue = default!);
    JwtConfig GetJwtConfig();
    CorsConfig GetCorsConfig();
    ServerConfig GetServerConfig();
    RateLimitConfig GetRateLimitConfig();
    Task ReloadAsync();
}

public class ConfigurationService : IConfigurationService
{
    private readonly string _connectionString;
    private Dictionary<string, (string value, string type)> _cache = [];

    public ConfigurationService(string connectionString)
    {
        _connectionString = connectionString;
    }

    public async Task LoadConfigurationAsync()
    {
        using var conn = new SqlConnection(_connectionString);
        var rows = await conn.QueryAsync<AppConfig>(
            "SELECT config_key, config_value, config_type FROM infrastructure.app_config WHERE is_active = 1"
        );
        _cache = rows.ToDictionary(
            r => r.config_key,
            r => (r.config_value, r.config_type)
        );
    }

    public T GetConfig<T>(string key, T defaultValue = default!)
    {
        if (!_cache.TryGetValue(key, out var entry))
            return defaultValue;

        try
        {
            return entry.type switch
            {
                "number"  => (T)Convert.ChangeType(entry.value, typeof(T)),
                "boolean" => (T)(object)bool.Parse(entry.value),
                "json"    => JsonSerializer.Deserialize<T>(entry.value) ?? defaultValue,
                _         => (T)(object)entry.value
            };
        }
        catch
        {
            return defaultValue;
        }
    }

    public JwtConfig GetJwtConfig() => new()
    {
        Secret         = GetConfig<string>("jwt.secret", string.Empty),
        ExpiresIn      = GetConfig<string>("jwt.expires_in", "24h"),
        RefreshSecret  = GetConfig<string>("jwt.refresh_secret", string.Empty),
        RefreshExpiresIn = GetConfig<string>("jwt.refresh_expires_in", "7d")
    };

    public CorsConfig GetCorsConfig() => new()
    {
        AllowedOrigins   = GetConfig<string[]>("cors.origins", ["http://localhost:4200"]),
        AllowCredentials = GetConfig<bool>("cors.credentials", true)
    };

    public ServerConfig GetServerConfig() => new()
    {
        Port        = GetConfig<int>("server.port", 5000),
        ApiVersion  = GetConfig<string>("server.api_version", "v2"),
        Environment = GetConfig<string>("server.node_env", "development")
    };

    public RateLimitConfig GetRateLimitConfig() => new()
    {
        WindowMs    = GetConfig<int>("rate_limit.window_ms", 900000),
        MaxRequests = GetConfig<int>("rate_limit.max_requests", 100)
    };

    public async Task ReloadAsync() => await LoadConfigurationAsync();
}
