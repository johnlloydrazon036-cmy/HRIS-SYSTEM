import { apiRequest } from "./api";

/* =========================
   TYPES
========================= */

export type AttendanceLogDto = {
    id: number;
    employeeId: string;
    employeeName: string;
    employeeSuffix?: string;
    employeeNumber: string;
    date: string;
    timeIn?: string | null;
    timeOut?: string | null;
    lateMinutes?: number;
    undertimeMinutes?: number;
    overtimeMinutes?: number;
    overtimeStatus?: "None" | "Pending" | "Approved";
    renderedMinutes?: number;
    requiredMinutes?: number;
    regularCreditedMinutes?: number;
    overtimeCreditedMinutes?: number;
    creditedMinutes?: number;
    excessMinutes?: number;
    hasExceededApprovedOvertime?: boolean;
    isPresent?: boolean;
    status?: string;
    totalWorkedMinutes?: number;
    task?: string | null;
    accomplished?: string | null;
    isWorkingDay?: boolean;
    canTimeIn?: boolean;
    blockReason?: string | null;
    isHoliday?: boolean;
    holidayName?: string | null;
    shiftName?: string | null;
    shiftStartTime?: string | null;
    timeInOpenTime?: string | null;
    breakStartTime?: string | null;
    breakEndTime?: string | null;
    shiftEndTime?: string | null;
    lateGraceMinutes?: number;
};

export type AttendanceSummaryDto = {
    totalRecords: number;
    presentCount: number;
    lateCount: number;
    undertimeCount?: number;
    overtimeCount?: number;
    pendingOvertimeRequests?: number;
    approvedOvertimeRequests: number;
    absentCount?: number;
};

export type GetAttendanceLogsQuery = {
    page?: number;
    pageSize?: number;
    dateFrom?: string;
    dateTo?: string;
    employeeId?: string;
    isPresent?: boolean;
    search?: string;
    hasLate?: boolean;
    hasUndertime?: boolean;
};

export type PagedAttendanceLogsResponse = {
    items: AttendanceLogDto[];
    totalCount: number;
    page: number;
    pageSize: number;
};

export type OvertimeRequestDto = {
    id: number;
    employeeId?: string;
    employeeNumber?: string;
    employeeName: string;
    attendanceDate?: string;
    dateFrom?: string;
    dateTo?: string;
    requestedMinutes?: number;
    requestedMinutesPerDay?: number;
    totalRequestedMinutes?: number;
    reason: string;
    status: string;
    reviewedByUserId?: number | null;
    reviewedByName?: string | null;
    reviewedAtUtc?: string | null;
    reviewRemarks?: string | null;
    createdAtUtc?: string;
    updatedAtUtc?: string | null;
};

export type PagedOvertimeRequestsResponse = {
    items: OvertimeRequestDto[];
    totalCount?: number;
    page?: number;
    pageSize?: number;
};

export type AttendanceActionResponseDto = AttendanceLogDto;

export type TimeInRequest = {
    task?: string;
};

export type TimeOutRequest = {
    accomplished?: string;
};

export type UpdateAttendanceLogRequest = {
    id: number;
    date: string;
    timeIn?: string | null;
    timeOut?: string | null;
    status: string;
    task?: string | null;
    accomplished?: string | null;
    isOT?: boolean;
};

export type SubmitOvertimeRequestPayload = {
    dateFrom: string;
    dateTo: string;
    requestedMinutes: number;
    reason: string;
};

export type AdminAssignOvertimeRequestPayload = {
    employeeId: string;
    dateFrom: string;
    dateTo: string;
    requestedMinutes: number;
    reason?: string;
};

export type ShiftDay = {
    id: number;
    dayOfWeek: number;
    isWorkingDay: boolean;
    startTime: string | null;
    breakStartTime: string | null;
    breakEndTime: string | null;
    endTime: string | null;
};

export type Shift = {
    id: number;
    code: string;
    name: string;
    description?: string | null;
    lateGraceMinutes: number;
    isFlexible: boolean;
    isActive: boolean;
    assignedCount?: number;
    createdAtUtc: string;
    updatedAtUtc?: string | null;
    days: ShiftDay[];
};

export type PagedShiftsResponse = {
    items: Shift[];
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
};

export type SaveShiftDayRequest = {
    id?: number;
    dayOfWeek: number;
    isWorkingDay: boolean;
    startTime?: string | null;
    breakStartTime?: string | null;
    breakEndTime?: string | null;
    endTime?: string | null;
};

