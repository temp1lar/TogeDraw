using Whiteboard.Domain.Enums;

namespace Whiteboard.Application.Boards.DTOs;

public record BoardMemberDto(
    Guid UserId,
    string Email,
    string DisplayName,
    BoardRole Role,
    DateTime AddedAt
);

public record InviteUserRequest(string Email, BoardRole Role);
public record UpdateRoleRequest(Guid UserId, BoardRole NewRole);
public record InviteByLinkResponse(string InviteToken, string InviteUrl, DateTime ExpiresAt);