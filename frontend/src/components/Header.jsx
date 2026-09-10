import { useAuth } from '../context/AuthContext';
import { MdNotifications } from 'react-icons/md';

export default function Header({ title, subtitle, right }) {
  const { org } = useAuth();

  return (
    <header className="header">
      <div className="header-left">
        <div>
          <div className="page-title">{title}</div>
          {subtitle && <div className="page-subtitle">{subtitle}</div>}
        </div>
      </div>
      <div className="header-right">
        {right}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', fontSize: '13px', color: 'var(--text-secondary)' }}>
          <MdNotifications size={18} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'rgba(99,102,241,0.08)', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ width: '24px', height: '24px', background: 'var(--primary)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#fff' }}>
            {org?.code?.slice(0,2).toUpperCase()}
          </div>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary)' }}>{org?.name}</span>
        </div>
      </div>
    </header>
  );
}
