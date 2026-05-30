import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  XCircle,
} from 'lucide-react';
import UserOtTable from './UserOtTable.tsx';

interface UserOtTabProps {
  loadingOt: boolean;
  myOvertime: Array<{
    id: number;
    date: string;
    duration: string;
    reason: string;
    status: string;
  }>;
  setIsOvertimeModalOpen: (value: boolean) => void;
}

const UserOtTab = ({
  loadingOt,
  myOvertime,
  setIsOvertimeModalOpen,
}: UserOtTabProps) => {
  const approvedCount = myOvertime.filter(
    (row) => row.status?.toLowerCase() === 'approved'
  ).length;

  const pendingCount = myOvertime.filter(
    (row) => row.status?.toLowerCase() === 'pending'
  ).length;

  const rejectedCount = myOvertime.filter(
    (row) => row.status?.toLowerCase() === 'rejected'
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
              <ClipboardList className="h-5 w-5" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-800">
                Overtime Requests
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Submit and track your overtime requests.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <span className="inline-flex h-10 items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3.5 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Approved {approvedCount}
            </span>

            <span className="inline-flex h-10 items-center gap-2 rounded-full border border-amber-200/80 bg-amber-50/80 px-3.5 text-xs font-semibold text-amber-700">
              <AlertCircle className="h-3.5 w-3.5" />
              Pending {pendingCount}
            </span>

            <span className="inline-flex h-10 items-center gap-2 rounded-full border border-red-200/80 bg-red-50/80 px-3.5 text-xs font-semibold text-red-700">
              <XCircle className="h-3.5 w-3.5" />
              Rejected {rejectedCount}
            </span>

            <span className="inline-flex h-10 items-center rounded-full border border-slate-200 bg-slate-50 px-3.5 text-xs font-semibold text-slate-600">
              {myOvertime.length} Request
              {myOvertime.length !== 1 ? 's' : ''}
            </span>

            <button
              onClick={() => setIsOvertimeModalOpen(true)}
              className="btn btn-primary h-10 px-5 shadow-[0_8px_20px_rgba(16,185,129,0.18)]"
            >
              <CalendarClock className="h-4 w-4" />
              Request Overtime
            </button>
          </div>
        </div>

        <UserOtTable loadingOt={loadingOt} myOvertime={myOvertime} />
      </div>
    </div>
  );
};

export default UserOtTab;