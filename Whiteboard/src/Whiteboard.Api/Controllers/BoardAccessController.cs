using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Whiteboard.Application.Boards.DTOs;
using Whiteboard.Application.Common.Interfaces;
using Whiteboard.Domain.Enums;

namespace Whiteboard.Api.Controllers;

[ApiController]
[Route("api/boards/{boardId:guid}/access")]
[Authorize]
public class BoardAccessController : ControllerBase
{
    private readonly IBoardAccessService _accessService;

    public BoardAccessController(IBoardAccessService accessService) => _accessService = accessService;

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet("members")]
    public async Task<IActionResult> GetMembers(Guid boardId)
    {
        if (!await _accessService.CanViewAsync(boardId, CurrentUserId))
            return Forbid();

        var members = await _accessService.GetMembersAsync(boardId);
        return Ok(members);
    }

    [HttpPost("invite")]
    public async Task<IActionResult> InviteUser(Guid boardId, [FromBody] InviteUserRequest request)
    {
        try
        {
            var member = await _accessService.InviteUserByEmailAsync(
                boardId, CurrentUserId, request.Email, request.Role);
            return Ok(member);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPut("role")]
    public async Task<IActionResult> UpdateRole(Guid boardId, [FromBody] UpdateRoleRequest request)
    {
        try
        {
            await _accessService.UpdateRoleAsync(
                boardId, CurrentUserId, request.UserId, request.NewRole);
            return Ok();
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete("members/{userId:guid}")]
    public async Task<IActionResult> RemoveUser(Guid boardId, Guid userId)
    {
        try
        {
            await _accessService.RemoveUserAsync(boardId, CurrentUserId, userId);
            return NoContent();
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("invite-link")]
    public async Task<IActionResult> CreateInviteLink(
        Guid boardId,
        [FromBody] CreateInviteLinkRequest request)
    {
        try
        {
            var response = await _accessService.CreateInviteLinkAsync(
                boardId, CurrentUserId, request.Role,
                request.ExpirationHours, request.MaxUses);
            return Ok(response);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}

public record CreateInviteLinkRequest(
    BoardRole Role,
    int ExpirationHours = 24,
    int MaxUses = 100);