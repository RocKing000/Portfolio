namespace EnterpriseChatbot.API.Services;

public interface IUserConnectionTracker
{
    Task<bool> TryAcquireAsync(Guid userId, CancellationToken ct = default);
    void Release(Guid userId);
    int GetConnectionCount(Guid userId);
}
