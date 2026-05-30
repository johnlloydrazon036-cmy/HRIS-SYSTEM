import {
    AlertCircle,
    CalendarDays,
    CheckCircle2,
    Clock3,
    Eye,
    UserMinus,
    UserPlus,
} from 'lucide-react';
import type { EmployeeShiftAssignmentDto } from '../../../lib/attendance';

export type ShiftAssignmentTableRow = EmployeeShiftAssignmentDto & {
    shiftName: string;
};

type Props = {
    assignments: ShiftAssignmentTableRow[];
    loading: boolean;
    page: number;
    totalPages: number;
    assignmentMessage: string | null;
    assignmentError: string | null;
    unassigningId: number | null;
    recentlyUpdatedEmployeeId?: string | null;
    formatDate: (value?: string | null) => string;
    formatEmployeeName: (value?: string | null) => string;
    getAvatarInitial: (value?: string | null) => string;
    onPrev: () => void;
    onNext: () => void;
    onViewEmployeeLogs: (assignment: ShiftAssignmentTableRow) => void;
    onUnassign: (assignment: ShiftAssignmentTableRow) => void;
    onAssignShift: () => void;
};

const todayDateOnly = () => {
    const now = new Date();

    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const parseDateOnly = (value?: string | null) => {
    if (!value) return null;

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) return null;

    return date;
};

const getAssignmentState = (assignment: ShiftAssignmentTableRow) => {
    if (assignment.id <= 0) {
        return {
            label: '--',
            className: 'border-slate-100 bg-slate-50 text-slate-300',
            icon: AlertCircle,
            isOperational: false,
        };
    }

    const effectiveFrom = parseDateOnly(assignment.effectiveFrom);
    const today = todayDateOnly();

    if (effectiveFrom && effectiveFrom > today) {
        return {
            label: 'Upcoming',
            className: 'border-blue-200 bg-blue-50 text-blue-700',
            icon: Clock3,
            isOperational: true,
        };
    }

    if (!assignment.isActive || assignment.effectiveTo) {
        return {
            label: 'Inactive',
            className: 'border-slate-200 bg-slate-50 text-slate-500',
            icon: AlertCircle,
            isOperational: false,
        };
    }

    return {
        label: 'Active',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        icon: CheckCircle2,
        isOperational: true,
    };
};

