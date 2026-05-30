import { Clock, FileWarning, TimerReset, CheckCircle2 } from 'lucide-react';
import { formatMinutes } from './assignOvertimeModalUtils';

type Props = {
  validCount: number;
  pendingCount: number;
  noDtrCount: number;
  totalRequestedMinutes: number;
};

const AssignOtSummaryCards = ({
  validCount,
  pendingCount,
  noDtrCount,
  totalRequestedMinutes,
}: Props) => {
  return (
    <div className="grid grid-cols-4 gap-3">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-center">
        <div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-lg bg-white/70 text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
        </div>
        <p className="text-[11px] font-black uppercase tracking-wider text-emerald-700">
          Eligible
        </p>
        <p className="mt-1 text-xl font-black text-slate-800">{validCount}</p>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-center">
        <div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-lg bg-white/70 text-blue-700">
          <Clock className="h-4 w-4" />
        </div>
        <p className="text-[11px] font-black uppercase tracking-wider text-blue-700">
          Pending
        </p>
        <p className="mt-1 text-xl font-black text-slate-800">{pendingCount}</p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-center">
        <div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-lg bg-white/70 text-amber-700">
          <FileWarning className="h-4 w-4" />
        </div>
        <p className="text-[11px] font-black uppercase tracking-wider text-amber-700">
          No DTR
        </p>
        <p className="mt-1 text-xl font-black text-slate-800">{noDtrCount}</p>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-center">
        <div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-lg bg-white/70 text-blue-600">
          <TimerReset className="h-4 w-4" />
        </div>
        <p className="text-[11px] font-black uppercase tracking-wider text-blue-600">
          Total
        </p>
        <p className="mt-1 text-xl font-black text-blue-600">
          {formatMinutes(totalRequestedMinutes)}
        </p>
      </div>
    </div>
  );
};

export default AssignOtSummaryCards;