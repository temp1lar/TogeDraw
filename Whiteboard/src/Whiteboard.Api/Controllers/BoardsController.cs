using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Whiteboard.Domain.Entities;
using Whiteboard.Domain.Enums;
using Whiteboard.Infrastructure.Data;

namespace Whiteboard.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class BoardsController : ControllerBase
{
    private readonly AppDbContext _db;

    public BoardsController(AppDbContext db) => _db = db;

    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpPost]
    public async Task<IActionResult> CreateBoard([FromBody] CreateBoardRequest request)
    {
        var board = new Board
        {
            Id = Guid.NewGuid(),
            Title = request.Title,
            OwnerId = CurrentUserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.Boards.Add(board);

        _db.BoardPermissions.Add(new BoardPermission
        {
            Id = Guid.NewGuid(),
            BoardId = board.Id,
            UserId = CurrentUserId,
            Role = BoardRole.Owner
        });

        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetBoard), new { id = board.Id }, new
        {
            board.Id,
            board.Title,
            board.CreatedAt
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetMyBoards()
    {
        var boards = await _db.Boards
            .Where(b => b.OwnerId == CurrentUserId ||
                        b.Permissions.Any(p => p.UserId == CurrentUserId))
            .Select(b => new { b.Id, b.Title, b.CreatedAt, b.UpdatedAt })
            .ToListAsync();

        return Ok(boards);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetBoard(Guid id)
    {
        var board = await _db.Boards
            .Where(b => b.Id == id)
            .Select(b => new { b.Id, b.Title, b.CreatedAt, b.OwnerId })
            .FirstOrDefaultAsync();

        if (board == null) return NotFound();
        return Ok(board);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteBoard(Guid id)
    {
        var board = await _db.Boards.FindAsync(id);
        if (board == null) return NotFound();
        if (board.OwnerId != CurrentUserId) return Forbid();

        _db.Boards.Remove(board);
        await _db.SaveChangesAsync();

        return NoContent();
    }
}

public record CreateBoardRequest(string Title);