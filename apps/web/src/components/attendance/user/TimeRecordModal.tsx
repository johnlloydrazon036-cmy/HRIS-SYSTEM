import { X } from "lucide-react";
import { createPortal } from "react-dom";

type TimeRecordModalMode = "time-in" | "time-out";

type TimeRecordModalProps = {
  isOpen: boolean;
  mode: TimeRecordModalMode;
  currentTime: Date;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  submitting: boolean;

  shiftStartTime?: string | null;
  lateGraceMinutes?: number | null;
  shiftEndTime?: string | null;
  timeInTime?: string | null;
  breakStartTime?: string | null;
  breakEndTime?: string | null;
  overtimeStatus?: "None" | "Pending" | "Approved" | string | null;
};

const DAY_MINUTES = 1440;

const getMinutes = (time: Date) => time.getHours() * 60 + time.getMinutes();

const parseTimeToMinutes = (time?: string | null) => {
  if (!time) return null;

  const raw = time.trim();
  if (!raw || raw === "-" || raw === "--" || raw === "--:-- --") return null;

  const displayTimeMatch = raw.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
  if (displayTimeMatch) {
    let hour = Number(displayTimeMatch[1]);
    const minute = Number(displayTimeMatch[2]);
    const modifier = displayTimeMatch[3].toUpperCase();

    if (
      Number.isNaN(hour) ||
      Number.isNaN(minute) ||
      hour < 1 ||
      hour > 12 ||
      minute < 0 ||
      minute > 59
    ) {
      return null;
    }

    if (modifier === "AM" && hour === 12) hour = 0;
    if (modifier === "PM" && hour !== 12) hour += 12;

    return hour * 60 + minute;
  }

  const timeOnlyMatch = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/);
  if (timeOnlyMatch) {
    const hour = Number(timeOnlyMatch[1]);
    const minute = Number(timeOnlyMatch[2]);

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
  }

  return null;
};

const normalizeEndMinutes = (startMinutes: number, endMinutes: number) => {
  return endMinutes <= startMinutes ? endMinutes + DAY_MINUTES : endMinutes;
};

const normalizePointWithinRange = (
  valueMinutes: number,
  rangeStartMinutes: number,
  rangeEndMinutes: number,
) => {
  const sameDayValue = valueMinutes;
  const nextDayValue = valueMinutes + DAY_MINUTES;

  if (sameDayValue >= rangeStartMinutes && sameDayValue <= rangeEndMinutes) {
    return sameDayValue;
  }

  if (nextDayValue >= rangeStartMinutes && nextDayValue <= rangeEndMinutes) {
    return nextDayValue;
  }

  return sameDayValue;
};

const calculateBreakOverlapMinutes = (
  actualStartMinutes: number,
  actualEndMinutes: number,
  breakStartMinutes?: number | null,
  breakEndMinutes?: number | null,
) => {
  if (breakStartMinutes === null || breakStartMinutes === undefined) return 0;
  if (breakEndMinutes === null || breakEndMinutes === undefined) return 0;

  const normalizedBreakEndMinutes = normalizeEndMinutes(
    breakStartMinutes,
    breakEndMinutes,
  );

  const normalizedBreakStart = normalizePointWithinRange(
    breakStartMinutes,
    actualStartMinutes,
    actualEndMinutes,
  );

  const normalizedBreakEnd = normalizePointWithinRange(
    normalizedBreakEndMinutes,
    normalizedBreakStart,
    actualEndMinutes,
  );

  const overlapStart = Math.max(actualStartMinutes, normalizedBreakStart);
  const overlapEnd = Math.min(actualEndMinutes, normalizedBreakEnd);

  return Math.max(0, overlapEnd - overlapStart);
};

