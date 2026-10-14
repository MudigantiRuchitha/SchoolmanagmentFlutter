import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSettings } from '../api';
import {
  MdDashboard,
  MdBusiness,
  MdGroup,
  MdAdminPanelSettings,
  MdSettings,
  MdSchool,
  MdPeople,
  MdPersonAdd,
  MdEventNote,
  MdAccessTime,
  MdBeachAccess,
  MdCalendarToday,
  MdAnnouncement,
  MdLogout,
  MdWorkspaces,
  MdCategory,
  MdMenuBook,
  MdMenu,
  MdClose
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

export default function Sidebar({ mobileOpen = false, onCloseMobile }) {
  const { user, org, logout } = useAuth();

  const [timetableAccess, setTimetableAccess] = useState(
    org?.timetable_access !== false
  );

  // Sidebar collapsed state
  const [collapsed, setCollapsed] = useState(
  localStorage.getItem('sidebarCollapsed') === 'true'
);

  const navigate = useNavigate();
  const location = useLocation();
  const sidebarNavRef = useRef(null);

  useEffect(() => {
    getSettings()
      .then(res => {
        if (res.data.settings?.timetable_access !== undefined) {
          setTimetableAccess(
            res.data.settings.timetable_access !== false
          );
        }
      })
      .catch(() => {});
  }, []);

  // Save sidebar state
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', collapsed);
  }, [collapsed]);
  // Remember sidebar scroll position
useEffect(() => {
  const nav = sidebarNavRef.current;

  if (!nav) return;

  const savedScroll = localStorage.getItem('sidebarScrollTop');

  if (savedScroll !== null) {
    requestAnimationFrame(() => {
      nav.scrollTop = Number(savedScroll);
    });
  }
}, [location.pathname]);


// Save sidebar scroll position while scrolling
useEffect(() => {
  const nav = sidebarNavRef.current;

  if (!nav) return;

  const handleScroll = () => {
    localStorage.setItem(
      'sidebarScrollTop',
      String(nav.scrollTop)
    );
  };

  nav.addEventListener('scroll', handleScroll);

  return () => {
    nav.removeEventListener('scroll', handleScroll);
  };
}, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.fullName
    ? user.fullName
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user?.username?.slice(0, 2).toUpperCase() || 'U';

  const filteredNavItems = navItems.map(section => ({
    ...section,
    items: section.items.filter(item => {
      if (
        item.to === '/timetable-setup' &&
        (!timetableAccess || org?.timetable_access === false)
      ) {
        return false;
      }

      return true;
    })
  }));

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>

      {/* ==================== SIDEBAR HEADER ==================== */}
      <div className="sidebar-top">

        <NavLink to="/dashboard" className="sidebar-logo" onClick={onCloseMobile}>

          <div className="sidebar-logo-icon">
            <MdSchool />
          </div>

          {!collapsed && (
            <div className="sidebar-logo-text">
              <div className="sidebar-logo-title">
                {org?.name || 'School Management'}
              </div>

              <div className="sidebar-logo-sub">
                Code: {org?.code?.toUpperCase()}
              </div>
            </div>
          )}

        </NavLink>

        {/* Collapse / Expand Button (Desktop) */}
        <button
          type="button"
          className="sidebar-toggle"
          onClick={() => setCollapsed(prev => !prev)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <MdMenu />
        </button>

        {/* Close Button (Mobile Drawer) */}
        <button
          type="button"
          className="sidebar-mobile-close"
          onClick={onCloseMobile}
          title="Close menu"
          aria-label="Close navigation menu"
        >
          <MdClose size={22} />
        </button>

      </div>

      {/* ==================== NAVIGATION ==================== */}
      <nav
      className="sidebar-nav"
      ref={sidebarNavRef}
      >

        {filteredNavItems.map((section) => (
          <div key={section.section}>

            {!collapsed && (
              <div className="sidebar-section-title">
                {section.section}
              </div>
            )}

            {section.items.map((item) => (
              <NavLink
  key={item.to}
  to={item.to}
  title={collapsed ? item.label : ''}
  onClick={() => {
    if (sidebarNavRef.current) {
      localStorage.setItem(
        'sidebarScrollTop',
        String(sidebarNavRef.current.scrollTop)
      );
    }
    if (onCloseMobile) {
      onCloseMobile();
    }
  }}
  className={({ isActive }) =>
    `sidebar-link ${isActive ? 'active' : ''}`
  }
>

                <span className="sidebar-link-icon">
                  {item.icon}
                </span>

                {!collapsed && (
                  <span className="sidebar-link-label">
                    {item.label}
                  </span>
                )}

              </NavLink>
            ))}

          </div>
        ))}

      </nav>

      {/* ==================== SIDEBAR FOOTER ==================== */}
      <div className="sidebar-footer">

        <div className="sidebar-user">

          <div
            className="sidebar-avatar"
            title={collapsed ? (user?.fullName || user?.username) : ''}
          >
            {initials}
          </div>

          {!collapsed && (
            <div className="sidebar-user-info">

              <div className="sidebar-user-name truncate">
                {user?.fullName || user?.username}
              </div>

              <div className="sidebar-user-role" style={{ marginTop: 3 }}>
                <span className={`badge ${user?.role === 'admin' ? 'badge-purple' : user?.role === 'manager' ? 'badge-info' : 'badge-gray'}`} style={{ fontSize: 10, padding: '2px 8px', textTransform: 'capitalize' }}>
                  {user?.role === 'admin' ? 'Full Access' : user?.role === 'manager' ? 'Read & Write' : 'Only Read (Viewer)'}
                </span>
              </div>

            </div>
          )}

          <button
            onClick={handleLogout}
            title="Logout"
            aria-label="Logout"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'rgba(148,163,184,0.7)',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: collapsed ? 0 : 'auto'
            }}
          >
            <MdLogout size={18} />
          </button>

        </div>

      </div>

    </aside>
  );
}