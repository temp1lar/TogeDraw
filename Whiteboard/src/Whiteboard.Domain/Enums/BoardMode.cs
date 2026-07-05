using System.Text.Json.Serialization;

namespace Whiteboard.Domain.Enums;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum BoardMode
{
    FreeForAll,
    PresenterOnly,
    ReadOnly
}