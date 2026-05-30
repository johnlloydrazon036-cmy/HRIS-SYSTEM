import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  type AttendanceLogDto,
  type OvertimeRequestDto,
  type Shift,
  formatAttendanceTime,
  formatMinutesToHours,
  getMyAttendanceLogs,
  getMyOvertimeRequests,
  getMyCurrentShift,
  getTodayMyAttendanceLog,
  submitOvertimeRequest as submitOTApi,
  timeIn as timeInApi,
  timeOut as timeOutApi,
  toApiDateString,
  toApiTimeString,
  updateAttendanceRemarks,
} from "../../../lib/attendance";

import AttendanceTabs from "../../../components/attendance/AttendanceTabs";
import useLiveTracker from "../../../hooks/useLiveTracker";
import type { AttendanceTab, StatusBadgeMap } from "../../../types/attendance";

import EditAttendanceModal from "../../../components/attendance/user/EditAttendanceModal";
import ViewAttendanceModal from "../../../components/attendance/user/ViewAttendanceModal";
import UserDtrTab from "../../../components/attendance/user/UserDtrTab";
import UserOtTab from "../../../components/attendance/user/UserOtTab";
import OvertimeRequestModal from "../../../components/attendance/user/OvertimeRequestModal";
import UserAttendanceSummaryCards from "../../../components/attendance/user/UserAttendanceSummaryCards";
import TimeRecordModal from "../../../components/attendance/user/TimeRecordModal";
import UserShiftScheduleCard from "../../../components/attendance/user/UserShiftScheduleCard";

const DEBUG_SIMULATED_NOW: string | null = null;

type AttendanceRow = {
  id: number;
  date: string;
  timeIn: string;
  timeOut: string;
  status: string;
  isOT: boolean;
  isUndertime: boolean;
  overtimeStatus?: "None" | "Pending" | "Approved";
  hours: string;
  renderedMinutes: number;
  creditedMinutes?: number;
  excessMinutes?: number;
  hasExceededApprovedOvertime?: boolean;
  lateMinutes: number;
  undertimeMinutes: number;
  overtimeMinutes: number;
  task: string;
  accomplished: string;
};

type MyOvertimeRow = {
  id: number;
  date: string;
  duration: string;
  reason: string;
  status: string;
};

type SubmitOvertimePayload = {
  dateFrom: string;
  dateTo: string;
  requestedMinutes: number;
  reason: string;
};

type AttendanceFormState = {
  timeIn: string;
  timeOut: string;
  overtime: string;
};

type TodayShiftTimes = {
  shiftName: string | null;
  shiftStartTime: string | null;
  timeInOpenTime: string | null;
  breakStartTime: string | null;
  breakEndTime: string | null;
  shiftEndTime: string | null;
  lateGraceMinutes: number | null;
};

const DEFAULT_TIME_IN_OPEN_MINUTES = 8 * 60 + 20;
const DEFAULT_SHIFT_END_MINUTES = 17 * 60 + 30;
const DEFAULT_STOP_MINUTES = 21 * 60;
const OVERTIME_STOP_BUFFER_MINUTES = 210;

const getErrorMessage = (error: unknown, fallback: string) => {
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : typeof error === "object" &&
            error !== null &&
            "message" in error &&
            typeof (error as { message?: unknown }).message === "string"
          ? (error as { message: string }).message
          : "";

  if (!rawMessage) return fallback;

  try {
    const parsed = JSON.parse(rawMessage) as
      | {
          message?: string;
          title?: string;
          detail?: string;
          errors?: Record<string, string[]>;
        }
      | Array<{
          message?: string;
          title?: string;
          detail?: string;
        }>;

    if (Array.isArray(parsed)) {
      return (
        parsed[0]?.message || parsed[0]?.detail || parsed[0]?.title || fallback
      );
    }

    if (parsed.message) return parsed.message;
    if (parsed.detail) return parsed.detail;
    if (parsed.title) return parsed.title;

    const firstError = parsed.errors
      ? Object.values(parsed.errors)[0]?.[0]
      : null;
    if (firstError) return firstError;
  } catch {
    // continue below
  }

  if (rawMessage.length > 180 || rawMessage.includes('"passwordHash"')) {
    return fallback;
  }

  return rawMessage;
};

const normalizeOvertimeStatus = (
  value?: string | null,
): "None" | "Pending" | "Approved" => {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "approved") return "Approved";
  if (normalized === "pending") return "Pending";

  return "None";
};

