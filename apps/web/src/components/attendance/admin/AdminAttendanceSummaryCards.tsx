import type { LucideIcon } from 'lucide-react';

type StatCard = {
    label: string;
    value: number;
    icon: LucideIcon;
    gradient: string;
};

type Props = {
    statCards: StatCard[];
};

const AdminAttendanceSummaryCards = ({ statCards }: Props) => {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((card, i) => (
                <div
                    key={card.label}
                    className="stat-card animate-fade-in-up"
                    style={{ background: card.gradient, animationDelay: `${i * 0.1}s`, opacity: 0 }}
                >
                    <div className="flex items-center justify-between relative z-10">
                        <div>
                            <p className="stat-label">{card.label}</p>
                            <p className="stat-value">{card.value}</p>
                        </div>
                        <div className="stat-icon">
                            <card.icon className="w-5 h-5" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default AdminAttendanceSummaryCards;
