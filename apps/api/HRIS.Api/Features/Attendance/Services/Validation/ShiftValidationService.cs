using HRIS.Api.Features.Attendance.DTOs;
using HRIS.Api.Features.Common.Exceptions;
using HRIS.Api.Models;

namespace HRIS.Api.Features.Attendance.Services.Validation;

public sealed class ShiftValidationService : IShiftValidationService
{
    public void ValidateShiftDays(IReadOnlyCollection<ShiftDayRequest> days)
    {
        var shiftDays = BuildShiftDays(days);
        ValidateShiftDays(shiftDays);
    }

    public void ValidateShiftForAssignment(
        bool shiftIsActive,
        IReadOnlyCollection<ShiftDayRequest> days)
    {
        if (!shiftIsActive)
            throw new ApiException("Cannot assign an inactive shift.");

        var shiftDays = BuildShiftDays(days);
        ValidateShiftDays(shiftDays);
    }

    private static List<ShiftDay> BuildShiftDays(IEnumerable<ShiftDayRequest> requestedDays)
    {
        var sourceDays = requestedDays.ToList();

        if (sourceDays.Count == 0)
            throw new ApiException("Shift days are required.");

        var duplicateDays = sourceDays
            .GroupBy(x => x.DayOfWeek)
            .Where(x => x.Count() > 1)
            .Select(x => GetDayLabel(x.Key))
            .ToList();

        if (duplicateDays.Any())
            throw new ApiException($"Duplicate shift day configuration found: {string.Join(", ", duplicateDays)}.");

        return sourceDays
            .OrderBy(x => x.DayOfWeek)
            .Select(x => new ShiftDay
            {
                DayOfWeek = x.DayOfWeek,
                IsWorkingDay = x.IsWorkingDay,
                StartTime = x.IsWorkingDay ? x.StartTime : null,
                BreakStartTime = x.IsWorkingDay ? x.BreakStartTime : null,
                BreakEndTime = x.IsWorkingDay ? x.BreakEndTime : null,
                EndTime = x.IsWorkingDay ? x.EndTime : null
            })
            .ToList();
    }

    private static void ValidateShiftDays(IEnumerable<ShiftDay> days)
    {
        var shiftDays = days.ToList();

        if (shiftDays.Count == 0)
            throw new ApiException("Shift days are required.");

        foreach (var day in shiftDays)
        {
            if (!Enum.IsDefined(day.DayOfWeek))
                throw new ApiException("Shift day must be between Sunday and Saturday.");
        }

        var workingDays = shiftDays.Where(x => x.IsWorkingDay).ToList();

        if (!workingDays.Any())
            throw new ApiException("At least one working day is required.");

        foreach (var day in workingDays)
        {
            var dayLabel = GetDayLabel(day.DayOfWeek);

            if (day.StartTime == null)
                throw new ApiException($"{dayLabel}: Start time is required.");

            if (day.EndTime == null)
                throw new ApiException($"{dayLabel}: End time is required.");

            var startMinutes = ToMinutes(day.StartTime.Value);
            var normalizedEndMinutes = NormalizeToShiftTimeline(day.StartTime.Value, day.EndTime.Value);

            if (startMinutes == normalizedEndMinutes)
                throw new ApiException($"{dayLabel}: Start time and end time cannot be the same.");

            var shiftDurationMinutes = normalizedEndMinutes - startMinutes;

            if (shiftDurationMinutes <= 0)
                throw new ApiException($"{dayLabel}: Shift duration is invalid.");

            var hasBreakStart = day.BreakStartTime != null;
            var hasBreakEnd = day.BreakEndTime != null;

            if (hasBreakStart != hasBreakEnd)
                throw new ApiException($"{dayLabel}: Break start and break end must both be provided.");

            var breakDurationMinutes = 0;

            if (hasBreakStart && hasBreakEnd)
            {
                var normalizedBreakStartMinutes = NormalizeToShiftTimeline(
                    day.StartTime.Value,
                    day.BreakStartTime!.Value
                );

                var normalizedBreakEndMinutes = NormalizeToShiftTimeline(
                    day.StartTime.Value,
                    day.BreakEndTime!.Value
                );

                if (normalizedBreakStartMinutes <= startMinutes)
                    throw new ApiException($"{dayLabel}: Break start must be after start time.");

                if (normalizedBreakStartMinutes >= normalizedEndMinutes)
                    throw new ApiException($"{dayLabel}: Break start must be before end time.");

                if (normalizedBreakEndMinutes <= normalizedBreakStartMinutes)
                    throw new ApiException($"{dayLabel}: Break end must be after break start.");

                if (normalizedBreakEndMinutes >= normalizedEndMinutes)
                    throw new ApiException($"{dayLabel}: Break end must be before end time.");

                breakDurationMinutes = normalizedBreakEndMinutes - normalizedBreakStartMinutes;
            }

            var workingDurationMinutes = shiftDurationMinutes - breakDurationMinutes;

            if (workingDurationMinutes < 60)
                throw new ApiException($"{dayLabel}: Working duration must be at least 1 hour.");
        }
    }

    private static string GetDayLabel(DayOfWeek dayOfWeek)
    {
        return dayOfWeek switch
        {
            DayOfWeek.Sunday => "Sunday",
            DayOfWeek.Monday => "Monday",
            DayOfWeek.Tuesday => "Tuesday",
            DayOfWeek.Wednesday => "Wednesday",
            DayOfWeek.Thursday => "Thursday",
            DayOfWeek.Friday => "Friday",
            DayOfWeek.Saturday => "Saturday",
            _ => "Selected day"
        };
    }

    private static int ToMinutes(TimeOnly time)
    {
        return (time.Hour * 60) + time.Minute;
    }

    private static int NormalizeToShiftTimeline(TimeOnly shiftStartTime, TimeOnly value)
    {
        var shiftStartMinutes = ToMinutes(shiftStartTime);
        var valueMinutes = ToMinutes(value);

        if (valueMinutes <= shiftStartMinutes)
            valueMinutes += 24 * 60;

        return valueMinutes;
    }
}