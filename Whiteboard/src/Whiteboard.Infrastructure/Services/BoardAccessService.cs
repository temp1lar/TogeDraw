using Microsoft.EntityFrameworkCore;
using Whiteboard.Application.Boards.DTOs;
using Whiteboard.Application.Common.Interfaces;
using Whiteboard.Domain.Entities;
using Whiteboard.Domain.Enums;
using Whiteboard.Infrastructure.Data;

namespace Whiteboard.Infrastructure.Services;

public class BoardAccessService : IBoardAccessService
{
    private readonly AppDbContext _db;

    public BoardAccessService(AppDbContext db) => _db = db;

    public async Task<BoardRole?> GetUserRoleAsync(Guid boardId, Guid userId, CancellationToken ct = default)
    {
        var permission = await _db.BoardPermissions
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.BoardId == boardId && p.UserId == userId, ct);

        return permission?.Role;
    }

    public async Task<bool> CanViewAsync(Guid boardId, Guid userId, CancellationToken ct = default)
    {
        var role = await GetUserRoleAsync(boardId, userId, ct);
        return role.HasValue;
    }

    public async Task<bool> CanEditAsync(Guid boardId, Guid userId, CancellationToken ct = default)
    {
        var role = await GetUserRoleAsync(boardId, userId, ct);
        return role.HasValue && role >= BoardRole.Editor;
    }

    public async Task<bool> CanManageAsync(Guid boardId, Guid userId, CancellationToken ct = default)
    {
        var role = await GetUserRoleAsync(boardId, userId, ct);
        return role.HasValue && role >= BoardRole.Presenter;
    }

    public async Task<List<BoardMemberDto>> GetMembersAsync(Guid boardId, CancellationToken ct = default)
{
    // Шаг 1: Получаем данные через Join, но БЕЗ OrderBy с DTO
    var members = await _db.BoardPermissions
        .Where(p => p.BoardId == boardId)
        .Join(
            _db.Users,
            permission => permission.UserId,
            user => user.Id,
            (permission, user) => new
            {
                user.Id,
                user.Email,
                user.DisplayName,
                Role = permission.Role,
                AddedAt = permission.AddedAt
            })
        .ToListAsync(ct);  // ← Сначала материализуем в память
    
    // Шаг 2: Сортируем и маппим УЖЕ в памяти (на клиенте)
    return members
        .OrderBy(m => m.Role)  // ← Сортируем по enum (это работает)
        .Select(m => new BoardMemberDto(
            m.Id,
            m.Email,
            m.DisplayName,
            m.Role,
            m.AddedAt
        ))
        .ToList();
}

    public async Task<BoardMemberDto> InviteUserByEmailAsync(
        Guid boardId, Guid invitedBy, string email, BoardRole role, CancellationToken ct = default)
    {
        // Проверяем, что приглашающий имеет право управлять
        var inviterRole = await GetUserRoleAsync(boardId, invitedBy, ct);
        if (inviterRole < BoardRole.Presenter)
            throw new UnauthorizedAccessException("No permission to invite users");

        // Нельзя пригласить на роль выше своей
        if (role > inviterRole)
            throw new InvalidOperationException("Cannot assign role higher than your own");

        // Ищем пользователя
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email, ct)
            ?? throw new InvalidOperationException($"User with email {email} not found");

        // Проверяем, не является ли уже участником
        var existing = await _db.BoardPermissions
            .FirstOrDefaultAsync(p => p.BoardId == boardId && p.UserId == user.Id, ct);

        if (existing != null)
        {
            // Обновляем роль
            existing.Role = role;
        }
        else
        {
            _db.BoardPermissions.Add(new BoardPermission
            {
                Id = Guid.NewGuid(),
                BoardId = boardId,
                UserId = user.Id,
                Role = role
            });
        }

        await _db.SaveChangesAsync(ct);

        return new BoardMemberDto(user.Id, user.Email, user.DisplayName, role, DateTime.UtcNow);
    }

    public async Task UpdateRoleAsync(
        Guid boardId, Guid changedBy, Guid targetUserId, BoardRole newRole, CancellationToken ct = default)
    {
        var changerRole = await GetUserRoleAsync(boardId, changedBy, ct);
        if (changerRole < BoardRole.Owner)
            throw new UnauthorizedAccessException("Only board owner can change roles");

        // Нельзя менять роль владельца
        var board = await _db.Boards.FindAsync(new object[] { boardId }, ct)
            ?? throw new InvalidOperationException("Board not found");

        if (board.OwnerId == targetUserId)
            throw new InvalidOperationException("Cannot change board owner's role");

        var permission = await _db.BoardPermissions
            .FirstOrDefaultAsync(p => p.BoardId == boardId && p.UserId == targetUserId, ct)
            ?? throw new InvalidOperationException("User is not a member of this board");

        permission.Role = newRole;
        await _db.SaveChangesAsync(ct);
    }

    public async Task RemoveUserAsync(
        Guid boardId, Guid changedBy, Guid targetUserId, CancellationToken ct = default)
    {
        var changerRole = await GetUserRoleAsync(boardId, changedBy, ct);
        if (changerRole < BoardRole.Presenter)
            throw new UnauthorizedAccessException("No permission to remove users");

        var board = await _db.Boards.FindAsync(new object[] { boardId }, ct)
            ?? throw new InvalidOperationException("Board not found");

        if (board.OwnerId == targetUserId)
            throw new InvalidOperationException("Cannot remove board owner");

        var permission = await _db.BoardPermissions
            .FirstOrDefaultAsync(p => p.BoardId == boardId && p.UserId == targetUserId, ct)
            ?? throw new InvalidOperationException("User is not a member");

        _db.BoardPermissions.Remove(permission);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<InviteByLinkResponse> CreateInviteLinkAsync(
        Guid boardId, Guid createdBy, BoardRole role, 
        int expirationHours = 24, int maxUses = 100, 
        CancellationToken ct = default)
    {
        var creatorRole = await GetUserRoleAsync(boardId, createdBy, ct);
        if (creatorRole < BoardRole.Presenter)
            throw new UnauthorizedAccessException("No permission to create invites");

        if (role > creatorRole)
            throw new InvalidOperationException("Cannot create invite for role higher than your own");

        var invite = new BoardInvite
        {
            Id = Guid.NewGuid(),
            BoardId = boardId,
            CreatedByUserId = createdBy,
            InviteToken = GenerateSecureToken(),
            Role = role,
            ExpiresAt = DateTime.UtcNow.AddHours(expirationHours),
            MaxUses = maxUses
        };

        _db.BoardInvites.Add(invite);
        await _db.SaveChangesAsync(ct);

        return new InviteByLinkResponse(
            invite.InviteToken,
            $"/invite/{invite.InviteToken}",
            invite.ExpiresAt
        );
    }

    public async Task<BoardMemberDto> AcceptInviteAsync(
        string inviteToken, Guid userId, CancellationToken ct = default)
    {
        var invite = await _db.BoardInvites
            .Include(i => i.Board)
            .FirstOrDefaultAsync(i => i.InviteToken == inviteToken, ct)
            ?? throw new InvalidOperationException("Invite not found");

        if (!invite.IsActive)
            throw new InvalidOperationException("Invite has expired or reached max uses");

        var user = await _db.Users.FindAsync(new object[] { userId }, ct)
            ?? throw new InvalidOperationException("User not found");

        // Проверяем, не является ли уже участником
        var existing = await _db.BoardPermissions
            .FirstOrDefaultAsync(p => p.BoardId == invite.BoardId && p.UserId == userId, ct);

        if (existing != null)
        {
            invite.CurrentUses++;
            await _db.SaveChangesAsync(ct);
            return new BoardMemberDto(user.Id, user.Email, user.DisplayName, existing.Role, DateTime.UtcNow);
        }

        _db.BoardPermissions.Add(new BoardPermission
        {
            Id = Guid.NewGuid(),
            BoardId = invite.BoardId,
            UserId = userId,
            Role = invite.Role
        });

        invite.CurrentUses++;
        await _db.SaveChangesAsync(ct);

        return new BoardMemberDto(user.Id, user.Email, user.DisplayName, invite.Role, DateTime.UtcNow);
    }

    private static string GenerateSecureToken()
    {
        var bytes = new byte[32];
        using var rng = System.Security.Cryptography.RandomNumberGenerator.Create();
        rng.GetBytes(bytes);
        return Convert.ToBase64String(bytes)
            .Replace("+", "-")
            .Replace("/", "_")
            .TrimEnd('=');
    }
}