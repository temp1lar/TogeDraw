namespace Whiteboard.Domain.Entities;

public class BoardViolation
{
    public Guid Id { get; set; }
    public Guid BoardId { get; set; }
    public string SnapshotKey { get; set; } = string.Empty;
    public string ViolationType { get; set; } = string.Empty;
    public float Confidence { get; set; }
    public DateTime DetectedAt { get; set; }
    
    // Навигация
    public Board Board { get; set; } = null!;
}