namespace HRIS.Api.Features.Attendance.DTOs;

public class ShiftDto
{
    public int Id { get; set; }

    public string Code { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string? Description { get; set; }

    public int LateGraceMinutes { get; set; }

    public bool IsFlexible { get; set; }

    public bool IsActive { get; set; }

    public int AssignedCount { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public DateTime? UpdatedAtUtc { get; set; }

    public List<ShiftDayDto> Days { get; set; } = new();
}

public class ShiftDayDto
{
    public int Id { get; set; }

    public DayOfWeek DayOfWeek { get; set; }

    public bool IsWorkingDay { get; set; }

    public TimeOnly? StartTime { get; set; }

    public TimeOnly? BreakStartTime { get; set; }

    public TimeOnly? BreakEndTime { get; set; }

    public TimeOnly? EndTime { get; set; }
}
