import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { ShiftDay } from '../../../lib/attendance';

type ShiftDayField = 'isWorkingDay' | 'startTime' | 'breakStartTime' | 'breakEndTime' | 'endTime';
type ShiftDayValue = boolean | string | null;

type Props = {
    open: boolean;
    days: ShiftDay[];
    name: string;
    graceMinutes: string;
    isActive: boolean;
    saving: boolean;
    error: string | null;
    onClose: () => void;
    onNameChange: (value: string) => void;
    onGraceMinutesChange: (value: string) => void;
    onIsActiveChange: (value: boolean) => void;
    onChangeDay: (dayId: number, field: ShiftDayField, value: ShiftDayValue) => void;
    onSave: () => void;
};

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const toTimeInputValue = (value?: string | null) => {
    if (!value) return '';
    return value.slice(0, 5);
};

const toMinutes = (value?: string | null) => {
    const normalizedValue = toTimeInputValue(value);

    if (!normalizedValue) return null;

    const [hoursRaw, minutesRaw] = normalizedValue.split(':');
    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw);

    if (
        Number.isNaN(hours) ||
        Number.isNaN(minutes) ||
        hours < 0 ||
        hours > 23 ||
        minutes < 0 ||
        minutes > 59
    ) {
        return null;
    }

    return hours * 60 + minutes;
};

const formatDayLabel = (dayOfWeek: number) => DAY_LABELS[dayOfWeek] ?? 'Selected day';

const normalizeTimeWithinShift = (
    valueMinutes: number,
    shiftStartMinutes: number,
    normalizedShiftEndMinutes: number
) => {
    const sameDayValue = valueMinutes;
    const nextDayValue = valueMinutes + 1440;

    if (sameDayValue > shiftStartMinutes && sameDayValue < normalizedShiftEndMinutes) {
        return sameDayValue;
    }

    if (nextDayValue > shiftStartMinutes && nextDayValue < normalizedShiftEndMinutes) {
        return nextDayValue;
    }

    return null;
};

