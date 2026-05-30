export type AssignOvertimeShiftDayOption = {
  dayOfWeek: number;
  isWorkingDay: boolean;
};

export type AssignOvertimeEmployeeOption = {
  id: string;
  employeeNumber?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  middleName?: string | null;
  suffix?: string | null;

  // Shift enforcement
  hasAssignedShift?: boolean;
  isShiftActive?: boolean;
  effectiveFrom?: string | null;
  shiftDays?: AssignOvertimeShiftDayOption[];
};

export type AssignOvertimeAttendanceOption = {
  employeeNumber: string;
  date: string;
  timeIn?: string | null;
  timeOut?: string | null;
  status?: string | null;

  // Shift-aware preview
  isWorkingDay?: boolean;
  hasAssignedShift?: boolean;
  isShiftActive?: boolean;

  // Existing OT conflict
  hasExistingOvertime?: boolean;
};

export type AssignOtFormState = {
  employeeId: string;
  dateFrom: string;
  dateTo: string;
  requestedMinutes: string;
  reason: string;
};

export type PreviewDayStatus =
  | 'assignable'
  | 'needs-dtr'
  | 'blocked'
  | 'invalid-range';

export type PreviewDay = {
  key: string;
  apiDate: string;
  displayDate: string;
  dayName: string;
  otHours: number;
  status: PreviewDayStatus;
  message: string;
};

export const MAX_ADMIN_OT_MINUTES_PER_DAY = 180;
export const OT_CUTOFF_MINUTES = 20 * 60 + 30;
export const MAX_PREVIEW_DAYS = 31;
export const MIN_PREVIEW_ROWS = 5;
export const MAX_ADMIN_OT_DAYS = 5;

export const OVERTIME_HOUR_OPTIONS = [
  { label: '0.5 hour', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '1.5 hours', minutes: 90 },
  { label: '2 hours', minutes: 120 },
  { label: '2.5 hours', minutes: 150 },
  { label: '3 hours', minutes: 180 },
];

export const formatMinutes = (value: number | string) => {
  const minutes = Number(value);

  if (!Number.isFinite(minutes) || minutes <= 0) {
    return '--';
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${remainingMinutes}m`;
  }

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
};

export const formatEmployeeName = (
  employee: AssignOvertimeEmployeeOption
) => {
  const lastName = employee.lastName?.trim() || '';
  const firstName = employee.firstName?.trim() || '';

  const middleInitial = employee.middleName?.trim()
    ? ` ${employee.middleName.trim().charAt(0).toUpperCase()}.`
    : '';

  const suffix = employee.suffix?.trim()
    ? ` ${employee.suffix.trim()}`
    : '';

  const name =
    lastName || firstName
      ? `${lastName}${lastName && firstName ? ', ' : ''}${firstName}${middleInitial}${suffix}`
      : 'Unnamed Employee';

  return employee.employeeNumber
    ? `${name} (${employee.employeeNumber})`
    : name;
};

export const parseApiDate = (value: string) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00`);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const toApiDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export const toDisplayDate = (date: Date) =>
  date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

export const getDayName = (date: Date) =>
  date.toLocaleDateString('en-US', {
    weekday: 'short',
  });

export const parseTimeToMinutes = (value?: string | null) => {
  if (!value || value === '--') {
    return null;
  }

  const trimmed = value.trim();

  const twelveHourMatch = trimmed.match(
    /^(\d{1,2}):(\d{2})\s?(AM|PM)$/i
  );

  if (twelveHourMatch) {
    let hour = Number(twelveHourMatch[1]);
    const minute = Number(twelveHourMatch[2]);
    const modifier = twelveHourMatch[3].toUpperCase();

    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      return null;
    }

    if (modifier === 'AM' && hour === 12) {
      hour = 0;
    }

    if (modifier === 'PM' && hour !== 12) {
      hour += 12;
    }

    return hour * 60 + minute;
  }

  const timeOnlyMatch = trimmed.match(
    /^(\d{1,2}):(\d{2})(?::\d{2})?/
  );

  if (timeOnlyMatch) {
    const hour = Number(timeOnlyMatch[1]);
    const minute = Number(timeOnlyMatch[2]);

    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      return null;
    }

    return hour * 60 + minute;
  }

  return null;
};

export const getDateRange = (
  dateFrom: string,
  dateTo: string
) => {
  const start = parseApiDate(dateFrom);
  const end = parseApiDate(dateTo);

  if (!start || !end || start > end) {
    return [];
  }

  const dates: Date[] = [];
  const cursor = new Date(start);

  while (
    cursor <= end &&
    dates.length < MAX_PREVIEW_DAYS
  ) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
};

const getShiftDayForDate = (
  employee: AssignOvertimeEmployeeOption | undefined,
  date: Date
) => {
  if (!employee?.shiftDays?.length) {
    return undefined;
  }

  return employee.shiftDays.find(
    (day) => Number(day.dayOfWeek) === date.getDay()
  );
};

const isBeforeEffectiveDate = (
  employee: AssignOvertimeEmployeeOption | undefined,
  apiDate: string
) => {
  if (!employee?.effectiveFrom) {
    return false;
  }

  return apiDate < employee.effectiveFrom;
};

