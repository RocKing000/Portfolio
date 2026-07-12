using System.Security.Claims;
using EnterpriseChatbot.API.Models;
using EnterpriseChatbot.API.Models.DTOs;
using EnterpriseChatbot.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EnterpriseChatbot.API.Controllers;

[ApiController]
[Route("api/v2/users")]
[Authorize]
public class UserController : ControllerBase
{
    private readonly IAuthService _authService;

    public UserController(IAuthService authService)
    {
        _authService = authService;
    }

    /// <summary>Get profile for the currently authenticated user.</summary>
    [HttpGet("me")]
    public async Task<IActionResult> GetMe()
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value!;
        var profile = await _authService.GetProfileAsync(userId);
        return Ok(ApiResponse<UserDto>.Ok(profile));
    }
}
