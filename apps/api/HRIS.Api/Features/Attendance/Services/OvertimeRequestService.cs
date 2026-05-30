using HRIS.Api.Data;
using HRIS.Api.Features.Attendance.DTOs;
using HRIS.Api.Features.Common.Exceptions;
using HRIS.Api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace HRIS.Api.Features.Attendance.Services;

public class OvertimeRequestService
{
    private readonly AppDbContext _context;

    private const int MaxEmployeeOtMinutes = 180;
    private const int MaxAdminOtMinutes = 600;
    private const int MaxEmployeeRequestDays = 5;
    private const int EmployeeOvertimeAdvanceWindowMinutes = 180;
    private const int MinutesPerDay = 24 * 60;
    private static readonly TimeZoneInfo ManilaTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Asia/Manila");

    public OvertimeRequestService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<PagedOvertimeRequestsResponse> GetAllAsync(GetOvertimeRequestsQuery query)
    {
        var page = query.Page < 1 ? 1 : query.Page;
        var pageSize = query.PageSize < 1 ? 10 : query.PageSize;

        var overtimeQuery = _context.OvertimeRequests
            .AsNoTracking()
            .Include(x => x.Employee)
            .Include(x => x.Items)
            .Include(x => x.ReviewedByUser)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim().ToLower();

            overtimeQuery = overtimeQuery.Where(x =>
                x.Employee.EmployeeNumber.ToLower().Contains(search) ||
                x.Employee.FirstName.ToLower().Contains(search) ||
                x.Employee.LastName.ToLower().Contains(search) ||
                (x.Employee.FirstName + " " + x.Employee.LastName).ToLower().Contains(search));
        }

        if (!string.IsNullOrWhiteSpace(query.Status))
        {
            var status = query.Status.Trim();
            overtimeQuery = overtimeQuery.Where(x => x.Status == status);
        }

        if (query.DateFrom.HasValue)
            overtimeQuery = overtimeQuery.Where(x => x.DateTo >= query.DateFrom.Value);

        if (query.DateTo.HasValue)
            overtimeQuery = overtimeQuery.Where(x => x.DateFrom <= query.DateTo.Value);

        var totalCount = await overtimeQuery.CountAsync();

        var rawItems = await overtimeQuery
            .OrderByDescending(x => x.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new
            {
                x.Id,
                x.EmployeeId,
                EmployeeNumber = x.Employee.EmployeeNumber,
                FirstName = x.Employee.FirstName,
                LastName = x.Employee.LastName,
                x.DateFrom,
                x.DateTo,
                RequestedMinutesPerDay = x.Items
                    .OrderBy(i => i.Date)
                    .Select(i => (int?)i.RequestedMinutes)
                    .FirstOrDefault() ?? 0,
                TotalRequestedMinutes = x.Items.Sum(i => (int?)i.RequestedMinutes) ?? 0,
                x.Reason,
                x.Status,
                x.ReviewedByUserId,
                ReviewedByName = x.ReviewedByUser != null ? x.ReviewedByUser.FullName : null,
                x.ReviewedAtUtc,
                x.ReviewRemarks,
                x.CreatedAtUtc,
                x.UpdatedAtUtc
            })
            .ToListAsync();

        var items = rawItems.Select(x => new OvertimeRequestDto
        {
            Id = x.Id,
            EmployeeId = x.EmployeeId,
            EmployeeNumber = x.EmployeeNumber,
            EmployeeName = BuildEmployeeName(x.FirstName, x.LastName),
            AttendanceDate = x.DateFrom,
            DateFrom = x.DateFrom,
            DateTo = x.DateTo,
            RequestedMinutes = x.TotalRequestedMinutes,
            RequestedMinutesPerDay = x.RequestedMinutesPerDay,
            TotalRequestedMinutes = x.TotalRequestedMinutes,
            Reason = x.Reason,
            Status = x.Status,
            ReviewedByUserId = x.ReviewedByUserId,
            ReviewedByName = x.ReviewedByName,
            ReviewedAtUtc = x.ReviewedAtUtc,
            ReviewRemarks = x.ReviewRemarks,
            CreatedAtUtc = x.CreatedAtUtc,
            UpdatedAtUtc = x.UpdatedAtUtc
        }).ToList();

