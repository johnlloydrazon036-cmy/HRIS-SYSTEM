using System.ComponentModel.DataAnnotations;

namespace HRIS.Api.Features.Attendance.DTOs;

public class ReviewOvertimeRequest
{
    [Required]
    public string Action { get; set; } = null!;
    // "Approve" or "Reject"

    [MaxLength(500)]
    public string? Remarks { get; set; }
}