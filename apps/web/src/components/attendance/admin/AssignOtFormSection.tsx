import {
  AlertCircle,
  CalendarDays,
  ChevronDown,
  Clock3,
  FileText,
  UserRound,
} from 'lucide-react';

import { useMemo, useState } from 'react';

import AssignOtSummaryCards from './AssignOtSummaryCards';

import {
  formatEmployeeName,
  OVERTIME_HOUR_OPTIONS,
} from './assignOvertimeModalUtils';

import type {
  AssignOtFormState,
  AssignOvertimeEmployeeOption,
} from './assignOvertimeModalUtils';

type Props = {
  form: AssignOtFormState;
  employees: AssignOvertimeEmployeeOption[];
  loadingEmployees: boolean;
  submitting: boolean;
  helperMessage: string;
  isWarningState: boolean;
  formattedErrorMessage: string | null;
  validCount: number;
  pendingCount: number;
  noDtrCount: number;
  totalRequestedMinutes: number;
  onChange: (value: AssignOtFormState) => void;
};

const fieldBaseClass =
  'h-12 w-full rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';

const dateFieldClass =
  'h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-2 text-[13px] font-semibold text-slate-700 shadow-sm outline-none transition-all [color-scheme:light] focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';

const dropdownMenuClass =
  'absolute left-0 top-[calc(100%+8px)] z-50 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-2xl';

const dropdownItemClass =
  'flex w-full cursor-pointer items-center rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 transition-all hover:bg-emerald-50 hover:text-emerald-700';

const AssignOtFormSection = ({
  form,
  employees,
  loadingEmployees,
  submitting,
  helperMessage,
  isWarningState,
  formattedErrorMessage,
  validCount,
  pendingCount,
  noDtrCount,
  totalRequestedMinutes,
  onChange,
}: Props) => {
  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState(false);
  const [hoursDropdownOpen, setHoursDropdownOpen] = useState(false);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === form.employeeId),
    [employees, form.employeeId]
  );

  const selectedHour = useMemo(
    () =>
      OVERTIME_HOUR_OPTIONS.find(
        (option) => String(option.minutes) === form.requestedMinutes
      ),
    [form.requestedMinutes]
  );

  return (
    <div className="space-y-4 border-b border-slate-200 px-6 py-5 lg:border-b-0 lg:border-r">
      <div>
        <label className="pro-label">Employee</label>

        <div className="relative">
          <UserRound className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />

          <button
            type="button"
            disabled={submitting || loadingEmployees}
            onClick={() => {
              setEmployeeDropdownOpen((prev) => !prev);
              setHoursDropdownOpen(false);
            }}
            className={`${fieldBaseClass} flex items-center pl-11 pr-10 text-left`}
          >
            <span className="block min-w-0 flex-1 truncate">
              {selectedEmployee
                ? formatEmployeeName(selectedEmployee)
                : loadingEmployees
                  ? 'Loading employees...'
                  : 'Select employee'}
            </span>
          </button>

          <ChevronDown
            className={`pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 transition-transform ${
              employeeDropdownOpen ? 'rotate-180' : ''
            }`}
          />

          {employeeDropdownOpen && (
            <div className={dropdownMenuClass}>
              {employees.length === 0 ? (
                <div className="px-3 py-2 text-sm font-semibold text-slate-400">
                  No employees found
                </div>
              ) : (
                employees.map((employee) => {
                  const isSelected = employee.id === form.employeeId;

                  return (
                    <button
                      key={employee.id}
                      type="button"
                      onClick={() => {
                        onChange({
                          ...form,
                          employeeId: employee.id,
                        });

                        setEmployeeDropdownOpen(false);
                      }}
                      className={`${dropdownItemClass} ${
                        isSelected ? 'bg-emerald-50 text-emerald-700' : ''
                      }`}
                    >
                      {formatEmployeeName(employee)}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="pro-label">Date From</label>

          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              type="date"
              value={form.dateFrom}
              onChange={(event) =>
                onChange({
                  ...form,
                  dateFrom: event.target.value,
                })
              }
              className={dateFieldClass}
              disabled={submitting}
            />
          </div>
        </div>

        <div>
          <label className="pro-label">Date To</label>

          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              type="date"
              value={form.dateTo}
              onChange={(event) =>
                onChange({
                  ...form,
                  dateTo: event.target.value,
                })
              }
              className={dateFieldClass}
              disabled={submitting}
            />
          </div>
        </div>
      </div>

      <div>
        <label className="pro-label">Overtime Hours Per Day</label>

        <div className="relative">
          <Clock3 className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />

          <button
            type="button"
            disabled={submitting}
            onClick={() => {
              setHoursDropdownOpen((prev) => !prev);
              setEmployeeDropdownOpen(false);
            }}
            className={`${fieldBaseClass} flex items-center pl-11 pr-10 text-left`}
          >
            <span className="block min-w-0 flex-1 truncate">
              {selectedHour ? selectedHour.label : 'Select hours'}
            </span>
          </button>

          <ChevronDown
            className={`pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 transition-transform ${
              hoursDropdownOpen ? 'rotate-180' : ''
            }`}
          />

          {hoursDropdownOpen && (
            <div className={dropdownMenuClass}>
              {OVERTIME_HOUR_OPTIONS.map((option) => {
                const isSelected =
                  String(option.minutes) === form.requestedMinutes;

                return (
                  <button
                    key={option.minutes}
                    type="button"
                    onClick={() => {
                      onChange({
                        ...form,
                        requestedMinutes: String(option.minutes),
                      });

                      setHoursDropdownOpen(false);
                    }}
                    className={`${dropdownItemClass} ${
                      isSelected ? 'bg-emerald-50 text-emerald-700' : ''
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <p className="mt-2 text-xs font-medium text-slate-500">
          Max 3 hours per day. Final credited overtime depends on actual attendance.
        </p>
      </div>

      <AssignOtSummaryCards
        validCount={validCount}
        pendingCount={pendingCount}
        noDtrCount={noDtrCount}
        totalRequestedMinutes={totalRequestedMinutes}
      />

      <div>
        <label className="pro-label">Reason</label>

        <div className="relative">
          <FileText className="pointer-events-none absolute left-3.5 top-4 h-4 w-4 text-slate-400" />

          <textarea
            value={form.reason}
            onChange={(event) =>
              onChange({
                ...form,
                reason: event.target.value,
              })
            }
            className="min-h-[120px] w-full resize-none rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm font-semibold text-slate-700 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            placeholder="Enter overtime reason"
            disabled={submitting}
          />
        </div>
      </div>

      <div
        className={`rounded-xl border px-4 py-3 text-sm font-medium ${
          isWarningState
            ? 'border-amber-200 bg-amber-50 text-amber-700'
            : 'border-blue-200 bg-blue-50 text-blue-700'
        }`}
      >
        <div className="flex gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{helperMessage}</p>
        </div>
      </div>

      {formattedErrorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {formattedErrorMessage}
        </div>
      )}
    </div>
  );
};

export default AssignOtFormSection;