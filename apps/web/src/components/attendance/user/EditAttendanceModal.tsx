import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

type UserAttendanceRecord = {
    id: number;
    date: string;
    timeIn: string;
    timeOut: string;
    status: string;
    isOT: boolean;
    isUndertime: boolean;
    hours: string;
    renderedMinutes: number;
    lateMinutes: number;
    undertimeMinutes: number;
    overtimeMinutes: number;
    task: string;
    accomplished: string;
};

type Props = {
    isOpen: boolean;
    record: UserAttendanceRecord | null;
    onClose: () => void;
    onChange: (updated: UserAttendanceRecord) => void;
    onSave: () => void;
    saving?: boolean;
};

type EditableField = 'task' | 'accomplished';

export default function EditAttendanceModal({
    isOpen,
    record,
    onClose,
    onChange,
    onSave,
    saving = false,
}: Props) {
    if (!isOpen || !record) return null;

    const handleFieldChange = (field: EditableField, value: string) => {
        onChange({
            ...record,
            [field]: value,
        });
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-[rgba(15,23,42,0.5)] backdrop-blur-[4px]"
            onClick={saving ? undefined : onClose}
        >
            <div
                className="mx-4 w-full max-w-[520px] overflow-hidden rounded-[22px] bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-6">
                    <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-slate-800 sm:text-[15px]">
                        Edit Attendance Record
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-slate-400 transition-colors hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                        type="button"
                        disabled={saving}
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="space-y-5 px-6 py-7">
                    <div>
                        <label className="mb-2 block text-[14px] text-slate-600">Task</label>
                        <textarea
                            value={record.task || ''}
                            onChange={(e) => handleFieldChange('task', e.target.value)}
                            rows={4}
                            className="w-full rounded-[12px] border border-slate-300 bg-white px-4 py-3 text-[14px] text-slate-700 outline-none focus:border-slate-400"
                            placeholder="Enter task"
                            disabled={saving}
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-[14px] text-slate-600">Accomplished</label>
                        <textarea
                            value={record.accomplished || ''}
                            onChange={(e) => handleFieldChange('accomplished', e.target.value)}
                            rows={4}
                            className="w-full rounded-[12px] border border-slate-300 bg-white px-4 py-3 text-[14px] text-slate-700 outline-none focus:border-slate-400"
                            placeholder="Enter accomplished work"
                            disabled={saving}
                        />
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-5">
                    <button
                        onClick={onClose}
                        type="button"
                        className="h-[40px] rounded-[12px] border border-slate-300 bg-slate-50 px-6 text-[14px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={saving}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onSave}
                        type="button"
                        className="h-[40px] rounded-[12px] bg-emerald-600 px-6 text-[14px] font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={saving}
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