export const buildPreviewDays = ({
  form,
  employees,
  attendanceRecords,
}: {
  form: AssignOtFormState;
  employees: AssignOvertimeEmployeeOption[];
  attendanceRecords: AssignOvertimeAttendanceOption[];
}): PreviewDay[] => {
  const selectedEmployee = employees.find(
    (employee) => employee.id === form.employeeId
  );

  const selectedEmployeeNumber =
    selectedEmployee?.employeeNumber?.trim();

  const range = getDateRange(form.dateFrom, form.dateTo);

  if (!form.dateFrom || !form.dateTo) {
    return [];
  }

  if (range.length === 0) {
    return [
      {
        key: 'invalid-range',
        apiDate: '',
        displayDate: '--',
        dayName: '--',
        otHours: 0,
        status: 'invalid-range',
        message: 'Invalid date range',
      },
    ];
  }

  if (!selectedEmployeeNumber) {
    return range.map((date) => ({
      key: toApiDate(date),
      apiDate: toApiDate(date),
      displayDate: toDisplayDate(date),
      dayName: getDayName(date),
      otHours: 0,
      status: 'invalid-range',
      message: 'Select employee first',
    }));
  }

  return range.map((date) => {
    const apiDate = toApiDate(date);
    const requestedMinutes = Number(form.requestedMinutes || 0);
    const requestedOtMinutes =
      Number.isFinite(requestedMinutes) && requestedMinutes > 0
        ? requestedMinutes
        : 0;

    const attendance = attendanceRecords.find(
      (record) =>
        record.employeeNumber === selectedEmployeeNumber &&
        record.date === apiDate
    );

    const shiftDay = getShiftDayForDate(selectedEmployee, date);

    if (
      selectedEmployee?.hasAssignedShift === false ||
      selectedEmployee?.isShiftActive === false ||
      attendance?.hasAssignedShift === false ||
      attendance?.isShiftActive === false
    ) {
      return {
        key: apiDate,
        apiDate,
        displayDate: toDisplayDate(date),
        dayName: getDayName(date),
        otHours: 0,
        status: 'blocked',
        message: 'No active shift assigned',
      };
    }

    if (isBeforeEffectiveDate(selectedEmployee, apiDate)) {
      return {
        key: apiDate,
        apiDate,
        displayDate: toDisplayDate(date),
        dayName: getDayName(date),
        otHours: 0,
        status: 'blocked',
        message: 'Before shift effective date',
      };
    }

    if (shiftDay && !shiftDay.isWorkingDay) {
      return {
        key: apiDate,
        apiDate,
        displayDate: toDisplayDate(date),
        dayName: getDayName(date),
        otHours: 0,
        status: 'blocked',
        message: 'Not a scheduled working day',
      };
    }

    if (attendance?.isWorkingDay === false) {
      return {
        key: apiDate,
        apiDate,
        displayDate: toDisplayDate(date),
        dayName: getDayName(date),
        otHours: 0,
        status: 'blocked',
        message: 'Not a scheduled working day',
      };
    }

    if (attendance?.hasExistingOvertime) {
      return {
        key: apiDate,
        apiDate,
        displayDate: toDisplayDate(date),
        dayName: getDayName(date),
        otHours: 0,
        status: 'blocked',
        message: 'Overtime already exists',
      };
    }

    if (!attendance) {
      return {
        key: apiDate,
        apiDate,
        displayDate: toDisplayDate(date),
        dayName: getDayName(date),
        otHours: requestedOtMinutes,
        status: 'needs-dtr',
        message: 'Waiting for attendance record',
      };
    }

    if (!attendance.timeOut || attendance.timeOut === '--') {
      return {
        key: apiDate,
        apiDate,
        displayDate: toDisplayDate(date),
        dayName: getDayName(date),
        otHours: requestedOtMinutes,
        status: 'needs-dtr',
        message: 'Waiting for time out',
      };
    }

    const timeOutMinutes = parseTimeToMinutes(
      attendance.timeOut
    );

    if (timeOutMinutes === null) {
      return {
        key: apiDate,
        apiDate,
        displayDate: toDisplayDate(date),
        dayName: getDayName(date),
        otHours: requestedOtMinutes,
        status: 'needs-dtr',
        message: 'Waiting for valid time out',
      };
    }

    const availableMinutes = Math.max(
      0,
      Math.min(
        MAX_ADMIN_OT_MINUTES_PER_DAY,
        OT_CUTOFF_MINUTES - timeOutMinutes
      )
    );

    if (availableMinutes <= 0) {
      return {
        key: apiDate,
        apiDate,
        displayDate: toDisplayDate(date),
        dayName: getDayName(date),
        otHours: 0,
        status: 'blocked',
        message: 'No OT capacity available',
      };
    }

    return {
      key: apiDate,
      apiDate,
      displayDate: toDisplayDate(date),
      dayName: getDayName(date),
      otHours: Math.min(
        requestedOtMinutes,
        availableMinutes
      ),
      status: 'assignable',
      message: 'Ready to assign',
    };
  });
};

export const formatErrorMessage = (
  message?: string | null
) => {
  if (!message) {
    return null;
  }

  const normalizedMessage = message.trim();

  if (
    /overtime already (assigned|requested|exists)/i.test(
      normalizedMessage
    )
  ) {
    return 'Overtime already exists for the selected date.';
  }

  return normalizedMessage;
};
