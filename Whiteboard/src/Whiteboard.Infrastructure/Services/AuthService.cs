using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Whiteboard.Application.Common.Interfaces;
using Whiteboard.Domain.Entities;
using Whiteboard.Infrastructure.Data;

namespace Whiteboard.Infrastructure.Services;

public class AuthService : IAuthService
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;

    public AuthService(AppDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    public async Task<string> GenerateAccessTokenAsync(Guid userId, string email, string displayName)
    {
        var jwtConfig = _config.GetSection("Jwt");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtConfig["Secret"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Name, displayName),
            new Claim(ClaimTypes.Email, email)
        };

        var token = new JwtSecurityToken(
            issuer: jwtConfig["Issuer"],
            audience: jwtConfig["Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(15), // Короткий access token
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private string GenerateRefreshToken()
    {
        var bytes = new byte[64];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(bytes);
        return Convert.ToBase64String(bytes);
    }

    public async Task<(string AccessToken, string RefreshToken)> LoginAsync(string email, string password)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email)
            ?? throw new UnauthorizedAccessException("Invalid credentials");

        if (!BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
            throw new UnauthorizedAccessException("Invalid credentials");

        var accessToken = await GenerateAccessTokenAsync(user.Id, user.Email, user.DisplayName);
        var refreshToken = await CreateRefreshTokenAsync(user.Id);

        return (accessToken, refreshToken);
    }

    private async Task<string> CreateRefreshTokenAsync(Guid userId)
    {
        var refreshToken = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Token = GenerateRefreshToken(),
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            CreatedAt = DateTime.UtcNow
        };

        _db.RefreshTokens.Add(refreshToken);
        await _db.SaveChangesAsync();

        return refreshToken.Token;
    }

    public async Task<(string AccessToken, string RefreshToken)> RefreshTokenAsync(string refreshTokenValue)
    {
        var storedToken = await _db.RefreshTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.Token == refreshTokenValue)
            ?? throw new UnauthorizedAccessException("Invalid refresh token");

        if (storedToken.IsRevoked)
            throw new UnauthorizedAccessException("Refresh token has been revoked");

        // Ротация: помечаем старый как использованный
        var newRefreshTokenValue = GenerateRefreshToken();
        storedToken.ReplacedByToken = newRefreshTokenValue;

        var newToken = new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = storedToken.UserId,
            Token = newRefreshTokenValue,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            CreatedAt = DateTime.UtcNow
        };

        _db.RefreshTokens.Add(newToken);
        await _db.SaveChangesAsync();

        var newAccessToken = await GenerateAccessTokenAsync(
            storedToken.User.Id, 
            storedToken.User.Email, 
            storedToken.User.DisplayName);

        return (newAccessToken, newRefreshTokenValue);
    }

    public async Task RevokeRefreshTokenAsync(string refreshToken, Guid userId)
    {
        var token = await _db.RefreshTokens
            .FirstOrDefaultAsync(t => t.Token == refreshToken && t.UserId == userId);

        if (token != null)
        {
            token.ReplacedByToken = "REVOKED";
            await _db.SaveChangesAsync();
        }
    }

    public async Task RevokeAllRefreshTokensAsync(Guid userId)
    {
        var tokens = await _db.RefreshTokens
            .Where(t => t.UserId == userId && t.ReplacedByToken == null)
            .ToListAsync();

        foreach (var token in tokens)
            token.ReplacedByToken = "REVOKED";

        await _db.SaveChangesAsync();
    }

    public async Task<(string AccessToken, string RefreshToken)> RegisterAsync(
    string email, string displayName, string password)
    {
        if (await _db.Users.AnyAsync(u => u.Email == email))
            throw new InvalidOperationException("Email already registered");

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = email,
            DisplayName = displayName,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            CreatedAt = DateTime.UtcNow
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        var accessToken = await GenerateAccessTokenAsync(user.Id, user.Email, user.DisplayName);
        var refreshToken = await CreateRefreshTokenAsync(user.Id);

        return (accessToken, refreshToken);
    }
}