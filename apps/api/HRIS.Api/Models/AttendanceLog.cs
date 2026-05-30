using System.ComponentModel.DataAnnotations;

namespace HRIS.Api.Models;

public class AttendanceLog
{
    public int Id { get; set; }

    [Required]
    public Guid EmployeeId { get; set; }

    public Employee Employee { get; set; } = null!;

    [Required]
    public DateOnly Date { get; set; }

    public TimeOnly? TimeIn { get; set; }

    public TimeOnly? TimeOut { get; set; }

    public string? Task { get; set; }

    public string? Accomplished { get; set; }

    public int LateMinutes { get; set; } = 0;

    public int UndertimeMinutes { get; set; } = 0;

    // Overtime here is only candidate/basis, not final approved overtime.
    public int OvertimeMinutes { get; set; } = 0;

    public int RenderedMinutes { get; set; } = 0;

    public bool IsPresent { get; set; } = false;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAtUtc { get; set; }
}