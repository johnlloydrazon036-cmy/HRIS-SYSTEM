import { CheckCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Dispatch, SetStateAction } from 'react';
import {
    AlertTriangle,
    XCircle,
    Clock,
    X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
    adminAssignOvertimeRequest,
    formatAttendanceTime,
    getAttendanceLogs,
    getAttendanceSummary,
    getOvertimeRequests,
    getShifts,
    getShiftAssignmentsByShift,
    reviewOvertimeRequest,
    updateAttendanceLog,
    toApiDateString,
    toApiTimeString,
    type AttendanceLogDto,
    type AttendanceSummaryDto,
    type OvertimeRequestDto,
} from '../../../lib/attendance';
import AttendanceTabs from '../../../components/attendance/AttendanceTabs';
import AdminAttendanceSummaryCards from '../../../components/attendance/admin/AdminAttendanceSummaryCards';
import AdminDtrTab from '../../../components/attendance/admin/AdminDtrTab';
import AdminOtTab from '../../../components/attendance/admin/AdminOtTab';
import AdminSetupTab from '../../../components/attendance/admin/AdminSetupTab';
import AssignOvertimeModal, {
    type AssignOvertimeEmployeeOption,
    type AssignOvertimeAttendanceOption,
} from '../../../components/attendance/admin/AssignOvertimeModal';
import { getEmployees } from '../../../lib/employees';
import { apiRequest } from '../../../lib/api';
import ViewAttendanceModal from '../../../components/attendance/admin/ViewAttendanceModal';
import type {
    AdminAttendanceTab,
    AdminDtrRecord,
    AdminOvertimeRequestRow,
    AdminShiftRecord,
    DtrFilters,
    ShiftFormState,
    StatusBadgeMap,
} from '../../../types/attendance';

type ShiftFormModalProps = {
    title: string;
    onSubmit: () => void;
    submitLabel: string;
    onClose: () => void;
    shiftForm: ShiftFormState;
    setShiftForm: Dispatch<SetStateAction<ShiftFormState>>;
};

const DEFAULT_PAGE_SIZE = 10;
const DTR_HISTORY_START_DATE = '2000-01-01';

const getTodayDateKey = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

type EmployeeApiItem = {
    id: string;
    employeeNumber?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    middleName?: string | null;
    suffix?: string | null;
};

type EmployeesResponse = {
    items?: EmployeeApiItem[];
};

type ShiftApiDay = {
    id: number;
    dayOfWeek: number;
    isWorkingDay: boolean;
    startTime?: string | null;
    breakStartTime?: string | null;
    breakEndTime?: string | null;
    endTime?: string | null;
};

type ShiftApiItem = {
    id: number;
    name?: string | null;
    lateGraceMinutes?: number | null;
    isActive?: boolean | null;
    assignedCount?: number | null;
    days?: ShiftApiDay[] | null;
};

type ShiftsResponse = {
    items?: ShiftApiItem[];
};

const getErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    if (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as { message?: unknown }).message === 'string'
    ) {
        return (error as { message: string }).message;
    }

    return fallback;
};

const normalizeOvertimeStatus = (value?: string | null): 'None' | 'Pending' | 'Approved' => {
    const normalized = value?.trim().toLowerCase();

    if (normalized === 'approved') return 'Approved';
    if (normalized === 'pending') return 'Pending';

    return 'None';
};

