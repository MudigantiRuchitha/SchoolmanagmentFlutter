import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { MdNotifications, MdClose, MdMenu } from 'react-icons/md';

export default function Header({ title, subtitle, right, onToggleMobileNav }) {
  const { org } = useAuth();

  const [showNotifications, setShowNotifications] = useState(false);

  const notificationRef = useRef(null);
  const bellRef = useRef(null);

  // =========================================================
  // SAMPLE NOTIFICATIONS
  // =========================================================
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      title: 'Welcome',
      message: 'Welcome to the School Management System.',
      time: 'Just now',
      read: false,
    },
    {
      id: 2,
      title: 'Timetable',
      message: 'Timetable setup is available.',
      time: 'Today',
      read: false,
    },
  ]);

  // =========================================================
  // CLOSE NOTIFICATION WHEN CLICKING OUTSIDE
  // =========================================================
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target) &&
        bellRef.current &&
        !bellRef.current.contains(event.target)
      ) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // =========================================================
  // UNREAD COUNT
  // =========================================================
  const unreadCount = notifications.filter(
    (notification) => !notification.read
  ).length;

  // =========================================================
  // OPEN / CLOSE NOTIFICATIONS
  // =========================================================
  const handleNotificationClick = () => {
    setShowNotifications((prev) => !prev);
  };

  // =========================================================
  // MARK ONE NOTIFICATION AS READ
  // =========================================================
  const markAsRead = (id) => {
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id
          ? {
              ...notification,
              read: true,
            }
          : notification
      )
    );
  };

  // =========================================================
  // MARK ALL NOTIFICATIONS AS READ
  // =========================================================
  const markAllAsRead = () => {
    setNotifications((prev) =>
      prev.map((notification) => ({
        ...notification,
        read: true,
      }))
    );
  };

  // =========================================================
  // MARK ONE NOTIFICATION AS UNREAD
  // =========================================================
  const markAsUnread = (id) => {
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id
          ? {
              ...notification,
              read: false,
            }
          : notification
      )
    );
  };

  // =========================================================
  // REMOVE ONE NOTIFICATION
  // =========================================================
  const removeNotification = (id) => {
    setNotifications((prev) =>
      prev.filter((notification) => notification.id !== id)
    );
  };

  return (
    <>
      <header className="header">

        {/* =====================================================
            LEFT SIDE
        ====================================================== */}
        <div className="header-left">
          <button
            type="button"
            className="mobile-nav-toggle"
            onClick={onToggleMobileNav}
            aria-label="Open Navigation Menu"
            title="Open Navigation Menu"
          >
            <MdMenu size={22} />
          </button>

          <div className="header-title-container">
            <div className="page-title">
              {title}
            </div>

            {subtitle && (
              <div className="page-subtitle">
                {subtitle}
              </div>
            )}
          </div>
        </div>

        {/* =====================================================
            RIGHT SIDE
        ====================================================== */}
        <div className="header-right">

          {right && (
            <div className="header-desktop-actions">
              {right}
            </div>
          )}

        {/* ===================================================
            NOTIFICATION BELL
        ==================================================== */}
        <div
          ref={bellRef}
          style={{
            position: 'relative',
          }}
        >
          <button
            type="button"
            onClick={handleNotificationClick}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '42px',
              height: '42px',
              border: 'none',
              background: 'var(--bg)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
            }}
            title="Notifications"
          >
            <MdNotifications size={21} />

            {/* =================================================
                UNREAD COUNT
            ================================================== */}
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '2px',
                  right: '2px',
                  minWidth: '18px',
                  height: '18px',
                  padding: '0 4px',
                  background: '#ef4444',
                  color: '#ffffff',
                  borderRadius: '50%',
                  fontSize: '10px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #ffffff',
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* ===================================================
            NOTIFICATION DROPDOWN
        ==================================================== */}
        {showNotifications && (
          <div
            ref={notificationRef}
            style={{
              position: 'fixed',

              /* Position near the top-right bell */
              top: '70px',
              right: '24px',

              width: '380px',
              maxWidth: 'calc(100vw - 32px)',

              /* Solid background */
              background: '#ffffff',

              border: '1px solid #e5e7eb',
              borderRadius: '16px',

              boxShadow:
                '0 20px 50px rgba(0, 0, 0, 0.18)',

              /* Keep above dashboard */
              zIndex: 999999,

              opacity: 1,

              overflow: 'hidden',
            }}
          >

            {/* =================================================
                NOTIFICATION HEADER
            ================================================== */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '18px 20px',
                background: '#ffffff',
                borderBottom: '1px solid #e5e7eb',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '18px',
                    fontWeight: 700,
                    color: '#111827',
                  }}
                >
                  Notifications
                </div>

                <div
                  style={{
                    marginTop: '4px',
                    fontSize: '13px',
                    color: '#6b7280',
                  }}
                >
                  {unreadCount} unread notification
                  {unreadCount !== 1 ? 's' : ''}
                </div>
              </div>

              {/* =================================================
                  MARK ALL READ
              ================================================== */}
              <button
                type="button"
                onClick={markAllAsRead}
                disabled={unreadCount === 0}
                style={{
                  border: 'none',
                  background: 'transparent',

                  color:
                    unreadCount === 0
                      ? '#9ca3af'
                      : '#6366f1',

                  cursor:
                    unreadCount === 0
                      ? 'default'
                      : 'pointer',

                  fontSize: '13px',
                  fontWeight: 600,

                  padding: '6px 0',
                }}
              >
                Mark all read
              </button>
            </div>

            {/* =================================================
                NOTIFICATION LIST
            ================================================== */}
            <div
              style={{
                maxHeight: '360px',
                overflowY: 'auto',
                background: '#ffffff',
              }}
            >

              {/* =================================================
                  NO NOTIFICATIONS
              ================================================== */}
              {notifications.length === 0 ? (
                <div
                  style={{
                    padding: '40px 20px',
                    textAlign: 'center',
                    background: '#ffffff',
                    color: '#6b7280',
                  }}
                >
                  <MdNotifications
                    size={40}
                    style={{
                      opacity: 0.35,
                    }}
                  />

                  <div
                    style={{
                      marginTop: '10px',
                      fontSize: '14px',
                    }}
                  >
                    No notifications
                  </div>
                </div>
              ) : (

                /* =================================================
                   NOTIFICATION ITEMS
                ================================================== */
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    style={{
                      display: 'flex',
                      gap: '12px',

                      padding: '16px 20px',

                      background: notification.read
                        ? '#ffffff'
                        : '#f5f7ff',

                      borderBottom:
                        '1px solid #e5e7eb',
                    }}
                  >

                    {/* =================================================
                        STATUS DOT
                    ================================================== */}
                    <div
                      style={{
                        width: '8px',
                        height: '8px',
                        minWidth: '8px',

                        marginTop: '6px',

                        borderRadius: '50%',

                        background:
                          notification.read
                            ? '#d1d5db'
                            : '#6366f1',
                      }}
                    />

                    {/* =================================================
                        NOTIFICATION CONTENT
                    ================================================== */}
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                      }}
                    >

                      {/* =================================================
                          TITLE + REMOVE BUTTON
                      ================================================== */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                        }}
                      >

                        <div
                          style={{
                            fontSize: '14px',
                            fontWeight: 700,
                            color: '#111827',
                          }}
                        >
                          {notification.title}
                        </div>

                        {/* =================================================
                            X BUTTON = REMOVE NOTIFICATION
                        ================================================== */}
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            removeNotification(notification.id);
                          }}
                          title="Remove notification"
                          style={{
                            border: 'none',
                            background: 'transparent',

                            padding: '4px',
                            margin: 0,

                            width: '28px',
                            height: '28px',

                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',

                            color: '#9ca3af',

                            cursor: 'pointer',

                            borderRadius: '50%',
                          }}
                        >
                          <MdClose size={18} />
                        </button>

                      </div>

                      {/* =================================================
                          MESSAGE
                      ================================================== */}
                      <div
                        style={{
                          marginTop: '5px',
                          fontSize: '13px',
                          lineHeight: '1.5',
                          color: '#6b7280',
                        }}
                      >
                        {notification.message}
                      </div>

                      {/* =================================================
                          TIME
                      ================================================== */}
                      <div
                        style={{
                          marginTop: '7px',
                          fontSize: '11px',
                          color: '#9ca3af',
                        }}
                      >
                        {notification.time}
                      </div>

                      {/* =================================================
                          MARK AS READ / UNREAD
                      ================================================== */}
                      <div
                        style={{
                          marginTop: '10px',
                        }}
                      >

                        {!notification.read ? (

                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              markAsRead(notification.id);
                            }}
                            style={{
                              border: 'none',
                              background: '#6366f1',
                              color: '#ffffff',

                              padding: '6px 10px',

                              borderRadius: '6px',

                              fontSize: '11px',
                              fontWeight: 600,

                              cursor: 'pointer',
                            }}
                          >
                            Mark as read
                          </button>

                        ) : (

                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              markAsUnread(notification.id);
                            }}
                            style={{
                              border:
                                '1px solid #d1d5db',

                              background: '#ffffff',

                              color: '#6b7280',

                              padding: '6px 10px',

                              borderRadius: '6px',

                              fontSize: '11px',
                              fontWeight: 600,

                              cursor: 'pointer',
                            }}
                          >
                            Mark as unread
                          </button>

                        )}

                      </div>

                    </div>
                  </div>
                ))
              )}
            </div>

            {/* =================================================
                FOOTER
            ================================================== */}
            <div
              style={{
                padding: '11px 16px',

                textAlign: 'center',

                borderTop:
                  '1px solid #e5e7eb',

                background: '#ffffff',
              }}
            >
              <span
                style={{
                  fontSize: '11px',
                  color: '#6b7280',
                }}
              >
                School Management System
              </span>
            </div>

          </div>
        )}

        {/* ===================================================
            ORGANIZATION
        ==================================================== */}
        <div
          className="header-org-badge"
          title={org?.name ? `${org.name} (${org?.code?.toUpperCase()})` : 'Organisation'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            background: 'rgba(99,102,241,0.08)',
            borderRadius: 'var(--radius-sm)',
            flexShrink: 0,
          }}
        >
          <div
            className="header-org-avatar"
            style={{
              width: '24px',
              height: '24px',
              background: 'var(--primary)',
              borderRadius: '6px',

              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',

              fontSize: '11px',
              fontWeight: 700,
              color: '#ffffff',
              flexShrink: 0,
            }}
          >
            {org?.code?.slice(0, 2).toUpperCase()}
          </div>

          <span
            className="header-org-name"
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--primary)',
              whiteSpace: 'nowrap',
            }}
          >
            {org?.name}
          </span>
        </div>

      </div>
    </header>

    {/* Mobile Action Buttons Strip */}
    {right && (
      <div className="header-mobile-actions">
        {right}
      </div>
    )}
  </>
);
}