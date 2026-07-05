using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Whiteboard.Application.Common.Interfaces;
using Whiteboard.Domain.Entities;
using Whiteboard.Domain.Events;
using Whiteboard.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using Whiteboard.Application.Common.Models;

namespace Whiteboard.Infrastructure.Services;

public class SnapshotBackgroundService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IMLModerationService _mlModeration;
    private readonly ILogger<SnapshotBackgroundService> _logger;
    private readonly int _intervalSeconds;
    private readonly int _minEventsForSnapshot;

    public SnapshotBackgroundService(
        IServiceProvider serviceProvider,
        IMLModerationService mlModeration,
        IConfiguration config,
        ILogger<SnapshotBackgroundService> logger)
    {
        _serviceProvider = serviceProvider;
        _mlModeration = mlModeration;
        _logger = logger;
        _intervalSeconds = config.GetValue<int>("SnapshotSettings:IntervalSeconds", 30);
        _minEventsForSnapshot = config.GetValue<int>("SnapshotSettings:MinEventsForSnapshot", 5);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Snapshot background service started. Interval: {Interval}s", _intervalSeconds);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(_intervalSeconds), stoppingToken);
                await ProcessActiveBoardsAsync(stoppingToken);
            }
            catch (Exception ex) when (!(ex is OperationCanceledException))
            {
                _logger.LogError(ex, "Error in snapshot background service");
            }
        }
    }

    private async Task ProcessActiveBoardsAsync(CancellationToken ct)
{
    _logger.LogInformation("🔍 Checking active boards for snapshots...");
    
    using var scope = _serviceProvider.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var snapshotService = scope.ServiceProvider.GetRequiredService<ISnapshotService>();

    var activeBoards = await db.Boards
        .Where(b => b.UpdatedAt > DateTime.UtcNow.AddMinutes(-5))
        .ToListAsync(ct);

    _logger.LogInformation("📊 Found {Count} active boards", activeBoards.Count);

    foreach (var board in activeBoards)
    {
        _logger.LogInformation("🔍 Checking board {BoardId}...", board.Id);
        
        var newEventsCount = await db.BoardEvents
            .Where(e => e.BoardId == board.Id && 
                       e.SequenceNumber > board.LastSnapshotSequence)
            .CountAsync(ct);

        _logger.LogInformation(
            "📈 Board {BoardId}: LastSnapshotSeq={LastSeq}, NewEvents={NewCount}, Threshold={Threshold}",
            board.Id, board.LastSnapshotSequence, newEventsCount, _minEventsForSnapshot);

        if (newEventsCount >= _minEventsForSnapshot)
        {
            _logger.LogInformation("✅ Creating snapshot for board {BoardId}...", board.Id);
            
            try
            {
                var snapshotKey = await snapshotService.CreateSnapshotAsync(board.Id, ct);
                
                _logger.LogInformation("✅ Snapshot created: {Key}", snapshotKey);
                
                // Проверяем снапшот через ML
                await CheckSnapshotForViolationsAsync(board.Id, snapshotKey, ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Failed to create snapshot for board {BoardId}", board.Id);
            }
        }
        else
        {
            _logger.LogInformation("⏭️ Skipping board {BoardId}: not enough events", board.Id);
        }
    }
}

    private async Task CheckSnapshotForViolationsAsync(Guid boardId, string snapshotKey, CancellationToken ct)
{
    using var scope = _serviceProvider.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var s3Service = scope.ServiceProvider.GetRequiredService<IS3StorageService>();

    try
    {
        _logger.LogInformation("🔍 Starting ML check for snapshot {Key}", snapshotKey);
        
        // 1. Скачиваем снапшот из S3
        var snapshotStream = await s3Service.DownloadFileAsync(snapshotKey);
        if (snapshotStream == null)
        {
            _logger.LogWarning("⚠️ Failed to download snapshot {SnapshotKey}", snapshotKey);
            return;
        }
        
        var snapshotJson = await System.Text.Json.JsonSerializer.DeserializeAsync<SnapshotData>(snapshotStream);
        if (snapshotJson?.Events == null)
        {
            _logger.LogWarning("⚠️ Invalid snapshot data for {SnapshotKey}", snapshotKey);
            return;
        }
        
        // 2. Извлекаем ВСЕ точки из всех StrokeCreated событий
        var allPoints = new List<(float X, float Y)>();
        var strokesRaw = new List<List<(float X, float Y)>>();
        
        foreach (var eventData in snapshotJson.Events)
        {
            if (eventData.EventType == "StrokeCreated")
            {
                try
                {
                    var stroke = System.Text.Json.JsonSerializer.Deserialize<StrokeCreatedDto>(
                        eventData.PayloadJson,
                        new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                    
                    if (stroke?.Points != null && stroke.Points.Count > 0)
                    {
                        var strokePoints = stroke.Points.Select(p => (p.X, p.Y)).ToList();
                        strokesRaw.Add(strokePoints);
                        allPoints.AddRange(strokePoints);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to parse StrokeCreated payload");
                }
            }
        }

        if (strokesRaw.Count == 0 || allPoints.Count == 0)
        {
            _logger.LogInformation("⏭️ No strokes to check in snapshot {Key}", snapshotKey);
            return;
        }

        _logger.LogInformation("📊 Found {StrokesCount} strokes, {PointsCount} points total", 
            strokesRaw.Count, allPoints.Count);

        // 3. НОРМАЛИЗАЦИЯ к [0, 1] (как требует модель)
        var minX = allPoints.Min(p => p.X);
        var maxX = allPoints.Max(p => p.X);
        var minY = allPoints.Min(p => p.Y);
        var maxY = allPoints.Max(p => p.Y);
        
        var rangeX = Math.Max(maxX - minX, 1f); // Избегаем деления на 0
        var rangeY = Math.Max(maxY - minY, 1f);

        _logger.LogInformation("📐 Normalization ranges: X=[{MinX}, {MaxX}], Y=[{MinY}, {MaxY}]", 
            minX, maxX, minY, maxY);

        // Нормализуем каждый штрих
        var normalizedStrokes = new List<List<List<float>>>();
        foreach (var stroke in strokesRaw)
        {
            var normalizedStroke = stroke.Select(p => new List<float>
            {
                (p.X - minX) / rangeX,  // [0, 1]
                (p.Y - minY) / rangeY   // [0, 1]
            }).ToList();
            normalizedStrokes.Add(normalizedStroke);
        }

        // 4. Отправляем на проверку ML
        _logger.LogInformation("🚀 Sending {StrokesCount} strokes to ML service...", normalizedStrokes.Count);
        
        var moderationResult = await _mlModeration.CheckDrawingAsync(normalizedStrokes);
        
        _logger.LogInformation(
            "✅ ML result: IsSafe={IsSafe}, Confidence={Confidence}%, ProbUnsafe={ProbUnsafe}",
            moderationResult.IsSafe, moderationResult.Confidence, moderationResult.ProbabilityUnsafe);
        
        if (!moderationResult.IsSafe)
{
    _logger.LogWarning(
        "⚠️ VIOLATION detected on board {BoardId}: {Type} (confidence: {Confidence}%)",
        boardId, moderationResult.ViolationType, moderationResult.Confidence);

    // Сохраняем нарушение в БД
    await db.BoardViolations.AddAsync(new BoardViolation
    {
        Id = Guid.NewGuid(),
        BoardId = boardId,
        SnapshotKey = snapshotKey,
        ViolationType = moderationResult.ViolationType ?? "Unknown",
        Confidence = moderationResult.Confidence,
        DetectedAt = DateTime.UtcNow
    }, ct);
    
    await db.SaveChangesAsync(ct);

    // === НОВОЕ: Уведомляем клиентов через SignalR ===
    try
    {
try
{
    var notificationService = scope.ServiceProvider
        .GetRequiredService<IBoardNotificationService>();
    
    await notificationService.NotifyContentViolationAsync(
        boardId,
        moderationResult.ViolationType ?? "Unknown",
        moderationResult.Confidence
    );
    
    _logger.LogInformation("📢 Sent ContentViolation notification to board {BoardId}", boardId);
}
catch (Exception ex)
{
    _logger.LogError(ex, "Failed to send ContentViolation notification");
}
        
        _logger.LogInformation("📢 Sent ContentViolation notification to board {BoardId}", boardId);
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Failed to send ContentViolation notification");
    }
}
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "❌ Failed to check snapshot {SnapshotKey} for violations", snapshotKey);
    }
}

// DTOs для десериализации снапшота
public record SnapshotData(List<SnapshotEvent> Events);
public record SnapshotEvent(string EventType, string PayloadJson);
public record StrokeCreatedDto(
    Guid ElementId,
    List<StrokePointDto> Points,
    string Color,
    float Thickness
);
public record StrokePointDto(float X, float Y, float Pressure, long Timestamp);
}