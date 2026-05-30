import { CalendarDays, Clock3, Edit, Eye } from 'lucide-react';
import type { StatusBadgeMap } from '../../../types/attendance';

export interface AttendanceRow {
    id: number;
    date: string;
    timeIn: string;
    timeOut: string;
    status: string;
    isOT: boolean;
    isUndertime: boolean;
    overtimeStatus?: 'None' | 'Pending' | 'Approved';
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
}

interface UserDtrTableProps {
    loadingDtr: boolean;
    myAttendance: AttendanceRow[];
    statusBadge: StatusBadgeMap;
    page: number;
    totalPages: number;
    onPrev: () => void;
    onNext: () => void;
    onView: (row: AttendanceRow) => void;
    onEdit: (row: AttendanceRow) => void;
    recentlyEditedRowId: number | null;
}

const DEFAULT_PAGE_SIZE = 10;

const formatAttendanceDate = (value: string) => {
    if (!value || value === '--') return '--';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    }).format(date);
};

const formatMinutes = (minutes?: number) => {
    if (!minutes || minutes <= 0) return '--';

    const total = Math.round(minutes);
    const hours = Math.floor(total / 60);
    const mins = total % 60;

    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;

    return `${hours}h ${mins}m`;
};

const createPlaceholderRow = (id: number): AttendanceRow => ({
    id,
    date: '--',
    timeIn: '--:-- --',
    timeOut: '--:-- --',
    status: 'Present',
    isOT: false,
    isUndertime: false,
    overtimeStatus: 'None',
    hours: '--',
    renderedMinutes: 0,
    creditedMinutes: 0,
    excessMinutes: 0,
    hasExceededApprovedOvertime: false,
    lateMinutes: 0,
    undertimeMinutes: 0,
    overtimeMinutes: 0,
    task: '',
    accomplished: '',
});

const hasActualTimeOut = (value: string | null | undefined) => {
    if (value == null) return false;

    const normalized = value.trim();

    return (
        normalized !== '' &&
        normalized !== '-' &&
        normalized !== '—' &&
        normalized !== '--' &&
        normalized !== '--:-- --'
    );
};

const formatTimeDisplay = (value: string | null | undefined) => {
    if (!value) return '--:-- --';

    const normalized = value.trim();

    if (
        normalized === '' ||
        normalized === '-' ||
        normalized === '—' ||
        normalized === '--' ||
        normalized === '--:-- --'
    ) {
        return '--:-- --';
    }

    return normalized;
};

const normalizeOvertimeStatus = (value?: string | null): 'None' | 'Pending' | 'Approved' => {
    const normalized = value?.trim().toLowerCase();

    if (normalized === 'approved') return 'Approved';
    if (normalized === 'pending') return 'Pending';

    return 'None';
};

