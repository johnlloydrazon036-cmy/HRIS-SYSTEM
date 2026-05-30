namespace HRIS.Api.Features.Attendance.DTOs;

public class OvertimeRequestDto
{
    public int Id { get; set; }

    public Guid EmployeeId { get; set; }
    public string EmployeeNumber { get; set; } = null!;
    public string EmployeeName { get; set; } = null!;

    public DateOnly AttendanceDate { get; set; }

    public DateOnly DateFrom { get; set; }
    public DateOnly DateTo { get; set; }

    public int RequestedMinutes { get; set; }

    public int RequestedMinutesPerDay { get; set; }
    public int TotalRequestedMinutes { get; set; }

    public string? Reason { get; set; }

    public string Status { get; set; } = null!;

    public long? ReviewedByUserId { get; set; }
    public string? ReviewedByName { get; set; }

    public DateTime? ReviewedAtUtc { get; set; }
    public string? ReviewRemarks { get; set; }

    public DateTime CreatedAtUtc { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
}
