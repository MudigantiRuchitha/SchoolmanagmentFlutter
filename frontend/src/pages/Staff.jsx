import { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { filterBranches, getBranchScope, isDedicatedBranchUser } from '../utils/branchScope';
import ClassSectionSelect from '../components/ClassSectionSelect';
import { getStaff, createStaff, updateStaff, deleteStaff, getBranches, getClasses, assignStaffClasses, bulkImportStaff } from '../api';
import { 
  MdAdd, MdEdit, MdDelete, MdSearch, MdPeople, MdCheckCircle, MdCancel, 
  MdDownload, MdUpload, MdClass, MdVisibility, MdVisibilityOff, MdFilePresent,
  MdPerson,MdWarning
} from 'react-icons/md';

const ROLES = ['teaching', 'non-teaching', 'management'];
const emptyForm = {
  staffId: '', firstName: '', lastName: '', username: '', password: '',
  phone: '', email: '', roleType: 'teaching', branchId: '',
  designation: '', gender: '', dateOfJoining: '', isActive: true
};

export default function Staff() {
  const { user } = useAuth();
  const [staff, setStaff] = useState([]);
  const [branches, setBranches] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterBranch, setFilterBranch] = useState(getBranchScope);
  const [filterStatus, setFilterStatus] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Edit / Add Staff Modal
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Import Staff Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const fileInputRef = useRef(null);

  // Assign Classes Modal
  const [showClassModal, setShowClassModal] = useState(false);
  const [assigningStaff, setAssigningStaff] = useState(null);
  const [selectedClassIds, setSelectedClassIds] = useState([]);
  const [assignmentClassId, setAssignmentClassId] = useState('');
  const [assigning, setAssigning] = useState(false);

  // View Assigned Classes Details Popup Modal
  const [showViewClassesModal, setShowViewClassesModal] = useState(false);
  const [viewClassesStaff, setViewClassesStaff] = useState(null);
  const [viewClassesList, setViewClassesList] = useState([]);
  const [showStaffViewModal, setShowStaffViewModal] = useState(false);
  const [viewStaff, setViewStaff] = useState(null);

  const [toast, setToast] = useState('');

  const filterBranchScoped = (items) => {
    if (!user?.branchAccess || user.branchAccess === 'all') return items;
    return items.filter(item => String(item.branch_id) === String(user.branchAccess));
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };
  useEffect(() => { fetchInit(); }, []);

  const fetchInit = async () => {
    setLoading(true);
    try {
      const [s, b, c] = await Promise.all([getStaff(), getBranches(), getClasses()]);
      setStaff(filterBranchScoped(s.data.staff || []));
      setBranches(filterBranches(b.data.branches || []));
      setClasses(c.data.classes || []);
    } catch {}
    setLoading(false);
  };

  const fetchStaff = async () => {
    const params = {};
    if (filterRole) params.role_type = filterRole;
    if (filterBranch) params.branch_id = filterBranch;
    if (filterStatus) params.status = filterStatus;
    if (search) params.search = search;
    try { const r = await getStaff(params); setStaff(filterBranchScoped(r.data.staff || [])); } catch {}
  };

  useEffect(() => { fetchStaff(); }, [filterRole, filterBranch, filterStatus]);

  const validateForm = () => {
    const errors = {};
    if (!form.firstName.trim()) errors.firstName = 'First name is required';
    if (!form.lastName.trim()) errors.lastName = 'Last name is required';
    if (!form.staffId.trim()) errors.staffId = 'Staff ID is required';
    
    if (form.phone) {
      let cleanedPhone = form.phone.replace(/[^0-9]/g, '');
      if (cleanedPhone.length > 10 && cleanedPhone.startsWith('91')) {
        cleanedPhone = cleanedPhone.slice(2);
      }
      if (cleanedPhone.length !== 10) {
        errors.phone = 'Phone number must be exactly 10 digits';
      }
    }

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!validateForm()) {
      return;
    }

    let cleanedPhone = form.phone ? form.phone.replace(/[^0-9]/g, '') : '';
    if (cleanedPhone.length > 10 && cleanedPhone.startsWith('91')) {
      cleanedPhone = cleanedPhone.slice(2);
    }

    const payload = {
      ...form,
      phone: cleanedPhone || form.phone
    };

    setSaving(true);
    try {
      if (editItem) { 
        await updateStaff(editItem.id, payload); 
        showToast('Staff member updated successfully!'); 
      } else { 
        await createStaff(payload); 
        showToast('Staff member added successfully!'); 
      }
      setShowModal(false); 
      setEditItem(null); 
      setForm(emptyForm); 
      setFieldErrors({});
      fetchInit();
    } catch (err) { 
      const msg = err.response?.data?.message || err.message || 'Error occurred while saving staff.';
      if (msg.toLowerCase().includes('username')) {
        setFieldErrors(prev => ({ ...prev, username: msg }));
      } else if (msg.toLowerCase().includes('staff id') || msg.toLowerCase().includes('staff_id')) {
        setFieldErrors(prev => ({ ...prev, staffId: msg }));
      } else {
        showToast(msg);
      }
    }
    setSaving(false);
  };

  const handleToggleStatus = async (s) => {
    try {
      await updateStaff(s.id, { isActive: !s.is_active });
      showToast(`Staff "${s.full_name}" ${!s.is_active ? 'activated' : 'deactivated'}.`);
      fetchInit();
    } catch {
      showToast('Failed to update status.');
    }
  };

  const handleDelete = async (s) => {
    if (!confirm(`Delete staff member "${s.full_name}"?`)) return;
    try { await deleteStaff(s.id); showToast('Staff deleted.'); fetchInit(); } catch { showToast('Failed to delete.'); }
  };

  const openEdit = (s) => {
    setFieldErrors({});
    setEditItem(s);
    const firstName = s.first_name || (s.full_name ? s.full_name.split(' ')[0] : '');
    const lastName = s.last_name || (s.full_name ? s.full_name.split(' ').slice(1).join(' ') : '');
    
    let cleanPhone = (s.phone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.length > 10 && cleanPhone.startsWith('91')) {
      cleanPhone = cleanPhone.slice(2);
    }

    setForm({ 
      staffId: s.staff_id || '', 
      firstName: firstName,
      lastName: lastName,
      username: s.username || '',
      password: '',
      phone: cleanPhone || s.phone || '', 
      email: s.email || '', 
      roleType: s.role_type || 'teaching', 
      branchId: s.branch_id || '', 
      designation: s.designation || '', 
      gender: s.gender || '', 
      dateOfJoining: s.date_of_joining ? s.date_of_joining.split('T')[0] : '',
      isActive: s.is_active !== undefined ? s.is_active : true
    });
    setShowModal(true);
  };

  const openAdd = () => {
    setFieldErrors({});
    setEditItem(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openStaffView = (s) => { setViewStaff(s); setShowStaffViewModal(true); };

  // Open Multi-Class Assignment Modal for a Staff Member
  const openClassModal = (s) => {
    setAssigningStaff(s);
    const currentClassIds = classes.filter(c => (c.teacher_ids && Array.isArray(c.teacher_ids) && c.teacher_ids.includes(s.id)) || c.teacher_id === s.id).map(c => c.id);
    setSelectedClassIds(currentClassIds);
    setAssignmentClassId('');
    setShowClassModal(true);
  };

  const addAssignmentClass = () => {
    if (!assignmentClassId || selectedClassIds.includes(Number(assignmentClassId))) return;
    setSelectedClassIds(prev => [...prev, Number(assignmentClassId)]);
    setAssignmentClassId('');
  };

  const openViewClassesDetails = (s) => {
    const assigned = classes.filter(c => 
      (c.teacher_ids && Array.isArray(c.teacher_ids) && c.teacher_ids.includes(s.id)) || 
      c.teacher_id === s.id
    );
    setViewClassesStaff(s);
    setViewClassesList(assigned);
    setShowViewClassesModal(true);
  };

  const handleSaveClasses = async () => {
    if (!assigningStaff) return;
    setAssigning(true);
    try {
      await assignStaffClasses(assigningStaff.id, selectedClassIds);
      showToast(`Assigned classes updated for ${assigningStaff.full_name}!`);
      setShowClassModal(false);
      fetchInit();
    } catch {
      showToast('Failed to save class assignments.');
    }
    setAssigning(false);
  };

  const exportCSV = () => {
    try {
      if (!staff || staff.length === 0) {
        showToast('No rows to export. There are no staff records available.');
        return;
      }

      const headers = ['Staff ID', 'Username', 'First Name', 'Last Name', 'Full Name', 'Role Type', 'Designation', 'Branch', 'Assigned Classes', 'Phone', 'Email', 'Gender', 'Status'];
      const rows = staff.map(s => [
        s.staff_id || '', s.username || '', `"${s.first_name || ''}"`, `"${s.last_name || ''}"`, `"${s.full_name}"`, s.role_type, `"${s.designation || ''}"`, `"${s.branch_name || ''}"`, `"${s.assigned_classes || ''}"`, s.phone || '', s.email || '', s.gender || '', s.is_active ? 'Active' : 'Inactive'
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `staff_list_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Staff CSV exported successfully.');
    } catch (error) {
      console.error('Staff CSV export failed:', error);
      showToast('CSV export failed. Please try again.');
    }
  };

  const downloadSampleCSV = () => {
    const headers = ['Staff ID', 'First Name', 'Last Name', 'Username', 'Role Type', 'Designation', 'Branch Name', 'Phone', 'Email', 'Gender', 'Date of Joining (YYYY-MM-DD)', 'Password'];
    const sampleRows = [
      ['STF101', 'Rahul', 'Verma', 'rahul101', 'teaching', 'Mathematics Teacher', branches[0]?.name || 'Main Campus', '9876543210', 'rahul@school.edu.in', 'Male', '2024-06-01', 'Teacher@123'],
      ['STF102', 'Pooja', 'Sharma', 'pooja102', 'teaching', 'Science Teacher', branches[0]?.name || 'Main Campus', '9876543211', 'pooja@school.edu.in', 'Female', '2024-06-01', 'Teacher@123']
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...sampleRows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'sample_staff_import.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
      if (lines.length < 2) {
        showToast('CSV file is empty or missing headers.');
        return;
      }
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const parsed = [];

      for (let i = 1; i < lines.length; i++) {
        // Simple CSV splitting handling quotes
        const row = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        if (row.length < 3) continue;

        parsed.push({
          staffId: row[0] || '',
          firstName: row[1] || '',
          lastName: row[2] || '',
          fullName: `${row[1] || ''} ${row[2] || ''}`.trim(),
          username: row[3] || '',
          roleType: (row[4] || 'teaching').toLowerCase(),
          designation: row[5] || '',
          branchName: row[6] || '',
          phone: row[7] || '',
          email: row[8] || '',
          gender: row[9] || '',
          dateOfJoining: row[10] || '',
          password: row[11] || 'Teacher@123'
        });
      }
      setImportRows(parsed);
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (importRows.length === 0) {
      showToast('Please upload a valid CSV file first.');
      return;
    }
    setImporting(true);
    try {
      const res = await bulkImportStaff({ staff: importRows });
      showToast(res.data.message || `Successfully imported ${res.data.importedCount} staff members!`);
      setShowImportModal(false);
      setImportRows([]);
      setImportFileName('');
      fetchInit();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to import staff members.');
    }
    setImporting(false);
  };

  const filtered = staff.filter(s => 
    !search || 
    s.full_name.toLowerCase().includes(search.toLowerCase()) || 
    (s.first_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.last_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.username || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.staff_id || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.designation || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.phone || '').includes(search)
  );

  const roleBadge = (role) => {
    const map = { teaching: 'badge-info', 'non-teaching': 'badge-warning', management: 'badge-purple' };
    return map[role] || 'badge-gray';
  };

  const stats = {
    total: staff.length,
    teaching: staff.filter(s => s.role_type === 'teaching').length,
    nonTeaching: staff.filter(s => s.role_type === 'non-teaching').length,
    management: staff.filter(s => s.role_type === 'management').length,
    active: staff.filter(s => s.is_active).length,
  };

  return (
    <Layout title="Staff" subtitle="Manage teaching, non-teaching, and management staff">
      {toast && <div className="alert alert-success"><MdCheckCircle style={{ verticalAlign: 'middle', marginRight: 6 }} /> {toast}</div>}

      {/* Top Stats */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#eff6ff', color: '#3b82f6' }}><MdPeople /></div>
          <div className="stat-info">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Staff</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#f0fdf4', color: '#10b981' }}><MdPeople /></div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#10b981' }}>{stats.teaching}</div>
            <div className="stat-label">Teaching Staff</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fefce8', color: '#eab308' }}><MdPerson /></div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#eab308' }}>{stats.nonTeaching}</div>
            <div className="stat-label">Non-Teaching Staff</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fdf4ff', color: '#a855f7' }}><MdClass /></div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#a855f7' }}>{stats.management}</div>
            <div className="stat-label">Management Staff</div>
          </div>
        </div>
      </div>

      <div className="toolbar" style={{ flexWrap: 'nowrap', gap: 8 }}>
        <div className="toolbar-left" style={{ flexWrap: 'nowrap', gap: 6, flex: 1, minWidth: 0 }}>
          <div className="search-box" style={{ flex: '1 1 160px', minWidth: 140, maxWidth: 220, padding: '7px 10px', height: 36 }}>
            <MdSearch color="var(--text-muted)" size={18} />
            <input 
              placeholder="Search staff..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              style={{ width: '100%', fontSize: 13 }}
            />
          </div>
          <select className="input" style={{ width: 110, padding: '6px 8px', fontSize: 12.5, height: 36 }} value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
            <option value="">All Roles</option>
            {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
          </select>
          <select className="input" style={{ width: 120, padding: '6px 8px', fontSize: 12.5, height: 36 }} value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}>
            {!isDedicatedBranchUser() && <option value="">All Branches</option>}
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select className="input" style={{ width: 100, padding: '6px 8px', fontSize: 12.5, height: 36 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="toolbar-right" style={{ flexWrap: 'nowrap', gap: 6, flexShrink: 0 }}>
          <button className="btn btn-secondary btn-sm" onClick={downloadSampleCSV} title="Download Sample CSV Template" style={{ padding: '6px 10px', fontSize: 12.5, height: 36, whiteSpace: 'nowrap' }}>
            <MdDownload size={14} /> Sample CSV
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowImportModal(true)} title="Import Staff from CSV" style={{ padding: '6px 10px', fontSize: 12.5, height: 36, whiteSpace: 'nowrap' }}>
            <MdUpload size={14} /> Import Staff
          </button>
          <button className="btn btn-secondary btn-sm" onClick={exportCSV} title="Export CSV" style={{ padding: '6px 10px', fontSize: 12.5, height: 36, whiteSpace: 'nowrap' }}>
            <MdDownload size={14} /> Export CSV
          </button>
          <button className="btn btn-primary" onClick={openAdd} style={{ padding: '6px 12px', fontSize: 12.5, height: 36, whiteSpace: 'nowrap' }}>
            <MdAdd size={16} /> Add Staff
          </button>
        </div>
      </div>

      {loading ? <div className="loading-overlay"><div className="spinner" /> Loading staff...</div> : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Staff ID</th>
                <th>Name / User</th>
                <th>Role</th>
                <th>Designation</th>
                <th>Branch & Assigned Classes</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8}><div className="empty-state"><div className="empty-state-icon"><MdPeople /></div><div className="empty-state-title">No staff members found</div></div></td></tr>
              ) : filtered.map(s => (
                <tr key={s.id}>
                  <td><span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700 }}>{s.staff_id || '—'}</span></td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{s.first_name ? `${s.first_name} ${s.last_name || ''}` : s.full_name}</div>
                    {s.username && <div style={{ fontSize: 11, color: '#4f46e5', fontWeight: 600 }}>@{s.username}</div>}
                    {s.gender && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.gender}</div>}
                  </td>
                  <td><span className={`badge ${roleBadge(s.role_type)}`}>{s.role_type}</span></td>
                  <td style={{ fontSize: 13 }}>{s.designation || '—'}</td>
                  <td style={{ fontSize: 13 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{s.branch_name || '—'}</div>
                    {(() => {
                      const assigned = classes.filter(c => 
                        (c.teacher_ids && Array.isArray(c.teacher_ids) && c.teacher_ids.includes(s.id)) || 
                        c.teacher_id === s.id
                      );
                      const count = assigned.length;
                      return (
                        <button 
                          className={`badge ${count > 0 ? 'badge-purple' : 'badge-gray'}`}
                          style={{ cursor: 'pointer', border: 'none', padding: '4px 10px', fontSize: 12, fontWeight: 600, marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                          onClick={() => openViewClassesDetails(s)}
                          title="Click to view assigned classes details"
                        >
                          <MdClass size={13} /> {count} {count === 1 ? 'Class' : 'Classes'}
                        </button>
                      );
                    })()}
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {s.phone && <div><MdPerson style={{ verticalAlign: 'middle', marginRight: 4 }} /> {s.phone}</div>}
                    {s.email && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}><MdPerson style={{ verticalAlign: 'middle', marginRight: 4 }} /> {s.email}</div>}
                  </td>
                  <td>
                    <span className={`badge ${s.is_active ? 'badge-success' : 'badge-danger'}`}>
                      {s.is_active ? '● Active' : '● Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-sm btn-secondary" onClick={() => openStaffView(s)} title="View staff details and actions"><MdVisibility size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={showStaffViewModal} onClose={() => setShowStaffViewModal(false)} title={viewStaff ? `Staff: ${viewStaff.full_name}` : 'Staff Details'} size="sm" footer={<button className="btn btn-secondary" onClick={() => setShowStaffViewModal(false)}>Close</button>}>
        {viewStaff && <div>
          <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
            <div><strong>Staff ID:</strong> {viewStaff.staff_id || '—'}</div>
            <div><strong>Role:</strong> {viewStaff.role_type || '—'}</div>
            <div><strong>Designation:</strong> {viewStaff.designation || '—'}</div>
            <div><strong>Branch:</strong> {viewStaff.branch_name || '—'}</div>
            <div><strong>Status:</strong> {viewStaff.is_active ? 'Active' : 'Inactive'}</div>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            <button className="btn btn-secondary" onClick={() => { setShowStaffViewModal(false); openEdit(viewStaff); }}><MdEdit /> Edit Staff</button>
            <button className="btn btn-secondary" onClick={() => { setShowStaffViewModal(false); openClassModal(viewStaff); }}><MdClass /> Staff Allocation</button>
            <button className="btn" onClick={() => handleToggleStatus(viewStaff)} style={{ background: viewStaff.is_active ? '#fef3c7' : '#dcfce7', color: viewStaff.is_active ? '#d97706' : '#15803d' }}><MdCancel /> {viewStaff.is_active ? 'Deactivate Staff' : 'Activate Staff'}</button>
            <button className="btn btn-danger" onClick={() => { setShowStaffViewModal(false); handleDelete(viewStaff); }}><MdDelete /> Delete Staff</button>
          </div>
        </div>}
      </Modal>

      {/* Edit / Add Staff Modal with Field-Level Errors */}
      <Modal 
        isOpen={showModal} 
        onClose={() => { setShowModal(false); setFieldErrors({}); }} 
        title={editItem ? 'Edit Staff Member' : 'Add Staff Member'} 
        size="lg"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); setFieldErrors({}); }}>Cancel</button>
            <button type="submit" form="staff-edit-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Staff'}
            </button>
          </>
        }
      >
        <form id="staff-edit-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>First Name *</label>
              <input 
                className="input" 
                placeholder="First name" 
                value={form.firstName} 
                onChange={(e) => { setForm({ ...form, firstName: e.target.value }); setFieldErrors({ ...fieldErrors, firstName: '' }); }} 
                style={{ borderColor: fieldErrors.firstName ? '#ef4444' : '' }}
                required 
              />
              {fieldErrors.firstName && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}><MdWarning style={{ verticalAlign: 'middle' }} /> {fieldErrors.firstName}</div>}
            </div>
            <div className="form-group">
              <label>Last Name *</label>
              <input 
                className="input" 
                placeholder="Last name" 
                value={form.lastName} 
                onChange={(e) => { setForm({ ...form, lastName: e.target.value }); setFieldErrors({ ...fieldErrors, lastName: '' }); }} 
                style={{ borderColor: fieldErrors.lastName ? '#ef4444' : '' }}
                required 
              />
              {fieldErrors.lastName && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}><MdWarning style={{ verticalAlign: 'middle' }} /> {fieldErrors.lastName}</div>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Staff ID *</label>
              <input 
                className="input" 
                placeholder="e.g. STF001" 
                value={form.staffId} 
                onChange={(e) => { setForm({ ...form, staffId: e.target.value }); setFieldErrors({ ...fieldErrors, staffId: '' }); }} 
                style={{ fontFamily: 'monospace', borderColor: fieldErrors.staffId ? '#ef4444' : '' }} 
              />
              {fieldErrors.staffId && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}><MdWarning style={{ verticalAlign: 'middle' }} /> {fieldErrors.staffId}</div>}
            </div>
            <div className="form-group">
              <label>Username (Device Login)</label>
              <input 
                className="input" 
                placeholder="e.g. teacher123" 
                value={form.username} 
                onChange={(e) => { setForm({ ...form, username: e.target.value }); setFieldErrors({ ...fieldErrors, username: '' }); }} 
                style={{ fontFamily: 'monospace', borderColor: fieldErrors.username ? '#ef4444' : '' }} 
              />
              {fieldErrors.username && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}><MdWarning style={{ verticalAlign: 'middle' }} /> {fieldErrors.username}</div>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Password {editItem ? '(Leave blank to keep unchanged)' : '*'}</label>
              <div style={{ position: 'relative' }}>
                <input 
                  className="input" 
                  type={showPassword ? 'text' : 'password'} 
                  placeholder={editItem ? "••••••••" : "Login password"} 
                  value={form.password} 
                  onChange={(e) => setForm({ ...form, password: e.target.value })} 
                  style={{ paddingRight: '38px' }}
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
            <div className="form-group">
              <label>Role Type *</label>
              <select className="input" value={form.roleType} onChange={(e) => setForm({ ...form, roleType: e.target.value })}>
                {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Branch</label>
              <select className="input" value={form.branchId || getBranchScope()} onChange={(e) => setForm({ ...form, branchId: e.target.value })} disabled={isDedicatedBranchUser()}>
                {!isDedicatedBranchUser() && <option value="">Select Branch</option>}
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Designation</label>
              <input className="input" placeholder="e.g. Senior Teacher, Vice Principal" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Phone Number</label>
              <input 
                className="input" 
                placeholder="10-digit mobile number" 
                value={form.phone} 
                onChange={(e) => { setForm({ ...form, phone: e.target.value }); setFieldErrors({ ...fieldErrors, phone: '' }); }} 
                style={{ borderColor: fieldErrors.phone ? '#ef4444' : '' }}
              />
              {fieldErrors.phone && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}><MdWarning style={{ verticalAlign: 'middle' }} /> {fieldErrors.phone}</div>}
            </div>
            <div className="form-group">
              <label>Email Address</label>
              <input 
                className="input" 
                type="email" 
                placeholder="staff@school.edu.in" 
                value={form.email} 
                onChange={(e) => { setForm({ ...form, email: e.target.value }); setFieldErrors({ ...fieldErrors, email: '' }); }} 
                style={{ borderColor: fieldErrors.email ? '#ef4444' : '' }}
              />
              {fieldErrors.email && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}><MdWarning style={{ verticalAlign: 'middle' }} /> {fieldErrors.email}</div>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Gender</label>
              <select className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">Select Gender</option><option>Male</option><option>Female</option><option>Other</option>
              </select>
            </div>
            <div className="form-group">
              <label>Date of Joining</label>
              <input className="input" type="date" value={form.dateOfJoining} onChange={(e) => setForm({ ...form, dateOfJoining: e.target.value })} />
            </div>
          </div>

          {editItem && (
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
              <input type="checkbox" id="staffIsActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} style={{ accentColor: 'var(--primary)', width: 18, height: 18 }} />
              <label htmlFor="staffIsActive" style={{ marginBottom: 0, cursor: 'pointer', fontWeight: 600 }}>Active Staff Member</label>
            </div>
          )}
        </form>
      </Modal>

      {/* Bulk Import Staff Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => { setShowImportModal(false); setImportRows([]); setImportFileName(''); }}
        title="Import Staff Members from CSV"
        size="lg"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowImportModal(false); setImportRows([]); setImportFileName(''); }}>Cancel</button>
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={handleConfirmImport} 
              disabled={importing || importRows.length === 0}
            >
              {importing ? 'Importing...' : `Import ${importRows.length} Staff Members`}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>1. Download Sample CSV Template</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Use our pre-formatted CSV template to organize your staff records.</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={downloadSampleCSV}>
              <MdDownload /> Download Template
            </button>
          </div>

          <div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>2. Upload Filled CSV File</div>
            <input 
              type="file" 
              ref={fileInputRef} 
              accept=".csv" 
              style={{ display: 'none' }} 
              onChange={handleFileUpload} 
            />
            <div 
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed #cbd5e1', borderRadius: 8, padding: '24px 16px', textAlign: 'center',
                cursor: 'pointer', background: '#fafafa', transition: 'all 0.2s'
              }}
            >
              <MdFilePresent size={32} color="#64748b" style={{ margin: '0 auto 8px auto', display: 'block' }} />
              <div style={{ fontWeight: 600, fontSize: 14 }}>{importFileName ? `Selected: ${importFileName}` : 'Click to select .CSV file from your computer'}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Only CSV format is supported</div>
            </div>
          </div>

          {importRows.length > 0 && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span>3. Preview Records ({importRows.length} ready)</span>
              </div>
              <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                <table style={{ fontSize: 12, width: '100%' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9' }}>
                      <th style={{ padding: '6px 10px' }}>#</th>
                      <th style={{ padding: '6px 10px' }}>Staff ID</th>
                      <th style={{ padding: '6px 10px' }}>Full Name</th>
                      <th style={{ padding: '6px 10px' }}>Role</th>
                      <th style={{ padding: '6px 10px' }}>Phone</th>
                      <th style={{ padding: '6px 10px' }}>Branch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '6px 10px' }}>{i + 1}</td>
                        <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontWeight: 600 }}>{r.staffId || '—'}</td>
                        <td style={{ padding: '6px 10px', fontWeight: 600 }}>{r.fullName || '—'}</td>
                        <td style={{ padding: '6px 10px' }}>{r.roleType}</td>
                        <td style={{ padding: '6px 10px' }}>{r.phone || '—'}</td>
                        <td style={{ padding: '6px 10px' }}>{r.branchName || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Assign Classes Modal */}
      <Modal
        isOpen={showClassModal}
        onClose={() => setShowClassModal(false)}
        title={assigningStaff ? `Assign Classes to ${assigningStaff.full_name}` : 'Assign Classes'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowClassModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveClasses} disabled={assigning}>
              {assigning ? 'Saving...' : 'Save Class Assignments'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
            Select the classes and sections that this staff member is authorized to teach and mark attendance for:
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <ClassSectionSelect
              classes={classes}
              value={assignmentClassId}
              onChange={setAssignmentClassId}
              classStyle={{ flex: 1 }}
              sectionStyle={{ flex: 1 }}
              style={{ flex: 1 }}
            />
            <button type="button" className="btn btn-secondary" onClick={addAssignmentClass} disabled={!assignmentClassId}>
              Add
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, maxHeight: 320, overflowY: 'auto', padding: '4px 0' }}>
            {classes.map(c => {
              const isChecked = selectedClassIds.map(Number).includes(Number(c.id));
              return (
                <label 
                  key={c.id} 
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                    borderRadius: 8, border: `1px solid ${isChecked ? 'var(--primary)' : 'var(--border)'}`,
                    background: isChecked ? 'rgba(2,132,199,0.06)' : 'var(--card-bg)',
                    cursor: 'pointer', transition: 'all 0.15s'
                  }}
                >
                  <input 
                    type="checkbox" 
                    checked={isChecked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedClassIds(prev => prev.map(Number).includes(Number(c.id)) ? prev : [...prev, c.id]);
                      } else {
                        setSelectedClassIds(prev => prev.filter(id => Number(id) !== Number(c.id)));
                      }
                    }}
                    style={{ accentColor: 'var(--primary)', width: 16, height: 16 }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name} {c.section}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.subject || 'All Subjects'}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      </Modal>

      {/* View Assigned Classes Details Popup Modal */}
      <Modal
        isOpen={showViewClassesModal}
        onClose={() => setShowViewClassesModal(false)}
        title={viewClassesStaff ? `Assigned Classes for ${viewClassesStaff.full_name}` : 'Assigned Classes Details'}
        footer={
          <button className="btn btn-secondary" onClick={() => setShowViewClassesModal(false)}>Close</button>
        }
      >
        <div>
          {viewClassesList.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
              No classes currently assigned to this staff member.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
                <strong>{viewClassesStaff?.full_name}</strong> is assigned to the following <strong>{viewClassesList.length}</strong> class(es):
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {viewClassesList.map(c => (
                  <div key={c.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, background: 'var(--bg)' }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--primary)' }}>
                      {c.name} {c.section && `(${c.section})`}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      Subject: <strong>{c.subject || 'General'}</strong>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      Students: <strong>{c.student_count || 0} enrolled</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </Layout>
  );
}
