namespace EnterpriseChatbot.API.Models.DTOs;

public class UserDto
{
    public string UserId     { get; set; } = string.Empty;
    public string Username   { get; set; } = string.Empty;
    public string Email      { get; set; } = string.Empty;
    public string FullName   { get; set; } = string.Empty;
    public string Role       { get; set; } = string.Empty;
    public string TenantCode { get; set; } = string.Empty;
    public string TenantName { get; set; } = string.Empty;
}
