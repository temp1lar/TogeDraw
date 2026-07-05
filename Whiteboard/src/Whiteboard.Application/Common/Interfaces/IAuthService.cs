namespace Whiteboard.Application.Common.Interfaces;

public interface IAuthService
{
    Task<string> GenerateAccessTokenAsync(Guid userId, string email, string displayName);
    Task<(string AccessToken, string RefreshToken)> LoginAsync(string email, string password);
    Task<(string AccessToken, string RefreshToken)> RefreshTokenAsync(string refreshToken);
    Task<(string AccessToken, string RefreshToken)> RegisterAsync(string email, string displayName, string password);
    Task RevokeRefreshTokenAsync(string refreshToken, Guid userId);
    Task RevokeAllRefreshTokensAsync(Guid userId);
}