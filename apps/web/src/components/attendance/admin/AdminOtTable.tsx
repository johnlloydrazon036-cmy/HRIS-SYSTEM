import { useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Timer,
  XCircle,
} from 'lucide-react';
import type {
  AdminOvertimeRequestRow,
  StatusBadgeMap,
} from '../../../types/attendance';

type ExpandedAdminOvertimeRow = AdminOvertimeRequestRow & {
  displayDate: string;
  rowKey: string;
  isGroupContinuation: boolean;
};

type Props = {
  loadingOt: boolean;
  overtimeRequests: AdminOvertimeRequestRow[];
  statusBadge: StatusBadgeMap;
  reviewingOtId: number | null;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
};

const DEFAULT_PAGE_SIZE = 10;

const invalidDates = new Set([
  '0001-01-01',
  '0001-01-01T00:00:00',
  '0001-01-01T00:00:00Z',
]);

const formatDate = (value: string) => {
  if (!value || value === '-' || value === '--' || value === '—') return '--';

  const normalized = value.trim();

  if (invalidDates.has(normalized) || normalized.startsWith('0001-01-01')) {
    return '--';
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return normalized;

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

const parseDisplayDate = (value: string) => {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    const fallback = new Date(`${value} 00:00:00`);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  return parsed;
};

const expandDateRange = (dateValue: string) => {
  if (!dateValue.includes(' - ')) return [dateValue];

  const [fromRaw, toRaw] = dateValue.split(' - ').map((x) => x.trim());
  const from = parseDisplayDate(fromRaw);
  const to = parseDisplayDate(toRaw);

  if (!from || !to || from > to) return [dateValue];

  const dates: string[] = [];
  const cursor = new Date(to);

  while (cursor >= from) {
    dates.push(
      new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(cursor)
    );

    cursor.setDate(cursor.getDate() - 1);
  }

  return dates;
};

const formatDuration = (value: string) => {
  if (!value || value === '-' || value === '--' || value === '—') return '--';

  const cleaned = value
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return '--';

  if (cleaned.toLowerCase().includes('h') || cleaned.toLowerCase().includes('m')) {
    return cleaned;
  }

  const numeric = Number(cleaned.replace(/hours?/i, '').trim());

  if (!Number.isFinite(numeric) || numeric <= 0) return '--';

  const totalMinutes = Math.round(numeric * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;

  return `${hours}h ${minutes}m`;
};

const getStatusIcon = (status: string) => {
  const normalized = status?.toLowerCase();

  if (normalized === 'approved') return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (normalized === 'rejected') return <XCircle className="h-3.5 w-3.5" />;

  return <AlertCircle className="h-3.5 w-3.5" />;
};

const getEmployeeInitial = (employee: string) => {
  if (!employee || employee === '--') return '--';

  const cleaned = employee.trim();
  if (!cleaned) return '--';

  if (cleaned.includes(',')) {
    const [lastName] = cleaned.split(',');
    return lastName.trim().charAt(0).toUpperCase() || '--';
  }

  return cleaned.charAt(0).toUpperCase();
};

const createPlaceholderRow = (id: number): ExpandedAdminOvertimeRow => ({
  id,
  date: '--',
  displayDate: '--',
  rowKey: `placeholder-${Math.abs(id)}`,
  employee: '--',
  duration: '--',
  reason: '--',
  status: 'Pending',
  isGroupContinuation: false,
});

const expandOvertimeRows = (
  overtimeRequests: AdminOvertimeRequestRow[]
): ExpandedAdminOvertimeRow[] => {
  return overtimeRequests.flatMap((request) => {
    const dates = expandDateRange(request.date);

    return dates.map((date, index) => ({
      ...request,
      displayDate: date,
      rowKey: `${request.id}-${date}-${index}`,
      isGroupContinuation: index > 0,
    }));
  });
};

const AdminOtTable = ({
  loadingOt,
  overtimeRequests,
  statusBadge,
  reviewingOtId,
  onApprove,
  onReject,
}: Props) => {
  const [pageState, setPageState] = useState({
    page: 1,
    dataKey: '',
  });

  const expandedRequests = useMemo(
    () => expandOvertimeRows(overtimeRequests),
    [overtimeRequests]
  );

  const dataKey = useMemo(
    () => expandedRequests.map((row) => row.rowKey).join('|'),
    [expandedRequests]
  );

  const totalPages = Math.max(
    1,
    Math.ceil(expandedRequests.length / DEFAULT_PAGE_SIZE)
  );

  const currentPage =
    pageState.dataKey === dataKey
      ? Math.min(Math.max(pageState.page, 1), totalPages)
      : 1;

  const visibleRequests = expandedRequests.slice(
    (currentPage - 1) * DEFAULT_PAGE_SIZE,
    currentPage * DEFAULT_PAGE_SIZE
  );

  const hasRecords = expandedRequests.length > 0;

  const rows = hasRecords
    ? [
        ...visibleRequests,
        ...Array.from(
          { length: Math.max(0, DEFAULT_PAGE_SIZE - visibleRequests.length) },
          (_, index) => createPlaceholderRow(-(index + 1))
        ),
      ]
    : Array.from({ length: DEFAULT_PAGE_SIZE - 1 }, (_, index) =>
        createPlaceholderRow(-(index + 1))
      );

  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100">
      <div className="overflow-x-auto">
        <table className="pro-table min-w-full">
          <thead>
            <tr>
              <th className="text-left">EMPLOYEE</th>
              <th className="text-left">DATE</th>
              <th className="text-left">DURATION</th>
              <th className="text-left">REASON</th>
              <th>STATUS</th>
              <th>ACTION</th>
            </tr>
          </thead>

          <tbody>
            {loadingOt ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-10 text-center text-sm text-gray-500"
                >
                  Loading overtime requests...
                </td>
              </tr>
            ) : (
              <>
                {!hasRecords && (
                  <tr>
                    <td
                      colSpan={6}
                      className="h-[48px] px-6 text-center align-middle text-sm font-medium text-gray-600"
                    >
                      No overtime requests yet.
                    </td>
                  </tr>
                )}

                {rows.map((row) => {
                  const isPlaceholder = row.id < 0;
                  const isPending = row.status === 'Pending';

                  return (
                    <tr
                      key={row.rowKey}
                      className={
                        !isPlaceholder && isPending
                          ? 'bg-amber-50/30'
                          : undefined
                      }
                    >
                      <td
                        className={`px-6 py-4 ${
                          isPlaceholder ? 'text-gray-300' : 'text-gray-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {isPlaceholder ? (
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-xs font-bold text-gray-300">
                              --
                            </span>
                          ) : (
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-xs font-bold text-white shadow-sm">
                              {getEmployeeInitial(row.employee)}
                            </span>
                          )}

                          <span className="font-medium">{row.employee || '--'}</span>
                        </div>
                      </td>

                      <td
                        className={`px-6 py-4 ${
                          isPlaceholder ? 'text-gray-300' : 'text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <CalendarDays
                            className={`h-4 w-4 shrink-0 ${
                              isPlaceholder ? 'text-gray-300' : 'text-slate-400'
                            }`}
                          />
                          <span className="font-medium">
                            {formatDate(row.displayDate)}
                          </span>
                        </div>
                      </td>

                      <td
                        className={`px-6 py-4 font-mono ${
                          isPlaceholder ? 'text-gray-300' : 'text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                              isPlaceholder
                                ? 'bg-gray-50 text-gray-300'
                                : 'bg-blue-50 text-blue-600'
                            }`}
                          >
                            <Timer className="h-4 w-4" />
                          </span>
                          <span className="font-bold">
                            {formatDuration(row.duration)}
                          </span>
                        </div>
                      </td>

                      <td
                        className={`px-6 py-4 ${
                          isPlaceholder ? 'text-gray-300' : 'text-slate-600'
                        }`}
                      >
                        <div className="flex max-w-[340px] items-center gap-2">
                          <FileText
                            className={`h-4 w-4 shrink-0 ${
                              isPlaceholder ? 'text-gray-300' : 'text-slate-400'
                            }`}
                          />
                          <span className="truncate font-medium">
                            {row.reason || '--'}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                          {isPlaceholder ? (
                            <span className="inline-flex items-center gap-2 text-gray-300">
                              <Clock3 className="h-4 w-4" />
                              --
                            </span>
                          ) : (
                            <span className={`badge ${statusBadge[row.status]}`}>
                              {getStatusIcon(row.status)}
                              {row.status}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                          {isPlaceholder ? (
                            <span className="text-gray-300">--</span>
                          ) : isPending && !row.isGroupContinuation ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => onApprove(row.id)}
                                disabled={reviewingOtId === row.id}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                                title="Approve overtime request"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </button>

                              <button
                                onClick={() => onReject(row.id)}
                                disabled={reviewingOtId === row.id}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-500 transition hover:bg-rose-100 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                                title="Reject overtime request"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            </div>
                          ) : isPending && row.isGroupContinuation ? (
                            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-600">
                              Same request
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                              Resolved
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!canGoPrev}
          onClick={() =>
            setPageState({
              page: Math.max(1, currentPage - 1),
              dataKey,
            })
          }
        >
          Prev
        </button>

        <div className="text-sm text-gray-500">
          Page {currentPage} of {totalPages}
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          disabled={!canGoNext}
          onClick={() =>
            setPageState({
              page: Math.min(totalPages, currentPage + 1),
              dataKey,
            })
          }
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default AdminOtTable;