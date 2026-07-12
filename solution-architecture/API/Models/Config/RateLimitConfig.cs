namespace EnterpriseChatbot.API.Models.Config;

public class RateLimitConfig
{
    public int WindowMs { get; set; } = 900000;
    public int MaxRequests { get; set; } = 100;
}
