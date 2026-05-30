import { CalendarDays, Check, Clock3, Edit, Eye, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AdminDtrRecord, StatusBadgeMap } from "../../../types/attendance";

type Props = {
  records: AdminDtrRecord[];
  loading: boolean;
  statusBadge: StatusBadgeMap;
  onView: (record: AdminDtrRecord) => void;
  onEdit: (record: AdminDtrRecord) => void;
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  recentlyEditedRowId: number | null;
};

const DEFAULT_PAGE_SIZE = 10;

const SUFFIXES = new Set(["JR", "JR.", "SR", "SR.", "II", "III", "IV", "V"]);

const formatAttendanceDate = (value: string) => {
  if (!value || value === "--") return "--";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const formatAttendanceName = (value: string, suffix?: string) => {
  if (!value || value === "--") return "--";

  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) return "--";

  const normalizedSuffix = suffix?.trim();

  if (cleaned.includes(",")) {
    if (normalizedSuffix) {
      const upperName = cleaned.toUpperCase();
      const upperSuffix = normalizedSuffix.toUpperCase();
      return upperName.includes(upperSuffix)
        ? cleaned
        : `${cleaned}, ${normalizedSuffix}`;
    }

    return cleaned;
  }

  const parts = cleaned.split(" ").filter(Boolean);
  if (parts.length === 1) {
    return normalizedSuffix ? `${parts[0]}, ${normalizedSuffix}` : parts[0];
  }

  let detectedSuffix = "";
  const lastToken = parts[parts.length - 1].toUpperCase();
  if (SUFFIXES.has(lastToken)) {
    detectedSuffix = parts.pop() || "";
  }

  const finalSuffix = normalizedSuffix || detectedSuffix;

  if (parts.length === 2) {
    const [firstName, lastName] = parts;
    return finalSuffix
      ? `${lastName}, ${firstName}, ${finalSuffix}`
      : `${lastName}, ${firstName}`;
  }

  const firstName = parts[0];
  const lastName = parts[parts.length - 1];
  const middleNames = parts.slice(1, -1);
  const middleInitial = middleNames.length
    ? ` ${middleNames[0].charAt(0).toUpperCase()}.`
    : "";

  const base = `${lastName}, ${firstName}${middleInitial}`;
  return finalSuffix ? `${base}, ${finalSuffix}` : base;
};

const formatMinutes = (minutes?: number) => {
  if (!minutes || minutes <= 0) return "--";

  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const mins = total % 60;

  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;

  return `${hours}h ${mins}m`;
};

const formatTimeDisplay = (value?: string | null) => {
  if (!value) return "--:-- --";

  const normalized = value.trim();

  if (
    normalized === "" ||
    normalized === "-" ||
    normalized === "--" ||
    normalized === "--:-- --"
  ) {
    return "--:-- --";
  }

  return normalized;
};

const getAvatarInitial = (value: string, suffix?: string) => {
  const formatted = formatAttendanceName(value, suffix);
  if (!formatted || formatted === "--") return "-";
  return formatted.charAt(0).toUpperCase();
};

const createPlaceholderRow = (id: number): AdminDtrRecord => ({
  id,
  empId: "--",
  name: "--",
  suffix: undefined,
  date: "--",
  timeIn: "--:-- --",
  timeOut: "--:-- --",
  status: "Present" as const,
  isOT: false,
  isUndertime: false,
  overtimeStatus: "None",
  task: "--",
  accomplished: "--",
  lateMinutes: 0,
  undertimeMinutes: 0,
  overtimeMinutes: 0,
  renderedMinutes: 0,
  requiredMinutes: 0,
  regularCreditedMinutes: 0,
  overtimeCreditedMinutes: 0,
  creditedMinutes: 0,
  excessMinutes: 0,
  hasExceededApprovedOvertime: false,
});

const normalizeTimeInput = (value: string) => value.trim().toUpperCase();

const normalizeOvertimeStatus = (value?: string | null) => {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "approved") return "Approved";

  return "None";
};

const getStableRowKey = (record: AdminDtrRecord, index: number) => {
  const isPlaceholder = record.id < 0;

  if (isPlaceholder) {
    return `placeholder-${index}-${record.id}`;
  }

  const employeeId = record.empId || "employee";
  const date = record.date || "date";
  const timeIn = record.timeIn || "no-time-in";
  const timeOut = record.timeOut || "no-time-out";
  const status = record.status || "status";

  return `dtr-${record.id}-${employeeId}-${date}-${timeIn}-${timeOut}-${status}-${index}`;
};

