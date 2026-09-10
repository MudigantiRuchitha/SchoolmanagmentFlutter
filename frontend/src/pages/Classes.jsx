import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import { getClasses, createClass, updateClass, deleteClass, getAcademicGroups, getBranches, getStaff } from '../api';
import { MdAdd, MdEdit, MdDelete, MdSearch, MdSchool, MdCheckCircle, MdCancel, MdPerson } from 'react-icons/md';

const emptyForm = { name: '', section: '', academicGroupId: '', branchId: '', teacherId: '', isActive: true };

export default function Classes() {
  const [classes, setClasses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [branches, setBranches] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  
  // Edit / Create Class Modal
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Quick Multi-Staff Assignment Modal
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState([]);
  const [assigning, setAssigning] = useState(false);

  // View Assigned Staff Details Popup
  const [showViewStaffModal, setShowViewStaffModal] = useState(false);
  const [viewStaffClass, setViewStaffClass] = useState(null);
  const [viewStaffList, setViewStaffList] = useState([]);

  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };
  useEffect(() => { fetchInit(); }, []);

  const fetchInit = async () => {
    setLoading(true);
    try {
      const [c, g, b, s] = await Promise.all([getClasses(), getAcademicGroups(), getBranches(), getStaff()]);
      setClasses(c.data.classes || []);
      setGroups(g.data.groups || []);
      setBranches(b.data.branches || []);
      setStaff(s.data.staff || []);
    } catch {}
    setLoading(false);
  };

  const fetchClasses = async () => {
    const params = {};
    if (filterGroup) params.academic_group_id = filterGroup;
    if (filterBranch) params.branch_id = filterBranch;
    try { const r = await getClasses(params); setClasses(r.data.classes || []); } catch {}
  };

  useEffect(() => { fetchClasses(); }, [filterGroup, filterBranch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast('Class Name is required!');
      return;
    }
    setSaving(true);
    try {
      if (editItem) { await updateClass(editItem.id, form); showToast('Class updated!'); }
      else { await createClass(form); showToast('Class created!'); }
      setShowModal(false); setEditItem(null); setForm(emptyForm); fetchInit();
    } catch { showToast('Error occurred while saving class.'); }
    setSaving(false);
  };

  const openAssignStaffModal = (c) => {
    setSelectedClass(c);
    const initialIds = c.teacher_ids && Array.isArray(c.teacher_ids) ? c.teacher_ids : (c.teacher_id ? [c.teacher_id] : []);
    setSelectedTeacherIds(initialIds);
    setShowStaffModal(true);
  };

  const openViewStaffDetails = (c) => {
    const assigned = staff.filter(st => 
      (c.teacher_ids && Array.isArray(c.teacher_ids) && c.teacher_ids.includes(st.id)) || 
      c.teacher_id === st.id
    );
    setViewStaffClass(c);
    setViewStaffList(assigned);
    setShowViewStaffModal(true);
  };

  const handleSaveStaffAssignment = async () => {
    if (!selectedClass) return;
    setAssigning(true);
    try {
      await updateClass(selectedClass.id, { teacherIds: selectedTeacherIds });
      showToast(`Staff assignments updated for ${selectedClass.name}!`);
      setShowStaffModal(false);
      fetchInit();
    } catch {
      showToast('Failed to assign staff.');
    }
    setAssigning(false);
  };

  const handleToggleStatus = async (c) => {
    try {
      await updateClass(c.id, { isActive: !c.is_active });
      showToast(`Class "${c.name}" ${!c.is_active ? 'activated' : 'deactivated'}.`);
      fetchInit();
    } catch { showToast('Failed to update class status.'); }
  };

  const handleDelete = async (c) => {
    if (!confirm(`Delete class "${c.name}"?`)) return;
    try { await deleteClass(c.id); showToast('Class deleted.'); fetchInit(); } catch { showToast('Failed to delete class.'); }
  };

  const filtered = classes.filter(c => !search || `${c.name} ${c.section} ${c.teacher_name || ''}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <Layout title="Classes" subtitle="Manage classes, sections, and staff assignments">
      {toast && <div className="alert alert-success">✅ {toast}</div>}
      
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="search-box">
            <MdSearch color="var(--text-muted)" />
            <input placeholder="Search classes, sections, teachers..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input" style={{ width: 160, padding: '9px 10px', fontSize: 13 }} value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)}>
            <option value="">All Groups</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select className="input" style={{ width: 160, padding: '9px 10px', fontSize: 13 }} value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}>
            <option value="">All Branches</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Showing {filtered.length} classes</span>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(emptyForm); setEditItem(null); setShowModal(true); }}>
          <MdAdd /> Add Class
        </button>
      </div>

      {loading ? <div className="loading-overlay"><div className="spinner" /> Loading classes...</div> : (
        <div className="table-container">
          <table>
            <thead><tr><th>Class Name</th><th>Section</th><th>Academic Group</th><th>Branch</th><th>Assigned Staff</th><th>Enrolled Students</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8}><div className="empty-state"><div className="empty-state-icon"><MdSchool /></div><div className="empty-state-title">No classes found</div></div></td></tr>
              ) : filtered.map(c => (
                <tr key={c.id}>
                  <td><div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div></td>
                  <td>{c.section || '—'}</td>
                  <td><span className="badge badge-purple">{c.academic_group_name || '—'}</span></td>
                  <td style={{ fontSize: 13 }}>{c.branch_name || '—'}</td>
                  <td style={{ fontSize: 13 }}>
                    {(() => {
                      const assigned = staff.filter(st => 
                        (c.teacher_ids && Array.isArray(c.teacher_ids) && c.teacher_ids.includes(st.id)) || 
                        c.teacher_id === st.id
                      );
                      const count = assigned.length;
                      return (
                        <button 
                          className={`badge ${count > 0 ? 'badge-info' : 'badge-gray'}`}
                          style={{ cursor: 'pointer', border: 'none', padding: '6px 12px', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                          onClick={() => openViewStaffDetails(c)}
                          title="Click to view assigned staff details"
                        >
                          <MdPerson size={14} /> {count} {count === 1 ? 'Staff' : 'Staff'}
                        </button>
                      );
                    })()}
                  </td>
                  <td><span className="badge badge-info">{c.student_count || 0} students</span></td>
                  <td>
                    <span className={`badge ${c.is_active ? 'badge-success' : 'badge-danger'}`}>
                      {c.is_active ? '● Active' : '● Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button 
                        className="btn btn-sm" 
                        onClick={() => openAssignStaffModal(c)} 
                        title="Assign Staff Members to Class"
                        style={{ background: '#e0f2fe', color: '#0284c7' }}
                      >
                        <MdPerson size={14} />
                      </button>
                      <button 
                        className="btn btn-sm btn-secondary" 
                        onClick={() => { 
                          setEditItem(c); 
                          setForm({ 
                            name: c.name, 
                            section: c.section || '', 
                            academicGroupId: c.academic_group_id || '', 
                            branchId: c.branch_id || '', 
                            teacherId: c.teacher_id || '',
                            isActive: c.is_active !== undefined ? c.is_active : true 
                          }); 
                          setShowModal(true); 
                        }} 
                        title="Edit Class"
                      >
                        <MdEdit size={14} />
                      </button>
                      <button 
                        className="btn btn-sm" 
                        onClick={() => handleToggleStatus(c)} 
                        title={c.is_active ? 'Deactivate Class' : 'Activate Class'}
                        style={{ background: c.is_active ? '#fef3c7' : '#dcfce7', color: c.is_active ? '#d97706' : '#15803d' }}
                      >
                        {c.is_active ? <MdCancel size={14} /> : <MdCheckCircle size={14} />}
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(c)} title="Delete Class"><MdDelete size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit / Add Class Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Class' : 'Add New Class'}
        footer={<><button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>{saving ? 'Saving...' : 'Save Class'}</button></>}>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group"><label>Class Name *</label><input className="input" placeholder="e.g. Class 1, Grade 6" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="form-group"><label>Section / Division</label><input className="input" placeholder="e.g. A, B, Morning" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Academic Group</label>
              <select className="input" value={form.academicGroupId} onChange={(e) => setForm({ ...form, academicGroupId: e.target.value })}>
                <option value="">Select Academic Group</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Branch</label>
              <select className="input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
                <option value="">Select Branch</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Assigned Staff</label>
            <select className="input" value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })}>
              <option value="">No staff assigned</option>
              {staff.map(st => <option key={st.id} value={st.id}>{st.full_name} {st.staff_id ? `(${st.staff_id})` : ''}</option>)}
            </select>
          </div>
          {editItem && (
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="classIsActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} style={{ accentColor: 'var(--primary)', width: 18, height: 18 }} />
              <label htmlFor="classIsActive" style={{ marginBottom: 0, cursor: 'pointer', fontWeight: 600 }}>Active Class Status</label>
            </div>
          )}
        </form>
      </Modal>

      {/* View Assigned Staff Details Popup Modal */}
      <Modal
        isOpen={showViewStaffModal}
        onClose={() => setShowViewStaffModal(false)}
        title={viewStaffClass ? `Assigned Staff for ${viewStaffClass.name} ${viewStaffClass.section ? '(' + viewStaffClass.section + ')' : ''}` : 'Assigned Staff Details'}
        footer={
          <button className="btn btn-secondary" onClick={() => setShowViewStaffModal(false)}>Close</button>
        }
      >
        <div>
          {viewStaffList.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
              <MdPerson size={36} style={{ marginBottom: 8, opacity: 0.5 }} />
              <div style={{ fontWeight: 600, fontSize: 14 }}>No staff members assigned to this class.</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Use the assign button in the table to assign teachers.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 350, overflowY: 'auto' }}>
              {viewStaffList.map(st => (
                <div key={st.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', border: '1px solid #e2e8f0', borderRadius: 10, background: '#f8fafc' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>
                      {(st.first_name || st.full_name || 'S').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)' }}>
                        {st.full_name}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 8, marginTop: 2 }}>
                        <span>🆔 Staff ID: <strong>{st.staff_id || '—'}</strong></span>
                        <span>• Role: <span className="badge badge-info" style={{ padding: '2px 6px', fontSize: 10 }}>{st.role_type}</span></span>
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {st.phone && <div>📞 {st.phone}</div>}
                    {st.email && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>✉️ {st.email}</div>}
                    {st.designation && <div style={{ fontSize: 11, color: '#4f46e5', fontWeight: 600 }}>{st.designation}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Quick Multi-Staff Assignment Modal */}
      <Modal 
        isOpen={showStaffModal} 
        onClose={() => setShowStaffModal(false)} 
        title={selectedClass ? `Assign Staff Members to ${selectedClass.name} ${selectedClass.section ? '(' + selectedClass.section + ')' : ''}` : 'Assign Staff Members'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowStaffModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveStaffAssignment} disabled={assigning}>
              {assigning ? 'Saving...' : 'Save Staff Assignments'}
            </button>
          </>
        }
      >
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Select all teachers / staff members to assign to <strong>{selectedClass?.name} {selectedClass?.section ? `(${selectedClass?.section})` : ''}</strong>:
          </p>
          {staff.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No staff members found.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, maxHeight: 300, overflowY: 'auto' }}>
              {staff.map(st => {
                const isChecked = selectedTeacherIds.includes(st.id);
                return (
                  <label 
                    key={st.id} 
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, 
                      border: `1.5px solid ${isChecked ? 'var(--primary)' : '#e2e8f0'}`, 
                      background: isChecked ? '#f0fdf4' : '#fff', cursor: 'pointer', transition: 'all 0.15s ease'
                    }}
                  >
                    <input 
                      type="checkbox" 
                      checked={isChecked} 
                      onChange={(e) => {
                        if (e.target.checked) setSelectedTeacherIds([...selectedTeacherIds, st.id]);
                        else setSelectedTeacherIds(selectedTeacherIds.filter(id => id !== st.id));
                      }} 
                      style={{ accentColor: 'var(--primary)', width: 16, height: 16 }}
                    />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)' }}>
                        {st.full_name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {st.role_type} {st.staff_id ? `• ID: ${st.staff_id}` : ''}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </Modal>
    </Layout>
  );
}
