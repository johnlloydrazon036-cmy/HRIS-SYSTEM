import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { AdminDtrRecord } from '../../../types/attendance';

type Props = {
    isOpen: boolean;
    record: AdminDtrRecord | null;
    onClose: () => void;
    onChange: (updated: AdminDtrRecord) => void;
    onSave: () => void;
};

type EditableField = 'date' | 'timeIn' | 'timeOut' | 'status' | 'remarks' | 'isOT';

const formatDateForInput = (value: string) => {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';

    return parsed.toISOString().split('T')[0];
};

const formatDateForDisplay = (value: string) => {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [year, month, day] = value.split('-');
        return `${month}/${day}/${year}`;
    }
    return value;
};

const EditAttendanceModal = ({
    isOpen,
    record,
    onClose,
    onChange,
    onSave,
}: Props) => {
    if (!isOpen || !record) return null;

    const handleFieldChange = (
        field: EditableField,
        value: AdminDtrRecord[EditableField]
    ) => {
        onChange({
            ...record,
            [field]: value,
        });
    };

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
                        Edit Attendance Record
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-slate-400 transition-colors hover:text-slate-600"
                        type="button"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="space-y-5 px-6 py-7">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="mb-2 block text-[14px] text-slate-600">
                                Employee ID
                            </label>
                            <input
                                type="text"
                                value={record.empId}
                                readOnly
                                className="h-[44px] w-full rounded-[12px] border border-slate-300 bg-slate-50 px-4 text-[14px] text-slate-700 outline-none"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-[14px] text-slate-600">
                                Name
                            </label>
                            <input
                                type="text"
                                value={record.name}
                                readOnly
                                className="h-[44px] w-full rounded-[12px] border border-slate-300 bg-slate-50 px-4 text-[14px] text-slate-700 outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="mb-2 block text-[14px] text-slate-600">
                            Date
                        </label>
                        <div className="relative">
                            <input
                                type="date"
                                value={formatDateForInput(record.date)}
                                onChange={(e) => handleFieldChange('date', e.target.value)}
                                className="h-[44px] w-full rounded-[12px] border border-slate-300 bg-white px-4 text-[14px] text-slate-700 outline-none focus:border-slate-400"
                            />
                            {!formatDateForInput(record.date) && (
                                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[14px] text-slate-700">
                                    {formatDateForDisplay(record.date)}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="mb-2 block text-[14px] text-slate-600">
                                Time In
                            </label>
                            <input
                                type="text"
                                value={record.timeIn || ''}
                                onChange={(e) => handleFieldChange('timeIn', e.target.value)}
                                className="h-[44px] w-full rounded-[12px] border border-slate-300 bg-white px-4 text-[14px] text-slate-700 outline-none focus:border-slate-400"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-[14px] text-slate-600">
                                Time Out
                            </label>
                            <input
                                type="text"
                                value={record.timeOut || ''}
                                onChange={(e) => handleFieldChange('timeOut', e.target.value)}
                                className="h-[44px] w-full rounded-[12px] border border-slate-300 bg-white px-4 text-[14px] text-slate-700 outline-none focus:border-slate-400"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="mb-2 block text-[14px] text-slate-600">
                            Status
                        </label>
                        <select
                            value={record.status}
                            onChange={(e) =>
                                handleFieldChange(
                                    'status',
                                    e.target.value as AdminDtrRecord['status']
                                )
                            }
                            className="h-[44px] w-full rounded-[12px] border border-slate-300 bg-white px-4 text-[14px] text-slate-700 outline-none focus:border-slate-400"
                        >
                            <option value="Present">Present</option>
                            <option value="Late">Late</option>
                            <option value="Absent">Absent</option>
                        </select>
                    </div>

                    <label className="flex cursor-pointer items-center gap-3 text-[14px] font-medium text-slate-700">
                        <input
                            type="checkbox"
                            checked={record.isOT}
                            onChange={(e) => handleFieldChange('isOT', e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        Include Overtime (OT) Status
                    </label>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-5">
                    <button
                        onClick={onClose}
                        type="button"
                        className="h-[40px] rounded-[12px] border border-slate-300 bg-slate-50 px-6 text-[14px] font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onSave}
                        type="button"
                        className="h-[40px] rounded-[12px] bg-emerald-600 px-6 text-[14px] font-semibold text-white transition-colors hover:bg-emerald-700"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default EditAttendanceModal;