const normalizeTimeAfterWithinShift = (
    valueMinutes: number,
    afterMinutes: number,
    normalizedShiftEndMinutes: number
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

const validateShift = (name: string, graceMinutes: string, days: ShiftDay[]) => {
    const trimmedName = name.trim();

    if (!trimmedName) {
        return 'Shift name is required.';
    }

    if (trimmedName.length < 3) {
        return 'Shift name must be at least 3 characters.';
    }

    const normalizedGraceMinutes = graceMinutes.trim();

    if (normalizedGraceMinutes === '') {
        return 'Grace period is required.';
    }

    const graceValue = Number(normalizedGraceMinutes);

    if (!Number.isInteger(graceValue) || graceValue < 0) {
        return 'Grace period must be a valid whole number.';
    }

    const workingDays = days.filter((day) => day.isWorkingDay);

    if (workingDays.length === 0) {
        return 'At least one working day is required.';
    }

    for (const day of workingDays) {
        const dayLabel = formatDayLabel(day.dayOfWeek);

        const startMinutes = toMinutes(day.startTime);
        const breakStartMinutes = toMinutes(day.breakStartTime);
        const breakEndMinutes = toMinutes(day.breakEndTime);
        const endMinutes = toMinutes(day.endTime);

        if (startMinutes === null) {
            return `${dayLabel}: Start time is required.`;
        }

        if (endMinutes === null) {
            return `${dayLabel}: End time is required.`;
        }

        if (startMinutes === endMinutes) {
            return `${dayLabel}: Start time and end time cannot be the same.`;
        }

        const normalizedEndMinutes = endMinutes <= startMinutes ? endMinutes + 1440 : endMinutes;
        const hasBreakStart = breakStartMinutes !== null;
        const hasBreakEnd = breakEndMinutes !== null;

        if (hasBreakStart !== hasBreakEnd) {
            return `${dayLabel}: Break start and break end must both be provided.`;
        }

        let breakDuration = 0;

        if (hasBreakStart && hasBreakEnd && breakStartMinutes !== null && breakEndMinutes !== null) {
            const normalizedBreakStartMinutes = normalizeTimeWithinShift(
                breakStartMinutes,
                startMinutes,
                normalizedEndMinutes
            );

            if (normalizedBreakStartMinutes === null) {
                return `${dayLabel}: Break start must be within shift hours.`;
            }

            const normalizedBreakEndMinutes = normalizeTimeAfterWithinShift(
                breakEndMinutes,
                normalizedBreakStartMinutes,
                normalizedEndMinutes
            );

            if (normalizedBreakEndMinutes === null) {
                return `${dayLabel}: Break end must be after break start and before end time.`;
            }

            breakDuration = normalizedBreakEndMinutes - normalizedBreakStartMinutes;
        }

        const workingDuration = normalizedEndMinutes - startMinutes - breakDuration;

        if (workingDuration < 60) {
            return `${dayLabel}: Working duration must be at least 1 hour.`;
        }
    }

    return null;
};

const AddShiftModal = ({
    open,
    days,
    name,
    graceMinutes,
    isActive,
    saving,
    error,
    onClose,
    onNameChange,
    onGraceMinutesChange,
    onIsActiveChange,
    onChangeDay,
    onSave,
}: Props) => {
    const [validationError, setValidationError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [open]);

    if (!open) return null;

    const sortedDays = days.slice().sort((a, b) => a.dayOfWeek - b.dayOfWeek);
    const displayError = validationError ?? error;

    const handleClose = () => {
        setValidationError(null);
        onClose();
    };

    const handleWorkingDayToggle = (day: ShiftDay) => {
        setValidationError(null);

        const nextIsWorkingDay = !day.isWorkingDay;

        onChangeDay(day.id, 'isWorkingDay', nextIsWorkingDay);

        if (!nextIsWorkingDay) {
            onChangeDay(day.id, 'startTime', null);
            onChangeDay(day.id, 'breakStartTime', null);
            onChangeDay(day.id, 'breakEndTime', null);
            onChangeDay(day.id, 'endTime', null);
        }
    };

    const handleTimeChange = (day: ShiftDay, field: ShiftDayField, value: string) => {
        if (!day.isWorkingDay) return;

        setValidationError(null);

        const nextValue = value || null;

        if (field === 'startTime') {
            onChangeDay(day.id, 'startTime', nextValue);

            if (!nextValue) {
                onChangeDay(day.id, 'breakStartTime', null);
                onChangeDay(day.id, 'breakEndTime', null);
                onChangeDay(day.id, 'endTime', null);
            }

            return;
        }

        if (field === 'breakStartTime') {
            onChangeDay(day.id, 'breakStartTime', nextValue);

            if (!nextValue) {
                onChangeDay(day.id, 'breakEndTime', null);
            }

            return;
        }

        if (field === 'breakEndTime') {
            onChangeDay(day.id, 'breakEndTime', nextValue);
            return;
        }

        if (field === 'endTime') {
            onChangeDay(day.id, 'endTime', nextValue);
        }
    };

    const handleSave = () => {
        const validationMessage = validateShift(name, graceMinutes, days);

        if (validationMessage) {
            setValidationError(validationMessage);
            return;
        }

        setValidationError(null);
        onSave();
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/55 px-6 py-6 backdrop-blur-sm">
            <div className="flex max-h-[92vh] w-full max-w-[980px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Add Shift</h2>
                        <p className="mt-1 text-sm font-medium text-slate-500">
                            Create shift details and working-day schedule. This becomes the basis for DTR rules.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={handleClose}
                        className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Close add shift modal"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5">
                    <div className="grid gap-4 md:grid-cols-[1fr_170px_170px]">
                        <div>
                            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
                                Shift Name
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(event) => {
                                    setValidationError(null);
                                    onNameChange(event.target.value);
                                }}
                                className="pro-input w-full"
                                placeholder="Enter shift name"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
                                Grace Period
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={graceMinutes}
                                onChange={(event) => {
                                    setValidationError(null);
                                    onGraceMinutesChange(event.target.value);
                                }}
                                className="pro-input w-full"
                                placeholder="0"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">
                                Status
                            </label>
                            <button
                                type="button"
                                onClick={() => {
                                    setValidationError(null);
                                    onIsActiveChange(!isActive);
                                }}
                                className={`flex h-[42px] w-full items-center justify-center gap-2 rounded-xl border text-sm font-bold transition ${
                                    isActive
                                        ? 'border-green-100 bg-green-50 text-green-700 hover:bg-green-100'
                                        : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100'
                                }`}
                            >
                                <span
                                    className={`h-2 w-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-slate-400'}`}
                                />
                                {isActive ? 'Active' : 'Inactive'}
                            </button>
                        </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-gray-100 bg-slate-50 px-4 py-3 text-xs font-medium text-slate-500">
                        Inactive shifts remain in records but should not be used for new assignments.
                    </div>

                    <div className="mt-5 overflow-hidden rounded-xl border border-gray-100">
                        <div className="grid grid-cols-[110px_130px_repeat(4,minmax(120px,1fr))] bg-emerald-700 text-xs font-bold uppercase tracking-wide text-white">
                            <div className="px-4 py-3">Day</div>
                            <div className="px-4 py-3">Working Day</div>
                            <div className="px-4 py-3">Start</div>
                            <div className="px-4 py-3">Break Start</div>
                            <div className="px-4 py-3">Break End</div>
                            <div className="px-4 py-3">End</div>
                        </div>

                        <div className="max-h-[360px] overflow-y-auto">
                            {sortedDays.map((day) => {
                                const startValue = toTimeInputValue(day.startTime);
                                const breakStartValue = toTimeInputValue(day.breakStartTime);
                                const breakEndValue = toTimeInputValue(day.breakEndTime);
                                const endValue = toTimeInputValue(day.endTime);

                                return (
                                    <div
                                        key={day.id}
                                        className={`grid grid-cols-[110px_130px_repeat(4,minmax(120px,1fr))] items-center border-b border-gray-100 text-sm last:border-b-0 ${
                                            day.isWorkingDay ? 'bg-white' : 'bg-slate-50'
                                        }`}
                                    >
                                        <div className="px-4 py-3 font-semibold text-gray-800">
                                            {DAY_LABELS[day.dayOfWeek] ?? '--'}
                                        </div>

                                        <div className="px-4 py-3">
                                            <button
                                                type="button"
                                                onClick={() => handleWorkingDayToggle(day)}
                                                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold transition ${
                                                    day.isWorkingDay
                                                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                }`}
                                            >
                                                <span
                                                    className={`h-2 w-2 rounded-full ${
                                                        day.isWorkingDay ? 'bg-green-500' : 'bg-slate-400'
                                                    }`}
                                                />
                                                {day.isWorkingDay ? 'Working' : 'Rest Day'}
                                            </button>
                                        </div>

                                        <div className="px-3 py-2">
                                            <input
                                                type="time"
                                                value={startValue}
                                                disabled={!day.isWorkingDay}
                                                onChange={(event) =>
                                                    handleTimeChange(day, 'startTime', event.target.value)
                                                }
                                                className="pro-input h-10 w-full disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                                            />
                                        </div>

                                        <div className="px-3 py-2">
                                            <input
                                                type="time"
                                                value={breakStartValue}
                                                disabled={!day.isWorkingDay || !startValue || !endValue}
                                                onChange={(event) =>
                                                    handleTimeChange(day, 'breakStartTime', event.target.value)
                                                }
                                                className="pro-input h-10 w-full disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                                            />
                                        </div>

                                        <div className="px-3 py-2">
                                            <input
                                                type="time"
                                                value={breakEndValue}
                                                disabled={!day.isWorkingDay || !breakStartValue || !endValue}
                                                onChange={(event) =>
                                                    handleTimeChange(day, 'breakEndTime', event.target.value)
                                                }
                                                className="pro-input h-10 w-full disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                                            />
                                        </div>

                                        <div className="px-3 py-2">
                                            <input
                                                type="time"
                                                value={endValue}
                                                disabled={!day.isWorkingDay || !startValue}
                                                onChange={(event) =>
                                                    handleTimeChange(day, 'endTime', event.target.value)
                                                }
                                                className="pro-input h-10 w-full disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {displayError && (
                        <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                            {displayError}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-white px-6 py-4">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={saving}
                        className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="btn btn-primary h-[42px] min-w-[140px] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        {saving ? 'Creating...' : 'Add Shift'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default AddShiftModal;