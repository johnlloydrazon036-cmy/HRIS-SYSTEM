namespace HRIS.Api.Features.Attendance.DTOs;

public class AssignShiftRequest
{
    public Guid EmployeeId { get; set; }

    public int ShiftId { get; set; }

    public DateOnly EffectiveFrom { get; set; }
}