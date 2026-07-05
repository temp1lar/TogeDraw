using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;
using System.Text.Json;
using Whiteboard.Application.Common.Interfaces;
using Whiteboard.Domain.Entities;
using Whiteboard.Domain.Enums;
using Whiteboard.Domain.Events;
using Whiteboard.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Whiteboard.Api.Hubs;

[Authorize]
public class BoardHub : Hub
{
    private readonly AppDbContext _db;
    private readonly IBoardAccessService _accessService;
    private readonly ILogger<BoardHub> _logger;

    public BoardHub(
        AppDbContext db, 
        IBoardAccessService accessService, 
        ILogger<BoardHub> logger)
    {
        _db = db;
        _accessService = accessService;
        _logger = logger;
    }

    private Guid CurrentUserId => 
        Guid.Parse(Context.User!.FindFirstValue(ClaimTypes.NameIdentifier)!);

    public override async Task OnConnectedAsync()
    {
        var boardIdStr = Context.GetHttpContext()?.Request.Query["boardId"].ToString();
        
        if (string.IsNullOrEmpty(boardIdStr) || !Guid.TryParse(boardIdStr, out var boardId))
        {
            _logger.LogWarning("Connection without valid boardId");
            Context.Abort();
            return;
        }

        // Проверяем доступ
        if (!await _accessService.CanViewAsync(boardId, CurrentUserId))
        {
            _logger.LogWarning("User {UserId} has no access to board {BoardId}", 
                CurrentUserId, boardId);
            await Clients.Caller.SendAsync("AccessDenied", "You don't have access to this board");
            Context.Abort();
            return;
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, $"board-{boardId}");
        
        // Уведомляем остальных о новом участнике
        await Clients.Group($"board-{boardId}").SendAsync("UserJoined", new
        {
            UserId = CurrentUserId,
            DisplayName = Context.User!.FindFirstValue(ClaimTypes.Name)
        });

        _logger.LogInformation("User {UserId} connected to board {BoardId}", 
            CurrentUserId, boardId);
        
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var boardIdStr = Context.GetHttpContext()?.Request.Query["boardId"].ToString();
        if (Guid.TryParse(boardIdStr, out var boardId))
        {
            await Clients.Group($"board-{boardId}").SendAsync("UserLeft", new
            {
                UserId = CurrentUserId,
                DisplayName = Context.User?.FindFirstValue(ClaimTypes.Name)
            });
        }

        _logger.LogInformation("User {UserId} disconnected", CurrentUserId);
        await base.OnDisconnectedAsync(exception);
    }

  
    public async Task DrawStroke(Guid boardId, StrokeCreated stroke)
{
    _logger.LogInformation(
        "DrawStroke received: BoardId={BoardId}, ElementId={ElementId}, Points={PointsCount}, Color={Color}, Thickness={Thickness}",
        boardId,
        stroke.ElementId,
        stroke.Points?.Count ?? 0,
        stroke.Color,
        stroke.Thickness
    );
    
    if (!await CanEdit(boardId)) return;
    await AppendAndBroadcast(boardId, stroke);
}
  
    public async Task AddImage(Guid boardId, ImageAdded image)
    {
        if (!await CanEdit(boardId)) return;
        await AppendAndBroadcast(boardId, image);
    }

    public async Task CreateShape(Guid boardId, ShapeCreated shape)
    {
        if (!await CanEdit(boardId)) return;
        await AppendAndBroadcast(boardId, shape);
    }

    public async Task MoveElement(Guid boardId, ElementMoved move)
    {
        if (!await CanEdit(boardId)) return;
        await AppendAndBroadcast(boardId, move);
    }

    public async Task DeleteElement(Guid boardId, ElementDeleted delete)
    {
        if (!await CanEdit(boardId)) return;
        await AppendAndBroadcast(boardId, delete);
    }

