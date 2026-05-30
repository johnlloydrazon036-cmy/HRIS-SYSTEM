namespace HRIS.Api.Features.Attendance.DTOs;

public class UpdateShiftRequest
{
    public string Code { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string? Description { get; set; }

    public int LateGraceMinutes { get; set; }

    public bool IsFlexible { get; set; }

    public List<ShiftDayRequest> Days { get; set; } = new();
}