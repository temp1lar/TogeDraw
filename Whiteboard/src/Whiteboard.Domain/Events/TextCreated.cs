using System.Text.Json.Serialization;

namespace Whiteboard.Domain.Events;

public record TextCreated(
    [property: JsonPropertyName("elementId")] Guid ElementId,
    [property: JsonPropertyName("x")] float X,
    [property: JsonPropertyName("y")] float Y,
    [property: JsonPropertyName("text")] string Text,
    [property: JsonPropertyName("fontSize")] float FontSize,
    [property: JsonPropertyName("color")] string Color,
    [property: JsonPropertyName("strokeColor")] string? StrokeColor,
    [property: JsonPropertyName("strokeThickness")] float StrokeThickness
) : IEventData;