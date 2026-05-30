using HRIS.Api.Features.Attendance.DTOs;
using HRIS.Api.Features.Attendance.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HRIS.Api.Features.Attendance.Controllers;

[ApiController]
[Route("attendance/logs")]
[Authorize]
public class AttendanceLogsController : ControllerBase
{
    private readonly IAttendanceLogsService _service;

    public AttendanceLogsController(IAttendanceLogsService service)
    {
        _service = service;
    }

    [HttpPost("time-in")]
    public async Task<ActionResult<AttendanceLogDto>> TimeIn(
        [FromBody] TimeInRequest request,
        CancellationToken ct)
    {
        var result = await _service.TimeInAsync(User, request, ct);
        return Ok(result);
    }

    [HttpPost("time-out")]
    public async Task<ActionResult<AttendanceLogDto>> TimeOut(
        [FromBody] TimeOutRequest request,
        CancellationToken ct)
    {
        var result = await _service.TimeOutAsync(User, request, ct);
        return Ok(result);
    }

    [HttpGet("me")]
    public async Task<ActionResult<PagedAttendanceLogsResponse>> GetMyLogs(
        [FromQuery] GetAttendanceLogsQuery query,
        CancellationToken ct)
    {
        var result = await _service.GetMyLogsAsync(User, query, ct);
        return Ok(result);
    }

    [HttpGet("me/today")]
    public async Task<ActionResult<AttendanceLogDto?>> GetToday(CancellationToken ct)
    {
        var result = await _service.GetTodayMyLogAsync(User, ct);
        return Ok(result);
    }

    [HttpGet("monitoring")]
    public async Task<ActionResult<PagedAttendanceLogsResponse>> GetMonitoring(
        [FromQuery] GetAttendanceLogsQuery query,
        CancellationToken ct)
    {
        var result = await _service.GetMonitoringAsync(query, ct);
        return Ok(result);
    }

    [HttpGet("summary")]
    public async Task<ActionResult<AttendanceSummaryDto>> GetSummary(
        [FromQuery] GetAttendanceLogsQuery query,
        CancellationToken ct)
    {
        var result = await _service.GetSummaryAsync(query, ct);
        return Ok(result);
    }

    [HttpGet("export")]
    public async Task<IActionResult> Export(
        [FromQuery] GetAttendanceLogsQuery query,
        CancellationToken ct)
    {
        var file = await _service.ExportCsvAsync(query, ct);
        return File(file, "text/csv", "attendance.csv");
    }

    [HttpPut("{id:long}")]
    public async Task<ActionResult<AttendanceLogDto>> Update(
        long id,
        [FromBody] UpdateAttendanceLogRequest request,
        CancellationToken ct)
    {
        var result = await _service.UpdateAsync(id, request, ct);
        return Ok(result);
    }
}