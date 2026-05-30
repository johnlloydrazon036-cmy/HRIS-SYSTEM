using HRIS.Api.Data;
using HRIS.Api.Features.Attendance.DTOs;
using HRIS.Api.Features.Attendance.Services.Validation;
using HRIS.Api.Features.Common.Exceptions;
using HRIS.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace HRIS.Api.Features.Attendance.Services;

public class ShiftsService : IShiftsService
{
    private readonly AppDbContext _context;
    private readonly IShiftValidationService _shiftValidationService;

    public ShiftsService(
        AppDbContext context,
        IShiftValidationService shiftValidationService)
    {
        _context = context;
        _shiftValidationService = shiftValidationService;
    }

    public async Task<PagedShiftsResponse> GetShiftsAsync(GetShiftQuery query, CancellationToken ct)
    {
        var dbQuery = _context.Shifts
            .Include(x => x.ShiftDays)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            dbQuery = dbQuery.Where(x => x.Name.Contains(query.Search));
        }

        if (query.IsActive.HasValue)
        {
            dbQuery = dbQuery.Where(x => x.IsActive == query.IsActive.Value);
        }

        var totalCount = await dbQuery.CountAsync(ct);

        var items = await dbQuery
            .OrderByDescending(x => x.CreatedAtUtc)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync(ct);

        var shiftIds = items.Select(x => x.Id).ToList();

        var assignedCounts = await _context.EmployeeShiftAssignments
            .Where(x => x.IsActive && shiftIds.Contains(x.ShiftId))
            .GroupBy(x => x.ShiftId)
            .Select(g => new
            {
                ShiftId = g.Key,
                Count = g.Count()
            })
            .ToDictionaryAsync(x => x.ShiftId, x => x.Count, ct);

        return new PagedShiftsResponse
        {
            Items = items.Select(x => MapToDto(x, assignedCounts.GetValueOrDefault(x.Id))).ToList(),
            Page = query.Page,
            PageSize = query.PageSize,
            TotalCount = totalCount,
            TotalPages = (int)Math.Ceiling(totalCount / (double)query.PageSize)
        };
    }

    public async Task<ShiftDto?> GetByIdAsync(int id, CancellationToken ct)
    {
        var shift = await _context.Shifts
            .Include(x => x.ShiftDays)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (shift == null) return null;

        var assignedCount = await _context.EmployeeShiftAssignments
            .CountAsync(x => x.ShiftId == shift.Id && x.IsActive, ct);

        return MapToDto(shift, assignedCount);
    }

    public async Task<ShiftDto> CreateAsync(CreateShiftRequest request, CancellationToken ct)
    {
        var code = NormalizeRequiredText(request.Code, "Shift code");
        var name = NormalizeRequiredText(request.Name, "Shift name");

        if (code.Length < 2)
            throw new ApiException("Shift code must be at least 2 characters.");

        if (name.Length < 3)
            throw new ApiException("Shift name must be at least 3 characters.");

        if (request.LateGraceMinutes < 0)
            throw new ApiException("Late grace minutes must be a valid non-negative number.");

        if (await _context.Shifts.AnyAsync(x => x.Code == code, ct))
            throw new ApiException("Shift code already exists.");

        var shiftDays = BuildShiftDays(request.Days);

        _shiftValidationService.ValidateShiftDays(request.Days);

        var shift = new Shift
        {
            Code = code,
            Name = name,
            Description = NormalizeOptionalText(request.Description),
            LateGraceMinutes = request.LateGraceMinutes,
            IsFlexible = request.IsFlexible,
            IsActive = true,
            CreatedAtUtc = DateTime.UtcNow,
            ShiftDays = shiftDays
        };

        _context.Shifts.Add(shift);
        await _context.SaveChangesAsync(ct);

        return MapToDto(shift, 0);
    }

    public async Task<ShiftDto?> UpdateAsync(int id, UpdateShiftRequest request, CancellationToken ct)
    {
        var shift = await _context.Shifts
            .Include(x => x.ShiftDays)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (shift == null) return null;

        var code = NormalizeRequiredText(request.Code, "Shift code");
        var name = NormalizeRequiredText(request.Name, "Shift name");

        if (code.Length < 2)
            throw new ApiException("Shift code must be at least 2 characters.");

        if (name.Length < 3)
            throw new ApiException("Shift name must be at least 3 characters.");

        if (request.LateGraceMinutes < 0)
            throw new ApiException("Late grace minutes must be a valid non-negative number.");

        if (await _context.Shifts.AnyAsync(x => x.Code == code && x.Id != id, ct))
            throw new ApiException("Shift code already exists.");

        var shiftDays = BuildShiftDays(request.Days);

        _shiftValidationService.ValidateShiftDays(request.Days);

        shift.Code = code;
        shift.Name = name;
        shift.Description = NormalizeOptionalText(request.Description);
        shift.LateGraceMinutes = request.LateGraceMinutes;
        shift.IsFlexible = request.IsFlexible;
        shift.UpdatedAtUtc = DateTime.UtcNow;

        _context.ShiftDays.RemoveRange(shift.ShiftDays);

        foreach (var day in shiftDays)
        {
            day.ShiftId = shift.Id;
            shift.ShiftDays.Add(day);
        }

        await _context.SaveChangesAsync(ct);

        var assignedCount = await _context.EmployeeShiftAssignments
            .CountAsync(x => x.ShiftId == shift.Id && x.IsActive, ct);

        return MapToDto(shift, assignedCount);
    }

    public async Task<bool> UpdateStatusAsync(int id, UpdateShiftStatusRequest request, CancellationToken ct)
    {
        var shift = await _context.Shifts
            .Include(x => x.ShiftDays)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (shift == null) return false;

        if (request.IsActive)
        {
            ValidateShiftDays(shift.ShiftDays);
        }

        shift.IsActive = request.IsActive;
        shift.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);

        return true;
    }

    private static string NormalizeRequiredText(string? value, string fieldName)
    {
        var trimmed = value?.Trim();

        if (string.IsNullOrWhiteSpace(trimmed))
            throw new ApiException($"{fieldName} is required.");

        return trimmed;
    }

    private static string? NormalizeOptionalText(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed;
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

    private static ShiftDto MapToDto(Shift x, int assignedCount) => new()
    {
        Id = x.Id,
        Code = x.Code,
        Name = x.Name,
        Description = x.Description,
        LateGraceMinutes = x.LateGraceMinutes,
        IsFlexible = x.IsFlexible,
        IsActive = x.IsActive,
        AssignedCount = assignedCount,
        CreatedAtUtc = x.CreatedAtUtc,
        UpdatedAtUtc = x.UpdatedAtUtc,
        Days = x.ShiftDays
            .OrderBy(d => d.DayOfWeek)
            .Select(d => new ShiftDayDto
            {
                Id = d.Id,
                DayOfWeek = d.DayOfWeek,
                IsWorkingDay = d.IsWorkingDay,
                StartTime = d.StartTime,
                BreakStartTime = d.BreakStartTime,
                BreakEndTime = d.BreakEndTime,
                EndTime = d.EndTime
            })
            .ToList()
    };
}