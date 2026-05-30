import { useEffect, useMemo, useRef, useState } from 'react';

type UseLiveTrackerOptions = {
    startAtHour: number;
    startAtMinute: number;
    stopAtHour: number;
    stopAtMinute: number;
    overtimeStartHour: number;
    overtimeStartMinute: number;
};

type ShiftContext = {
    shiftName?: string | null;
    shiftStartTime?: string | null;
    timeInOpenTime?: string | null;
    breakStartTime?: string | null;
    breakEndTime?: string | null;
    shiftEndTime?: string | null;
};

type UseLiveTrackerReturn = {
    currentTime: Date;
    displayTime: Date;
    frozenTimeOut: Date | null;
    isBeforeStart: boolean;
    isBreakTime: boolean;
    isAfterRegularHours: boolean;
    isNoShift: boolean;
    trackerMessage: string;
};

const createTime = (hour: number, minute: number) => {
    const d = new Date();
    d.setHours(hour, minute, 0, 0);
    return d;
};

const getMinutes = (date: Date) => date.getHours() * 60 + date.getMinutes();

const toMinutes = (value?: string | null) => {
    if (!value) return null;

    const timeValue = value.slice(0, 5);
    const [hourRaw, minuteRaw] = timeValue.split(':');

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

const formatScheduleTime = (value?: string | null) => {
    if (!value) return '--:--';

    const minutes = toMinutes(value);
    if (minutes === null) return '--:--';

    const date = createTime(Math.floor(minutes / 60), minutes % 60);

    return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    });
};

const useLiveTracker = (
    {
        startAtHour,
        startAtMinute,
        stopAtHour,
        stopAtMinute,
        overtimeStartHour,
        overtimeStartMinute,
    }: UseLiveTrackerOptions,
    shift?: ShiftContext | null
): UseLiveTrackerReturn => {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [displayTime, setDisplayTime] = useState(new Date());

    const frozenTimeOut = null;

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fallbackStartTime = useMemo(
        () => createTime(startAtHour, startAtMinute),
        [startAtHour, startAtMinute]
    );

    const fallbackOvertimeStart = useMemo(
        () => createTime(overtimeStartHour, overtimeStartMinute),
        [overtimeStartHour, overtimeStartMinute]
    );

    const isNoShift = !shift?.shiftName;

    const nowMinutes = getMinutes(currentTime);

    const openMinutes =
        toMinutes(shift?.timeInOpenTime) ?? getMinutes(fallbackStartTime);

    const breakStartMinutes = toMinutes(shift?.breakStartTime);
    const breakEndMinutes = toMinutes(shift?.breakEndTime);

    const shiftEndMinutes =
        toMinutes(shift?.shiftEndTime) ?? getMinutes(fallbackOvertimeStart);

    const stopMinutes = stopAtHour * 60 + stopAtMinute;

    const isBeforeStart = nowMinutes < openMinutes;

    const isBreakTime =
        breakStartMinutes !== null &&
        breakEndMinutes !== null &&
        nowMinutes >= breakStartMinutes &&
        nowMinutes < breakEndMinutes;

    const isAfterRegularHours = nowMinutes >= shiftEndMinutes;

    const isAfterCutoff = nowMinutes >= stopMinutes;

    const trackerMessage = useMemo(() => {
        if (isNoShift) {
            return 'No assigned shift. Please contact HR/Admin.';
        }

        if (isBeforeStart) {
            return `Time-in opens at ${formatScheduleTime(
                shift?.timeInOpenTime
            )}`;
        }

        if (isBreakTime) {
            return 'Break time';
        }

        if (isAfterCutoff) {
            return 'Time-in is no longer available';
        }

        if (isAfterRegularHours) {
            return 'Overtime period active';
        }

        return 'Time-in is available';
    }, [
        isNoShift,
        isBeforeStart,
        isBreakTime,
        isAfterCutoff,
        isAfterRegularHours,
        shift,
    ]);

    useEffect(() => {
        intervalRef.current = setInterval(() => {
            const now = new Date();
            setCurrentTime(now);
            setDisplayTime(now);
        }, 1000);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, []);

    return {
        currentTime,
        displayTime,
        frozenTimeOut,
        isBeforeStart,
        isBreakTime,
        isAfterRegularHours,
        isNoShift, 
        trackerMessage,
    };
};

export default useLiveTracker;