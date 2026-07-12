namespace EnterpriseChatbot.API.Models.Config;

public class ServerConfig
{
    public int Port { get; set; } = 5000;
    public string ApiVersion { get; set; } = "v2";
    public string Environment { get; set; } = "development";
}
