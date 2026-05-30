namespace HRIS.Api.Features.Attendance.DTOs;

public class PagedShiftsResponse
{
    public List<ShiftDto> Items { get; set; } = new();

    public int Page { get; set; }

    public int PageSize { get; set; }

    public int TotalCount { get; set; }

    public int TotalPages { get; set; }
}