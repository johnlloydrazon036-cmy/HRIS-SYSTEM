using System.Security.Claims;
using HRIS.Api.Features.Attendance.DTOs;
using HRIS.Api.Features.Attendance.Services;
using HRIS.Api.Features.IAM.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HRIS.Api.Features.Attendance.Controllers;

[ApiController]
[Route("api/attendance/overtime-requests")]
[Authorize]
public class OvertimeRequestsController : ControllerBase
{
    private readonly OvertimeRequestService _service;

    public OvertimeRequestsController(OvertimeRequestService service)
    {
        _service = service;
    }

    [HttpGet]
    [PermissionAuthorize("ATTENDANCE", "View")]
    public async Task<ActionResult<PagedOvertimeRequestsResponse>> GetAll(
        [FromQuery] GetOvertimeRequestsQuery query)
    {
        var result = await _service.GetAllAsync(query);
        return Ok(result);
    }

    [HttpGet("me")]
    public async Task<ActionResult<PagedOvertimeRequestsResponse>> GetMine(
        [FromQuery] GetOvertimeRequestsQuery query)
    {
        var userId = GetUserId();
        var result = await _service.GetMineAsync(userId, query);
        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Submit([FromBody] SubmitOvertimeRequest request)
    {
        var userId = GetUserId();

        await _service.SubmitAsync(userId, request);

        return Ok(new
        {
            message = "Overtime request submitted successfully."
        });
    }

    [HttpPost("admin-assign")]
    [PermissionAuthorize("ATTENDANCE", "Update")]
    public async Task<IActionResult> AdminAssign([FromBody] AdminAssignOvertimeRequest request)
    {
        var userId = GetUserId();

        await _service.AdminAssignAsync(userId, request);

        return Ok(new
        {
            message = "Overtime assigned successfully."
        });
    }

    [HttpPatch("{id}/review")]
    [PermissionAuthorize("ATTENDANCE", "Update")]
    public async Task<IActionResult> Review(int id, [FromBody] ReviewOvertimeRequest request)
    {
        var userId = GetUserId();

        await _service.ReviewAsync(userId, id, request.Action, request.Remarks);

        var actionWord = string.Equals(request.Action, "Approve", StringComparison.OrdinalIgnoreCase)
            ? "approved"
            : "rejected";

        return Ok(new
        {
            message = $"Overtime request {actionWord} successfully."
        });
    }

    private long GetUserId()
    {
        var value =
            User.FindFirstValue("userId") ??
            User.FindFirstValue("id") ??
            User.FindFirstValue(ClaimTypes.NameIdentifier) ??
            User.FindFirstValue("sub");

        if (string.IsNullOrWhiteSpace(value))
            throw new UnauthorizedAccessException("User context missing.");

        return long.Parse(value);
    }
}