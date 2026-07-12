namespace EnterpriseChatbot.API.Models.Domain;

public class Tenant
{
    public int tenant_id { get; set; }
    public string tenant_code { get; set; } = string.Empty;
    public string tenant_name { get; set; } = string.Empty;
    public string? contact_email { get; set; }
    public bool is_active { get; set; }
    public DateTime created_at { get; set; }
}
