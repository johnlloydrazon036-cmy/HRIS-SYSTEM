import { createPortal } from 'react-dom';
import type { ShiftAssignmentTableRow } from './ShiftAssignmentsTable';

type Props = {
    target: ShiftAssignmentTableRow | null;
    unassigningId: number | null;
    formatEmployeeName: (value?: string | null) => string;
    onClose: () => void;
    onConfirm: () => void;
};

const UnassignShiftModal = ({
    target,
    unassigningId,
    formatEmployeeName,
    onClose,
    onConfirm,
}: Props) => {
    if (!target) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                <h3 className="text-lg font-bold text-slate-900">Unassign employee?</h3>
                <p className="mt-2 text-sm font-medium text-slate-500">
                    This will remove {formatEmployeeName(target.fullName)} from {target.shiftName}. The employee will not be able to log DTR until assigned to a shift again.
                </p>

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={unassigningId !== null}
                        className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={unassigningId !== null}
                        className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60"
                    >
                        {unassigningId !== null ? 'Removing...' : 'Confirm'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default UnassignShiftModal;
