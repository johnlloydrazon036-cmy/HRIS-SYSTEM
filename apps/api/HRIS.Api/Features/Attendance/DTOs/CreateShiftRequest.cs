namespace HRIS.Api.Features.Attendance.DTOs;

public class CreateShiftRequest
{
    public string Code { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string? Description { get; set; }

    public int LateGraceMinutes { get; set; } = 0;

    public bool IsFlexible { get; set; } = false;

    public List<ShiftDayRequest> Days { get; set; } = new();
}

public class ShiftDayRequest
{
    public DayOfWeek DayOfWeek { get; set; }

    public bool IsWorkingDay { get; set; }

    public TimeOnly? StartTime { get; set; }

    public TimeOnly? BreakStartTime { get; set; }

    public TimeOnly? BreakEndTime { get; set; }

    public TimeOnly? EndTime { get; set; }
}