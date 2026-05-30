using System.ComponentModel.DataAnnotations;

namespace HRIS.Api.Models;

public class OvertimeRequestItem
{
    public int Id { get; set; }

    [Required]
    public int OvertimeRequestId { get; set; }

    public OvertimeRequest OvertimeRequest { get; set; } = null!;

    [Required]
    public DateOnly Date { get; set; }

    [Required]
    public int RequestedMinutes { get; set; }

    public int? AttendanceLogId { get; set; }

    public AttendanceLog? AttendanceLog { get; set; }

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAtUtc { get; set; }
}