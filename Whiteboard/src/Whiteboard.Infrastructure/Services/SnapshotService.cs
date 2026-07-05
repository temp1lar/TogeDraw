using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Text.Json;
using Whiteboard.Application.Common.Interfaces;
using Whiteboard.Application.Boards.DTOs;
using Whiteboard.Domain.Entities;
using Whiteboard.Domain.Events;
using Whiteboard.Infrastructure.Data;

namespace Whiteboard.Infrastructure.Services;

public class SnapshotService : ISnapshotService
{
    private readonly AppDbContext _db;
    private readonly IS3StorageService _s3Service;
    private readonly ILogger<SnapshotService> _logger;

    public SnapshotService(
        AppDbContext db,
        IS3StorageService s3Service,
        ILogger<SnapshotService> logger)
    {
        _db = db;
        _s3Service = s3Service;
        _logger = logger;
    }

    public async Task<string> CreateSnapshotAsync(Guid boardId, CancellationToken ct = default)
    {
        // Получаем последнее событие
        var lastEvent = await _db.BoardEvents
            .Where(e => e.BoardId == boardId)
            .OrderByDescending(e => e.SequenceNumber)
            .FirstOrDefaultAsync(ct);

        if (lastEvent == null)
        {
            _logger.LogWarning("No events found for board {BoardId}, skipping snapshot", boardId);
            return string.Empty;
        }

        // Получаем все события до текущего момента
        var events = await _db.BoardEvents
            .Where(e => e.BoardId == boardId && e.SequenceNumber <= lastEvent.SequenceNumber)
            .OrderBy(e => e.SequenceNumber)
            .Select(e => new
            {
                e.SequenceNumber,
                e.UserId,
                e.EventType,
                e.PayloadJson,
                e.CreatedAt
            })
            .ToListAsync(ct);

        // Сериализуем состояние в JSON
        var snapshotData = new
        {
            BoardId = boardId,
            SequenceNumber = lastEvent.SequenceNumber,
            CreatedAt = DateTime.UtcNow,
            Events = events
        };

        var json = JsonSerializer.Serialize(snapshotData);
        using var stream = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(json));

        // Загружаем в S3
        var fileName = $"snapshot_{lastEvent.SequenceNumber}_{DateTime.UtcNow:yyyyMMdd_HHmmss}.json";
        var folder = $"boards/{boardId}/snapshots";
        var s3Key = await _s3Service.UploadFileAsync(stream, fileName, "application/json", folder, ct);

        // Сохраняем метаданные в БД
        var snapshot = new BoardSnapshot
        {
            Id = Guid.NewGuid(),
            BoardId = boardId,
            SequenceNumber = lastEvent.SequenceNumber,
            S3Key = s3Key,
            CreatedAt = DateTime.UtcNow
        };

        _db.BoardSnapshots.Add(snapshot);

        // Обновляем последнюю ссылку на снапшот в Board
        var board = await _db.Boards.FindAsync(new object[] { boardId }, ct);
        if (board != null)
        {
            board.LastSnapshotJson = s3Key;
            board.LastSnapshotSequence = lastEvent.SequenceNumber;
            board.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(ct);

        _logger.LogInformation(
            "Created snapshot for board {BoardId} at sequence {Sequence}: {S3Key}",
            boardId, lastEvent.SequenceNumber, s3Key);

        return s3Key;
    }

    public async Task<string?> GetLatestSnapshotKeyAsync(Guid boardId, CancellationToken ct = default)
    {
        var snapshot = await _db.BoardSnapshots
            .Where(s => s.BoardId == boardId)
            .OrderByDescending(s => s.SequenceNumber)
            .FirstOrDefaultAsync(ct);

        return snapshot?.S3Key;
    }

    public async Task<Stream?> GetSnapshotStreamAsync(string s3Key, CancellationToken ct = default)
    {
        return await _s3Service.DownloadFileAsync(s3Key, ct);
    }

    public async Task<List<BoardSnapshotDto>> GetSnapshotHistoryAsync(
        Guid boardId, 
        int limit = 10, 
        CancellationToken ct = default)
    {
        var snapshots = await _db.BoardSnapshots
            .Where(s => s.BoardId == boardId)
            .OrderByDescending(s => s.SequenceNumber)
            .Take(limit)
            .ToListAsync(ct);

        var result = new List<BoardSnapshotDto>();

        foreach (var snapshot in snapshots)
        {
            var presignedUrl = await _s3Service.GetPresignedUrlAsync(snapshot.S3Key, 60, ct);
            result.Add(new BoardSnapshotDto(
                snapshot.Id,
                snapshot.BoardId,
                snapshot.SequenceNumber,
                snapshot.S3Key,
                snapshot.CreatedAt,
                presignedUrl
            ));
        }

        return result;
    }
}