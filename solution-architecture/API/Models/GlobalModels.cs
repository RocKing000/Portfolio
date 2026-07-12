namespace EnterpriseChatbot.API.Models;

public class GlobalRequest
{
    public string ChannelId { get; set; } = string.Empty;
    public string DigitalSignature { get; set; } = string.Empty;
    public string EncryptedPayload { get; set; } = string.Empty;
    public string RequestId { get; set; } = string.Empty;
    public string RequestTime { get; set; } = string.Empty;
    public string TransactionReferenceNumber { get; set; } = string.Empty;
    public string TransactionType { get; set; } = string.Empty;
    public string VersionNo { get; set; } = string.Empty;
    public string? ProductInfo { get; set; }
}

public class GlobalResponse
{
    public string ResponseCode { get; set; } = "200";
    public string? ResponseMessage { get; set; }
    public string? ResponseData { get; set; }
    public GlobalErrorInfo? Error { get; set; }
}

public class GlobalErrorInfo
{
    public string Code { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}
