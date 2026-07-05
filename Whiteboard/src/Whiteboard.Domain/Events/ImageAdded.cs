namespace Whiteboard.Domain.Events;

public record ImageAdded(
    Guid ElementId,
    string S3Key,
    float X,
    float Y,
    float Width,
    float Height
) : IEventData;