    public async Task ChangeMode(Guid boardId, BoardMode mode, Guid? presenterId)
    {
        var role = await _accessService.GetUserRoleAsync(boardId, CurrentUserId);
        if (role < BoardRole.Presenter)
        {
            await Clients.Caller.SendAsync("Error", "Only presenters can change mode");
            return;
        }

        var eventData = new BoardModeChanged(mode, presenterId);
        await AppendAndBroadcast(boardId, eventData);
    }

    public async Task AddText(Guid boardId, TextCreated text)
{
    _logger.LogInformation(
        "AddText received: BoardId={BoardId}, ElementId={ElementId}, Text={Text}, FontSize={FontSize}",
        boardId,
        text.ElementId,
        text.Text,
        text.FontSize
    );
    
    if (!await CanEdit(boardId)) return;
    await AppendAndBroadcast(boardId, text);
}
    public async Task RequestHistory(Guid boardId, long afterSequence)
    {
        if (!await _accessService.CanViewAsync(boardId, CurrentUserId))
        {
            await Clients.Caller.SendAsync("AccessDenied", "No access");
            return;
        }

        var events = await _db.BoardEvents
            .Where(e => e.BoardId == boardId && e.SequenceNumber > afterSequence)
            .OrderBy(e => e.SequenceNumber)
            .Take(1000)
            .Select(e => new
            {
                e.SequenceNumber,
                e.UserId,
                e.EventType,
                e.PayloadJson,
                e.CreatedAt
            })
            .ToListAsync();

        await Clients.Caller.SendAsync("HistoryResponse", events);
    }
    
