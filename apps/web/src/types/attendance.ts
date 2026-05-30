export type AttendanceOvertimeStatus =
    | 'None'
    | 'Pending'
    | 'Approved'
    | 'Rejected';

export type StatusBadgeMap = Record<string, string>;

export type AttendanceSummaryCard = {
    label: string;
    value: number;
    icon: React.ComponentType<{ className?: string }>;
    variant: 'success' | 'info' | 'warning' | 'danger';
};

export type AttendanceFilter = 'all' | 'present' | 'late' | 'absent';

export type AttendanceTab = 'dtr' | 'ot' | 'setup';

export type AdminAttendanceTab = AttendanceTab;

export type AttendanceStatus =
    | 'Present'
    | 'Late'
    | 'Absent';

export type DtrStatusFilter =
    | ''
    | 'All'
    | 'Present'
    | 'Late'
    | 'Undertime'
    | 'Overtime'
    | 'Absent';

export type DtrSortFilter = 'latest' | 'oldest';

export type DtrFilters = {
    dateFrom: string;
    dateTo: string;
    search: string;
    status: DtrStatusFilter;
    sort: DtrSortFilter;
};

export type ShiftFormState = {
    name: string;
    timeIn: string;
    timeOut: string;
    grace: string;
    status: 'Active' | 'Inactive';
};

export type AdminOvertimeRequestRow = {
    id: number;
    date: string;
    employee: string;
    duration: string;
    reason: string;
    status: 'Pending' | 'Approved' | 'Rejected';
};


export type AdminDtrRecord = {
    id: number;

    empId: string;
    name: string;
    suffix?: string;

    date: string;

    timeIn: string;
    timeOut: string;

    status: AttendanceStatus;

    isOT: boolean;
    isUndertime: boolean;

    overtimeStatus: AttendanceOvertimeStatus;

    task: string;
    accomplished: string;

    lateMinutes: number;
    undertimeMinutes: number;
    overtimeMinutes: number;

    renderedMinutes: number;

    requiredMinutes?: number;
    regularCreditedMinutes?: number;
    overtimeCreditedMinutes?: number;

    creditedMinutes: number;
    excessMinutes: number;
    hasExceededApprovedOvertime: boolean;
};


export type AdminShiftRecord = {
    id: number;
    name: string;
    timeIn: string;
    timeOut: string;
    grace: string;
    employees: number;
    assignedCount?: number;
    status: 'Active' | 'Inactive';
};

export type UserAttendanceRecord = {
    id: number;

    date: string;

    timeIn: string;
    timeOut: string;

    total: string;

    status: string;

    overtimeStatus: AttendanceOvertimeStatus;

    lateMinutes: number;
    undertimeMinutes: number;
    overtimeMinutes: number;

    renderedMinutes: number;

    requiredMinutes?: number;
    regularCreditedMinutes?: number;
    overtimeCreditedMinutes?: number;

    creditedMinutes: number;
    excessMinutes: number;
    hasExceededApprovedOvertime: boolean;

    task: string;
    accomplished: string;
};

export type OvertimeRequestRecord = {
    id: number;

    employeeId: string;
    employeeName: string;

    date: string;

    duration: string;

    reason: string;

    status: AttendanceOvertimeStatus;

    task?: string;
    accomplished?: string;
};

export type ShiftScheduleRecord = {
    id: number;

    code: string;
    name: string;

    description?: string;

    lateGraceMinutes: number;

    isFlexible: boolean;
    isActive: boolean;

    assignedCount: number;

    createdAtUtc?: string;
    updatedAtUtc?: string;

    days: ShiftDayRecord[];
};

export type ShiftDayRecord = {
    id: number;

    dayOfWeek: number;

    startTime?: string;
    endTime?: string;

    breakStartTime?: string;
    breakEndTime?: string;

    isRestDay: boolean;
};

export type ShiftAssignmentRecord = {
    id: number;

    employeeId: string;
    employeeName: string;

    employeeNumber: string;

    shiftId: number;
    shiftName: string;

    effectiveFrom: string;

    employmentType?: string;

    isActive: boolean;
};