const determineTimeInStatus = (
  current: Date,
  shiftStartTime?: string | null,
  lateGraceMinutes?: number | null,
) => {
  const currentMinutes = getMinutes(current);

  const shiftStartMinutes = parseTimeToMinutes(shiftStartTime);
  if (shiftStartMinutes === null) return "Present";

  const grace = Number(lateGraceMinutes ?? 0);
  const safeGrace = Number.isFinite(grace) && grace > 0 ? grace : 0;
  const lateThreshold = shiftStartMinutes + safeGrace;

  return currentMinutes > lateThreshold ? "Late" : "Present";
};

const normalizeOvertimeStatus = (
  value?: string | null,
): "None" | "Pending" | "Approved" => {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "approved") return "Approved";
  if (normalized === "pending") return "Pending";

  return "None";
};

const determineTimeOutStatus = (
  current: Date,
  shiftStartTime?: string | null,
  shiftEndTime?: string | null,
  timeInTime?: string | null,
  breakStartTime?: string | null,
  breakEndTime?: string | null,
) => {
  const currentMinutes = getMinutes(current);
  const shiftStartMinutes = parseTimeToMinutes(shiftStartTime);
  const shiftEndMinutes = parseTimeToMinutes(shiftEndTime);
  const timeInMinutes = parseTimeToMinutes(timeInTime);
  const breakStartMinutes = parseTimeToMinutes(breakStartTime);
  const breakEndMinutes = parseTimeToMinutes(breakEndTime);

  if (shiftStartMinutes === null || shiftEndMinutes === null) {
    return "Regular";
  }

  const normalizedShiftEndMinutes = normalizeEndMinutes(
    shiftStartMinutes,
    shiftEndMinutes,
  );

  const normalizedCurrentMinutes = normalizePointWithinRange(
    currentMinutes,
    shiftStartMinutes,
    normalizedShiftEndMinutes + DAY_MINUTES,
  );

  if (normalizedCurrentMinutes > normalizedShiftEndMinutes) {
    return "Pending Overtime";
  }

  if (timeInMinutes === null) {
    return "Regular";
  }

  const normalizedTimeInMinutes = normalizePointWithinRange(
    timeInMinutes,
    shiftStartMinutes,
    normalizedShiftEndMinutes + DAY_MINUTES,
  );

  const scheduledBreakMinutes = calculateBreakOverlapMinutes(
    shiftStartMinutes,
    normalizedShiftEndMinutes,
    breakStartMinutes,
    breakEndMinutes,
  );

  const requiredMinutes = Math.max(
    0,
    normalizedShiftEndMinutes - shiftStartMinutes - scheduledBreakMinutes,
  );

  const actualBreakMinutes = calculateBreakOverlapMinutes(
    normalizedTimeInMinutes,
    normalizedCurrentMinutes,
    breakStartMinutes,
    breakEndMinutes,
  );

  const renderedMinutes = Math.max(
    0,
    normalizedCurrentMinutes - normalizedTimeInMinutes - actualBreakMinutes,
  );

  if (renderedMinutes < requiredMinutes) {
    return "Undertime";
  }

  return "Regular";
};

