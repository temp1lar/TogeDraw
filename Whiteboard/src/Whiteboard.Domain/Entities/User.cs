namespace Whiteboard.Domain.Entities;

public class User
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Навигация
    public ICollection<Board> OwnedBoards { get; set; } = new List<Board>();
    public ICollection<BoardPermission> Permissions { get; set; } = new List<BoardPermission>();
}