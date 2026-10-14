import React from 'react';
import { MdWarningAmber, MdDeleteOutline, MdHelpOutline, MdClose } from 'react-icons/md';

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message = 'Are you sure you want to proceed with this action?',
  confirmText = 'Yes, Proceed',
  cancelText = 'Cancel',
  type = 'warning', // 'danger' | 'warning' | 'primary' | 'success'
  loading = false
}) {
  if (!isOpen) return null;

  const typeConfig = {
    danger: {
      icon: <MdDeleteOutline size={32} />,
      iconBg: '#fee2e2',
      iconColor: '#dc2626',
      btnBg: '#ef4444',
      btnHover: '#dc2626',
      btnText: '#ffffff',
      badgeBg: '#fef2f2',
      badgeBorder: '#fecaca',
      badgeText: '#b91c1c'
    },
    warning: {
      icon: <MdWarningAmber size={32} />,
      iconBg: '#fef3c7',
      iconColor: '#d97706',
      btnBg: '#f59e0b',
      btnHover: '#d97706',
      btnText: '#ffffff',
      badgeBg: '#fffbeb',
      badgeBorder: '#fde68a',
      badgeText: '#b45309'
    },
    primary: {
      icon: <MdHelpOutline size={32} />,
      iconBg: '#e0e7ff',
      iconColor: '#4f46e5',
      btnBg: '#6366f1',
      btnHover: '#4f46e5',
      btnText: '#ffffff',
      badgeBg: '#eef2ff',
      badgeBorder: '#c7d2fe',
      badgeText: '#3730a3'
    },
    success: {
      icon: <MdHelpOutline size={32} />,
      iconBg: '#dcfce7',
      iconColor: '#16a34a',
      btnBg: '#10b981',
      btnHover: '#059669',
      btnText: '#ffffff',
      badgeBg: '#f0fdf4',
      badgeBorder: '#bbf7d0',
      badgeText: '#15803d'
    }
  };

  const currentType = typeConfig[type] || typeConfig.warning;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
        animation: 'fadeIn 0.15s ease'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '440px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          animation: 'scaleUp 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Top close button */}
        <button
          onClick={onClose}
          disabled={loading}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            background: '#f1f5f9',
            border: 'none',
            borderRadius: '50%',
            width: '30px',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: loading ? 'not-allowed' : 'pointer',
            color: '#64748b',
            transition: 'all 0.15s'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#e2e8f0'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
        >
          <MdClose size={18} />
        </button>

        {/* Warning Card Content */}
        <div style={{ padding: '28px 24px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Glowing Icon Badge */}
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: currentType.iconBg,
              color: currentType.iconColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
              boxShadow: `0 0 0 6px ${currentType.iconBg}88`
            }}
          >
            {currentType.icon}
          </div>

          {/* Heading */}
          <h3
            style={{
              margin: '0 0 8px',
              fontSize: '20px',
              fontWeight: 700,
              color: '#0f172a',
              letterSpacing: '-0.02em'
            }}
          >
            {title}
          </h3>

          {/* Message / Description */}
          <div
            style={{
              fontSize: '14px',
              lineHeight: 1.5,
              color: '#475569',
              marginBottom: '4px'
            }}
          >
            {message}
          </div>
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            padding: '16px 24px 24px',
            borderTop: '1px solid #f1f5f9',
            backgroundColor: '#fafafa'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              flex: 1,
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: 600,
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s'
            }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#ffffff'; }}
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 1,
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: 600,
              borderRadius: '8px',
              border: 'none',
              backgroundColor: currentType.btnBg,
              color: currentType.btnText,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              transition: 'all 0.15s',
              opacity: loading ? 0.7 : 1
            }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = currentType.btnHover; }}
            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = currentType.btnBg; }}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