        return new PagedOvertimeRequestsResponse
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount
        };
    }

    public async Task<PagedOvertimeRequestsResponse> GetMineAsync(long userId, GetOvertimeRequestsQuery query)
    {
        var page = query.Page < 1 ? 1 : query.Page;
        var pageSize = query.PageSize < 1 ? 10 : query.PageSize;

        var employee = await _context.Employees
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.UserId == userId);

        if (employee == null)
            throw new ApiException("No linked employee profile found.", StatusCodes.Status400BadRequest);

        var overtimeQuery = _context.OvertimeRequests
            .AsNoTracking()
            .Include(x => x.Employee)
            .Include(x => x.Items)
            .Include(x => x.ReviewedByUser)
            .Where(x => x.EmployeeId == employee.Id)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(query.Status))
        {
            var status = query.Status.Trim();
            overtimeQuery = overtimeQuery.Where(x => x.Status == status);
        }

        if (query.DateFrom.HasValue)
            overtimeQuery = overtimeQuery.Where(x => x.DateTo >= query.DateFrom.Value);

        if (query.DateTo.HasValue)
            overtimeQuery = overtimeQuery.Where(x => x.DateFrom <= query.DateTo.Value);

        var totalCount = await overtimeQuery.CountAsync();

        var rawItems = await overtimeQuery
            .OrderByDescending(x => x.CreatedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new
            {
                x.Id,
                x.EmployeeId,
                EmployeeNumber = x.Employee.EmployeeNumber,
                FirstName = x.Employee.FirstName,
                LastName = x.Employee.LastName,
                x.DateFrom,
                x.DateTo,
                RequestedMinutesPerDay = x.Items
                    .OrderBy(i => i.Date)
                    .Select(i => (int?)i.RequestedMinutes)
                    .FirstOrDefault() ?? 0,
                TotalRequestedMinutes = x.Items.Sum(i => (int?)i.RequestedMinutes) ?? 0,
                x.Reason,
                x.Status,
                x.ReviewedByUserId,
                ReviewedByName = x.ReviewedByUser != null ? x.ReviewedByUser.FullName : null,
                x.ReviewedAtUtc,
                x.ReviewRemarks,
                x.CreatedAtUtc,
                x.UpdatedAtUtc
            })
            .ToListAsync();

        var items = rawItems.Select(x => new OvertimeRequestDto
        {
            Id = x.Id,
            EmployeeId = x.EmployeeId,
            EmployeeNumber = x.EmployeeNumber,
            EmployeeName = BuildEmployeeName(x.FirstName, x.LastName),
            AttendanceDate = x.DateFrom,
            DateFrom = x.DateFrom,
            DateTo = x.DateTo,
            RequestedMinutes = x.TotalRequestedMinutes,
            RequestedMinutesPerDay = x.RequestedMinutesPerDay,
            TotalRequestedMinutes = x.TotalRequestedMinutes,
            Reason = x.Reason,
            Status = x.Status,
            ReviewedByUserId = x.ReviewedByUserId,
            ReviewedByName = x.ReviewedByName,
            ReviewedAtUtc = x.ReviewedAtUtc,
            ReviewRemarks = x.ReviewRemarks,
            CreatedAtUtc = x.CreatedAtUtc,
            UpdatedAtUtc = x.UpdatedAtUtc
        }).ToList();

        return new PagedOvertimeRequestsResponse
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount
        };
    }

    public async Task SubmitAsync(long userId, SubmitOvertimeRequest request)
    {
        var employee = await _context.Employees
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.UserId == userId);

        if (employee == null)
            throw new ApiException("No linked employee profile found.", StatusCodes.Status400BadRequest);

        ValidateEmployeeRequestedMinutes(request.RequestedMinutes);
        ValidateReason(request.Reason);

        if (request.DateFrom > request.DateTo)
            throw new ApiException("Date From cannot be later than Date To.", StatusCodes.Status400BadRequest);

        var requestedDays = CountInclusiveDays(request.DateFrom, request.DateTo);

        if (requestedDays > MaxEmployeeRequestDays)
            throw new ApiException($"Overtime request cannot exceed {MaxEmployeeRequestDays} days.", StatusCodes.Status400BadRequest);

        var nowLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, ManilaTimeZone);
        var today = DateOnly.FromDateTime(nowLocal);
        var nowTime = TimeOnly.FromDateTime(nowLocal);

        if (request.DateFrom < today)
            throw new ApiException("Overtime request cannot be submitted for past dates.", StatusCodes.Status400BadRequest);

        var attendance = await _context.AttendanceLogs
            .AsNoTracking()
            .Where(x =>
                x.EmployeeId == employee.Id &&
                x.Date >= request.DateFrom &&
                x.Date <= request.DateTo)
            .ToListAsync();

        var attendanceByDate = attendance.ToDictionary(x => x.Date);
        var items = new List<OvertimeRequestItem>();

        for (var date = request.DateFrom; date <= request.DateTo; date = date.AddDays(1))
        {
            var shiftDay = await GetCurrentShiftDay(employee.Id, date);

            if (!shiftDay.IsWorkingDay)
                continue;

            if (!shiftDay.StartTime.HasValue || !shiftDay.EndTime.HasValue)
                throw new ApiException($"Shift schedule is not fully configured for {date:yyyy-MM-dd}.", StatusCodes.Status400BadRequest);

            var alreadyHasActiveOt = await HasActiveOvertime(employee.Id, date);

            if (alreadyHasActiveOt)
                throw new ApiException($"An overtime request already exists for {date:yyyy-MM-dd}.", StatusCodes.Status409Conflict);

            attendanceByDate.TryGetValue(date, out var attendanceLog);

            if (date == today)
            {
                var rawRenderedOvertime = attendanceLog is null
                    ? 0
                    : CalculateRawRenderedOvertimeMinutes(attendanceLog, shiftDay);

                var isWithinAdvanceWindow = IsWithinOvertimeAdvanceWindow(
                    nowTime,
                    shiftDay,
                    EmployeeOvertimeAdvanceWindowMinutes);

                if (rawRenderedOvertime <= 0 && !isWithinAdvanceWindow)
                    throw new ApiException("Overtime request for today is only allowed within 3 hours before shift end or after overtime is rendered.", StatusCodes.Status400BadRequest);

                if (rawRenderedOvertime > 0 && request.RequestedMinutes > rawRenderedOvertime)
                    throw new ApiException($"Requested minutes exceed rendered overtime for {date:yyyy-MM-dd}.", StatusCodes.Status400BadRequest);
            }

            items.Add(new OvertimeRequestItem
            {
                Date = date,
                RequestedMinutes = request.RequestedMinutes,
                AttendanceLogId = attendanceLog?.Id,
                CreatedAtUtc = DateTime.UtcNow
            });
        }

        if (!items.Any())
            throw new ApiException("No valid working days found in the selected range.", StatusCodes.Status400BadRequest);

        var entity = new OvertimeRequest
        {
            EmployeeId = employee.Id,
            DateFrom = items.Min(x => x.Date),
            DateTo = items.Max(x => x.Date),
            Reason = NormalizeNullableText(request.Reason),
            Status = "Pending",
            CreatedAtUtc = DateTime.UtcNow,
            Items = items
        };

        _context.OvertimeRequests.Add(entity);
        await _context.SaveChangesAsync();
    }

    public async Task AdminAssignAsync(long adminUserId, AdminAssignOvertimeRequest request)
    {
        if (request.EmployeeId == Guid.Empty)
            throw new ApiException("Employee is required.", StatusCodes.Status400BadRequest);

        ValidateAdminRequestedMinutes(request.RequestedMinutes);
        ValidateReason(request.Reason);

        if (request.DateFrom > request.DateTo)
            throw new ApiException("Date From cannot be later than Date To.", StatusCodes.Status400BadRequest);

        var employeeExists = await _context.Employees
            .AsNoTracking()
            .AnyAsync(x => x.Id == request.EmployeeId);

        if (!employeeExists)
            throw new ApiException("Employee not found.", StatusCodes.Status404NotFound);

        var attendance = await _context.AttendanceLogs
            .AsNoTracking()
            .Where(x =>
                x.EmployeeId == request.EmployeeId &&
                x.Date >= request.DateFrom &&
                x.Date <= request.DateTo)
            .ToListAsync();

        var attendanceByDate = attendance.ToDictionary(x => x.Date);
        var items = new List<OvertimeRequestItem>();

        for (var date = request.DateFrom; date <= request.DateTo; date = date.AddDays(1))
        {
            var shiftDay = await GetCurrentShiftDay(request.EmployeeId, date);

            if (!shiftDay.IsWorkingDay)
                continue;

            if (!shiftDay.StartTime.HasValue || !shiftDay.EndTime.HasValue)
                throw new ApiException($"Shift schedule is not fully configured for {date:yyyy-MM-dd}.", StatusCodes.Status400BadRequest);

            var alreadyHasActiveOt = await HasActiveOvertime(request.EmployeeId, date);

            if (alreadyHasActiveOt)
                throw new ApiException($"Overtime already assigned/requested for {date:yyyy-MM-dd}.", StatusCodes.Status409Conflict);

            attendanceByDate.TryGetValue(date, out var attendanceLog);

            items.Add(new OvertimeRequestItem
            {
                Date = date,
                RequestedMinutes = request.RequestedMinutes,
                AttendanceLogId = attendanceLog?.Id,
                CreatedAtUtc = DateTime.UtcNow,
                UpdatedAtUtc = DateTime.UtcNow
            });
        }

        if (!items.Any())
            throw new ApiException("No valid working days found in the selected range.", StatusCodes.Status400BadRequest);

        var entity = new OvertimeRequest
        {
            EmployeeId = request.EmployeeId,
            DateFrom = items.Min(x => x.Date),
            DateTo = items.Max(x => x.Date),
            Reason = NormalizeNullableText(request.Reason),
            Status = "Approved",
            ReviewedByUserId = adminUserId,
            ReviewedAtUtc = DateTime.UtcNow,
            ReviewRemarks = "Assigned by admin.",
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow,
            Items = items
        };

        _context.OvertimeRequests.Add(entity);
        await _context.SaveChangesAsync();
    }

    public async Task ReviewAsync(long reviewerUserId, int requestId, string action, string? remarks)
    {
        var request = await _context.OvertimeRequests
            .Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.Id == requestId);

        if (request == null)
            throw new ApiException("Overtime request not found.", StatusCodes.Status404NotFound);

        if (request.Status != "Pending")
            throw new ApiException("Request already processed.", StatusCodes.Status400BadRequest);

        if (!string.Equals(action, "Approve", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(action, "Reject", StringComparison.OrdinalIgnoreCase))
            throw new ApiException("Invalid action.", StatusCodes.Status400BadRequest);

        ValidateReason(remarks);

        request.Status = string.Equals(action, "Approve", StringComparison.OrdinalIgnoreCase)
            ? "Approved"
            : "Rejected";

        request.ReviewedByUserId = reviewerUserId;
        request.ReviewedAtUtc = DateTime.UtcNow;
        request.ReviewRemarks = NormalizeNullableText(remarks);
        request.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync();
    }

    private async Task<bool> HasActiveOvertime(Guid employeeId, DateOnly date)
    {
        return await _context.OvertimeRequests
            .AsNoTracking()
            .AnyAsync(x =>
                x.EmployeeId == employeeId &&
                (x.Status == "Pending" || x.Status == "Approved") &&
                x.Items.Any(i => i.Date == date));
    }

    private async Task<ShiftDay> GetCurrentShiftDay(Guid employeeId, DateOnly workDate)
    {
        var assignment = await _context.EmployeeShiftAssignments
            .AsNoTracking()
            .Include(x => x.Shift)
            .ThenInclude(x => x.ShiftDays)
            .Where(x =>
                x.EmployeeId == employeeId &&
                x.IsActive &&
                x.EffectiveFrom <= workDate &&
                (!x.EffectiveTo.HasValue || x.EffectiveTo.Value >= workDate))
            .OrderByDescending(x => x.EffectiveFrom)
            .FirstOrDefaultAsync();

        if (assignment == null)
            throw new ApiException("No active shift.", StatusCodes.Status400BadRequest);

        if (!assignment.Shift.IsActive)
            throw new ApiException("Assigned shift is inactive.", StatusCodes.Status400BadRequest);

        var dayOfWeek = workDate.ToDateTime(TimeOnly.MinValue).DayOfWeek;

        var shiftDay = assignment.Shift.ShiftDays
            .FirstOrDefault(x => x.DayOfWeek == dayOfWeek);

        if (shiftDay == null)
            throw new ApiException("Shift day configuration not found.", StatusCodes.Status400BadRequest);

        return shiftDay;
    }

    private static int CalculateRawRenderedOvertimeMinutes(AttendanceLog attendanceLog, ShiftDay shiftDay)
    {
        if (!attendanceLog.TimeIn.HasValue || !attendanceLog.TimeOut.HasValue)
            return 0;

        if (!shiftDay.StartTime.HasValue || !shiftDay.EndTime.HasValue)
            return 0;

        var renderedMinutes = CalculateDurationMinutes(attendanceLog.TimeIn.Value, attendanceLog.TimeOut.Value);

        renderedMinutes -= CalculateBreakOverlapMinutes(
            attendanceLog.TimeIn.Value,
            attendanceLog.TimeOut.Value,
            shiftDay.BreakStartTime,
            shiftDay.BreakEndTime);

        var requiredMinutes = CalculateDurationMinutes(shiftDay.StartTime.Value, shiftDay.EndTime.Value);

        requiredMinutes -= CalculateBreakOverlapMinutes(
            shiftDay.StartTime.Value,
            shiftDay.EndTime.Value,
            shiftDay.BreakStartTime,
            shiftDay.BreakEndTime);

        renderedMinutes = Math.Max(0, renderedMinutes);
        requiredMinutes = Math.Max(0, requiredMinutes);

        return Math.Max(0, renderedMinutes - requiredMinutes);
    }

    private static bool IsWithinOvertimeAdvanceWindow(
        TimeOnly currentTime,
        ShiftDay shiftDay,
        int minutesBeforeShiftEnd)
    {
        if (!shiftDay.StartTime.HasValue || !shiftDay.EndTime.HasValue)
            return false;

        var shiftStartMinute = ToMinuteOfDay(shiftDay.StartTime.Value);
        var shiftEndMinute = NormalizeEndMinute(shiftDay.StartTime.Value, shiftDay.EndTime.Value);
        var currentMinute = ToMinuteOfDay(currentTime);

        if (shiftEndMinute > MinutesPerDay && currentMinute < shiftStartMinute)
            currentMinute += MinutesPerDay;

        var advanceWindowStart = shiftEndMinute - minutesBeforeShiftEnd;

        return currentMinute >= advanceWindowStart && currentMinute <= shiftEndMinute;
    }

    private static int CalculateDurationMinutes(TimeOnly start, TimeOnly end)
    {
        var startMinute = ToMinuteOfDay(start);
        var endMinute = NormalizeEndMinute(start, end);

        return endMinute - startMinute;
    }

    private static int CalculateBreakOverlapMinutes(
        TimeOnly actualStart,
        TimeOnly actualEnd,
        TimeOnly? breakStart,
        TimeOnly? breakEnd)
    {
        if (!breakStart.HasValue || !breakEnd.HasValue)
            return 0;

        var actualStartMinute = ToMinuteOfDay(actualStart);
        var actualEndMinute = NormalizeEndMinute(actualStart, actualEnd);
        var breakStartMinute = ToMinuteOfDay(breakStart.Value);
        var breakEndMinute = NormalizeEndMinute(breakStart.Value, breakEnd.Value);

        if (actualEndMinute <= actualStartMinute)
            return 0;

        if (breakEndMinute <= breakStartMinute)
            return 0;

        if (breakStartMinute < actualStartMinute && breakEndMinute <= actualStartMinute)
        {
            breakStartMinute += MinutesPerDay;
            breakEndMinute += MinutesPerDay;
        }

        var overlapStart = Math.Max(actualStartMinute, breakStartMinute);
        var overlapEnd = Math.Min(actualEndMinute, breakEndMinute);

        if (overlapEnd <= overlapStart)
            return 0;

        return overlapEnd - overlapStart;
    }

    private static int NormalizeEndMinute(TimeOnly start, TimeOnly end)
    {
        var startMinute = ToMinuteOfDay(start);
        var endMinute = ToMinuteOfDay(end);

        return endMinute <= startMinute
            ? endMinute + MinutesPerDay
            : endMinute;
    }

    private static int ToMinuteOfDay(TimeOnly time)
    {
        return time.Hour * 60 + time.Minute;
    }

    private static int CountInclusiveDays(DateOnly dateFrom, DateOnly dateTo)
    {
        return dateTo.DayNumber - dateFrom.DayNumber + 1;
    }

    private static void ValidateEmployeeRequestedMinutes(int requestedMinutes)
    {
        if (requestedMinutes <= 0 || requestedMinutes > MaxEmployeeOtMinutes)
            throw new ApiException($"Requested minutes must be between 1 and {MaxEmployeeOtMinutes}.", StatusCodes.Status400BadRequest);
    }

    private static void ValidateAdminRequestedMinutes(int requestedMinutes)
    {
        if (requestedMinutes <= 0 || requestedMinutes > MaxAdminOtMinutes)
            throw new ApiException($"Requested minutes must be between 1 and {MaxAdminOtMinutes}.", StatusCodes.Status400BadRequest);
    }

    private static void ValidateReason(string? reason)
    {
        if (!string.IsNullOrWhiteSpace(reason) && reason.Trim().Length > 500)
            throw new ApiException("Remarks cannot exceed 500 characters.", StatusCodes.Status400BadRequest);
    }

    private static string? NormalizeNullableText(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        return value.Trim();
    }

    private static string BuildEmployeeName(string? firstName, string? lastName)
    {
        var parts = new List<string>();

        if (!string.IsNullOrWhiteSpace(firstName))
            parts.Add(firstName.Trim());

        if (!string.IsNullOrWhiteSpace(lastName))
            parts.Add(lastName.Trim());

        return string.Join(" ", parts);
    }
}