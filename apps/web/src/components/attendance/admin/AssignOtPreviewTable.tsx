import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock,
  ListChecks,
  XCircle,
} from 'lucide-react';

import {
  MIN_PREVIEW_ROWS,
} from './assignOvertimeModalUtils';

import type {
  PreviewDay,
  PreviewDayStatus,
} from './assignOvertimeModalUtils';

type Props = {
  previewDays: PreviewDay[];
  requestedMinutes: number;
};

const getPreviewBadgeClass = (day: PreviewDay) => {
  if (day.status === 'assignable') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (day.status === 'needs-dtr') {
    return day.message.toLowerCase().includes('pending')
      ? 'border-blue-200 bg-blue-50 text-blue-700'
      : 'border-amber-200 bg-amber-50 text-amber-700';
  }

  if (day.status === 'blocked') {
    return 'border-red-200 bg-red-50 text-red-700';
  }

  return 'border-red-200 bg-red-50 text-red-700';
};

const getPreviewIcon = (status: PreviewDayStatus, message: string) => {
  if (status === 'assignable') {
    return <CheckCircle2 className="h-3.5 w-3.5" />;
  }

  if (status === 'needs-dtr') {
    return message.toLowerCase().includes('pending')
      ? <Clock className="h-3.5 w-3.5" />
      : <AlertCircle className="h-3.5 w-3.5" />;
  }

  if (status === 'blocked') {
    return <XCircle className="h-3.5 w-3.5" />;
  }

  return <XCircle className="h-3.5 w-3.5" />;
};

const AssignOtPreviewTable = ({ previewDays }: Props) => {
  const rows: PreviewDay[] = [
    ...previewDays,
    ...Array.from(
      { length: Math.max(0, MIN_PREVIEW_ROWS - previewDays.length) },
      (_, index): PreviewDay => ({
        key: `preview-placeholder-${index}`,
        apiDate: '',
        displayDate: '--',
        dayName: '--',
        otHours: 0,
        status: 'invalid-range',
        message: '--',
      })
    ),
  ];

  return (
    <div className="px-6 py-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          <ListChecks className="h-5 w-5" />
        </div>

        <div>
          <h4 className="text-sm font-black uppercase tracking-wider text-slate-700">
            Overtime Day Preview
          </h4>

          <p className="mt-1 text-xs font-medium text-slate-500">
            Review overtime dates and approval state before assigning.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <div className="grid grid-cols-[1.1fr_1fr_1.5fr] bg-slate-50 px-4 py-3 text-[11px] font-black uppercase tracking-wider text-slate-500">
          <div>Date</div>
          <div>Status</div>
          <div>Remarks</div>
        </div>

        <div>
          {previewDays.length === 0 && (
            <div className="flex min-h-[118px] flex-col items-center justify-center border-t border-slate-100 px-4 py-6 text-center">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <CalendarDays className="h-5 w-5" />
              </div>

              <p className="text-sm font-bold text-slate-600">
                Select an employee and date range to show preview.
              </p>
            </div>
          )}

          {previewDays.length > 0 &&
            rows.map((day) => {
              const isPlaceholder = day.displayDate === '--';
              return (
                <div
                  key={day.key}
                  className={`grid min-h-[58px] grid-cols-[1.1fr_1fr_1.5fr] items-center border-t border-slate-100 px-4 py-3 text-sm ${
                    isPlaceholder ? 'text-slate-300' : 'text-slate-700'
                  }`}
                >
                  <div>
                    <p className="font-bold">{day.displayDate}</p>

                    <p className="text-xs font-semibold text-slate-400">
                      {day.dayName}
                    </p>
                  </div>

                  <div>
                    {isPlaceholder ? (
                      <span className="text-sm font-bold text-slate-300">--</span>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${getPreviewBadgeClass(
                          day
                        )}`}
                      >
                        {getPreviewIcon(day.status, day.message)}
                        <span>
                          {day.status === 'assignable'
                            ? 'Eligible'
                            : day.status === 'needs-dtr'
                              ? 'Pending'
                              : 'Blocked'}
                        </span>
                      </span>
                    )}
                  </div>

                  <div>
                    <span
                      className={`text-xs font-semibold ${
                        isPlaceholder ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {isPlaceholder ? '--' : day.message}
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};

export default AssignOtPreviewTable;
