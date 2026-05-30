import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  ShieldCheck,
  X,
} from "lucide-react";
import { apiRequest } from "../../../lib/api";
import {
  assignShift,
  createShift,
  getShiftAssignmentsByShift,
  getShifts,
  unassignShiftAssignment,
  updateShift,
  updateShiftStatus,
  toApiTimeString,
  type Shift,
  type ShiftDay,
} from "../../../lib/attendance";
import type {
  AdminShiftRecord,
  StatusBadgeMap,
} from "../../../types/attendance";
import EditShiftModal from "./EditShiftModal";
import AddShiftModal from "./AddShiftModal";
import ShiftTable from "./ShiftTable";
import ShiftAssignmentsTable, {
  type ShiftAssignmentTableRow,
} from "./ShiftAssignmentsTable";
import AssignShiftModal from "./AssignShiftModal.tsx";
import ShiftViewModal from "./ShiftViewModal.tsx";
import UnassignShiftModal from "./UnassignShiftModal.tsx";

type Props = {
  shifts: AdminShiftRecord[];
  statusBadge: StatusBadgeMap;
  onEditShift: (shift: AdminShiftRecord) => void;
  onAddShift: () => void;
};

type EmployeeOption = {
  id: string;
  employeeNumber?: string | null;
  fullName: string;
  department?: string | null;
  position?: string | null;
  isActive?: boolean;
};

type PagedEmployeesResponse = {
  items: EmployeeOption[];
  totalCount: number;
  page: number;
  pageSize: number;
};

type ShiftAssignmentRow = ShiftAssignmentTableRow;

type AssignmentToast = {
  type: "success" | "error";
  message: string;
};

type AttendanceLogApiDto = {
  id: number;
  employeeId: string;
  employeeNumber?: string | null;
  employeeName?: string | null;
  date: string;
  timeIn?: string | null;
  timeOut?: string | null;
  isPresent?: boolean;
  lateMinutes?: number | null;
  undertimeMinutes?: number | null;
  overtimeMinutes?: number | null;
  renderedMinutes?: number | null;
  overtimeStatus?: "Approved" | "Pending" | "None" | string | null;
};

type PagedAttendanceLogsResponse = {
  items: AttendanceLogApiDto[];
  page: number;
  pageSize: number;
  totalCount: number;
};

type AssignmentDtrActivity = {
  id: number;
  date: string;
  timeIn: string;
  timeOut: string;
  total: string;
  status: "Present" | "Late" | "Absent" | "Incomplete";
  overtimeStatus: "Approved" | "Pending" | "None";
};

type ViewingAssignmentState = {
  assignment: ShiftAssignmentRow;
  logs: AssignmentDtrActivity[];
  loading: boolean;
  error: string | null;
};

type ShiftDayField =
  | "isWorkingDay"
  | "startTime"
  | "breakStartTime"
  | "breakEndTime"
  | "endTime";
type ShiftDayValue = boolean | string | null;

const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const DEFAULT_ASSIGNMENT_PAGE_SIZE = 10;

const SUFFIXES = new Set(["JR", "JR.", "SR", "SR.", "II", "III", "IV", "V"]);

const todayApiDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const normalizeAssignmentError = (error: unknown) => {
  const message = getErrorMessage(
    error,
    "Failed to assign shift. Please verify the employee and shift.",
  );
  const normalized = message.toLowerCase();

  if (
    normalized.includes("already has a shift assignment starting on this date")
  ) {
    return "Employee already has a shift assignment starting on this date. Choose a later effective date.";
  }

  if (normalized.includes("already assigned to this shift")) {
    return "Employee is already assigned to this shift. Select a different shift to reassign.";
  }

  if (normalized.includes("effective date must be later")) {
    return "Effective date must be later than the current active assignment start date.";
  }

  if (normalized.includes("overlap") || normalized.includes("history")) {
    return "Selected effective date is already covered by this employee's shift assignment history. Choose a later effective date.";
  }

  return message;
};

const formatDate = (value?: string | null) => {
  if (!value) return "--";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const formatTime = (value?: string | null) => {
  if (!value) return "--";

  const [hourRaw, minuteRaw] = value.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);

  if (Number.isNaN(hour) || Number.isNaN(minute)) return value.slice(0, 5);

  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

  return `${String(displayHour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${suffix}`;
};

const formatEmployeeName = (value?: string | null) => {
  if (!value || value === "--") return "--";

  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) return "--";

  if (cleaned.includes(",")) return cleaned;

  const parts = cleaned.split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0];

  const lastToken = parts[parts.length - 1].toUpperCase();
  const suffix = SUFFIXES.has(lastToken) ? parts.pop() : "";

  if (parts.length === 2) {
    const [firstName, lastName] = parts;
    return suffix
      ? `${lastName}, ${firstName}, ${suffix}`
      : `${lastName}, ${firstName}`;
  }

  const firstName = parts[0];
  const lastName = parts[parts.length - 1];
  const middleNames = parts.slice(1, -1);
  const middleInitial = middleNames.length
    ? ` ${middleNames[0].charAt(0).toUpperCase()}.`
    : "";

  const base = `${lastName}, ${firstName}${middleInitial}`;
  return suffix ? `${base}, ${suffix}` : base;
};

