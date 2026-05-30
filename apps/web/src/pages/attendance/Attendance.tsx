import AdminAttendance from "./admin/AdminAttendance";
import UserAttendance from "./user/UserAttendance";
import { useAuth } from "../../context/AuthContext";

const isAdminRole = (role: unknown) => {
  if (typeof role !== "string") return false;

  const normalized = role.trim().toUpperCase();
  return normalized === "ADMIN" || normalized === "SUPER_ADMIN";
};

const Attendance = () => {
  const { user } = useAuth();

  return isAdminRole(user?.role) ? <AdminAttendance /> : <UserAttendance />;
};

export default Attendance;