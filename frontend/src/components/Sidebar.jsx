import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSettings } from '../api';
import {
  MdDashboard, MdBusiness, MdGroup, MdAdminPanelSettings, MdSettings,
  MdSchool, MdPeople, MdPersonAdd, MdEventNote, MdAccessTime,
  MdBeachAccess, MdCalendarToday, MdAnnouncement, MdLogout, MdWorkspaces,
  MdCategory, MdMenuBook
} from 'react-icons/md';

const navItems = [
  { section: 'Overview', items: [
    { to: '/dashboard', icon: <MdDashboard />, label: 'Dashboard' },
  ]},
  { section: 'Organisation', items: [
    { to: '/branches', icon: <MdBusiness />, label: 'Branches' },
    { to: '/branch-groups', icon: <MdWorkspaces />, label: 'Branch Groups' },
    { to: '/admins', icon: <MdAdminPanelSettings />, label: 'Admin Users' },
    { to: '/settings', icon: <MdSettings />, label: 'Settings' },
  ]},
  { section: 'Academic Administrator', items: [
    { to: '/academic-data', icon: <MdMenuBook />, label: 'Academic Data' },
  ]},
  { section: 'Academic', items: [
    { to: '/academic-groups', icon: <MdCategory />, label: 'Academic Groups' },
    { to: '/classes', icon: <MdSchool />, label: 'Classes' },
    { to: '/staff', icon: <MdPeople />, label: 'Staff' },
    { to: '/students', icon: <MdPersonAdd />, label: 'Students' },
  ]},
  { section: 'Attendance', items: [
    { to: '/timetable-setup', icon: <MdAccessTime />, label: 'Timetable Setup' },
    { to: '/attendance/students', icon: <MdEventNote />, label: 'Student Attendance' },
    { to: '/attendance/staff', icon: <MdAccessTime />, label: 'Staff Attendance' },
  ]},
  { section: 'Management', items: [
    { to: '/leaves', icon: <MdBeachAccess />, label: 'Leave Management' },
    { to: '/holidays', icon: <MdCalendarToday />, label: 'Holidays' },
    { to: '/notices', icon: <MdAnnouncement />, label: 'Notices' },
  ]},
];

export default function Sidebar() {
  const { user, org, logout } = useAuth();
  const [timetableAccess, setTimetableAccess] = useState(org?.timetable_access !== false);
  const navigate = useNavigate();

  useEffect(() => {
    getSettings()
      .then(res => {
        if (res.data.settings?.timetable_access !== undefined) {
          setTimetableAccess(res.data.settings.timetable_access !== false);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.fullName
    ? user.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.username?.slice(0, 2).toUpperCase() || 'U';

  const filteredNavItems = navItems.map(section => ({
    ...section,
    items: section.items.filter(item => {
      if (item.to === '/timetable-setup' && (!timetableAccess || org?.timetable_access === false)) return false;
      return true;
    })
  }));

  return (
    <aside className="sidebar">
      <NavLink to="/dashboard" className="sidebar-logo">
        <div className="sidebar-logo-icon"><MdSchool /></div>
        <div className="sidebar-logo-text">
          <div className="sidebar-logo-title">{org?.name || 'School Management'}</div>
          <div className="sidebar-logo-sub">Code: {org?.code?.toUpperCase()}</div>
        </div>
      </NavLink>

      <nav className="sidebar-nav">
        {filteredNavItems.map((section) => (
          <div key={section.section}>
            <div className="sidebar-section-title">{section.section}</div>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              >
                <span className="sidebar-link-icon">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name truncate">{user?.fullName || user?.username}</div>
            <div className="sidebar-user-role">{user?.role}</div>
          </div>
          <button
            onClick={handleLogout}
            title="Logout"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(148,163,184,0.7)', padding: '4px', borderRadius: '6px', display: 'flex' }}
          >
            <MdLogout size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}
