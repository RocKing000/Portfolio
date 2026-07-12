namespace EnterpriseChatbot.API.Services;

public interface ILocalizationService
{
    IReadOnlyList<string> SupportedLanguages { get; }
    bool IsSupported(string lang);
    string Resolve(HttpContext context);
}

public class LocalizationService : ILocalizationService
{
    private static readonly string[] _supported = ["en", "kn"];
    private const string DefaultLang = "en";

    public IReadOnlyList<string> SupportedLanguages => _supported;

    public bool IsSupported(string lang) =>
        !string.IsNullOrWhiteSpace(lang) &&
        _supported.Contains(lang.Trim().ToLowerInvariant());

    public string Resolve(HttpContext context)
    {
        // 1. Query param: ?lang=kn
        var query = context.Request.Query["lang"].FirstOrDefault();
        if (IsSupported(query!)) return query!.Trim().ToLowerInvariant();

        // 2. Custom header: X-Language: kn
        var header = context.Request.Headers["X-Language"].FirstOrDefault();
        if (IsSupported(header!)) return header!.Trim().ToLowerInvariant();

        // 3. Standard Accept-Language (first tag only)
        var accept = context.Request.Headers["Accept-Language"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(accept))
        {
            var tag = accept.Split(',')[0].Split(';')[0].Trim().ToLowerInvariant();
            if (IsSupported(tag)) return tag;
            // try two-letter prefix (e.g. "en-US" -> "en")
            var prefix = tag.Length >= 2 ? tag[..2] : tag;
            if (IsSupported(prefix)) return prefix;
        }

        return DefaultLang;
    }
}
