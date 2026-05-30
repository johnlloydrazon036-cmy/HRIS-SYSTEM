namespace HRIS.Api.Features.Attendance.DTOs;

public class PagedAttendanceLogsResponse
{
    public List<AttendanceLogDto> Items { get; set; } = new();

    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
}