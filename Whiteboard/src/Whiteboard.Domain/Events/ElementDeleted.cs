namespace Whiteboard.Domain.Events;

public record ElementDeleted(Guid ElementId) : IEventData;