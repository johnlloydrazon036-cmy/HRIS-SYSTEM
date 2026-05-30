import {
    AlertTriangle,
    CalendarDays,
    CheckSquare,
    ClipboardList,
    Clock3,
    LogIn,
    LogOut,
    Timer,
    X,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import type { StatusBadgeMap } from '../../../types/attendance';

type UserAttendanceRecord = {
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
};

type Props = {
    isOpen: boolean;
    record: UserAttendanceRecord | null;
    statusBadge: StatusBadgeMap;
    onClose: () => void;
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

const normalizeOvertimeStatus = (value?: string | null): 'None' | 'Pending' | 'Approved' => {
    const normalized = value?.trim().toLowerCase();

    if (normalized === 'approved') return 'Approved';
    if (normalized === 'pending') return 'Pending';

    return 'None';
};

const Label = ({
    icon: Icon,
    children,
}: {
    icon: React.ElementType;
    children: React.ReactNode;
}) => (
    <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {children}
    </div>
);

const ViewAttendanceModal = ({ isOpen, record, statusBadge, onClose }: Props) => {
    if (!isOpen || !record) return null;

    const overtimeStatus = normalizeOvertimeStatus(record.overtimeStatus);

    const hasApprovedOT = overtimeStatus === 'Approved';
    const hasPendingOT = overtimeStatus === 'Pending';
    const shouldShowCredited =
        typeof record.creditedMinutes === 'number' &&
        record.creditedMinutes > 0 &&
        record.renderedMinutes > 0 &&
        record.creditedMinutes < record.renderedMinutes;

    const timeOutClassName = shouldShowCredited
        ? 'font-mono text-[14px] font-semibold text-red-500'
        : 'font-mono text-[14px] text-slate-700';

    const modalContent = (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-[rgba(15,23,42,0.5)] backdrop-blur-[4px]"
            onClick={onClose}
        >
            <div
                className="mx-4 w-full max-w-[520px] overflow-hidden rounded-[22px] bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-6">
                    <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-slate-800 sm:text-[15px]">
                        Attendance Details
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-slate-400 transition-colors hover:text-slate-600"
                        type="button"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="px-6 py-7">
                    <div className="grid grid-cols-2 gap-x-10 gap-y-7">
                        <div>
                            <Label icon={CalendarDays}>Date</Label>
                            <div className="text-[14px] text-slate-700">
                                {formatAttendanceDate(record.date)}
                            </div>
                        </div>

                        <div>
                            <Label icon={Clock3}>Status</Label>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className={`badge ${statusBadge[record.status]}`}>
                                    <span className="badge-dot" />
                                    {record.status}
                                </span>

                                {record.isUndertime && (
                                    <span className="badge badge-undertime">
                                        <span className="badge-dot" />
                                        Undertime
                                    </span>
                                )}

                                {hasPendingOT && (
                                    <span className="badge badge-warning">
                                        <span className="badge-dot" />
                                        Pending OT
                                    </span>
                                )}

                                {hasApprovedOT && (
                                    <span className="badge badge-info">
                                        <span className="badge-dot" />
                                        Overtime
                                    </span>
                                )}
                            </div>
                        </div>

                        <div>
                            <Label icon={LogIn}>Time In</Label>
                            <div className="font-mono text-[14px] text-slate-700">
                                {record.timeIn || '—'}
                            </div>
                        </div>

                        <div>
                            <Label icon={ClipboardList}>Task</Label>
                            <div className="text-[14px] text-slate-700">
                                {record.task || '-'}
                            </div>
                        </div>

                        <div>
                            <Label icon={LogOut}>Time Out</Label>
                            <div className={timeOutClassName}>
                                {record.timeOut || '—'}
                            </div>
                        </div>

                        <div>
                            <Label icon={CheckSquare}>Accomplished</Label>
                            <div className="text-[14px] text-slate-700">
                                {record.accomplished || '-'}
                            </div>
                        </div>

                        <div>
                            <Label icon={AlertTriangle}>Late</Label>
                            <div className="text-[14px] text-slate-700">
                                {formatMinutes(record.lateMinutes)}
                            </div>
                        </div>

                        <div>
                            <Label icon={AlertTriangle}>Undertime</Label>
                            <div className="text-[14px] text-slate-700">
                                {formatMinutes(record.undertimeMinutes)}
                            </div>
                        </div>

                        <div>
                            <Label icon={Timer}>Total</Label>
                            <div className="flex items-center gap-2 text-[14px]">
                                <span className="text-slate-700">
                                    {formatMinutes(record.renderedMinutes)}
                                </span>

                                {shouldShowCredited && (
                                    <span className="text-[12px] font-semibold text-slate-400">
                                        · {formatMinutes(record.creditedMinutes)} credited
                                    </span>
                                )}
                            </div>
                        </div>

                        <div>
                            <Label icon={Clock3}>Overtime</Label>
                            <div className="text-[14px] text-slate-700">
                                {formatMinutes(record.overtimeMinutes)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default ViewAttendanceModal;