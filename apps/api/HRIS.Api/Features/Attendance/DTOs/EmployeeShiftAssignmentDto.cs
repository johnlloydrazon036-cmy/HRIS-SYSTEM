namespace HRIS.Api.Features.Attendance.DTOs;

public sealed class EmployeeShiftAssignmentDto
{
    public int Id { get; set; }

    public Guid EmployeeId { get; set; }

    public int ShiftId { get; set; }

    public string? EmployeeNumber { get; set; }

    public string? FullName { get; set; }

    public string? Department { get; set; }

    public string? Position { get; set; }

    public string? EmploymentType { get; set; }

    public DateOnly EffectiveFrom { get; set; }

    public DateOnly? EffectiveTo { get; set; }

    public bool IsActive { get; set; }
}