const AdminDtrTable = ({
  records,
  loading,
  statusBadge,
  onView,
  onEdit,
  page,
  totalPages,
  onPrev,
  onNext,
  recentlyEditedRowId,
}: Props) => {
  const [editingRowKey, setEditingRowKey] = useState<string | null>(null);
  const [editedTimeIn, setEditedTimeIn] = useState("");
  const [editedTimeOut, setEditedTimeOut] = useState("");

  const safePage = Math.max(1, page || 1);
  const safeTotalPages = Math.max(1, totalPages || 1);

  const canPrev = safePage > 1 && !loading;
  const canNext = safePage < safeTotalPages && !loading;

  const hasRecords = records.length > 0;

  useEffect(() => {
    if (editingRowKey === null) return;

    const rowStillExists = records.some(
      (record, index) => getStableRowKey(record, index) === editingRowKey,
    );

    if (rowStillExists) return;

    const timeout = window.setTimeout(() => {
      setEditingRowKey(null);
      setEditedTimeIn("");
      setEditedTimeOut("");
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [records, editingRowKey]);

  const editingSourceRecord = useMemo(
    () =>
      records.find(
        (record, index) => getStableRowKey(record, index) === editingRowKey,
      ) ?? null,
    [records, editingRowKey],
  );

  const isDirty = editingSourceRecord
    ? normalizeTimeInput(editedTimeIn) !==
        normalizeTimeInput(editingSourceRecord.timeIn || "") ||
      normalizeTimeInput(editedTimeOut) !==
        normalizeTimeInput(editingSourceRecord.timeOut || "")
    : false;

  const dataRows = hasRecords
    ? [
        ...records,
        ...Array.from(
          { length: Math.max(0, DEFAULT_PAGE_SIZE - records.length) },
          (_, i) => createPlaceholderRow(-(i + 1)),
        ),
      ]
    : Array.from({ length: DEFAULT_PAGE_SIZE - 1 }, (_, i) =>
        createPlaceholderRow(-(i + 1)),
      );

  const startInlineEdit = (row: AdminDtrRecord, rowKey: string) => {
    setEditingRowKey(rowKey);
    setEditedTimeIn(formatTimeDisplay(row.timeIn));
    setEditedTimeOut(formatTimeDisplay(row.timeOut));
  };

  const cancelInlineEdit = () => {
    setEditingRowKey(null);
    setEditedTimeIn("");
    setEditedTimeOut("");
  };

  const saveInlineEdit = (row: AdminDtrRecord) => {
    if (!isDirty) return;

    onEdit({
      ...row,
      timeIn: editedTimeIn.trim(),
      timeOut: editedTimeOut.trim(),
    });

    setEditingRowKey(null);
    setEditedTimeIn("");
    setEditedTimeOut("");
  };

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-gray-100">
      <div className="overflow-x-auto">
        <table className="pro-table min-w-full">
          <thead>
            <tr>
              <th>EMPLOYEE ID</th>
              <th>NAME</th>
              <th>DATE</th>
              <th>TIME IN</th>
              <th>TIME OUT</th>
              <th>TOTAL</th>
              <th>STATUS</th>
              <th className="text-center">ACTIONS</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-6 py-10 text-center text-sm italic text-gray-500"
                >
                  Loading attendance records...
                </td>
              </tr>
            ) : (
              <>
                {!hasRecords && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-10 text-center text-sm font-medium text-gray-600"
                    >
                      No attendance records found.
                    </td>
                  </tr>
                )}

                {dataRows.map((row, index) => {
                  const rowKey = getStableRowKey(row, index);
                  const isPlaceholder = row.id < 0;
                  const isAbsent = String(row.status) === "Absent";
                  const isIncomplete = String(row.status) === "Incomplete";
                  const isEditing = editingRowKey === rowKey;
                  const formattedName = formatAttendanceName(row.name, row.suffix);
                  const avatarInitial = getAvatarInitial(row.name, row.suffix);
                  const formattedDate = formatAttendanceDate(row.date);
                  const formattedTimeIn = formatTimeDisplay(row.timeIn);
                  const formattedTimeOut = formatTimeDisplay(row.timeOut);
                  const formattedTotal = formatMinutes(row.renderedMinutes);
                  const hasApprovedOT =
                    normalizeOvertimeStatus(row.overtimeStatus) === "Approved";
                  const canView = !isPlaceholder && !isAbsent;
                  const canEdit = !isPlaceholder && !isAbsent;

                  return (
                    <tr
                      key={rowKey}
                      className={`
                        transition-all duration-500
                        ${
                          !isPlaceholder && recentlyEditedRowId === row.id
                            ? "bg-green-50 animate-[pulseRow_3s_ease-in-out_1]"
                            : "hover:bg-gray-50"
                        }
                      `}
                    >
                      <td
                        className={`px-6 py-4 font-mono text-xs ${
                          isPlaceholder ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        {row.empId || "--"}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={
                              isPlaceholder
                                ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-bold text-gray-300"
                                : "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-xs font-bold text-white"
                            }
                          >
                            {isPlaceholder ? "--" : avatarInitial}
                          </div>

                          <span
                            className={
                              isPlaceholder
                                ? "font-medium text-gray-300"
                                : "font-medium text-gray-800"
                            }
                          >
                            {formattedName}
                          </span>
                        </div>
                      </td>

                      <td
                        className={`px-6 py-4 whitespace-nowrap font-medium ${
                          isPlaceholder ? "text-gray-300" : "text-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <CalendarDays
                            className={`h-4 w-4 shrink-0 ${
                              isPlaceholder ? "text-gray-300" : "text-slate-400"
                            }`}
                          />
                          <span>{formattedDate}</span>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {isPlaceholder ? (
                          <span className="font-mono text-sm font-semibold text-gray-300">
                            --:-- --
                          </span>
                        ) : isEditing ? (
                          <input
                            type="text"
                            value={editedTimeIn}
                            onChange={(e) => setEditedTimeIn(e.target.value)}
                            className="h-[36px] w-[112px] rounded-[10px] border border-emerald-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                            placeholder="08:30 AM"
                          />
                        ) : (
                          <span className="font-mono text-sm font-semibold text-slate-600">
                            {formattedTimeIn}
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {isPlaceholder ? (
                          <span className="font-mono text-sm font-semibold text-gray-300">
                            --:-- --
                          </span>
                        ) : isEditing ? (
                          <input
                            type="text"
                            value={editedTimeOut}
                            onChange={(e) => setEditedTimeOut(e.target.value)}
                            className="h-[36px] w-[112px] rounded-[10px] border border-emerald-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                            placeholder="05:30 PM"
                          />
                        ) : (
                          <span className="font-mono text-sm font-semibold text-slate-600">
                            {formattedTimeOut}
                          </span>
                        )}
                      </td>

                      <td
                        className={`px-6 py-4 whitespace-nowrap font-mono text-sm font-semibold ${
                          isPlaceholder ? "text-gray-300" : "text-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Clock3
                            className={`h-4 w-4 shrink-0 ${
                              isPlaceholder ? "text-gray-300" : "text-slate-400"
                            }`}
                          />
                          <span>{isPlaceholder ? "--" : formattedTotal}</span>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {isPlaceholder ? (
                          <span className="text-gray-300">--</span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`badge ${statusBadge[row.status]}`}>
                              <span className="badge-dot" />
                              {row.status}
                            </span>

                            {row.isUndertime && !isAbsent && !isIncomplete && (
                              <span className="badge badge-undertime">
                                <span className="badge-dot" />
                                Undertime
                              </span>
                            )}

                            {hasApprovedOT && !isIncomplete && (
                              <span className="badge badge-info">
                                <span className="badge-dot" />
                                Overtime
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="relative px-6 py-4">
                        {isPlaceholder ? (
                          <div className="flex items-center justify-center gap-5">
                            <button
                              type="button"
                              disabled
                              className="cursor-not-allowed text-slate-300"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled
                              className="cursor-not-allowed text-slate-300"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          </div>
                        ) : isEditing ? (
                          <div className="relative z-[5] flex items-center justify-center gap-4">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                saveInlineEdit(row);
                              }}
                              disabled={!isDirty}
                              className={`inline-flex cursor-pointer items-center justify-center transition ${
                                isDirty
                                  ? "text-emerald-600 hover:text-emerald-700"
                                  : "cursor-not-allowed text-slate-300"
                              }`}
                              title="Save"
                            >
                              <Check className="pointer-events-none h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                cancelInlineEdit();
                              }}
                              className="inline-flex cursor-pointer items-center justify-center text-slate-500 transition hover:text-slate-700"
                              title="Cancel"
                            >
                              <X className="pointer-events-none h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="relative z-[5] flex items-center justify-center gap-5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (canView) onView(row);
                              }}
                              disabled={!canView}
                              className="inline-flex cursor-pointer items-center justify-center text-slate-500 transition hover:text-slate-700 disabled:cursor-not-allowed disabled:text-gray-300 disabled:opacity-50"
                              title="View"
                            >
                              <Eye className="pointer-events-none h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (canEdit) startInlineEdit(row, rowKey);
                              }}
                              disabled={!canEdit}
                              className="inline-flex cursor-pointer items-center justify-center text-slate-500 transition hover:text-slate-700 disabled:cursor-not-allowed disabled:text-gray-300 disabled:opacity-50"
                              title="Edit"
                            >
                              <Edit className="pointer-events-none h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onPrev}
          disabled={!canPrev || (!hasRecords && !loading)}
        >
          Prev
        </button>

        <div className="text-sm text-gray-500">
          Page {safePage} of {safeTotalPages}
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={onNext}
          disabled={!canNext || (!hasRecords && !loading)}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default AdminDtrTable;