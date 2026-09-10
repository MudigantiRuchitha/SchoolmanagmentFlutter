import { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import { getStudents, createStudent, updateStudent, deleteStudent, getBranches, getClasses, bulkImportStudents } from '../api';
import { 
  MdAdd, MdEdit, MdDelete, MdSearch, MdPersonAdd, MdDownload, MdUpload,
  MdCheckCircle, MdCancel, MdVisibility, MdPeople, MdPerson, MdFilePresent 
} from 'react-icons/md';

const emptyForm = { 
  admissionNo: '', rollNo: '', firstName: '', lastName: '', fullName: '', 
  phone: '', parentName: '', parentPhone: '', gender: '', dateOfBirth: '', 
  classId: '', branchId: '', isActive: true 
};

export default function Students() {
  const [students, setStudents] = useState([]);
  const [branches, setBranches] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  
  // Student Profile & Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [formBranch, setFormBranch] = useState('');
  const [formClasses, setFormClasses] = useState([]);

  // Assigned Staff Details Modal
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [selectedStaffList, setSelectedStaffList] = useState([]);
  const [selectedStaffClassName, setSelectedStaffClassName] = useState('');

  // Bulk Import Students Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const fileInputRef = useRef(null);

  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  useEffect(() => { fetchInit(); }, []);
  
  useEffect(() => {
    if (filterBranch) {
      getClasses({ branch_id: filterBranch }).then(r => setClasses(r.data.classes || [])).catch(() => {});
    } else { setClasses([]); setFilterClass(''); }
  }, [filterBranch]);

  useEffect(() => {
    if (formBranch) {
      getClasses({ branch_id: formBranch }).then(r => setFormClasses(r.data.classes || [])).catch(() => {});
    } else { setFormClasses([]); }
  }, [formBranch]);

  const fetchInit = async () => {
    setLoading(true);
    try {
      const [s, b] = await Promise.all([getStudents(), getBranches()]);
      setStudents(s.data.students || []);
      setBranches(b.data.branches || []);
    } catch {}
    setLoading(false);
  };

  const fetchStudents = async () => {
    const params = {};
    if (filterBranch) params.branch_id = filterBranch;
    if (filterClass) params.class_id = filterClass;
    if (filterStatus) params.status = filterStatus;
    if (search) params.search = search;
    try { const r = await getStudents(params); setStudents(r.data.students || []); } catch {}
  };

  useEffect(() => { fetchStudents(); }, [filterBranch, filterClass, filterStatus]);

  const validateForm = () => {
    const errors = {};
    if (!form.firstName?.trim()) errors.firstName = 'First name is required';
    if (!form.lastName?.trim()) errors.lastName = 'Last name is required';
    if (!form.admissionNo?.trim()) errors.admissionNo = 'Admission number is required';
    if (!form.rollNo?.trim()) errors.rollNo = 'Roll number is required';
    
    if (form.phone) {
      let cleaned = form.phone.replace(/[^0-9]/g, '');
      if (cleaned.length > 10 && cleaned.startsWith('91')) cleaned = cleaned.slice(2);
      if (cleaned.length !== 10) errors.phone = 'Phone number must be exactly 10 digits';
    }

    if (form.parentPhone) {
      let cleanedP = form.parentPhone.replace(/[^0-9]/g, '');
      if (cleanedP.length > 10 && cleanedP.startsWith('91')) cleanedP = cleanedP.slice(2);
      if (cleanedP.length !== 10) errors.parentPhone = 'Parent phone must be exactly 10 digits';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!validateForm()) return;

    let cleanedPhone = form.phone ? form.phone.replace(/[^0-9]/g, '') : '';
    if (cleanedPhone.length > 10 && cleanedPhone.startsWith('91')) cleanedPhone = cleanedPhone.slice(2);

    let cleanedParentPhone = form.parentPhone ? form.parentPhone.replace(/[^0-9]/g, '') : '';
    if (cleanedParentPhone.length > 10 && cleanedParentPhone.startsWith('91')) cleanedParentPhone = cleanedParentPhone.slice(2);

    setSaving(true);
    try {
      const computedFull = `${form.firstName || ''} ${form.lastName || ''}`.trim() || form.fullName;
      const data = { 
        ...form, 
        fullName: computedFull, 
        phone: cleanedPhone || form.phone,
        parentPhone: cleanedParentPhone || form.parentPhone,
        branchId: formBranch || form.branchId 
      };

      if (editItem) { 
        await updateStudent(editItem.id, data); 
        showToast('Student profile updated successfully!'); 
      } else { 
        await createStudent(data); 
        showToast('New student enrolled successfully!'); 
      }
      setShowModal(false); 
      setEditItem(null); 
      setForm(emptyForm); 
      setFormBranch(''); 
      setFieldErrors({});
      fetchInit();
    } catch (err) { 
      const msg = err.response?.data?.message || 'Error occurred while saving student.';
      if (msg.toLowerCase().includes('admission')) {
        setFieldErrors(prev => ({ ...prev, admissionNo: msg }));
      } else if (msg.toLowerCase().includes('roll')) {
        setFieldErrors(prev => ({ ...prev, rollNo: msg }));
      } else {
        showToast(msg);
      }
    }
    setSaving(false);
  };

  const handleToggleStatus = async (s) => {
    try {
      await updateStudent(s.id, { isActive: !s.is_active });
      showToast(`Student "${s.full_name}" ${!s.is_active ? 'activated' : 'deactivated'}.`);
      fetchInit();
    } catch {
      showToast('Failed to update student status.');
    }
  };

  const handleDelete = async (s) => {
    if (!confirm(`Are you sure you want to delete student "${s.full_name}"?`)) return;
    try { await deleteStudent(s.id); showToast('Student deleted.'); fetchInit(); } catch { showToast('Failed to delete student.'); }
  };

  const openEdit = (s) => {
    setFieldErrors({});
    setEditItem(s);
    setFormBranch(s.branch_id || '');
    const fName = s.first_name || (s.full_name ? s.full_name.split(' ')[0] : '');
    const lName = s.last_name || (s.full_name ? s.full_name.split(' ').slice(1).join(' ') : '');
    
    let cleanPhone = (s.phone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.length > 10 && cleanPhone.startsWith('91')) cleanPhone = cleanPhone.slice(2);

    let cleanPPhone = (s.parent_phone || '').replace(/[^0-9]/g, '');
    if (cleanPPhone.length > 10 && cleanPPhone.startsWith('91')) cleanPPhone = cleanPPhone.slice(2);

    setForm({ 
      admissionNo: s.admission_no || '', 
      rollNo: s.roll_no || '', 
      firstName: fName,
      lastName: lName,
      fullName: s.full_name || '', 
      phone: cleanPhone || s.phone || '', 
      parentName: s.parent_name || '', 
      parentPhone: cleanPPhone || s.parent_phone || '', 
      gender: s.gender || '', 
      dateOfBirth: s.date_of_birth ? s.date_of_birth.split('T')[0] : '', 
      classId: s.class_id || '', 
      branchId: s.branch_id || '',
      isActive: s.is_active !== undefined ? s.is_active : true
    });
    setShowModal(true);
  };

  const openAdd = () => {
    setFieldErrors({});
    setEditItem(null);
    setForm(emptyForm);
    setFormBranch('');
    setShowModal(true);
  };

  const openDetail = (s) => {
    setSelectedStudent(s);
    setShowDetailModal(true);
  };

  const openStaffDetails = (s) => {
    let list = [];
    if (Array.isArray(s.assigned_staff) && s.assigned_staff.length > 0) {
      list = s.assigned_staff.filter(st => st && st.full_name);
    } else if (s.teacher_name) {
      list = [{ full_name: s.teacher_name, designation: 'Class Teacher', role_type: 'teaching' }];
    }
    setSelectedStaffList(list);
    setSelectedStaffClassName(s.class_name ? `${s.class_name} ${s.section || ''}` : 'Class');
    setShowStaffModal(true);
  };

  const exportCSV = () => {
    if (students.length === 0) return;
    const headers = ['Admission No', 'Roll No', 'First Name', 'Last Name', 'Full Name', 'Class', 'Section', 'Branch', 'Assigned Staff', 'Gender', 'Parent Name', 'Parent Phone', 'Student Phone', 'Status'];
    const rows = students.map(s => [
      s.admission_no || '', s.roll_no || '', `"${s.first_name || ''}"`, `"${s.last_name || ''}"`, `"${s.full_name}"`, `"${s.class_name || ''}"`, `"${s.section || ''}"`, `"${s.branch_name || ''}"`, `"${s.teacher_name || ''}"`, s.gender || '', `"${s.parent_name || ''}"`, s.parent_phone || '', s.phone || '', s.is_active ? 'Active' : 'Inactive'
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `students_list_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadSampleCSV = () => {
    const headers = ['Admission No', 'Roll No', 'First Name', 'Last Name', 'Class Name', 'Section', 'Branch Name', 'Gender', 'Date of Birth (YYYY-MM-DD)', 'Student Phone', 'Parent Name', 'Parent Phone'];
    const sampleRows = [
      ['ADM2024001', '101', 'Aarav', 'Patel', '10th', 'A', branches[0]?.name || 'Main Campus', 'Male', '2009-05-15', '9876543210', 'Rajesh Patel', '9876543211'],
      ['ADM2024002', '102', 'Diya', 'Sharma', '10th', 'A', branches[0]?.name || 'Main Campus', 'Female', '2009-08-20', '9876543212', 'Suresh Sharma', '9876543213']
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...sampleRows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'sample_students_import.csv');
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
      const parsed = [];
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        if (row.length < 3) continue;

        parsed.push({
          admissionNo: row[0] || '',
          rollNo: row[1] || '',
          firstName: row[2] || '',
          lastName: row[3] || '',
          fullName: `${row[2] || ''} ${row[3] || ''}`.trim(),
          className: row[4] || '',
          section: row[5] || '',
          branchName: row[6] || '',
          gender: row[7] || '',
          dateOfBirth: row[8] || '',
          phone: row[9] || '',
          parentName: row[10] || '',
          parentPhone: row[11] || ''
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
      const res = await bulkImportStudents({ students: importRows });
      showToast(res.data.message || `Successfully imported ${res.data.importedCount} students!`);
      setShowImportModal(false);
      setImportRows([]);
      setImportFileName('');
      fetchInit();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to import students.');
    }
    setImporting(false);
  };

  const filtered = students.filter(s => 
    !search || 
    s.full_name.toLowerCase().includes(search.toLowerCase()) || 
    (s.first_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.last_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.admission_no || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.roll_no || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.parent_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: students.length,
    male: students.filter(s => s.gender?.toLowerCase() === 'male').length,
    female: students.filter(s => s.gender?.toLowerCase() === 'female').length,
    active: students.filter(s => s.is_active).length,
  };

  return (
    <Layout title="Students" subtitle="Manage student enrollment, profiles, and academic records">
      {toast && <div className="alert alert-success">✅ {toast}</div>}

      {/* Top Stats Cards */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#eff6ff', color: '#3b82f6' }}>🎓</div>
          <div className="stat-info">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Students</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#f0fdf4', color: '#10b981' }}>✅</div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#10b981' }}>{stats.active}</div>
            <div className="stat-label">Active Students</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fefce8', color: '#eab308' }}>👦</div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#eab308' }}>{stats.male}</div>
            <div className="stat-label">Male Students</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fdf4ff', color: '#a855f7' }}>👧</div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: '#a855f7' }}>{stats.female}</div>
            <div className="stat-label">Female Students</div>
          </div>
        </div>
      </div>

      <div className="toolbar" style={{ flexWrap: 'nowrap', gap: 8 }}>
        <div className="toolbar-left" style={{ flexWrap: 'nowrap', gap: 6, flex: 1, minWidth: 0 }}>
          <div className="search-box" style={{ flex: '1 1 160px', minWidth: 140, maxWidth: 220, padding: '7px 10px', height: 36 }}>
            <MdSearch color="var(--text-muted)" size={18} />
            <input 
              placeholder="Search students..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              style={{ width: '100%', fontSize: 13 }}
            />
          </div>
          <select className="input" style={{ width: 120, padding: '6px 8px', fontSize: 12.5, height: 36 }} value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}>
            <option value="">All Branches</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          {classes.length > 0 && (
            <select className="input" style={{ width: 115, padding: '6px 8px', fontSize: 12.5, height: 36 }} value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
              <option value="">All Classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
            </select>
          )}
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
          <button className="btn btn-secondary btn-sm" onClick={() => setShowImportModal(true)} title="Import Students from CSV" style={{ padding: '6px 10px', fontSize: 12.5, height: 36, whiteSpace: 'nowrap' }}>
            <MdUpload size={14} /> Import Students
          </button>
          <button className="btn btn-secondary btn-sm" onClick={exportCSV} title="Export CSV" style={{ padding: '6px 10px', fontSize: 12.5, height: 36, whiteSpace: 'nowrap' }}>
            <MdDownload size={14} /> Export CSV
          </button>
          <button className="btn btn-primary" onClick={openAdd} style={{ padding: '6px 12px', fontSize: 12.5, height: 36, whiteSpace: 'nowrap' }}>
            <MdAdd size={16} /> Enroll Student
          </button>
        </div>
      </div>

      {loading ? <div className="loading-overlay"><div className="spinner" /> Loading students...</div> : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Admission No</th>
                <th>Name</th>
                <th>Roll No</th>
                <th>Class</th>
                <th>Assigned Staff</th>
                <th>Branch</th>
                <th>Parent Name</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={10}><div className="empty-state"><div className="empty-state-icon"><MdPersonAdd /></div><div className="empty-state-title">No students found</div></div></td></tr>
              ) : filtered.map(s => {
                const assignedList = Array.isArray(s.assigned_staff) ? s.assigned_staff.filter(st => st && st.full_name) : (s.teacher_name ? [s.teacher_name] : []);
                const staffCount = assignedList.length;

                return (
                  <tr key={s.id}>
                    <td><span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700 }}>{s.admission_no || '—'}</span></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.first_name ? `${s.first_name} ${s.last_name || ''}` : s.full_name}</div>
                      {s.gender && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.gender}</div>}
                    </td>
                    <td style={{ fontSize: 13 }}>{s.roll_no || '—'}</td>
                    <td style={{ fontSize: 13 }}>{s.class_name ? `${s.class_name} ${s.section || ''}` : '—'}</td>
                    <td style={{ fontSize: 13 }}>
                      {staffCount > 0 ? (
                        <button 
                          className="badge badge-purple"
                          style={{ cursor: 'pointer', border: 'none', padding: '4px 10px', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                          onClick={() => openStaffDetails(s)}
                          title="Click to view assigned teachers details"
                        >
                          <MdPeople size={13} /> {staffCount} {staffCount === 1 ? 'Teacher' : 'Teachers'}
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Unassigned</span>
                      )}
                    </td>
                    <td style={{ fontSize: 13 }}>{s.branch_name || '—'}</td>
                    <td style={{ fontSize: 13 }}>{s.parent_name || '—'}</td>
                    <td style={{ fontSize: 13 }}>{s.parent_phone || s.phone || '—'}</td>
                    <td>
                      <span className={`badge ${s.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {s.is_active ? '● Active' : '● Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-sm btn-secondary" onClick={() => openDetail(s)} title="View Profile"><MdVisibility size={14} /></button>
                        <button className="btn btn-sm btn-secondary" onClick={() => openEdit(s)} title="Edit Student"><MdEdit size={14} /></button>
                        <button 
                          className="btn btn-sm" 
                          onClick={() => handleToggleStatus(s)} 
                          title={s.is_active ? 'Deactivate' : 'Activate'}
                          style={{ background: s.is_active ? '#fef3c7' : '#dcfce7', color: s.is_active ? '#d97706' : '#15803d' }}
                        >
                          {s.is_active ? <MdCancel size={14} /> : <MdCheckCircle size={14} />}
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(s)} title="Delete Student"><MdDelete size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Add / Edit Student with Field-Level Errors */}
      <Modal 
        isOpen={showModal} 
        onClose={() => { setShowModal(false); setFieldErrors({}); }} 
        title={editItem ? 'Edit Student Profile' : 'Enroll New Student'} 
        size="lg"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); setFieldErrors({}); }}>Cancel</button>
            <button type="submit" form="student-edit-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Student'}
            </button>
          </>
        }
      >
        <form id="student-edit-form" onSubmit={handleSubmit}>
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
              {fieldErrors.firstName && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>⚠️ {fieldErrors.firstName}</div>}
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
              {fieldErrors.lastName && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>⚠️ {fieldErrors.lastName}</div>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Admission No *</label>
              <input 
                className="input" 
                placeholder="e.g. ADM2024001" 
                value={form.admissionNo} 
                onChange={(e) => { setForm({ ...form, admissionNo: e.target.value }); setFieldErrors({ ...fieldErrors, admissionNo: '' }); }} 
                style={{ fontFamily: 'monospace', borderColor: fieldErrors.admissionNo ? '#ef4444' : '' }} 
              />
              {fieldErrors.admissionNo && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>⚠️ {fieldErrors.admissionNo}</div>}
            </div>
            <div className="form-group">
              <label>Roll No *</label>
              <input 
                className="input" 
                placeholder="e.g. R001" 
                value={form.rollNo} 
                onChange={(e) => { setForm({ ...form, rollNo: e.target.value }); setFieldErrors({ ...fieldErrors, rollNo: '' }); }} 
                style={{ borderColor: fieldErrors.rollNo ? '#ef4444' : '' }}
              />
              {fieldErrors.rollNo && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>⚠️ {fieldErrors.rollNo}</div>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Branch</label>
              <select className="input" value={formBranch} onChange={(e) => { setFormBranch(e.target.value); setForm({ ...form, branchId: e.target.value, classId: '' }); }}>
                <option value="">Select Branch</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Class & Section</label>
              <select className="input" value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
                <option value="">Select Class</option>
                {formClasses.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
              </select>
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
              <label>Date of Birth</label>
              <input className="input" type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Student Phone</label>
              <input 
                className="input" 
                placeholder="10-digit mobile number" 
                value={form.phone} 
                onChange={(e) => { setForm({ ...form, phone: e.target.value }); setFieldErrors({ ...fieldErrors, phone: '' }); }} 
                style={{ borderColor: fieldErrors.phone ? '#ef4444' : '' }}
              />
              {fieldErrors.phone && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>⚠️ {fieldErrors.phone}</div>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Parent / Guardian Name</label>
              <input className="input" placeholder="Parent name" value={form.parentName} onChange={(e) => setForm({ ...form, parentName: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Parent Contact Phone</label>
              <input 
                className="input" 
                placeholder="10-digit mobile number" 
                value={form.parentPhone} 
                onChange={(e) => { setForm({ ...form, parentPhone: e.target.value }); setFieldErrors({ ...fieldErrors, parentPhone: '' }); }} 
                style={{ borderColor: fieldErrors.parentPhone ? '#ef4444' : '' }}
              />
              {fieldErrors.parentPhone && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>⚠️ {fieldErrors.parentPhone}</div>}
            </div>
          </div>

          {editItem && (
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
              <input type="checkbox" id="studentIsActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} style={{ accentColor: 'var(--primary)', width: 18, height: 18 }} />
              <label htmlFor="studentIsActive" style={{ marginBottom: 0, cursor: 'pointer', fontWeight: 600 }}>Active Student Status</label>
            </div>
          )}
        </form>
      </Modal>

      {/* Bulk Import Students Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => { setShowImportModal(false); setImportRows([]); setImportFileName(''); }}
        title="Import Students from CSV"
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
              {importing ? 'Importing...' : `Import ${importRows.length} Students`}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>1. Download Sample CSV Template</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Pre-formatted template with headers for student enrollment.</div>
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
                      <th style={{ padding: '6px 10px' }}>Adm No</th>
                      <th style={{ padding: '6px 10px' }}>Roll No</th>
                      <th style={{ padding: '6px 10px' }}>Full Name</th>
                      <th style={{ padding: '6px 10px' }}>Class</th>
                      <th style={{ padding: '6px 10px' }}>Branch</th>
                      <th style={{ padding: '6px 10px' }}>Parent Phone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '6px 10px' }}>{i + 1}</td>
                        <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontWeight: 600 }}>{r.admissionNo || '—'}</td>
                        <td style={{ padding: '6px 10px' }}>{r.rollNo || '—'}</td>
                        <td style={{ padding: '6px 10px', fontWeight: 600 }}>{r.fullName || '—'}</td>
                        <td style={{ padding: '6px 10px' }}>{r.className} {r.section}</td>
                        <td style={{ padding: '6px 10px' }}>{r.branchName || '—'}</td>
                        <td style={{ padding: '6px 10px' }}>{r.parentPhone || r.phone || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Assigned Staff Details Popup Modal */}
      <Modal
        isOpen={showStaffModal}
        onClose={() => setShowStaffModal(false)}
        title={`Assigned Teachers: ${selectedStaffClassName}`}
        footer={<button className="btn btn-secondary" onClick={() => setShowStaffModal(false)}>Close</button>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {selectedStaffList.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
              No teachers currently assigned to this class.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
              {selectedStaffList.map((st, idx) => (
                <div key={idx} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14, background: 'var(--bg)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14 }}>
                      <MdPerson size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{st.full_name}</div>
                      {st.staff_id && <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>ID: {st.staff_id}</div>}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div><strong>Designation:</strong> {st.designation || 'Class Teacher'}</div>
                    {st.role_type && <div><strong>Role:</strong> <span className="badge badge-info">{st.role_type}</span></div>}
                    {st.phone && <div><strong>Phone:</strong> 📞 {st.phone}</div>}
                    {st.email && <div><strong>Email:</strong> ✉️ {st.email}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Student Profile Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title={`Student Profile: ${selectedStudent?.full_name || ''}`}
        footer={<button className="btn btn-secondary" onClick={() => setShowDetailModal(false)}>Close</button>}
      >
        {selectedStudent && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, background: 'var(--bg)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 24, fontWeight: 700 }}>
                {selectedStudent.full_name?.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{selectedStudent.full_name}</h3>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Class: <strong>{selectedStudent.class_name} {selectedStudent.section}</strong> | Branch: <strong>{selectedStudent.branch_name}</strong>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
              <div><strong>Admission No:</strong> <span style={{ fontFamily: 'monospace' }}>{selectedStudent.admission_no || '—'}</span></div>
              <div><strong>Roll No:</strong> {selectedStudent.roll_no || '—'}</div>
              <div><strong>Gender:</strong> {selectedStudent.gender || '—'}</div>
              <div><strong>Date of Birth:</strong> {selectedStudent.date_of_birth ? selectedStudent.date_of_birth.split('T')[0] : '—'}</div>
              <div><strong>Parent Name:</strong> {selectedStudent.parent_name || '—'}</div>
              <div><strong>Parent Phone:</strong> {selectedStudent.parent_phone || '—'}</div>
              <div><strong>Student Phone:</strong> {selectedStudent.phone || '—'}</div>
              <div><strong>Status:</strong> <span className={`badge ${selectedStudent.is_active ? 'badge-success' : 'badge-danger'}`}>{selectedStudent.is_active ? 'Active' : 'Inactive'}</span></div>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  );
}
