using System.Globalization;
using EnterpriseChatbot.API.Services;

namespace EnterpriseChatbot.API.Middleware;

public class LanguageMiddleware(RequestDelegate next, ILocalizationService localization)
{
    public const string ContextKey = "RequestLanguage";

    public async Task InvokeAsync(HttpContext context)
    {
        var lang = localization.Resolve(context);
        context.Items[ContextKey] = lang;

        var culture = lang switch
        {
            "kn" => new CultureInfo("kn-IN"),
            _    => new CultureInfo("en-US")
        };

        CultureInfo.CurrentCulture   = culture;
        CultureInfo.CurrentUICulture = culture;

        context.Response.Headers["Content-Language"] = lang;

        await next(context);
    }
}

public static class LanguageMiddlewareExtensions
{
    public static IApplicationBuilder UseLanguageMiddleware(this IApplicationBuilder app) =>
        app.UseMiddleware<LanguageMiddleware>();
}
