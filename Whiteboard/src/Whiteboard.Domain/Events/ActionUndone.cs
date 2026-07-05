using System.Text.Json.Serialization;

namespace Whiteboard.Domain.Events;

public record ActionUndone(
    [property: JsonPropertyName("undoneSequenceNumber")] long UndoneSequenceNumber,
    [property: JsonPropertyName("undoneUserId")] string UndoneUserId,
    [property: JsonPropertyName("undoneEventType")] string UndoneEventType
) : IEventData;