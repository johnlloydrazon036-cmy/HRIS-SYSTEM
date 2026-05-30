namespace HRIS.Api.Features.Attendance.DTOs;

public class GetShiftQuery
{
    public string? Search { get; set; }

    public bool? IsActive { get; set; }

    public int Page { get; set; } = 1;

    public int PageSize { get; set; } = 10;
}