 public async Task UndoLastAction(Guid boardId)
{
    if (!await CanEdit(boardId)) return;
    
    // Шаг 1: Получаем все события текущего пользователя (КРОМЕ ActionUndone!)
    var userEvents = await _db.BoardEvents
        .Where(e => e.BoardId == boardId 
                 && e.UserId == CurrentUserId
                 && e.EventType != nameof(ActionUndone))  // ← КРИТИЧНО!
        .OrderByDescending(e => e.SequenceNumber)
        .ToListAsync();
    
    // Шаг 2: Получаем все отменённые sequence numbers
    var undoneSequences = await _db.BoardEvents
        .Where(e => e.BoardId == boardId && e.EventType == nameof(ActionUndone))
        .Select(e => e.PayloadJson)
        .ToListAsync();
    
    var undoneSet = new HashSet<long>();
    foreach (var json in undoneSequences)
    {
        try
        {
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var action = JsonSerializer.Deserialize<ActionUndone>(json, options);
            if (action != null)
            {
                undoneSet.Add(action.UndoneSequenceNumber);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse ActionUndone payload");
        }
    }
    
    // Шаг 3: Находим последнее неотменённое событие
    var lastUserEvent = userEvents
        .FirstOrDefault(e => !undoneSet.Contains(e.SequenceNumber));
    
    if (lastUserEvent == null)
    {
        await Clients.Caller.SendAsync("Error", "Нет действий для отмены");
        return;
    }
    
    _logger.LogInformation(
        "Undo requested: BoardId={BoardId}, UserId={UserId}, UndoneSeq={Seq}, EventType={Type}",
        boardId, CurrentUserId, lastUserEvent.SequenceNumber, lastUserEvent.EventType);
    
    var undoEvent = new ActionUndone(
        lastUserEvent.SequenceNumber,
        lastUserEvent.UserId.ToString(),
        lastUserEvent.EventType
    );
    
    await AppendAndBroadcast(boardId, undoEvent);
}

    public async Task ClearBoard(Guid boardId)
    {
        var role = await _accessService.GetUserRoleAsync(boardId, CurrentUserId);
        if (role != BoardRole.Owner)
        {
            await Clients.Caller.SendAsync("Error", "Только владелец может очистить холст");
            return;
        }

        var eventsToRemove = await _db.BoardEvents
            .Where(e => e.BoardId == boardId)
            .ToListAsync();

        if (eventsToRemove.Any())
        {
            _db.BoardEvents.RemoveRange(eventsToRemove);
            
            var board = await _db.Boards.FindAsync(boardId);
            if (board != null)
            {
                board.UpdatedAt = DateTime.UtcNow;
            }

            await _db.SaveChangesAsync();
            _logger.LogInformation("Доска {BoardId} полностью очищена пользователем {UserId}. Удалено {Count} событий.", 
                boardId, CurrentUserId, eventsToRemove.Count);
        }
        else
        {
            _logger.LogInformation("Доска {BoardId} пуста, очистка не требуется.", boardId);
        }

        await Clients.Group($"board-{boardId}").SendAsync("BoardEventReceived", new
        {
            SequenceNumber = 0,
            UserId = CurrentUserId,
            UserName = Context.User!.FindFirstValue(ClaimTypes.Name),
            EventType = "BoardCleared",
            Payload = new { },
            Timestamp = DateTime.UtcNow
        });
    }

    private async Task<bool> CanEdit(Guid boardId)
    {
        // Проверяем базовые права
        if (!await _accessService.CanEditAsync(boardId, CurrentUserId))
        {
            await Clients.Caller.SendAsync("Error", "No edit permission");
            return false;
        }

        // Проверяем режим доски
        var lastModeEvent = await _db.BoardEvents
            .Where(e => e.BoardId == boardId && e.EventType == nameof(BoardModeChanged))
            .OrderByDescending(e => e.SequenceNumber)
            .FirstOrDefaultAsync();

        if (lastModeEvent != null)
        {
            var mode = JsonSerializer.Deserialize<BoardModeChanged>(
                lastModeEvent.PayloadJson, 
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (mode != null)
            {
                if (mode.Mode == BoardMode.ReadOnly)
                {
                    await Clients.Caller.SendAsync("Error", "Board is in read-only mode");
                    return false;
                }

                if (mode.Mode == BoardMode.PresenterOnly)
                {
                    var role = await _accessService.GetUserRoleAsync(boardId, CurrentUserId);
                    if (role < BoardRole.Presenter && CurrentUserId != mode.ActivePresenterId)
                    {
                        await Clients.Caller.SendAsync("Error", "Only presenter can edit");
                        return false;
                    }
                }
            }
        }

        return true;
    }

private async Task AppendAndBroadcast(Guid boardId, IEventData eventData)
{
    var lastSeq = await _db.BoardEvents
        .Where(e => e.BoardId == boardId)
        .MaxAsync(e => (long?)e.SequenceNumber) ?? 0;
    var nextSeq = lastSeq + 1;

    var boardEvent = new BoardEvent
    {
        Id = Guid.NewGuid(),
        BoardId = boardId,
        UserId = CurrentUserId,
        SequenceNumber = nextSeq,
        EventType = eventData.GetType().Name,
        PayloadJson = JsonSerializer.Serialize(eventData, eventData.GetType(), new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = false
        }),
        CreatedAt = DateTime.UtcNow
    };

    _db.BoardEvents.Add(boardEvent);
    
    // === НОВОЕ: Обновляем Board.UpdatedAt ===
    var board = await _db.Boards.FindAsync(boardId);
    if (board != null)
    {
        board.UpdatedAt = DateTime.UtcNow;
    }
    
    await _db.SaveChangesAsync();

    // Сериализуем payload для SignalR
    var payloadJson = JsonSerializer.Serialize(
        eventData,
        eventData.GetType(),
        new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = false
        });
    var payload = JsonSerializer.Deserialize<System.Text.Json.JsonElement>(payloadJson);

    await Clients.Group($"board-{boardId}")
        .SendAsync("BoardEventReceived", new
        {
            SequenceNumber = nextSeq,
            UserId = CurrentUserId,
            UserName = Context.User!.FindFirstValue(ClaimTypes.Name),
            EventType = eventData.GetType().Name,
            Payload = payload,
            Timestamp = boardEvent.CreatedAt
        });
}
}