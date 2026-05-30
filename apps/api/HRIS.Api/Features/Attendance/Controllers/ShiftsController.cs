using HRIS.Api.Features.Attendance.DTOs;
using HRIS.Api.Features.Attendance.Services;
using HRIS.Api.Features.IAM.Controllers;
using Microsoft.AspNetCore.Mvc;

namespace HRIS.Api.Features.Attendance.Controllers;

[ApiController]
[Route("shifts")]
public class ShiftsController : ControllerBase
{
    private readonly IShiftsService _service;

    public ShiftsController(IShiftsService service)
    {
        _service = service;
    }

    [HttpGet]
    [PermissionAuthorize("ATTENDANCE", "View")]
    public async Task<IActionResult> Get([FromQuery] GetShiftQuery query, CancellationToken ct)
    {
        var result = await _service.GetShiftsAsync(query, ct);
        return Ok(result);
    }

    [HttpGet("{id}")]
    [PermissionAuthorize("ATTENDANCE", "View")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var result = await _service.GetByIdAsync(id, ct);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPost]
    [PermissionAuthorize("ATTENDANCE", "Create")]
    public async Task<IActionResult> Create([FromBody] CreateShiftRequest request, CancellationToken ct)
    {
        var result = await _service.CreateAsync(request, ct);
        return Ok(result);
    }

    [HttpPut("{id}")]
    [PermissionAuthorize("ATTENDANCE", "Update")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateShiftRequest request, CancellationToken ct)
    {
        var result = await _service.UpdateAsync(id, request, ct);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpPatch("{id}/status")]
    [PermissionAuthorize("ATTENDANCE", "Archive")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateShiftStatusRequest request, CancellationToken ct)
    {
        var success = await _service.UpdateStatusAsync(id, request, ct);
        return success ? Ok() : NotFound();
    }
}