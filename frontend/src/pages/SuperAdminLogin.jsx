import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loginSuperAdmin } from '../api';
import { MdAdminPanelSettings, MdPerson, MdLock, MdLogin, MdVisibility, MdVisibilityOff, MdArrowBack, MdBusiness, MdWarning } from 'react-icons/md';

export default function SuperAdminLogin() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await loginSuperAdmin(form);
      if (res.data.success) {
        localStorage.setItem('superToken', res.data.token);
        localStorage.setItem('superAdmin', JSON.stringify(res.data.admin));
        navigate('/super-admin/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Invalid super admin credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-left" style={{ background: 'linear-gradient(135deg, #1a0533 0%, #2d1b69 50%, #1a0533 100%)' }}>
        <div className="login-hero">
          <div className="login-hero-icon">
            <MdAdminPanelSettings />
          </div>
          <h1 className="login-hero-title">Super Admin Portal</h1>
          <p className="login-hero-sub">
            Platform administration dashboard. Manage all organisations, monitor usage, and control access.
          </p>
          <div className="login-features">
            {[
              { icon: <MdBusiness />, text: 'Create and manage organisations' },
              { icon: <MdLock />, text: 'Set admin credentials for each org' },
              { icon: <MdAdminPanelSettings />, text: 'Monitor platform-wide statistics' },
              { icon: <MdLock />, text: 'Control access and permissions' },
            ].map((f, i) => (
              <div key={i} className="login-feature">
                <div className="login-feature-icon" style={{ background: 'rgba(139,92,246,0.15)' }}>{f.icon}</div>
                <span>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="login-right">
        <div className="login-form-container">
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#8b5cf6', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MdAdminPanelSettings /> Super Admin Access
            </div>
            <h2 className="login-form-title">Platform Administration</h2>
            <p className="login-form-sub">Sign in with your super admin credentials</p>
          </div>

          {error && (
            <div className="login-alert login-alert-error"><MdWarning style={{ verticalAlign: 'middle', marginRight: 6 }} /> {error}</div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="sa-username">Admin Username</label>
              <div style={{ position: 'relative' }}>
                <MdPerson style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  id="sa-username"
                  className="input"
                  style={{ paddingLeft: '38px' }}
                  type="text"
                  placeholder="superadmin"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="sa-password">Password</label>
              <div style={{ position: 'relative' }}>
                <MdLock style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  id="sa-password"
                  className="input"
                  style={{ paddingLeft: '38px', paddingRight: '38px' }}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', padding: '4px'
                  }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-lg w-full"
              disabled={loading}
              style={{ marginTop: '8px', background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: '#fff' }}
            >
              {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : <MdLogin />}
              {loading ? 'Signing in...' : 'Access Super Admin'}
            </button>
          </form>

          

          <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
            <Link to="/login" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <MdArrowBack /> Back to Organisation Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
