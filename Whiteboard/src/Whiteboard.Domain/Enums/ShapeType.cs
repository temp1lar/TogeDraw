using System.Text.Json.Serialization;

namespace Whiteboard.Domain.Enums;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ShapeType
{
    Rectangle,
    Ellipse,
    Line,
    Arrow,
    Triangle,
    Diamond
}