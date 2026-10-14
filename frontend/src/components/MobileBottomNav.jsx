import { NavLink } from 'react-router-dom';
import {
  MdDashboard,
  MdPersonAdd,
  MdPeople,
  MdEventNote,
  MdMenu
} from 'react-icons/md';

export default function MobileBottomNav({ onOpenMenu }) {
  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile Bottom Navigation">
      <NavLink
        to="/dashboard"
        className={({ isActive }) =>
          `mobile-bottom-nav-item ${isActive ? 'active' : ''}`
        }
      >
        <span className="mobile-bottom-nav-icon">
          <MdDashboard />
        </span>
        <span className="mobile-bottom-nav-label">Dashboard</span>
      </NavLink>

      <NavLink
        to="/students"
        className={({ isActive }) =>
          `mobile-bottom-nav-item ${isActive ? 'active' : ''}`
        }
      >
        <span className="mobile-bottom-nav-icon">
          <MdPersonAdd />
        </span>
        <span className="mobile-bottom-nav-label">Students</span>
      </NavLink>

      <NavLink
        to="/staff"
        className={({ isActive }) =>
          `mobile-bottom-nav-item ${isActive ? 'active' : ''}`
        }
      >
        <span className="mobile-bottom-nav-icon">
          <MdPeople />
        </span>
        <span className="mobile-bottom-nav-label">Staff</span>
      </NavLink>

      <NavLink
        to="/attendance/students"
        className={({ isActive }) =>
          `mobile-bottom-nav-item ${isActive ? 'active' : ''}`
        }
      >
        <span className="mobile-bottom-nav-icon">
          <MdEventNote />
        </span>
        <span className="mobile-bottom-nav-label">Attendance</span>
      </NavLink>

      <button
        type="button"
        className="mobile-bottom-nav-item"
        onClick={onOpenMenu}
        aria-label="Open Sidebar Navigation Menu"
      >
        <span className="mobile-bottom-nav-icon">
          <MdMenu />
        </span>
        <span className="mobile-bottom-nav-label">Menu</span>
      </button>
    </nav>
  );
}
