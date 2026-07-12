using System.Collections.Concurrent;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EnterpriseChatbot.API.Services;

public class ConnectionThrottlingOptions
{
    public int MaxConcurrentPerUser  { get; set; } = 2;
    public int AcquireTimeoutSeconds { get; set; } = 10;
}

public class UserConnectionTracker : IUserConnectionTracker
{
    private readonly ConcurrentDictionary<Guid, SemaphoreSlim> _semaphores = new();
    private readonly int _maxConcurrent;
    private readonly int _acquireTimeoutMs;
    private readonly ILogger<UserConnectionTracker> _logger;

    public UserConnectionTracker(
        IOptions<ConnectionThrottlingOptions> options,
        ILogger<UserConnectionTracker> logger)
    {
        _maxConcurrent    = options.Value.MaxConcurrentPerUser;
        _acquireTimeoutMs = options.Value.AcquireTimeoutSeconds * 1_000;
        _logger           = logger;
    }

    public async Task<bool> TryAcquireAsync(Guid userId, CancellationToken ct = default)
    {
        var semaphore = _semaphores.GetOrAdd(userId, _ => new SemaphoreSlim(_maxConcurrent, _maxConcurrent));

        using var timeout = new CancellationTokenSource(_acquireTimeoutMs);
        using var linked  = CancellationTokenSource.CreateLinkedTokenSource(ct, timeout.Token);

        try
        {
            await semaphore.WaitAsync(linked.Token);
            _logger.LogDebug("Connection acquired for user {UserId}. Active: {Count}",
                userId, _maxConcurrent - semaphore.CurrentCount);
            return true;
        }
        catch (OperationCanceledException)
        {
            if (timeout.IsCancellationRequested)
                _logger.LogWarning("Connection throttled for user {UserId} — limit of {Max} reached.", userId, _maxConcurrent);
            return false;
        }
    }

    public void Release(Guid userId)
    {
        if (_semaphores.TryGetValue(userId, out var semaphore))
        {
            semaphore.Release();
            _logger.LogDebug("Connection released for user {UserId}.", userId);
        }
    }

    public int GetConnectionCount(Guid userId)
    {
        if (_semaphores.TryGetValue(userId, out var semaphore))
            return _maxConcurrent - semaphore.CurrentCount;
        return 0;
    }

    internal void RemoveIdle()
    {
        foreach (var (userId, semaphore) in _semaphores)
        {
            if (semaphore.CurrentCount == _maxConcurrent)
                _semaphores.TryRemove(userId, out _);
        }
    }
}

public class ConnectionTrackerCleanupService : BackgroundService
{
    private readonly UserConnectionTracker _tracker;
    private readonly ILogger<ConnectionTrackerCleanupService> _logger;
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(5);

    public ConnectionTrackerCleanupService(
        UserConnectionTracker tracker,
        ILogger<ConnectionTrackerCleanupService> logger)
    {
        _tracker = tracker;
        _logger  = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await Task.Delay(Interval, stoppingToken);
            _tracker.RemoveIdle();
            _logger.LogDebug("Connection tracker: idle semaphores pruned.");
        }
    }
}
