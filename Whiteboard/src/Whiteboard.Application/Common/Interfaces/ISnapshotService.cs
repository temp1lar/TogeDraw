using Whiteboard.Domain.Entities;

namespace Whiteboard.Application.Common.Interfaces;

public interface ISnapshotService
{
    Task<string> CreateSnapshotAsync(Guid boardId, CancellationToken ct = default);
    Task<string?> GetLatestSnapshotKeyAsync(Guid boardId, CancellationToken ct = default);
    Task<Stream?> GetSnapshotStreamAsync(string s3Key, CancellationToken ct = default);
    Task<List<BoardSnapshotDto>> GetSnapshotHistoryAsync(Guid boardId, int limit = 10, CancellationToken ct = default);
}

public record BoardSnapshotDto(
    Guid Id,
    Guid BoardId,
    long SequenceNumber,
    string S3Key,
    DateTime CreatedAt,
    string PresignedUrl
);