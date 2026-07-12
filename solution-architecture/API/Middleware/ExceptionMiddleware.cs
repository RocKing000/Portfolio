using EnterpriseChatbot.API.Exceptions;
using EnterpriseChatbot.API.Models;

namespace EnterpriseChatbot.API.Middleware;

public class ExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionMiddleware> _logger;

    public ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception on {Method} {Path}",
                context.Request.Method, context.Request.Path);
            await HandleExceptionAsync(context, ex);
        }
    }

    private static Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/json";
        context.Response.StatusCode = exception switch
        {
            UnauthorizedException => StatusCodes.Status401Unauthorized,
            ForbiddenException    => StatusCodes.Status403Forbidden,
            NotFoundException     => StatusCodes.Status404NotFound,
            ValidationException   => StatusCodes.Status400BadRequest,
            _                     => StatusCodes.Status500InternalServerError
        };

        var message = context.Response.StatusCode == 500
            ? "An unexpected error occurred."
            : exception.Message;

        return context.Response.WriteAsJsonAsync(ApiResponse<object>.Fail(message));
    }
}
