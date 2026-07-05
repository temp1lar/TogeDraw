namespace Whiteboard.Domain.Entities;

public class BoardSnapshot
{
    public Guid Id { get; set; }
    public Guid BoardId { get; set; }
    public long SequenceNumber { get; set; } // До какого события сделан снапшот
    public string S3Key { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Навигация
    public Board Board { get; set; } = null!;
}