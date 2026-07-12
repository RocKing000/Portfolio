namespace EnterpriseChatbot.API.Services;

/// <summary>
/// Defence-in-depth helpers. Primary validation is done via DataAnnotations on the
/// request models; these utilities are a second layer for controller-level checks.
/// </summary>
public static class InputSanitizer
{
    private static readonly string[] SqlKeywords =
        ["--", "/*", "*/", "xp_", "sp_exec", "EXEC(", "EXECUTE("];

    private static readonly string[] PathTraversalPatterns = ["../", "..\\", "%2e%2e"];

    private static readonly string[] CommandInjectionChars = ["\r", "\n", "\x00"];

    /// <summary>
    /// Returns true if the string contains obvious SQL injection patterns.
    /// NOTE: Dapper parameterisation already prevents injection at the DB layer;
    /// this is a belt-and-suspenders check for logging/blocking suspicious requests.
    /// </summary>
    public static bool ContainsSqlInjection(string? input)
    {
        if (string.IsNullOrEmpty(input)) return false;
        return SqlKeywords.Any(k => input.Contains(k, StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>Returns true if the string contains directory traversal sequences.</summary>
    public static bool ContainsPathTraversal(string? input)
    {
        if (string.IsNullOrEmpty(input)) return false;
        return PathTraversalPatterns.Any(p => input.Contains(p, StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>Returns true if the string contains control characters used in CRLF/null injection.</summary>
    public static bool ContainsControlCharacters(string? input)
    {
        if (string.IsNullOrEmpty(input)) return false;
        return CommandInjectionChars.Any(c => input.Contains(c));
    }
}
