using System.Security.Claims;
using HRIS.Api.Features.Attendance.DTOs;

namespace HRIS.Api.Features.Attendance.Services;

public interface IAttendanceLogsService
{
    Task<AttendanceLogDto> TimeInAsync(ClaimsPrincipal user, TimeInRequest request, CancellationToken ct);
    Task<AttendanceLogDto> TimeOutAsync(ClaimsPrincipal user, TimeOutRequest request, CancellationToken ct);
    Task<PagedAttendanceLogsResponse> GetMyLogsAsync(ClaimsPrincipal user, GetAttendanceLogsQuery query, CancellationToken ct);
    Task<AttendanceLogDto?> GetTodayMyLogAsync(ClaimsPrincipal user, CancellationToken ct);
    Task<PagedAttendanceLogsResponse> GetLogsAsync(GetAttendanceLogsQuery query, CancellationToken ct);
    Task<PagedAttendanceLogsResponse> GetMonitoringAsync(GetAttendanceLogsQuery query, CancellationToken ct);
    Task<AttendanceSummaryDto> GetSummaryAsync(GetAttendanceLogsQuery query, CancellationToken ct);
    Task<byte[]> ExportCsvAsync(GetAttendanceLogsQuery query, CancellationToken ct);
    Task<AttendanceLogDto> UpdateAsync(long id, UpdateAttendanceLogRequest request, CancellationToken ct);
}