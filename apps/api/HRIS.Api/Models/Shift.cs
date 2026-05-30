using System;
using System.Collections.Generic;

namespace HRIS.Api.Models;

public class Shift
{
    public int Id { get; set; }

    public string Code { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string? Description { get; set; }

    public int LateGraceMinutes { get; set; } = 0;

    public bool IsFlexible { get; set; } = false;

    public bool IsActive { get; set; } = true;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAtUtc { get; set; }

    public ICollection<ShiftDay> ShiftDays { get; set; } = new List<ShiftDay>();
}