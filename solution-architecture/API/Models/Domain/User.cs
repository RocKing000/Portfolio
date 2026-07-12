namespace EnterpriseChatbot.API.Models.Domain;

public class User
{
    public Guid   user_id       { get; set; }
    public Guid   tenant_id     { get; set; }
    public string username      { get; set; } = string.Empty;
    public string email         { get; set; } = string.Empty;
    public string password_hash { get; set; } = string.Empty;
    public string full_name     { get; set; } = string.Empty;
    public string role          { get; set; } = string.Empty;
    public string tenant_code   { get; set; } = string.Empty;
    public string tenant_name   { get; set; } = string.Empty;
}