const normalizeDateKey = (value?: string | null) => {
  if (!value || value === "-" || value === "--" || value === "—") return "";

  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatDisplayDate = (value?: string | null) => {
  const normalized = normalizeDateKey(value);
  if (!normalized) return "--";

  const parsed = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value || "--";

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
};

const isActualAttendanceTime = (value?: string | null) => {
  if (!value) return false;

  const normalized = value.trim();

  return (
    normalized !== "" &&
    normalized !== "-" &&
    normalized !== "--" &&
    normalized !== "—" &&
    normalized !== "--:-- --"
  );
};

const formatOvertimeDuration = (request: OvertimeRequestDto) => {
  const perDayMinutes = Number(
    request.requestedMinutesPerDay ?? request.requestedMinutes ?? 0,
  );

  if (!Number.isFinite(perDayMinutes) || perDayMinutes <= 0) return "--";

  const hours = perDayMinutes / 60;

  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
};

const getOvertimeRequestDateRange = (request: OvertimeRequestDto) => {
  const dateFrom = normalizeDateKey(
    request.dateFrom || request.attendanceDate || "",
  );
  const dateTo = normalizeDateKey(
    request.dateTo || request.dateFrom || request.attendanceDate || "",
  );

  if (!dateFrom && !dateTo) return [];
  if (!dateFrom) return [dateTo];
  if (!dateTo) return [dateFrom];

  const start = new Date(`${dateFrom}T00:00:00`);
  const end = new Date(`${dateTo}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return [dateFrom];
  }

  if (start > end) return [dateFrom];

  const dates: string[] = [];
  const cursor = new Date(end);

  while (cursor >= start) {
    const year = cursor.getFullYear();
    const month = String(cursor.getMonth() + 1).padStart(2, "0");
    const day = String(cursor.getDate()).padStart(2, "0");

    dates.push(`${year}-${month}-${day}`);
    cursor.setDate(cursor.getDate() - 1);
  }

  return dates;
};

const expandOvertimeRequestRows = (
  request: OvertimeRequestDto,
): MyOvertimeRow[] => {
  const dates = getOvertimeRequestDateRange(request);
  const duration = formatOvertimeDuration(request);
  const reason = request.reason || "—";
  const status = request.status || "Pending";

  if (dates.length === 0) {
    return [
      {
        id: request.id,
        date: "--",
        duration,
        reason,
        status,
      },
    ];
  }

  return dates.map((date, index) => ({
    id: request.id * 1000 + index,
    date: formatDisplayDate(date),
    duration,
    reason,
    status,
  }));
};

const getSimulatedNow = () => {
  if (!DEBUG_SIMULATED_NOW) return null;

  const parsed = new Date(DEBUG_SIMULATED_NOW);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getMinutesFromDate = (date: Date) =>
  date.getHours() * 60 + date.getMinutes();

const getMinutesFromTimeString = (value?: string | null) => {
  const timeValue = toApiTimeString(value);

  if (!timeValue) return null;

  const [hourRaw, minuteRaw] = timeValue.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);

  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return hour * 60 + minute;
};

const getClockPartsFromMinutes = (minutes: number) => {
  const normalized = ((minutes % 1440) + 1440) % 1440;

  return {
    hour: Math.floor(normalized / 60),
    minute: normalized % 60,
  };
};

const isWithinTimeRange = (
  currentMinutes: number,
  startMinutes: number,
  endMinutes: number,
) => {
  if (startMinutes === endMinutes) return false;

  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
};

const isBeforeOpeningWindow = (
  currentMinutes: number,
  openMinutes: number,
  shiftEndMinutes: number,
) => {
  if (openMinutes <= shiftEndMinutes) {
    return currentMinutes < openMinutes;
  }

  return currentMinutes < openMinutes && currentMinutes >= shiftEndMinutes;
};

const isAfterShiftEndWindow = (
  currentMinutes: number,
  shiftStartMinutes: number | null,
  shiftEndMinutes: number,
) => {
  if (shiftStartMinutes === null || shiftStartMinutes <= shiftEndMinutes) {
    return currentMinutes >= shiftEndMinutes;
  }

  return (
    currentMinutes >= shiftEndMinutes && currentMinutes < shiftStartMinutes
  );
};

const buildTrackerConfig = (times: TodayShiftTimes | null) => {
  const openMinutes =
    getMinutesFromTimeString(times?.timeInOpenTime) ??
    DEFAULT_TIME_IN_OPEN_MINUTES;

  const shiftEndMinutes =
    getMinutesFromTimeString(times?.shiftEndTime) ?? DEFAULT_SHIFT_END_MINUTES;

  const stopMinutes = times?.shiftEndTime
    ? shiftEndMinutes + OVERTIME_STOP_BUFFER_MINUTES
    : DEFAULT_STOP_MINUTES;

  const open = getClockPartsFromMinutes(openMinutes);
  const shiftEnd = getClockPartsFromMinutes(shiftEndMinutes);
  const stop = getClockPartsFromMinutes(stopMinutes);

  return {
    startAtHour: open.hour,
    startAtMinute: open.minute,
    stopAtHour: stop.hour,
    stopAtMinute: stop.minute,
    overtimeStartHour: shiftEnd.hour,
    overtimeStartMinute: shiftEnd.minute,
  };
};

const buildLiveFlags = (date: Date, times: TodayShiftTimes | null) => {
  const currentMinutes = getMinutesFromDate(date);
  const openMinutes = getMinutesFromTimeString(times?.timeInOpenTime);
  const shiftStartMinutes = getMinutesFromTimeString(times?.shiftStartTime);
  const shiftEndMinutes = getMinutesFromTimeString(times?.shiftEndTime);
  const breakStartMinutes = getMinutesFromTimeString(times?.breakStartTime);
  const breakEndMinutes = getMinutesFromTimeString(times?.breakEndTime);

  return {
    isBeforeStart:
      openMinutes !== null && shiftEndMinutes !== null
        ? isBeforeOpeningWindow(currentMinutes, openMinutes, shiftEndMinutes)
        : currentMinutes < DEFAULT_TIME_IN_OPEN_MINUTES,
    isBreakTime:
      breakStartMinutes !== null && breakEndMinutes !== null
        ? isWithinTimeRange(currentMinutes, breakStartMinutes, breakEndMinutes)
        : false,
    isAfterRegularHours:
      shiftEndMinutes !== null
        ? isAfterShiftEndWindow(
            currentMinutes,
            shiftStartMinutes,
            shiftEndMinutes,
          )
        : currentMinutes >= DEFAULT_SHIFT_END_MINUTES,
    isAfterShiftCutoff: (() => {
      const stopMinutes = times?.shiftEndTime
        ? shiftEndMinutes !== null
          ? (shiftEndMinutes + OVERTIME_STOP_BUFFER_MINUTES) % 1440
          : DEFAULT_STOP_MINUTES
        : DEFAULT_STOP_MINUTES;

      return currentMinutes >= stopMinutes;
    })(),
  };
};

type CurrentShift = Shift;

const getNoActiveShiftState = (): TodayShiftTimes | null => null;

const isNoActiveShiftMessage = (message: string) =>
  message.toLowerCase().includes("no active shift") ||
  message.toLowerCase().includes("no assigned shift");

const getTodayShiftTimesFromCurrentShift = (
  shift: CurrentShift | null,
): TodayShiftTimes | null => {
  if (!shift) return null;

  const todayDayOfWeek = new Date().getDay();
  const todayShiftDay = shift.days?.find(
    (day) => Number(day.dayOfWeek) === todayDayOfWeek,
  );

  return {
    shiftName: shift.name?.trim() || null,
    shiftStartTime: todayShiftDay?.startTime ?? null,
    timeInOpenTime: todayShiftDay?.startTime ?? null,
    breakStartTime: todayShiftDay?.breakStartTime ?? null,
    breakEndTime: todayShiftDay?.breakEndTime ?? null,
    shiftEndTime: todayShiftDay?.endTime ?? null,
    lateGraceMinutes: shift.lateGraceMinutes ?? null,
  };
};

const UserAttendance = () => {
  const [activeTab, setActiveTab] = useState<AttendanceTab>("dtr");

  const [todayShiftTimes, setTodayShiftTimes] =
    useState<TodayShiftTimes | null>(null);
  const [currentShift, setCurrentShift] = useState<CurrentShift | null>(null);

  const trackerConfig = useMemo(
    () => buildTrackerConfig(todayShiftTimes),
    [todayShiftTimes],
  );

  const {
    currentTime,
    frozenTimeOut,
    displayTime,
    isBeforeStart,
    isBreakTime,
    isAfterRegularHours,
  } = useLiveTracker(trackerConfig);

  const simulatedNow = useMemo(() => getSimulatedNow(), []);

  const dynamicLiveFlags = useMemo(() => {
    return buildLiveFlags(currentTime, todayShiftTimes);
  }, [currentTime, todayShiftTimes]);

  const simulatedFlags = useMemo(() => {
    if (!simulatedNow) return null;
    return buildLiveFlags(simulatedNow, todayShiftTimes);
  }, [simulatedNow, todayShiftTimes]);

  const effectiveCurrentTime = simulatedNow ?? currentTime;
  const effectiveIsBeforeStart =
    simulatedFlags?.isBeforeStart ??
    dynamicLiveFlags.isBeforeStart ??
    isBeforeStart;
  const effectiveIsBreakTime =
    simulatedFlags?.isBreakTime ?? dynamicLiveFlags.isBreakTime ?? isBreakTime;
  const effectiveIsAfterRegularHours =
    simulatedFlags?.isAfterRegularHours ??
    dynamicLiveFlags.isAfterRegularHours ??
    isAfterRegularHours;

  const [punchedIn, setPunchedIn] = useState(false);
  const [punchedOut, setPunchedOut] = useState(false);
  const [isWorkingDay, setIsWorkingDay] = useState(true);
  const [canTimeInToday, setCanTimeInToday] = useState(true);
  const [todayBlockReason, setTodayBlockReason] = useState<string | null>(null);
  const [isHoliday, setIsHoliday] = useState(false);
  const [holidayName, setHolidayName] = useState<string | null>(null);
  const [todayOvertimeStatus, setTodayOvertimeStatus] = useState<
    "None" | "Pending" | "Approved"
  >("None");

  const [isTimeInModalOpen, setIsTimeInModalOpen] = useState(false);
  const [isTimeOutModalOpen, setIsTimeOutModalOpen] = useState(false);
  const [isOvertimeModalOpen, setIsOvertimeModalOpen] = useState(false);

  const [taskPlan, setTaskPlan] = useState("");
  const [taskAccomplished, setTaskAccomplished] = useState("");
  const [submittingOt, setSubmittingOt] = useState(false);
  const [otError, setOtError] = useState<string | null>(null);

  const [attendanceForm, setAttendanceForm] = useState<AttendanceFormState>({
    timeIn: "",
    timeOut: "",
    overtime: "0",
  });

  const [myOvertime, setMyOvertime] = useState<MyOvertimeRow[]>([]);
  const [loadingOt, setLoadingOt] = useState(false);

  const [myAttendance, setMyAttendance] = useState<AttendanceRow[]>([]);
  const [summaryAttendance, setSummaryAttendance] = useState<AttendanceRow[]>([]);
  const [loadingDtr, setLoadingDtr] = useState(false);
  const [submittingDtr, setSubmittingDtr] = useState(false);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const PAGE_SIZE = 10;

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedViewRecord, setSelectedViewRecord] =
    useState<AttendanceRow | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedEditRecord, setSelectedEditRecord] =
    useState<AttendanceRow | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [recentlyEditedRowId, setRecentlyEditedRowId] = useState<number | null>(
    null,
  );

  const statusBadge: StatusBadgeMap = {
    Present: "badge-success",
    Late: "badge-warning",
    Absent: "badge-danger",
    Incomplete: "badge-neutral",
    OnLeave: "badge-primary",
  };

  const simulatedBlockReason = useMemo(() => {
    if (!simulatedNow) return null;

    if (isHoliday) {
      return holidayName
        ? `${holidayName}. Work is not required today.`
        : "Holiday. Work is not required today.";
    }

    if (!isWorkingDay) {
      return "Today is not part of your scheduled working days. Time in is unavailable.";
    }

    if (simulatedFlags?.isBeforeStart) {
      const openTime = formatAttendanceTime(todayShiftTimes?.timeInOpenTime);
      return `Time in is not available yet. It will open at ${openTime === "-" ? "your scheduled time" : openTime}.`;
    }

    if (simulatedFlags?.isBreakTime) {
      return "You cannot time in during break time.";
    }

    if (simulatedFlags?.isAfterShiftCutoff) {
      return "You cannot time in after shift cutoff.";
    }

    return null;
  }, [
    holidayName,
    isHoliday,
    isWorkingDay,
    simulatedFlags,
    simulatedNow,
    todayShiftTimes,
  ]);

  const effectiveCanTimeInToday = simulatedNow
    ? !simulatedBlockReason
    : canTimeInToday;
  const effectiveTodayBlockReason = simulatedNow
    ? simulatedBlockReason
    : todayBlockReason;

  const trackerTone = useMemo<"blue" | "green">(() => {
    if (punchedIn && !punchedOut && effectiveIsAfterRegularHours) {
      return "blue";
    }

    return "green";
  }, [punchedIn, punchedOut, effectiveIsAfterRegularHours]);

  const mapAttendanceRows = useCallback(
    (items: AttendanceLogDto[]): AttendanceRow[] =>
      items.map((log) => {
        const hasTimeIn = !!log.timeIn;
        const hasTimeOut = !!log.timeOut;

        const lateMinutes = Number(log.lateMinutes ?? 0);
        const undertimeMinutes = Number(log.undertimeMinutes ?? 0);
        const overtimeMinutes = Number(log.overtimeMinutes ?? 0);
        const renderedMinutes = Number(log.renderedMinutes ?? 0);
        const creditedMinutes = Number(log.creditedMinutes ?? renderedMinutes);
        const excessMinutes = Number(log.excessMinutes ?? 0);
        const hasExceededApprovedOvertime = Boolean(log.hasExceededApprovedOvertime);
        const overtimeStatus = normalizeOvertimeStatus(log.overtimeStatus);

        let status = "Present";

        if (!hasTimeIn && !hasTimeOut) {
          status = "Absent";
        } else if (lateMinutes > 0) {
          status = "Late";
        } else if (hasTimeIn && !hasTimeOut) {
          status = "Incomplete";
        }

        return {
          id: log.id,
          date: log.date || "—",
          timeIn: formatAttendanceTime(log.timeIn),
          timeOut: formatAttendanceTime(log.timeOut),
          status,
          isOT: overtimeStatus === "Approved",
          isUndertime: undertimeMinutes > 0,
          overtimeStatus,
          hours: formatMinutesToHours(renderedMinutes),
          renderedMinutes,
          creditedMinutes,
          excessMinutes,
          hasExceededApprovedOvertime,
          lateMinutes,
          undertimeMinutes,
          overtimeMinutes,
          task: (log.task ?? "").trim(),
          accomplished: (log.accomplished ?? "").trim(),
        };
      }),
    [],
  );

  const applyNoActiveShiftState = useCallback(() => {
    setAttendanceForm({
      timeIn: "",
      timeOut: "",
      overtime: "0",
    });

    setPunchedIn(false);
    setPunchedOut(false);
    setIsWorkingDay(false);
    setCanTimeInToday(false);
    setTodayBlockReason("No assigned shift. Please contact HR/Admin.");
    setIsHoliday(false);
    setHolidayName(null);
    setTodayOvertimeStatus("None");
    setCurrentShift(null);
    setTodayShiftTimes(getNoActiveShiftState());
  }, []);

  const loadTodayLog = useCallback(async () => {
    let fallbackShiftTimes: TodayShiftTimes | null = null;

    try {
      const currentShift = await getMyCurrentShift();

      if (!currentShift) {
        applyNoActiveShiftState();
        return;
      }

      setCurrentShift(currentShift);
      fallbackShiftTimes = getTodayShiftTimesFromCurrentShift(currentShift);
    } catch (error: unknown) {
      const message = getErrorMessage(error, "No active shift.");

      if (isNoActiveShiftMessage(message)) {
        applyNoActiveShiftState();
        return;
      }

      console.error(error);
      toast.error(getErrorMessage(error, "Failed to load assigned shift."));
      applyNoActiveShiftState();
      return;
    }

    try {
      const today = await getTodayMyAttendanceLog();

      if (!today) {
        setAttendanceForm({
          timeIn: "",
          timeOut: "",
          overtime: "0",
        });

        setPunchedIn(false);
        setPunchedOut(false);
        setIsWorkingDay(
          !!fallbackShiftTimes?.shiftStartTime &&
            !!fallbackShiftTimes?.shiftEndTime,
        );
        setCanTimeInToday(
          !!fallbackShiftTimes?.shiftStartTime &&
            !!fallbackShiftTimes?.shiftEndTime,
        );
        setTodayBlockReason(null);
        setIsHoliday(false);
        setHolidayName(null);
        setTodayOvertimeStatus("None");
        setTodayShiftTimes(fallbackShiftTimes);
        return;
      }

      const mappedTimeIn = formatAttendanceTime(today.timeIn);
      const mappedTimeOut = formatAttendanceTime(today.timeOut);

      setAttendanceForm({
        timeIn: today.timeIn ? mappedTimeIn : "",
        timeOut: today.timeOut ? mappedTimeOut : "",
        overtime: today.overtimeMinutes
          ? formatMinutesToHours(today.overtimeMinutes)
          : "0",
      });

      setPunchedIn(!!today.timeIn);
      setPunchedOut(!!today.timeOut);
      setIsWorkingDay(
        today.isWorkingDay ?? !!fallbackShiftTimes?.shiftStartTime,
      );
      setCanTimeInToday(today.canTimeIn ?? true);
      setTodayBlockReason(today.blockReason ?? null);
      setIsHoliday(today.isHoliday ?? false);
      setHolidayName(today.holidayName ?? null);
      setTodayOvertimeStatus(normalizeOvertimeStatus(today.overtimeStatus));
      setTodayShiftTimes({
        shiftName:
          today.shiftName?.trim() || fallbackShiftTimes?.shiftName || null,
        shiftStartTime:
          today.shiftStartTime ?? fallbackShiftTimes?.shiftStartTime ?? null,
        timeInOpenTime:
          today.timeInOpenTime ?? fallbackShiftTimes?.timeInOpenTime ?? null,
        breakStartTime:
          today.breakStartTime ?? fallbackShiftTimes?.breakStartTime ?? null,
        breakEndTime:
          today.breakEndTime ?? fallbackShiftTimes?.breakEndTime ?? null,
        shiftEndTime:
          today.shiftEndTime ?? fallbackShiftTimes?.shiftEndTime ?? null,
        lateGraceMinutes:
          today.lateGraceMinutes ??
          fallbackShiftTimes?.lateGraceMinutes ??
          null,
      });
    } catch (err) {
      const message = getErrorMessage(
        err,
        "Failed to load today attendance state.",
      );

      if (isNoActiveShiftMessage(message)) {
        applyNoActiveShiftState();
        return;
      }

      console.error(err);
      toast.error(message);
    }
  }, [applyNoActiveShiftState]);

  const loadAttendanceLogs = useCallback(async () => {
    const pagedResponse = await getMyAttendanceLogs({
      page,
      pageSize: PAGE_SIZE,
    });

    const summaryResponse = await getMyAttendanceLogs({
      page: 1,
      pageSize: 1000,
    });

    setMyAttendance(mapAttendanceRows(pagedResponse.items || []));
    setSummaryAttendance(mapAttendanceRows(summaryResponse.items || []));
    setTotalPages(
      Math.max(1, Math.ceil((pagedResponse.totalCount || 0) / PAGE_SIZE)),
    );
  }, [mapAttendanceRows, page]);

  const refreshDtrState = useCallback(async () => {
    await Promise.all([loadTodayLog(), loadAttendanceLogs()]);
  }, [loadTodayLog, loadAttendanceLogs]);

  const loadDtrData = useCallback(async () => {
    try {
      setLoadingDtr(true);
      await refreshDtrState();
    } catch (error: unknown) {
      console.error(error);
      toast.error(getErrorMessage(error, "Failed to load attendance logs."));
    } finally {
      setLoadingDtr(false);
    }
  }, [refreshDtrState]);

  const fetchMyOt = useCallback(async () => {
    try {
      setLoadingOt(true);

      const res = await getMyOvertimeRequests();

      const mapped: MyOvertimeRow[] = (res.items || []).flatMap(
        (o: OvertimeRequestDto) => expandOvertimeRequestRows(o),
      );

      setMyOvertime(mapped);
    } catch (error: unknown) {
      console.error(error);
      toast.error(getErrorMessage(error, "Failed to load overtime requests."));
    } finally {
      setLoadingOt(false);
    }
  }, []);

  useEffect(() => {
    void loadDtrData();
  }, [loadDtrData]);

  useEffect(() => {
    void fetchMyOt();
  }, [fetchMyOt]);

  const handleOpenTimeInModal = useCallback(
    (value: boolean) => {
      if (!value) {
        setIsTimeInModalOpen(false);
        return;
      }

      if (punchedIn && !punchedOut) {
        toast.warning("You are already timed in.");
        void refreshDtrState();
        return;
      }

      if (!effectiveCanTimeInToday) {
        if (effectiveTodayBlockReason) {
          toast.warning(effectiveTodayBlockReason);
        }
        return;
      }

      setIsTimeInModalOpen(true);
    },
    [
      punchedIn,
      punchedOut,
      effectiveCanTimeInToday,
      effectiveTodayBlockReason,
      refreshDtrState,
    ],
  );

  const handleOpenTimeOutModal = useCallback(
    (value: boolean) => {
      if (!value) {
        setIsTimeOutModalOpen(false);
        return;
      }

      if (!punchedIn) {
        toast.warning("You need to time in first.");
        void refreshDtrState();
        return;
      }

      if (punchedOut) {
        toast.warning("You are already timed out.");
        void refreshDtrState();
        return;
      }

      setIsTimeOutModalOpen(true);
    },
    [punchedIn, punchedOut, refreshDtrState],
  );

  const confirmTimeIn = async () => {
    if (simulatedNow) {
      toast.info(
        "Simulation mode is active. Set DEBUG_SIMULATED_NOW back to null before saving real time-in.",
      );
      return;
    }

    try {
      setSubmittingDtr(true);

      const res = await timeInApi({
        task: taskPlan.trim() || undefined,
      });

      setAttendanceForm((prev) => ({
        ...prev,
        timeIn: formatAttendanceTime(res.timeIn),
      }));

      setPunchedIn(true);
      setPunchedOut(false);
      setTodayOvertimeStatus(normalizeOvertimeStatus(res.overtimeStatus));
      setTaskPlan("");
      setIsTimeInModalOpen(false);

      await refreshDtrState();

      toast.success("Time in recorded successfully.");
    } catch (error: unknown) {
      console.error(error);

      const message = getErrorMessage(error, "Failed to record time in.");

      if (message.toLowerCase().includes("already timed in")) {
        setIsTimeInModalOpen(false);
        setTaskPlan("");

        await refreshDtrState();

        toast.warning("Already timed in. Attendance state refreshed.");
        return;
      }

      toast.error(message);
    } finally {
      setSubmittingDtr(false);
    }
  };

  const confirmTimeOut = async () => {
    if (simulatedNow) {
      toast.info(
        "Simulation mode is active. Set DEBUG_SIMULATED_NOW back to null before saving real time-out.",
      );
      return;
    }

    try {
      setSubmittingDtr(true);

      const res = await timeOutApi({
        accomplished: taskAccomplished.trim() || undefined,
      });

      setAttendanceForm((prev) => ({
        ...prev,
        timeOut: formatAttendanceTime(res.timeOut),
        overtime: res.overtimeMinutes
          ? formatMinutesToHours(res.overtimeMinutes)
          : "0",
      }));

      setPunchedIn(!!res.timeIn);
      setPunchedOut(!!res.timeOut);
      setTodayOvertimeStatus(normalizeOvertimeStatus(res.overtimeStatus));
      setTaskPlan("");
      setTaskAccomplished("");
      setIsTimeOutModalOpen(false);

      await refreshDtrState();

      toast.success("Time out recorded successfully.");
    } catch (error: unknown) {
      console.error(error);

      const message = getErrorMessage(error, "Failed to record time out.");

      if (message.toLowerCase().includes("already timed out")) {
        setIsTimeOutModalOpen(false);
        setTaskAccomplished("");

        await refreshDtrState();

        toast.warning("Already timed out. Attendance state refreshed.");
        return;
      }

      toast.error(message);
    } finally {
      setSubmittingDtr(false);
    }
  };

  const handleSubmitOvertime = async (payload: SubmitOvertimePayload) => {
    setOtError(null);

    if (
      !payload.dateFrom ||
      !payload.dateTo ||
      !payload.requestedMinutes ||
      !payload.reason.trim()
    ) {
      setOtError("Please complete all overtime request details.");
      return;
    }

    try {
      setSubmittingOt(true);

      await submitOTApi({
        dateFrom: payload.dateFrom,
        dateTo: payload.dateTo,
        requestedMinutes: Math.round(payload.requestedMinutes),
        reason: payload.reason.trim(),
      });

      setIsOvertimeModalOpen(false);
      setOtError(null);

      await fetchMyOt();
      toast.success("Overtime request submitted successfully.");
    } catch (error: unknown) {
      console.error(error);
      setOtError(getErrorMessage(error, "Failed to submit overtime request."));
    } finally {
      setSubmittingOt(false);
    }
  };

  const handlePrevPage = useCallback(() => {
    setPage((prev) => Math.max(1, prev - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setPage((prev) => Math.min(totalPages, prev + 1));
  }, [totalPages]);

  const handleUserRowView = useCallback((row: AttendanceRow) => {
    setSelectedViewRecord(row);
    setIsViewModalOpen(true);
  }, []);

  const handleUserRowEdit = useCallback((row: AttendanceRow) => {
    setSelectedEditRecord(row);
    setIsEditModalOpen(true);
  }, []);

  const handleEditChange = useCallback((updated: AttendanceRow) => {
    setSelectedEditRecord(updated);
  }, []);

  const handleEditSave = useCallback(async () => {
    if (!selectedEditRecord) return;

    try {
      setSavingEdit(true);

      await updateAttendanceRemarks({
        id: selectedEditRecord.id,
        date: toApiDateString(selectedEditRecord.date),
        timeIn:
          selectedEditRecord.timeIn === "-"
            ? null
            : toApiTimeString(selectedEditRecord.timeIn),
        timeOut:
          selectedEditRecord.timeOut === "-"
            ? null
            : toApiTimeString(selectedEditRecord.timeOut),
        status: selectedEditRecord.status,
        task: selectedEditRecord.task || "",
        accomplished: selectedEditRecord.accomplished || "",
        isOT: selectedEditRecord.isOT ?? false,
      });

      const editedRowId = selectedEditRecord.id;

      setIsEditModalOpen(false);
      setSelectedEditRecord(null);

      await loadAttendanceLogs();

      setRecentlyEditedRowId(editedRowId);
      toast.success("Attendance record updated successfully.");

      window.setTimeout(() => {
        setRecentlyEditedRowId((current) =>
          current === editedRowId ? null : current,
        );
      }, 3000);
    } catch (error: unknown) {
      console.error(error);
      toast.error(
        getErrorMessage(error, "Failed to update attendance details."),
      );
    } finally {
      setSavingEdit(false);
    }
  }, [selectedEditRecord, loadAttendanceLogs]);

  const effectiveTrackerTime = useMemo(() => {
    if (simulatedNow) {
      return simulatedNow;
    }

    if (attendanceForm.timeOut) {
      const actualTimeOut = toApiTimeString(attendanceForm.timeOut);

      if (actualTimeOut) {
        const parsed = new Date(`2000-01-01T${actualTimeOut}`);
        if (!Number.isNaN(parsed.getTime())) {
          return parsed;
        }
      }
    }

    if (frozenTimeOut) {
      return frozenTimeOut;
    }

    return displayTime;
  }, [attendanceForm.timeOut, frozenTimeOut, displayTime, simulatedNow]);

  const stats = useMemo(() => {
    const recordsForCards = summaryAttendance;

    const present = recordsForCards.filter((log) =>
      isActualAttendanceTime(log.timeIn),
    ).length;
    const late = recordsForCards.filter(
      (log) => Number(log.lateMinutes || 0) > 0,
    ).length;
    const absent = recordsForCards.filter(
      (log) => log.status === "Absent",
    ).length;
    const totalMinutes = recordsForCards.reduce(
      (sum, log) => sum + Number(log.renderedMinutes || 0),
      0,
    );

    return {
      present,
      late,
      absent,
      totalMinutes,
    };
  }, [summaryAttendance]);

  return (
    <div className="space-y-6">
      <div className="page-header animate-fade-in-up">
        <h1>Time & Attendance</h1>
        <p>Record your daily time in and time out with real-time tracking</p>
      </div>

      <UserAttendanceSummaryCards stats={stats} />

      <div
        className="pro-card animate-fade-in-up"
        style={{ animationDelay: "0.2s", opacity: 0 }}
      >
        <div className="px-6 pt-4">
          <AttendanceTabs
            activeTab={activeTab}
            onChange={setActiveTab as (tab: "dtr" | "ot" | "setup") => void}
          />
        </div>

        <div className="p-6">
          {activeTab === "dtr" && (
            <>
              <UserShiftScheduleCard
                shiftName={todayShiftTimes?.shiftName ?? null}
                shiftStartTime={todayShiftTimes?.shiftStartTime ?? null}
                shiftEndTime={todayShiftTimes?.shiftEndTime ?? null}
                breakStartTime={todayShiftTimes?.breakStartTime ?? null}
                breakEndTime={todayShiftTimes?.breakEndTime ?? null}
                lateGraceMinutes={todayShiftTimes?.lateGraceMinutes ?? null}
                isWorkingDay={isWorkingDay}
                isHoliday={isHoliday}
                holidayName={holidayName}
                shift={currentShift}
              />

              <UserDtrTab
                frozenTimeOut={frozenTimeOut}
                displayTime={effectiveTrackerTime}
                punchedIn={punchedIn}
                punchedOut={punchedOut}
                submittingDtr={submittingDtr}
                loadingDtr={loadingDtr}
                setIsTimeInModalOpen={handleOpenTimeInModal}
                setIsTimeOutModalOpen={handleOpenTimeOutModal}
                attendanceForm={attendanceForm}
                myAttendance={myAttendance}
                statusBadge={statusBadge}
                page={page}
                totalPages={totalPages}
                onPrev={handlePrevPage}
                onNext={handleNextPage}
                onView={handleUserRowView}
                onEdit={handleUserRowEdit}
                recentlyEditedRowId={recentlyEditedRowId}
                trackerTone={trackerTone}
                isBeforeStart={effectiveIsBeforeStart}
                isBreakTime={effectiveIsBreakTime}
                isAfterRegularHours={effectiveIsAfterRegularHours}
                isWorkingDay={isWorkingDay}
                canTimeInToday={effectiveCanTimeInToday}
                todayBlockReason={effectiveTodayBlockReason}
                isHoliday={isHoliday}
                holidayName={holidayName}
                timeInOpenTime={todayShiftTimes?.timeInOpenTime ?? null}
                breakEndTime={todayShiftTimes?.breakEndTime ?? null}
                trackerMessage={effectiveTodayBlockReason ?? ""}
              />
            </>
          )}

          {activeTab === "ot" && (
            <UserOtTab
              loadingOt={loadingOt}
              myOvertime={myOvertime}
              setIsOvertimeModalOpen={setIsOvertimeModalOpen}
            />
          )}
        </div>
      </div>

      {isViewModalOpen && selectedViewRecord && (
        <ViewAttendanceModal
          isOpen={isViewModalOpen}
          record={selectedViewRecord}
          statusBadge={statusBadge}
          onClose={() => {
            setIsViewModalOpen(false);
            setSelectedViewRecord(null);
          }}
        />
      )}

      {isEditModalOpen && selectedEditRecord && (
        <EditAttendanceModal
          isOpen={isEditModalOpen}
          record={selectedEditRecord}
          onClose={() => {
            if (savingEdit) return;
            setIsEditModalOpen(false);
            setSelectedEditRecord(null);
          }}
          onChange={handleEditChange}
          onSave={handleEditSave}
          saving={savingEdit}
        />
      )}

      <TimeRecordModal
        isOpen={isTimeInModalOpen}
        mode="time-in"
        currentTime={effectiveCurrentTime}
        value={taskPlan}
        onChange={setTaskPlan}
        onClose={() => setIsTimeInModalOpen(false)}
        onConfirm={confirmTimeIn}
        submitting={submittingDtr}
        shiftStartTime={todayShiftTimes?.shiftStartTime ?? null}
        shiftEndTime={todayShiftTimes?.shiftEndTime ?? null}
        lateGraceMinutes={todayShiftTimes?.lateGraceMinutes ?? null}
      />

      <TimeRecordModal
        isOpen={isTimeOutModalOpen}
        mode="time-out"
        currentTime={effectiveCurrentTime}
        value={taskAccomplished}
        onChange={setTaskAccomplished}
        onClose={() => setIsTimeOutModalOpen(false)}
        onConfirm={confirmTimeOut}
        submitting={submittingDtr}
        shiftStartTime={todayShiftTimes?.shiftStartTime ?? null}
        shiftEndTime={todayShiftTimes?.shiftEndTime ?? null}
        lateGraceMinutes={todayShiftTimes?.lateGraceMinutes ?? null}
        timeInTime={attendanceForm.timeIn || null}
        breakStartTime={todayShiftTimes?.breakStartTime ?? null}
        breakEndTime={todayShiftTimes?.breakEndTime ?? null}
        overtimeStatus={todayOvertimeStatus}
      />

      <OvertimeRequestModal
        isOpen={isOvertimeModalOpen}
        submittingOt={submittingOt}
        errorMessage={otError}
        onClose={() => {
          if (submittingOt) return;
          setIsOvertimeModalOpen(false);
          setOtError(null);
        }}
        onSubmit={handleSubmitOvertime}
        isWorkingDay={isWorkingDay}
        breakEndTime={todayShiftTimes?.breakEndTime ?? null}
        shiftEndTime={todayShiftTimes?.shiftEndTime ?? null}
        shiftDays={currentShift?.days ?? []}
      />
    </div>
  );
};

export default UserAttendance;
