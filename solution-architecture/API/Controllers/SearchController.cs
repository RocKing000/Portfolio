using System.Security.Claims;
using EnterpriseChatbot.API.Models;
using EnterpriseChatbot.API.Models.DTOs;
using EnterpriseChatbot.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EnterpriseChatbot.API.Controllers;

[ApiController]
[Route("api/v2/search")]
[AllowAnonymous]
public class SearchController : ControllerBase
{
    private readonly ISearchService _searchService;
    private readonly ITranslationService _translationService;

    public SearchController(ISearchService searchService, ITranslationService translationService)
    {
        _searchService      = searchService;
        _translationService = translationService;
    }

    /// <summary>Search for error resolutions. TenantCode resolved from JWT claim or request body.</summary>
    [HttpPost]
    public async Task<IActionResult> Search([FromBody] SearchRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Query))
            return BadRequest(ApiResponse<object>.Fail("Query is required"));

        // Prefer JWT claim; fall back to body field (anonymous callers)
        var tenantCode = User.FindFirst("TenantCode")?.Value ?? request.TenantCode;
        var userId     = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? request.UserId;

        if (string.IsNullOrWhiteSpace(tenantCode))
            return BadRequest(ApiResponse<object>.Fail("TenantCode is required"));

        // Accept-Language header takes precedence over request body language field
        var language = ResolveLanguage(request.Language);

        var results = (await _searchService.SearchAsync(tenantCode, request.Query, userId)).ToList();

        if (language == "kn")
        {
            foreach (var r in results)
            {
                r.ErrorTitle       = _translationService.Translate(r.ErrorTitle,       "en", "kn");
                r.ErrorDescription = _translationService.Translate(r.ErrorDescription, "en", "kn");
                r.Solution         = _translationService.Translate(r.Solution,         "en", "kn");
                r.Severity         = _translationService.Translate(r.Severity,         "en", "kn");
                r.Category         = _translationService.Translate(r.Category,         "en", "kn");
                if (r.RootCause != null)
                    r.RootCause    = _translationService.Translate(r.RootCause,        "en", "kn");
            }
        }

        return Ok(ApiResponse<object>.Ok(results));
    }

    private string ResolveLanguage(string requestLanguage)
    {
        var acceptLang = Request.Headers["Accept-Language"].FirstOrDefault();
        if (!string.IsNullOrEmpty(acceptLang))
        {
            var primary = acceptLang.Split(',')[0].Trim();
            if (primary.StartsWith("kn", StringComparison.OrdinalIgnoreCase)) return "kn";
            if (primary.StartsWith("en", StringComparison.OrdinalIgnoreCase)) return "en";
        }
        return requestLanguage == "kn" ? "kn" : "en";
    }
}
