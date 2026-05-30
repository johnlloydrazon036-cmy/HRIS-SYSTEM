import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Timer,
  XCircle,
} from 'lucide-react';

type UserOvertimeRow = {
  id: number;
  date: string;
  duration: string;
  reason: string;
  status: string;
};

type Props = {
  loadingOt: boolean;
  myOvertime: UserOvertimeRow[];
};

const DEFAULT_PAGE_SIZE = 10;

const formatDate = (value: string) => {
  if (!value || value === '-' || value === '--' || value === '—') return '--';

  if (value.startsWith('0001-01-01')) return '--';

  const d = new Date(value);
  if (isNaN(d.getTime())) return value;

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
};

const formatDuration = (value: string) => {
  if (!value || value === '-' || value === '--' || value === '—') return '--';

  if (/[hm]/i.test(value)) return value;

  const num = Number(value);
  if (!isFinite(num) || num <= 0) return '--';

  const totalMinutes = Math.round(num * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;

  return `${h}h ${m}m`;
};

const getStatusClass = (status: string) => {
  const normalized = status?.toLowerCase();

  if (normalized === 'approved') return 'badge-success';
  if (normalized === 'rejected') return 'badge-danger';

  return 'badge-warning';
};

const getStatusIcon = (status: string) => {
  const normalized = status?.toLowerCase();

  if (normalized === 'approved') return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (normalized === 'rejected') return <XCircle className="h-3.5 w-3.5" />;

  return <AlertCircle className="h-3.5 w-3.5" />;
};

const createEmptyRow = (id: number): UserOvertimeRow => ({
  id,
  date: '--',
  duration: '--',
  reason: '--',
  status: '--',
});

const UserOtTable = ({ loadingOt, myOvertime }: Props) => {
  const hasData = myOvertime.length > 0;

  const rows = hasData
    ? [
        ...myOvertime,
        ...Array.from(
          { length: Math.max(0, DEFAULT_PAGE_SIZE - myOvertime.length) },
          (_, i) => createEmptyRow(-(i + 1))
        ),
      ]
    : Array.from({ length: DEFAULT_PAGE_SIZE - 1 }, (_, i) =>
        createEmptyRow(-(i + 1))
      );

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100">
      <div className="overflow-x-auto">
        <table className="pro-table min-w-full">
          <thead>
            <tr>
              <th className="text-left">DATE</th>
              <th className="text-left">DURATION</th>
              <th className="text-left">REASON</th>
              <th>STATUS</th>
            </tr>
          </thead>

          <tbody>
            {loadingOt ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-10 text-center text-sm text-gray-500"
                >
                  Loading overtime requests...
                </td>
              </tr>
            ) : (
              <>
                {!hasData && (
                  <tr>
                    <td
                      colSpan={4}
                      className="h-[48px] text-center text-sm font-medium text-gray-600"
                    >
                      No overtime requests yet.
                    </td>
                  </tr>
                )}

                {rows.map((row) => {
                  const isPlaceholder = row.id < 0;

                  return (
                    <tr key={row.id}>
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
                          <span className="font-medium">{formatDate(row.date)}</span>
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
                        <div className="flex max-w-[420px] items-center gap-2">
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
                            <span className={`badge ${getStatusClass(row.status)}`}>
                              {getStatusIcon(row.status)}
                              {row.status || 'Pending'}
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
        <button className="btn btn-secondary" disabled>
          Prev
        </button>

        <div className="text-sm text-gray-500">Page 1 of 1</div>

        <button className="btn btn-secondary" disabled>
          Next
        </button>
      </div>
    </div>
  );
};

export default UserOtTable;