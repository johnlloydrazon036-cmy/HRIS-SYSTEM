import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Info,
  RefreshCcw,
  Search,
  User,
  X,
} from "lucide-react";
import type { Shift } from "../../../lib/attendance";

type EmployeeOption = {
  id: string;
  employeeNumber?: string | null;
  fullName: string;
  department?: string | null;
  position?: string | null;
  isActive?: boolean;
};

type CurrentAssignment = {
  id: number;
  shiftId: number;
  shiftName: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  isActive: boolean;
};

type Props = {
  open: boolean;
  employees: EmployeeOption[];
  activeShiftOptions: Shift[];
  selectedEmployeeId: string;
  selectedShiftId: number | null;
  effectiveFrom: string;
  loadingEmployees: boolean;
  assigning: boolean;
  assignmentError: string | null;
  currentAssignment?: CurrentAssignment | null;
  formatEmployeeName: (value?: string | null) => string;
  onClose: () => void;
  onEmployeeChange: (value: string) => void;
  onShiftChange: (value: number | null) => void;
  onEffectiveFromChange: (value: string) => void;
  onAssign: () => void;
};

const formatDate = (value?: string | null) => {
  if (!value) return "--";

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const normalizeModalError = (value?: string | null) => {
  const normalized = value?.toLowerCase() ?? "";

  if (
    normalized.includes("overlap") ||
    normalized.includes("history") ||
    normalized.includes("starting on this date") ||
    normalized.includes("covered")
  ) {
    return "Selected effective date is already covered by this employee's shift assignment history. Choose a later effective date.";
  }

  return value;
};

const AssignShiftModal = ({
  open,
  employees,
  activeShiftOptions,
  selectedEmployeeId,
  selectedShiftId,
  effectiveFrom,
  loadingEmployees,
  assigning,
  assignmentError,
  currentAssignment,
  formatEmployeeName,
  onClose,
  onEmployeeChange,
  onShiftChange,
  onEffectiveFromChange,
  onAssign,
}: Props) => {
  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState(false);
  const [shiftDropdownOpen, setShiftDropdownOpen] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");

  const employeeDropdownRef = useRef<HTMLDivElement | null>(null);
  const shiftDropdownRef = useRef<HTMLDivElement | null>(null);

  const selectedEmployee = useMemo(
    () =>
      employees.find((employee) => employee.id === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId],
  );

  const selectedShift = useMemo(
    () =>
      activeShiftOptions.find((shift) => shift.id === selectedShiftId) ?? null,
    [activeShiftOptions, selectedShiftId],
  );

  const filteredEmployees = useMemo(() => {
    const query = employeeSearch.trim().toLowerCase();

    if (!query) return employees;

    return employees.filter((employee) => {
      const employeeName = formatEmployeeName(employee.fullName).toLowerCase();
      const employeeNumber = employee.employeeNumber?.toLowerCase() ?? "";

      return employeeName.includes(query) || employeeNumber.includes(query);
    });
  }, [employeeSearch, employees, formatEmployeeName]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        employeeDropdownRef.current &&
        !employeeDropdownRef.current.contains(target)
      ) {
        setEmployeeDropdownOpen(false);
      }

      if (
        shiftDropdownRef.current &&
        !shiftDropdownRef.current.contains(target)
      ) {
        setShiftDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  if (!open) return null;

  const isReassignment = !!currentAssignment;
  const isSameShiftSelected =
    !!currentAssignment && selectedShiftId === currentAssignment.shiftId;
  const displayAssignmentError = normalizeModalError(assignmentError);

  const employeeHelperMessage = displayAssignmentError
    ? displayAssignmentError
    : selectedEmployee
      ? `${formatEmployeeName(
          selectedEmployee.fullName,
        )} will receive a new shift assignment. If this employee was recently unassigned, choose an effective date after the last recorded assignment.`
      : null;

  const sameShiftMessage = isSameShiftSelected
    ? "Employee is already assigned to this shift. Select a different shift to reassign."
    : null;

  const isSubmitDisabled =
    assigning ||
    !selectedEmployeeId ||
    !selectedShiftId ||
    !effectiveFrom ||
    isSameShiftSelected;

  const employeeLabel = selectedEmployee
    ? selectedEmployee.employeeNumber
      ? `${formatEmployeeName(selectedEmployee.fullName)} (${selectedEmployee.employeeNumber})`
      : formatEmployeeName(selectedEmployee.fullName)
    : "Select employee";

  const shiftLabel = selectedShift
    ? `${selectedShift.name}${
        currentAssignment?.shiftId === selectedShift.id ? " (Current)" : ""
      }`
    : "Select shift";

  const handleClose = () => {
    if (assigning) return;

    setEmployeeDropdownOpen(false);
    setShiftDropdownOpen(false);
    setEmployeeSearch("");
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-visible rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Assign / Reassign Shift
            </h3>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Manage an employee&apos;s active shift assignment for attendance
              eligibility.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={assigning}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div ref={employeeDropdownRef} className="relative">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
              Employee
            </label>

            <button
              type="button"
              disabled={loadingEmployees || assigning}
              onClick={() => {
                setEmployeeDropdownOpen((current) => !current);
                setShiftDropdownOpen(false);
              }}
              className="flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-left text-sm font-semibold text-slate-700 outline-none transition hover:border-emerald-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex min-w-0 items-center gap-2">
                <User className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="truncate">{employeeLabel}</span>
              </span>

              <ChevronDown
                className={`h-4 w-4 shrink-0 text-slate-400 transition ${
                  employeeDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {employeeDropdownOpen && (
              <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[10000] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                <div className="border-b border-slate-100 px-3 py-2">
                  <div className="flex h-9 items-center gap-2 rounded-lg bg-slate-50 px-3 text-sm text-slate-500">
                    <Search className="h-4 w-4" />
                    <input
                      value={employeeSearch}
                      onChange={(event) => setEmployeeSearch(event.target.value)}
                      placeholder="Search employee..."
                      className="h-full flex-1 bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto p-2">
                  {filteredEmployees.length === 0 ? (
                    <div className="px-3 py-3 text-sm font-medium text-slate-400">
                      No employees found.
                    </div>
                  ) : (
                    filteredEmployees.map((employee) => {
                      const isSelected = employee.id === selectedEmployeeId;
                      const employeeName = formatEmployeeName(
                        employee.fullName,
                      );
                      const label = employee.employeeNumber
                        ? `${employeeName} (${employee.employeeNumber})`
                        : employeeName;

                      return (
                        <button
                          key={employee.id}
                          type="button"
                          onClick={() => {
                            onEmployeeChange(employee.id);
                            setEmployeeDropdownOpen(false);
                            setEmployeeSearch("");
                          }}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${
                            isSelected
                              ? "bg-emerald-50 text-emerald-700"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span className="truncate">{label}</span>
                          {isSelected && (
                            <Check className="h-4 w-4 shrink-0" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {currentAssignment && (
            <div className="rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3">
              <div className="mb-3 flex items-start gap-2 text-sm font-bold text-blue-800">
                <RefreshCcw className="mt-0.5 h-4 w-4 shrink-0" />
                Current Active Assignment
              </div>

              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-xl border border-blue-100 bg-white px-3 py-2">
                  <p className="text-[11px] font-black uppercase tracking-wide text-blue-400">
                    Current Shift
                  </p>
                  <div className="mt-1 flex items-center gap-2 font-bold text-slate-700">
                    <Clock3 className="h-4 w-4 text-slate-400" />
                    {currentAssignment.shiftName || "--"}
                  </div>
                </div>

                <div className="rounded-xl border border-blue-100 bg-white px-3 py-2">
                  <p className="text-[11px] font-black uppercase tracking-wide text-blue-400">
                    Effective From
                  </p>
                  <div className="mt-1 flex items-center gap-2 font-bold text-slate-700">
                    <CalendarDays className="h-4 w-4 text-slate-400" />
                    {formatDate(currentAssignment.effectiveFrom)}
                  </div>
                </div>
              </div>

              <p className="mt-3 text-xs font-medium leading-relaxed text-blue-700">
                Assigning a different shift will automatically close the current
                assignment history before the new effective date.
              </p>
            </div>
          )}

          {selectedEmployee && !currentAssignment && employeeHelperMessage && (
            <div
              className={`flex items-start gap-2 rounded-xl px-3 py-2 text-xs font-medium leading-relaxed ${
                displayAssignmentError
                  ? "border border-amber-200 bg-amber-50 text-amber-700"
                  : "border border-slate-200 bg-slate-50 text-slate-600"
              }`}
            >
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{employeeHelperMessage}</span>
            </div>
          )}

          <div ref={shiftDropdownRef} className="relative">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
              Shift
            </label>

            <button
              type="button"
              disabled={assigning}
              onClick={() => {
                setShiftDropdownOpen((current) => !current);
                setEmployeeDropdownOpen(false);
              }}
              className="flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-left text-sm font-semibold text-slate-700 outline-none transition hover:border-emerald-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Clock3 className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="truncate">{shiftLabel}</span>
              </span>

              <ChevronDown
                className={`h-4 w-4 shrink-0 text-slate-400 transition ${
                  shiftDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {shiftDropdownOpen && (
              <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[10000] overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                {activeShiftOptions.length === 0 ? (
                  <div className="px-3 py-3 text-sm font-medium text-slate-400">
                    No active shifts available.
                  </div>
                ) : (
                  activeShiftOptions.map((shift) => {
                    const isSelected = shift.id === selectedShiftId;
                    const isCurrent = currentAssignment?.shiftId === shift.id;

                    return (
                      <button
                        key={shift.id}
                        type="button"
                        onClick={() => {
                          onShiftChange(shift.id);
                          setShiftDropdownOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${
                          isSelected
                            ? "bg-emerald-50 text-emerald-700"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span className="truncate">
                          {shift.name}
                          {isCurrent ? " (Current)" : ""}
                        </span>

                        {isSelected && (
                          <Check className="h-4 w-4 shrink-0" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {sameShiftMessage && (
              <div className="mt-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium leading-relaxed text-amber-700">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{sameShiftMessage}</span>
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">
              Effective Date
            </label>

            <input
              type="date"
              value={effectiveFrom}
              onChange={(event) => onEffectiveFromChange(event.target.value)}
              disabled={assigning}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50"
            />

            <div className="mt-2 flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-medium leading-relaxed text-blue-700">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {isReassignment
                  ? "For reassignment, use a date after the current assignment start. The previous assignment will end the day before the new effective date."
                  : "This creates DTR eligibility under the selected shift from this date. If the employee was previously unassigned, choose a date after the last recorded assignment."}
              </span>
            </div>

            {displayAssignmentError && currentAssignment && (
              <div className="mt-2 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium leading-relaxed text-red-700">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{displayAssignmentError}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-5">
          <button
            type="button"
            onClick={handleClose}
            disabled={assigning}
            className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onAssign}
            disabled={isSubmitDisabled}
            className={`btn btn-primary ${
              isSubmitDisabled
                ? "cursor-not-allowed opacity-50 shadow-none hover:translate-y-0 hover:shadow-none"
                : ""
            }`}
          >
            {assigning ? "Saving..." : isReassignment ? "Reassign" : "Assign"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default AssignShiftModal;