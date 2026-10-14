import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import { getSettings, updateSettings, changePassword } from '../api';
import { useAuth } from '../context/AuthContext';
import { MdSave, MdBusiness, MdLock, MdWarning } from 'react-icons/md';

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({ name: '', domain: '', address: '', phone: '', email: '' });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [showPassModal, setShowPassModal] = useState(false);
  const [passForm, setPassForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passError, setPassError] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };
  const { org, isFullAdmin } = useAuth();
  const loginUrl = typeof window !== 'undefined' ? new URL('/login', window.location.origin).toString() : '/login';

  useEffect(() => {
    getSettings().then(r => {
      setSettings(r.data.settings);
      const s = r.data.settings;
      setForm({ name: s.name || '', domain: s.domain || '', address: s.address || '', phone: s.phone || '', email: s.email || '' });
    }).catch(() => {});
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try { await updateSettings(form); showToast('Settings saved!'); } catch { showToast('Failed.'); }
    setSaving(false);
  };

  const handleChangePass = async (e) => {
    e.preventDefault();
    setPassError('');
    if (passForm.newPassword !== passForm.confirmPassword) { setPassError('Passwords do not match.'); return; }
    if (passForm.newPassword.length < 6) { setPassError('Password must be at least 6 characters.'); return; }
    try {
      await changePassword({ currentPassword: passForm.currentPassword, newPassword: passForm.newPassword });
      showToast('Password changed!');
      setShowPassModal(false);
      setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) { setPassError(err.response?.data?.message || 'Failed.'); }
  };

  return (
    <Layout title="Settings" subtitle="Manage organisation settings">
      {toast && <div className="alert alert-success">{toast}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24 }}>
        {/* Org Settings */}
        <div className="card">
          <div className="card-header">
            <div className="card-title"><MdBusiness /> Organisation Profile</div>
          </div>
          <div className="card-body">
            <form onSubmit={handleSave}>
              <div style={{ padding: '12px 16px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Organisation Code</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 18, color: 'var(--primary)' }}>{settings?.code?.toUpperCase()}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}><MdWarning style={{ verticalAlign: 'middle', marginRight: 4 }} /> Code cannot be changed. Share this with your org admins.</div>
              </div>

              {!isFullAdmin && (
                <div style={{ padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 12.5, color: '#1e40af', marginBottom: 16 }}>
                  Organisation profile settings can only be altered by Full Administrators. You are in read-only mode.
                </div>
              )}

              <div className="form-group"><label>Organisation Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={!isFullAdmin} /></div>
              <div className="form-row">
                <div className="form-group"><label>Phone</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={!isFullAdmin} /></div>
                <div className="form-group"><label>Email</label><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!isFullAdmin} /></div>
              </div>
              <div className="form-group"><label>Domain</label><input className="input" placeholder="e.g. school.edu.in" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} disabled={!isFullAdmin} /></div>
              <div className="form-group"><label>Address</label><textarea className="input" rows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} disabled={!isFullAdmin} /></div>
              {isFullAdmin && (
                <button type="submit" className="btn btn-primary" disabled={saving}><MdSave /> {saving ? 'Saving...' : 'Save Changes'}</button>
              )}
            </form>
          </div>
        </div>

        {/* Security */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title"><MdLock /> Security</div>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>Keep your admin account secure by updating your password regularly.</p>
              <button className="btn btn-secondary w-full" onClick={() => setShowPassModal(true)}><MdLock style={{ verticalAlign: 'middle', marginRight: 6 }} /> Change Password</button>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title"><MdBusiness /> Login Info</div></div>
            <div className="card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'Login URL', value: loginUrl },
                  { label: 'Org Code', value: settings?.code || '—', mono: true },
                ].map(item => (
                  <div key={item.label} style={{ padding: '10px 12px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, fontFamily: item.mono ? 'monospace' : 'inherit' }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={showPassModal} onClose={() => setShowPassModal(false)} title="Change Password" size="sm"
        footer={<><button className="btn btn-secondary" onClick={() => setShowPassModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleChangePass}>Change Password</button></>}>
        {passError && <div className="alert alert-error">{passError}</div>}
        <form onSubmit={handleChangePass}>
          <div className="form-group"><label>Current Password</label><input className="input" type="password" value={passForm.currentPassword} onChange={(e) => setPassForm({ ...passForm, currentPassword: e.target.value })} required /></div>
          <div className="form-group"><label>New Password</label><input className="input" type="password" value={passForm.newPassword} onChange={(e) => setPassForm({ ...passForm, newPassword: e.target.value })} required /></div>
          <div className="form-group"><label>Confirm New Password</label><input className="input" type="password" value={passForm.confirmPassword} onChange={(e) => setPassForm({ ...passForm, confirmPassword: e.target.value })} required /></div>
        </form>
      </Modal>
    </Layout>
  );
}
