using System.Text.Json.Serialization;
using Whiteboard.Domain.Enums;

namespace Whiteboard.Domain.Events;

public record ShapeCreated(
    [property: JsonPropertyName("elementId")] Guid ElementId,
    [property: JsonPropertyName("type")] ShapeType Type,
    [property: JsonPropertyName("x")] float X,
    [property: JsonPropertyName("y")] float Y,
    [property: JsonPropertyName("width")] float Width,
    [property: JsonPropertyName("height")] float Height,
    [property: JsonPropertyName("strokeColor")] string StrokeColor,
    [property: JsonPropertyName("fillColor")] string? FillColor,
    [property: JsonPropertyName("strokeWidth")] float StrokeWidth
) : IEventData;