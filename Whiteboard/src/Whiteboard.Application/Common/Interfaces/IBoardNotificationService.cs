namespace Whiteboard.Application.Common.Interfaces;

public interface IBoardNotificationService
{
    Task NotifyContentViolationAsync(Guid boardId, string violationType, float confidence);
}