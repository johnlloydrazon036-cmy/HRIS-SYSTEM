using System.Security.Claims;
using HRIS.Api.Features.Attendance.DTOs;
using HRIS.Api.Features.Attendance.Services;
using HRIS.Api.Features.IAM.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HRIS.Api.Features.Attendance.Controllers;

[ApiController]
[Route("attendance/assignments")]
public class ShiftAssignmentsController : ControllerBase
{
    private readonly IShiftAssignmentsService _service;

    public ShiftAssignmentsController(IShiftAssignmentsService service)
    {
        _service = service;
    }

    [HttpPost]
    [PermissionAuthorize("ATTENDANCE", "Create")]
    public async Task<IActionResult> Assign([FromBody] AssignShiftRequest request, CancellationToken ct)
    {
        var result = await _service.AssignAsync(request, ct);
        return Ok(result);
    }

    [HttpGet("current/{employeeId}")]
    [PermissionAuthorize("ATTENDANCE", "View")]
    public async Task<IActionResult> GetCurrent(Guid employeeId, CancellationToken ct)
    {
        var result = await _service.GetCurrentAsync(employeeId, ct);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpGet("me/current-shift")]
    [Authorize]
    public async Task<IActionResult> GetMyCurrentShift(CancellationToken ct)
    {
        var userIdRaw =
            User.FindFirstValue(ClaimTypes.NameIdentifier) ??
            User.FindFirstValue("sub");

        if (!long.TryParse(userIdRaw, out var userId))
            return Unauthorized();

        var result = await _service.GetCurrentUserShiftAsync(userId, ct);
        return Ok(result);
    }

    [HttpGet("by-shift/{shiftId:int}")]
    [PermissionAuthorize("ATTENDANCE", "View")]
    public async Task<IActionResult> GetByShift(int shiftId, CancellationToken ct)
    {
        var result = await _service.GetByShiftAsync(shiftId, ct);
        return Ok(result);
    }

    [HttpDelete("{assignmentId:int}")]
    [PermissionAuthorize("ATTENDANCE", "Update")]
    public async Task<IActionResult> Unassign(int assignmentId, CancellationToken ct)
    {
        await _service.UnassignAsync(assignmentId, ct);
        return NoContent();
    }
}