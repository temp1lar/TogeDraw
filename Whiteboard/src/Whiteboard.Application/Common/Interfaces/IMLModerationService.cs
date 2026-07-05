using Whiteboard.Application.Common.Models;

namespace Whiteboard.Application.Common.Interfaces;

public interface IMLModerationService
{
    Task<ModerationResult> CheckDrawingAsync(List<List<List<float>>> strokes);
}