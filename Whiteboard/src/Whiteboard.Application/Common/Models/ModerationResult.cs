namespace Whiteboard.Application.Common.Models;
using System.Text.Json.Serialization;

public record ModerationResult(
    bool IsSafe,
    float Confidence,
    string? ViolationType,
    float ProbabilityUnsafe
);

public record DrawingRequest(List<List<List<float>>> Strokes);

public record ModerationResultDto(
    [property: JsonPropertyName("is_safe")] bool IsSafe,
    [property: JsonPropertyName("confidence")] float Confidence,
    [property: JsonPropertyName("probability_unsafe")] float ProbabilityUnsafe,
    [property: JsonPropertyName("message")] string Message
);