export type CreateShiftRequest = {
    code: string;
    name: string;
    description?: string | null;
    lateGraceMinutes: number;
    isFlexible: boolean;
    isActive?: boolean;
    days?: SaveShiftDayRequest[];
};

export type UpdateShiftRequest = CreateShiftRequest;

export type AssignShiftRequest = {
    employeeId: string;
    shiftId: number;
    effectiveFrom: string;
};

export type EmployeeShiftAssignmentDto = {
    id: number;
    employeeId: string;
    shiftId: number;
    employeeNumber?: string | null;
    fullName?: string | null;
    department?: string | null;
    position?: string | null;
    effectiveFrom: string;
    effectiveTo?: string | null;
    isActive: boolean;
};

/* =========================
   QUERY BUILDER
========================= */

function buildQuery(params: Record<string, unknown>) {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") return;
        query.append(key, String(value));
    });

    const qs = query.toString();
    return qs ? `?${qs}` : "";
}

/* =========================
   ADMIN API
========================= */

export async function getAttendanceLogs(
    query: GetAttendanceLogsQuery = {}
): Promise<PagedAttendanceLogsResponse> {
    const qs = buildQuery({
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 10,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        employeeId: query.employeeId,
        isPresent: query.isPresent,
        search: query.search,
        hasLate: query.hasLate,
        hasUndertime: query.hasUndertime,
    });

    return apiRequest(`/attendance/logs/monitoring${qs}`);
}

export async function getAttendanceSummary(
    query: GetAttendanceLogsQuery = {}
): Promise<AttendanceSummaryDto> {
    const qs = buildQuery({
        page: query.page,
        pageSize: query.pageSize,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        employeeId: query.employeeId,
        isPresent: query.isPresent,
        search: query.search,
        hasLate: query.hasLate,
        hasUndertime: query.hasUndertime,
    });

    return apiRequest(`/attendance/logs/summary${qs}`);
}

export async function updateAttendanceLog(
    payload: UpdateAttendanceLogRequest
): Promise<AttendanceLogDto> {
    return apiRequest(`/attendance/logs/${payload.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
    });
}

/* =========================
   SHIFT API
========================= */

export async function getShifts(
    query: { page?: number; pageSize?: number; search?: string; isActive?: boolean } = {}
): Promise<PagedShiftsResponse> {
    const qs = buildQuery({
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 50,
        search: query.search,
        isActive: query.isActive,
    });

    return apiRequest(`/shifts${qs}`);
}

export async function createShift(payload: CreateShiftRequest): Promise<Shift> {
    return apiRequest(`/shifts`, {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export async function updateShift(
    id: number,
    payload: UpdateShiftRequest
): Promise<Shift> {
    return apiRequest(`/shifts/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
    });
}

