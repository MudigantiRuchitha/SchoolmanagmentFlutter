import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loginAdmin } from '../api';
import { MdSchool, MdPerson, MdLock, MdBusiness, MdLogin, MdVisibility, MdVisibilityOff } from 'react-icons/md';

export default function Login() {
  const [form, setForm] = useState({ orgCode: '', username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await loginAdmin(form);
      if (res.data.success) {
        login(res.data.token, res.data.user, res.data.org);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-left">
        <div className="login-hero">
          <div className="login-hero-icon">🏫</div>
          <h1 className="login-hero-title">School Attendance Management System</h1>
          <p className="login-hero-sub">
            A complete solution for managing student and staff attendance, leaves, and school operations.
          </p>
          <div className="login-features">
            {[
              { icon: '📊', text: 'Real-time attendance tracking & reports' },
              { icon: '👥', text: 'Staff & student management' },
              { icon: '📅', text: 'Leave & holiday management' },
              { icon: '🔔', text: 'Notices & announcements' },
            ].map((f, i) => (
              <div key={i} className="login-feature">
                <div className="login-feature-icon">{f.icon}</div>
                <span>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="login-right">
        <div className="login-form-container">
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MdSchool /> Organisation Login
            </div>
            <h2 className="login-form-title">Welcome Back</h2>
            <p className="login-form-sub">Sign in to your organisation dashboard</p>
          </div>

          {error && (
            <div className="login-alert login-alert-error">
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="orgCode">Organisation Code</label>
              <div style={{ position: 'relative' }}>
                <MdBusiness style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  id="orgCode"
                  className="input"
                  style={{ paddingLeft: '38px' }}
                  type="text"
                  placeholder="e.g. vts, abc"
                  value={form.orgCode}
                  onChange={(e) => setForm({ ...form, orgCode: e.target.value })}
                  required
                  autoComplete="organization"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="username">Username</label>
              <div style={{ position: 'relative' }}>
                <MdPerson style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  id="username"
                  className="input"
                  style={{ paddingLeft: '38px' }}
                  type="text"
                  placeholder="Enter your username"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div style={{ position: 'relative' }}>
                <MdLock style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  id="password"
                  className="input"
                  style={{ paddingLeft: '38px', paddingRight: '38px' }}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  autoComplete="current-password"
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
              className="btn btn-primary w-full btn-lg"
              disabled={loading}
              style={{ marginTop: '8px' }}
            >
              {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : <MdLogin />}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div style={{ marginTop: '24px', padding: '16px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Demo Credentials
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div>🏫 Org Code: <strong>vts</strong></div>
              <div>👤 Username: <strong>venkat</strong></div>
              <div>🔑 Password: <strong>Venkat@312</strong></div>
            </div>
          </div>

          <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
            Platform administrator?{' '}
            <Link to="/super-admin/login" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
              Super Admin Login →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
