namespace HRIS.Api.Features.Attendance.DTOs;

public class UpdateAttendanceLogRequest
{
    public DateOnly Date { get; set; }
    public TimeSpan? TimeIn { get; set; }
    public TimeSpan? TimeOut { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? Remarks { get; set; }
    public string? Task { get; set; }
    public string? Accomplished { get; set; }
    public bool IsOT { get; set; }
}
