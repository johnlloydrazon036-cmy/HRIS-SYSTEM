using System;

namespace HRIS.Api.Models;

public class ShiftDay
{
    public int Id { get; set; }

    public int ShiftId { get; set; }
    public Shift Shift { get; set; } = null!;

    public DayOfWeek DayOfWeek { get; set; }
    public bool IsWorkingDay { get; set; }

    public TimeOnly? StartTime { get; set; }
    public TimeOnly? BreakStartTime { get; set; }
    public TimeOnly? BreakEndTime { get; set; }
    public TimeOnly? EndTime { get; set; }
}