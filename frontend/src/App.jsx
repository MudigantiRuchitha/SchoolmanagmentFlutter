import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import Login from './pages/Login';
import SuperAdminLogin from './pages/SuperAdminLogin';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import Dashboard from './pages/Dashboard';
import Branches from './pages/Branches';
import BranchGroups from './pages/BranchGroups';
import AdminUsers from './pages/AdminUsers';
import Settings from './pages/Settings';
import AcademicGroups from './pages/AcademicGroups';
import Classes from './pages/Classes';
import Staff from './pages/Staff';
import Students from './pages/Students';
import StudentAttendance from './pages/StudentAttendance';
import TimetableSetup from './pages/TimetableSetup';
import StaffAttendance from './pages/StaffAttendance';
import LeaveManagement from './pages/LeaveManagement';
import Holidays from './pages/Holidays';
import Notices from './pages/Notices';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="spinner" style={{ width: 40, height: 40, marginBottom: 12 }} />
        <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading...</div>
      </div>
    </div>
  );
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/super-admin/login" element={<SuperAdminLogin />} />
      <Route path="/super-admin/dashboard" element={<SuperAdminDashboard />} />

      {/* Protected org routes */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/branches" element={<ProtectedRoute><Branches /></ProtectedRoute>} />
      <Route path="/branch-groups" element={<ProtectedRoute><BranchGroups /></ProtectedRoute>} />
      <Route path="/admins" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/academic-groups" element={<ProtectedRoute><AcademicGroups /></ProtectedRoute>} />
      <Route path="/classes" element={<ProtectedRoute><Classes /></ProtectedRoute>} />
      <Route path="/staff" element={<ProtectedRoute><Staff /></ProtectedRoute>} />
      <Route path="/students" element={<ProtectedRoute><Students /></ProtectedRoute>} />
      <Route path="/timetable-setup" element={<ProtectedRoute><TimetableSetup /></ProtectedRoute>} />
      <Route path="/attendance/students" element={<ProtectedRoute><StudentAttendance /></ProtectedRoute>} />
      <Route path="/attendance/staff" element={<ProtectedRoute><StaffAttendance /></ProtectedRoute>} />
      <Route path="/leaves" element={<ProtectedRoute><LeaveManagement /></ProtectedRoute>} />
      <Route path="/holidays" element={<ProtectedRoute><Holidays /></ProtectedRoute>} />
      <Route path="/notices" element={<ProtectedRoute><Notices /></ProtectedRoute>} />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
