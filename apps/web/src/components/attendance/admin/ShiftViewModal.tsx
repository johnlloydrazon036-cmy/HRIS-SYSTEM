import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { Shift, ShiftDay } from '../../../lib/attendance';

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const cloneDays = (days: ShiftDay[]) =>
    days
        .map((day) => ({ ...day }))
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek);

type Props = {
    shift: Shift | null;
    formatTime: (value?: string | null) => string;
    getWorkingDaysLabel: (days: ShiftDay[]) => string;
    onClose: () => void;
};

const ShiftViewModal = ({ shift, formatTime, getWorkingDaysLabel, onClose }: Props) => {
    if (!shift) return null;

    const firstWorkingDay = cloneDays(shift.days).find((day) => day.isWorkingDay);
    const start = formatTime(firstWorkingDay?.startTime);
    const end = formatTime(firstWorkingDay?.endTime);

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-sm">
            <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">{shift.name}</h3>
                        <p className="mt-1 text-sm font-medium text-slate-500">
                            {getWorkingDaysLabel(shift.days)} • {start} - {end}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="max-h-[65vh] space-y-3 overflow-y-auto px-6 py-5">
                    {cloneDays(shift.days).map((day) => (
                        <div
                            key={day.id}
                            className={`rounded-2xl border px-4 py-3 ${
                                day.isWorkingDay
                                    ? 'border-emerald-100 bg-emerald-50/40'
                                    : 'border-slate-100 bg-slate-50'
                            }`}
                        >
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div className="flex min-w-[170px] items-center gap-3">
                                    <span
                                        className={`flex h-10 w-10 items-center justify-center rounded-xl text-xs font-bold ${
                                            day.isWorkingDay
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-slate-200 text-slate-500'
                                        }`}
                                    >
                                        {DAY_LABELS[day.dayOfWeek]?.slice(0, 3)}
                                    </span>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">
                                            {DAY_LABELS[day.dayOfWeek]}
                                        </p>
                                        <span
                                            className={`mt-1 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${
                                                day.isWorkingDay
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : 'bg-slate-200 text-slate-500'
                                            }`}
                                        >
                                            {day.isWorkingDay ? 'Working' : 'Rest Day'}
                                        </span>
                                    </div>
                                </div>

                                {day.isWorkingDay ? (
                                    <div className="grid flex-1 grid-cols-2 gap-3 text-sm font-semibold text-slate-600 md:grid-cols-4">
                                        <div>
                                            <span className="block text-xs font-bold uppercase text-slate-400">
                                                Start
                                            </span>
                                            {formatTime(day.startTime)}
                                        </div>
                                        <div>
                                            <span className="block text-xs font-bold uppercase text-slate-400">
                                                Break Start
                                            </span>
                                            {formatTime(day.breakStartTime)}
                                        </div>
                                        <div>
                                            <span className="block text-xs font-bold uppercase text-slate-400">
                                                Break End
                                            </span>
                                            {formatTime(day.breakEndTime)}
                                        </div>
                                        <div>
                                            <span className="block text-xs font-bold uppercase text-slate-400">
                                                End
                                            </span>
                                            {formatTime(day.endTime)}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-400">
                                        No scheduled work hours
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ShiftViewModal;
