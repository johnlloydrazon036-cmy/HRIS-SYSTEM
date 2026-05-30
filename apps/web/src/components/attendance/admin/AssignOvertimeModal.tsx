import { CalendarClock, X } from 'lucide-react';
import { createPortal } from 'react-dom';

import AssignOtFormSection from './AssignOtFormSection';
import AssignOtPreviewTable from './AssignOtPreviewTable';

import {
  buildPreviewDays,
  formatErrorMessage,
  MAX_ADMIN_OT_MINUTES_PER_DAY,
} from './assignOvertimeModalUtils';

import type {
  AssignOtFormState,
  AssignOvertimeAttendanceOption,
  AssignOvertimeEmployeeOption,
  PreviewDay,
} from './assignOvertimeModalUtils';

export type {
  AssignOtFormState,
  AssignOvertimeAttendanceOption,
  AssignOvertimeEmployeeOption,
};

type Props = {
  isOpen: boolean;
  form: AssignOtFormState;
  employees: AssignOvertimeEmployeeOption[];
  loadingEmployees: boolean;
  attendanceRecords: AssignOvertimeAttendanceOption[];
  submitting: boolean;
  errorMessage?: string | null;
  onChange: (value: AssignOtFormState) => void;
  onClose: () => void;
  onSubmit: () => void;
};

type PreviewDayStatus =
  | 'assignable'
  | 'needs-dtr'
  | 'blocked'
  | 'invalid-range';

type RuntimePreviewDay = PreviewDay & {
  status: PreviewDayStatus;
  maxMinutes?: number;
  message?: string;
};

const MAX_ADMIN_OT_DAYS = 5;

