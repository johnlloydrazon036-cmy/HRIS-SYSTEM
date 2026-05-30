using System.ComponentModel.DataAnnotations;

namespace HRIS.Api.Models;

public class EmployeeShiftAssignment
{
    public int Id { get; set; }

    [Required]
    public Guid EmployeeId { get; set; }

    public Employee Employee { get; set; } = null!;

    [Required]
    public int ShiftId { get; set; }

    public Shift Shift { get; set; } = null!;

    [Required]
    public DateOnly EffectiveFrom { get; set; }

    public DateOnly? EffectiveTo { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAtUtc { get; set; }
}