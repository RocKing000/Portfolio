namespace EnterpriseChatbot.API.Models.DTOs;

public class SearchRequest
{
    public string Query { get; set; } = string.Empty;
    public int? Limit { get; set; } = 10;
    // Accepted from body when caller has no JWT (tenantCode resolved from claims when present)
    public string? TenantCode { get; set; }
    public string? UserId { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("language")]
    public string Language { get; set; } = "en";
}
