import { useMemo, useState } from 'react';
import {
    AlertCircle,
    CalendarDays,
    CheckCircle2,
    Clock,
    X,
} from 'lucide-react';
import { createPortal } from 'react-dom';

type SubmitOvertimePayload = {
    dateFrom: string;
    dateTo: string;
    requestedMinutes: number;
    reason: string;
};

type OvertimeRequestShiftDay = {
    dayOfWeek: number;
    isWorkingDay: boolean;
};

type OvertimeRequestModalProps = {
    isOpen: boolean;
    submittingOt: boolean;
    errorMessage?: string | null;
    onClose: () => void;
    onSubmit: (payload: SubmitOvertimePayload) => void | Promise<void>;

    isWorkingDay?: boolean;
    breakEndTime?: string | null;
    shiftEndTime?: string | null;
    shiftDays?: OvertimeRequestShiftDay[];
};

type FormState = {
    dateFrom: string;
    dateTo: string;
    hoursPerDay: string;
    reason: string;
};

type PreviewStatus = 'requestable' | 'skipped' | 'blocked';

type PreviewRow = {
    key: string;
    displayDate: string;
    dayName: string;
    otHours: string;
    status: PreviewStatus;
    statusLabel: string;
    remarks: string;
    isPlaceholder?: boolean;
};

const MAX_DAYS = 5;
const REQUEST_OPEN_BEFORE_SHIFT_END_MINUTES = 180;
const MIN_PREVIEW_ROWS = 5;

const HOUR_OPTIONS = [
    { label: '0.5 hour', value: '0.5' },
    { label: '1 hour', value: '1' },
    { label: '1.5 hours', value: '1.5' },
    { label: '2 hours', value: '2' },
    { label: '2.5 hours', value: '2.5' },
    { label: '3 hours', value: '3' },
];

const formatDateInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

const getTodayDateString = () => formatDateInput(new Date());

const getTomorrowDateString = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    return formatDateInput(tomorrow);
};

const getCurrentMinutes = () => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
};

const parseDateInput = (value: string) => {
    if (!value) return null;

    const parsed = new Date(`${value}T00:00:00`);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getDateRange = (dateFrom: string, dateTo: string) => {
    const start = parseDateInput(dateFrom);
    const end = parseDateInput(dateTo);

    if (!start || !end || start > end) {
        return [];
    }

    const dates: Date[] = [];
    const cursor = new Date(start);

    while (cursor <= end && dates.length < MAX_DAYS) {
        dates.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
    }

    return dates;
};

const formatPreviewDate = (date: Date) =>
    date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

const formatDayName = (date: Date) =>
    date.toLocaleDateString('en-US', {
        weekday: 'short',
    });

const parseTimeToMinutes = (value?: string | null) => {
    if (!value) return null;

    const raw = value.trim();
    if (!raw) return null;

    const timeOnlyMatch = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/);
    if (!timeOnlyMatch) return null;

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
};

const formatMinutesToDisplayTime = (minutes: number) => {
    const normalizedMinutes = ((minutes % 1440) + 1440) % 1440;
    let hour = Math.floor(normalizedMinutes / 60);
    const minute = normalizedMinutes % 60;
    const modifier = hour >= 12 ? 'PM' : 'AM';

    if (hour === 0) hour = 12;
    else if (hour > 12) hour -= 12;

    return `${hour}:${String(minute).padStart(2, '0')} ${modifier}`;
};

const isWithinTimeRange = (
    currentMinutes: number,
    openMinutes: number,
    closeMinutes: number
) => {
    if (openMinutes === closeMinutes) return false;

    if (openMinutes < closeMinutes) {
        return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
    }

    return currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
};

const getDefaultFormState = (): FormState => {
    const today = getTodayDateString();

    return {
        dateFrom: today,
        dateTo: today,
        hoursPerDay: '3',
        reason: '',
    };
};

const getDateRangeDays = (dateFrom: string, dateTo: string) => {
    if (!dateFrom || !dateTo) return 0;

    const start = new Date(`${dateFrom}T00:00:00`);
    const end = new Date(`${dateTo}T00:00:00`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return 0;
    }

    return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
};