const UserDtrTable = ({
    loadingDtr,
    myAttendance,
    statusBadge,
    page,
    totalPages,
    onPrev,
    onNext,
    onView,
    onEdit,
    recentlyEditedRowId,
}: UserDtrTableProps) => {
    const safePage = Math.max(1, page || 1);
    const safeTotalPages = Math.max(1, totalPages || 1);
    const canPrev = safePage > 1 && !loadingDtr;
    const canNext = safePage < safeTotalPages && !loadingDtr;
    const hasRecords = myAttendance.length > 0;

    const dataRows = hasRecords
        ? [
              ...myAttendance,
              ...Array.from(
                  { length: Math.max(0, DEFAULT_PAGE_SIZE - myAttendance.length) },
                  (_, i) => createPlaceholderRow(-(i + 1))
              ),
          ]
        : Array.from({ length: DEFAULT_PAGE_SIZE }, (_, i) => createPlaceholderRow(-(i + 1)));

    return (
        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-100">
            <div className="overflow-x-auto">
                <table className="pro-table min-w-full">
                    <thead>
                        <tr>
                            <th>DATE</th>
                            <th>TIME IN</th>
                            <th>TIME OUT</th>
                            <th>TOTAL HOURS</th>
                            <th>STATUS</th>
                            <th className="text-center">ACTIONS</th>
                        </tr>
                    </thead>

                    <tbody>
                        {loadingDtr ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-10 text-center text-sm italic text-gray-500">
                                    Loading attendance records...
                                </td>
                            </tr>
                        ) : (
                            <>
                                {!hasRecords && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-10 text-center text-sm font-medium text-gray-600">
                                            No attendance records found.
                                        </td>
                                    </tr>
                                )}

                                {dataRows.map((row, index) => {
                                    const isPlaceholder = row.id < 0;
                                    const isAbsent = row.status === 'Absent';
                                    const isIncomplete = row.status === 'Incomplete';
                                    const isTimedOut = hasActualTimeOut(row.timeOut);
                                    const formattedDate = formatAttendanceDate(row.date);
                                    const formattedTimeIn = formatTimeDisplay(row.timeIn);
                                    const formattedTimeOut = formatTimeDisplay(row.timeOut);
                                    const formattedTotal = formatMinutes(row.renderedMinutes);
                                    const formattedCredited = formatMinutes(row.creditedMinutes ?? row.renderedMinutes);
                                    const hasExceededApprovedOvertime = Boolean(row.hasExceededApprovedOvertime);
                                    const overtimeStatus = normalizeOvertimeStatus(row.overtimeStatus);
                                    const hasApprovedOT = overtimeStatus === 'Approved';
                                    const hasPendingOT = overtimeStatus === 'Pending';
                                    const canView = !isPlaceholder && !isAbsent;
                                    const canEdit = !isPlaceholder && !isAbsent && !isTimedOut;

                                    const rowKey = isPlaceholder
                                        ? `placeholder-${index}`
                                        : `log-${row.id}-${row.date}-${index}`;

                                    return (
                                        <tr
                                            key={rowKey}
                                            className={`
                                                transition-all duration-500
                                                ${
                                                    !isPlaceholder && recentlyEditedRowId === row.id
                                                        ? 'bg-green-50 animate-[pulseRow_3s_ease-in-out_1]'
                                                        : 'hover:bg-gray-50'
                                                }
                                            `}
                                        >
                                            <td className={`px-6 py-4 whitespace-nowrap font-medium ${isPlaceholder ? 'text-gray-300' : 'text-slate-700'}`}>
                                                <div className="flex min-h-8 items-center gap-2">
                                                    <CalendarDays className={`h-4 w-4 shrink-0 ${isPlaceholder ? 'text-gray-300' : 'text-slate-400'}`} />
                                                    <span>{formattedDate}</span>
                                                </div>
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`font-mono text-sm font-semibold ${isPlaceholder ? 'text-gray-300' : 'text-slate-600'}`}>
                                                    {isPlaceholder ? '--:-- --' : formattedTimeIn}
                                                </span>
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`font-mono text-sm font-semibold ${isPlaceholder ? 'text-gray-300' : 'text-slate-600'}`}>
                                                    {isPlaceholder ? '--:-- --' : formattedTimeOut}
                                                </span>
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <Clock3 className={`h-4 w-4 ${isPlaceholder ? 'text-gray-300' : 'text-slate-400'}`} />

                                                    <span className={`font-mono text-sm font-semibold ${isPlaceholder ? 'text-gray-300' : 'text-slate-700'}`}>
                                                        {isPlaceholder ? '--' : formattedTotal}
                                                    </span>

                                                    {!isPlaceholder && hasExceededApprovedOvertime && (
                                                        <span className="text-[11px] font-semibold text-slate-400">
                                                            Credited: {formattedCredited}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="px-6 py-4">
                                                {isPlaceholder ? (
                                                    <span className="text-gray-300">--</span>
                                                ) : (
                                                    <div className="flex flex-wrap gap-2">
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

                                                        {hasPendingOT && !isIncomplete && (
                                                            <span className="badge badge-warning">
                                                                <span className="badge-dot" />
                                                                Pending OT
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>

                                            <td className="px-6 py-4">
                                                <div className="flex justify-center gap-5">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (canView) onView(row);
                                                        }}
                                                        disabled={!canView}
                                                        aria-label="View attendance record"
                                                        title="View attendance record"
                                                        className="text-slate-500 hover:text-slate-700 disabled:cursor-not-allowed disabled:text-gray-300 disabled:opacity-50"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </button>

                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (canEdit) onEdit(row);
                                                        }}
                                                        disabled={!canEdit}
                                                        aria-label="Edit attendance record"
                                                        title="Edit attendance record"
                                                        className="text-slate-500 hover:text-slate-700 disabled:cursor-not-allowed disabled:text-gray-300 disabled:opacity-50"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </button>
                                                </div>
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
                <button className="btn btn-secondary" onClick={onPrev} disabled={!canPrev}>
                    Prev
                </button>

                <div className="text-sm text-gray-500">
                    Page {safePage} of {safeTotalPages}
                </div>

                <button className="btn btn-secondary" onClick={onNext} disabled={!canNext}>
                    Next
                </button>
            </div>
        </div>
    );
};

export default UserDtrTable;