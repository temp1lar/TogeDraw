using Whiteboard.Application.Boards.DTOs;
using Whiteboard.Domain.Enums;

namespace Whiteboard.Application.Common.Interfaces;

public interface IBoardAccessService
{
    Task<BoardRole?> GetUserRoleAsync(Guid boardId, Guid userId, CancellationToken ct = default);
    Task<bool> CanViewAsync(Guid boardId, Guid userId, CancellationToken ct = default);
    Task<bool> CanEditAsync(Guid boardId, Guid userId, CancellationToken ct = default);
    Task<bool> CanManageAsync(Guid boardId, Guid userId, CancellationToken ct = default);
    Task<List<BoardMemberDto>> GetMembersAsync(Guid boardId, CancellationToken ct = default);
    Task<BoardMemberDto> InviteUserByEmailAsync(Guid boardId, Guid invitedBy, string email, BoardRole role, CancellationToken ct = default);
    Task UpdateRoleAsync(Guid boardId, Guid changedBy, Guid targetUserId, BoardRole newRole, CancellationToken ct = default);
    Task RemoveUserAsync(Guid boardId, Guid changedBy, Guid targetUserId, CancellationToken ct = default);
    Task<InviteByLinkResponse> CreateInviteLinkAsync(Guid boardId, Guid createdBy, BoardRole role, int expirationHours = 24, int maxUses = 100, CancellationToken ct = default);
    Task<BoardMemberDto> AcceptInviteAsync(string inviteToken, Guid userId, CancellationToken ct = default);
}