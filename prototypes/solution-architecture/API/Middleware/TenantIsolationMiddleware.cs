using System.Security.Claims;
using EnterpriseChatbot.API.Models;

namespace EnterpriseChatbot.API.Middleware;

public class TenantIsolationMiddleware
{
    private readonly RequestDelegate _next;

    public TenantIsolationMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var role          = context.User.FindFirst(ClaimTypes.Role)?.Value;
            var userTenantId  = context.User.FindFirst("TenantId")?.Value;

            if (role != "PLATFORM_ADMIN")
            {
                var requestedTenantId =
                    context.Request.Query["tenantId"].FirstOrDefault()
                    ?? context.Request.RouteValues["tenantId"]?.ToString();

                if (!string.IsNullOrEmpty(requestedTenantId) && requestedTenantId != userTenantId)
                {
                    context.Response.StatusCode  = StatusCodes.Status403Forbidden;
                    context.Response.ContentType = "application/json";
                    await context.Response.WriteAsJsonAsync(
                        ApiResponse<object>.Fail("Access denied. Cannot access other tenant data."));
                    return;
                }
            }
        }

        await _next(context);
    }
}
