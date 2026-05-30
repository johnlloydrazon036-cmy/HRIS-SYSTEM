import { CalendarClock, Edit, Eye, Moon, Plus, Sun, Users } from 'lucide-react';
import type { Shift } from '../../../lib/attendance';
import type { AdminShiftRecord, StatusBadgeMap } from '../../../types/attendance';

type Props = {
    shifts: AdminShiftRecord[];
    apiShifts: Shift[];
    loading: boolean;
    selectedShiftId?: number | null;
    statusBadge: StatusBadgeMap;
    onViewShift: (shift: AdminShiftRecord) => void;
    onEditShift: (shift: AdminShiftRecord) => void;
    onAddShift: () => void;
    getWorkingDaysLabel: (days: Shift['days']) => string;
};

const toMinutes = (value?: string | null) => {
    if (!value) return null;

    const [hourRaw, minuteRaw] = value.split(':');
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);

    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;

    return hour * 60 + minute;
};

const getWorkingDaysCount = (days: Shift['days']) => {
    return days.filter((day) => day.isWorkingDay).length;
};

const isOvernightShift = (days: Shift['days']) => {
    return days.some((day) => {
        if (!day.isWorkingDay) return false;

        const startMinutes = toMinutes(day.startTime);
        const endMinutes = toMinutes(day.endTime);

        if (startMinutes === null || endMinutes === null) return false;

        return endMinutes <= startMinutes;
    });
};

const getShiftTypeMeta = (days: Shift['days']) => {
    const workingDaysCount = getWorkingDaysCount(days);

    if (workingDaysCount === 0) {
        return {
            label: 'Rest Day Only',
            className: 'border-slate-200 bg-slate-50 text-slate-500',
            icon: Sun,
        };
    }

    if (isOvernightShift(days)) {
        return {
            label: 'Overnight',
            className: 'border-indigo-200 bg-indigo-50 text-indigo-700',
            icon: Moon,
        };
    }

    return {
        label: 'Day Shift',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        icon: Sun,
    };
};

const ShiftTable = ({
    shifts,
    apiShifts,
    loading,
    selectedShiftId,
    statusBadge,
    onViewShift,
    onEditShift,
    onAddShift,
    getWorkingDaysLabel,
}: Props) => {
    return (
        <section className="space-y-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                        <CalendarClock className="h-5 w-5" />
                    </div>

                    <div>
                        <h3 className="text-xl font-bold text-slate-800">
                            Shift Schedules
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                            Manage available work schedules used by employee assignments.
                        </p>
                    </div>
                </div>

                <button onClick={onAddShift} className="btn btn-primary">
                    <Plus className="h-4 w-4" /> Add Shift
                </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="pro-table w-full">
                    <thead>
                        <tr>
                            {[
                                'Shift Name',
                                'Time In',
                                'Time Out',
                                'Grace Period',
                                'Assigned',
                                'Status',
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
                                    Loading shifts...
                                </td>
                            </tr>
                        ) : shifts.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="px-6 py-10 text-center text-sm font-medium text-gray-600"
                                >
                                    No shift schedules found.
                                </td>
                            </tr>
                        ) : (
                            shifts.map((shift) => {
                                const isSelected = selectedShiftId === shift.id;
                                const isInactive = shift.status?.toLowerCase() === 'inactive';
                                const fullShift = apiShifts.find((apiShift) => apiShift.id === shift.id);
                                const days = fullShift?.days ?? [];
                                const workingDaysLabel = getWorkingDaysLabel(days);
                                const workingDaysCount = getWorkingDaysCount(days);
                                const shiftTypeMeta = getShiftTypeMeta(days);
                                const ShiftTypeIcon = shiftTypeMeta.icon;

                                return (
                                    <tr
                                        key={shift.id}
                                        className={[
                                            isSelected ? 'bg-emerald-50/40' : '',
                                            isInactive ? 'opacity-70' : '',
                                        ]
                                            .filter(Boolean)
                                            .join(' ')}
                                    >
                                        <td className="!font-medium !text-gray-800">
                                            <div className="flex items-start gap-3">
                                                <span
                                                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                                        isInactive
                                                            ? 'bg-slate-100 text-slate-400'
                                                            : 'bg-emerald-50 text-emerald-600'
                                                    }`}
                                                >
                                                    <CalendarClock className="h-4 w-4" />
                                                </span>

                                                <div className="flex min-w-0 flex-col">
                                                    <span>{shift.name}</span>

                                                    {apiShifts.length > 0 && (
                                                        <span className="mt-1 text-xs font-normal text-slate-400">
                                                            {workingDaysLabel}
                                                        </span>
                                                    )}

                                                    {apiShifts.length > 0 && (
                                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                                            <span
                                                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${shiftTypeMeta.className}`}
                                                            >
                                                                <ShiftTypeIcon className="h-3 w-3" />
                                                                {shiftTypeMeta.label}
                                                            </span>

                                                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-500">
                                                                {workingDaysCount} working day
                                                                {workingDaysCount === 1 ? '' : 's'}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        <td>{shift.timeIn}</td>
                                        <td>{shift.timeOut}</td>
                                        <td>{shift.grace}</td>

                                        <td className="whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <Users
                                                    className={`h-4 w-4 shrink-0 ${
                                                        Number(shift.employees) > 0
                                                            ? 'text-emerald-500'
                                                            : 'text-slate-400'
                                                    }`}
                                                />
                                                <span
                                                    className={
                                                        Number(shift.employees) > 0
                                                            ? 'font-bold text-slate-700'
                                                            : 'text-slate-500'
                                                    }
                                                >
                                                    {shift.employees}
                                                </span>
                                            </div>
                                        </td>

                                        <td>
                                            <span className={`badge ${statusBadge[shift.status]}`}>
                                                <span className="badge-dot" />
                                                {shift.status}
                                            </span>
                                        </td>

                                        <td>
                                            <div className="flex items-center justify-center gap-5">
                                                <button
                                                    type="button"
                                                    onClick={() => onViewShift(shift)}
                                                    className="inline-flex cursor-pointer items-center justify-center text-slate-500 transition hover:text-slate-700"
                                                    title="View Shift"
                                                >
                                                    <Eye className="pointer-events-none h-4 w-4" />
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => onEditShift(shift)}
                                                    className="inline-flex cursor-pointer items-center justify-center text-slate-500 transition hover:text-slate-700"
                                                    title="Edit Shift"
                                                >
                                                    <Edit className="pointer-events-none h-4 w-4" />
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
        </section>
    );
};

export default ShiftTable;