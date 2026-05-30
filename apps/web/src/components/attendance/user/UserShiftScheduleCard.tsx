import { useState } from "react";
import { CalendarDays, Clock, Coffee, Eye, TimerReset } from "lucide-react";

import UserShiftViewModal from "./UserShiftViewModal";
import { type Shift, formatAttendanceTime } from "../../../lib/attendance";

type Props = {
  shiftName?: string | null;
  shiftStartTime?: string | null;
  shiftEndTime?: string | null;
  breakStartTime?: string | null;
  breakEndTime?: string | null;
  lateGraceMinutes?: number | null;
  isWorkingDay: boolean;
  isHoliday: boolean;
  holidayName?: string | null;
  shift?: Shift | null;
};

const UserShiftScheduleCard = ({
  shiftName,
  shiftStartTime,
  shiftEndTime,
  breakStartTime,
  breakEndTime,
  lateGraceMinutes,
  isWorkingDay,
  isHoliday,
  holidayName,
  shift,
}: Props) => {
  const [isViewOpen, setIsViewOpen] = useState(false);

  const hasAssignedShift = !!shiftName?.trim();

  const cardTone = !hasAssignedShift
    ? {
        card: "border-slate-100 bg-slate-50",
        iconWrap: "bg-slate-100 text-slate-500",
        subtitle: "text-slate-500",
        badge: "bg-slate-100 text-slate-500",
        accent: "text-slate-500",
      }
    : isHoliday
      ? {
          card: "border-violet-100 bg-violet-50/40",
          iconWrap: "bg-violet-100 text-violet-600",
          subtitle: "text-violet-700",
          badge: "bg-violet-100 text-violet-700",
          accent: "text-violet-600",
        }
      : isWorkingDay
        ? {
            card: "border-emerald-100 bg-emerald-50/40",
            iconWrap: "bg-emerald-100 text-emerald-600",
            subtitle: "text-emerald-700",
            badge: "bg-emerald-100 text-emerald-700",
            accent: "text-emerald-600",
          }
        : {
            card: "border-slate-100 bg-slate-50",
            iconWrap: "bg-slate-100 text-slate-500",
            subtitle: "text-slate-500",
            badge: "bg-slate-100 text-slate-500",
            accent: "text-slate-500",
          };

  const statusLabel = !hasAssignedShift
    ? "No Shift"
    : isHoliday
      ? holidayName || "Holiday"
      : isWorkingDay
        ? "Working Day"
        : "Rest Day";

  const breakLabel =
    breakStartTime && breakEndTime
      ? `${formatAttendanceTime(breakStartTime)} - ${formatAttendanceTime(breakEndTime)}`
      : "--";

  const handleViewShift = () => {
    if (!hasAssignedShift || !shift) return;
    setIsViewOpen(true);
  };

  return (
    <>
      <div className={`mb-5 rounded-xl border p-4 ${cardTone.card}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${cardTone.iconWrap}`}
            >
              <CalendarDays className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-gray-900">
                  Today's Schedule
                </h3>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${cardTone.badge}`}
                >
                  {statusLabel}
                </span>
              </div>

              <p className={`mt-1 text-xs font-bold ${cardTone.subtitle}`}>
                {hasAssignedShift ? shiftName : "No assigned shift"}
              </p>
            </div>
          </div>

          {hasAssignedShift && (
            <button
              type="button"
              onClick={handleViewShift}
              disabled={!shift}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-100 bg-white px-3 py-2 text-xs font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Eye className="h-4 w-4" />
              View Details
            </button>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-white/70 bg-white/70 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
              <Clock className={`h-4 w-4 ${cardTone.accent}`} />
              Start
            </div>
            <p className="mt-1 text-sm font-bold text-gray-900">
              {formatAttendanceTime(shiftStartTime)}
            </p>
          </div>

          <div className="rounded-xl border border-white/70 bg-white/70 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
              <Clock className={`h-4 w-4 ${cardTone.accent}`} />
              End
            </div>
            <p className="mt-1 text-sm font-bold text-gray-900">
              {formatAttendanceTime(shiftEndTime)}
            </p>
          </div>

          <div className="rounded-xl border border-white/70 bg-white/70 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
              <Coffee className={`h-4 w-4 ${cardTone.accent}`} />
              Break
            </div>
            <p className="mt-1 text-sm font-bold text-gray-900">{breakLabel}</p>
          </div>

          <div className="rounded-xl border border-white/70 bg-white/70 px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
              <TimerReset className={`h-4 w-4 ${cardTone.accent}`} />
              Grace Period
            </div>
            <p className="mt-1 text-sm font-bold text-gray-900">
              {lateGraceMinutes != null ? `${lateGraceMinutes} min` : "--"}
            </p>
          </div>
        </div>
      </div>

      <UserShiftViewModal
        open={isViewOpen}
        shift={shift ?? null}
        onClose={() => setIsViewOpen(false)}
      />
    </>
  );
};

export default UserShiftScheduleCard;
