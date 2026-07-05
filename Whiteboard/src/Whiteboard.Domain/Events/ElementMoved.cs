namespace Whiteboard.Domain.Events;

public record ElementMoved(Guid ElementId, float DeltaX, float DeltaY) : IEventData;