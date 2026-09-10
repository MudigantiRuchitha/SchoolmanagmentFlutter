import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import { getAdmins, createAdmin, updateAdmin, deleteAdmin, getBranches } from '../api';
import { MdAdd, MdEdit, MdDelete, MdSearch, MdAdminPanelSettings, MdCheckCircle, MdCancel, MdBusiness } from 'react-icons/md';

const emptyForm = { username: '', password: '', fullName: '', email: '', phone: '', role: 'admin', branchAccess: 'all', newPassword: '', isActive: true };

export default function AdminUsers() {
  const [admins, setAdmins] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };
  
  useEffect(() => { fetchInit(); }, []);

  const fetchInit = async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([getAdmins(), getBranches()]);
      setAdmins(a.data.admins);
      setBranches(b.data.branches);
    } catch {}
    setLoading(false);
  };

  const fetchAdmins = async () => {
    try {
      const r = await getAdmins();
      setAdmins(r.data.admins);
    } catch {}
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editItem) {
        const data = { 
          fullName: form.fullName, 
          email: form.email, 
          phone: form.phone, 
          role: form.role, 
          branchAccess: form.branchAccess, 
          isActive: form.isActive 
        };
        if (form.newPassword) data.newPassword = form.newPassword;
        await updateAdmin(editItem.id, data);
        showToast('Admin user details updated!');
      } else {
        await createAdmin({ 
          username: form.username, 
          password: form.password, 
          fullName: form.fullName, 
          email: form.email, 
          phone: form.phone, 
          role: form.role, 
          branchAccess: form.branchAccess 
        });
        showToast('New admin user created successfully!');
      }
      setShowModal(false); setEditItem(null); setForm(emptyForm); fetchAdmins();
    } catch (err) { showToast(err.response?.data?.message || 'Error occurred while saving admin user.'); }
    setSaving(false);
  };

  const handleToggleStatus = async (a) => {
    try {
      await updateAdmin(a.id, { 
        fullName: a.full_name, 
        email: a.email, 
        phone: a.phone, 
        role: a.role, 
        branchAccess: a.branch_access, 
        isActive: !a.is_active 
      });
      showToast(`Admin "${a.username}" ${!a.is_active ? 'activated' : 'deactivated'}.`);
      fetchAdmins();
    } catch { showToast('Failed to update status.'); }
  };

  const handleDelete = async (a) => {
    if (!confirm(`Delete admin user "${a.username}"?`)) return;
    try { await deleteAdmin(a.id); showToast('Admin deleted.'); fetchAdmins(); } catch { showToast('Failed to delete admin.'); }
  };

  const openEdit = (a) => {
    setEditItem(a);
    setForm({ 
      username: a.username, 
      password: '', 
      fullName: a.full_name || '', 
      email: a.email || '', 
      phone: a.phone || '', 
      role: a.role || 'admin', 
      branchAccess: a.branch_access || 'all', 
      newPassword: '',
      isActive: a.is_active !== undefined ? a.is_active : true
    });
    setShowModal(true);
  };

  const getBranchBadge = (accessCode) => {
    if (!accessCode || accessCode === 'all') {
      return <span className="badge badge-purple">🏢 All Branches</span>;
    }
    const matchedBranch = branches.find(b => b.id.toString() === accessCode || b.code === accessCode || b.name === accessCode);
    if (matchedBranch) {
      return <span className="badge badge-info">📍 {matchedBranch.name}</span>;
    }
    return <span className="badge badge-gray">{accessCode}</span>;
  };

  const filtered = admins.filter(a => {
    const matchesSearch = !search || 
      a.username.toLowerCase().includes(search.toLowerCase()) || 
      (a.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.email || '').toLowerCase().includes(search.toLowerCase());
    const matchesRole = !filterRole || a.role === filterRole;
    const matchesBranch = !filterBranch || a.branch_access === filterBranch || (filterBranch === 'all' && a.branch_access === 'all');
    return matchesSearch && matchesRole && matchesBranch;
  });

  const stats = {
    total: admins.length,
    admins: admins.filter(a => a.role === 'admin').length,
    managers: admins.filter(a => a.role === 'manager').length,
    viewers: admins.filter(a => a.role === 'viewer').length,
    active: admins.filter(a => a.is_active).length,
  };

  return (
    <Layout title="Admin Users" subtitle="Manage organisation administrators, assign roles, and set branch-specific access permissions">
      {toast && <div className="alert alert-success">✅ {toast}</div>}

      {/* Top Stats */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fdf4ff', color: '#a855f7' }}>🛡️</div>
          <div className="stat-info">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Admin Users</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#f0fdf4', color: '#10b981' }}>✅</div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#10b981' }}>{stats.active}</div>
            <div className="stat-label">Active Users</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#eff6ff', color: '#3b82f6' }}>👑</div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#3b82f6' }}>{stats.admins}</div>
            <div className="stat-label">Full Admins</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fff7ed', color: '#f97316' }}>💼</div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#f97316' }}>{stats.managers}</div>
            <div className="stat-label">Managers</div>
          </div>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-left">
          <div className="search-box">
            <MdSearch color="var(--text-muted)" />
            <input 
              placeholder="Search by username, name..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
            />
          </div>
          <select className="input" style={{ width: 140, padding: '9px 10px', fontSize: 13 }} value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="viewer">Viewer</option>
          </select>
          <select className="input" style={{ width: 160, padding: '9px 10px', fontSize: 13 }} value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}>
            <option value="">All Branches Access</option>
            <option value="all">Organisation Wide (All)</option>
            {branches.map(b => <option key={b.id} value={b.id.toString()}>{b.name}</option>)}
          </select>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Showing {filtered.length} users</span>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(emptyForm); setEditItem(null); setShowModal(true); }}>
          <MdAdd /> Add Admin User
        </button>
      </div>

      {loading ? <div className="loading-overlay"><div className="spinner" /> Loading admin users...</div> : (
        <div className="table-container">
          <table>
            <thead><tr><th>Username</th><th>Full Name</th><th>Email / Phone</th><th>Role</th><th>Assigned Branch Access</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7}><div className="empty-state"><div className="empty-state-icon"><MdAdminPanelSettings /></div><div className="empty-state-title">No admin users found</div></div></td></tr>
              ) : filtered.map(a => (
                <tr key={a.id}>
                  <td><span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13 }}>{a.username}</span></td>
                  <td><div style={{ fontWeight: 600 }}>{a.full_name || '—'}</div></td>
                  <td style={{ fontSize: 13 }}>
                    {a.email && <div>✉️ {a.email}</div>}
                    {a.phone && <div style={{ color: 'var(--text-muted)' }}>📞 {a.phone}</div>}
                  </td>
                  <td>
                    <span className={`badge ${a.role === 'admin' ? 'badge-purple' : a.role === 'manager' ? 'badge-info' : 'badge-gray'}`}>
                      {a.role}
                    </span>
                  </td>
                  <td>
                    {getBranchBadge(a.branch_access)}
                  </td>
                  <td>
                    <span className={`badge ${a.is_active ? 'badge-success' : 'badge-danger'}`}>
                      {a.is_active ? '● Active' : '● Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-sm btn-secondary" onClick={() => openEdit(a)} title="Edit User"><MdEdit size={14} /></button>
                      <button 
                        className="btn btn-sm" 
                        onClick={() => handleToggleStatus(a)} 
                        title={a.is_active ? 'Deactivate User' : 'Activate User'}
                        style={{ background: a.is_active ? '#fef3c7' : '#dcfce7', color: a.is_active ? '#d97706' : '#15803d' }}
                      >
                        {a.is_active ? <MdCancel size={14} /> : <MdCheckCircle size={14} />}
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(a)} title="Delete User"><MdDelete size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Admin User Modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditItem(null); }} title={editItem ? `Edit Admin User: ${editItem.username}` : 'Add New Admin User'}
        footer={<><button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>{saving ? 'Saving...' : 'Save Admin User'}</button></>}>
        <form onSubmit={handleSubmit}>
          {!editItem && (
            <div className="form-row">
              <div className="form-group"><label>Username *</label><input className="input" placeholder="e.g. principal_north" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required /></div>
              <div className="form-group"><label>Password *</label><input className="input" type="password" placeholder="Secure password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div>
            </div>
          )}
          <div className="form-row">
            <div className="form-group"><label>Full Name</label><input className="input" placeholder="User full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
            <div className="form-group"><label>Email Address</label><input className="input" type="email" placeholder="user@school.edu.in" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Phone Number</label><input className="input" placeholder="+91-XXXXXXXXXX" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="form-group"><label>User Role</label>
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="admin">Admin (Full Control)</option>
                <option value="manager">Manager (Read & Write)</option>
                <option value="viewer">Viewer (Read Only)</option>
              </select>
            </div>
          </div>

          {/* Branch Assignment Option */}
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <MdBusiness style={{ color: 'var(--primary)' }} /> Assigned Branch Access *
            </label>
            <select 
              className="input" 
              value={form.branchAccess} 
              onChange={(e) => setForm({ ...form, branchAccess: e.target.value })}
              required
            >
              <option value="all">🏢 All Branches (Organisation Wide Access)</option>
              {branches.map(b => (
                <option key={b.id} value={b.id.toString()}>
                  📍 {b.name} {b.code ? `(${b.code})` : ''}
                </option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Assigning a specific branch restricts this admin's scope to that branch's students, staff, and classes.
            </div>
          </div>

          {editItem && (
            <>
              <div className="form-group">
                <label>New Password (leave blank to keep current)</label>
                <input className="input" type="password" placeholder="Enter new password if changing..." value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="adminIsActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} style={{ accentColor: 'var(--primary)', width: 18, height: 18 }} />
                <label htmlFor="adminIsActive" style={{ marginBottom: 0, cursor: 'pointer', fontWeight: 600 }}>Active User Status</label>
              </div>
            </>
          )}
        </form>
      </Modal>
    </Layout>
  );
}
