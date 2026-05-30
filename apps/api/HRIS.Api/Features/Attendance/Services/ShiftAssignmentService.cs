using HRIS.Api.Data;
using HRIS.Api.Features.Attendance.DTOs;
using HRIS.Api.Features.Attendance.Services.Validation;
using HRIS.Api.Features.Common.Exceptions;
using HRIS.Api.Models;
using HRIS.Api.Utils;
using Microsoft.EntityFrameworkCore;

namespace HRIS.Api.Features.Attendance.Services;

public class ShiftAssignmentsService : IShiftAssignmentsService
{
    private readonly AppDbContext _context;
    private readonly IShiftValidationService _shiftValidationService;

    public ShiftAssignmentsService(
        AppDbContext context,
        IShiftValidationService shiftValidationService)
    {
        _context = context;
        _shiftValidationService = shiftValidationService;
    }

    public async Task<EmployeeShiftAssignmentDto> AssignAsync(AssignShiftRequest request, CancellationToken ct)
    {
        ValidateRequest(request);

        var employeeExists = await _context.Employees
            .AnyAsync(x => x.Id == request.EmployeeId, ct);

        if (!employeeExists)
            throw new ApiException("Employee not found.");

        var shift = await _context.Shifts
            .Include(x => x.ShiftDays)
            .FirstOrDefaultAsync(x => x.Id == request.ShiftId, ct);

        if (shift == null)
            throw new ApiException("Shift not found.");

        _shiftValidationService.ValidateShiftForAssignment(
            shift.IsActive,
            shift.ShiftDays
                .OrderBy(x => x.DayOfWeek)
                .Select(x => new ShiftDayRequest
                {
                    DayOfWeek = x.DayOfWeek,
                    IsWorkingDay = x.IsWorkingDay,
                    StartTime = x.StartTime,
                    BreakStartTime = x.BreakStartTime,
                    BreakEndTime = x.BreakEndTime,
                    EndTime = x.EndTime
                })
                .ToList()
        );

        await using var transaction = await _context.Database.BeginTransactionAsync(ct);

        var assignments = await _context.EmployeeShiftAssignments
            .Where(x => x.EmployeeId == request.EmployeeId)
            .OrderByDescending(x => x.EffectiveFrom)
            .ThenByDescending(x => x.Id)
            .ToListAsync(ct);

        var duplicateEffectiveDate = assignments.Any(x =>
            x.EffectiveFrom == request.EffectiveFrom);

        if (duplicateEffectiveDate)
            throw new ApiException("Employee already has a shift assignment starting on this date.");

        var historicalOverlap = assignments.Any(x =>
            !x.IsActive &&
            x.EffectiveTo != null &&
            request.EffectiveFrom >= x.EffectiveFrom &&
            request.EffectiveFrom <= x.EffectiveTo);

        if (historicalOverlap)
            throw new ApiException("Effective date overlaps with an existing shift assignment history.");

        var activeAssignments = assignments
            .Where(x => x.IsActive)
            .OrderByDescending(x => x.EffectiveFrom)
            .ToList();

        foreach (var activeAssignment in activeAssignments)
        {
            if (request.EffectiveFrom <= activeAssignment.EffectiveFrom)
                throw new ApiException("Effective date must be later than the current active assignment start date.");

            if (activeAssignment.ShiftId == request.ShiftId)
                throw new ApiException("Employee is already assigned to this shift.");

            activeAssignment.IsActive = false;
            activeAssignment.EffectiveTo = request.EffectiveFrom.AddDays(-1);
            activeAssignment.UpdatedAtUtc = DateTime.UtcNow;
        }

        var assignment = new EmployeeShiftAssignment
        {
            EmployeeId = request.EmployeeId,
            ShiftId = request.ShiftId,
            EffectiveFrom = request.EffectiveFrom,
            EffectiveTo = null,
            IsActive = true,
            CreatedAtUtc = DateTime.UtcNow
        };

        _context.EmployeeShiftAssignments.Add(assignment);

        await _context.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        var createdAssignment = await _context.EmployeeShiftAssignments
            .Include(x => x.Employee)
            .FirstAsync(x => x.Id == assignment.Id, ct);

        return MapToDto(createdAssignment);
    }