const getAvatarInitial = (value?: string | null) => {
  const formatted = formatEmployeeName(value);
  if (!formatted || formatted === "--") return "-";
  return formatted.charAt(0).toUpperCase();
};

const getWorkingDaysLabel = (days: ShiftDay[]) => {
  const workingDays = days
    .filter((day) => day.isWorkingDay)
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
    .map((day) => DAY_LABELS[day.dayOfWeek]?.slice(0, 3))
    .filter(Boolean);

  if (workingDays.length === 0) return "--";

  return workingDays.join(", ");
};

const getShiftStartTime = (shift: Shift) => {
  const firstWorkingDay = shift.days
    .filter((day) => day.isWorkingDay && day.startTime)
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)[0];

  return formatTime(firstWorkingDay?.startTime);
};

const getShiftEndTime = (shift: Shift) => {
  const firstWorkingDay = shift.days
    .filter((day) => day.isWorkingDay && day.endTime)
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)[0];

  return formatTime(firstWorkingDay?.endTime);
};

const cloneDays = (days: ShiftDay[]) =>
  days.map((day) => ({ ...day })).sort((a, b) => a.dayOfWeek - b.dayOfWeek);

const mapShiftToAdminRecord = (shift: Shift): AdminShiftRecord => {
  const assignedCount = Number(
    (shift as Shift & { assignedCount?: number | null }).assignedCount ?? 0,
  );

  return {
    id: shift.id,
    name: shift.name,
    timeIn: getShiftStartTime(shift),
    timeOut: getShiftEndTime(shift),
    grace: `${shift.lateGraceMinutes} min`,
    employees: assignedCount,
    assignedCount,
    status: shift.isActive ? "Active" : "Inactive",
  };
};

const normalizeDayForApi = (day: ShiftDay): ShiftDay => {
  if (!day.isWorkingDay) {
    return {
      ...day,
      startTime: null,
      breakStartTime: null,
      breakEndTime: null,
      endTime: null,
    };
  }

  return {
    ...day,
    startTime: toApiTimeString(day.startTime),
    breakStartTime: toApiTimeString(day.breakStartTime),
    breakEndTime: toApiTimeString(day.breakEndTime),
    endTime: toApiTimeString(day.endTime),
  };
};

