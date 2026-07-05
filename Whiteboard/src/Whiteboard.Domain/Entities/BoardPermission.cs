namespace Whiteboard.Domain.Entities;

public class BoardPermission
{
    public Guid Id { get; set; }
    public Guid BoardId { get; set; }
    public Guid UserId { get; set; }
    public Whiteboard.Domain.Enums.BoardRole Role { get; set; }
    public DateTime AddedAt { get; set; } = DateTime.UtcNow; 

    // Навигация
    public Board Board { get; set; } = null!;
    public User User { get; set; } = null!;
}