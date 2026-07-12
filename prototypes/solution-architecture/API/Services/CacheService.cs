using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace EnterpriseChatbot.API.Services;

public class CacheService : ICacheService
{
    private readonly IMemoryCache _memory;
    private readonly IDatabase?   _redis;
    private readonly ILogger<CacheService> _logger;

    private static readonly TimeSpan L1Ttl = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan L2Ttl = TimeSpan.FromMinutes(30);

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public CacheService(
        IMemoryCache   memory,
        IServiceProvider services,
        ILogger<CacheService> logger)
    {
        _memory = memory;
        _logger = logger;

        try
        {
            var multiplexer = services.GetService(typeof(IConnectionMultiplexer)) as IConnectionMultiplexer;
            if (multiplexer is { IsConnected: true })
            {
                _redis = multiplexer.GetDatabase();
                _logger.LogInformation("CacheService: Redis L2 tier connected.");
            }
            else
            {
                _logger.LogWarning("CacheService: Redis not available — running on L1 memory cache only.");
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "CacheService: Redis initialisation failed — running on L1 only.");
        }
    }

    public async Task<T?> GetAsync<T>(string key) where T : class
    {
        if (_memory.TryGetValue(key, out T? memValue))
            return memValue;

        if (_redis is not null)
        {
            try
            {
                var raw = await _redis.StringGetAsync(key);
                if (raw.HasValue)
                {
                    var value = JsonSerializer.Deserialize<T>(raw.ToString(), JsonOpts);
                    if (value is not null)
                    {
                        _memory.Set(key, value, L1Ttl);
                        return value;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Redis GET failed for key '{Key}'; falling back to null.", key);
            }
        }

        return null;
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan expiry) where T : class
    {
        _memory.Set(key, value, expiry < L1Ttl ? expiry : L1Ttl);

        if (_redis is not null)
        {
            try
            {
                var json = JsonSerializer.Serialize(value, JsonOpts);
                await _redis.StringSetAsync(key, json, expiry < L2Ttl ? expiry : L2Ttl);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Redis SET failed for key '{Key}'.", key);
            }
        }
    }

    public async Task RemoveAsync(string key)
    {
        _memory.Remove(key);

        if (_redis is not null)
        {
            try { await _redis.KeyDeleteAsync(key); }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Redis DELETE failed for key '{Key}'.", key);
            }
        }
    }

    public async Task RemoveByPrefixAsync(string prefix)
    {
        var trackingKey = $"__keys:{prefix}";
        if (_memory.TryGetValue(trackingKey, out HashSet<string>? keys) && keys is not null)
        {
            foreach (var k in keys)
                _memory.Remove(k);
            _memory.Remove(trackingKey);
        }

        if (_redis is not null)
        {
            try
            {
                var server    = _redis.Multiplexer.GetServer(_redis.Multiplexer.GetEndPoints().First());
                var redisKeys = server.Keys(pattern: $"{prefix}*").ToArray();
                if (redisKeys.Length > 0)
                    await _redis.KeyDeleteAsync(redisKeys);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Redis SCAN/DELETE failed for prefix '{Prefix}'.", prefix);
            }
        }
    }
}
