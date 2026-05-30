namespace HRIS.Api.Features.Attendance.DTOs;

public class AttendanceLogDto
{
    public long Id { get; set; }
    public Guid EmployeeId { get; set; }

    public string EmployeeNumber { get; set; } = string.Empty;
    public string EmployeeName { get; set; } = string.Empty;
    public string? EmployeeSuffix { get; set; }

    public DateOnly Date { get; set; }

    public TimeOnly? TimeIn { get; set; }
    public TimeOnly? TimeOut { get; set; }

    public int LateMinutes { get; set; }
    public int UndertimeMinutes { get; set; }
    public int OvertimeMinutes { get; set; }

    public string OvertimeStatus { get; set; } = "None";

    public int RenderedMinutes { get; set; }

    public int RequiredMinutes { get; set; }

    public int RegularCreditedMinutes { get; set; }

    public int OvertimeCreditedMinutes { get; set; }

    public int CreditedMinutes { get; set; }

    public int ExcessMinutes { get; set; }

    public bool HasExceededApprovedOvertime { get; set; }

    public bool IsPresent { get; set; }

    public string? Task { get; set; }

    public string? Accomplished { get; set; }

    public bool IsWorkingDay { get; set; }

    public bool CanTimeIn { get; set; }

    public string? BlockReason { get; set; }

    public bool IsHoliday { get; set; }

    public string? HolidayName { get; set; }

    public string? ShiftName { get; set; }

    public TimeOnly? ShiftStartTime { get; set; }

    public TimeOnly? TimeInOpenTime { get; set; }

    public TimeOnly? BreakStartTime { get; set; }

    public TimeOnly? BreakEndTime { get; set; }

    public TimeOnly? ShiftEndTime { get; set; }

    public int LateGraceMinutes { get; set; }
}