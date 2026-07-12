using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Dapper;
using EnterpriseChatbot.API.Exceptions;
using EnterpriseChatbot.API.Models.Domain;
using EnterpriseChatbot.API.Models.DTOs;
using Microsoft.Data.SqlClient;
using Microsoft.IdentityModel.Tokens;

namespace EnterpriseChatbot.API.Services;

public interface IAuthService
{
    Task<LoginResponse> LoginAsync(LoginRequest request);
    Task<UserDto> GetProfileAsync(string userId);
}

public class AuthService : IAuthService
{
    private readonly string _connectionString;
    private readonly IConfigurationService _config;
    private readonly ILogger<AuthService> _logger;

    public AuthService(string connectionString, IConfigurationService config, ILogger<AuthService> logger)
    {
        _connectionString = connectionString;
        _config = config;
        _logger = logger;
    }

    public async Task<LoginResponse> LoginAsync(LoginRequest request)
    {
        using var conn = new SqlConnection(_connectionString);

        var user = await conn.QuerySingleOrDefaultAsync<User>(@"
            SELECT
                u.user_id, u.tenant_id, u.username, u.email, u.password_hash,
                u.full_name, u.role, t.tenant_code, t.tenant_name
            FROM infrastructure.users u
            INNER JOIN infrastructure.tenants t ON u.tenant_id = t.tenant_id
            WHERE (u.username = @Username OR u.email = @Username)
              AND u.is_active = 1 AND t.is_active = 1",
            new { request.Username });

        // request.Password is MD5(username + plainPassword) sent by the frontend
        if (user == null)
        {
            _logger.LogWarning("Login failed: user '{Username}' not found or tenant inactive", request.Username);
            throw new UnauthorizedException("Invalid credentials");
        }

        if (!VerifyPassword(request.Password, user.password_hash))
        {
            _logger.LogWarning("Login failed: password mismatch for '{Username}' — stored hash is {HashStatus}",
                request.Username,
                string.IsNullOrEmpty(user.password_hash) ? "NULL (seed SQL not run)" : "set but wrong");
            throw new UnauthorizedException("Invalid credentials");
        }

        var jwtConfig = _config.GetJwtConfig();

        // Encryption key for subsequent requests = MD5 hash without hyphens (32 hex chars)
        var encryptionKey = request.Password.Replace("-", string.Empty);

        var (token, expiresAt) = GenerateToken(user, jwtConfig.Secret, jwtConfig.ExpiresIn, encryptionKey);

        _logger.LogInformation("User {Username} logged in from tenant {TenantCode}", user.username, user.tenant_code);

        return new LoginResponse
        {
            Token     = token,
            ExpiresAt = expiresAt,
            User = new UserDto
            {
                UserId     = user.user_id.ToString(),
                Username   = user.username,
                Email      = user.email,
                FullName   = user.full_name,
                Role       = user.role,
                TenantCode = user.tenant_code,
                TenantName = user.tenant_name
            }
        };
    }

    public async Task<UserDto> GetProfileAsync(string userId)
    {
        using var conn = new SqlConnection(_connectionString);

        if (!Guid.TryParse(userId, out var userGuid))
            throw new NotFoundException("User not found");

        var user = await conn.QuerySingleOrDefaultAsync<User>(@"
            SELECT
                u.user_id, u.tenant_id, u.username, u.email,
                u.full_name, u.role, t.tenant_code, t.tenant_name
            FROM infrastructure.users u
            INNER JOIN infrastructure.tenants t ON u.tenant_id = t.tenant_id
            WHERE u.user_id = @UserId AND u.is_active = 1",
            new { UserId = userGuid });

        if (user == null)
            throw new NotFoundException("User not found");

        return new UserDto
        {
            UserId     = user.user_id.ToString(),
            Username   = user.username,
            Email      = user.email,
            FullName   = user.full_name,
            Role       = user.role,
            TenantCode = user.tenant_code,
            TenantName = user.tenant_name
        };
    }

    // Supports both MD5 (new: "A1-B2-..." uppercase hex with hyphens) and BCrypt (legacy "$2...")
    private static bool VerifyPassword(string supplied, string? stored)
    {
        if (string.IsNullOrEmpty(stored)) return false;

        if (stored.StartsWith("$2", StringComparison.Ordinal))
            return BCrypt.Net.BCrypt.Verify(supplied, stored);

        return string.Equals(stored, supplied, StringComparison.OrdinalIgnoreCase);
    }

    private static (string token, DateTime expiresAt) GenerateToken(
        User user, string secret, string expiresIn, string encryptionKey)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.user_id.ToString()),
            new Claim(ClaimTypes.Name,            user.username),
            new Claim(ClaimTypes.Role,            user.role),
            new Claim("TenantId",                 user.tenant_id.ToString()),
            new Claim("TenantCode",               user.tenant_code),
            new Claim("encryption_key",           encryptionKey)
        };

        var key       = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds     = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var hours     = ParseExpiryHours(expiresIn);
        var expiresAt = DateTime.UtcNow.AddHours(hours);

        var jwt = new JwtSecurityToken(
            claims:             claims,
            expires:            expiresAt,
            signingCredentials: creds
        );

        return (new JwtSecurityTokenHandler().WriteToken(jwt), expiresAt);
    }

    private static int ParseExpiryHours(string expiresIn)
    {
        if (expiresIn.EndsWith('h') && int.TryParse(expiresIn[..^1], out var h)) return h;
        if (expiresIn.EndsWith('d') && int.TryParse(expiresIn[..^1], out var d)) return d * 24;
        return 24;
    }
}
