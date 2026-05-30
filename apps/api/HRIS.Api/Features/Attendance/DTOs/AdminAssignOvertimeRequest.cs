using System.ComponentModel.DataAnnotations;

namespace HRIS.Api.Features.Attendance.DTOs;

public class AdminAssignOvertimeRequest
{
    [Required]
    public Guid EmployeeId { get; set; }

    [Required]
    public DateOnly DateFrom { get; set; }

    [Required]
    public DateOnly DateTo { get; set; }

    [Required]
    [Range(1, int.MaxValue)]
    public int RequestedMinutes { get; set; }

    [MaxLength(500)]
    public string? Reason { get; set; }
}