    public async Task<EmployeeShiftAssignmentDto?> GetCurrentAsync(Guid employeeId, CancellationToken ct)
    {
        if (employeeId == Guid.Empty)
            throw new ApiException("Employee is required.");

        var today = DateOnly.FromDateTime(DateTime.Today);

        var assignment = await _context.EmployeeShiftAssignments
            .Include(x => x.Employee)
            .Where(x =>
                x.EmployeeId == employeeId &&
                x.IsActive &&
                x.EffectiveFrom <= today &&
                (x.EffectiveTo == null || x.EffectiveTo >= today))
            .OrderByDescending(x => x.EffectiveFrom)
            .ThenByDescending(x => x.Id)
            .FirstOrDefaultAsync(ct);

        return assignment == null ? null : MapToDto(assignment);
    }

    public async Task<ShiftDto?> GetCurrentUserShiftAsync(long userId, CancellationToken ct)
    {
        if (userId <= 0)
            throw new ApiException("Invalid user.");

        var employee = await _context.Employees
            .FirstOrDefaultAsync(x => x.UserId == userId, ct);

        if (employee == null)
            throw new ApiException("Employee not found.");

        var today = DateOnly.FromDateTime(DateTime.Today);

        var assignment = await _context.EmployeeShiftAssignments
            .Include(x => x.Shift)
                .ThenInclude(x => x.ShiftDays)
            .Where(x =>
                x.EmployeeId == employee.Id &&
                x.IsActive &&
                x.EffectiveFrom <= today &&
                (x.EffectiveTo == null || x.EffectiveTo >= today))
            .OrderByDescending(x => x.EffectiveFrom)
            .ThenByDescending(x => x.Id)
            .FirstOrDefaultAsync(ct);

        if (assignment?.Shift == null)
            return null;

        var shift = assignment.Shift;

        var assignedCount = await _context.EmployeeShiftAssignments
            .CountAsync(x => x.ShiftId == shift.Id && x.IsActive, ct);

        return new ShiftDto
        {
            Id = shift.Id,
            Code = shift.Code,
            Name = shift.Name,
            Description = shift.Description,
            LateGraceMinutes = shift.LateGraceMinutes,
            IsFlexible = shift.IsFlexible,
            IsActive = shift.IsActive,
            AssignedCount = assignedCount,
            CreatedAtUtc = shift.CreatedAtUtc,
            UpdatedAtUtc = shift.UpdatedAtUtc,
            Days = shift.ShiftDays
                .OrderBy(x => x.DayOfWeek)
                .Select(x => new ShiftDayDto
                {
                    Id = x.Id,
                    DayOfWeek = x.DayOfWeek,
                    IsWorkingDay = x.IsWorkingDay,
                    StartTime = x.StartTime,
                    BreakStartTime = x.BreakStartTime,
                    BreakEndTime = x.BreakEndTime,
                    EndTime = x.EndTime
                })
                .ToList()
        };
    }

    public async Task<List<EmployeeShiftAssignmentDto>> GetByShiftAsync(int shiftId, CancellationToken ct)
    {
        if (shiftId <= 0)
            throw new ApiException("Shift is required.");

        var assignments = await _context.EmployeeShiftAssignments
            .Include(x => x.Employee)
            .Where(x => x.ShiftId == shiftId && x.IsActive)
            .OrderBy(x => x.Employee!.LastName)
            .ThenBy(x => x.Employee!.FirstName)
            .ThenBy(x => x.Employee!.EmployeeNumber)
            .ToListAsync(ct);

        return assignments
            .Select(MapToDto)
            .ToList();
    }

    public async Task UnassignAsync(int assignmentId, CancellationToken ct)
    {
        if (assignmentId <= 0)
            throw new ApiException("Assignment is required.");

        var assignment = await _context.EmployeeShiftAssignments
            .FirstOrDefaultAsync(x => x.Id == assignmentId && x.IsActive, ct);

        if (assignment == null)
            throw new ApiException("Active shift assignment not found.");

        var today = DateOnly.FromDateTime(DateTime.Today);

        assignment.IsActive = false;
        assignment.EffectiveTo = today < assignment.EffectiveFrom
            ? assignment.EffectiveFrom
            : today;
        assignment.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync(ct);
    }

    private static void ValidateRequest(AssignShiftRequest request)
    {
        if (request.EmployeeId == Guid.Empty)
            throw new ApiException("Employee is required.");

        if (request.ShiftId <= 0)
            throw new ApiException("Shift is required.");

        if (request.EffectiveFrom == default)
            throw new ApiException("Effective date is required.");
    }