const formatTotalHours = (hours: number) => {
    if (!Number.isFinite(hours) || hours <= 0) return '0 hrs';

    return Number.isInteger(hours) ? `${hours} hrs` : `${hours.toFixed(1)} hrs`;
};

const getPreviewBadgeClass = (status: PreviewStatus) => {
    if (status === 'requestable') {
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    }

    if (status === 'skipped') {
        return 'border-blue-200 bg-blue-50 text-blue-700';
    }

    return 'border-red-200 bg-red-50 text-red-700';
};

const getPreviewIcon = (status: PreviewStatus) => {
    if (status === 'requestable') {
        return <CheckCircle2 className="h-3.5 w-3.5" />;
    }

    if (status === 'skipped') {
        return <Clock className="h-3.5 w-3.5" />;
    }

    return <AlertCircle className="h-3.5 w-3.5" />;
};

const OvertimeRequestModal = ({
    isOpen,
    submittingOt,
    errorMessage,
    onClose,
    onSubmit,
    isWorkingDay = true,
    breakEndTime,
    shiftEndTime,
    shiftDays = [],
}: OvertimeRequestModalProps) => {
    const [form, setForm] = useState<FormState>(() => getDefaultFormState());
    const [wasOpen, setWasOpen] = useState(isOpen);

    if (isOpen && !wasOpen) {
        setWasOpen(true);
        setForm(getDefaultFormState());
    }

    if (!isOpen && wasOpen) {
        setWasOpen(false);
    }

    const { dateFrom, dateTo, hoursPerDay, reason } = form;

    const today = getTodayDateString();
    const tomorrow = getTomorrowDateString();
    const currentMinutes = getCurrentMinutes();

    const dynamicOpenMinutes = parseTimeToMinutes(breakEndTime);
    const dynamicShiftEndMinutes = parseTimeToMinutes(shiftEndTime);

    const requestOpenMinutes =
        dynamicOpenMinutes ??
        (dynamicShiftEndMinutes !== null
            ? dynamicShiftEndMinutes - REQUEST_OPEN_BEFORE_SHIFT_END_MINUTES
            : null);

    const requestCloseMinutes = dynamicShiftEndMinutes ?? null;

    const hasRequestWindow =
        requestOpenMinutes !== null && requestCloseMinutes !== null;

    const requestOpenTime = hasRequestWindow
        ? formatMinutesToDisplayTime(requestOpenMinutes)
        : null;
    const requestCloseTime = hasRequestWindow
        ? formatMinutesToDisplayTime(requestCloseMinutes)
        : null;

    const isWithinCurrentDayWindow =
        isWorkingDay &&
        hasRequestWindow &&
        isWithinTimeRange(currentMinutes, requestOpenMinutes, requestCloseMinutes);

    const normalizedShiftDays = useMemo(
        () =>
            shiftDays.map((day) => ({
                dayOfWeek: Number(day.dayOfWeek),
                isWorkingDay: day.isWorkingDay === true,
            })),
        [shiftDays]
    );

    const isDateWorkingDay = useMemo(
        () => (date: Date) => {
            const apiDate = formatDateInput(date);
            const dayOfWeek = date.getDay();

            if (normalizedShiftDays.length > 0) {
                const shiftDay = normalizedShiftDays.find(
                    (day) => day.dayOfWeek === dayOfWeek
                );

                return shiftDay?.isWorkingDay === true;
            }

            if (apiDate === today) {
                return isWorkingDay;
            }

            return isWorkingDay;
        },
        [normalizedShiftDays, today, isWorkingDay]
    );

    const dateRange = useMemo(
        () => getDateRange(dateFrom, dateTo),
        [dateFrom, dateTo]
    );

    const effectiveDateFrom = useMemo(() => {
        if (!dateFrom || !dateTo) return dateFrom;

        const firstRequestableDate = dateRange.find((date) => {
            const apiDate = formatDateInput(date);

            if (apiDate < today) return false;
            if (!isDateWorkingDay(date)) return false;

            if (apiDate === today && !isWithinCurrentDayWindow) {
                return false;
            }

            return true;
        });

        return firstRequestableDate ? formatDateInput(firstRequestableDate) : tomorrow;
    }, [
        dateFrom,
        dateTo,
        dateRange,
        today,
        tomorrow,
        isDateWorkingDay,
        isWithinCurrentDayWindow,
    ]);

    const previewRows = useMemo<PreviewRow[]>(() => {
        if (!dateFrom || !dateTo || dateRange.length === 0) {
            return Array.from({ length: MIN_PREVIEW_ROWS }, (_, index) => ({
                key: `preview-placeholder-${index}`,
                displayDate: '--',
                dayName: '--',
                otHours: '--',
                status: 'blocked',
                statusLabel: '--',
                remarks: '--',
                isPlaceholder: true,
            }));
        }

        const hours = Number(hoursPerDay || 0);
        const hoursDisplay =
            Number.isFinite(hours) && hours > 0 ? formatTotalHours(hours) : '--';

        const rows = dateRange.map((date): PreviewRow => {
            const apiDate = formatDateInput(date);
            const isPastDate = apiDate < today;
            const isWorkingShiftDay = isDateWorkingDay(date);
            const isSkippedToday = apiDate === today && effectiveDateFrom > today;
            const isRequestable =
                apiDate >= effectiveDateFrom &&
                apiDate <= dateTo &&
                !isPastDate &&
                isWorkingShiftDay;

            if (!isWorkingShiftDay) {
                return {
                    key: apiDate,
                    displayDate: formatPreviewDate(date),
                    dayName: formatDayName(date),
                    otHours: '--',
                    status: 'blocked',
                    statusLabel: 'Blocked',
                    remarks: 'Not a scheduled working day',
                };
            }

            if (isSkippedToday) {
                const remarks = !isWorkingDay
                    ? 'Not part of assigned working schedule'
                    : hasRequestWindow
                        ? 'Outside overtime request window'
                        : 'Incomplete shift request window';

                return {
                    key: apiDate,
                    displayDate: formatPreviewDate(date),
                    dayName: formatDayName(date),
                    otHours: '--',
                    status: 'skipped',
                    statusLabel: 'Skipped',
                    remarks,
                };
            }

            if (!isRequestable) {
                return {
                    key: apiDate,
                    displayDate: formatPreviewDate(date),
                    dayName: formatDayName(date),
                    otHours: '--',
                    status: 'blocked',
                    statusLabel: 'Blocked',
                    remarks: isPastDate
                        ? 'Past dates are not allowed'
                        : 'Not requestable within selected range',
                };
            }

            return {
                key: apiDate,
                displayDate: formatPreviewDate(date),
                dayName: formatDayName(date),
                otHours: hoursDisplay,
                status: 'requestable',
                statusLabel: 'Requestable',
                remarks: 'Ready to request',
            };
        });

        return [
            ...rows,
            ...Array.from(
                { length: Math.max(0, MIN_PREVIEW_ROWS - rows.length) },
                (_, index): PreviewRow => ({
                    key: `preview-placeholder-${index}`,
                    displayDate: '--',
                    dayName: '--',
                    otHours: '--',
                    status: 'blocked',
                    statusLabel: '--',
                    remarks: '--',
                    isPlaceholder: true,
                })
            ),
        ];
    }, [
        dateFrom,
        dateTo,
        dateRange,
        hoursPerDay,
        today,
        effectiveDateFrom,
        isWorkingDay,
        hasRequestWindow,
        isDateWorkingDay,
    ]);

    const requestablePreviewCount = useMemo(
        () =>
            previewRows.filter(
                (row) => row.status === 'requestable' && !row.isPlaceholder
            ).length,
        [previewRows]
    );

    const totalHours = useMemo(() => {
        const hours = Number(hoursPerDay || 0);

        return requestablePreviewCount > 0 ? requestablePreviewCount * hours : 0;
    }, [requestablePreviewCount, hoursPerDay]);

    const skipTodayMessage = useMemo(() => {
        if (!dateFrom || !dateTo) return null;

        const includesToday = dateFrom <= today && dateTo >= today;

        const todayDate = new Date(`${today}T00:00:00`);

        if (includesToday && !isDateWorkingDay(todayDate)) {
            return 'Today is not part of your assigned working schedule, so the request will start from the next valid date.';
        }

        if (includesToday && !hasRequestWindow) {
            return 'Today has no complete shift window for overtime requests, so the request will start from the next valid date.';
        }

        if (includesToday && !isWithinCurrentDayWindow && effectiveDateFrom !== dateFrom) {
            return 'Today is outside your shift-based overtime request window, so the request will start from the next valid date.';
        }

        return null;
    }, [
        dateFrom,
        dateTo,
        today,
        isDateWorkingDay,
        hasRequestWindow,
        isWithinCurrentDayWindow,
        effectiveDateFrom,
    ]);

    const validationMessage = useMemo(() => {
        if (!dateFrom || !dateTo) return null;

        if (new Date(`${dateTo}T00:00:00`) < new Date(`${dateFrom}T00:00:00`)) {
            return 'Date To cannot be earlier than Date From.';
        }

        if (dateFrom < today) {
            return 'Overtime request cannot be submitted for past dates.';
        }

        const originalRangeDays = getDateRangeDays(dateFrom, dateTo);

        if (originalRangeDays > MAX_DAYS) {
            return `Maximum overtime request range is ${MAX_DAYS} days.`;
        }

        if (effectiveDateFrom > dateTo) {
            return 'No valid requestable dates within the selected range.';
        }

        if (requestablePreviewCount <= 0) {
            return 'No valid requestable dates within the selected range.';
        }

        return null;
    }, [dateFrom, dateTo, today, effectiveDateFrom, requestablePreviewCount]);

    const reasonMessage =
        dateFrom && dateTo && hoursPerDay && !reason.trim()
            ? 'Reason is required.'
            : null;

    const displayErrorMessage = validationMessage || reasonMessage || errorMessage;

    const isSubmitDisabled =
        submittingOt ||
        !!validationMessage ||
        !dateFrom ||
        !dateTo ||
        !hoursPerDay ||
        !reason.trim();

    const handleClose = () => {
        if (submittingOt) return;
        onClose();
    };

    const handleSubmit = () => {
        if (isSubmitDisabled) return;

        onSubmit({
            dateFrom: effectiveDateFrom,
            dateTo,
            requestedMinutes: Math.round(Number(hoursPerDay) * 60),
            reason: reason.trim(),
        });
    };

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[2147483647] flex min-h-dvh items-center justify-center bg-[rgba(15,23,42,0.5)] p-4 backdrop-blur-[4px]"
            onClick={handleClose}
        >
            <div
                className="w-full max-w-5xl animate-fade-in-up overflow-hidden rounded-2xl bg-white shadow-xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                    <h3 className="text-xl font-bold text-gray-900">
                        Submit Overtime Request
                    </h3>

                    <button
                        type="button"
                        onClick={handleClose}
                        className="text-gray-400 transition-colors hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={submittingOt}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="grid max-h-[calc(100dvh-12rem)] grid-cols-[420px_minmax(0,1fr)] overflow-y-auto">
                    <div className="border-r border-slate-200 px-6 py-5">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="mb-2 block text-sm font-bold text-gray-700">
                                    Date From
                                </label>
                                <input
                                    type="date"
                                    value={dateFrom}
                                    min={today}
                                    onChange={(event) => {
                                        const value = event.target.value;

                                        setForm((prev) => ({
                                            ...prev,
                                            dateFrom: value,
                                            dateTo:
                                                !prev.dateTo || prev.dateTo < value
                                                    ? value
                                                    : prev.dateTo,
                                        }));
                                    }}
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    disabled={submittingOt}
                                />
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-bold text-gray-700">
                                    Date To
                                </label>
                                <input
                                    type="date"
                                    value={dateTo}
                                    min={dateFrom || today}
                                    onChange={(event) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            dateTo: event.target.value,
                                        }))
                                    }
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    disabled={submittingOt}
                                />
                            </div>
                        </div>

                        <div className="mt-4">
                            <label className="mb-2 block text-sm font-bold text-gray-700">
                                Overtime Hours Per Day
                            </label>
                            <select
                                value={hoursPerDay}
                                onChange={(event) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        hoursPerDay: event.target.value,
                                    }))
                                }
                                className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                disabled={submittingOt}
                            >
                                <option value="">Select hours</option>
                                {HOUR_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <p className="mt-2 text-xs font-medium text-slate-500">
                            Current-day requests for your assigned shift are accepted
                            {hasRequestWindow
                                ? ` from ${requestOpenTime} to ${requestCloseTime}`
                                : ' when your shift schedule has a complete time window'}
                            . Future dates may be requested anytime. Maximum range is {MAX_DAYS} days.
                        </p>

                        {skipTodayMessage && (
                            <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700">
                                {skipTodayMessage}
                            </div>
                        )}

                        <div className="my-5 flex w-full flex-col items-center justify-center rounded-xl border border-blue-200 bg-blue-50 p-4">
                            <p className="mb-1 text-sm font-black uppercase tracking-wider text-blue-600">
                                Total Overtime Calculated
                            </p>
                            <p className="font-mono text-3xl font-black text-blue-600">
                                {formatTotalHours(totalHours)}
                            </p>
                        </div>

                        <div className="mb-4">
                            <label className="mb-2 block text-sm font-bold text-gray-700">
                                Reason for Overtime
                            </label>
                            <textarea
                                value={reason}
                                onChange={(event) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        reason: event.target.value,
                                    }))
                                }
                                className="h-28 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                placeholder="Why do you need to work overtime?"
                                disabled={submittingOt}
                            />
                        </div>

                        {displayErrorMessage && (
                            <div className="mb-1 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                                {displayErrorMessage}
                            </div>
                        )}
                    </div>

                    <div className="px-6 py-5">
                        <div className="mb-4 flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                                <CalendarDays className="h-5 w-5" />
                            </div>

                            <div>
                                <h4 className="text-sm font-black uppercase tracking-wider text-slate-700">
                                    Request Preview
                                </h4>

                                <p className="mt-1 text-xs font-medium text-slate-500">
                                    {requestablePreviewCount} requestable day
                                    {requestablePreviewCount === 1 ? '' : 's'} selected.
                                </p>
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-2xl border border-slate-200">
                            <div className="grid grid-cols-[1.1fr_0.65fr_1fr_1.35fr] bg-slate-50 px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-500">
                                <div>Date</div>
                                <div>OT</div>
                                <div>Status</div>
                                <div>Remarks</div>
                            </div>

                            {previewRows.map((row) => (
                                <div
                                    key={row.key}
                                    className={`grid min-h-[58px] grid-cols-[1.1fr_0.65fr_1fr_1.35fr] items-center border-t border-slate-100 px-4 py-3 text-sm ${
                                        row.isPlaceholder ? 'text-slate-300' : 'text-slate-700'
                                    }`}
                                >
                                    <div>
                                        <p className="font-bold">{row.displayDate}</p>
                                        <p className="text-xs font-semibold text-slate-400">
                                            {row.dayName}
                                        </p>
                                    </div>

                                    <div className="font-bold">{row.otHours}</div>

                                    <div>
                                        {row.isPlaceholder ? (
                                            <span className="font-bold text-slate-300">--</span>
                                        ) : (
                                            <span
                                                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold ${getPreviewBadgeClass(
                                                    row.status
                                                )}`}
                                            >
                                                {getPreviewIcon(row.status)}
                                                {row.statusLabel}
                                            </span>
                                        )}
                                    </div>

                                    <div>
                                        <span
                                            className={`text-xs font-semibold ${
                                                row.isPlaceholder ? 'text-slate-300' : 'text-slate-500'
                                            }`}
                                        >
                                            {row.remarks}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
                    <button
                        type="button"
                        onClick={handleClose}
                        className="rounded-xl bg-gray-100 px-5 py-2.5 font-bold text-gray-600 transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={submittingOt}
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        onClick={handleSubmit}
                        className="rounded-xl bg-blue-600 px-5 py-2.5 font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isSubmitDisabled}
                    >
                        {submittingOt ? 'Submitting...' : 'Submit Request'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default OvertimeRequestModal;
