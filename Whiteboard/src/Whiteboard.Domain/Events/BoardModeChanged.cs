using Whiteboard.Domain.Enums;

namespace Whiteboard.Domain.Events;

public record BoardModeChanged(BoardMode Mode, Guid? ActivePresenterId) : IEventData;