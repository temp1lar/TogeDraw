using Microsoft.AspNetCore.SignalR;
using Whiteboard.Api.Hubs;
using Whiteboard.Application.Common.Interfaces;

namespace Whiteboard.Api.Services;

public class BoardNotificationService : IBoardNotificationService
{
    private readonly IHubContext<BoardHub> _hubContext;
    private readonly ILogger<BoardNotificationService> _logger;

    public BoardNotificationService(
        IHubContext<BoardHub> hubContext,
        ILogger<BoardNotificationService> logger)
    {
        _hubContext = hubContext;
        _logger = logger;
    }

    public async Task NotifyContentViolationAsync(Guid boardId, string violationType, float confidence)
    {
        await _hubContext.Clients.Group($"board-{boardId}")
            .SendAsync("ContentViolation", new
            {
                violationType,
                confidence,
                message = "⚠️ Обнаружен нежелательный контент на доске",
                detectedAt = DateTime.UtcNow
            });
        
        _logger.LogInformation(
            "📢 Sent ContentViolation to board {BoardId}: {Type} ({Confidence}%)",
            boardId, violationType, confidence);
    }
}