export async function updateShiftStatus(
    id: number,
    payload: { isActive: boolean }
): Promise<void> {
    return apiRequest(`/shifts/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify(payload),
    });
}

export async function assignShift(
    payload: AssignShiftRequest
): Promise<EmployeeShiftAssignmentDto> {
    return apiRequest(`/attendance/assignments`, {
        method: "POST",
        body: JSON.stringify({
            employeeId: payload.employeeId,
            shiftId: payload.shiftId,
            effectiveFrom: toApiDateString(payload.effectiveFrom),
        }),
    });
}

export async function getCurrentShiftAssignment(
    employeeId: string
): Promise<EmployeeShiftAssignmentDto | null> {
    return apiRequest(`/attendance/assignments/current/${employeeId}`);
}


export async function getMyCurrentShift(): Promise<Shift | null> {
    return apiRequest(`/attendance/assignments/me/current-shift`);
}

export async function getShiftAssignmentsByShift(
    shiftId: number
): Promise<EmployeeShiftAssignmentDto[]> {
    return apiRequest(`/attendance/assignments/by-shift/${shiftId}`);
}

export async function unassignShiftAssignment(assignmentId: number): Promise<void> {
    return apiRequest(`/attendance/assignments/${assignmentId}`, {
        method: "DELETE",
    });
}

/* =========================
   OVERTIME API
========================= */

export async function getOvertimeRequests(
    query: { page?: number; pageSize?: number } = {}
): Promise<PagedOvertimeRequestsResponse> {
    const qs = buildQuery({
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 10,
    });

    return apiRequest(`/api/attendance/overtime-requests${qs}`);
}

export async function getMyOvertimeRequests(
    query: { page?: number; pageSize?: number } = {}
): Promise<PagedOvertimeRequestsResponse> {
    const qs = buildQuery({
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 10,
    });

    return apiRequest(`/api/attendance/overtime-requests/me${qs}`);
}

export async function submitOvertimeRequest(
    payload: SubmitOvertimeRequestPayload
) {
    return apiRequest(`/api/attendance/overtime-requests`, {
        method: "POST",
        body: JSON.stringify({
            dateFrom: toApiDateString(payload.dateFrom),
            dateTo: toApiDateString(payload.dateTo),
            requestedMinutes: payload.requestedMinutes,
            reason: payload.reason,
        }),
    });
}

export async function adminAssignOvertimeRequest(
    payload: AdminAssignOvertimeRequestPayload
) {
    return apiRequest(`/api/attendance/overtime-requests/admin-assign`, {
        method: "POST",
        body: JSON.stringify({
            employeeId: payload.employeeId,
            dateFrom: toApiDateString(payload.dateFrom),
            dateTo: toApiDateString(payload.dateTo),
            requestedMinutes: payload.requestedMinutes,
            reason: payload.reason?.trim() || null,
        }),
    });
}

export async function reviewOvertimeRequest(
    id: number,
    payload: {
        action: "Approve" | "Reject";
        remarks?: string;
    }
) {
    return apiRequest(`/api/attendance/overtime-requests/${id}/review`, {
        method: "PATCH",
        body: JSON.stringify(payload),
    });
}

/* =========================
   USER API
========================= */

export async function getMyAttendanceLogs(
    query: GetAttendanceLogsQuery = {}
): Promise<PagedAttendanceLogsResponse> {
    const qs = buildQuery({
        page: query.page ?? 1,
        pageSize: query.pageSize ?? 10,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
    });

    return apiRequest(`/attendance/logs/me${qs}`);
}

export async function getTodayMyAttendanceLog(): Promise<AttendanceLogDto | null> {
    return apiRequest(`/attendance/logs/me/today`);
}

export async function timeIn(
    payload: TimeInRequest = {}
): Promise<AttendanceActionResponseDto> {
    return apiRequest(`/attendance/logs/time-in`, {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export async function timeOut(
    payload: TimeOutRequest = {}
): Promise<AttendanceActionResponseDto> {
    return apiRequest(`/attendance/logs/time-out`, {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export async function updateAttendanceRemarks(
    payload: UpdateAttendanceLogRequest
): Promise<AttendanceLogDto> {
    return updateAttendanceLog(payload);
}

/* =========================
   HELPERS
========================= */

export function formatAttendanceTime(time?: string | null): string {
    if (!time) return "-";

    const value = String(time).trim();
    if (!value) return "-";

    if (/^\d{1,2}:\d{2}\s?(AM|PM)$/i.test(value)) {
        const [rawTime, rawModifier] = value.split(/\s+/);
        const [hour, minute] = rawTime.split(":").map(Number);
        const modifier = rawModifier.toUpperCase();

        if (Number.isNaN(hour) || Number.isNaN(minute)) return "-";

        return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${modifier}`;
    }

    const timeOnlyMatch = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/);
    if (timeOnlyMatch) {
        let hour = Number(timeOnlyMatch[1]);
        const minute = Number(timeOnlyMatch[2]);

        if (Number.isNaN(hour) || Number.isNaN(minute)) return "-";

        const modifier = hour >= 12 ? "PM" : "AM";

        if (hour === 0) hour = 12;
        else if (hour > 12) hour -= 12;

        return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${modifier}`;
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        });
    }

    return "-";
}

export function formatMinutesToHours(minutes?: number | null): string {
    const safeMinutes = Number(minutes ?? 0);
    return (safeMinutes / 60).toFixed(1);
}

export function toApiTimeString(value?: string | null): string | null {
    if (!value) return null;

    const raw = value.trim();
    if (!raw || raw === "-") return null;

    if (/^\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(raw)) {
        return raw.length === 5 ? `${raw}:00` : raw;
    }

    const match = raw.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
    if (!match) return null;

    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const modifier = match[3].toUpperCase();

    if (modifier === "AM" && hour === 12) hour = 0;
    if (modifier === "PM" && hour !== 12) hour += 12;

    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}

export function toApiDateString(value?: string | null): string {
    if (!value) return "";

    const raw = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

    const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
        const [, month, day, year] = slashMatch;
        return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return raw;

    return parsed.toISOString().split("T")[0];
}