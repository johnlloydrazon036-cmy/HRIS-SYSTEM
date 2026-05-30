import type { Shift } from '../../../lib/attendance';

export type EmployeeOption = {
    id: string;
    fullName: string;
};

type Props = {
    employees: EmployeeOption[];
    apiShifts: Shift[];
    loadingEmployees: boolean;
    assigning: boolean;
    selectedEmployeeId: string;
    selectedAssignShiftId: number | null;
    effectiveFrom: string;
    assignMessage: string | null;
    assignError: string | null;
    onSelectedEmployeeChange: (value: string) => void;
    onSelectedAssignShiftChange: (value: number) => void;
    onEffectiveFromChange: (value: string) => void;
    onAssignShift: () => void;
};

const AssignShiftForm = ({
    employees,
    apiShifts,
    loadingEmployees,
    assigning,
    selectedEmployeeId,
    selectedAssignShiftId,
    effectiveFrom,
    assignMessage,
    assignError,
    onSelectedEmployeeChange,
    onSelectedAssignShiftChange,
    onEffectiveFromChange,
    onAssignShift,
}: Props) => {
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-4">

            <div className="mb-3">
                <h2 className="text-sm font-semibold text-gray-800">
                    Assign Shift
                </h2>
                <p className="text-xs text-gray-500">
                    Assign a shift schedule to an employee
                </p>
            </div>

            {/* INLINE LAYOUT (IMPORTANT FIX) */}
            <div className="flex flex-col md:flex-row md:items-end gap-3">

                {/* Employee */}
                <div className="flex flex-col flex-1">
                    <label className="mb-1 text-xs text-gray-600">Employee</label>
                    <select
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={selectedEmployeeId}
                        onChange={(e) => onSelectedEmployeeChange(e.target.value)}
                        disabled={loadingEmployees}
                    >
                        <option value="">
                            {loadingEmployees ? 'Loading...' : 'Select employee'}
                        </option>
                        {employees.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                                {emp.fullName}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Shift */}
                <div className="flex flex-col flex-1">
                    <label className="mb-1 text-xs text-gray-600">Shift</label>
                    <select
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={selectedAssignShiftId ?? ''}
                        onChange={(e) => onSelectedAssignShiftChange(Number(e.target.value))}
                    >
                        <option value="">Select shift</option>
                        {apiShifts.map((shift) => (
                            <option key={shift.id} value={shift.id}>
                                {shift.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Date */}
                <div className="flex flex-col w-full md:w-[180px]">
                    <label className="mb-1 text-xs text-gray-600">Effective Date</label>
                    <input
                        type="date"
                        className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        value={effectiveFrom}
                        onChange={(e) => onEffectiveFromChange(e.target.value)}
                    />
                </div>

                {/* BUTTON INLINE */}
                <button
                    onClick={onAssignShift}
                    disabled={assigning}
                    className="h-[38px] px-4 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
                >
                    {assigning ? 'Assigning...' : 'Assign'}
                </button>
            </div>

            {assignError && (
                <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {assignError}
                </div>
            )}

            {assignMessage && (
                <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                    {assignMessage}
                </div>
            )}
        </div>
    );
};

export default AssignShiftForm;