namespace HRIS.Api.Features.Attendance.DTOs;

public class AttendanceSummaryDto
{
    public int TotalRecords { get; set; }
    public int PresentCount { get; set; }
    public int LateCount { get; set; }
    public int UndertimeCount { get; set; }
    public int OvertimeCount { get; set; }
    public int AbsentCount { get; set; }

    public int PendingOvertimeRequests { get; set; }
    public int ApprovedOvertimeRequests { get; set; }
}