const TimeRecordModal = ({
  isOpen,
  mode,
  currentTime,
  value,
  onChange,
  onClose,
  onConfirm,
  submitting,
  shiftStartTime,
  lateGraceMinutes,
  shiftEndTime,
  timeInTime,
  breakStartTime,
  breakEndTime,
  overtimeStatus,
}: TimeRecordModalProps) => {
  if (!isOpen) return null;

  const isTimeIn = mode === "time-in";

  const computedStatus = isTimeIn
    ? determineTimeInStatus(currentTime, shiftStartTime, lateGraceMinutes)
    : determineTimeOutStatus(
        currentTime,
        shiftStartTime,
        shiftEndTime,
        timeInTime,
        breakStartTime,
        breakEndTime,
      );

  const normalizedOvertimeStatus = normalizeOvertimeStatus(overtimeStatus);
  const status =
    !isTimeIn && normalizedOvertimeStatus === "Approved"
      ? "Approved Overtime"
      : computedStatus;

  const title = isTimeIn ? "Record Time In" : "Record Time Out";
  const label = isTimeIn ? "Task" : "Accomplished";
  const placeholder = isTimeIn
    ? "List down the tasks you plan to accomplish today..."
    : "Describe the tasks you successfully completed...";
  const confirmLabel = isTimeIn ? "Confirm Time In" : "Confirm Time Out";

  const isLate = status === "Late";
  const isUndertime = status === "Undertime";
  const isPendingOT = status === "Pending Overtime";
  const isApprovedOT = status === "Approved Overtime";

  const panelClass = isTimeIn
    ? isLate
      ? "border-amber-100 bg-amber-50"
      : "border-emerald-100 bg-emerald-50"
    : isPendingOT || isApprovedOT
      ? "border-blue-100 bg-blue-50"
      : isUndertime
        ? "border-orange-100 bg-orange-50"
        : "border-rose-100 bg-rose-50";

  const headingClass = isTimeIn
    ? isLate
      ? "text-amber-500"
      : "text-emerald-600"
    : isPendingOT || isApprovedOT
      ? "text-blue-600"
      : isUndertime
        ? "text-orange-500"
        : "text-rose-500";

  const timeClass = isTimeIn
    ? isLate
      ? "text-amber-600"
      : "text-emerald-600"
    : isPendingOT || isApprovedOT
      ? "text-blue-600"
      : isUndertime
        ? "text-orange-600"
        : "text-rose-600";

  const badgeClass = isTimeIn
    ? isLate
      ? "border-amber-200 bg-amber-100 text-amber-700"
      : "border-emerald-200 bg-emerald-100 text-emerald-700"
    : isPendingOT || isApprovedOT
      ? "border-blue-200 bg-blue-100 text-blue-700"
      : isUndertime
        ? "border-orange-200 bg-orange-100 text-orange-700"
        : "border-rose-200 bg-rose-100 text-rose-700";

  const focusClass = isTimeIn
    ? isLate
      ? "focus:border-amber-500 focus:ring-2 focus:ring-amber-500"
      : "focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500"
    : isPendingOT || isApprovedOT
      ? "focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
      : isUndertime
        ? "focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
        : "focus:border-rose-500 focus:ring-2 focus:ring-rose-500";

  const confirmButtonClass = isTimeIn
    ? isLate
      ? "bg-amber-500 hover:bg-amber-600"
      : "bg-emerald-500 hover:bg-emerald-600"
    : isPendingOT || isApprovedOT
      ? "bg-blue-500 hover:bg-blue-600"
      : isUndertime
        ? "bg-orange-500 hover:bg-orange-600"
        : "bg-rose-500 hover:bg-rose-600";

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex min-h-dvh items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md animate-fade-in-up rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 transition-colors hover:text-gray-600"
            disabled={submitting}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-6 flex flex-col items-center justify-center">
          <div
            className={`flex w-full flex-col items-center justify-center rounded-xl border p-4 ${panelClass}`}
          >
            <div className="mb-2 flex items-center gap-2">
              <p
                className={`text-sm font-black uppercase tracking-wider ${headingClass}`}
              >
                Time to Record
              </p>

              <span
                className={`rounded-full border px-2 py-1 text-[10px] font-bold ${badgeClass}`}
              >
                {status}
              </span>
            </div>

            <p
              className={`font-mono text-5xl font-black tracking-tight ${timeClass}`}
            >
              {currentTime.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>

        <div className="mb-6">
          <label className="mb-2 block text-sm font-bold text-gray-700">
            {label}
          </label>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`h-28 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm outline-none placeholder:text-gray-400 ${focusClass}`}
            placeholder={placeholder}
            disabled={submitting}
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-xl bg-gray-100 px-5 py-2.5 font-bold text-gray-600 hover:bg-gray-200"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-xl px-5 py-2.5 font-bold text-white ${confirmButtonClass}`}
            disabled={submitting}
          >
            {submitting ? "Saving..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default TimeRecordModal;