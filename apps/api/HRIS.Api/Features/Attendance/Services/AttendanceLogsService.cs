using System.Security.Claims;
using System.Text;
using HRIS.Api.Data;
using HRIS.Api.Features.Attendance.DTOs;
using HRIS.Api.Features.Common.Exceptions;
using HRIS.Api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace HRIS.Api.Features.Attendance.Services;

public class AttendanceLogsService : IAttendanceLogsService
{
    private readonly AppDbContext _context;
    private readonly IAttendanceHolidayProvider _holidayProvider;
    private const int EarlyTimeInBufferMinutes = 10;
    private const int MaxAttendanceDurationHours = 16;
    private static readonly TimeZoneInfo ManilaTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Asia/Manila");

    public AttendanceLogsService(AppDbContext context, IAttendanceHolidayProvider holidayProvider)
    {
        _context = context;
        _holidayProvider = holidayProvider;
    }

    public async Task<AttendanceLogDto> TimeInAsync(ClaimsPrincipal user, TimeInRequest request, CancellationToken ct)
    {
        var employee = await ResolveEmployee(user, ct);

        var nowUtc = DateTime.UtcNow;
        var nowLocal = TimeZoneInfo.ConvertTimeFromUtc(nowUtc, ManilaTimeZone);

        var today = DateOnly.FromDateTime(nowLocal);
        var now = TimeOnly.FromDateTime(nowLocal);
        var holidayName = _holidayProvider.GetHolidayName(today);

        var existing = await _context.AttendanceLogs
            .FirstOrDefaultAsync(x => x.EmployeeId == employee.Id && x.Date == today, ct);

        if (existing != null && existing.TimeIn != null)
            throw new ApiException("Already timed in.");

        var shiftDay = await GetShiftDayForDate(
            employee.Id,
            today,
            requireActiveAssignment: true,
            ct);

        var availability = ResolveTimeInAvailability(nowLocal, today, shiftDay, holidayName);

        if (!availability.CanTimeIn)
            throw new ApiException(availability.BlockReason ?? "Time in is unavailable.", StatusCodes.Status400BadRequest);

        if (shiftDay == null)
        {
            throw new ApiException("No active shift.", StatusCodes.Status400BadRequest);
        }

        if (existing == null)
        {
            existing = new AttendanceLog
            {
                EmployeeId = employee.Id,
                Date = today,
                CreatedAtUtc = nowUtc
            };

            _context.AttendanceLogs.Add(existing);
        }

        existing.TimeIn = now;
        existing.IsPresent = true;
        existing.Task = NormalizeNullableText(request.Task);
        existing.UpdatedAtUtc = nowUtc;

        existing.LateMinutes = CalculateLateMinutes(now, shiftDay);

        existing.UndertimeMinutes = 0;
        existing.OvertimeMinutes = 0;
        existing.RenderedMinutes = 0;

        await _context.SaveChangesAsync(ct);

        return await GetAttendanceLogDtoByIdAsync(existing.Id, ct);
    }

    public async Task<AttendanceLogDto> TimeOutAsync(ClaimsPrincipal user, TimeOutRequest request, CancellationToken ct)
    {
        var employee = await ResolveEmployee(user, ct);

        var nowUtc = DateTime.UtcNow;
        var nowLocal = TimeZoneInfo.ConvertTimeFromUtc(nowUtc, ManilaTimeZone);

        var today = DateOnly.FromDateTime(nowLocal);
        var now = TimeOnly.FromDateTime(nowLocal);

        var existing = await _context.AttendanceLogs
            .FirstOrDefaultAsync(x => x.EmployeeId == employee.Id && x.Date == today, ct);

        if (existing == null || existing.TimeIn == null)
            throw new ApiException("No time-in record.");

        if (existing.TimeOut != null)
            throw new ApiException("Already timed out.");

        var shiftDay = await GetCurrentShiftDay(employee.Id, today, ct);

        if (!shiftDay.IsWorkingDay)
            throw new ApiException("Today is not a working day.", StatusCodes.Status400BadRequest);

        ValidateAttendanceDuration(existing.TimeIn.Value, now);

        existing.TimeOut = now;
        existing.Accomplished = NormalizeNullableText(request.Accomplished);
        existing.UpdatedAtUtc = nowUtc;

        RecalculateAttendanceFields(existing, shiftDay, includeOvertime: true);
        await ApplyApprovedOvertimeCapAsync(existing, ct);

        await _context.SaveChangesAsync(ct);

        return await GetAttendanceLogDtoByIdAsync(existing.Id, ct);
    }

    public async Task<PagedAttendanceLogsResponse> GetMyLogsAsync(ClaimsPrincipal user, GetAttendanceLogsQuery query, CancellationToken ct)
    {
        var employee = await ResolveEmployee(user, ct);

        var page = query.Page < 1 ? 1 : query.Page;
        var pageSize = query.PageSize < 1 ? 10 : query.PageSize;

        var nowLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, ManilaTimeZone);
        var today = DateOnly.FromDateTime(nowLocal);

        var earliestAssignmentDate = await _context.EmployeeShiftAssignments
            .AsNoTracking()
            .Where(x =>
                x.EmployeeId == employee.Id &&
                x.IsActive &&
                x.Shift.IsActive)
            .OrderBy(x => x.EffectiveFrom)
            .Select(x => (DateOnly?)x.EffectiveFrom)
            .FirstOrDefaultAsync(ct);

        var dateFrom = query.DateFrom ?? earliestAssignmentDate ?? today;
        var dateTo = query.DateTo ?? today;

        if (dateTo < dateFrom)
            (dateFrom, dateTo) = (dateTo, dateFrom);

        var scopedQuery = new GetAttendanceLogsQuery
        {
            EmployeeId = employee.Id,
            DateFrom = dateFrom,
            DateTo = dateTo,
            IsPresent = query.IsPresent,
            Search = query.Search,
            Page = page,
            PageSize = pageSize,
            HasLate = query.HasLate,
            HasUndertime = query.HasUndertime
        };