const normalizeDateKey = (value?: string | null) => {
    if (!value || value === '-' || value === '--' || value === '—') return '';

    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
        return value.slice(0, 10);
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

const formatDisplayDate = (value?: string | null) => {
    const normalized = normalizeDateKey(value);
    if (!normalized) return '--';

    const parsed = new Date(`${normalized}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return value || '--';

    return new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    }).format(parsed);
};

const formatOvertimeDateRange = (request: OvertimeRequestDto) => {
    const dateFrom = request.dateFrom || request.attendanceDate || '';
    const dateTo = request.dateTo || request.dateFrom || request.attendanceDate || '';

    const formattedFrom = formatDisplayDate(dateFrom);
    const formattedTo = formatDisplayDate(dateTo);

    if (formattedFrom === formattedTo) return formattedFrom;
    if (formattedFrom === '--') return formattedTo;
    if (formattedTo === '--') return formattedFrom;

    return `${formattedFrom} - ${formattedTo}`;
};

const formatOvertimeDuration = (request: OvertimeRequestDto) => {
    const perDayMinutes = Number(request.requestedMinutesPerDay ?? request.requestedMinutes ?? 0);
    const totalMinutes = Number(request.totalRequestedMinutes ?? request.requestedMinutes ?? perDayMinutes);

    if (!Number.isFinite(perDayMinutes) || perDayMinutes <= 0) return '--';

    const formatHours = (minutes: number) => {
        const hours = minutes / 60;
        return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
    };

    if (!Number.isFinite(totalMinutes) || totalMinutes <= 0 || totalMinutes === perDayMinutes) {
        return formatHours(perDayMinutes);
    }

    return `${formatHours(perDayMinutes)}/day (${formatHours(totalMinutes)} total)`;
};

const formatApiTimeToDisplay = (value?: string | null) => {
    if (!value) return '--';

    const [hourPart, minutePart] = value.split(':');
    let hour = Number(hourPart);
    const minute = minutePart || '00';

    if (!Number.isFinite(hour)) return '--';

    const modifier = hour >= 12 ? 'PM' : 'AM';
    if (hour === 0) hour = 12;
    else if (hour > 12) hour -= 12;

    return `${String(hour).padStart(2, '0')}:${minute.padStart(2, '0')} ${modifier}`;
};

type ConfirmAttendanceUpdateModalProps = {
    isOpen: boolean;
    record: AdminDtrRecord | null;
    saving: boolean;
    onCancel: () => void;
    onConfirm: () => void;
};

const ConfirmAttendanceUpdateModal = ({
    isOpen,
    record,
    saving,
    onCancel,
    onConfirm,
}: ConfirmAttendanceUpdateModalProps) => {
    if (!isOpen || !record) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[9998] flex items-center justify-center bg-[rgba(15,23,42,0.45)] backdrop-blur-[4px]"
            onClick={saving ? undefined : onCancel}
        >
            <div
                className="mx-4 w-full max-w-[440px] overflow-hidden rounded-[22px] bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="border-b border-slate-200 px-6 py-5">
                    <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-slate-800">
                        Confirm Attendance Update
                    </h3>
                    <p className="mt-1 text-[13px] text-slate-500">
                        Save the updated time record for{' '}
                        <span className="font-semibold text-slate-700">{record.name}</span>?
                    </p>
                </div>

                <div className="space-y-4 px-6 py-5">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    Employee ID
                                </p>
                                <p className="mt-1 font-semibold text-slate-700">{record.empId}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    Date
                                </p>
                                <p className="mt-1 font-semibold text-slate-700">{record.date}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    Time In
                                </p>
                                <p className="mt-1 font-semibold text-slate-700">{record.timeIn}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    Time Out
                                </p>
                                <p className="mt-1 font-semibold text-slate-700">{record.timeOut}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-5">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={saving}
                        className="h-[40px] rounded-[12px] border border-slate-300 bg-slate-50 px-5 text-[14px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={saving}
                        className="h-[40px] rounded-[12px] bg-emerald-600 px-5 text-[14px] font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {saving ? 'Saving...' : 'Confirm Save'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

const AdminAttendance = () => {
    const [activeTab, setActiveTab] = useState<AdminAttendanceTab>('dtr');

    const [showAssignOvertimeModal, setShowAssignOvertimeModal] = useState(false);

    const [showViewDtrModal, setShowViewDtrModal] = useState(false);
    const [selectedDtrRecord, setSelectedDtrRecord] = useState<AdminDtrRecord | null>(null);
    const [pendingEditRecord, setPendingEditRecord] = useState<AdminDtrRecord | null>(null);
    const [showConfirmEditModal, setShowConfirmEditModal] = useState(false);
    const [savingDtrEdit, setSavingDtrEdit] = useState(false);
    const [recentlyEditedRowId, setRecentlyEditedRowId] = useState<number | null>(null);

    const [showAddShiftModal, setShowAddShiftModal] = useState(false);
    const [showEditShiftModal, setShowEditShiftModal] = useState(false);
    const [editingShift, setEditingShift] = useState<AdminShiftRecord | null>(null);
    const [shiftForm, setShiftForm] = useState<ShiftFormState>({
        name: '',
        timeIn: '08:00',
        timeOut: '17:00',
        grace: '15',
        status: 'Active',
    });

    const [assignOtForm, setAssignOtForm] = useState({
        employeeId: '',
        dateFrom: '',
        dateTo: '',
        requestedMinutes: '',
        reason: '',
    });
    const [submittingAssignOt, setSubmittingAssignOt] = useState(false);
    const [assignOtError, setAssignOtError] = useState<string | null>(null);
    const [assignOtEmployees, setAssignOtEmployees] = useState<AssignOvertimeEmployeeOption[]>([]);
    const [loadingAssignOtEmployees, setLoadingAssignOtEmployees] = useState(false);

    const [dtrRecords, setDtrRecords] = useState<AdminDtrRecord[]>([]);
    const [loadingDtr, setLoadingDtr] = useState(false);
    const [dtrPage, setDtrPage] = useState(1);
    const [dtrPageSize, setDtrPageSize] = useState(DEFAULT_PAGE_SIZE);
    const [dtrFilters, setDtrFilters] = useState<DtrFilters>({
        dateFrom: '',
        dateTo: '',
        search: '',
        status: '',
        sort: 'latest',
    });

    const [summary, setSummary] = useState<AttendanceSummaryDto | null>(null);

    const [overtimeRequests, setOvertimeRequests] = useState<AdminOvertimeRequestRow[]>([]);
    const [loadingOt, setLoadingOt] = useState(false);
    const [reviewingOtId, setReviewingOtId] = useState<number | null>(null);

    const [shifts, setShifts] = useState<AdminShiftRecord[]>([]);

    const mapAttendanceStatus = useCallback((log: AttendanceLogDto): AdminDtrRecord['status'] => {
        const hasTimeIn = !!log.timeIn;
        const hasTimeOut = !!log.timeOut;

        if (!hasTimeIn && !hasTimeOut) return 'Absent';
        if (Number(log.lateMinutes ?? 0) > 0) return 'Late';
        return 'Present';
    }, []);

    const mapAttendanceRecord = useCallback(
        (log: AttendanceLogDto): AdminDtrRecord => {
            const status: AdminDtrRecord['status'] = mapAttendanceStatus(log);
            const lateMinutes = Number(log.lateMinutes ?? 0);
            const undertimeMinutes = Number(log.undertimeMinutes ?? 0);
            const overtimeStatus = normalizeOvertimeStatus(log.overtimeStatus);
            const rawOvertimeMinutes = Number(log.overtimeMinutes ?? 0);
            const overtimeMinutes = overtimeStatus === 'Approved' ? rawOvertimeMinutes : 0;
            const renderedMinutes = Number(log.renderedMinutes ?? 0);
            const requiredMinutes = Number(log.requiredMinutes ?? 0);
            const regularCreditedMinutes = Number(log.regularCreditedMinutes ?? 0);
            const overtimeCreditedMinutes = Number(log.overtimeCreditedMinutes ?? 0);
            const creditedMinutes = Number(log.creditedMinutes ?? 0);
            const excessMinutes = Number(log.excessMinutes ?? 0);
            const hasExceededApprovedOvertime = Boolean(log.hasExceededApprovedOvertime);

            return {
                id: log.id,
                empId: log.employeeNumber || '--',
                name: log.employeeName || '--',
                suffix: log.employeeSuffix || undefined,
                date: log.date || '--',
                timeIn: formatAttendanceTime(log.timeIn),
                timeOut: formatAttendanceTime(log.timeOut),
                status,
                isOT: overtimeStatus === 'Approved',
                overtimeStatus,
                isUndertime: undertimeMinutes > 0,
                task: log.task?.trim() || '--',
                accomplished: log.accomplished?.trim() || '--',
                lateMinutes,
                undertimeMinutes,
                overtimeMinutes,
                renderedMinutes,
                requiredMinutes,
                regularCreditedMinutes,
                overtimeCreditedMinutes,
                creditedMinutes,
                excessMinutes,
                hasExceededApprovedOvertime,
            };
        },
        [mapAttendanceStatus]
    );

    const fetchDtr = useCallback(
        async (_page: number, filters: DtrFilters) => {
            try {
                setLoadingDtr(true);

                const dateFrom = filters.dateFrom || DTR_HISTORY_START_DATE;
                const dateTo = filters.dateTo || getTodayDateKey();

                const res = await getAttendanceLogs({
                    page: 1,
                    pageSize: 1000,
                    dateFrom,
                    dateTo,
                });

                setDtrRecords((res.items || []).map(mapAttendanceRecord));
                setDtrPageSize(DEFAULT_PAGE_SIZE);
                setDtrPage(1);
            } catch (error: unknown) {
                console.error(error);
                alert(getErrorMessage(error, 'Failed to load attendance records.'));
            } finally {
                setLoadingDtr(false);
            }
        },
        [mapAttendanceRecord]
    );

    const fetchSummary = useCallback(async () => {
        try {
            const res = await getAttendanceSummary();
            setSummary(res);
        } catch (error: unknown) {
            console.error(error);
        }
    }, []);

    const fetchOt = useCallback(async () => {
        try {
            setLoadingOt(true);

            const res = await getOvertimeRequests();

            const mapped: AdminOvertimeRequestRow[] = (res.items || []).map((o: OvertimeRequestDto) => ({
                id: o.id,
                date: formatOvertimeDateRange(o),
                employee: o.employeeName || '—',
                duration: formatOvertimeDuration(o),
                reason: o.reason || '—',
                status: (o.status || 'Pending') as AdminOvertimeRequestRow['status'],
            }));

            setOvertimeRequests(mapped);
        } catch (error: unknown) {
            console.error(error);
            alert(getErrorMessage(error, 'Failed to load overtime requests.'));
        } finally {
            setLoadingOt(false);
        }
    }, []);

    const fetchShifts = useCallback(async () => {
        try {
            const res = await apiRequest<ShiftsResponse>('/shifts?page=1&pageSize=50');

            const mapped: AdminShiftRecord[] = (res.items || []).map((shift: ShiftApiItem) => {
                const workingDay = (shift.days || []).find((day: ShiftApiDay) => day.isWorkingDay);
                const assignedCount = Number(shift.assignedCount ?? 0);

                return {
                    id: shift.id,
                    name: shift.name || '--',
                    timeIn: formatApiTimeToDisplay(workingDay?.startTime),
                    timeOut: formatApiTimeToDisplay(workingDay?.endTime),
                    grace: `${Number(shift.lateGraceMinutes ?? 0)} min`,
                    employees: assignedCount,
                    assignedCount,
                    status: shift.isActive === false ? 'Inactive' : 'Active',
                };
            });

            setShifts(mapped);
        } catch (error: unknown) {
            console.error(error);
            toast.error(getErrorMessage(error, 'Failed to load shift schedules.'));
        }
    }, []);

    const fetchAssignOtEmployees = useCallback(async () => {
        try {
            setLoadingAssignOtEmployees(true);

            const [employeesResponse, shiftsResponse] = await Promise.all([
                getEmployees({ page: 1, pageSize: 100, isActive: true }) as Promise<EmployeesResponse>,
                getShifts(),
            ]);

            const activeShifts = (shiftsResponse.items || []).filter(
                (shift) => shift.isActive !== false && Number(shift.assignedCount ?? 0) > 0
            );

            const assignmentResponses = await Promise.all(
                activeShifts.map(async (shift) => ({
                    shift,
                    assignments: await getShiftAssignmentsByShift(shift.id),
                }))
            );

            const assignmentByEmployeeId = new Map<
                string,
                {
                    shift: ShiftApiItem;
                    effectiveFrom?: string | null;
                }
            >();

            assignmentResponses.forEach(({ shift, assignments }) => {
                assignments.forEach((assignment) => {
                    if (assignment.isActive === false || !assignment.employeeId) {
                        return;
                    }

                    assignmentByEmployeeId.set(String(assignment.employeeId), {
                        shift,
                        effectiveFrom: assignment.effectiveFrom ?? null,
                    });
                });
            });

            const mappedEmployees = (employeesResponse.items || [])
                .filter((employee) => !!employee.id && assignmentByEmployeeId.has(String(employee.id)))
                .map((employee) => {
                    const assignment = assignmentByEmployeeId.get(String(employee.id));
                    const assignedShift = assignment?.shift;

                    return {
                        id: String(employee.id),
                        employeeNumber: employee.employeeNumber ?? null,
                        firstName: employee.firstName ?? null,
                        lastName: employee.lastName ?? null,
                        middleName: employee.middleName ?? null,
                        suffix: employee.suffix ?? null,
                        hasAssignedShift: !!assignedShift,
                        isShiftActive: assignedShift?.isActive !== false,
                        effectiveFrom: assignment?.effectiveFrom ?? null,
                        shiftDays: (assignedShift?.days ?? []).map((day) => ({
                            dayOfWeek: Number(day.dayOfWeek),
                            isWorkingDay: day.isWorkingDay === true,
                        })),
                    };
                })
                .sort((a, b) => {
                    const left = `${a.lastName ?? ''}, ${a.firstName ?? ''}`.trim();
                    const right = `${b.lastName ?? ''}, ${b.firstName ?? ''}`.trim();

                    return left.localeCompare(right);
                });

            setAssignOtEmployees(mappedEmployees);
        } catch (error: unknown) {
            console.error(error);
            toast.error(getErrorMessage(error, 'Failed to load employees with assigned shifts.'));
        } finally {
            setLoadingAssignOtEmployees(false);
        }
    }, []);

    useEffect(() => {
        if (!showAssignOvertimeModal) return;
        void fetchAssignOtEmployees();
    }, [fetchAssignOtEmployees, showAssignOvertimeModal]);


    useEffect(() => {
        const handleViewEmployeeLogs = (event: Event) => {
            const customEvent = event as CustomEvent<{
                employeeId?: string | null;
                employeeNumber?: string | null;
                employeeName?: string | null;
            }>;

            const searchValue =
                customEvent.detail?.employeeNumber ||
                customEvent.detail?.employeeName ||
                customEvent.detail?.employeeId ||
                '';

            if (!searchValue.trim()) return;

            const nextFilters: DtrFilters = {
                ...dtrFilters,
                search: searchValue.trim(),
                status: '',
                dateFrom: dtrFilters.dateFrom || DTR_HISTORY_START_DATE,
                dateTo: dtrFilters.dateTo || getTodayDateKey(),
            };

            setActiveTab('dtr');
            setDtrFilters(nextFilters);
            setDtrPage(1);
            void fetchDtr(1, nextFilters);
        };

        window.addEventListener('attendance:view-employee-logs', handleViewEmployeeLogs);

        return () => {
            window.removeEventListener('attendance:view-employee-logs', handleViewEmployeeLogs);
        };
    }, [dtrFilters, fetchDtr]);

    useEffect(() => {
        void fetchOt();
        void fetchSummary();
    }, [fetchOt, fetchSummary]);

    useEffect(() => {
        if (activeTab !== 'dtr') return;

        void fetchDtr(1, dtrFilters);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, fetchDtr]);

    useEffect(() => {
        if (activeTab !== 'setup') return;

        void fetchShifts();
    }, [activeTab, fetchShifts]);

    const statusBadge: StatusBadgeMap = {
        Present: 'badge-success',
        Late: 'badge-warning',
        Absent: 'badge-danger',
        Pending: 'badge-warning',
        Approved: 'badge-success',
        Rejected: 'badge-danger',
        Active: 'badge-success',
        Inactive: 'badge-neutral',
    };

    const search = dtrFilters.search.trim().toLowerCase();
    const rawStatus = (dtrFilters.status ?? '').trim();
    const sortBy = (dtrFilters.sort ?? 'latest').trim();

    const processedDtrRecords = dtrRecords
        .filter((record) => {
            const matchesSearch =
                !search ||
                record.name.toLowerCase().includes(search) ||
                record.empId.toLowerCase().includes(search);

            const matchesStatus =
                !rawStatus ||
                rawStatus === 'All' ||
                (rawStatus === 'Present' && record.status === 'Present') ||
                (rawStatus === 'Late' && record.status === 'Late') ||
                (rawStatus === 'Absent' && record.status === 'Absent') ||
                (rawStatus === 'Undertime' && record.isUndertime) ||
                (rawStatus === 'Overtime' && record.overtimeStatus === 'Approved');

            return matchesSearch && matchesStatus;
        })
        .sort((a, b) => {
            const left = new Date(a.date).getTime();
            const right = new Date(b.date).getTime();

            if (Number.isNaN(left) || Number.isNaN(right)) return 0;

            return sortBy === 'oldest' ? left - right : right - left;
        });

    const totalDtrPages = Math.max(1, Math.ceil(processedDtrRecords.length / dtrPageSize));
    const safeDtrPage = Math.min(dtrPage, totalDtrPages);
    const dtrStartIndex = (safeDtrPage - 1) * dtrPageSize;
    const filteredDtrRecords = processedDtrRecords.slice(
        dtrStartIndex,
        dtrStartIndex + dtrPageSize
    );

    useEffect(() => {
        if (dtrPage > totalDtrPages) {
            setDtrPage(totalDtrPages);
        }
    }, [dtrPage, totalDtrPages]);

    const statCards = [
        {
            label: 'Present',
            value: summary?.presentCount ?? 0,
            icon: CheckCircle,
            gradient: 'linear-gradient(135deg, #059669, #10b981)',
        },
        {
            label: 'Overtime',
            value: summary?.approvedOvertimeRequests ?? 0,
            icon: Clock,
            gradient: 'linear-gradient(135deg, #2563eb, #3b82f6)',
        },
        {
            label: 'Late',
            value: summary?.lateCount ?? 0,
            icon: AlertTriangle,
            gradient: 'linear-gradient(135deg, #d97706, #f59e0b)',
        },
        {
            label: 'Absent',
            value: summary?.absentCount ?? 0,
            icon: XCircle,
            gradient: 'linear-gradient(135deg, #dc2626, #ef4444)',
        },
    ];

    const convertDisplayTimeTo24Hour = (time: string) => {
        const [rawTime, modifier] = time.split(' ');
        const [hoursRaw, minutes] = rawTime.split(':').map(Number);
        let hours = hoursRaw;

        if (modifier === 'PM' && hours !== 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;

        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    };

    const format24HourToDisplay = (time: string) => {
        const [hourString, minute] = time.split(':');
        let hour = Number(hourString);
        const modifier = hour >= 12 ? 'PM' : 'AM';

        if (hour === 0) hour = 12;
        else if (hour > 12) hour -= 12;

        return `${String(hour).padStart(2, '0')}:${minute} ${modifier}`;
    };

    const handleViewDtr = (record: AdminDtrRecord) => {
        setSelectedDtrRecord(record);
        setShowViewDtrModal(true);
    };

    const handleEditDtrClick = (record: AdminDtrRecord) => {
        setPendingEditRecord({ ...record });
        setShowConfirmEditModal(true);
    };

    const handleCancelConfirmEdit = () => {
        if (savingDtrEdit) return;
        setShowConfirmEditModal(false);
        setPendingEditRecord(null);
    };

    const handleConfirmSaveDtrEdit = async () => {
        if (!pendingEditRecord) return;

        const editedRowId = pendingEditRecord.id;

        try {
            setSavingDtrEdit(true);

            await updateAttendanceLog({
                id: Number(pendingEditRecord.id),
                date: toApiDateString(pendingEditRecord.date),
                timeIn: toApiTimeString(pendingEditRecord.timeIn),
                timeOut: toApiTimeString(pendingEditRecord.timeOut),
                status: pendingEditRecord.status,
                isOT: pendingEditRecord.overtimeStatus === 'Approved',
            });

            setShowConfirmEditModal(false);
            setPendingEditRecord(null);

            await fetchDtr(1, dtrFilters);
            await fetchSummary();

            setRecentlyEditedRowId(editedRowId);
            toast.success('Attendance record updated successfully.');

            window.setTimeout(() => {
                setRecentlyEditedRowId((current) =>
                    current === editedRowId ? null : current
                );
            }, 3000);
        } catch (error: unknown) {
            console.error(error);
            toast.error(getErrorMessage(error, 'Failed to update attendance record.'));
        } finally {
            setSavingDtrEdit(false);
        }
    };

    const handleUpdateOvertimeStatus = async (id: number, newStatus: 'Approved' | 'Rejected') => {
        const action = newStatus === 'Approved' ? 'Approve' : 'Reject';

        try {
            setReviewingOtId(id);

            await reviewOvertimeRequest(id, {
                action,
                remarks: newStatus === 'Approved' ? 'Approved.' : 'Rejected.',
            });

            await fetchOt();
            await fetchDtr(1, dtrFilters);
            await fetchSummary();
        } catch (error: unknown) {
            console.error(error);
            alert(getErrorMessage(error, `Failed to ${action.toLowerCase()} overtime request.`));
        } finally {
            setReviewingOtId(null);
        }
    };

    const handleAssignOvertime = async () => {
        setAssignOtError(null);

        if (
            !assignOtForm.employeeId.trim() ||
            !assignOtForm.dateFrom ||
            !assignOtForm.dateTo ||
            !assignOtForm.requestedMinutes ||
            !assignOtForm.reason.trim()
        ) {
            setAssignOtError('Please complete all overtime assignment fields.');
            return;
        }

        try {
            setSubmittingAssignOt(true);

            await adminAssignOvertimeRequest({
                employeeId: assignOtForm.employeeId.trim(),
                dateFrom: assignOtForm.dateFrom,
                dateTo: assignOtForm.dateTo,
                requestedMinutes: Number(assignOtForm.requestedMinutes),
                reason: assignOtForm.reason.trim(),
            });

            toast.success('Overtime assigned successfully.');

            setShowAssignOvertimeModal(false);
            setAssignOtError(null);
            setAssignOtForm({
                employeeId: '',
                dateFrom: '',
                dateTo: '',
                requestedMinutes: '',
                reason: '',
            });

            await fetchOt();
            await fetchDtr(1, dtrFilters);
            await fetchSummary();
        } catch (error: unknown) {
            console.error(error);
            setAssignOtError(getErrorMessage(error, 'Failed to assign overtime.'));
        } finally {
            setSubmittingAssignOt(false);
        }
    };

    const handleAddShift = () => {
        setShifts((prev) => [
            ...prev,
            {
                id: Date.now(),
                name: shiftForm.name,
                timeIn: format24HourToDisplay(shiftForm.timeIn),
                timeOut: format24HourToDisplay(shiftForm.timeOut),
                grace: `${shiftForm.grace} min`,
                employees: 0,
                assignedCount: 0,
                status: shiftForm.status,
            },
        ]);

        setShowAddShiftModal(false);
        setShiftForm({
            name: '',
            timeIn: '08:00',
            timeOut: '17:00',
            grace: '15',
            status: 'Active',
        });
    };

    const handleEditShiftClick = (shift: AdminShiftRecord) => {
        setEditingShift(shift);
        setShiftForm({
            name: shift.name,
            timeIn: convertDisplayTimeTo24Hour(shift.timeIn),
            timeOut: convertDisplayTimeTo24Hour(shift.timeOut),
            grace: shift.grace.replace(' min', ''),
            status: shift.status,
        });
        setShowEditShiftModal(true);
    };

    const handleEditShift = () => {
        if (!editingShift) return;

        setShifts((prev) =>
            prev.map((shift) =>
                shift.id === editingShift.id
                    ? {
                          ...shift,
                          name: shiftForm.name,
                          timeIn: format24HourToDisplay(shiftForm.timeIn),
                          timeOut: format24HourToDisplay(shiftForm.timeOut),
                          grace: `${shiftForm.grace} min`,
                          status: shiftForm.status,
                      }
                    : shift
            )
        );

        setShowEditShiftModal(false);
        setEditingShift(null);
        setShiftForm({
            name: '',
            timeIn: '08:00',
            timeOut: '17:00',
            grace: '15',
            status: 'Active',
        });
    };

    const handleExportCsv = () => {
        if (processedDtrRecords.length === 0) {
            alert('No data to export.');
            return;
        }

        const headers = [
            'Employee ID',
            'Name',
            'Date',
            'Time In',
            'Time Out',
            'Status',
            'Late Minutes',
            'Undertime Minutes',
            'Overtime Minutes',
            'Overtime Status',
            'Rendered Minutes',
            'Credited Minutes',
        ];

        const rows = processedDtrRecords.map((record) => [
            record.empId,
            record.name,
            record.date,
            record.timeIn,
            record.timeOut,
            record.status,
            record.lateMinutes,
            record.undertimeMinutes,
            record.overtimeMinutes,
            record.overtimeStatus,
            record.renderedMinutes,
            record.creditedMinutes,
        ]);

        const csvContent = [headers, ...rows]
            .map((row) =>
                row
                    .map((value) => {
                        const safeValue = value ?? '';
                        return `"${String(safeValue).replace(/"/g, '""')}"`;
                    })
                    .join(',')
            )
            .join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.setAttribute('download', `attendance_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    };

    const assignOtAttendanceRecords: AssignOvertimeAttendanceOption[] = dtrRecords.map((record) => ({
        employeeNumber: record.empId,
        date: record.date,
        timeIn: record.timeIn,
        timeOut: record.timeOut,
        status: record.status,
    }));

    return (
        <div className="space-y-6">
            <div className="page-header animate-fade-in-up">
                <h1>Time & Attendance</h1>
                <p>Monitor daily attendance, overtime, and shift schedules</p>
            </div>

            <AdminAttendanceSummaryCards statCards={statCards} />

            <div className="pro-card animate-fade-in-up" style={{ animationDelay: '0.4s', opacity: 0 }}>
                <div className="px-6 pt-4">
                    <AttendanceTabs activeTab={activeTab} onChange={setActiveTab} isAdmin />
                </div>

                <div className="p-6">
                    {activeTab === 'dtr' && (
                        <AdminDtrTab
                            loadingDtr={loadingDtr}
                            dtrFilters={dtrFilters}
                            setDtrFilters={setDtrFilters}
                            setDtrPage={setDtrPage}
                            filteredDtrRecords={filteredDtrRecords}
                            statusBadge={statusBadge}
                            onEditDtr={handleEditDtrClick}
                            onViewDtr={handleViewDtr}
                            onExportCsv={handleExportCsv}
                            dtrPage={dtrPage}
                            totalDtrPages={totalDtrPages}
                            recentlyEditedRowId={recentlyEditedRowId}
                        />
                    )}

                    {activeTab === 'ot' && (
                        <AdminOtTab
                            loadingOt={loadingOt}
                            overtimeRequests={overtimeRequests}
                            statusBadge={statusBadge}
                            reviewingOtId={reviewingOtId}
                            onApprove={(id) => handleUpdateOvertimeStatus(id, 'Approved')}
                            onReject={(id) => handleUpdateOvertimeStatus(id, 'Rejected')}
                            onShowAssignModal={() => {
                                setAssignOtError(null);
                                setShowAssignOvertimeModal(true);
                            }}
                        />
                    )}

                    {activeTab === 'setup' && (
                        <AdminSetupTab
                            shifts={shifts}
                            statusBadge={statusBadge}
                            onEditShift={handleEditShiftClick}
                            onAddShift={() => {
                                setShiftForm({
                                    name: '',
                                    timeIn: '08:00',
                                    timeOut: '17:00',
                                    grace: '15',
                                    status: 'Active',
                                });
                                setShowAddShiftModal(true);
                            }}
                        />
                    )}
                </div>
            </div>

            <ConfirmAttendanceUpdateModal
                isOpen={showConfirmEditModal}
                record={pendingEditRecord}
                saving={savingDtrEdit}
                onCancel={handleCancelConfirmEdit}
                onConfirm={handleConfirmSaveDtrEdit}
            />

            <ViewAttendanceModal
                isOpen={showViewDtrModal}
                record={selectedDtrRecord}
                statusBadge={statusBadge}
                onClose={() => {
                    setShowViewDtrModal(false);
                    setSelectedDtrRecord(null);
                }}
            />

            <AssignOvertimeModal
                isOpen={showAssignOvertimeModal}
                form={assignOtForm}
                employees={assignOtEmployees}
                loadingEmployees={loadingAssignOtEmployees}
                attendanceRecords={assignOtAttendanceRecords}
                submitting={submittingAssignOt}
                errorMessage={assignOtError}
                onChange={setAssignOtForm}
                onClose={() => {
                    if (submittingAssignOt) return;

                    setShowAssignOvertimeModal(false);
                    setAssignOtError(null);
                }}
                onSubmit={handleAssignOvertime}
            />

            {showAddShiftModal && (
                <ShiftFormModal
                    title="Add Shift"
                    submitLabel="Add Shift"
                    onSubmit={handleAddShift}
                    onClose={() => setShowAddShiftModal(false)}
                    shiftForm={shiftForm}
                    setShiftForm={setShiftForm}
                />
            )}

            {showEditShiftModal && (
                <ShiftFormModal
                    title="Edit Shift"
                    submitLabel="Save Changes"
                    onSubmit={handleEditShift}
                    onClose={() => setShowEditShiftModal(false)}
                    shiftForm={shiftForm}
                    setShiftForm={setShiftForm}
                />
            )}
        </div>
    );
};

const ShiftFormModal = ({
    title,
    onSubmit,
    submitLabel,
    onClose,
    shiftForm,
    setShiftForm,
}: ShiftFormModalProps) => (
    <div className="pro-modal-overlay">
        <div className="pro-modal max-w-md w-full mx-4 sm:mx-auto" onClick={(e) => e.stopPropagation()}>
            <div className="pro-modal-header">
                <h3>{title}</h3>
                <button onClick={onClose} className="btn-ghost btn-icon" type="button">
                    <X className="w-5 h-5 text-gray-400" />
                </button>
            </div>
            <div className="pro-modal-body space-y-4">
                <div>
                    <label className="pro-label">Shift Name</label>
                    <input
                        type="text"
                        value={shiftForm.name}
                        onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
                        className="pro-input"
                        placeholder="e.g. Morning Shift"
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="pro-label">Time In</label>
                        <input
                            type="time"
                            value={shiftForm.timeIn}
                            onChange={(e) => setShiftForm({ ...shiftForm, timeIn: e.target.value })}
                            className="pro-input"
                        />
                    </div>
                    <div>
                        <label className="pro-label">Time Out</label>
                        <input
                            type="time"
                            value={shiftForm.timeOut}
                            onChange={(e) => setShiftForm({ ...shiftForm, timeOut: e.target.value })}
                            className="pro-input"
                        />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="pro-label">Grace Period (min)</label>
                        <input
                            type="number"
                            value={shiftForm.grace}
                            onChange={(e) => setShiftForm({ ...shiftForm, grace: e.target.value })}
                            className="pro-input"
                        />
                    </div>
                    <div>
                        <label className="pro-label">Status</label>
                        <select
                            value={shiftForm.status}
                            onChange={(e) => setShiftForm({ ...shiftForm, status: e.target.value as ShiftFormState['status'] })}
                            className="pro-select"
                        >
                            <option>Active</option>
                            <option>Inactive</option>
                        </select>
                    </div>
                </div>
            </div>
            <div className="pro-modal-footer">
                <button onClick={onClose} className="btn btn-secondary" type="button">Cancel</button>
                <button onClick={onSubmit} className="btn btn-primary" type="button">{submitLabel}</button>
            </div>
        </div>
    </div>
);

export default AdminAttendance;