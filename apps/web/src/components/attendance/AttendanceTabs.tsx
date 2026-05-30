import { Clock, AlertTriangle, CheckCircle } from "lucide-react";

type TabType = "dtr" | "ot" | "setup";

interface AttendanceTabsProps {
  activeTab: TabType;
  onChange: (tab: TabType) => void;
  isAdmin?: boolean;
}

const AttendanceTabs = ({
  activeTab,
  onChange,
  isAdmin = false,
}: AttendanceTabsProps) => {
  const tabs = [
    { id: "dtr" as const, label: "Daily Time Record", icon: Clock },
    { id: "ot" as const, label: "Overtime", icon: AlertTriangle },
    ...(isAdmin
      ? [{ id: "setup" as const, label: "DTR Setup", icon: CheckCircle }]
      : []),
  ];

  return (
    <div className="pro-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`pro-tab flex items-center gap-2 ${
            activeTab === tab.id ? "active" : ""
          }`}
        >
          <tab.icon className="w-4 h-4" />
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export default AttendanceTabs;