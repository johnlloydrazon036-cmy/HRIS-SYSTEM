import { useEffect, useState } from 'react';

interface LiveTrackerProps {
    timeIn: string | null;
    timeOut: string | null;
    onTimeIn: () => Promise<void>;
    onTimeOut: () => Promise<void>;
    loading?: boolean;

    isNoShift?: boolean;
    trackerMessage?: string;
}

const LiveTracker = ({
    timeIn,
    timeOut,
    onTimeIn,
    onTimeOut,
    loading = false,
    isNoShift = false,
    trackerMessage = '',
}: LiveTrackerProps) => {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const formatTime = (date: Date) =>
        date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });

    const canTimeIn = !timeIn && !isNoShift;
    const canTimeOut = !!timeIn && !timeOut && !isNoShift;

    return (
        <div className="flex flex-col gap-3">
            {/* TIME DISPLAY */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
                        Current Time
                    </p>
                    <p className="text-2xl font-black font-mono tracking-tighter text-emerald-600">
                        {formatTime(currentTime)}
                    </p>
                </div>

                {/* ACTIONS */}
                <div className="flex items-center gap-3">
                    {canTimeIn && (
                        <button
                            type="button"
                            onClick={onTimeIn}
                            disabled={loading}
                            className="btn bg-emerald-500 hover:bg-emerald-600 text-white border-none"
                        >
                            {loading ? 'Saving...' : 'Time In'}
                        </button>
                    )}

                    {canTimeOut && (
                        <button
                            type="button"
                            onClick={onTimeOut}
                            disabled={loading}
                            className="btn bg-rose-500 hover:bg-rose-600 text-white border-none"
                        >
                            {loading ? 'Saving...' : 'Time Out'}
                        </button>
                    )}

                    {!canTimeIn && !canTimeOut && !isNoShift && (
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 whitespace-nowrap">
                            Day Logged
                        </span>
                    )}

                    {/* NO SHIFT STATE */}
                    {isNoShift && (
                        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full border border-gray-200 whitespace-nowrap">
                            No Active Shift
                        </span>
                    )}
                </div>
            </div>

            {/* MESSAGE DISPLAY */}
            {trackerMessage && (
                <div className="text-xs text-gray-500 bg-gray-50 border border-gray-100 px-3 py-2 rounded-md">
                    {trackerMessage}
                </div>
            )}
        </div>
    );
};

export default LiveTracker;