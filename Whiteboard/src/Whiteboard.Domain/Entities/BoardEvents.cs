namespace Whiteboard.Domain.Entities;

public class BoardEvent
{
    public Guid Id { get; set; }
    public Guid BoardId { get; set; }
    public Guid UserId { get; set; }
    public long SequenceNumber { get; set; }
    public string EventType { get; set; } = string.Empty;
    public string PayloadJson { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Навигация
    public Board Board { get; set; } = null!;
    public User User { get; set; } = null!;
}