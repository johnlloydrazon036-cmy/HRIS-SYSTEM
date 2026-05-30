import React from "react";
import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import Layout from "./components/layout/Layout";
import Dashboard from "./pages/Dashboard";

// Personal Records
import EmployeeList from "./pages/personal-records/EmployeeList";
import EmployeeProfile from "./pages/personal-records/EmployeeProfile";

// Attendance
import AdminAttendance from "./pages/attendance/admin/AdminAttendance";

// Leave Management
import LeaveManagement from "./pages/leave/LeaveManagement";

// Payroll
import Payroll from "./pages/payroll/Payroll";

// Government Compliance
import GovernmentCompliance from "./pages/compliance/GovernmentCompliance";

// Employee Self-Service
import EmployeeSelfService from "./pages/self-service/EmployeeSelfService";
import UserAttendance from "./pages/attendance/user/UserAttendance";

// User Pages
import MyPaySlips from "./pages/user/MyPaySlips";
import CompanyDirectory from "./pages/user/CompanyDirectory";
import MyPerformance from "./pages/user/MyPerformance";
import CompanyNews from "./pages/user/CompanyNews";
import HelpSupport from "./pages/user/HelpSupport";

// Daily Accomplishment Report
import DailyAccomplishmentReport from "./pages/DailyReport/DailyAccomplishmentReport";

// Asset Management
import AssetManagement from "./pages/assets/AssetManagement";

// Clearance
import ClearanceList from "./pages/clearance/ClearanceList";
import ClearanceForm from "./pages/clearance/ClearanceForm";

// HRIS System
import HRISSystem from "./pages/HRISSystem";

// Admin Settings
import AdminSettings from "./pages/admin/AdminSettings";

import "./App.css";

/**
 * Blocks unauthenticated users from accessing protected routes.
 * Redirects to /login and preserves the intended destination in state.
 */
function RequireAuth() {
  const { isLoggedIn } = useAuth();
  const location = useLocation();

  if (!isLoggedIn) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

/**
 * Blocks authenticated users from visiting guest-only routes.
 * If already logged in, send them to /dashboard.
 */
function GuestOnly({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useAuth();

  if (isLoggedIn) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

/**
 * Blocks non-admin roles from accessing admin-only routes.
 */
function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const role = user?.role;
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Guest routes */}
      <Route
        path="/login"
        element={
          <GuestOnly>
            <Login />
          </GuestOnly>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <GuestOnly>
            <ForgotPassword />
          </GuestOnly>
        }
      />

      {/* Protected routes */}
      <Route element={<RequireAuth />}>
        <Route path="/dashboard" element={<Layout />}>
          <Route index element={<Dashboard />} />

          {/* Admin-only routes */}
          <Route
            path="personal-records"
            element={
              <AdminOnly>
                <EmployeeList />
              </AdminOnly>
            }
          />
          <Route
            path="employee/:id"
            element={
              <AdminOnly>
                <EmployeeProfile />
              </AdminOnly>
            }
          />
          <Route
            path="attendance"
            element={
              <AdminOnly>
                <AdminAttendance />
              </AdminOnly>
            }
          />
          <Route
            path="payroll"
            element={
              <AdminOnly>
                <Payroll />
              </AdminOnly>
            }
          />
          <Route
            path="assets"
            element={
              <AdminOnly>
                <AssetManagement />
              </AdminOnly>
            }
          />
          <Route
            path="clearance"
            element={
              <AdminOnly>
                <ClearanceList />
              </AdminOnly>
            }
          />
          <Route
            path="clearance/:id"
            element={
              <AdminOnly>
                <ClearanceForm />
              </AdminOnly>
            }
          />
          <Route
            path="hris"
            element={
              <AdminOnly>
                <HRISSystem />
              </AdminOnly>
            }
          />
          <Route
            path="settings"
            element={
              <AdminOnly>
                <AdminSettings />
              </AdminOnly>
            }
          />

          {/* Shared routes */}
          <Route path="compliance" element={<GovernmentCompliance />} />
          <Route path="leave" element={<LeaveManagement />} />
          <Route path="my-attendance" element={<UserAttendance />} />
          <Route path="self-service" element={<EmployeeSelfService />} />

          {/* User Pages */}
          <Route path="my-payslips" element={<MyPaySlips />} />
          <Route path="company-directory" element={<CompanyDirectory />} />
          <Route path="my-performance" element={<MyPerformance />} />
          <Route path="company-news" element={<CompanyNews />} />
          <Route path="help-support" element={<HelpSupport />} />

          {/* Daily Accomplishment Report */}
          <Route path="daily-report" element={<DailyAccomplishmentReport />} />
        </Route>
      </Route>

      {/* Default */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}