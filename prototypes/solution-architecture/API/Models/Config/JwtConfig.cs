namespace EnterpriseChatbot.API.Models.Config;

public class JwtConfig
{
    public string Secret { get; set; } = string.Empty;
    public string ExpiresIn { get; set; } = "24h";
    public string RefreshSecret { get; set; } = string.Empty;
    public string RefreshExpiresIn { get; set; } = "7d";
}
