import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import { getBranchGroups, createBranchGroup, updateBranchGroup, deleteBranchGroup, getBranches } from '../api';
import { MdAdd, MdEdit, MdDelete, MdWorkspaces } from 'react-icons/md';
import { filterBranches } from '../utils/branchScope';

const emptyForm = { name: '', branchIds: [] };

export default function BranchGroups() {
  const [groups, setGroups] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
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
      const [g, b] = await Promise.all([getBranchGroups(), getBranches()]);
      setGroups(g.data.groups);
      setBranches(filterBranches(b.data.branches || []));
    } catch {}
    setLoading(false);
  };

  const toggleBranch = (id) => {
    const ids = form.branchIds;
    setForm({ ...form, branchIds: ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id] });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editItem) { await updateBranchGroup(editItem.id, form); showToast('Updated!'); }
      else { await createBranchGroup(form); showToast('Created!'); }
      setShowModal(false); setEditItem(null); setForm(emptyForm); fetchInit();
    } catch { showToast('Error'); }
    setSaving(false);
  };

  const handleDelete = async (g) => {
    if (!confirm(`Delete group "${g.name}"?`)) return;
    try { await deleteBranchGroup(g.id); showToast('Deleted.'); fetchInit(); } catch { showToast('Failed.'); }
  };

  return (
    <Layout title="Branch Groups" subtitle="Group multiple branches together for reporting and management">
      {toast && <div className="alert alert-success">{toast}</div>}
      <div className="toolbar">
        <div>{groups.length} groups</div>
        <button className="btn btn-primary" onClick={() => { setForm(emptyForm); setEditItem(null); setShowModal(true); }}><MdAdd /> Create Group</button>
      </div>

      {loading ? <div className="loading-overlay"><div className="spinner" /></div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {groups.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: '1/-1' }}>
              <div className="empty-state-icon"><MdWorkspaces /></div>
              <div className="empty-state-title">No branch groups</div>
              <div className="empty-state-text">Create groups to combine branches for unified reporting</div>
            </div>
          ) : groups.map(g => (
            <div key={g.id} className="card">
              <div style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 40, height: 40, background: 'rgba(99,102,241,0.1)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}><MdWorkspaces /></div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{g.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{g.branches?.length || 0} branches</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => { setEditItem(g); setForm({ name: g.name, branchIds: g.branches?.map(b => b.id) || [] }); setShowModal(true); }}><MdEdit size={14} /></button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(g)}><MdDelete size={14} /></button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {g.branches?.length === 0 ? (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No branches assigned</span>
                  ) : g.branches?.map(b => (
                    <span key={b.id} className="badge badge-info">{b.name}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Edit Branch Group' : 'Create Branch Group'}
        footer={<><button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button></>}>
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label>Group Name *</label><input className="input" placeholder="e.g. North Zone, Metro Branches" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div className="form-group">
            <label>Select Branches</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, maxHeight: 200, overflowY: 'auto' }}>
              {branches.map(b => (
                <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: `1.5px solid ${form.branchIds.includes(b.id) ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: form.branchIds.includes(b.id) ? 'rgba(99,102,241,0.05)' : 'transparent', fontWeight: 500, fontSize: 14 }}>
                  <input type="checkbox" checked={form.branchIds.includes(b.id)} onChange={() => toggleBranch(b.id)} style={{ accentColor: 'var(--primary)' }} />
                  {b.name}
                  {b.code && <span style={{ marginLeft: 'auto', fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{b.code}</span>}
                </label>
              ))}
            </div>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
