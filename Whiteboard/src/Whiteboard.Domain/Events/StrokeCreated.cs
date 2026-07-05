using System.Text.Json.Serialization;

namespace Whiteboard.Domain.Events;

public record StrokeCreated(
    [property: JsonPropertyName("elementId")] Guid ElementId,
    [property: JsonPropertyName("points")] List<StrokePoint> Points,
    [property: JsonPropertyName("color")] string Color,
    [property: JsonPropertyName("thickness")] float Thickness
) : IEventData;

public record StrokePoint(
    [property: JsonPropertyName("x")] float X,
    [property: JsonPropertyName("y")] float Y,
    [property: JsonPropertyName("pressure")] float Pressure,
    [property: JsonPropertyName("timestamp")] long Timestamp
);