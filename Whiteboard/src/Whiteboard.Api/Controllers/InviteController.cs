using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Whiteboard.Application.Common.Interfaces;

namespace Whiteboard.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class InviteController : ControllerBase
{
    private readonly IBoardAccessService _accessService;

    public InviteController(IBoardAccessService accessService) => _accessService = accessService;

    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpPost("accept/{inviteToken}")]
    public async Task<IActionResult> AcceptInvite(string inviteToken)
    {
        try
        {
            var member = await _accessService.AcceptInviteAsync(inviteToken, CurrentUserId);
            return Ok(member);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}