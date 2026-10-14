import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import { getAdmins, createAdmin, updateAdmin, deleteAdmin, getBranches } from '../api';
import { useAuth } from '../context/AuthContext';
import { 
  ROLE_DEFINITIONS, 
  PERMISSION_SPECIFICATIONS, 
  getRoleBadgeInfo 
} from '../utils/permissions';
import { 
  MdAdd, 
  MdEdit, 
  MdDelete, 
  MdSearch, 
  MdAdminPanelSettings, 
  MdCheckCircle, 
  MdCancel, 
  MdBusiness, 
  MdVisibility, 
  MdSecurity, 
  MdCheck, 
  MdClose,
  MdLock,
  MdInfo
} from 'react-icons/md';
import { filterBranches, getBranchScope, isDedicatedBranchUser } from '../utils/branchScope';

const emptyForm = { 
  username: '', 
  password: '', 
  fullName: '', 
  email: '', 
  phone: '', 
  role: 'admin', 
  branchAccess: 'all', 
  newPassword: '', 
  isActive: true 
};

export default function AdminUsers() {
  const { isFullAdmin: currentUserIsAdmin } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewAdmin, setViewAdmin] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [specTab, setSpecTab] = useState('selected'); // 'selected' | 'compare'

  // Confirmation Warning Modal state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: 'Are you sure?',
    message: '',
    confirmText: 'Yes, Proceed',
    type: 'warning',
    onConfirm: null,
    loading: false
  });

  const requestConfirm = ({ title = 'Are you sure?', message, confirmText, type = 'warning', onConfirm }) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      confirmText,
      type,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, loading: true }));
        try {
          await onConfirm();
          setConfirmDialog(prev => ({ ...prev, isOpen: false, loading: false }));
        } catch {
          setConfirmDialog(prev => ({ ...prev, loading: false }));
        }
      },
      loading: false
    });
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };
  
  useEffect(() => { fetchInit(); }, []);

  const fetchInit = async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([getAdmins(), getBranches()]);
      setAdmins(a.data.admins || []);
      setBranches(filterBranches(b.data.branches || []));
    } catch {}
    setLoading(false);
  };

  const fetchAdmins = async () => {
    try {
      const r = await getAdmins();
      setAdmins(r.data.admins || []);
    } catch {}
  };

  const executeSave = async () => {
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
      setShowModal(false); 
      setEditItem(null); 
      setForm(emptyForm); 
      fetchAdmins();
    } catch (err) { 
      showToast(err.response?.data?.message || 'Error occurred while saving admin user.'); 
    }
    setSaving(false);
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!editItem) {
      const selectedRoleTitle = ROLE_DEFINITIONS[form.role]?.name || form.role;
      requestConfirm({
        title: 'Confirm Admin Creation',
        message: `Create new administrator "${form.username}" with "${selectedRoleTitle}"?`,
        confirmText: 'Yes, Create Admin',
        type: 'primary',
        onConfirm: async () => {
          await executeSave();
        }
      });
      return;
    }
    executeSave();
  };

  const handleToggleStatus = (a) => {
    const nextStatus = !a.is_active;
    requestConfirm({
      title: 'Are you sure?',
      message: `Are you sure you want to ${nextStatus ? 'activate' : 'deactivate'} admin user "${a.username}"?`,
      confirmText: nextStatus ? 'Yes, Activate' : 'Yes, Deactivate',
      type: nextStatus ? 'success' : 'warning',
      onConfirm: async () => {
        try {
          await updateAdmin(a.id, { 
            fullName: a.full_name, 
            email: a.email, 
            phone: a.phone, 
            role: a.role, 
            branchAccess: a.branch_access, 
            isActive: nextStatus 
          });
          showToast(`Admin "${a.username}" ${nextStatus ? 'activated' : 'deactivated'}.`);
          fetchAdmins();
        } catch { showToast('Failed to update status.'); }
      }
    });
  };

  const handleDelete = (a) => {
    requestConfirm({
      title: 'Delete Admin User',
      message: `Are you sure you want to delete admin user "${a.username}"? This action cannot be undone.`,
      confirmText: 'Yes, Delete',
      type: 'danger',
      onConfirm: async () => {
        try { 
          await deleteAdmin(a.id); 
          showToast('Admin deleted.'); 
          fetchAdmins(); 
        } catch (err) { 
          showToast(err.response?.data?.message || 'Failed to delete admin.'); 
        }
      }
    });
  };

  const openEdit = (a) => {
    setEditItem(a);
    setForm({ 
      username: a.username, 
      password: '', 
      fullName: a.full_name || '', 
      email: a.email || '', 
      phone: a.phone || '', 
      role: (a.role || 'admin').toLowerCase(), 
      branchAccess: a.branch_access || 'all', 
      newPassword: '',
      isActive: a.is_active !== undefined ? a.is_active : true
    });
    setSpecTab('selected');
    setShowModal(true);
  };

  const openView = (a) => { 
    setViewAdmin(a); 
    setShowViewModal(true); 
  };

  const getBranchBadge = (accessCode) => {
    if (!accessCode || accessCode === 'all') {
      return <span className="badge badge-purple"><MdBusiness style={{ verticalAlign: 'middle', marginRight: 4 }} /> All Branches</span>;
    }
    const matchedBranch = branches.find(b => b.id.toString() === accessCode || b.code === accessCode || b.name === accessCode);
    if (matchedBranch) {
      return <span className="badge badge-info"><MdBusiness style={{ verticalAlign: 'middle', marginRight: 4 }} /> {matchedBranch.name}</span>;
    }
    return <span className="badge badge-gray">{accessCode}</span>;
  };

  const filtered = admins.filter(a => {
    const matchesSearch = !search || 
      a.username.toLowerCase().includes(search.toLowerCase()) || 
      (a.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (a.email || '').toLowerCase().includes(search.toLowerCase());
    const matchesRole = !filterRole || (a.role || '').toLowerCase() === filterRole.toLowerCase();
    const matchesBranch = !filterBranch || a.branch_access === filterBranch || (filterBranch === 'all' && a.branch_access === 'all');
    return matchesSearch && matchesRole && matchesBranch;
  });

  const stats = {
    total: admins.length,
    admins: admins.filter(a => (a.role || '').toLowerCase() === 'admin').length,
    managers: admins.filter(a => (a.role || '').toLowerCase() === 'manager').length,
    viewers: admins.filter(a => (a.role || '').toLowerCase() === 'viewer').length,
    active: admins.filter(a => a.is_active).length,
  };

  const currentRoleInfo = ROLE_DEFINITIONS[form.role] || ROLE_DEFINITIONS.admin;

  return (
    <Layout title="Admin Users" subtitle="Manage organisation administrators, assign granular access levels, and set branch permissions">
      {toast && <div className="alert alert-success"><MdCheckCircle style={{ verticalAlign: 'middle', marginRight: 6 }} /> {toast}</div>}

      {/* Top Stats Cards */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fdf4ff', color: '#a855f7' }}><MdAdminPanelSettings /></div>
          <div className="stat-info">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Admin Users</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#f0fdf4', color: '#10b981' }}><MdCheckCircle /></div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#10b981' }}>{stats.active}</div>
            <div className="stat-label">Active Users</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#ede9fe', color: '#7c3aed' }}><MdSecurity /></div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#7c3aed' }}>{stats.admins}</div>
            <div className="stat-label">Full Access (Admins)</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#dbeafe', color: '#1d4ed8' }}><MdEdit /></div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#1d4ed8' }}>{stats.managers}</div>
            <div className="stat-label">Read & Write (Managers)</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#f1f5f9', color: '#475569' }}><MdVisibility /></div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#475569' }}>{stats.viewers}</div>
            <div className="stat-label">Only Read (Viewers)</div>
          </div>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-left">
          <div className="search-box">
            <MdSearch color="var(--text-muted)" />
            <input 
              placeholder="Search by username, name, email..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
            />
          </div>
          <select 
            className="input" 
            style={{ width: 170, padding: '9px 10px', fontSize: 13 }} 
            value={filterRole} 
            onChange={(e) => setFilterRole(e.target.value)}
          >
            <option value="">All Access Levels</option>
            <option value="admin">Full Access (Admin)</option>
            <option value="manager">Read & Write (Manager)</option>
            <option value="viewer">Only Read (Viewer)</option>
          </select>
          <select 
            className="input" 
            style={{ width: 170, padding: '9px 10px', fontSize: 13 }} 
            value={filterBranch} 
            onChange={(e) => setFilterBranch(e.target.value)}
          >
            {!isDedicatedBranchUser() && <option value="">All Branches Access</option>}
            <option value="all">Organisation Wide (All)</option>
            {branches.map(b => <option key={b.id} value={b.id.toString()}>{b.name}</option>)}
          </select>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Showing {filtered.length} users</span>
        </div>
        
        {currentUserIsAdmin && (
          <button 
            className="btn btn-primary" 
            onClick={() => { setForm(emptyForm); setEditItem(null); setSpecTab('selected'); setShowModal(true); }}
          >
            <MdAdd /> Add Admin User
          </button>
        )}
      </div>

      {loading ? <div className="loading-overlay"><div className="spinner" /> Loading admin users...</div> : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Full Name</th>
                <th>Contact</th>
                <th>Access Level</th>
                <th>Assigned Branch Access</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <div className="empty-state-icon"><MdAdminPanelSettings /></div>
                      <div className="empty-state-title">No admin users found</div>
                      <div className="empty-state-text">Try adjusting your search criteria or add a new admin user.</div>
                    </div>
                  </td>
                </tr>
              ) : filtered.map(a => {
                const roleKey = (a.role || 'admin').toLowerCase();
                const roleInfo = ROLE_DEFINITIONS[roleKey] || ROLE_DEFINITIONS.admin;
                return (
                  <tr key={a.id}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13 }}>{a.username}</span>
                    </td>
                    <td><div style={{ fontWeight: 600 }}>{a.full_name || '—'}</div></td>
                    <td style={{ fontSize: 13 }}>
                      {a.email && <div>{a.email}</div>}
                      {a.phone && <div style={{ color: 'var(--text-muted)' }}>{a.phone}</div>}
                    </td>
                    <td>
                      <span 
                        className={`badge ${roleInfo.badgeClass}`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700 }}
                      >
                        {roleKey === 'admin' && <MdAdminPanelSettings size={14} />}
                        {roleKey === 'manager' && <MdEdit size={14} />}
                        {roleKey === 'viewer' && <MdVisibility size={14} />}
                        {roleInfo.name}
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
                        <button className="btn btn-sm btn-secondary" onClick={() => openView(a)} title="View user details and permissions">
                          <MdVisibility size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* =======================================================================
          VIEW ADMIN USER DETAILS & PERMISSIONS SPECIFICATION MODAL
      ======================================================================== */}
      <Modal 
        isOpen={showViewModal} 
        onClose={() => setShowViewModal(false)} 
        title={viewAdmin ? `Admin Profile: ${viewAdmin.username}` : 'Admin Profile'} 
        size="md" 
        footer={<button className="btn btn-secondary" onClick={() => setShowViewModal(false)}>Close</button>}
      >
        {viewAdmin && (() => {
          const roleKey = (viewAdmin.role || 'admin').toLowerCase();
          const roleInfo = ROLE_DEFINITIONS[roleKey] || ROLE_DEFINITIONS.admin;

          return (
            <div>
              {/* User Summary Card */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 18 }}>
                <div><strong>Username:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{viewAdmin.username}</span></div>
                <div><strong>Full Name:</strong> {viewAdmin.full_name || '—'}</div>
                <div><strong>Email:</strong> {viewAdmin.email || '—'}</div>
                <div><strong>Phone:</strong> {viewAdmin.phone || '—'}</div>
                <div><strong>Branch Access:</strong> {getBranchBadge(viewAdmin.branch_access)}</div>
                <div><strong>Status:</strong> <span className={`badge ${viewAdmin.is_active ? 'badge-success' : 'badge-danger'}`}>{viewAdmin.is_active ? 'Active' : 'Inactive'}</span></div>
              </div>

              {/* Role & Access Tier Banner */}
              <div style={{ padding: '12px 16px', borderRadius: 8, background: roleInfo.badgeBg, border: `1px solid ${roleInfo.accentColor}40`, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 14, color: roleInfo.badgeColor }}>
                    {roleKey === 'admin' ? <MdAdminPanelSettings size={18} /> : roleKey === 'manager' ? <MdEdit size={18} /> : <MdVisibility size={18} />}
                    {roleInfo.name}
                  </div>
                  <span className={`badge ${roleInfo.badgeClass}`}>Active Scope</span>
                </div>
                <div style={{ fontSize: 12.5, color: '#334155', lineHeight: 1.5 }}>
                  {roleInfo.summary}
                </div>
              </div>

              {/* Module-by-Module Permissions for This User */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
                  Detailed Access Specifications for this User:
                </div>
                <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <table style={{ margin: 0, fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9' }}>
                        <th>Functional Module</th>
                        <th style={{ textAlign: 'center' }}>View</th>
                        <th style={{ textAlign: 'center' }}>Create</th>
                        <th style={{ textAlign: 'center' }}>Edit</th>
                        <th style={{ textAlign: 'center' }}>Delete</th>
                        <th>Specific Policy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PERMISSION_SPECIFICATIONS.map((spec, idx) => {
                        const perm = spec.permissions[roleKey] || spec.permissions.admin;
                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight: 600 }}>{spec.module}</td>
                            <td style={{ textAlign: 'center' }}>
                              {perm.view ? <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span> : <span style={{ color: '#dc2626' }}>✕</span>}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {perm.create ? <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span> : <span style={{ color: '#dc2626' }}>✕</span>}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {perm.edit ? <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span> : <span style={{ color: '#dc2626' }}>✕</span>}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {perm.delete ? <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span> : <span style={{ color: '#dc2626' }}>✕</span>}
                            </td>
                            <td style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{perm.notes}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Buttons (Full Admin Only) */}
              {currentUserIsAdmin ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <button className="btn btn-secondary" onClick={() => { setShowViewModal(false); openEdit(viewAdmin); }}>
                    <MdEdit /> Edit User
                  </button>
                  <button 
                    className="btn" 
                    onClick={() => handleToggleStatus(viewAdmin)} 
                    style={{ background: viewAdmin.is_active ? '#fef3c7' : '#dcfce7', color: viewAdmin.is_active ? '#d97706' : '#15803d' }}
                  >
                    <MdCancel /> {viewAdmin.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button className="btn btn-danger" onClick={() => { setShowViewModal(false); handleDelete(viewAdmin); }}>
                    <MdDelete /> Delete User
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 8, background: '#f8fafc', borderRadius: 6 }}>
                  <MdLock style={{ verticalAlign: 'middle', marginRight: 4 }} /> Admin modifications are restricted to Full Admins.
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* =======================================================================
          ADD / EDIT ADMIN USER MODAL WITH INTERACTIVE ROLE & PERMISSION MATRIX
      ======================================================================== */}
      <Modal 
        isOpen={showModal} 
        onClose={() => { setShowModal(false); setEditItem(null); }} 
        title={editItem ? `Edit Admin User: ${editItem.username}` : 'Add New Admin User'}
        size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving...' : (editItem ? 'Save Admin User' : 'Add Admin User')}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          {!editItem && (
            <div className="form-row">
              <div className="form-group">
                <label>Username *</label>
                <input 
                  className="input" 
                  placeholder="e.g. principal_north" 
                  value={form.username} 
                  onChange={(e) => setForm({ ...form, username: e.target.value })} 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Password *</label>
                <input 
                  className="input" 
                  type="password" 
                  placeholder="Secure password" 
                  value={form.password} 
                  onChange={(e) => setForm({ ...form, password: e.target.value })} 
                  required 
                />
              </div>
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label>Full Name</label>
              <input 
                className="input" 
                placeholder="User full name" 
                value={form.fullName} 
                onChange={(e) => setForm({ ...form, fullName: e.target.value })} 
              />
            </div>
            <div className="form-group">
              <label>Email Address</label>
              <input 
                className="input" 
                type="email" 
                placeholder="user@school.edu.in" 
                value={form.email} 
                onChange={(e) => setForm({ ...form, email: e.target.value })} 
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Phone Number</label>
              <input 
                className="input" 
                placeholder="+91-XXXXXXXXXX" 
                value={form.phone} 
                onChange={(e) => setForm({ ...form, phone: e.target.value })} 
              />
            </div>

            {/* Branch Assignment Option */}
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <MdBusiness style={{ color: 'var(--primary)' }} /> Assigned Branch Scope *
              </label>
              <select 
                className="input" 
                value={form.branchAccess} 
                onChange={(e) => setForm({ ...form, branchAccess: e.target.value })}
                required
              >
                {!isDedicatedBranchUser() && <option value="all">All Branches (Organisation Wide Access)</option>}
                {branches.map(b => (
                  <option key={b.id} value={b.id.toString()}>
                    {b.name} {b.code ? `(${b.code})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ===================================================================
              3-TIER ACCESS LEVEL SELECTOR
          ==================================================================== */}
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
              <span>
                <MdSecurity style={{ verticalAlign: 'middle', marginRight: 6, color: 'var(--primary)' }} />
                Select Access & Permission Level *
              </span>
              <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 11 }}>
                Choose tier to see full permission specifications below
              </span>
            </label>

            <div className="role-selector-cards">
              {/* Option 1: Full Access (Admin) */}
              <button
                type="button"
                className={`role-card-btn ${form.role === 'admin' ? 'selected-admin' : ''}`}
                onClick={() => setForm({ ...form, role: 'admin' })}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#7c3aed', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MdAdminPanelSettings size={18} /> Full Access (Admin)
                  </span>
                  <span className="badge badge-purple" style={{ fontSize: 10 }}>Full Control</span>
                </div>
                <div style={{ fontSize: 11.5, color: '#475569', lineHeight: 1.4 }}>
                  Unrestricted access: View, create, edit, delete all records, and manage administrators & system settings.
                </div>
              </button>

              {/* Option 2: Read & Write Access (Manager) */}
              <button
                type="button"
                className={`role-card-btn ${form.role === 'manager' ? 'selected-manager' : ''}`}
                onClick={() => setForm({ ...form, role: 'manager' })}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#2563eb', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MdEdit size={16} /> Read & Write (Manager)
                  </span>
                  <span className="badge badge-info" style={{ fontSize: 10 }}>Operational</span>
                </div>
                <div style={{ fontSize: 11.5, color: '#475569', lineHeight: 1.4 }}>
                  Standard operations: View, create, and edit records. Master record deletions and admin management restricted.
                </div>
              </button>

              {/* Option 3: Only Read Access (Viewer) */}
              <button
                type="button"
                className={`role-card-btn ${form.role === 'viewer' ? 'selected-viewer' : ''}`}
                onClick={() => setForm({ ...form, role: 'viewer' })}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#475569', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MdVisibility size={16} /> Only Read (Viewer)
                  </span>
                  <span className="badge badge-gray" style={{ fontSize: 10 }}>View Only</span>
                </div>
                <div style={{ fontSize: 11.5, color: '#475569', lineHeight: 1.4 }}>
                  Strict view-only mode: Browse data, inspect timetables & export CSV. Cannot create, edit, or delete any data.
                </div>
              </button>
            </div>
          </div>

          {/* ===================================================================
              DETAILED PERMISSION SPECIFICATION BREAKDOWN ("SPECIFY EACH AND EVERYTHING")
          ==================================================================== */}
          <div className="permission-spec-container">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: '#1e293b' }}>
                  Permission Specification Breakdown
                </div>
                <div style={{ fontSize: 11.5, color: '#64748b' }}>
                  Detailed capability matrix specifying exact rights for each module.
                </div>
              </div>

              {/* Specification View Switch Tabs */}
              <div style={{ display: 'flex', gap: 4, background: '#e2e8f0', padding: 3, borderRadius: 6 }}>
                <button
                  type="button"
                  onClick={() => setSpecTab('selected')}
                  style={{
                    border: 'none',
                    background: specTab === 'selected' ? '#ffffff' : 'transparent',
                    color: specTab === 'selected' ? '#0f172a' : '#64748b',
                    fontSize: 11.5,
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: 4,
                    cursor: 'pointer'
                  }}
                >
                  Selected Role Rights
                </button>
                <button
                  type="button"
                  onClick={() => setSpecTab('compare')}
                  style={{
                    border: 'none',
                    background: specTab === 'compare' ? '#ffffff' : 'transparent',
                    color: specTab === 'compare' ? '#0f172a' : '#64748b',
                    fontSize: 11.5,
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: 4,
                    cursor: 'pointer'
                  }}
                >
                  Compare All 3 Tiers
                </button>
              </div>
            </div>

            {/* TAB 1: Selected Role Rights */}
            {specTab === 'selected' && (
              <div>
                <div style={{ padding: '8px 12px', background: currentRoleInfo.badgeBg, borderRadius: 6, marginBottom: 10, fontSize: 12, color: currentRoleInfo.badgeColor, fontWeight: 600 }}>
                  Active Selection: {currentRoleInfo.name} — {currentRoleInfo.summary}
                </div>

                <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff' }}>
                  <table style={{ margin: 0, fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        <th style={{ width: '30%' }}>Module</th>
                        <th style={{ textAlign: 'center', width: '12%' }}>View</th>
                        <th style={{ textAlign: 'center', width: '12%' }}>Create</th>
                        <th style={{ textAlign: 'center', width: '12%' }}>Edit</th>
                        <th style={{ textAlign: 'center', width: '12%' }}>Delete</th>
                        <th style={{ width: '22%' }}>Enforcement Rule</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PERMISSION_SPECIFICATIONS.map((spec, idx) => {
                        const perm = spec.permissions[form.role] || spec.permissions.admin;
                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight: 600, color: '#1e293b' }}>
                              {spec.module}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {perm.view ? (
                                <span style={{ color: '#16a34a', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                  <MdCheck /> Allowed
                                </span>
                              ) : (
                                <span style={{ color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                  <MdClose /> Blocked
                                </span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {perm.create ? (
                                <span style={{ color: '#16a34a', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                  <MdCheck /> Allowed
                                </span>
                              ) : (
                                <span style={{ color: '#dc2626', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                  <MdClose /> Blocked
                                </span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {perm.edit ? (
                                <span style={{ color: '#16a34a', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                  <MdCheck /> Allowed
                                </span>
                              ) : (
                                <span style={{ color: '#dc2626', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                  <MdClose /> Blocked
                                </span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {perm.delete ? (
                                <span style={{ color: '#16a34a', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                  <MdCheck /> Allowed
                                </span>
                              ) : (
                                <span style={{ color: '#dc2626', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                  <MdClose /> Blocked
                                </span>
                              )}
                            </td>
                            <td style={{ fontSize: 11, color: '#64748b' }}>
                              {perm.notes}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: Compare All 3 Tiers Side-by-Side */}
            {specTab === 'compare' && (
              <div style={{ maxHeight: 250, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff' }}>
                <table style={{ margin: 0, fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ width: '25%' }}>Module Area</th>
                      <th style={{ width: '25%', background: '#faf5ff', color: '#7c3aed' }}>Full Access (Admin)</th>
                      <th style={{ width: '25%', background: '#eff6ff', color: '#2563eb' }}>Read & Write (Manager)</th>
                      <th style={{ width: '25%', background: '#f8fafc', color: '#475569' }}>Only Read (Viewer)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PERMISSION_SPECIFICATIONS.map((spec, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>
                          <div>{spec.module}</div>
                          <div style={{ fontSize: 10.5, color: '#94a3b8' }}>{spec.description}</div>
                        </td>
                        <td style={{ background: '#faf5ff' }}>
                          <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ View, Create, Edit, Delete</span>
                        </td>
                        <td style={{ background: '#eff6ff' }}>
                          {spec.permissions.manager.create ? (
                            <span style={{ color: '#2563eb', fontWeight: 600 }}>✓ View, Create, Edit (No Delete)</span>
                          ) : (
                            <span style={{ color: '#64748b' }}>View Only / Restricted</span>
                          )}
                        </td>
                        <td style={{ background: '#f8fafc' }}>
                          {spec.permissions.viewer.view ? (
                            <span style={{ color: '#475569', fontWeight: 600 }}>✓ View Only (No Write/Delete)</span>
                          ) : (
                            <span style={{ color: '#dc2626', fontWeight: 600 }}>✕ Restricted</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {editItem && (
            <div style={{ marginTop: 14 }}>
              <div className="form-group">
                <label>New Password (leave blank to keep current)</label>
                <input 
                  className="input" 
                  type="password" 
                  placeholder="Enter new password if changing..." 
                  value={form.newPassword} 
                  onChange={(e) => setForm({ ...form, newPassword: e.target.value })} 
                />
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input 
                  type="checkbox" 
                  id="adminIsActive" 
                  checked={form.isActive} 
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })} 
                  style={{ accentColor: 'var(--primary)', width: 18, height: 18 }} 
                />
                <label htmlFor="adminIsActive" style={{ marginBottom: 0, cursor: 'pointer', fontWeight: 600 }}>
                  Active User Status
                </label>
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* Confirmation Warning Card Modal */}
      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText="Cancel"
        type={confirmDialog.type}
        loading={confirmDialog.loading}
      />
    </Layout>
  );
}
