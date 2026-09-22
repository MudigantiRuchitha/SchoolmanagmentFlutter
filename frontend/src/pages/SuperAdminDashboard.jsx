import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getSuperAdminStats, getSuperAdminOrgs, createOrg, updateOrg, deleteOrg } from '../api';
import Modal from '../components/Modal';
import { MdBusiness, MdGroup, MdPeople, MdSchool, MdAdd, MdEdit, MdDelete, MdLogout, MdCheckCircle, MdCancel, MdKey, MdArrowBack, MdAccessTime, MdVisibility } from 'react-icons/md';

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editOrg, setEditOrg] = useState(null);
  const [showOrgViewModal, setShowOrgViewModal] = useState(false);
  const [viewOrg, setViewOrg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({
    name: '', code: '', domain: '', address: '', phone: '', email: '',
    adminUsername: '', adminPassword: '', adminFullName: '', adminEmail: '',
    timetableAccess: true, allowedAttendanceMode: 'BOTH'
  });
  const navigate = useNavigate();
  const superAdmin = JSON.parse(localStorage.getItem('superAdmin') || '{}');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  useEffect(() => {
    const token = localStorage.getItem('superToken');
    if (!token) { navigate('/super-admin/login'); return; }
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [s, o] = await Promise.all([getSuperAdminStats(), getSuperAdminOrgs()]);
      setStats(s.data.stats);
      setOrgs(o.data.organisations);
    } catch { navigate('/super-admin/login'); }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const editingOrganisation = editOrg;
    setSaving(true);
    try {
      if (editOrg) {
        await updateOrg(editOrg.id, { 
          name: form.name, 
          domain: form.domain, 
          address: form.address, 
          phone: form.phone, 
          email: form.email,
          timetableAccess: form.timetableAccess,
          allowedAttendanceMode: form.allowedAttendanceMode
        });
        showToast('Organisation updated!');
      } else {
        await createOrg(form);
        showToast('Organisation created! Credentials ready to share.');
      }
      setShowModal(false);
      setEditOrg(null);
      resetForm();
      await fetchData();
      if (editingOrganisation) {
        returnToOrgView({
          ...editingOrganisation,
          name: form.name,
          domain: form.domain,
          address: form.address,
          phone: form.phone,
          email: form.email,
          timetable_access: form.timetableAccess,
          allowed_attendance_mode: form.allowedAttendanceMode
        });
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error occurred');
    }
    setSaving(false);
  };

  const handleDelete = async (org) => {
    if (!confirm(`Delete organisation "${org.name}"? This will delete ALL data.`)) return;
    try {
      await deleteOrg(org.id);
      showToast('Organisation deleted.');
      fetchData();
    } catch { showToast('Failed to delete.'); }
  };

  const handleToggle = async (org) => {
    try {
      await updateOrg(org.id, { isActive: !org.is_active });
      showToast(`Organisation ${org.is_active ? 'deactivated' : 'activated'}.`);
      await fetchData();
      setViewOrg({ ...org, is_active: !org.is_active });
      setShowOrgViewModal(true);
    } catch { showToast('Failed to update.'); }
  };

  const openCreate = () => { resetForm(); setEditOrg(null); setShowModal(true); };
  const openOrgView = (org) => { setViewOrg(org); setShowOrgViewModal(true); };
  const returnToOrgView = (org = viewOrg || editOrg) => {
    if (org) {
      setViewOrg(org);
      setShowOrgViewModal(true);
    }
  };
  const openEdit = (org) => {
    setEditOrg(org);
    setForm({ 
      name: org.name, 
      code: org.code, 
      domain: org.domain || '', 
      address: org.address || '', 
      phone: org.phone || '', 
      email: org.email || '', 
      adminUsername: '', 
      adminPassword: '', 
      adminFullName: '', 
      adminEmail: '',
      timetableAccess: org.timetable_access !== false,
      allowedAttendanceMode: org.allowed_attendance_mode || 'BOTH'
    });
    setShowModal(true);
  };
  const closeOrgEdit = () => {
    const orgToView = editOrg || viewOrg;
    setShowModal(false);
    setEditOrg(null);
    resetForm();
    returnToOrgView(orgToView);
  };
  const resetForm = () => setForm({ 
    name: '', code: '', domain: '', address: '', phone: '', email: '', 
    adminUsername: '', adminPassword: '', adminFullName: '', adminEmail: '',
    timetableAccess: true, allowedAttendanceMode: 'BOTH'
  });

  const handleLogout = () => {
    localStorage.removeItem('superToken');
    localStorage.removeItem('superAdmin');
    navigate('/super-admin/login');
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="spinner" style={{ borderTopColor: '#8b5cf6', width: 40, height: 40 }} />
        <div style={{ marginTop: 16 }}>Loading...</div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #f8fafc)' }}>
      {/* Top navbar */}
      <div style={{ background: '#0f172a', color: '#fff', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>SA</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Super Admin Dashboard</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Multi-Tenant Platform Control</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 14, color: '#cbd5e1' }}>Welcome, <strong>{superAdmin.fullName || superAdmin.username}</strong></span>
          <button className="btn btn-secondary btn-sm" onClick={handleLogout} style={{ background: '#1e293b', border: '1px solid #334155', color: '#f8fafc' }}>
            <MdLogout /> Logout
          </button>
        </div>
      </div>

      <div style={{ padding: '32px 32px' }}>
        {toast && <div className="alert alert-success" style={{ marginBottom: 20 }}><MdCheckCircle style={{ verticalAlign: 'middle', marginRight: 6 }} /> {toast}</div>}

        {/* Stats */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
            <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#e0e7ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}><MdBusiness /></div>
              <div><div style={{ fontSize: 24, fontWeight: 800 }}>{stats.total_orgs}</div><div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total Organisations</div></div>
            </div>
            <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#dcfce7', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}><MdCheckCircle /></div>
              <div><div style={{ fontSize: 24, fontWeight: 800 }}>{stats.active_orgs}</div><div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Active Organisations</div></div>
            </div>
            <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#fef3c7', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}><MdSchool /></div>
              <div><div style={{ fontSize: 24, fontWeight: 800 }}>{stats.total_students}</div><div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total Students</div></div>
            </div>
            <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#f3e8ff', color: '#6b21a8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}><MdPeople /></div>
              <div><div style={{ fontSize: 24, fontWeight: 800 }}>{stats.total_staff}</div><div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total Staff</div></div>
            </div>
          </div>
        )}

        {/* Organisations table */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18 }}>Registered Organisations</h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Manage tenant accounts, permissions and access modes</p>
            </div>
            <button className="btn btn-primary" onClick={openCreate}><MdAdd /> New Organisation</button>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Organisation Name</th>
                  <th>Code</th>
                  <th>Branches</th>
                  <th>Students</th>
                  <th>Staff</th>
                  <th>Timetable Access</th>
                  <th>Allowed Modes</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => (
                  <tr key={org.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{org.name}</div>
                      {org.email && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{org.email}</div>}
                    </td>
                    <td><span className="org-badge">{org.code}</span></td>
                    <td>{org.branch_count}</td>
                    <td>{org.student_count}</td>
                    <td>{org.staff_count}</td>
                    <td>
                      <span className={`badge ${org.timetable_access !== false ? 'badge-success' : 'badge-secondary'}`}>
                        {org.timetable_access !== false ? '● Enabled' : '○ Disabled'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: '#f1f5f9', color: '#334155' }}>
                        {org.allowed_attendance_mode === 'MORNING_EVENING' ? 'Morning & Evening Only' :
                         org.allowed_attendance_mode === 'PERIOD_WISE' ? 'Period-wise Only' : 'Both Modes Allowed'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${org.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {org.is_active ? '● Active' : '● Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-sm btn-secondary" onClick={() => openOrgView(org)} title="View organisation details and actions"><MdVisibility size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Organisation Details and Actions */}
      <Modal
        isOpen={showOrgViewModal}
        onClose={() => { setShowOrgViewModal(false); setViewOrg(null); }}
        title={viewOrg ? viewOrg.name : 'Organisation Details'}
        size="sm"
        footer={<button className="btn btn-secondary" onClick={() => setShowOrgViewModal(false)}>Close</button>}
      >
        {viewOrg && (
          <div>
            <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
              <div><strong>Organisation:</strong> {viewOrg.name || '—'}</div>
              <div><strong>Code:</strong> {viewOrg.code || '—'}</div>
              <div><strong>Branches:</strong> {viewOrg.branch_count || 0}</div>
              <div><strong>Students:</strong> {viewOrg.student_count || 0}</div>
              <div><strong>Staff:</strong> {viewOrg.staff_count || 0}</div>
              <div><strong>Status:</strong> {viewOrg.is_active ? 'Active' : 'Inactive'}</div>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => openEdit(viewOrg)}>
                <MdEdit /> Edit Organisation
              </button>
              <button
                className="btn"
                onClick={() => handleToggle(viewOrg)}
                style={{ background: viewOrg.is_active ? '#fef3c7' : '#dcfce7', color: viewOrg.is_active ? '#d97706' : '#15803d' }}
              >
                {viewOrg.is_active ? <MdCancel /> : <MdCheckCircle />}
                {viewOrg.is_active ? 'Mark Inactive' : 'Mark Active'}
              </button>
              <button className="btn btn-danger" onClick={() => { setShowOrgViewModal(false); handleDelete(viewOrg); }}>
                <MdDelete /> Delete Organisation
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeOrgEdit}
        title={editOrg ? `Edit: ${editOrg.name}` : 'Create New Organisation'}
        size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={closeOrgEdit}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving...' : editOrg ? 'Save Changes' : 'Create Organisation'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Organisation Name *</label>
              <input className="input" placeholder="e.g. ABC School" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Organisation Code * {editOrg && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(cannot change)</span>}</label>
              <input className="input" placeholder="e.g. abc" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase() })} required disabled={!!editOrg} style={{ fontFamily: 'monospace' }} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Phone</label>
              <input className="input" placeholder="+91-XXXXXXXXXX" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input className="input" type="email" placeholder="admin@school.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>

          <div className="form-group">
            <label>Address</label>
            <textarea className="input" placeholder="Full address..." value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} />
          </div>

          <hr className="divider" />
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <MdAccessTime /> Timetable & Attendance Setup Permissions
          </div>

          <div className="form-row" style={{ alignItems: 'center' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600 }}>
                <input 
                  type="checkbox" 
                  checked={form.timetableAccess} 
                  onChange={e => setForm({ ...form, timetableAccess: e.target.checked })} 
                />
                Enable Timetable & Attendance Setup Page in Admin Login
              </label>
            </div>

            {form.timetableAccess && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Allowed Attendance Modes</label>
                <select 
                  className="input" 
                  value={form.allowedAttendanceMode} 
                  onChange={e => setForm({ ...form, allowedAttendanceMode: e.target.value })}
                >
                  <option value="BOTH">Both Modes (Morning/Evening & Period-wise)</option>
                  <option value="MORNING_EVENING">Morning & Evening Mode Only</option>
                  <option value="PERIOD_WISE">Period-wise (Subject) Mode Only</option>
                </select>
              </div>
            )}
          </div>

          {!editOrg && (
            <>
              <hr className="divider" />
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MdKey /> Initial Admin Credentials <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>(share these with the organisation)</span>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Admin Username *</label>
                  <input className="input" placeholder="e.g. principal" value={form.adminUsername} onChange={(e) => setForm({ ...form, adminUsername: e.target.value })} required={!editOrg} />
                </div>
                <div className="form-group">
                  <label>Admin Password *</label>
                  <input className="input" type="text" placeholder="Secure password" value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} required={!editOrg} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Admin Full Name</label>
                  <input className="input" placeholder="Admin full name" value={form.adminFullName} onChange={(e) => setForm({ ...form, adminFullName: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Admin Email</label>
                  <input className="input" type="email" placeholder="admin@org.com" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} />
                </div>
              </div>
            </>
          )}
        </form>
      </Modal>
    </div>
  );
}
