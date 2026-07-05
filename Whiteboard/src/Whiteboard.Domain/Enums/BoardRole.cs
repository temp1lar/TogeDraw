using System.Text.Json.Serialization;

namespace Whiteboard.Domain.Enums;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum BoardRole
{
    Viewer = 0,
    Editor = 1,
    Presenter = 2,
    Owner = 3
}