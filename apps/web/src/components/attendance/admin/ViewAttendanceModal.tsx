import {
    AlertTriangle,
    CalendarDays,
    CheckSquare,
    ClipboardList,
    Clock3,
    Hash,
    LogIn,
    LogOut,
    Timer,
    UserRound,
    X,
    type LucideIcon,
} from 'lucide-react';
import { createPortal } from 'react-dom';

import type {
    AdminDtrRecord,
    StatusBadgeMap,
} from '../../../types/attendance';

type Props = {
    isOpen: boolean;
    record: AdminDtrRecord | null;
    statusBadge: StatusBadgeMap;
    onClose: () => void;
};

const formatDate = (dateStr?: string) => {
    if (!dateStr || dateStr === '—' || dateStr === '-' || dateStr === '--') {
        return '—';
    }

    const date = new Date(dateStr);

    if (Number.isNaN(date.getTime())) {
        return dateStr;
    }

    return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });
};

const formatMinutes = (minutes?: number) => {
    if (!minutes || minutes <= 0) {
        return '--';
    }

    const total = Math.round(minutes);
    const hours = Math.floor(total / 60);
    const mins = total % 60;

    if (hours === 0) {
        return `${mins}m`;
    }

    if (mins === 0) {
        return `${hours}h`;
    }

    return `${hours}h ${mins}m`;
};

const DetailItem = ({
    label,
    icon: Icon,
    children,
    mono = false,
    valueClassName = '',
}: {
    label: string;
    icon: LucideIcon;
    children: React.ReactNode;
    mono?: boolean;
    valueClassName?: string;
}) => {
    const valueColorClass = valueClassName ? valueClassName : 'text-slate-700';

    return (
        <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-slate-400">
                <Icon className="h-3.5 w-3.5" />
                {label}
            </div>

            <div
                className={`text-[14px] ${
                    mono ? 'font-mono' : ''
                } ${valueColorClass}`}
            >
                {children}
            </div>
        </div>
    );
};

const ViewAttendanceModal = ({
    isOpen,
    record,
    statusBadge,
    onClose,
}: Props) => {
    if (!isOpen || !record) {
        return null;
    }

    const hasApprovedOT = record.overtimeStatus === 'Approved';
    const hasPendingOT = record.overtimeStatus === 'Pending';

    const renderedMinutes = Number(record.renderedMinutes ?? 0);
    const creditedMinutes = Number(record.creditedMinutes ?? 0);

    const hasInvalidTimeOut = Boolean(record.hasExceededApprovedOvertime);

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-[rgba(15,23,42,0.5)] px-4 backdrop-blur-[4px]"
            onClick={onClose}
        >
            <div
                className="w-full max-w-[580px] overflow-hidden rounded-[22px] bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-6">
                    <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-slate-800">
                        Attendance Details
                    </h3>

                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 transition-colors hover:text-slate-600"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="max-h-[75vh] overflow-y-auto px-6 py-7">
                    <div className="grid grid-cols-2 gap-x-10 gap-y-7">
                        <DetailItem label="Employee ID" icon={Hash}>
                            <span className="font-semibold text-slate-800">
                                {record.empId}
                            </span>
                        </DetailItem>

                        <DetailItem label="Name" icon={UserRound}>
                            <span className="font-semibold text-slate-800">
                                {record.name}
                            </span>
                        </DetailItem>

                        <DetailItem label="Date" icon={CalendarDays}>
                            {formatDate(record.date)}
                        </DetailItem>

                        <DetailItem label="Status" icon={Clock3}>
                            <div className="flex flex-wrap gap-2">
                                <span
                                    className={`badge ${
                                        statusBadge[record.status]
                                    }`}
                                >
                                    <span className="badge-dot" />
                                    {record.status}
                                </span>

                                {hasApprovedOT && (
                                    <span className="badge badge-info">
                                        <span className="badge-dot" />
                                        Overtime
                                    </span>
                                )}

                                {record.isUndertime && (
                                    <span className="badge badge-warning">
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
                            </div>
                        </DetailItem>

                        <DetailItem label="Task" icon={ClipboardList}>
                            {record.task || '--'}
                        </DetailItem>

                        <DetailItem label="Accomplished" icon={CheckSquare}>
                            {record.accomplished || '--'}
                        </DetailItem>

                        <DetailItem label="Time In" icon={LogIn} mono>
                            {record.timeIn || '--'}
                        </DetailItem>

                        <DetailItem
                            label="Time Out"
                            icon={LogOut}
                            mono
                            valueClassName={
                                hasInvalidTimeOut
                                    ? 'font-semibold text-red-500'
                                    : ''
                            }
                        >
                            {record.timeOut || '--'}
                        </DetailItem>

                        <DetailItem label="Late" icon={AlertTriangle}>
                            {formatMinutes(record.lateMinutes)}
                        </DetailItem>

                        <DetailItem label="Undertime" icon={AlertTriangle}>
                            {formatMinutes(record.undertimeMinutes)}
                        </DetailItem>

                        <DetailItem label="Total Rendered" icon={Timer}>
                            {formatMinutes(renderedMinutes)}
                        </DetailItem>

                        <DetailItem label="Total Credited" icon={Timer}>
                            {formatMinutes(creditedMinutes)}
                        </DetailItem>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ViewAttendanceModal;