import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import { getAcademicGroups, createAcademicGroup, updateAcademicGroup, deleteAcademicGroup } from '../api';
import { MdAdd, MdEdit, MdDelete, MdCategory } from 'react-icons/md';

const emptyForm = { name: '', description: '' };

export default function AcademicGroups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };
  useEffect(() => { fetch(); }, []);

  const fetch = async () => {
    setLoading(true);
    try { const r = await getAcademicGroups(); setGroups(r.data.groups); } catch {}
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editItem) { await updateAcademicGroup(editItem.id, form); showToast('Group updated!'); }
      else { await createAcademicGroup(form); showToast('Group created!'); }
      setShowModal(false); setEditItem(null); setForm(emptyForm); fetch();
    } catch { showToast('Error'); }
    setSaving(false);
  };

  const handleDelete = async (g) => {
    if (!confirm(`Delete "${g.name}"?`)) return;
    try { await deleteAcademicGroup(g.id); showToast('Deleted.'); fetch(); } catch { showToast('Failed.'); }
  };

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6'];

  return (
    <Layout title="Academic Groups" subtitle="Organize classes into academic levels (Primary, Secondary, etc.)">
      {toast && <div className="alert alert-success">{toast}</div>}
      <div className="toolbar">
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{groups.length} groups</div>
        <button className="btn btn-primary" onClick={() => { setForm(emptyForm); setEditItem(null); setShowModal(true); }}><MdAdd /> Add Group</button>
      </div>

      {loading ? <div className="loading-overlay"><div className="spinner" /></div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {groups.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: '1/-1' }}>
              <div className="empty-state-icon"><MdCategory /></div>
              <div className="empty-state-title">No academic groups</div>
              <div className="empty-state-text">Create groups to organize your classes (e.g., Primary, Secondary)</div>
            </div>
          ) : groups.map((g, i) => (
            <div key={g.id} className="card">
              <div style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 52, height: 52, borderRadius: 12, background: `${COLORS[i % COLORS.length]}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                  <MdCategory />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{g.name}</div>
                  {g.description && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{g.description}</div>}
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    <span className="badge badge-info">{g.class_count} classes</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-sm btn-secondary" onClick={() => { setEditItem(g); setForm({ name: g.name, description: g.description || '' }); setShowModal(true); }}><MdEdit size={14} /></button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(g)}><MdDelete size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Academic Group' : 'Add Academic Group'} size="sm"
        footer={<><button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button></>}>
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label>Group Name *</label><input className="input" placeholder="e.g. Primary, Secondary" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div className="form-group"><label>Description</label><textarea className="input" placeholder="e.g. Classes 1 to 5" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
        </form>
      </Modal>
    </Layout>
  );
}
