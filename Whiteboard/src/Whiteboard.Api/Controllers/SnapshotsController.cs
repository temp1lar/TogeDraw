using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Whiteboard.Application.Common.Interfaces;

namespace Whiteboard.Api.Controllers;

[ApiController]
[Route("api/boards/{boardId:guid}/snapshots")]
[Authorize]
public class SnapshotsController : ControllerBase
{
    private readonly ISnapshotService _snapshotService;
    private readonly IBoardAccessService _accessService;

    public SnapshotsController(
        ISnapshotService snapshotService,
        IBoardAccessService accessService)
    {
        _snapshotService = snapshotService;
        _accessService = accessService;
    }

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> GetSnapshotHistory(Guid boardId, [FromQuery] int limit = 10, CancellationToken ct = default)
    {
        if (!await _accessService.CanViewAsync(boardId, CurrentUserId, ct))
            return Forbid();

        var snapshots = await _snapshotService.GetSnapshotHistoryAsync(boardId, limit, ct);
        return Ok(snapshots);
    }

    [HttpPost]
    public async Task<IActionResult> CreateSnapshot(Guid boardId, CancellationToken ct)
    {
        if (!await _accessService.CanManageAsync(boardId, CurrentUserId, ct))
            return Forbid();

        var s3Key = await _snapshotService.CreateSnapshotAsync(boardId, ct);
        return Ok(new { s3Key });
    }

    [HttpGet("latest")]
    public async Task<IActionResult> GetLatestSnapshot(Guid boardId, CancellationToken ct)
    {
        if (!await _accessService.CanViewAsync(boardId, CurrentUserId, ct))
            return Forbid();

        var s3Key = await _snapshotService.GetLatestSnapshotKeyAsync(boardId, ct);
        if (s3Key == null)
            return NotFound(new { error = "No snapshots found" });

        var presignedUrl = await GetPresignedUrl(s3Key, ct);
        return Ok(new { s3Key, presignedUrl });
    }

    private async Task<string> GetPresignedUrl(string s3Key, CancellationToken ct)
    {
        return s3Key;
    }
}