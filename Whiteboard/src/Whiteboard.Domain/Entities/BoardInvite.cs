using Whiteboard.Domain.Enums;

namespace Whiteboard.Domain.Entities;

public class BoardInvite
{
    public Guid Id { get; set; }
    public Guid BoardId { get; set; }
    public Guid CreatedByUserId { get; set; }
    public string InviteToken { get; set; } = string.Empty;
    public BoardRole Role { get; set; } = BoardRole.Viewer;
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int MaxUses { get; set; } = 100;
    public int CurrentUses { get; set; } = 0;
    public bool IsActive => CurrentUses < MaxUses && ExpiresAt > DateTime.UtcNow;

    // Навигация
    public Board Board { get; set; } = null!;
    public User CreatedByUser { get; set; } = null!;
}