    private static void ValidateShiftForAssignment(Shift shift)
    {
        var workingDays = shift.ShiftDays
            .Where(x => x.IsWorkingDay)
            .ToList();

        if (!workingDays.Any())
            throw new ApiException("Cannot assign a shift with no working days.");

        foreach (var day in workingDays)
        {
            var dayLabel = day.DayOfWeek.ToString();

            if (day.StartTime == null)
                throw new ApiException($"{dayLabel}: Start time is required.");

            if (day.EndTime == null)
                throw new ApiException($"{dayLabel}: End time is required.");

            var startMinutes = ToMinutes(day.StartTime.Value);
            var endMinutes = ToMinutes(day.EndTime.Value);
            var normalizedEndMinutes = NormalizeToShiftTimeline(startMinutes, endMinutes);

            if (normalizedEndMinutes == startMinutes)
                throw new ApiException($"{dayLabel}: Start time and end time cannot be the same.");

            var hasBreakStart = day.BreakStartTime != null;
            var hasBreakEnd = day.BreakEndTime != null;

            if (hasBreakStart != hasBreakEnd)
                throw new ApiException($"{dayLabel}: Break start and break end must both be provided.");

            var breakDurationMinutes = 0;

            if (hasBreakStart && hasBreakEnd)
            {
                var breakStartMinutes = NormalizeInsideShift(
                    startMinutes,
                    normalizedEndMinutes,
                    ToMinutes(day.BreakStartTime!.Value)
                );

                if (breakStartMinutes == null)
                    throw new ApiException($"{dayLabel}: Break start must be within shift hours.");

                var breakEndMinutes = NormalizeAfterInsideShift(
                    breakStartMinutes.Value,
                    normalizedEndMinutes,
                    ToMinutes(day.BreakEndTime!.Value)
                );

                if (breakEndMinutes == null)
                    throw new ApiException($"{dayLabel}: Break end must be after break start and before end time.");

                breakDurationMinutes = breakEndMinutes.Value - breakStartMinutes.Value;
            }

            var workingDurationMinutes =
                normalizedEndMinutes - startMinutes - breakDurationMinutes;

            if (workingDurationMinutes < 60)
                throw new ApiException($"{dayLabel}: Working duration must be at least 1 hour.");
        }
    }

    private static int ToMinutes(TimeOnly value)
    {
        return value.Hour * 60 + value.Minute;
    }

    private static int NormalizeToShiftTimeline(int shiftStartMinutes, int valueMinutes)
    {
        return valueMinutes <= shiftStartMinutes
            ? valueMinutes + 1440
            : valueMinutes;
    }

    private static int? NormalizeInsideShift(
        int shiftStartMinutes,
        int normalizedShiftEndMinutes,
        int valueMinutes)
    {
        var sameDayValue = valueMinutes;
        var nextDayValue = valueMinutes + 1440;

        if (sameDayValue > shiftStartMinutes && sameDayValue < normalizedShiftEndMinutes)
            return sameDayValue;

        if (nextDayValue > shiftStartMinutes && nextDayValue < normalizedShiftEndMinutes)
            return nextDayValue;

        return null;
    }

    private static int? NormalizeAfterInsideShift(
        int afterMinutes,
        int normalizedShiftEndMinutes,
        int valueMinutes)
    {
        var sameDayValue = valueMinutes;
        var nextDayValue = valueMinutes + 1440;

        if (sameDayValue > afterMinutes && sameDayValue < normalizedShiftEndMinutes)
            return sameDayValue;

        if (nextDayValue > afterMinutes && nextDayValue < normalizedShiftEndMinutes)
            return nextDayValue;

        return null;
    }

    private static string? FormatEmployeeName(Employee? employee)
    {
        if (employee == null)
            return null;

        return NameFormatter.FormatFullName(
            employee.FirstName ?? string.Empty,
            employee.MiddleName,
            employee.LastName ?? string.Empty,
            null
        );
    }

    private static EmployeeShiftAssignmentDto MapToDto(EmployeeShiftAssignment x) => new()
    {
        Id = x.Id,
        EmployeeId = x.EmployeeId,
        ShiftId = x.ShiftId,
        EmployeeNumber = x.Employee?.EmployeeNumber,
        FullName = FormatEmployeeName(x.Employee),
        Department = x.Employee?.Department,
        Position = x.Employee?.Position,
        EmploymentType = x.Employee?.EmploymentType,
        EffectiveFrom = x.EffectiveFrom,
        EffectiveTo = x.EffectiveTo,
        IsActive = x.IsActive
    };
}