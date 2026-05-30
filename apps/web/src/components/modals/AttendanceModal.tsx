import type { FC } from 'react';
import { X, Clock } from 'lucide-react';

interface AttendanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    employeeName: string;
}

const AttendanceModal: FC<AttendanceModalProps> = ({ isOpen, onClose, employeeName }) => {
    if (!isOpen) return null;

    return (
        <div className="pro-modal-overlay z-[200]">
            <div className="pro-modal max-w-2xl w-full mx-4 sm:mx-auto max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                
                {/* Standardized Header */}
                <div className="pro-modal-header border-b border-gray-100 pb-4 shrink-0">
                    <h3 className="text-xl font-bold text-gray-900">Attendance Details</h3>
                    <button
                        onClick={onClose}
                        className="btn-ghost btn-icon"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                <div className="pro-modal-body overflow-y-auto p-6 space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center text-[var(--color-primary)] font-bold text-lg shrink-0">
                            {employeeName.charAt(0)}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">{employeeName}</h2>
                            <p className="text-sm text-gray-500">September 2024</p>
                        </div>
                    </div>

                    {/* Responsive Grid: Stacks on mobile, side-by-side on sm screens */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <p className="text-sm font-medium text-gray-500 mb-1">Time In</p>
                            <div className="flex items-center gap-2">
                                <Clock size={16} className="text-[var(--color-primary)]" />
                                <span className="text-lg font-bold text-gray-800">07:55 AM</span>
                            </div>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <p className="text-sm font-medium text-gray-500 mb-1">Time Out</p>
                            <div className="flex items-center gap-2">
                                <Clock size={16} className="text-red-500" />
                                <span className="text-lg font-bold text-gray-800">05:01 PM</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="hazardPay" className="w-4 h-4 text-[var(--color-primary)] rounded border-gray-300 focus:ring-[var(--color-primary)]" />
                            <label htmlFor="hazardPay" className="pro-label !mb-0 cursor-pointer">Eligible for Hazard Pay</label>
                        </div>

                        <div className="space-y-1">
                            <label className="pro-label">Remarks / Notes</label>
                            <textarea
                                className="pro-input min-h-[100px] resize-y"
                                placeholder="Enter any remarks regarding this attendance record..."
                            ></textarea>
                        </div>
                    </div>
                </div>

                {/* Standardized Footer: Stacks buttons full-width on mobile */}
                <div className="pro-modal-footer flex-col sm:flex-row gap-2 sm:gap-3 pt-4 border-t border-gray-100 shrink-0">
                    <button
                        onClick={onClose}
                        className="btn btn-secondary w-full sm:w-auto justify-center"
                    >
                        Close
                    </button>
                    <button className="btn btn-primary w-full sm:w-auto justify-center">
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AttendanceModal;