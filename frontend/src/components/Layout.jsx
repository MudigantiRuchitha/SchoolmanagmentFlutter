import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileBottomNav from './MobileBottomNav';
import { useAuth } from '../context/AuthContext';
import { MdVisibility } from 'react-icons/md';

export default function Layout({ children, title, subtitle, headerRight }) {
  const { isReadOnly } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();

  // Close mobile nav automatically on route change
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  // Prevent background scrolling when mobile menu is open
  useEffect(() => {
    if (mobileNavOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileNavOpen]);

  // Touch swipe gesture support for mobile sidebar drawer
  useEffect(() => {
    let touchStartX = 0;
    let touchStartY = 0;

    const handleTouchStart = (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e) => {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const dx = touchEndX - touchStartX;
      const dy = touchEndY - touchStartY;

      // Only horizontal gestures (horizontal movement > 1.4x vertical movement)
      if (Math.abs(dx) > Math.abs(dy) * 1.4 && Math.abs(dx) > 55) {
        if (dx > 0 && touchStartX < 35) {
          // Swipe right from screen edge -> open sidebar
          setMobileNavOpen(true);
        } else if (dx < 0 && mobileNavOpen) {
          // Swipe left anywhere when open -> close sidebar
          setMobileNavOpen(false);
        }
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [mobileNavOpen]);

  return (
    <div className="layout">
      {/* Mobile Drawer Backdrop */}
      <div
        className={`sidebar-backdrop ${mobileNavOpen ? 'active' : ''}`}
        onClick={() => setMobileNavOpen(false)}
        aria-hidden="true"
      />

      <Sidebar
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="main-content">
        <Header
          title={title}
          subtitle={subtitle}
          right={headerRight}
          onToggleMobileNav={() => setMobileNavOpen((prev) => !prev)}
        />
        <main className="page-content">
          {isReadOnly && (
            <div className="readonly-alert-banner">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: '#e2e8f0', color: '#475569' }}>
                  <MdVisibility size={16} />
                </span>
                <div>
                  <strong style={{ color: '#1e293b' }}>Only Read Access (Viewer Mode):</strong>{' '}
                  You have read-only permissions across all modules. Creating, updating, and deleting records are restricted.
                </div>
              </div>
              <span className="badge badge-gray" style={{ fontWeight: 700, padding: '4px 10px', whiteSpace: 'nowrap' }}>
                Viewer Mode
              </span>
            </div>
          )}
          {children}
        </main>
      </div>

      {/* Persistent Mobile Bottom Navigation Bar */}
      <MobileBottomNav onOpenMenu={() => setMobileNavOpen(true)} />
    </div>
  );
}
