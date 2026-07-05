namespace Whiteboard.Domain.Entities;

public class Board
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public Guid OwnerId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public string? LastSnapshotJson { get; set; }
    public long LastSnapshotSequence { get; set; }

    // Навигация
    public User Owner { get; set; } = null!;
    public ICollection<BoardEvent> Events { get; set; } = new List<BoardEvent>();
    public ICollection<BoardPermission> Permissions { get; set; } = new List<BoardPermission>();
}