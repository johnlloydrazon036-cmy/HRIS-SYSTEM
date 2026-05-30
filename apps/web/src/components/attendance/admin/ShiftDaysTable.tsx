import type { Shift, ShiftDay } from '../../../lib/attendance';

type Props = {
    selectedShift: Shift | null;
    dayLabels: string[];
    readOnly?: boolean;
    onChange?: (days: ShiftDay[]) => void;
};

const formatDisplayTime = (value?: string | null) => {
    if (!value) return '--';

    const [hourRaw, minuteRaw] = value.split(':');
    const hour = Number(hourRaw);
    const minute = Number(minuteRaw);

    if (Number.isNaN(hour) || Number.isNaN(minute)) return value.slice(0, 5);

    const suffix = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

    return `${String(displayHour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${suffix}`;
};

const ShiftDaysTable = ({ selectedShift, dayLabels, readOnly = false, onChange }: Props) => {
    if (!selectedShift || selectedShift.days.length === 0) return null;

    const sortedDays = selectedShift.days.slice().sort((a, b) => a.dayOfWeek - b.dayOfWeek);

    const updateDay = (dayId: number, updated: Partial<ShiftDay>) => {
        if (readOnly || !onChange) return;

        const newDays = selectedShift.days.map((day) =>
            day.id === dayId ? { ...day, ...updated } : day
        );

        onChange(newDays);
    };

    const handleWorkingDayToggle = (day: ShiftDay) => {
        const nextIsWorkingDay = !day.isWorkingDay;

        if (!nextIsWorkingDay) {
            updateDay(day.id, {
                isWorkingDay: false,
                startTime: null,
                breakStartTime: null,
                breakEndTime: null,
                endTime: null,
            });
            return;
        }

        updateDay(day.id, {
            isWorkingDay: true,
            startTime: day.startTime ?? '08:30:00',
            breakStartTime: day.breakStartTime ?? '12:00:00',
            breakEndTime: day.breakEndTime ?? '13:00:00',
            endTime: day.endTime ?? '17:30:00',
        });
    };

    const renderTimeCell = (
        day: ShiftDay,
        field: 'startTime' | 'breakStartTime' | 'breakEndTime' | 'endTime'
    ) => {
        if (readOnly) {
            return <span className="text-sm font-medium text-slate-600">{formatDisplayTime(day[field])}</span>;
        }

        return (
            <input
                type="time"
                value={day[field]?.slice(0, 5) ?? ''}
                disabled={!day.isWorkingDay}
                onChange={(event) => {
                    if (!day.isWorkingDay) return;
                    updateDay(day.id, {
                        [field]: event.target.value ? `${event.target.value}:00` : null,
                    });
                }}
                className="pro-input w-full disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            />
        );
    };

    return (
        <div className="overflow-hidden rounded-xl border border-gray-100">
            <table className="pro-table w-full">
                <thead>
                    <tr>
                        {['Day', 'Working Day', 'Start', 'Break Start', 'Break End', 'End'].map(
                            (header) => (
                                <th key={header}>{header}</th>
                            )
                        )}
                    </tr>
                </thead>

                <tbody>
                    {sortedDays.map((day) => (
                        <tr key={day.id} className={!day.isWorkingDay ? 'bg-slate-50' : ''}>
                            <td className="!font-semibold !text-gray-800">
                                {dayLabels[day.dayOfWeek] ?? '--'}
                            </td>

                            <td>
                                {readOnly ? (
                                    <span
                                        className={`badge ${
                                            day.isWorkingDay ? 'badge-success' : 'badge-neutral'
                                        }`}
                                    >
                                        <span className="badge-dot" />
                                        {day.isWorkingDay ? 'Working' : 'Rest Day'}
                                    </span>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => handleWorkingDayToggle(day)}
                                        className={`badge ${
                                            day.isWorkingDay ? 'badge-success' : 'badge-neutral'
                                        }`}
                                    >
                                        <span className="badge-dot" />
                                        {day.isWorkingDay ? 'Working' : 'Rest Day'}
                                    </button>
                                )}
                            </td>

                            <td>{renderTimeCell(day, 'startTime')}</td>
                            <td>{renderTimeCell(day, 'breakStartTime')}</td>
                            <td>{renderTimeCell(day, 'breakEndTime')}</td>
                            <td>{renderTimeCell(day, 'endTime')}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default ShiftDaysTable;
