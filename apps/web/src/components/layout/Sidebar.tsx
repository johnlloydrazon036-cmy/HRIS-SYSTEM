import {
  Home,
  Users,
  Clock,
  FileText,
  DollarSign,
  Shield,
  Package,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Newspaper,
  BarChart3,
  Building2,
  HelpCircle,
  ClipboardList,
  X,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import logo from "../../assets/logo.svg";

type NavItem = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
};

type SidebarProps = {
  isMobileOpen: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
};

function NavSection({
  title,
  items,
  collapsed,
  onItemClick,
}: {
  title: string;
  items: NavItem[];
  collapsed: boolean;
  onItemClick?: () => void;
}) {
  return (
    <div className="mb-2">
      {!collapsed && (
        <p className="px-4 mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-300/50">
          {title}
        </p>
      )}

      {items.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === "/dashboard"}
          onClick={onItemClick}
          className={({ isActive }) =>
            `group flex items-center gap-3 mx-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative ${
              isActive
                ? "bg-white/15 text-white shadow-lg shadow-black/10"
                : "text-emerald-100/70 hover:bg-white/8 hover:text-white"
            } ${collapsed ? "justify-center px-0" : ""}`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-emerald-400 rounded-r-full" />
              )}

              <item.icon
                className={`w-[18px] h-[18px] flex-shrink-0 transition-colors ${
                  isActive
                    ? "text-emerald-400"
                    : "text-emerald-200/60 group-hover:text-emerald-300"
                }`}
              />

              {!collapsed && <span className="truncate">{item.label}</span>}
            </>
          )}
        </NavLink>
      ))}
    </div>
  );
}

const Sidebar = ({
  isMobileOpen,
  onClose,
  collapsed,
  onToggleCollapse,
}: SidebarProps) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const backendRole = user?.role;
  const isAdmin = backendRole === "SUPER_ADMIN" || backendRole === "ADMIN";

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
    onClose();
  };

  const mainNav: NavItem[] = [{ icon: Home, label: "Dashboard", path: "/dashboard" }];

  const hrNav: NavItem[] = [
    { icon: Users, label: "Employee Management", path: "/dashboard/personal-records" },
    { icon: Clock, label: "Attendance Log", path: "/dashboard/attendance" },
    { icon: FileText, label: "Leave Management", path: "/dashboard/leave" },
    { icon: DollarSign, label: "Payroll", path: "/dashboard/payroll" },
    { icon: Shield, label: "Government Compliance", path: "/dashboard/compliance" },
  ];

  const userNav: NavItem[] = [
    { icon: Clock, label: "Attendance Log", path: "/dashboard/my-attendance" },
    { icon: FileText, label: "Leave Management", path: "/dashboard/leave" },
    { icon: BarChart3, label: "My Performance", path: "/dashboard/my-performance" },
    { icon: DollarSign, label: "Payroll", path: "/dashboard/my-payslips" },
    { icon: Newspaper, label: "Company News", path: "/dashboard/company-news" },
    { icon: ClipboardList, label: "Daily Report", path: "/dashboard/daily-report" },
    { icon: Building2, label: "Company Directory", path: "/dashboard/company-directory" },
    { icon: HelpCircle, label: "Help & Support", path: "/dashboard/help-support" },
  ];

  const moduleNav: NavItem[] = [
    { icon: Package, label: "Asset Management", path: "/dashboard/assets" },
  ];

  const systemNav: NavItem[] = [
    { icon: Settings, label: "Settings", path: "/dashboard/settings" },
  ];

  return (
    <>
      {isMobileOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`
          fixed left-0 top-0 z-50 h-screen flex flex-col transition-all duration-300
          ${collapsed ? "w-[72px]" : "w-[260px]"}
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
        style={{
          background: "linear-gradient(180deg, #064e3b 0%, #065f46 40%, #047857 100%)",
        }}
      >
        <div
          className={`px-4 pt-5 pb-4 border-b border-white/10 ${
            collapsed ? "px-3" : ""
          }`}
        >
          <div className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}>
            <div className="w-10 h-10 rounded-xl bg-white/10 p-1.5 flex-shrink-0">
              <img src={logo} alt="SimpleVia Logo" className="w-full h-full" />
            </div>

            {!collapsed && (
              <div className="animate-fade-in flex-1">
                <p className="text-white text-sm font-bold leading-tight tracking-wide">
                  SIMPLEVIA
                </p>
                <p className="text-emerald-300/60 text-[10px] leading-tight">
                  HRIS System
                </p>
              </div>
            )}

            <button
              onClick={onClose}
              className="lg:hidden p-2 rounded-lg text-emerald-100/70 hover:bg-white/10 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto space-y-1">
          <NavSection
            title="Main"
            items={mainNav}
            collapsed={collapsed}
            onItemClick={onClose}
          />

          {isAdmin ? (
            <>
              <NavSection
                title="Human Resources"
                items={hrNav}
                collapsed={collapsed}
                onItemClick={onClose}
              />
              <NavSection
                title="Modules"
                items={moduleNav}
                collapsed={collapsed}
                onItemClick={onClose}
              />
              <NavSection
                title="System"
                items={systemNav}
                collapsed={collapsed}
                onItemClick={onClose}
              />
            </>
          ) : (
            <NavSection
              title="My Pages"
              items={userNav}
              collapsed={collapsed}
              onItemClick={onClose}
            />
          )}
        </nav>

        <div className="border-t border-white/10 p-3 space-y-2">
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex w-full items-center justify-center gap-2 px-3 py-2 rounded-xl text-emerald-200/60 hover:bg-white/8 hover:text-white transition-all text-xs font-medium"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span>Collapse</span>
              </>
            )}
          </button>

          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-2 py-2.5 rounded-xl border border-rose-500/30 text-white hover:bg-rose-500/20 transition-all text-sm font-semibold ${
              collapsed ? "justify-center px-0" : "px-4"
            }`}
          >
            <LogOut className="w-[18px] h-[18px] text-rose-400" />
            {!collapsed && <span>Log Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;