const ShiftAssignmentsTable = ({
    assignments,
    loading,
    page,
    totalPages,
    assignmentMessage,
    assignmentError,
    unassigningId,
    recentlyUpdatedEmployeeId,
    formatDate,
    formatEmployeeName,
    getAvatarInitial,
    onPrev,
    onNext,
    onViewEmployeeLogs,
    onUnassign,
    onAssignShift,
}: Props) => {
    return (
        <section className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                        <UserPlus className="h-5 w-5" />
                    </div>

                    <div>
                        <h3 className="text-xl font-bold text-slate-800">
                            Shift Assignments
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                            Assign employees to active shifts for DTR eligibility.
                        </p>
                    </div>
                </div>

                <button onClick={onAssignShift} className="btn btn-primary">
                    <UserPlus className="h-4 w-4" /> Assign / Reassign Shift
                </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="pro-table w-full">
                    <thead>
                        <tr>
                            {[
                                'Employee ID',
                                'Employee',
                                'Department',
                                'Position',
                                'Shift',
                                'Effective From',
                                'Actions',
                            ].map((header) => (
                                <th key={header}>{header}</th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                        {loading ? (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="px-6 py-10 text-center text-sm italic text-gray-500"
                                >
                                    Loading shift assignments...
                                </td>
                            </tr>
                        ) : assignments.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="px-6 py-10 text-center text-sm font-medium text-gray-600"
                                >
                                    No shift assignments found.
                                </td>
                            </tr>
                        ) : (
                            assignments.map((assignment) => {
                                const isPlaceholder = assignment.id <= 0;
                                const employeeName = formatEmployeeName(assignment.fullName);
                                const assignmentState = getAssignmentState(assignment);
                                const AssignmentStateIcon = assignmentState.icon;
                                const isRecentlyUpdated =
                                    !isPlaceholder &&
                                    !!recentlyUpdatedEmployeeId &&
                                    assignment.employeeId === recentlyUpdatedEmployeeId;

                                const rowClassName = isPlaceholder
                                    ? undefined
                                    : isRecentlyUpdated
                                      ? 'bg-emerald-100/70 shadow-[inset_4px_0_0_#10b981] transition-colors'
                                      : assignmentState.isOperational
                                        ? 'bg-emerald-50/20'
                                        : undefined;

                                return (
                                    <tr
                                        key={`${assignment.id}-${assignment.employeeId || 'placeholder'}`}
                                        className={rowClassName}
                                    >
                                        <td
                                            className={`px-6 py-4 font-mono text-xs ${
                                                isPlaceholder ? 'text-gray-300' : 'text-gray-700'
                                            }`}
                                        >
                                            {assignment.employeeNumber ?? '--'}
                                        </td>

                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <span
                                                    className={
                                                        isPlaceholder
                                                            ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-bold text-gray-300'
                                                            : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-xs font-bold text-white'
                                                    }
                                                >
                                                    {isPlaceholder ? '--' : getAvatarInitial(assignment.fullName)}
                                                </span>

                                                <div className="flex min-w-0 flex-col">
                                                    <span
                                                        className={
                                                            isPlaceholder
                                                                ? 'font-medium text-gray-300'
                                                                : 'font-medium text-gray-800'
                                                        }
                                                    >
                                                        {employeeName}
                                                    </span>

                                                    {!isPlaceholder && (
                                                        <>
                                                            <span
                                                                className={`mt-1 inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${assignmentState.className}`}
                                                            >
                                                                <AssignmentStateIcon className="h-3 w-3" />
                                                                {assignmentState.label}
                                                            </span>

                                                            {assignmentState.label === 'Upcoming' && assignment.effectiveFrom && (
                                                                <span className="mt-1 text-[11px] font-bold text-blue-700">
                                                                    Starts in{' '}
                                                                    {Math.max(
                                                                        1,
                                                                        Math.ceil(
                                                                            ((parseDateOnly(assignment.effectiveFrom)?.getTime() ?? 0) -
                                                                                todayDateOnly().getTime()) /
                                                                                86_400_000
                                                                        )
                                                                    )}{' '}
                                                                    day
                                                                    {Math.max(
                                                                        1,
                                                                        Math.ceil(
                                                                            ((parseDateOnly(assignment.effectiveFrom)?.getTime() ?? 0) -
                                                                                todayDateOnly().getTime()) /
                                                                                86_400_000
                                                                        )
                                                                    ) === 1
                                                                        ? ''
                                                                        : 's'}
                                                                </span>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        <td>{assignment.department || '--'}</td>
                                        <td>{assignment.position || '--'}</td>

                                        <td className="whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <Clock3
                                                    className={`h-4 w-4 shrink-0 ${
                                                        isPlaceholder ? 'text-gray-300' : 'text-slate-400'
                                                    }`}
                                                />

                                                <span
                                                    className={
                                                        isPlaceholder
                                                            ? 'text-gray-300'
                                                            : 'font-medium text-slate-700'
                                                    }
                                                >
                                                    {assignment.shiftName || '--'}
                                                </span>
                                            </div>
                                        </td>

                                        <td className="whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <CalendarDays
                                                    className={`h-4 w-4 shrink-0 ${
                                                        isPlaceholder ? 'text-gray-300' : 'text-slate-400'
                                                    }`}
                                                />

                                                <span>{isPlaceholder ? '--' : formatDate(assignment.effectiveFrom)}</span>
                                            </div>
                                        </td>

                                        <td>
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    type="button"
                                                    disabled={isPlaceholder}
                                                    onClick={() => onViewEmployeeLogs(assignment)}
                                                    className="btn-ghost btn-icon text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
                                                    title="View Employee Logs"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </button>

                                                <button
                                                    type="button"
                                                    disabled={isPlaceholder || unassigningId === assignment.id}
                                                    onClick={() => onUnassign(assignment)}
                                                    className="btn-ghost btn-icon text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
                                                    title="Unassign Employee"
                                                >
                                                    <UserMinus className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-between px-3">
                <button
                    type="button"
                    onClick={onPrev}
                    disabled={page <= 1}
                    className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Prev
                </button>

                <span className="text-sm font-medium text-slate-500">
                    Page {page} of {totalPages}
                </span>

                <button
                    type="button"
                    onClick={onNext}
                    disabled={page >= totalPages}
                    className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Next
                </button>
            </div>

            {assignmentMessage && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                    {assignmentMessage}
                </div>
            )}

            {assignmentError && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {assignmentError}
                </div>
            )}
        </section>
    );
};

export default ShiftAssignmentsTable;