const countInclusiveDays = (dateFrom: string, dateTo: string) => {
  if (!dateFrom || !dateTo) return 0;

  const start = new Date(`${dateFrom}T00:00:00`);
  const end = new Date(`${dateTo}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  if (end < start) return -1;

  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay) + 1;
};

const AssignOvertimeModal = ({
  isOpen,
  form,
  employees,
  loadingEmployees,
  attendanceRecords,
  submitting,
  errorMessage,
  onChange,
  onClose,
  onSubmit,
}: Props) => {
  if (!isOpen) return null;

  const requestedMinutes = Number(form.requestedMinutes || 0);

  const previewDays = buildPreviewDays({
    form,
    employees,
    attendanceRecords,
  }) as RuntimePreviewDay[];

  const previewDaysForRules = previewDays.slice(0, MAX_ADMIN_OT_DAYS);

  const formattedErrorMessage = formatErrorMessage(errorMessage);

  const selectedDayCount = countInclusiveDays(
    form.dateFrom,
    form.dateTo
  );

  const hasInvalidDateRange = selectedDayCount < 0;

  const exceedsMaxSelectedDays =
    selectedDayCount > MAX_ADMIN_OT_DAYS;

  const validDays = previewDaysForRules.filter(
    (day) =>
      day.status === 'assignable' &&
      !day.message?.toLowerCase().includes('pending')
  );

  const inProgressDays = previewDaysForRules.filter(
    (day) =>
      day.status === 'assignable' &&
      day.message?.toLowerCase().includes('pending')
  );

  const noAttendanceDays = previewDaysForRules.filter(
    (day) => day.status === 'needs-dtr'
  );

  const hardBlockedDays = previewDaysForRules.filter(
    (day) =>
      day.status === 'blocked' ||
      day.status === 'invalid-range'
  );

  const assignableDays = [
    ...validDays,
    ...inProgressDays,
    ...noAttendanceDays,
  ];

  const requestedMinutesExceedsDay = validDays.some(
    (day) =>
      Number.isFinite(requestedMinutes) &&
      requestedMinutes >
        (day.maxMinutes ?? MAX_ADMIN_OT_MINUTES_PER_DAY)
  );

  const hasCompleteRange =
    !!form.employeeId &&
    !!form.dateFrom &&
    !!form.dateTo;

  const hasRequestedMinutesError =
    !Number.isFinite(requestedMinutes) ||
    requestedMinutes < 1 ||
    requestedMinutes > MAX_ADMIN_OT_MINUTES_PER_DAY;

  const totalRequestedMinutes =
    Number.isFinite(requestedMinutes) &&
    requestedMinutes > 0
      ? requestedMinutes * assignableDays.length
      : 0;

  const helperMessage = (() => {
    if (!hasCompleteRange) {
      return 'Select an employee and date range to preview overtime days.';
    }

    if (hasInvalidDateRange) {
      return 'Date To must be the same as or later than Date From.';
    }

    if (exceedsMaxSelectedDays) {
      return `Only ${MAX_ADMIN_OT_DAYS} overtime days are allowed per assignment.`;
    }

    if (
      hardBlockedDays.length > 0 &&
      assignableDays.length > 0
    ) {
      return 'Some selected days are invalid for the current schedule.';
    }

    if (hardBlockedDays.length > 0) {
      return 'Selected days are invalid for the current schedule.';
    }

    if (requestedMinutesExceedsDay) {
      return 'Selected overtime hours exceed available overtime capacity.';
    }

    if (validDays.length > 0) {
      return 'Some selected days are already attendance-qualified for overtime.';
    }

    if (inProgressDays.length > 0) {
      return 'Some selected days still require employee time out.';
    }

    if (noAttendanceDays.length > 0) {
      return 'Admin-assigned overtime is approved immediately. Final rendering depends on attendance.';
    }

    return 'No assignable overtime days found.';
  })();

  const isWarningState =
    hasInvalidDateRange ||
    exceedsMaxSelectedDays ||
    hardBlockedDays.length > 0 ||
    requestedMinutesExceedsDay ||
    hasRequestedMinutesError;

  const isSubmitDisabled =
    submitting ||
    loadingEmployees ||
    !form.employeeId.trim() ||
    !form.dateFrom ||
    !form.dateTo ||
    !form.requestedMinutes ||
    hasInvalidDateRange ||
    exceedsMaxSelectedDays ||
    hasRequestedMinutesError ||
    requestedMinutesExceedsDay ||
    hardBlockedDays.length > 0 ||
    assignableDays.length === 0 ||
    !form.reason.trim();

  return createPortal(
    <div
      className="fixed inset-0 z-[2147483647] flex min-h-dvh items-center justify-center bg-[rgba(15,23,42,0.5)] p-4 backdrop-blur-[4px]"
      onClick={submitting ? undefined : onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-4xl animate-fade-in-up flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <CalendarClock className="h-5 w-5" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-gray-900">
                Assign Overtime
              </h3>

              <p className="mt-1 text-sm font-medium text-slate-500">
                Admin-assigned overtime is approved immediately.
                Attendance determines final overtime rendering.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-slate-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={submitting}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid flex-1 overflow-y-auto lg:grid-cols-[380px_1fr]">
          <AssignOtFormSection
            form={form}
            employees={employees}
            loadingEmployees={loadingEmployees}
            submitting={submitting}
            helperMessage={helperMessage}
            isWarningState={isWarningState}
            formattedErrorMessage={formattedErrorMessage}
            validCount={validDays.length}
            pendingCount={inProgressDays.length}
            noDtrCount={noAttendanceDays.length}
            totalRequestedMinutes={totalRequestedMinutes}
            onChange={onChange}
          />

          <AssignOtPreviewTable
            previewDays={previewDaysForRules}
            requestedMinutes={requestedMinutes}
          />
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            disabled={submitting}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSubmit}
            className={`btn btn-primary ${
              isSubmitDisabled
                ? 'cursor-not-allowed opacity-50 shadow-none hover:translate-y-0 hover:shadow-none'
                : ''
            }`}
            disabled={isSubmitDisabled}
          >
            {submitting ? 'Assigning...' : 'Assign Overtime'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AssignOvertimeModal;