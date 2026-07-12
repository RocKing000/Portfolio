namespace EnterpriseChatbot.API.Models.Config;

public class CorsConfig
{
    public string[] AllowedOrigins { get; set; } = ["http://localhost:4200"];
    public bool AllowCredentials { get; set; } = true;
}
