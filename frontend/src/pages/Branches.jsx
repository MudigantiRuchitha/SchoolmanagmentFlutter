import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import ExportCSVModal from '../components/ExportCSVModal';
import { useAuth } from '../context/AuthContext';
import { getBranches, createBranch, updateBranch, deleteBranch, getBranchDetails } from '../api';
import { 
  MdAdd, MdEdit, MdDelete, MdBusiness, MdSearch, MdPhone, MdEmail, 
  MdPerson, MdCheckCircle, MdCancel, MdVisibility, MdDownload, MdFilterList, 
  MdLocationOn, MdGpsFixed, MdAdminPanelSettings, MdLock, MdSchool, MdPeople
} from 'react-icons/md';
import { downloadCSV, filterRecordsByDateRange, generateExportFilename } from '../utils/csvExport';

const emptyForm = { 
  name: '', code: '', contactPerson: '', phone: '', email: '', address: '', 
  latitude: '', longitude: '', geofenceRadius: 100, isActive: true,
  createBranchAdmin: false, adminUsername: '', adminPassword: '', adminFullName: '', adminEmail: ''
};

export default function Branches() {
  const { user, isFullAdmin } = useAuth();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedDetails, setSelectedDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [toast, setToast] = useState('');
  const [formError, setFormError] = useState('');

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
        } catch (err) {
          setConfirmDialog(prev => ({ ...prev, loading: false }));
        }
      },
      loading: false
    });
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };
  const isDedicatedBranchUser = Boolean(user?.branchAccess && user.branchAccess !== 'all');
  const filterBranchScoped = (items) => {
    if (!isDedicatedBranchUser) return items;
    return items.filter(branch => String(branch.id) === String(user.branchAccess));
  };

  useEffect(() => { fetchBranches(); }, [filterStatus]);

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (search) params.search = search;
      const r = await getBranches(params);
      setBranches(filterBranchScoped(r.data.branches || []));
    } catch {}
    setLoading(false);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchBranches();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const requiredFields = [
      ['Branch Name', form.name],
      ['Branch Code', form.code],
      ['Contact Person', form.contactPerson],
      ['Phone Number', form.phone],
      ['Email Address', form.email],
    ];
    const missingField = requiredFields.find(([, value]) => !String(value || '').trim());
    if (missingField) {
      setFormError(`${missingField[0]} is required.`);
      return;
    }
    if (!/^\d+$/.test(form.phone)) {
      setFormError('Phone Number must contain numbers only.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      setFormError('Enter a valid Email Address.');
      return;
    }
    if (!editItem && form.createBranchAdmin && (!form.adminUsername.trim() || !form.adminPassword.trim() || !form.adminFullName.trim() || !form.adminEmail.trim())) {
      setFormError('Admin Username, Password, Full Name and Email are required when creating a branch admin.');
      return;
    }
    if (!editItem && form.createBranchAdmin && !/^\S+@\S+\.\S+$/.test(form.adminEmail)) {
      setFormError('Enter a valid Admin Email.');
      return;
    }
    setFormError('');
    
    const executeSave = async () => {
      setSaving(true);
      try {
        if (editItem) { 
          await updateBranch(editItem.id, form); 
          showToast('Branch details updated successfully!'); 
        } else { 
          const res = await createBranch(form); 
          if (res.data.admin) {
            showToast(`Branch & Branch Admin "${res.data.admin.username}" created successfully!`);
          } else {
            showToast('New branch created successfully!');
          }
        }
        setShowModal(false); 
        setEditItem(null); 
        setForm(emptyForm); 
        fetchBranches();
      } catch (err) {
        setFormError(err.response?.data?.message || 'Error occurred while saving branch.');
      }
      setSaving(false);
    };

    if (!editItem) {
      requestConfirm({
        title: 'Are you sure?',
        message: `Are you sure you want to add new branch "${form.name}"?`,
        confirmText: 'Yes, Add Branch',
        type: 'primary',
        onConfirm: async () => {
          await executeSave();
        }
      });
      return;
    }

    await executeSave();
  };

  const handleToggleStatus = (b) => {
    const nextStatus = !b.is_active;
    requestConfirm({
      title: 'Are you sure?',
      message: `Are you sure you want to ${nextStatus ? 'activate' : 'deactivate'} branch "${b.name}"?`,
      confirmText: nextStatus ? 'Yes, Activate' : 'Yes, Deactivate',
      type: nextStatus ? 'success' : 'warning',
      onConfirm: async () => {
        try {
          await updateBranch(b.id, { isActive: nextStatus });
          showToast(`Branch "${b.name}" ${nextStatus ? 'activated' : 'deactivated'}.`);
          fetchBranches();
        } catch {
          showToast('Failed to update branch status.');
        }
      }
    });
  };

  const handleDelete = (b) => {
    requestConfirm({
      title: 'Are you sure?',
      message: `Are you sure you want to delete branch "${b.name}"? This action cannot be undone.`,
      confirmText: 'Yes, Delete',
      type: 'danger',
      onConfirm: async () => {
        try { 
          await deleteBranch(b.id); 
          showToast('Branch deleted successfully.'); 
          fetchBranches(); 
        } catch { 
          showToast('Failed to delete branch.'); 
        }
      }
    });
  };

  const openEdit = (b) => {
    setEditItem(b);
    setFormError('');
    setForm({
      name: b.name,
      code: b.code || '',
      contactPerson: b.contact_person || '',
      phone: b.phone || '',
      email: b.email || '',
      address: b.address || '',
      latitude: b.latitude || '',
      longitude: b.longitude || '',
      geofenceRadius: b.geofence_radius || 100,
      isActive: b.is_active !== undefined ? b.is_active : true,
      createBranchAdmin: false,
      adminUsername: '',
      adminPassword: '',
      adminFullName: '',
      adminEmail: ''
    });
    setShowModal(true);
  };

  const openDetails = async (b) => {
    setShowDetailsModal(true);
    setLoadingDetails(true);
    try {
      const res = await getBranchDetails(b.id);
      setSelectedDetails(res.data);
    } catch {
      showToast('Failed to load branch details.');
      setShowDetailsModal(false);
    }
    setLoadingDetails(false);
  };

  const handleExecuteExport = ({ fromDate, fromTime, toDate, toTime, preset }) => {
    try {
      if (!branches || branches.length === 0) {
        return { error: 'No branch records available to export.' };
      }

      const isDateFiltered = preset !== 'all' && (Boolean(fromDate) || Boolean(toDate));
      const targetBranches = isDateFiltered
        ? filterRecordsByDateRange(branches, { fromDate, fromTime, toDate, toTime })
        : branches;

      if (targetBranches.length === 0) {
        return { error: 'No branches found within the selected date & time range.' };
      }

      const headers = ['ID', 'Branch Name', 'Code', 'Contact Person', 'Phone', 'Email', 'Address', 'Latitude', 'Longitude', 'Geofence Radius (m)', 'Students', 'Staff', 'Status'];
      const rows = targetBranches.map(b => [
        b.id,
        b.name || '',
        b.code || '',
        b.contact_person || '',
        b.phone || '',
        b.email || '',
        b.address || '',
        b.latitude || '',
        b.longitude || '',
        b.geofence_radius || 100,
        b.student_count || 0,
        b.staff_count || 0,
        b.is_active ? 'Active' : 'Inactive'
      ]);

      const filename = generateExportFilename('branches_list', { fromDate, toDate, preset });
      downloadCSV(filename, headers, rows);

      setShowExportModal(false);
      showToast(`Branch CSV exported successfully (${targetBranches.length} rows).`);
      return { success: true };
    } catch (error) {
      console.error('Branch CSV export failed:', error);
      return { error: 'CSV export failed. Please try again.' };
    }
  };

  const filtered = branches.filter(b =>
    !search ||
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    (b.code || '').toLowerCase().includes(search.toLowerCase()) ||
    (b.contact_person || '').toLowerCase().includes(search.toLowerCase()) ||
    (b.phone || '').includes(search)
  );

  const stats = {
    total: branches.length,
    active: branches.filter(b => b.is_active).length,
    inactive: branches.filter(b => !b.is_active).length,
    totalStudents: branches.reduce((acc, b) => acc + parseInt(b.student_count || 0), 0),
    totalStaff: branches.reduce((acc, b) => acc + parseInt(b.staff_count || 0), 0),
  };

  return (
    <Layout title="Branches" subtitle="Manage campus locations, geofencing GPS coordinates, and branch administrators">
      {toast && <div className="alert alert-success alert-toast"><MdCheckCircle style={{ verticalAlign: 'middle', marginRight: 6 }} /> {toast}</div>}

      {/* Top Stats Cards */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#eff6ff', color: '#3b82f6' }}><MdBusiness /></div>
          <div className="stat-info">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Branches</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#f0fdf4', color: '#10b981' }}><MdCheckCircle /></div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#10b981' }}>{stats.active}</div>
            <div className="stat-label">Active Branches</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fef2f2', color: '#ef4444' }}><MdCancel /></div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#ef4444' }}>{stats.inactive}</div>
            <div className="stat-label">Inactive Branches</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fdf4ff', color: '#a855f7' }}><MdSchool /></div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#a855f7' }}>{stats.totalStudents}</div>
            <div className="stat-label">Total Students</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fff7ed', color: '#f97316' }}><MdPeople /></div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#f97316' }}>{stats.totalStaff}</div>
            <div className="stat-label">Total Staff</div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <form onSubmit={handleSearchSubmit} className="search-box">
            <MdSearch color="var(--text-muted)" />
            <input 
              placeholder="Search by name, code, contact..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
            />
          </form>
          
          <select 
            className="input" 
            style={{ width: 150, padding: '9px 10px', fontSize: 13 }} 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
          
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Showing {filtered.length} branches
          </span>
        </div>

        <div className="toolbar-right">
          <button className="btn btn-secondary btn-sm" onClick={() => setShowExportModal(true)} title="Export CSV with Custom Time Range">
            <MdDownload /> Export CSV
          </button>
          {!isDedicatedBranchUser && isFullAdmin && (
            <button className="btn btn-primary" onClick={() => { setForm(emptyForm); setFormError(''); setEditItem(null); setShowModal(true); }}>
              <MdAdd /> Add Branch
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-overlay"><div className="spinner" /> Loading branches...</div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Branch Name</th>
                <th>Code</th>
                <th>Contact Person</th>
                <th>Phone / Email</th>
                <th>Geofence GPS</th>
                <th>Classes</th>
                <th>Students</th>
                <th>Staff</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10}>
                    <div className="empty-state">
                      <div className="empty-state-icon"><MdBusiness /></div>
                      <div className="empty-state-title">No branches found</div>
                      <div className="empty-state-text">Create your first organisation branch to manage classes and attendance</div>
                    </div>
                  </td>
                </tr>
              ) : filtered.map((b) => (
                <tr key={b.id}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{b.name}</div>
                    {b.address && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}><MdLocationOn style={{ verticalAlign: 'middle', marginRight: 4 }} /> {b.address.slice(0, 35)}{b.address.length > 35 ? '...' : ''}</div>}
                  </td>
                  <td>
                    <span style={{ fontFamily: 'monospace', background: 'var(--bg)', padding: '3px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700 }}>
                      {b.code || '—'}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{b.contact_person || '—'}</div>
                  </td>
                  <td>
                    {b.phone && <div style={{ fontSize: 12, color: 'var(--text-primary)' }}><MdPhone style={{ verticalAlign: 'middle', marginRight: 4 }} /> {b.phone}</div>}
                    {b.email && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}><MdEmail style={{ verticalAlign: 'middle', marginRight: 4 }} /> {b.email}</div>}
                    {!b.phone && !b.email && <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td>
                    {b.latitude && b.longitude ? (
                      <div style={{ fontSize: 12 }}>
                        <div><MdLocationOn style={{ color: 'var(--danger)', verticalAlign: 'middle' }} /> {parseFloat(b.latitude).toFixed(4)}, {parseFloat(b.longitude).toFixed(4)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Radius: <strong>{b.geofence_radius || 100}m</strong></div>
                      </div>
                    ) : (
                      <span className="badge badge-gray" style={{ fontSize: 11 }}>Not set</span>
                    )}
                  </td>
                  <td><span className="badge badge-purple">{b.class_count || 0} classes</span></td>
                  <td><span className="badge badge-info">{b.student_count || 0}</span></td>
                  <td><span className="badge badge-success">{b.staff_count || 0}</span></td>
                  <td>
                    <span className={`badge ${b.is_active ? 'badge-success' : 'badge-danger'}`}>
                      {b.is_active ? '● Active' : '● Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-sm btn-secondary" onClick={() => openDetails(b)} title="View branch details">
                        <MdVisibility size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Branch Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setFormError(''); setEditItem(null); }}
        title={editItem ? `Edit Branch: ${editItem.name}` : 'Add New Branch'}
        size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving...' : editItem ? 'Save Changes' : 'Create Branch'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          {formError && <div className="alert alert-danger" style={{ marginBottom: 16, color: '#b91c1c' }}>{formError}</div>}
          {/* Basic Info */}
          <div className="form-row">
            <div className="form-group">
              <label>Branch Name *</label>
              <input className="input" placeholder="e.g. Main Campus, North Branch" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Branch Code *</label>
              <input className="input" placeholder="e.g. MAIN, NORTH" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} style={{ fontFamily: 'monospace' }} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Contact Person *</label>
              <input className="input" placeholder="Contact person name" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Phone Number *</label>
              <input className="input" type="tel" inputMode="numeric" pattern="[0-9]+" placeholder="9876543210" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })} required />
            </div>
          </div>

          <div className="form-group">
            <label>Email Address *</label>
            <input className="input" type="email" placeholder="branch@school.edu.in" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>

          <div className="form-group">
            <label>Address</label>
            <textarea className="input" placeholder="Full branch address..." value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} />
          </div>

          {/* GPS Geofence Settings */}
          <div style={{ padding: 16, background: 'var(--bg)', borderRadius: 'var(--radius-sm)', marginBottom: 20, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <MdGpsFixed style={{ color: 'var(--primary)' }} /> GPS Geofence Configuration <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(Optional for GPS mobile attendance)</span>
            </div>
            <div className="form-row-3">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Latitude</label>
                <input className="input" placeholder="e.g. 17.385044" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Longitude</label>
                <input className="input" placeholder="e.g. 78.486671" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Geofence Radius (meters)</label>
                <input className="input" type="number" placeholder="100" value={form.geofenceRadius} onChange={(e) => setForm({ ...form, geofenceRadius: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Branch Admin Creation Option (only when creating new branch) */}
          {!editItem && (
            <div style={{ padding: 16, background: 'rgba(99,102,241,0.05)', borderRadius: 'var(--radius-sm)', marginBottom: 20, border: '1px solid rgba(99,102,241,0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: form.createBranchAdmin ? 16 : 0 }}>
                <input 
                  type="checkbox" 
                  id="createAdminCheck" 
                  checked={form.createBranchAdmin} 
                  onChange={(e) => setForm({ ...form, createBranchAdmin: e.target.checked })} 
                  style={{ accentColor: 'var(--primary)', width: 18, height: 18, cursor: 'pointer' }}
                />
                <label htmlFor="createAdminCheck" style={{ marginBottom: 0, cursor: 'pointer', fontWeight: 700, fontSize: 14, color: 'var(--primary)' }}>
                  <MdAdminPanelSettings style={{ verticalAlign: 'middle', marginRight: 4 }} /> Create a Dedicated Branch Admin User for this Branch
                </label>
              </div>

              {form.createBranchAdmin && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="form-row">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Admin Username *</label>
                      <input className="input" placeholder="e.g. admin_north" value={form.adminUsername} onChange={(e) => setForm({ ...form, adminUsername: e.target.value })} required={form.createBranchAdmin} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Admin Password *</label>
                      <input className="input" type="password" placeholder="Secure password" value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} required={form.createBranchAdmin} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Admin Full Name *</label>
                      <input className="input" placeholder="Admin full name" value={form.adminFullName} onChange={(e) => setForm({ ...form, adminFullName: e.target.value })} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Admin Email *</label>
                      <input className="input" type="email" placeholder="admin@branch.com" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} required={form.createBranchAdmin} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {editItem && (
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input 
                type="checkbox" 
                id="isActiveCheck" 
                checked={form.isActive} 
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })} 
                style={{ accentColor: 'var(--primary)', width: 18, height: 18 }}
              />
              <label htmlFor="isActiveCheck" style={{ marginBottom: 0, cursor: 'pointer', fontWeight: 600 }}>Active Branch Status</label>
            </div>
          )}
        </form>
      </Modal>

      {/* View Branch Details Modal */}
      <Modal
        isOpen={showDetailsModal}
        onClose={() => { setShowDetailsModal(false); setSelectedDetails(null); }}
        title={`Branch Details: ${selectedDetails?.branch?.name || ''}`}
        size="lg"
        footer={<button className="btn btn-secondary" onClick={() => setShowDetailsModal(false)}>Close</button>}
      >
        {loadingDetails ? (
          <div className="loading-overlay" style={{ minHeight: 200 }}><div className="spinner" /> Loading details...</div>
        ) : selectedDetails ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Info Box */}
            <div style={{ background: 'var(--bg)', padding: 16, borderRadius: 'var(--radius-sm)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><strong>Branch Code:</strong> <span style={{ fontFamily: 'monospace' }}>{selectedDetails.branch.code || '—'}</span></div>
              <div><strong>Contact Person:</strong> {selectedDetails.branch.contact_person || '—'}</div>
              <div><strong>Phone:</strong> {selectedDetails.branch.phone || '—'}</div>
              <div><strong>Email:</strong> {selectedDetails.branch.email || '—'}</div>
              <div><strong>Geofence GPS:</strong> {selectedDetails.branch.latitude ? `${selectedDetails.branch.latitude}, ${selectedDetails.branch.longitude} (Radius: ${selectedDetails.branch.geofence_radius || 100}m)` : 'Not set'}</div>
              <div><strong>Status:</strong> <span className={`badge ${selectedDetails.branch.is_active ? 'badge-success' : 'badge-danger'}`}>{selectedDetails.branch.is_active ? 'Active' : 'Inactive'}</span></div>
              <div style={{ gridColumn: '1 / -1' }}><strong>Address:</strong> {selectedDetails.branch.address || '—'}</div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={() => { setShowDetailsModal(false); openEdit(selectedDetails.branch); }}><MdEdit /> Edit Branch</button>
              <button className="btn" onClick={() => handleToggleStatus(selectedDetails.branch)} style={{ background: selectedDetails.branch.is_active ? '#fef3c7' : '#dcfce7', color: selectedDetails.branch.is_active ? '#d97706' : '#15803d' }}><MdCancel /> {selectedDetails.branch.is_active ? 'Deactivate Branch' : 'Activate Branch'}</button>
              <button className="btn btn-danger" onClick={() => { setShowDetailsModal(false); handleDelete(selectedDetails.branch); }}><MdDelete /> Delete Branch</button>
            </div>

            {/* Quick summary badges */}
            <div style={{ display: 'flex', gap: 12 }}>
              <span className="badge badge-purple" style={{ padding: '6px 12px', fontSize: 13 }}><MdSchool style={{ verticalAlign: 'middle', marginRight: 4 }} /> {selectedDetails.classes?.length || 0} Classes</span>
              <span className="badge badge-success" style={{ padding: '6px 12px', fontSize: 13 }}><MdPeople style={{ verticalAlign: 'middle', marginRight: 4 }} /> {selectedDetails.staff?.length || 0} Staff Members</span>
              <span className="badge badge-info" style={{ padding: '6px 12px', fontSize: 13 }}><MdSchool style={{ verticalAlign: 'middle', marginRight: 4 }} /> {selectedDetails.students?.length || 0} Sample Students</span>
              <span className="badge badge-warning" style={{ padding: '6px 12px', fontSize: 13 }}><MdAdminPanelSettings style={{ verticalAlign: 'middle', marginRight: 4 }} /> {selectedDetails.admins?.length || 0} Branch Admins</span>
            </div>

            {/* Branch Admins */}
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>Branch Administrators ({selectedDetails.admins?.length || 0})</h4>
              {selectedDetails.admins?.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No administrators specifically assigned to this branch.</div>
              ) : (
                <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                  <table>
                    <thead><tr><th>Username</th><th>Full Name</th><th>Email</th><th>Role</th></tr></thead>
                    <tbody>
                      {selectedDetails.admins?.map(a => (
                        <tr key={a.id}>
                          <td style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600 }}>{a.username}</td>
                          <td style={{ fontSize: 13 }}>{a.full_name || '—'}</td>
                          <td style={{ fontSize: 13 }}>{a.email || '—'}</td>
                          <td><span className="badge badge-purple" style={{ fontSize: 10 }}>{a.role}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Assigned Classes */}
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>Classes in this Branch</h4>
              {selectedDetails.classes?.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No classes created for this branch yet.</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {selectedDetails.classes?.map(c => (
                    <div key={c.id} style={{ padding: '6px 12px', background: '#fff', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>
                      {c.name} {c.section} <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>({c.academic_group_name || 'General'})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Export CSV Modal */}
      <ExportCSVModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Branches"
        isAttendance={false}
        records={branches}
        onExport={handleExecuteExport}
      />

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
