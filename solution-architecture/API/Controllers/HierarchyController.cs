using EnterpriseChatbot.API.Models;
using EnterpriseChatbot.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EnterpriseChatbot.API.Controllers;

[ApiController]
[Route("api/v2/hierarchy")]
[AllowAnonymous]
public class HierarchyController : ControllerBase
{
    private readonly IHierarchyService _hierarchyService;

    public HierarchyController(IHierarchyService hierarchyService)
    {
        _hierarchyService = hierarchyService;
    }

    /// <summary>Get error hierarchy tree nodes for a tenant.</summary>
    [HttpGet]
    public async Task<IActionResult> GetHierarchy(
        [FromQuery] string tenantCode,
        [FromQuery] int? parentId = null,
        [FromQuery] string? levelType = null)
    {
        if (string.IsNullOrWhiteSpace(tenantCode))
            return BadRequest(ApiResponse<object>.Fail("tenantCode is required"));

        var nodes = await _hierarchyService.GetHierarchyAsync(tenantCode, parentId, levelType);
        return Ok(ApiResponse<object>.Ok(nodes));
    }

    /// <summary>Get a single hierarchy node by ID.</summary>
    [HttpGet("{hierarchyId:int}")]
    public async Task<IActionResult> GetNode(int hierarchyId)
    {
        var node = await _hierarchyService.GetNodeAsync(hierarchyId);
        if (node == null)
            return NotFound(ApiResponse<object>.Fail("Hierarchy node not found"));

        return Ok(ApiResponse<object>.Ok(node));
    }
}
