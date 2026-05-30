import { CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react';

interface UserAttendanceSummaryCardsProps {
    stats: {
        present: number;
        late: number;
        absent: number;
        totalMinutes: number;
    };
}

const formatLoggedMinutes = (minutes: number) => {
    if (!Number.isFinite(minutes) || minutes <= 0) return '--';

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    return `${hours}h ${mins}m`;
};

const UserAttendanceSummaryCards = ({ stats }: UserAttendanceSummaryCardsProps) => {
    const statCards = [
        {
            label: 'Present',
            value: `${stats.present} days`,
            icon: CheckCircle,
            gradient: 'linear-gradient(135deg, #059669, #10b981)',
        },
        {
            label: 'Late',
            value: `${stats.late} days`,
            icon: AlertTriangle,
            gradient: 'linear-gradient(135deg, #d97706, #f59e0b)',
        },
        {
            label: 'Absent',
            value: `${stats.absent} days`,
            icon: XCircle,
            gradient: 'linear-gradient(135deg, #dc2626, #ef4444)',
        },
        {
            label: 'Total Logged',
            value: formatLoggedMinutes(stats.totalMinutes),
            icon: Clock,
            gradient: 'linear-gradient(135deg, #2563eb, #3b82f6)',
        },
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((card, i) => (
                <div
                    key={card.label}
                    className="stat-card animate-fade-in-up"
                    style={{
                        background: card.gradient,
                        animationDelay: `${i * 0.1}s`,
                        opacity: 0,
                    }}
                >
                    <div className="flex items-center justify-between relative z-10">
                        <div className="flex-1 min-w-0 pr-4">
                            <p className="stat-label truncate">{card.label}</p>
                            <p className="font-bold text-white mt-1 text-xl sm:text-lg md:text-xl truncate tracking-tight">
                                {card.value}
                            </p>
                        </div>
                        <div className="stat-icon flex-shrink-0">
                            <card.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default UserAttendanceSummaryCards;