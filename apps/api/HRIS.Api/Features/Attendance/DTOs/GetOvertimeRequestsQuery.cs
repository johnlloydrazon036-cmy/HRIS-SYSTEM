namespace HRIS.Api.Features.Attendance.DTOs;

public class GetOvertimeRequestsQuery
{
    public string? Search { get; set; }
    public string? Status { get; set; }

    public DateOnly? DateFrom { get; set; }
    public DateOnly? DateTo { get; set; }

    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 10;
}