const toMinutes = (value?: string | null) => {
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

const normalizeInsideShift = (
  valueMinutes: number,
  shiftStartMinutes: number,
  normalizedShiftEndMinutes: number,
) => {
  const sameDayValue = valueMinutes;
  const nextDayValue = valueMinutes + 1440;

  if (
    sameDayValue > shiftStartMinutes &&
    sameDayValue < normalizedShiftEndMinutes
  ) {
    return sameDayValue;
  }

  if (
    nextDayValue > shiftStartMinutes &&
    nextDayValue < normalizedShiftEndMinutes
  ) {
    return nextDayValue;
  }

  return null;
};

const normalizeAfterInsideShift = (
  valueMinutes: number,
  afterMinutes: number,
  normalizedShiftEndMinutes: number,
) => {
  const sameDayValue = valueMinutes;
  const nextDayValue = valueMinutes + 1440;

  if (sameDayValue > afterMinutes && sameDayValue < normalizedShiftEndMinutes) {
    return sameDayValue;
  }

  if (nextDayValue > afterMinutes && nextDayValue < normalizedShiftEndMinutes) {
    return nextDayValue;
  }

  return null;
};

const validateShiftDays = (days: ShiftDay[]) => {
  const workingDays = days.filter((day) => day.isWorkingDay);

  if (workingDays.length === 0) {
    return "At least one working day is required.";
  }

  for (const day of workingDays) {
    const dayLabel = DAY_LABELS[day.dayOfWeek];

    const startMinutes = toMinutes(day.startTime);
    const endMinutes = toMinutes(day.endTime);
    const breakStartMinutes = toMinutes(day.breakStartTime);
    const breakEndMinutes = toMinutes(day.breakEndTime);

    if (startMinutes === null || endMinutes === null) {
      return `${dayLabel} needs start and end time.`;
    }

    if (startMinutes === endMinutes) {
      return `${dayLabel} start and end cannot be the same.`;
    }

    const normalizedEndMinutes =
      endMinutes <= startMinutes ? endMinutes + 1440 : endMinutes;

    const hasBreakStart = breakStartMinutes !== null;
    const hasBreakEnd = breakEndMinutes !== null;

    if (hasBreakStart !== hasBreakEnd) {
      return `${dayLabel} break start and end must both be set.`;
    }

    if (breakStartMinutes !== null && breakEndMinutes !== null) {
      const normalizedBreakStartMinutes = normalizeInsideShift(
        breakStartMinutes,
        startMinutes,
        normalizedEndMinutes,
      );

      if (normalizedBreakStartMinutes === null) {
        return `${dayLabel} break start must be within shift hours.`;
      }

      const normalizedBreakEndMinutes = normalizeAfterInsideShift(
        breakEndMinutes,
        normalizedBreakStartMinutes,
        normalizedEndMinutes,
      );

      if (normalizedBreakEndMinutes === null) {
        return `${dayLabel} break end must be after break start.`;
      }

      const breakDurationMinutes =
        normalizedBreakEndMinutes - normalizedBreakStartMinutes;
      const workingDurationMinutes =
        normalizedEndMinutes - startMinutes - breakDurationMinutes;

      if (workingDurationMinutes < 60) {
        return `${dayLabel} working duration must be at least 1 hour.`;
      }
    }
  }

  return null;
};

const createAssignmentPlaceholder = (index: number): ShiftAssignmentRow => ({
  id: -(index + 1),
  employeeId: "",
  shiftId: 0,
  employeeNumber: "--",
  fullName: "--",
  department: "--",
  position: "--",
  effectiveFrom: "",
  effectiveTo: null,
  isActive: false,
  shiftName: "--",
});

const normalizeOvertimeStatus = (
  value?: string | null,
): AssignmentDtrActivity["overtimeStatus"] => {
  if (value === "Approved" || value === "Pending") return value;
  return "None";
};

const getDtrStatus = (
  log: AttendanceLogApiDto,
): AssignmentDtrActivity["status"] => {
  if (log.isPresent === false) return "Absent";
  if (!log.timeIn) return "Absent";
  if (!log.timeOut) return "Incomplete";
  if ((log.lateMinutes ?? 0) > 0) return "Late";
  return "Present";
};

const formatDuration = (minutes?: number | null) => {
  const safeMinutes = Math.max(0, Number(minutes ?? 0));

  if (safeMinutes <= 0) return "--";

  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;

  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
};

const mapDtrActivity = (log: AttendanceLogApiDto): AssignmentDtrActivity => ({
  id: log.id,
  date: formatDate(log.date),
  timeIn: formatTime(log.timeIn),
  timeOut: formatTime(log.timeOut),
  total: formatDuration(log.renderedMinutes),
  status: getDtrStatus(log),
  overtimeStatus: normalizeOvertimeStatus(log.overtimeStatus),
});

const getDtrStatusClassName = (status: AssignmentDtrActivity["status"]) => {
  switch (status) {
    case "Present":
      return "border-emerald-100 bg-emerald-50 text-emerald-700";
    case "Late":
      return "border-amber-100 bg-amber-50 text-amber-700";
    case "Incomplete":
      return "border-blue-100 bg-blue-50 text-blue-700";
    case "Absent":
    default:
      return "border-red-100 bg-red-50 text-red-700";
  }
};

const getOvertimeStatusClassName = (
  status: AssignmentDtrActivity["overtimeStatus"],
) => {
  switch (status) {
    case "Approved":
      return "border-blue-100 bg-blue-50 text-blue-700";
    case "Pending":
      return "border-amber-100 bg-amber-50 text-amber-700";
    case "None":
    default:
      return "border-slate-100 bg-slate-50 text-slate-400";
  }
};

type ShiftAssignmentDetailsModalProps = {
  state: ViewingAssignmentState | null;
  onClose: () => void;
  onViewProfile: (assignment: ShiftAssignmentRow) => void;
  onViewFullDtr: (assignment: ShiftAssignmentRow) => void;
};

const ShiftAssignmentDetailsModal = ({
  state,
  onClose,
  onViewProfile,
  onViewFullDtr,
}: ShiftAssignmentDetailsModalProps) => {
  if (!state || typeof document === "undefined") return null;

  const { assignment, logs, loading, error } = state;
  const employeeName = formatEmployeeName(assignment.fullName);

  return createPortal(
    <div className="fixed inset-0 z-[2147483646] flex items-center justify-center bg-slate-900/45 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
              <ShieldCheck className="h-6 w-6" />
            </div>

            <div>
              <h3 className="text-xl font-extrabold text-slate-900">
                Shift Assignment Details
              </h3>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Review assigned shift information and recent DTR activity.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close shift assignment details"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wide text-slate-400">
                  Employee
                </p>
                <h4 className="mt-1 text-lg font-extrabold text-slate-900">
                  {employeeName}
                </h4>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {assignment.employeeNumber || "--"}
                  {assignment.department ? ` • ${assignment.department}` : ""}
                  {assignment.position ? ` • ${assignment.position}` : ""}
                </p>
              </div>

              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                {assignment.isActive ? "Active" : "Inactive"}
              </span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-xs font-extrabold uppercase tracking-wide text-slate-400">
                  Assigned Shift
                </p>
                <div className="mt-2 flex items-center gap-2 text-sm font-extrabold text-slate-700">
                  <Clock3 className="h-4 w-4 text-slate-400" />
                  {assignment.shiftName || "--"}
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-xs font-extrabold uppercase tracking-wide text-slate-400">
                  Effective From
                </p>
                <div className="mt-2 flex items-center gap-2 text-sm font-extrabold text-slate-700">
                  <CalendarDays className="h-4 w-4 text-slate-400" />
                  {formatDate(assignment.effectiveFrom)}
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-xs font-extrabold uppercase tracking-wide text-slate-400">
                  Employment Type
                </p>
                <div className="mt-2 flex items-center gap-2 text-sm font-extrabold text-slate-700">
                  <ShieldCheck className="h-4 w-4 text-slate-400" />
                  {(
                    assignment as ShiftAssignmentRow & {
                      employmentType?: string | null;
                    }
                  ).employmentType || "--"}
                </div>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="flex items-start justify-between gap-4 px-4 py-4">
              <div>
                <h4 className="text-sm font-extrabold uppercase tracking-wide text-slate-700">
                  Recent DTR Activity
                </h4>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Latest attendance records found for this employee.
                </p>
              </div>

              <FileText className="h-5 w-5 text-slate-400" />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead>
                  <tr className="bg-gradient-to-r from-emerald-700 to-emerald-500 text-xs uppercase tracking-wide text-white">
                    <th className="px-4 py-3 font-extrabold">Date</th>
                    <th className="px-4 py-3 font-extrabold">Time In</th>
                    <th className="px-4 py-3 font-extrabold">Time Out</th>
                    <th className="px-4 py-3 font-extrabold">Total</th>
                    <th className="px-4 py-3 font-extrabold">Status</th>
                    <th className="px-4 py-3 font-extrabold">OT</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-sm font-semibold text-slate-500"
                      >
                        Loading recent DTR activity...
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-sm font-semibold text-red-600"
                      >
                        {error}
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-8 text-center text-sm font-semibold text-slate-500"
                      >
                        No recent DTR activity found.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="text-slate-600">
                        <td className="px-4 py-3 font-semibold">{log.date}</td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {log.timeIn}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {log.timeOut}
                        </td>
                        <td className="px-4 py-3 font-semibold">{log.total}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-extrabold ${getDtrStatusClassName(log.status)}`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-extrabold ${getOvertimeStatusClassName(log.overtimeStatus)}`}
                          >
                            {log.overtimeStatus === "None"
                              ? "--"
                              : log.overtimeStatus}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => onViewProfile(assignment)}
              className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700"
            >
              View Employee Profile
            </button>

            <button
              type="button"
              onClick={() => onViewFullDtr(assignment)}
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-extrabold text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
            >
              View Full DTR Records
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-extrabold text-slate-600 transition hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

const AdminSetupTab = ({ shifts, statusBadge }: Props) => {
  const navigate = useNavigate();
  const [apiShifts, setApiShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedAssignShiftId, setSelectedAssignShiftId] = useState<
    number | null
  >(null);
  const [effectiveFrom, setEffectiveFrom] = useState(todayApiDate());
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [, setAssignmentMessage] = useState<string | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [assignmentToast, setAssignmentToast] =
    useState<AssignmentToast | null>(null);
  const [
    recentlyUpdatedAssignmentEmployeeId,
    setRecentlyUpdatedAssignmentEmployeeId,
  ] = useState<string | null>(null);
  const shiftAssignmentsSectionRef = useRef<HTMLDivElement | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [unassignTarget, setUnassignTarget] =
    useState<ShiftAssignmentRow | null>(null);
  const [unassigningId, setUnassigningId] = useState<number | null>(null);
  const [viewingShift, setViewingShift] = useState<Shift | null>(null);
  const [viewingAssignment, setViewingAssignment] =
    useState<ViewingAssignmentState | null>(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [editName, setEditName] = useState("");
  const [editGraceMinutes, setEditGraceMinutes] = useState("0");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editedDays, setEditedDays] = useState<ShiftDay[]>([]);
  const [savingShift, setSavingShift] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [daysMessage, setDaysMessage] = useState<string | null>(null);
  const [daysError, setDaysError] = useState<string | null>(null);

  const [showAddShiftModal, setShowAddShiftModal] = useState(false);
  const [addName, setAddName] = useState("");
  const [addGraceMinutes, setAddGraceMinutes] = useState("15");
  const [addIsActive, setAddIsActive] = useState(true);
  const [addDays, setAddDays] = useState<ShiftDay[]>([]);
  const [savingAddShift, setSavingAddShift] = useState(false);
  const [addShiftError, setAddShiftError] = useState<string | null>(null);

  const activeShiftOptions = useMemo(
    () => apiShifts.filter((shift) => shift.isActive),
    [apiShifts],
  );

  useEffect(() => {
    if (!assignmentToast) return;

    const timer = window.setTimeout(() => setAssignmentToast(null), 3500);

    return () => window.clearTimeout(timer);
  }, [assignmentToast]);

  useEffect(() => {
    if (!recentlyUpdatedAssignmentEmployeeId) return;

    const timer = window.setTimeout(() => {
      setRecentlyUpdatedAssignmentEmployeeId((current) =>
        current === recentlyUpdatedAssignmentEmployeeId ? null : current,
      );
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [recentlyUpdatedAssignmentEmployeeId]);

  const scrollToShiftAssignmentsSection = useCallback(() => {
    window.setTimeout(() => {
      shiftAssignmentsSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 150);
  }, []);

  const loadAssignments = useCallback(async (loadedShifts: Shift[]) => {
    try {
      setLoadingAssignments(true);

      const activeShifts = loadedShifts.filter((shift) => shift.isActive);
      const assignmentGroups = await Promise.all(
        activeShifts.map(async (shift) => {
          const rows = await getShiftAssignmentsByShift(shift.id);

          return rows.map((row) => ({
            ...row,
            shiftId: row.shiftId || shift.id,
            shiftName: shift.name,
          }));
        }),
      );

      const sortedAssignments = assignmentGroups.flat().sort((a, b) => {
        const dateA = a.effectiveFrom
          ? new Date(`${a.effectiveFrom}T00:00:00`).getTime()
          : 0;
        const dateB = b.effectiveFrom
          ? new Date(`${b.effectiveFrom}T00:00:00`).getTime()
          : 0;

        if (dateA !== dateB) return dateB - dateA;
        return (b.id ?? 0) - (a.id ?? 0);
      });

      setAssignments(sortedAssignments);
      setAssignmentPage(1);
    } catch (error) {
      console.error("Failed to load shift assignments.", error);
      setAssignments([]);
    } finally {
      setLoadingAssignments(false);
    }
  }, []);

  const applyLoadedShifts = useCallback(
    (loadedShifts: Shift[]) => {
      setApiShifts(loadedShifts);

      if (!selectedAssignShiftId) {
        const firstActiveShift = loadedShifts.find((shift) => shift.isActive);
        setSelectedAssignShiftId(
          firstActiveShift?.id ?? loadedShifts[0]?.id ?? null,
        );
      }
    },
    [selectedAssignShiftId],
  );

  const loadShifts = useCallback(async () => {
    const response = await getShifts({
      page: 1,
      pageSize: 50,
    });

    const loadedShifts = response.items ?? [];
    applyLoadedShifts(loadedShifts);
    await loadAssignments(loadedShifts);

    return loadedShifts;
  }, [applyLoadedShifts, loadAssignments]);

  useEffect(() => {
    let mounted = true;

    const loadInitial = async () => {
      try {
        setLoading(true);
        const response = await getShifts({ page: 1, pageSize: 50 });
        if (!mounted) return;

        const loadedShifts = response.items ?? [];
        applyLoadedShifts(loadedShifts);
        await loadAssignments(loadedShifts);
      } catch (error) {
        console.error("Failed to load shifts.", error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const loadEmployees = async () => {
      try {
        setLoadingEmployees(true);

        const response = await apiRequest<PagedEmployeesResponse>(
          "/employees?page=1&pageSize=100&isActive=true",
        );

        if (!mounted) return;
        setEmployees(response.items ?? []);
      } catch (error) {
        console.error("Failed to load employees.", error);
      } finally {
        if (mounted) setLoadingEmployees(false);
      }
    };

    void loadInitial();
    void loadEmployees();

    return () => {
      mounted = false;
    };
  }, [applyLoadedShifts, loadAssignments]);

  const displayRows = useMemo(() => {
    if (apiShifts.length > 0) return apiShifts.map(mapShiftToAdminRecord);
    return shifts ?? [];
  }, [apiShifts, shifts]);

  const employeeLookup = useMemo(() => {
    const lookup = new Map<string, EmployeeOption>();

    employees.forEach((employee) => {
      lookup.set(employee.id, employee);
    });

    return lookup;
  }, [employees]);

  const enrichedAssignments = useMemo(
    () =>
      assignments
        .map((assignment) => {
          const employee = employeeLookup.get(assignment.employeeId);

          if (!employee) return assignment;

          return {
            ...assignment,
            employeeNumber:
              employee.employeeNumber ?? assignment.employeeNumber,
            fullName: employee.fullName || assignment.fullName,
            department: employee.department ?? assignment.department,
            position: employee.position ?? assignment.position,
          };
        })
        .sort((a, b) => {
          const dateA = a.effectiveFrom
            ? new Date(`${a.effectiveFrom}T00:00:00`).getTime()
            : 0;
          const dateB = b.effectiveFrom
            ? new Date(`${b.effectiveFrom}T00:00:00`).getTime()
            : 0;

          if (dateA !== dateB) return dateB - dateA;
          return (b.id ?? 0) - (a.id ?? 0);
        }),
    [assignments, employeeLookup],
  );

  const selectedEmployeeAssignment = useMemo(
    () =>
      enrichedAssignments.find(
        (assignment) =>
          assignment.employeeId === selectedEmployeeId &&
          assignment.id > 0 &&
          assignment.isActive,
      ) ?? null,
    [enrichedAssignments, selectedEmployeeId],
  );

  const totalAssignmentPages = useMemo(
    () =>
      Math.max(
        1,
        Math.ceil(enrichedAssignments.length / DEFAULT_ASSIGNMENT_PAGE_SIZE),
      ),
    [enrichedAssignments.length],
  );

  const visibleAssignments = useMemo(() => {
    const start = (assignmentPage - 1) * DEFAULT_ASSIGNMENT_PAGE_SIZE;
    const pageRows = enrichedAssignments.slice(
      start,
      start + DEFAULT_ASSIGNMENT_PAGE_SIZE,
    );
    const placeholdersNeeded = Math.max(
      0,
      DEFAULT_ASSIGNMENT_PAGE_SIZE - pageRows.length,
    );
    const placeholders = Array.from(
      { length: placeholdersNeeded },
      (_, index) => createAssignmentPlaceholder(index),
    );

    return [...pageRows, ...placeholders];
  }, [assignmentPage, enrichedAssignments]);

  const handleViewShiftClick = (shift: AdminShiftRecord) => {
    const fullShift = apiShifts.find((item) => item.id === shift.id);
    if (!fullShift) return;
    setViewingShift(fullShift);
  };

  const handleEditShiftClick = (shift: AdminShiftRecord) => {
    const fullShift = apiShifts.find((item) => item.id === shift.id);
    if (!fullShift) return;

    setEditingShift(fullShift);
    setEditName(fullShift.name);
    setEditGraceMinutes(String(fullShift.lateGraceMinutes ?? 0));
    setEditIsActive(fullShift.isActive);
    setEditedDays(cloneDays(fullShift.days ?? []));
    setDaysMessage(null);
    setDaysError(null);
    setEditError(null);
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    if (savingShift) return;

    setShowEditModal(false);
    setEditingShift(null);
    setEditError(null);
    setEditedDays([]);
  };

  const handleChangeEditDay = (
    dayId: number,
    field: ShiftDayField,
    value: ShiftDayValue,
  ) => {
    setEditError(null);
    setDaysMessage(null);
    setDaysError(null);

    setEditedDays((current) =>
      current.map((day) => {
        if (day.id !== dayId) return day;

        if (field === "isWorkingDay") {
          const isWorkingDay = Boolean(value);

          if (!isWorkingDay) {
            return {
              ...day,
              isWorkingDay: false,
              startTime: null,
              breakStartTime: null,
              breakEndTime: null,
              endTime: null,
            };
          }

          return {
            ...day,
            isWorkingDay: true,
            startTime: day.startTime ?? "08:30:00",
            breakStartTime: day.breakStartTime ?? "12:00:00",
            breakEndTime: day.breakEndTime ?? "13:00:00",
            endTime: day.endTime ?? "17:30:00",
          };
        }

        return {
          ...day,
          [field]:
            typeof value === "string" && value
              ? `${value.slice(0, 5)}:00`
              : null,
        };
      }),
    );
  };

  const createDefaultShiftDays = () =>
    DAY_LABELS.map((_, index) => ({
      id: -(index + 1),
      dayOfWeek: index,
      isWorkingDay: false,
      startTime: null,
      breakStartTime: null,
      breakEndTime: null,
      endTime: null,
    }));

  const buildShiftCode = (name: string) => {
    const normalized = name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 28);

    return `${normalized || "SHIFT"}-${Date.now().toString().slice(-6)}`;
  };

  const handleOpenAddShiftModal = () => {
    setAddName("");
    setAddGraceMinutes("15");
    setAddIsActive(true);
    setAddDays(createDefaultShiftDays());
    setAddShiftError(null);
    setDaysMessage(null);
    setDaysError(null);
    setShowAddShiftModal(true);
  };

  const handleCloseAddShiftModal = () => {
    if (savingAddShift) return;

    setShowAddShiftModal(false);
    setAddShiftError(null);
    setAddDays([]);
  };

  const handleChangeAddDay = (
    dayId: number,
    field: ShiftDayField,
    value: ShiftDayValue,
  ) => {
    setAddShiftError(null);
    setDaysMessage(null);
    setDaysError(null);

    setAddDays((current) =>
      current.map((day) => {
        if (day.id !== dayId) return day;

        if (field === "isWorkingDay") {
          const isWorkingDay = Boolean(value);

          if (!isWorkingDay) {
            return {
              ...day,
              isWorkingDay: false,
              startTime: null,
              breakStartTime: null,
              breakEndTime: null,
              endTime: null,
            };
          }

          return {
            ...day,
            isWorkingDay: true,
            startTime: day.startTime ?? "08:30:00",
            breakStartTime: day.breakStartTime ?? "12:00:00",
            breakEndTime: day.breakEndTime ?? "13:00:00",
            endTime: day.endTime ?? "17:30:00",
          };
        }

        return {
          ...day,
          [field]:
            typeof value === "string" && value
              ? `${value.slice(0, 5)}:00`
              : null,
        };
      }),
    );
  };

  const handleSaveAddShift = async () => {
    const trimmedName = addName.trim();

    if (!trimmedName) {
      setAddShiftError("Shift name is required.");
      return;
    }

    const grace = Number(addGraceMinutes);
    if (Number.isNaN(grace) || grace < 0) {
      setAddShiftError("Grace period must be a valid number.");
      return;
    }

    const validationError = validateShiftDays(addDays);
    if (validationError) {
      setAddShiftError(validationError);
      return;
    }

    try {
      setSavingAddShift(true);
      setAddShiftError(null);
      setDaysMessage(null);
      setDaysError(null);

      await createShift({
        code: buildShiftCode(trimmedName),
        name: trimmedName,
        description: null,
        lateGraceMinutes: grace,
        isFlexible: false,
        isActive: addIsActive,
        days: addDays.map(normalizeDayForApi),
      });

      await loadShifts();
      setDaysMessage(`${trimmedName} created.`);
      setShowAddShiftModal(false);
      setAddDays([]);
      setAddName("");
      setAddGraceMinutes("15");
      setAddIsActive(true);
    } catch (error) {
      console.error("Failed to create shift.", error);
      setAddShiftError(getErrorMessage(error, "Failed to create shift."));
    } finally {
      setSavingAddShift(false);
    }
  };

  const handleSaveEditShift = async () => {
    if (!editingShift) return;

    const trimmedName = editName.trim();
    if (!trimmedName) {
      setEditError("Shift name is required.");
      return;
    }

    const grace = Number(editGraceMinutes);
    if (Number.isNaN(grace) || grace < 0) {
      setEditError("Grace period must be a valid number.");
      return;
    }

    const validationError = validateShiftDays(editedDays);
    if (validationError) {
      setEditError(validationError);
      return;
    }

    try {
      setSavingShift(true);
      setEditError(null);
      setDaysMessage(null);
      setDaysError(null);

      await updateShift(editingShift.id, {
        code: editingShift.code,
        name: trimmedName,
        description: editingShift.description ?? null,
        lateGraceMinutes: grace,
        isFlexible: editingShift.isFlexible,
        isActive: editIsActive,
        days: editedDays.map(normalizeDayForApi),
      });

      if (editingShift.isActive !== editIsActive) {
        await updateShiftStatus(editingShift.id, { isActive: editIsActive });
      }

      await loadShifts();
      setDaysMessage(`${trimmedName} updated.`);
      setShowEditModal(false);
      setEditingShift(null);
      setEditedDays([]);
    } catch (error) {
      console.error("Failed to update shift.", error);
      setEditError(getErrorMessage(error, "Failed to update shift."));
    } finally {
      setSavingShift(false);
    }
  };

  const handleAssignShift = async () => {
    setAssignmentMessage(null);
    setAssignmentError(null);

    if (!selectedEmployeeId || !selectedAssignShiftId || !effectiveFrom) {
      setAssignmentError(
        "Please select an employee, shift, and effective date.",
      );
      return;
    }

    try {
      setAssigning(true);

      await assignShift({
        employeeId: selectedEmployeeId,
        shiftId: selectedAssignShiftId,
        effectiveFrom,
      });

      await loadShifts();

      const employee = employees.find((item) => item.id === selectedEmployeeId);
      const shift = apiShifts.find((item) => item.id === selectedAssignShiftId);
      const successMessage = selectedEmployeeAssignment
        ? `${formatEmployeeName(employee?.fullName) ?? "Employee"} reassigned to ${
            shift?.name ?? "selected shift"
          }.`
        : `${formatEmployeeName(employee?.fullName) ?? "Employee"} assigned to ${
            shift?.name ?? "selected shift"
          }.`;

      setAssignmentMessage(successMessage);
      setAssignmentToast({ type: "success", message: successMessage });
      setRecentlyUpdatedAssignmentEmployeeId(selectedEmployeeId);
      setAssignmentPage(1);
      setSelectedEmployeeId("");
      setShowAssignModal(false);
      scrollToShiftAssignmentsSection();
    } catch (error) {
      console.error("Failed to assign shift.", error);
      const message = normalizeAssignmentError(error);
      setAssignmentError(message);
      setAssignmentToast({ type: "error", message });
    } finally {
      setAssigning(false);
    }
  };

  const handleConfirmUnassign = async () => {
    if (!unassignTarget || unassignTarget.id <= 0) return;

    try {
      setUnassigningId(unassignTarget.id);
      setAssignmentMessage(null);
      setAssignmentError(null);

      await unassignShiftAssignment(unassignTarget.id);
      await loadShifts();

      const successMessage = `${formatEmployeeName(unassignTarget.fullName)} unassigned from ${unassignTarget.shiftName}.`;

      setAssignmentMessage(successMessage);
      setAssignmentToast({ type: "success", message: successMessage });
      setRecentlyUpdatedAssignmentEmployeeId(null);
      setUnassignTarget(null);
      scrollToShiftAssignmentsSection();
    } catch (error) {
      console.error("Failed to unassign employee.", error);
      const message = getErrorMessage(
        error,
        "Failed to unassign employee. Please try again.",
      );
      setAssignmentError(message);
      setAssignmentToast({ type: "error", message });
    } finally {
      setUnassigningId(null);
    }
  };

  const handleViewEmployeeLogs = async (assignment: ShiftAssignmentRow) => {
    if (!assignment.employeeNumber || assignment.employeeNumber === "--")
      return;

    setViewingAssignment({
      assignment,
      logs: [],
      loading: true,
      error: null,
    });

    try {
      const query = new URLSearchParams({
        page: "1",
        pageSize: "5",
        employeeId: assignment.employeeId,
      });

      const response = await apiRequest<PagedAttendanceLogsResponse>(
        `/attendance/logs/monitoring?${query.toString()}`,
      );

      setViewingAssignment((current) =>
        current?.assignment.id === assignment.id
          ? {
              ...current,
              logs: (response.items ?? []).map(mapDtrActivity),
              loading: false,
              error: null,
            }
          : current,
      );
    } catch (error) {
      console.error("Failed to load employee DTR activity.", error);
      const message = getErrorMessage(
        error,
        "Failed to load recent DTR activity.",
      );

      setViewingAssignment((current) =>
        current?.assignment.id === assignment.id
          ? { ...current, loading: false, error: message }
          : current,
      );
    }
  };

  const handleViewEmployeeProfile = (assignment: ShiftAssignmentRow) => {
    if (!assignment.employeeId) return;

    navigate("/dashboard/personal-records", {
      state: {
        viewEmployeeId: assignment.employeeId,
      },
    });
  };

  const handleViewFullDtrRecords = (assignment: ShiftAssignmentRow) => {
    window.dispatchEvent(
      new CustomEvent("attendance:view-employee-logs", {
        detail: {
          employeeId: assignment.employeeId,
          employeeNumber: assignment.employeeNumber,
          employeeName: formatEmployeeName(assignment.fullName),
        },
      }),
    );

    setViewingAssignment(null);
  };

  return (
    <>
      {assignmentToast &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className={`fixed right-6 top-6 z-[2147483647] flex max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm font-semibold shadow-xl ${
              assignmentToast.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {assignmentToast.type === "success" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{assignmentToast.message}</span>
          </div>,
          document.body,
        )}

      <div className="space-y-5">
        <ShiftTable
          shifts={displayRows}
          apiShifts={apiShifts}
          loading={loading}
          statusBadge={statusBadge}
          onViewShift={handleViewShiftClick}
          onEditShift={handleEditShiftClick}
          onAddShift={handleOpenAddShiftModal}
          getWorkingDaysLabel={getWorkingDaysLabel}
        />

        <div ref={shiftAssignmentsSectionRef} className="scroll-mt-28">
          <ShiftAssignmentsTable
            assignments={visibleAssignments}
            loading={loadingAssignments}
            page={assignmentPage}
            totalPages={totalAssignmentPages}
            assignmentMessage={null}
            assignmentError={assignmentError}
            unassigningId={unassigningId}
            recentlyUpdatedEmployeeId={recentlyUpdatedAssignmentEmployeeId}
            formatDate={formatDate}
            formatEmployeeName={formatEmployeeName}
            getAvatarInitial={getAvatarInitial}
            onPrev={() => setAssignmentPage((page) => Math.max(1, page - 1))}
            onNext={() =>
              setAssignmentPage((page) =>
                Math.min(totalAssignmentPages, page + 1),
              )
            }
            onViewEmployeeLogs={handleViewEmployeeLogs}
            onUnassign={setUnassignTarget}
            onAssignShift={() => {
              setAssignmentError(null);
              setAssignmentMessage(null);
              setShowAssignModal(true);
            }}
          />
        </div>

        {daysMessage && (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {daysMessage}
          </div>
        )}

        {daysError && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {daysError}
          </div>
        )}

        <ShiftAssignmentDetailsModal
          state={viewingAssignment}
          onClose={() => setViewingAssignment(null)}
          onViewProfile={handleViewEmployeeProfile}
          onViewFullDtr={handleViewFullDtrRecords}
        />

        <AddShiftModal
          open={showAddShiftModal}
          days={addDays}
          name={addName}
          graceMinutes={addGraceMinutes}
          isActive={addIsActive}
          saving={savingAddShift}
          error={addShiftError}
          onClose={handleCloseAddShiftModal}
          onNameChange={setAddName}
          onGraceMinutesChange={setAddGraceMinutes}
          onIsActiveChange={setAddIsActive}
          onChangeDay={handleChangeAddDay}
          onSave={handleSaveAddShift}
        />

        <AssignShiftModal
          open={showAssignModal}
          employees={employees}
          activeShiftOptions={activeShiftOptions}
          selectedEmployeeId={selectedEmployeeId}
          selectedShiftId={selectedAssignShiftId}
          effectiveFrom={effectiveFrom}
          loadingEmployees={loadingEmployees}
          assigning={assigning}
          assignmentError={assignmentError}
          formatEmployeeName={formatEmployeeName}
          onClose={() => setShowAssignModal(false)}
          onEmployeeChange={(value) => {
            setSelectedEmployeeId(value);
            setAssignmentError(null);
          }}
          onShiftChange={(value) => {
            setSelectedAssignShiftId(value);
            setAssignmentError(null);
          }}
          onEffectiveFromChange={(value) => {
            setEffectiveFrom(value);
            setAssignmentError(null);
          }}
          onAssign={handleAssignShift}
        />

        <ShiftViewModal
          shift={viewingShift}
          formatTime={formatTime}
          getWorkingDaysLabel={getWorkingDaysLabel}
          onClose={() => setViewingShift(null)}
        />

        <UnassignShiftModal
          target={unassignTarget}
          unassigningId={unassigningId}
          formatEmployeeName={formatEmployeeName}
          onClose={() => setUnassignTarget(null)}
          onConfirm={handleConfirmUnassign}
        />

        <EditShiftModal
          open={showEditModal}
          shift={editingShift}
          days={editedDays}
          name={editName}
          graceMinutes={editGraceMinutes}
          isActive={editIsActive}
          saving={savingShift}
          error={editError}
          onClose={handleCloseEditModal}
          onNameChange={setEditName}
          onGraceMinutesChange={setEditGraceMinutes}
          onIsActiveChange={setEditIsActive}
          onChangeDay={handleChangeEditDay}
          onSave={handleSaveEditShift}
        />
      </div>
    </>
  );
};

export default AdminSetupTab;
