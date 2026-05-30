namespace HRIS.Api.Features.Attendance.DTOs;

public class GetAttendanceLogsQuery
{
    public Guid? EmployeeId { get; set; }

    public DateOnly? DateFrom { get; set; }
    public DateOnly? DateTo { get; set; }

    public bool? IsPresent { get; set; }

    public bool? HasLate { get; set; }
    public bool? HasUndertime { get; set; }

    public string? Search { get; set; }

    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 10;
}