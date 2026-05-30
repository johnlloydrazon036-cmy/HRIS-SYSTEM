namespace HRIS.Api.Features.Attendance.Services;

public interface IAttendanceHolidayProvider
{
    string? GetHolidayName(DateOnly date);
}

public class AttendanceHolidayProvider : IAttendanceHolidayProvider
{
    private static readonly Dictionary<DateOnly, string> Holidays = new()
    {
        [new DateOnly(2026, 1, 1)] = "New Year's Day",
        [new DateOnly(2026, 4, 9)] = "Araw ng Kagitingan",
        [new DateOnly(2026, 4, 17)] = "Maundy Thursday",
        [new DateOnly(2026, 4, 18)] = "Good Friday",
        [new DateOnly(2026, 5, 1)] = "Labor Day",
        [new DateOnly(2026, 6, 12)] = "Independence Day",
        [new DateOnly(2026, 8, 31)] = "National Heroes Day",
        [new DateOnly(2026, 11, 30)] = "Bonifacio Day",
        [new DateOnly(2026, 12, 25)] = "Christmas Day",
        [new DateOnly(2026, 12, 30)] = "Rizal Day",
        //[new DateOnly(2026, 5, 7)] = "Test Holiday",
    };

    public string? GetHolidayName(DateOnly date)
    {
        return Holidays.TryGetValue(date, out var holidayName)
            ? holidayName
            : null;
    }
}
