namespace HRIS.Api.Features.Attendance.DTOs;

public class PagedOvertimeRequestsResponse
{
    public List<OvertimeRequestDto> Items { get; set; } = new();

    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
}