        return await GetMonitoringAsync(scopedQuery, ct);
    }

    public async Task<AttendanceLogDto?> GetTodayMyLogAsync(ClaimsPrincipal user, CancellationToken ct)
    {
        var employee = await ResolveEmployee(user, ct);

        var nowLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, ManilaTimeZone);
        var today = DateOnly.FromDateTime(nowLocal);

        var holidayName = _holidayProvider.GetHolidayName(today);
        var isHoliday = !string.IsNullOrWhiteSpace(holidayName);

        var shiftDay = await GetShiftDayForDate(
            employee.Id,
            today,
            requireActiveAssignment: true,
            ct);

        var todayLog = await _context.AttendanceLogs
            .AsNoTracking()
            .Include(x => x.Employee)
            .ThenInclude(x => x.User)
            .FirstOrDefaultAsync(x => x.EmployeeId == employee.Id && x.Date == today, ct);

        var item = todayLog == null ? null : MapToDto(todayLog);

        var availability = ResolveTimeInAvailability(nowLocal, today, shiftDay, holidayName);
        var canTimeIn = availability.CanTimeIn;
        var blockReason = availability.BlockReason;

        if (item == null)
        {
            item = new AttendanceLogDto
            {
                Id = 0,
                EmployeeId = employee.Id,
                EmployeeNumber = employee.EmployeeNumber ?? string.Empty,
                EmployeeName = BuildEmployeeName(
                    employee.FirstName,
                    employee.MiddleName,
                    employee.LastName,
                    employee.User?.Suffix),
                EmployeeSuffix = employee.User?.Suffix,
                Date = today,
                TimeIn = null,
                TimeOut = null,
                LateMinutes = 0,
                UndertimeMinutes = 0,
                OvertimeMinutes = 0,
                OvertimeStatus = "None",
                RenderedMinutes = 0,
                RequiredMinutes = 0,
                RegularCreditedMinutes = 0,
                OvertimeCreditedMinutes = 0,
                CreditedMinutes = 0,
                ExcessMinutes = 0,
                HasExceededApprovedOvertime = false,
                IsPresent = false,
                Task = null,
                Accomplished = null,
                IsWorkingDay = shiftDay?.IsWorkingDay ?? false,
                CanTimeIn = canTimeIn,
                BlockReason = blockReason,
                IsHoliday = isHoliday,
                HolidayName = holidayName,
                ShiftStartTime = shiftDay?.StartTime,
                TimeInOpenTime = shiftDay?.StartTime?.AddMinutes(-EarlyTimeInBufferMinutes),
                BreakStartTime = shiftDay?.BreakStartTime,
                BreakEndTime = shiftDay?.BreakEndTime,
                ShiftEndTime = shiftDay?.EndTime,
                LateGraceMinutes = shiftDay?.Shift.LateGraceMinutes ?? 0
            };

            await EnrichOvertimeStatusAsync(item, ct);
            ApplyCreditedOvertimeMetrics(item);
            return item;
        }

        item.IsWorkingDay = shiftDay?.IsWorkingDay ?? false;
        item.CanTimeIn = canTimeIn;
        item.BlockReason = blockReason;
        item.IsHoliday = isHoliday;
        item.HolidayName = holidayName;

        if (shiftDay == null)
            ClearShiftScheduleFields(item);
        else
            ApplyShiftScheduleFields(item, shiftDay);

        await EnrichOvertimeStatusAsync(item, ct);
        ApplyCreditedOvertimeMetrics(item);

        return item;
    }

    public async Task<PagedAttendanceLogsResponse> GetLogsAsync(GetAttendanceLogsQuery query, CancellationToken ct)
    {
        var page = query.Page < 1 ? 1 : query.Page;
        var pageSize = query.PageSize < 1 ? 10 : query.PageSize;

        var baseQuery = BuildAttendanceQuery(query, includeMonitoringFilters: false);

        var totalCount = await baseQuery.CountAsync(ct);

        var logs = await baseQuery
            .OrderByDescending(x => x.Date)
            .ThenByDescending(x => x.TimeIn)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var items = logs.Select(MapToDto).ToList();

        await EnrichOvertimeStatusesAsync(items, ct);
        await EnrichWorkingDaysAsync(items, ct);
        ApplyCreditedOvertimeMetrics(items);

        return new PagedAttendanceLogsResponse
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount
        };
    }

    public async Task<PagedAttendanceLogsResponse> GetMonitoringAsync(GetAttendanceLogsQuery query, CancellationToken ct)
    {
        var page = query.Page < 1 ? 1 : query.Page;
        var pageSize = query.PageSize < 1 ? 10 : query.PageSize;

        var baseQuery = BuildAttendanceQuery(query, includeMonitoringFilters: true);

        var logs = await baseQuery
            .OrderByDescending(x => x.Date)
            .ThenByDescending(x => x.TimeIn)
            .ThenByDescending(x => x.Id)
            .ToListAsync(ct);

        var actualItems = logs
            .GroupBy(x => new { x.EmployeeId, x.Date })
            .Select(group => group
                .OrderByDescending(x => x.TimeIn.HasValue)
                .ThenByDescending(x => x.TimeOut.HasValue)
                .ThenByDescending(x => x.UpdatedAtUtc ?? x.CreatedAtUtc)
                .ThenByDescending(x => x.Id)
                .First())
            .Select(MapToDto)
            .ToList();

        var actualLogKeys = actualItems
            .Select(x => (x.EmployeeId, x.Date))
            .ToHashSet();

        var generatedAbsentItems = await GenerateScheduledAbsenceDtosAsync(
            query,
            actualLogKeys,
            ct);

        var combinedItems = actualItems
            .Concat(generatedAbsentItems)
            .GroupBy(x => new { x.EmployeeId, x.Date })
            .Select(group => group
                .OrderByDescending(x => x.IsPresent)
                .ThenByDescending(x => x.TimeIn.HasValue)
                .ThenByDescending(x => x.Id)
                .First())
            .OrderByDescending(x => x.Date)
            .ThenByDescending(x => x.TimeIn.HasValue)
            .ThenByDescending(x => x.TimeIn)
            .ThenBy(x => x.EmployeeName)
            .ToList();

        var totalCount = combinedItems.Count;

        var items = combinedItems
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        await EnrichOvertimeStatusesAsync(items, ct);
        await EnrichWorkingDaysAsync(items, ct);
        ApplyCreditedOvertimeMetrics(items);

        return new PagedAttendanceLogsResponse
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount
        };
    }

    public async Task<AttendanceSummaryDto> GetSummaryAsync(GetAttendanceLogsQuery query, CancellationToken ct)
    {
        var nowLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, ManilaTimeZone);
        var today = DateOnly.FromDateTime(nowLocal);

        var summaryDateFrom = query.DateFrom ?? today;
        var summaryDateTo = query.DateTo ?? today;

        if (summaryDateTo < summaryDateFrom)
        {
            (summaryDateFrom, summaryDateTo) = (summaryDateTo, summaryDateFrom);
        }

        var logs = _context.AttendanceLogs
            .AsNoTracking()
            .Where(x => x.Date >= summaryDateFrom && x.Date <= summaryDateTo)
            .AsQueryable();

        if (query.EmployeeId.HasValue)
            logs = logs.Where(x => x.EmployeeId == query.EmployeeId.Value);

        var logsList = await logs.ToListAsync(ct);

        var totalRecords = logsList.Count;
        var presentCount = logsList.Count(x => x.IsPresent);
        var lateCount = logsList.Count(x => x.LateMinutes > 0);
        var undertimeCount = logsList.Count(x => x.UndertimeMinutes > 0);

        var approvedOvertimeDates = await _context.OvertimeRequests
            .AsNoTracking()
            .Where(request =>
                request.Status == "Approved" &&
                request.DateFrom <= summaryDateTo &&
                request.DateTo >= summaryDateFrom)
            .Where(request => !query.EmployeeId.HasValue || request.EmployeeId == query.EmployeeId.Value)
            .Select(request => new
            {
                request.EmployeeId,
                request.DateFrom,
                request.DateTo
            })
            .ToListAsync(ct);

        var overtimeKeys = new HashSet<(Guid EmployeeId, DateOnly Date)>();

        foreach (var request in approvedOvertimeDates)
        {
            var current = request.DateFrom < summaryDateFrom ? summaryDateFrom : request.DateFrom;
            var end = request.DateTo > summaryDateTo ? summaryDateTo : request.DateTo;

            while (current <= end)
            {
                overtimeKeys.Add((request.EmployeeId, current));
                current = current.AddDays(1);
            }
        }

        var actualLogKeys = logsList
            .Select(x => (x.EmployeeId, x.Date))
            .Distinct()
            .ToHashSet();

        var overtimeCount = overtimeKeys.Count(actualLogKeys.Contains);

        var absentCount = await CountScheduledAbsencesAsync(
            query,
            summaryDateFrom,
            summaryDateTo,
            actualLogKeys,
            ct);

        var overtimeRequests = _context.OvertimeRequests
            .AsNoTracking()
            .Include(x => x.Items)
            .Where(x => x.DateTo >= summaryDateFrom && x.DateFrom <= summaryDateTo)
            .AsQueryable();

        if (query.EmployeeId.HasValue)
            overtimeRequests = overtimeRequests.Where(x => x.EmployeeId == query.EmployeeId.Value);

        var pendingOvertimeRequests = await overtimeRequests
            .Where(x => x.Status == "Pending")
            .CountAsync(ct);

        var approvedOvertimeRequests = await overtimeRequests
            .Where(x => x.Status == "Approved")
            .CountAsync(ct);

        return new AttendanceSummaryDto
        {
            TotalRecords = totalRecords,
            PresentCount = presentCount,
            LateCount = lateCount,
            UndertimeCount = undertimeCount,
            OvertimeCount = overtimeCount,
            AbsentCount = absentCount,
            PendingOvertimeRequests = pendingOvertimeRequests,
            ApprovedOvertimeRequests = approvedOvertimeRequests
        };
    }

    private async Task<int> CountScheduledAbsencesAsync(
        GetAttendanceLogsQuery query,
        DateOnly dateFrom,
        DateOnly dateTo,
        HashSet<(Guid EmployeeId, DateOnly Date)> actualLogKeys,
        CancellationToken ct)
    {
        var nowLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, ManilaTimeZone);
        var today = DateOnly.FromDateTime(nowLocal);

        var assignmentsQuery = _context.EmployeeShiftAssignments
            .AsNoTracking()
            .Include(x => x.Employee)
            .ThenInclude(x => x.User)
            .Include(x => x.Shift)
            .ThenInclude(x => x.ShiftDays)
            .Where(x =>
                x.IsActive &&
                x.EffectiveFrom <= dateTo &&
                (!x.EffectiveTo.HasValue || x.EffectiveTo.Value >= dateFrom) &&
                x.Shift.IsActive);

        if (query.EmployeeId.HasValue)
            assignmentsQuery = assignmentsQuery.Where(x => x.EmployeeId == query.EmployeeId.Value);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim().ToLower();

            assignmentsQuery = assignmentsQuery.Where(x =>
                (x.Employee.EmployeeNumber != null && x.Employee.EmployeeNumber.ToLower().Contains(search)) ||
                x.Employee.FirstName.ToLower().Contains(search) ||
                x.Employee.LastName.ToLower().Contains(search));
        }

        var assignments = await assignmentsQuery.ToListAsync(ct);
        var absentKeys = new HashSet<(Guid EmployeeId, DateOnly Date)>();

        foreach (var assignment in assignments)
        {
            var current = assignment.EffectiveFrom > dateFrom ? assignment.EffectiveFrom : dateFrom;
            var assignmentEnd = assignment.EffectiveTo.HasValue && assignment.EffectiveTo.Value < dateTo
                ? assignment.EffectiveTo.Value
                : dateTo;

            while (current <= assignmentEnd)
            {
                if (current > today)
                {
                    current = current.AddDays(1);
                    continue;
                }

                if (actualLogKeys.Contains((assignment.EmployeeId, current)))
                {
                    current = current.AddDays(1);
                    continue;
                }

                if (!string.IsNullOrWhiteSpace(_holidayProvider.GetHolidayName(current)))
                {
                    current = current.AddDays(1);
                    continue;
                }

                var shiftDay = GetWorkingShiftDayForDate(assignment.Shift.ShiftDays, current);

                if (shiftDay?.StartTime == null || shiftDay.EndTime == null)
                {
                    current = current.AddDays(1);
                    continue;
                }

                var shiftEndDateTime = current.ToDateTime(shiftDay.EndTime.Value);

                if (shiftDay.EndTime.Value <= shiftDay.StartTime.Value)
                    shiftEndDateTime = shiftEndDateTime.AddDays(1);

                if (current < today || nowLocal > shiftEndDateTime)
                    absentKeys.Add((assignment.EmployeeId, current));

                current = current.AddDays(1);
            }
        }

        return absentKeys.Count;
    }

    private async Task<List<AttendanceLogDto>> GenerateScheduledAbsenceDtosAsync(
        GetAttendanceLogsQuery query,
        HashSet<(Guid EmployeeId, DateOnly Date)> actualLogKeys,
        CancellationToken ct)
    {
        if (query.IsPresent == true || query.HasLate == true || query.HasUndertime == true)
            return new List<AttendanceLogDto>();

        var nowLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, ManilaTimeZone);
        var today = DateOnly.FromDateTime(nowLocal);

        var dateFrom = query.DateFrom ?? today;
        var dateTo = query.DateTo ?? today;

        if (dateTo < dateFrom)
            (dateFrom, dateTo) = (dateTo, dateFrom);

        if (dateFrom > today)
            return new List<AttendanceLogDto>();

        if (dateTo > today)
            dateTo = today;

        var assignmentsQuery = _context.EmployeeShiftAssignments
            .AsNoTracking()
            .Include(x => x.Employee)
            .ThenInclude(x => x.User)
            .Include(x => x.Shift)
            .ThenInclude(x => x.ShiftDays)
            .Where(x =>
                x.IsActive &&
                x.EffectiveFrom <= dateTo &&
                (!x.EffectiveTo.HasValue || x.EffectiveTo.Value >= dateFrom) &&
                x.Shift.IsActive);

        if (query.EmployeeId.HasValue)
            assignmentsQuery = assignmentsQuery.Where(x => x.EmployeeId == query.EmployeeId.Value);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim().ToLower();

            assignmentsQuery = assignmentsQuery.Where(x =>
                (x.Employee.EmployeeNumber != null && x.Employee.EmployeeNumber.ToLower().Contains(search)) ||
                x.Employee.FirstName.ToLower().Contains(search) ||
                x.Employee.LastName.ToLower().Contains(search));
        }

        var assignments = await assignmentsQuery.ToListAsync(ct);
        var absentItems = new List<AttendanceLogDto>();
        var generatedKeys = new HashSet<(Guid EmployeeId, DateOnly Date)>();

        foreach (var assignment in assignments
                     .OrderBy(x => x.Employee.LastName)
                     .ThenBy(x => x.Employee.FirstName)
                     .ThenByDescending(x => x.EffectiveFrom)
                     .ThenByDescending(x => x.Id))
        {
            var current = assignment.EffectiveFrom > dateFrom ? assignment.EffectiveFrom : dateFrom;
            var assignmentEnd = assignment.EffectiveTo.HasValue && assignment.EffectiveTo.Value < dateTo
                ? assignment.EffectiveTo.Value
                : dateTo;

            while (current <= assignmentEnd)
            {
                var key = (assignment.EmployeeId, current);

                if (actualLogKeys.Contains(key) || generatedKeys.Contains(key))
                {
                    current = current.AddDays(1);
                    continue;
                }

                if (!string.IsNullOrWhiteSpace(_holidayProvider.GetHolidayName(current)))
                {
                    current = current.AddDays(1);
                    continue;
                }

                var shiftDay = GetWorkingShiftDayForDate(assignment.Shift.ShiftDays, current);

                if (shiftDay?.StartTime == null || shiftDay.EndTime == null)
                {
                    current = current.AddDays(1);
                    continue;
                }

                var shiftEndDateTime = current.ToDateTime(shiftDay.EndTime.Value);

                if (shiftDay.EndTime.Value <= shiftDay.StartTime.Value)
                    shiftEndDateTime = shiftEndDateTime.AddDays(1);

                if (current == today && nowLocal <= shiftEndDateTime)
                {
                    current = current.AddDays(1);
                    continue;
                }

                var item = new AttendanceLogDto
                {
                    Id = 0,
                    EmployeeId = assignment.EmployeeId,
                    EmployeeNumber = assignment.Employee.EmployeeNumber ?? string.Empty,
                    EmployeeName = BuildEmployeeName(
                        assignment.Employee.FirstName,
                        assignment.Employee.MiddleName,
                        assignment.Employee.LastName,
                        assignment.Employee.User?.Suffix),
                    EmployeeSuffix = assignment.Employee.User?.Suffix,
                    Date = current,
                    TimeIn = null,
                    TimeOut = null,
                    LateMinutes = 0,
                    UndertimeMinutes = 0,
                    OvertimeMinutes = 0,
                    OvertimeStatus = "None",
                    RenderedMinutes = 0,
                    CreditedMinutes = 0,
                    ExcessMinutes = 0,
                    HasExceededApprovedOvertime = false,
                    IsPresent = false,
                    Task = null,
                    Accomplished = null,
                    IsWorkingDay = true,
                    CanTimeIn = false,
                    BlockReason = "Absent. No attendance record was found for this scheduled working day.",
                    IsHoliday = false,
                    HolidayName = null
                };

                ApplyShiftScheduleFields(item, shiftDay);

                absentItems.Add(item);
                generatedKeys.Add(key);

                current = current.AddDays(1);
            }
        }

        return absentItems;
    }

    private static ShiftDay? GetWorkingShiftDayForDate(IEnumerable<ShiftDay> shiftDays, DateOnly date)
    {
        var dayOfWeek = date.ToDateTime(TimeOnly.MinValue).DayOfWeek;

        return shiftDays.FirstOrDefault(day =>
            day.IsWorkingDay &&
            day.DayOfWeek == dayOfWeek);
    }

    public async Task<byte[]> ExportCsvAsync(GetAttendanceLogsQuery query, CancellationToken ct)
    {
        var logs = await BuildAttendanceQuery(query, includeMonitoringFilters: true)
            .OrderByDescending(x => x.Date)
            .ThenByDescending(x => x.TimeIn)
            .ToListAsync(ct);

        var items = logs.Select(MapToDto).ToList();

        await EnrichOvertimeStatusesAsync(items, ct);
        await EnrichWorkingDaysAsync(items, ct);
        ApplyCreditedOvertimeMetrics(items);

        var sb = new StringBuilder();

        sb.AppendLine("EmployeeNumber,EmployeeName,Date,TimeIn,TimeOut,LateMinutes,UndertimeMinutes,OvertimeMinutes,OvertimeStatus,RenderedMinutes,CreditedMinutes,ExcessMinutes,HasExceededApprovedOvertime,IsPresent,Task,Accomplished");

        foreach (var item in items)
        {
            sb.AppendLine(string.Join(",",
                EscapeCsv(item.EmployeeNumber),
                EscapeCsv(item.EmployeeName),
                item.Date.ToString("yyyy-MM-dd"),
                item.TimeIn?.ToString("HH:mm:ss") ?? "",
                item.TimeOut?.ToString("HH:mm:ss") ?? "",
                item.LateMinutes,
                item.UndertimeMinutes,
                item.OvertimeMinutes,
                EscapeCsv(item.OvertimeStatus),
                item.RenderedMinutes,
                item.CreditedMinutes,
                item.ExcessMinutes,
                item.HasExceededApprovedOvertime ? "Yes" : "No",
                item.IsPresent ? "Yes" : "No",
                EscapeCsv(item.Task),
                EscapeCsv(item.Accomplished)));
        }

        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    public async Task<AttendanceLogDto> UpdateAsync(long id, UpdateAttendanceLogRequest request, CancellationToken ct)
    {
        var attendanceLog = await _context.AttendanceLogs
            .Include(x => x.Employee)
            .ThenInclude(x => x.User)
            .FirstOrDefaultAsync(x => x.Id == id, ct);

        if (attendanceLog == null)
            throw new ApiException("Attendance log not found.", StatusCodes.Status404NotFound);

        var shiftDay = await GetEffectiveShiftDay(attendanceLog.EmployeeId, request.Date, ct);

        ValidateAttendanceTimeRange(request.TimeIn, request.TimeOut);

        attendanceLog.Date = request.Date;
        attendanceLog.TimeIn = request.TimeIn.HasValue
            ? TimeOnly.FromTimeSpan(request.TimeIn.Value)
            : null;
        attendanceLog.TimeOut = request.TimeOut.HasValue
            ? TimeOnly.FromTimeSpan(request.TimeOut.Value)
            : null;
        attendanceLog.Task = NormalizeNullableText(request.Task);
        attendanceLog.Accomplished = NormalizeNullableText(request.Accomplished);
        attendanceLog.IsPresent = !string.Equals(request.Status, "Absent", StringComparison.OrdinalIgnoreCase)
            && request.TimeIn.HasValue;
        attendanceLog.UpdatedAtUtc = DateTime.UtcNow;

        RecalculateAttendanceFields(attendanceLog, shiftDay, request.IsOT);
        await ApplyApprovedOvertimeCapAsync(attendanceLog, ct);

        await _context.SaveChangesAsync(ct);

        var dto = MapToDto(attendanceLog);
        await EnrichOvertimeStatusAsync(dto, ct);
        await EnrichWorkingDaysAsync(new List<AttendanceLogDto> { dto }, ct);
        ApplyCreditedOvertimeMetrics(dto);

        return dto;
    }

    private async Task<AttendanceLogDto> GetAttendanceLogDtoByIdAsync(long id, CancellationToken ct)
    {
        var attendanceLog = await _context.AttendanceLogs
            .AsNoTracking()
            .Include(x => x.Employee)
            .ThenInclude(x => x.User)
            .FirstAsync(x => x.Id == id, ct);

        var dto = MapToDto(attendanceLog);

        await EnrichOvertimeStatusAsync(dto, ct);
        await EnrichWorkingDaysAsync(new List<AttendanceLogDto> { dto }, ct);
        ApplyCreditedOvertimeMetrics(dto);

        return dto;
    }

    private IQueryable<AttendanceLog> BuildAttendanceQuery(GetAttendanceLogsQuery query, bool includeMonitoringFilters)
    {
        var baseQuery = _context.AttendanceLogs
            .AsNoTracking()
            .Include(x => x.Employee)
            .ThenInclude(x => x.User)
            .AsQueryable();

        if (query.EmployeeId.HasValue)
            baseQuery = baseQuery.Where(x => x.EmployeeId == query.EmployeeId.Value);

        if (query.DateFrom.HasValue)
            baseQuery = baseQuery.Where(x => x.Date >= query.DateFrom.Value);

        if (query.DateTo.HasValue)
            baseQuery = baseQuery.Where(x => x.Date <= query.DateTo.Value);

        if (query.IsPresent.HasValue)
            baseQuery = baseQuery.Where(x => x.IsPresent == query.IsPresent.Value);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim().ToLower();

            baseQuery = baseQuery.Where(x =>
                (x.Employee.EmployeeNumber != null && x.Employee.EmployeeNumber.ToLower().Contains(search)) ||
                x.Employee.FirstName.ToLower().Contains(search) ||
                x.Employee.LastName.ToLower().Contains(search));
        }

        if (includeMonitoringFilters)
        {
            if (query.HasLate == true)
                baseQuery = baseQuery.Where(x => x.LateMinutes > 0);

            if (query.HasUndertime == true)
                baseQuery = baseQuery.Where(x => x.UndertimeMinutes > 0);
        }

        return baseQuery;
    }

    private async Task<Employee> ResolveEmployee(ClaimsPrincipal user, CancellationToken ct)
    {
        var userIdRaw =
            user.FindFirstValue(ClaimTypes.NameIdentifier) ??
            user.FindFirstValue("sub");

        if (!long.TryParse(userIdRaw, out var userId))
            throw new ApiException("Invalid user.", StatusCodes.Status401Unauthorized);

        var employee = await _context.Employees
            .Include(x => x.User)
            .FirstOrDefaultAsync(x => x.UserId == userId, ct);

        if (employee == null)
            throw new ApiException("Employee not found.", StatusCodes.Status404NotFound);

        return employee;
    }

    private async Task<ShiftDay> GetCurrentShiftDay(Guid employeeId, DateOnly workDate, CancellationToken ct)
    {
        var shiftDay = await GetShiftDayForDate(
            employeeId,
            workDate,
            requireActiveAssignment: true,
            ct);

        if (shiftDay == null)
            throw new ApiException("No active shift.", StatusCodes.Status400BadRequest);

        return shiftDay;
    }

    private async Task<ShiftDay> GetEffectiveShiftDay(Guid employeeId, DateOnly workDate, CancellationToken ct)
    {
        var shiftDay = await GetShiftDayForDate(
            employeeId,
            workDate,
            requireActiveAssignment: false,
            ct);

        if (shiftDay == null)
            throw new ApiException("No shift assignment found for this date.", StatusCodes.Status400BadRequest);

        return shiftDay;
    }

    private async Task<ShiftDay?> GetShiftDayForDate(
        Guid employeeId,
        DateOnly workDate,
        bool requireActiveAssignment,
        CancellationToken ct)
    {
        var assignmentsQuery = _context.EmployeeShiftAssignments
            .AsNoTracking()
            .Include(x => x.Shift)
            .ThenInclude(x => x.ShiftDays)
            .Where(x =>
                x.EmployeeId == employeeId &&
                x.EffectiveFrom <= workDate &&
                (!x.EffectiveTo.HasValue || x.EffectiveTo.Value >= workDate) &&
                x.Shift.IsActive);

        if (requireActiveAssignment)
            assignmentsQuery = assignmentsQuery.Where(x => x.IsActive);

        var assignment = await assignmentsQuery
            .OrderByDescending(x => x.EffectiveFrom)
            .ThenByDescending(x => x.Id)
            .FirstOrDefaultAsync(ct);

        if (assignment == null)
            return null;

        var dayOfWeek = workDate.ToDateTime(TimeOnly.MinValue).DayOfWeek;

        return assignment.Shift.ShiftDays
            .FirstOrDefault(x => x.DayOfWeek == dayOfWeek);
    }

    private async Task ApplyApprovedOvertimeCapAsync(AttendanceLog attendanceLog, CancellationToken ct)
    {
        if (!attendanceLog.TimeIn.HasValue || !attendanceLog.TimeOut.HasValue)
        {
            attendanceLog.OvertimeMinutes = 0;
            return;
        }

        if (attendanceLog.OvertimeMinutes <= 0)
        {
            attendanceLog.OvertimeMinutes = 0;
            return;
        }

        var approvedMinutes = await GetApprovedOvertimeMinutesAsync(
            attendanceLog.EmployeeId,
            attendanceLog.Date,
            ct);

        attendanceLog.OvertimeMinutes = approvedMinutes <= 0
            ? 0
            : Math.Min(attendanceLog.OvertimeMinutes, approvedMinutes);
    }

    private async Task<int> GetApprovedOvertimeMinutesAsync(Guid employeeId, DateOnly date, CancellationToken ct)
    {
        var approvedRequest = await _context.OvertimeRequests
            .AsNoTracking()
            .Include(x => x.Items)
            .Where(x =>
                x.EmployeeId == employeeId &&
                x.Status == "Approved" &&
                x.DateFrom <= date &&
                x.DateTo >= date)
            .OrderByDescending(x => x.CreatedAtUtc)
            .FirstOrDefaultAsync(ct);

        if (approvedRequest == null)
            return 0;

        var approvedItem = approvedRequest.Items
            .FirstOrDefault(x => x.Date == date);

        return approvedItem?.RequestedMinutes ?? 0;
    }

    private void RecalculateAttendanceFields(AttendanceLog attendanceLog, ShiftDay shiftDay, bool includeOvertime)
    {
        if (!attendanceLog.TimeIn.HasValue)
        {
            attendanceLog.TimeOut = null;
            attendanceLog.LateMinutes = 0;
            attendanceLog.UndertimeMinutes = 0;
            attendanceLog.OvertimeMinutes = 0;
            attendanceLog.RenderedMinutes = 0;
            attendanceLog.IsPresent = false;
            return;
        }

        attendanceLog.IsPresent = true;
        attendanceLog.LateMinutes = CalculateLateMinutes(attendanceLog.TimeIn.Value, shiftDay);

        if (!attendanceLog.TimeOut.HasValue)
        {
            attendanceLog.UndertimeMinutes = 0;
            attendanceLog.OvertimeMinutes = 0;
            attendanceLog.RenderedMinutes = 0;
            return;
        }

        ValidateAttendanceDuration(attendanceLog.TimeIn.Value, attendanceLog.TimeOut.Value);

        attendanceLog.RenderedMinutes = CalculateRenderedMinutes(
            attendanceLog.TimeIn.Value,
            attendanceLog.TimeOut.Value,
            shiftDay.BreakStartTime,
            shiftDay.BreakEndTime);

        var requiredMinutes = CalculateRequiredShiftMinutes(
            shiftDay.StartTime,
            shiftDay.EndTime,
            shiftDay.BreakStartTime,
            shiftDay.BreakEndTime);

        var regularCreditedMinutes = CalculateRegularCreditedMinutes(
            attendanceLog.TimeIn.Value,
            attendanceLog.TimeOut.Value,
            shiftDay.StartTime,
            shiftDay.EndTime,
            shiftDay.BreakStartTime,
            shiftDay.BreakEndTime,
            shiftDay.Shift.LateGraceMinutes);

        attendanceLog.UndertimeMinutes = Math.Max(0, requiredMinutes - regularCreditedMinutes);

        attendanceLog.OvertimeMinutes = includeOvertime
            ? CalculateActualOvertimeWorkedMinutes(
                attendanceLog.TimeIn.Value,
                attendanceLog.TimeOut.Value,
                shiftDay.StartTime,
                shiftDay.EndTime)
            : 0;
    }

    private async Task EnrichOvertimeStatusAsync(AttendanceLogDto item, CancellationToken ct)
    {
        var matchedRequest = await _context.OvertimeRequests
            .AsNoTracking()
            .Include(x => x.Items)
            .Where(x =>
                x.EmployeeId == item.EmployeeId &&
                x.DateFrom <= item.Date &&
                x.DateTo >= item.Date &&
                (x.Status == "Approved" || x.Status == "Pending"))
            .OrderByDescending(x => x.Status == "Approved")
            .ThenByDescending(x => x.CreatedAtUtc)
            .FirstOrDefaultAsync(ct);

        item.OvertimeStatus = matchedRequest?.Status ?? "None";

        var hasActualDtr = item.TimeIn.HasValue && item.TimeOut.HasValue;

        if (matchedRequest?.Status == "Approved")
        {
            var approvedItem = matchedRequest.Items
                .FirstOrDefault(x => x.Date == item.Date);

            if (hasActualDtr && approvedItem != null)
            {
                item.OvertimeMinutes = item.OvertimeMinutes > 0
                    ? Math.Min(item.OvertimeMinutes, approvedItem.RequestedMinutes)
                    : approvedItem.RequestedMinutes;
            }
            else
            {
                item.OvertimeMinutes = 0;
            }

            return;
        }

        item.OvertimeMinutes = 0;
    }

    private async Task EnrichOvertimeStatusesAsync(List<AttendanceLogDto> items, CancellationToken ct)
    {
        if (items.Count == 0)
            return;

        var employeeIds = items
            .Select(x => x.EmployeeId)
            .Distinct()
            .ToList();

        var minDate = items.Min(x => x.Date);
        var maxDate = items.Max(x => x.Date);

        var overtimeRequests = await _context.OvertimeRequests
            .AsNoTracking()
            .Include(x => x.Items)
            .Where(x =>
                employeeIds.Contains(x.EmployeeId) &&
                x.DateFrom <= maxDate &&
                x.DateTo >= minDate &&
                (x.Status == "Approved" || x.Status == "Pending"))
            .ToListAsync(ct);

        foreach (var item in items)
        {
            var matchedRequests = overtimeRequests
                .Where(x =>
                    x.EmployeeId == item.EmployeeId &&
                    x.DateFrom <= item.Date &&
                    x.DateTo >= item.Date)
                .OrderByDescending(x => x.Status == "Approved")
                .ThenByDescending(x => x.CreatedAtUtc)
                .ToList();

            var approvedRequest = matchedRequests.FirstOrDefault(x => x.Status == "Approved");
            var hasActualDtr = item.TimeIn.HasValue && item.TimeOut.HasValue;

            if (approvedRequest != null)
            {
                item.OvertimeStatus = "Approved";

                var approvedItem = approvedRequest.Items
                    .FirstOrDefault(x => x.Date == item.Date);

                if (hasActualDtr && approvedItem != null)
                {
                    item.OvertimeMinutes = item.OvertimeMinutes > 0
                        ? Math.Min(item.OvertimeMinutes, approvedItem.RequestedMinutes)
                        : approvedItem.RequestedMinutes;
                }
                else
                {
                    item.OvertimeMinutes = 0;
                }

                continue;
            }

            if (matchedRequests.Any(x => x.Status == "Pending"))
            {
                item.OvertimeStatus = "Pending";
                item.OvertimeMinutes = 0;
                continue;
            }

            item.OvertimeStatus = "None";
            item.OvertimeMinutes = 0;
        }
    }

    private async Task EnrichWorkingDaysAsync(List<AttendanceLogDto> items, CancellationToken ct)
    {
        if (items.Count == 0)
            return;

        var employeeIds = items
            .Select(x => x.EmployeeId)
            .Distinct()
            .ToList();

        var minDate = items.Min(x => x.Date);
        var maxDate = items.Max(x => x.Date);

        var assignments = await _context.EmployeeShiftAssignments
            .AsNoTracking()
            .Include(x => x.Shift)
            .ThenInclude(x => x.ShiftDays)
            .Where(x =>
                employeeIds.Contains(x.EmployeeId) &&
                x.EffectiveFrom <= maxDate &&
                (!x.EffectiveTo.HasValue || x.EffectiveTo.Value >= minDate) &&
                x.Shift.IsActive)
            .ToListAsync(ct);

        foreach (var item in items)
        {
            var assignment = assignments
                .Where(x =>
                    x.EmployeeId == item.EmployeeId &&
                    x.EffectiveFrom <= item.Date &&
                    (!x.EffectiveTo.HasValue || x.EffectiveTo.Value >= item.Date))
                .OrderByDescending(x => x.EffectiveFrom)
                .ThenByDescending(x => x.Id)
                .FirstOrDefault();

            if (assignment == null)
            {
                item.IsWorkingDay = false;
                ClearShiftScheduleFields(item);
                continue;
            }

            var dayOfWeek = item.Date.ToDateTime(TimeOnly.MinValue).DayOfWeek;
            var shiftDay = assignment.Shift.ShiftDays.FirstOrDefault(x => x.DayOfWeek == dayOfWeek);

            item.IsWorkingDay = shiftDay?.IsWorkingDay ?? false;

            if (shiftDay == null)
                ClearShiftScheduleFields(item);
            else
                ApplyShiftScheduleFields(item, shiftDay);
        }
    }

    private static void ApplyCreditedOvertimeMetrics(List<AttendanceLogDto> items)
    {
        foreach (var item in items)
            ApplyCreditedOvertimeMetrics(item);
    }

    private static void ApplyCreditedOvertimeMetrics(AttendanceLogDto item)
    {
        var hasActualDtr = item.TimeIn.HasValue && item.TimeOut.HasValue;

        item.RequiredMinutes = CalculateRequiredShiftMinutes(item);

        if (!hasActualDtr || item.RenderedMinutes <= 0)
        {
            item.RegularCreditedMinutes = 0;
            item.OvertimeCreditedMinutes = 0;
            item.CreditedMinutes = 0;
            item.ExcessMinutes = 0;
            item.HasExceededApprovedOvertime = false;
            return;
        }

        var regularCreditedMinutes = CalculateRegularCreditedMinutes(
            item.TimeIn!.Value,
            item.TimeOut!.Value,
            item.ShiftStartTime,
            item.ShiftEndTime,
            item.BreakStartTime,
            item.BreakEndTime,
            item.LateGraceMinutes);

        var actualOvertimeWorkedMinutes = CalculateActualOvertimeWorkedMinutes(
            item.TimeIn.Value,
            item.TimeOut.Value,
            item.ShiftStartTime,
            item.ShiftEndTime);

        var approvedOvertimeMinutes = string.Equals(item.OvertimeStatus, "Approved", StringComparison.OrdinalIgnoreCase)
            ? Math.Max(0, item.OvertimeMinutes)
            : 0;

        var overtimeCreditedMinutes = Math.Min(actualOvertimeWorkedMinutes, approvedOvertimeMinutes);
        var exceededApprovedOvertimeMinutes = Math.Max(0, actualOvertimeWorkedMinutes - approvedOvertimeMinutes);

        item.RegularCreditedMinutes = regularCreditedMinutes;
        item.OvertimeCreditedMinutes = overtimeCreditedMinutes;
        item.CreditedMinutes = regularCreditedMinutes + overtimeCreditedMinutes;
        item.ExcessMinutes = Math.Max(0, item.RenderedMinutes - item.CreditedMinutes);
        item.HasExceededApprovedOvertime = exceededApprovedOvertimeMinutes > 0;
    }

    private static int CalculateRequiredShiftMinutes(AttendanceLogDto item)
    {
        return CalculateRequiredShiftMinutes(
            item.ShiftStartTime,
            item.ShiftEndTime,
            item.BreakStartTime,
            item.BreakEndTime);
    }

    private static int CalculateRequiredShiftMinutes(
        TimeOnly? shiftStart,
        TimeOnly? shiftEnd,
        TimeOnly? breakStart,
        TimeOnly? breakEnd)
    {
        if (!shiftStart.HasValue || !shiftEnd.HasValue)
            return 0;

        var requiredMinutes = CalculateDurationMinutes(shiftStart.Value, shiftEnd.Value);

        var scheduledBreakMinutes = CalculateBreakOverlapMinutes(
            shiftStart.Value,
            shiftEnd.Value,
            breakStart,
            breakEnd);

        requiredMinutes -= scheduledBreakMinutes;

        return Math.Max(0, requiredMinutes);
    }

    private static int CalculateRenderedMinutes(
        TimeOnly timeIn,
        TimeOnly timeOut,
        TimeOnly? breakStart,
        TimeOnly? breakEnd)
    {
        var renderedMinutes = CalculateDurationMinutes(timeIn, timeOut);

        renderedMinutes -= CalculateBreakOverlapMinutes(
            timeIn,
            timeOut,
            breakStart,
            breakEnd);

        return Math.Max(0, renderedMinutes);
    }

    private static int CalculateRegularCreditedMinutes(
        TimeOnly timeIn,
        TimeOnly timeOut,
        TimeOnly? shiftStart,
        TimeOnly? shiftEnd,
        TimeOnly? breakStart,
        TimeOnly? breakEnd,
        int lateGraceMinutes)
    {
        if (!shiftStart.HasValue || !shiftEnd.HasValue)
            return 0;

        var shiftStartMinute = ToMinuteOfDay(shiftStart.Value);
        var shiftEndMinute = NormalizeEndMinute(shiftStart.Value, shiftEnd.Value);
        var actualStartMinute = NormalizeCurrentMinute(timeIn, shiftStart.Value, shiftEnd.Value);
        var actualEndMinute = NormalizeCurrentMinute(timeOut, shiftStart.Value, shiftEnd.Value);

        if (actualEndMinute <= actualStartMinute)
            actualEndMinute = NormalizeEndMinute(timeIn, timeOut);

        var lateThresholdMinute = shiftStartMinute + Math.Max(0, lateGraceMinutes);
        var creditedStartMinute = actualStartMinute <= lateThresholdMinute
            ? shiftStartMinute
            : Math.Max(actualStartMinute, shiftStartMinute);

        var creditedEndMinute = Math.Min(actualEndMinute, shiftEndMinute);

        if (creditedEndMinute <= creditedStartMinute)
            return 0;

        var creditedMinutes = creditedEndMinute - creditedStartMinute;

        creditedMinutes -= CalculateBreakOverlapMinutes(
            creditedStartMinute,
            creditedEndMinute,
            breakStart,
            breakEnd,
            shiftStartMinute,
            shiftEndMinute);

        return Math.Max(0, creditedMinutes);
    }

    private static int CalculateActualOvertimeWorkedMinutes(
        TimeOnly timeIn,
        TimeOnly timeOut,
        TimeOnly? shiftStart,
        TimeOnly? shiftEnd)
    {
        if (!shiftStart.HasValue || !shiftEnd.HasValue)
            return 0;

        var shiftEndMinute = NormalizeEndMinute(shiftStart.Value, shiftEnd.Value);
        var actualStartMinute = NormalizeCurrentMinute(timeIn, shiftStart.Value, shiftEnd.Value);
        var actualEndMinute = NormalizeCurrentMinute(timeOut, shiftStart.Value, shiftEnd.Value);

        if (actualEndMinute <= actualStartMinute)
            actualEndMinute = NormalizeEndMinute(timeIn, timeOut);

        if (actualEndMinute <= shiftEndMinute)
            return 0;

        var overtimeStartMinute = Math.Max(actualStartMinute, shiftEndMinute);

        return Math.Max(0, actualEndMinute - overtimeStartMinute);
    }

    private static int CalculateBreakOverlapMinutes(
        int rangeStartMinute,
        int rangeEndMinute,
        TimeOnly? breakStart,
        TimeOnly? breakEnd,
        int anchorStartMinute,
        int anchorEndMinute)
    {
        if (!breakStart.HasValue || !breakEnd.HasValue)
            return 0;

        var breakStartMinute = ToMinuteOfDay(breakStart.Value);
        var breakEndMinute = NormalizeEndMinute(breakStart.Value, breakEnd.Value);

        if (anchorEndMinute > MinutesPerDay && breakStartMinute < anchorStartMinute)
        {
            breakStartMinute += MinutesPerDay;
            breakEndMinute += MinutesPerDay;
        }

        if (breakEndMinute <= breakStartMinute)
            return 0;

        var overlapStart = Math.Max(rangeStartMinute, breakStartMinute);
        var overlapEnd = Math.Min(rangeEndMinute, breakEndMinute);

        if (overlapEnd <= overlapStart)
            return 0;

        return overlapEnd - overlapStart;
    }

    private static AttendanceLogDto MapToDto(AttendanceLog x)
    {
        return new AttendanceLogDto
        {
            Id = x.Id,
            EmployeeId = x.EmployeeId,
            EmployeeNumber = x.Employee.EmployeeNumber ?? string.Empty,
            EmployeeName = BuildEmployeeName(
                x.Employee.FirstName,
                x.Employee.MiddleName,
                x.Employee.LastName,
                x.Employee.User != null ? x.Employee.User.Suffix : null),
            EmployeeSuffix = x.Employee.User != null ? x.Employee.User.Suffix : null,
            Date = x.Date,
            TimeIn = x.TimeIn,
            TimeOut = x.TimeOut,
            LateMinutes = x.LateMinutes,
            UndertimeMinutes = x.UndertimeMinutes,
            OvertimeMinutes = x.OvertimeMinutes,
            OvertimeStatus = "None",
            RenderedMinutes = x.RenderedMinutes,
            RequiredMinutes = 0,
            RegularCreditedMinutes = 0,
            OvertimeCreditedMinutes = 0,
            CreditedMinutes = 0,
            ExcessMinutes = 0,
            HasExceededApprovedOvertime = false,
            IsPresent = x.IsPresent,
            Task = x.Task,
            Accomplished = x.Accomplished
        };
    }

    private static void ApplyShiftScheduleFields(AttendanceLogDto item, ShiftDay shiftDay)
    {
        item.ShiftStartTime = shiftDay.StartTime;
        item.TimeInOpenTime = shiftDay.StartTime?.AddMinutes(-EarlyTimeInBufferMinutes);
        item.BreakStartTime = shiftDay.BreakStartTime;
        item.BreakEndTime = shiftDay.BreakEndTime;
        item.ShiftEndTime = shiftDay.EndTime;
        item.LateGraceMinutes = shiftDay.Shift.LateGraceMinutes;
    }

    private static void ClearShiftScheduleFields(AttendanceLogDto item)
    {
        item.ShiftStartTime = null;
        item.TimeInOpenTime = null;
        item.BreakStartTime = null;
        item.BreakEndTime = null;
        item.ShiftEndTime = null;
        item.LateGraceMinutes = 0;
    }

    private static void ValidateAttendanceTimeRange(TimeSpan? timeIn, TimeSpan? timeOut)
    {
        if (!timeIn.HasValue || !timeOut.HasValue)
            return;

        var normalizedTimeIn = TimeOnly.FromTimeSpan(timeIn.Value);
        var normalizedTimeOut = TimeOnly.FromTimeSpan(timeOut.Value);

        ValidateAttendanceDuration(normalizedTimeIn, normalizedTimeOut);
    }

    private static void ValidateAttendanceDuration(TimeOnly timeIn, TimeOnly timeOut)
    {
        var totalMinutes = CalculateDurationMinutes(timeIn, timeOut);

        if (totalMinutes <= 0)
            throw new ApiException("Time out must be later than time in.", StatusCodes.Status400BadRequest);

        if (totalMinutes > TimeSpan.FromHours(MaxAttendanceDurationHours).TotalMinutes)
            throw new ApiException($"Attendance duration cannot exceed {MaxAttendanceDurationHours} hours.", StatusCodes.Status400BadRequest);
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


    private const int MinutesPerDay = 24 * 60;

    private sealed record TimeInAvailability(bool CanTimeIn, string? BlockReason);

    private static TimeInAvailability ResolveTimeInAvailability(
        DateTime currentLocalDateTime,
        DateOnly workDate,
        ShiftDay? shiftDay,
        string? holidayName)
    {
        if (shiftDay == null)
            return new TimeInAvailability(false, "No assigned shift.");

        if (!string.IsNullOrWhiteSpace(holidayName))
            return new TimeInAvailability(false, "Holiday. Work is not required today.");

        if (!shiftDay.IsWorkingDay)
            return new TimeInAvailability(false, "Today is not part of your scheduled working days. Time in is unavailable.");

        var blockReason = GetTimeInBlockReason(currentLocalDateTime, workDate, shiftDay);

        return new TimeInAvailability(string.IsNullOrWhiteSpace(blockReason), blockReason);
    }

    private static string? GetTimeInBlockReason(DateTime currentLocalDateTime, DateOnly workDate, ShiftDay shiftDay)
    {
        if (!shiftDay.StartTime.HasValue || !shiftDay.EndTime.HasValue)
            return "Shift schedule is incomplete. Please contact HR/Admin.";

        var window = BuildShiftWindow(workDate, shiftDay);

        if (currentLocalDateTime >= window.End)
            return "You cannot time in after shift end.";

        if (currentLocalDateTime < window.EarliestTimeIn)
            return "You can time in starting 10 minutes before your shift.";

        if (window.BreakStart.HasValue &&
            window.BreakEnd.HasValue &&
            currentLocalDateTime >= window.BreakStart.Value &&
            currentLocalDateTime < window.BreakEnd.Value)
        {
            return "You cannot time in during break time.";
        }

        return null;
    }

    private sealed record ShiftWindow(
        DateTime EarliestTimeIn,
        DateTime Start,
        DateTime? BreakStart,
        DateTime? BreakEnd,
        DateTime End);

    private static ShiftWindow BuildShiftWindow(DateOnly workDate, ShiftDay shiftDay)
    {
        var start = workDate.ToDateTime(shiftDay.StartTime!.Value);
        var end = workDate.ToDateTime(shiftDay.EndTime!.Value);

        if (end <= start)
            end = end.AddDays(1);

        var earliestTimeIn = start.AddMinutes(-EarlyTimeInBufferMinutes);

        if (earliestTimeIn.Date < start.Date)
            earliestTimeIn = start;

        DateTime? breakStart = null;
        DateTime? breakEnd = null;

        if (shiftDay.BreakStartTime.HasValue && shiftDay.BreakEndTime.HasValue)
        {
            breakStart = workDate.ToDateTime(shiftDay.BreakStartTime.Value);
            breakEnd = workDate.ToDateTime(shiftDay.BreakEndTime.Value);

            if (end.Date > start.Date && breakStart.Value < start)
            {
                breakStart = breakStart.Value.AddDays(1);
                breakEnd = breakEnd.Value.AddDays(1);
            }

            if (breakEnd.Value <= breakStart.Value)
                breakEnd = breakEnd.Value.AddDays(1);
        }

        return new ShiftWindow(earliestTimeIn, start, breakStart, breakEnd, end);
    }

    private static bool IsBeforeEarliestTimeIn(TimeOnly currentTime, ShiftDay shiftDay)
    {
        if (!shiftDay.StartTime.HasValue || !shiftDay.EndTime.HasValue)
            return false;

        var startMinute = ToMinuteOfDay(shiftDay.StartTime.Value);
        var endMinute = NormalizeEndMinute(shiftDay.StartTime.Value, shiftDay.EndTime.Value);
        var currentMinute = NormalizeCurrentMinute(currentTime, shiftDay.StartTime.Value, shiftDay.EndTime.Value);
        var earliestMinute = startMinute - EarlyTimeInBufferMinutes;

        if (startMinute == 0 && earliestMinute < 0)
            earliestMinute = 0;

        if (currentMinute >= endMinute)
            return false;

        return currentMinute < earliestMinute;
    }

    private static bool IsAfterShiftEnd(TimeOnly currentTime, ShiftDay shiftDay)
    {
        if (!shiftDay.StartTime.HasValue || !shiftDay.EndTime.HasValue)
            return false;

        var currentMinute = NormalizeCurrentMinute(currentTime, shiftDay.StartTime.Value, shiftDay.EndTime.Value);
        var endMinute = NormalizeEndMinute(shiftDay.StartTime.Value, shiftDay.EndTime.Value);

        return currentMinute >= endMinute;
    }

    private static bool IsWithinBreakTime(TimeOnly currentTime, ShiftDay shiftDay)
    {
        if (!shiftDay.BreakStartTime.HasValue || !shiftDay.BreakEndTime.HasValue)
            return false;

        var currentMinute = ToMinuteOfDay(currentTime);
        var breakStartMinute = ToMinuteOfDay(shiftDay.BreakStartTime.Value);
        var breakEndMinute = NormalizeEndMinute(shiftDay.BreakStartTime.Value, shiftDay.BreakEndTime.Value);

        if (breakEndMinute > MinutesPerDay && currentMinute < breakStartMinute)
            currentMinute += MinutesPerDay;

        return currentMinute >= breakStartMinute && currentMinute < breakEndMinute;
    }

    private static int CalculateLateMinutes(TimeOnly timeIn, ShiftDay shiftDay)
    {
        if (!shiftDay.StartTime.HasValue || !shiftDay.EndTime.HasValue)
            return 0;

        var timeInMinute = NormalizeCurrentMinute(timeIn, shiftDay.StartTime.Value, shiftDay.EndTime.Value);
        var lateThresholdMinute = ToMinuteOfDay(shiftDay.StartTime.Value) + shiftDay.Shift.LateGraceMinutes;

        return timeInMinute > lateThresholdMinute
            ? timeInMinute - lateThresholdMinute
            : 0;
    }

    private static int CalculateDurationMinutes(TimeOnly start, TimeOnly end)
    {
        var startMinute = ToMinuteOfDay(start);
        var endMinute = NormalizeEndMinute(start, end);

        return endMinute - startMinute;
    }

    private static int NormalizeCurrentMinute(TimeOnly current, TimeOnly start, TimeOnly end)
    {
        var currentMinute = ToMinuteOfDay(current);
        var startMinute = ToMinuteOfDay(start);
        var endMinute = ToMinuteOfDay(end);

        // Overnight shifts: only post-midnight times should be moved to the next day.
        if (endMinute < startMinute && currentMinute <= endMinute)
            return currentMinute + MinutesPerDay;

        return currentMinute;
    }

    private static int NormalizeEndMinute(TimeOnly start, TimeOnly end)
    {
        var startMinute = ToMinuteOfDay(start);
        var endMinute = ToMinuteOfDay(end);

        if (endMinute < startMinute)
            return endMinute + MinutesPerDay;

        return endMinute;
    }

    private static int ToMinuteOfDay(TimeOnly value)
    {
        return value.Hour * 60 + value.Minute;
    }

    private static string BuildEmployeeName(
        string? firstName,
        string? middleName,
        string? lastName,
        string? suffix)
    {
        var normalizedFirstName = NormalizeNullableText(firstName);
        var normalizedMiddleName = NormalizeNullableText(middleName);
        var normalizedLastName = NormalizeNullableText(lastName);
        var normalizedSuffix = NormalizeNullableText(suffix);

        var middleInitial = string.IsNullOrWhiteSpace(normalizedMiddleName)
            ? null
            : $"{char.ToUpperInvariant(normalizedMiddleName[0])}.";

        var givenName = string.Join(" ", new[] { normalizedFirstName, middleInitial }
            .Where(x => !string.IsNullOrWhiteSpace(x)));

        var displayName = string.IsNullOrWhiteSpace(normalizedLastName)
            ? givenName
            : string.IsNullOrWhiteSpace(givenName)
                ? normalizedLastName
                : $"{normalizedLastName}, {givenName}";

        if (!string.IsNullOrWhiteSpace(normalizedSuffix))
        {
            displayName = string.IsNullOrWhiteSpace(displayName)
                ? normalizedSuffix
                : $"{displayName}, {normalizedSuffix}";
        }

        return string.IsNullOrWhiteSpace(displayName) ? "Unknown Employee" : displayName;
    }

    private static string EscapeCsv(string? value)
    {
        if (string.IsNullOrEmpty(value))
            return "";

        if (value.Contains(',') || value.Contains('"') || value.Contains('\n') || value.Contains('\r'))
        {
            return $"\"{value.Replace("\"", "\"\"")}\"";
        }

        return value;
    }

    private static string? NormalizeNullableText(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        return value.Trim();
    }
}