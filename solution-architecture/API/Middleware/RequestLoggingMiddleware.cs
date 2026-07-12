using System.Diagnostics;
using System.Security.Claims;

namespace EnterpriseChatbot.API.Middleware;

public class RequestLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestLoggingMiddleware> _logger;

    public RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var sw = Stopwatch.StartNew();
        await _next(context);
        sw.Stop();

        var user   = context.User.FindFirst(ClaimTypes.Name)?.Value ?? "anonymous";
        var tenant = context.User.FindFirst("TenantCode")?.Value ?? "-";

        _logger.LogInformation(
            "HTTP {Method} {Path} => {StatusCode} [{ElapsedMs}ms] user={User} tenant={Tenant}",
            context.Request.Method,
            context.Request.Path,
            context.Response.StatusCode,
            sw.ElapsedMilliseconds,
            user,
            tenant);
    }
}
