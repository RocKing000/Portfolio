using System.Text;
using System.Text.Json;
using EnterpriseChatbot.API.Models;
using EnterpriseChatbot.API.Services;

namespace EnterpriseChatbot.API.Middleware;

public class EncryptionMiddleware(RequestDelegate next, ILogger<EncryptionMiddleware> logger)
{
    private static readonly string[] PublicTxnTypes =
        ["USER_LOGIN", "RESET_PASSWORD", "VERIFY_OTP", "GENERATE_OTP"];

    private static readonly JsonSerializerOptions _jsonOpts =
        new() { PropertyNameCaseInsensitive = true };

    public async Task InvokeAsync(HttpContext context, IEncryptionService encryption)
    {
        // Pass through non-POST requests and infrastructure paths unchanged
        var path = context.Request.Path.Value?.ToLower() ?? "";
        if (context.Request.Method != "POST" ||
            path.Contains("/health") ||
            path.Contains("/swagger"))
        {
            await next(context);
            return;
        }

        // Read and parse request body
        context.Request.EnableBuffering();
        string rawBody;
        using (var reader = new StreamReader(context.Request.Body, Encoding.UTF8, leaveOpen: true))
        {
            rawBody = await reader.ReadToEndAsync();
        }
        context.Request.Body.Position = 0;

        GlobalRequest? globalReq = null;
        try
        {
            globalReq = JsonSerializer.Deserialize<GlobalRequest>(rawBody, _jsonOpts);
        }
        catch { /* not a GlobalRequest — fall through */ }

        // Fall through if payload isn't encrypted (backward compatibility)
        if (globalReq == null || string.IsNullOrEmpty(globalReq.EncryptedPayload))
        {
            await next(context);
            return;
        }

        // Determine encryption key: date-based for public endpoints, JWT claim for authenticated
        var encKey = ResolveEncryptionKey(context, globalReq, encryption);
        if (encKey == null)
        {
            await WriteError(context, 401, "MISSING_ENC_KEY", "Encryption key unavailable");
            return;
        }

        // Decrypt payload
        string decryptedPayload;
        try
        {
            decryptedPayload = encryption.Decrypt(globalReq.EncryptedPayload, encKey);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "AES-GCM decryption failed for {Path}", path);
            await WriteError(context, 400, "DECRYPT_ERROR", "Invalid or tampered payload");
            return;
        }

        // Replace body with decrypted JSON so controller binds normally
        var bodyBytes = Encoding.UTF8.GetBytes(decryptedPayload);
        context.Request.Body = new MemoryStream(bodyBytes);
        context.Request.ContentLength = bodyBytes.Length;
        context.Request.ContentType = "application/json; charset=utf-8";

        // Store metadata for controllers that want it
        context.Items["GlobalRequest"]   = globalReq;
        context.Items["EncryptionKey"]   = encKey;

        // Capture response so we can encrypt it
        var originalBody = context.Response.Body;
        using var capturedBody = new MemoryStream();
        context.Response.Body = capturedBody;

        await next(context);

        // Read captured response
        capturedBody.Seek(0, SeekOrigin.Begin);
        var plainResponse = await new StreamReader(capturedBody).ReadToEndAsync();

        // Encrypt response and wrap in GlobalResponse
        string encryptedResponse;
        try
        {
            encryptedResponse = string.IsNullOrEmpty(plainResponse)
                ? string.Empty
                : encryption.Encrypt(plainResponse, encKey);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Response encryption failed");
            encryptedResponse = string.Empty;
        }

        var globalResp = new GlobalResponse
        {
            ResponseCode = context.Response.StatusCode.ToString(),
            ResponseData = encryptedResponse
        };

        var responseJson = JsonSerializer.Serialize(globalResp);
        var responseBytes = Encoding.UTF8.GetBytes(responseJson);

        context.Response.Body = originalBody;
        context.Response.ContentType = "application/json; charset=utf-8";
        context.Response.ContentLength = responseBytes.Length;
        await originalBody.WriteAsync(responseBytes);
    }

    private static string? ResolveEncryptionKey(
        HttpContext context, GlobalRequest req, IEncryptionService encryption)
    {
        var txnType = req.TransactionType?.ToUpperInvariant() ?? string.Empty;

        if (PublicTxnTypes.Contains(txnType))
            return encryption.GetDateBasedKey();

        // Authenticated request: encryption key stored in JWT claim
        return context.User.FindFirst("encryption_key")?.Value;
    }

    private static async Task WriteError(
        HttpContext context, int status, string code, string description)
    {
        var resp = new GlobalResponse
        {
            ResponseCode = status.ToString(),
            Error = new GlobalErrorInfo { Code = code, Description = description }
        };
        context.Response.StatusCode = status;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(resp);
    }
}
