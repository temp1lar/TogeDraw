using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Whiteboard.Application.Common.Interfaces;

namespace Whiteboard.Api.Controllers;

[ApiController]
[Route("api/boards/{boardId:guid}/images")]
[Authorize]
public class ImagesController : ControllerBase
{
    private readonly IImageUploadService _imageService;
    private readonly IBoardAccessService _accessService;

    public ImagesController(
        IImageUploadService imageService,
        IBoardAccessService accessService)
    {
        _imageService = imageService;
        _accessService = accessService;
    }

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpPost]
    [RequestSizeLimit(10 * 1024 * 1024)] // 10 MB
    public async Task<IActionResult> UploadImage(
        Guid boardId, 
        IFormFile file,
        [FromForm] int width = 0,
        [FromForm] int height = 0,
        CancellationToken ct = default)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { error = "No file uploaded" });

        if (!await _accessService.CanEditAsync(boardId, CurrentUserId, ct))
            return Forbid();

        try
        {
            using var stream = file.OpenReadStream();
            var result = await _imageService.UploadImageAsync(
                boardId, 
                CurrentUserId, 
                stream, 
                file.FileName, 
                file.ContentType,
                width,
                height,
                ct);

            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}