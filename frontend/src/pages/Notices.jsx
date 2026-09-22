import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import { getNotices, createNotice, updateNotice, deleteNotice } from '../api';
import { MdAdd, MdEdit, MdDelete, MdAnnouncement, MdSearch } from 'react-icons/md';
import { format } from 'date-fns';

const AUDIENCE_COLORS = { all: 'badge-purple', staff: 'badge-info', students: 'badge-success' };
const emptyForm = { title: '', audience: 'all', content: '' };

export default function Notices() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [filterAudience, setFilterAudience] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };
  useEffect(() => { fetchNotices(); }, [filterAudience]);

  const fetchNotices = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterAudience) params.audience = filterAudience;
      const r = await getNotices(params);
      setNotices(r.data.notices);
    } catch {}
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editItem) {
        await updateNotice(editItem.id, form);
        showToast('Notice updated successfully!');
      } else {
        await createNotice(form);
        showToast('Notice posted successfully!');
      }
      setShowModal(false);
      setEditItem(null);
      setForm(emptyForm);
      fetchNotices();
    } catch { showToast('Failed to save notice.'); }
    setSaving(false);
  };

  const handleDelete = async (n) => {
    if (!confirm(`Remove notice "${n.title}"?`)) return;
    try { await deleteNotice(n.id); showToast('Notice removed.'); fetchNotices(); } catch { showToast('Failed to delete notice.'); }
  };

  const openEdit = (n) => {
    setEditItem(n);
    setForm({
      title: n.title,
      audience: n.audience || 'all',
      content: n.content || ''
    });
    setShowModal(true);
  };

  const filtered = notices.filter(n =>
    !search ||
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    (n.content || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout title="Notices" subtitle="Post and manage announcements for staff and students">
      {toast && <div className="alert alert-success"><MdAnnouncement style={{ verticalAlign: 'middle', marginRight: 6 }} /> {toast}</div>}

      <div className="toolbar">
        <div className="toolbar-left">
          <div className="search-box">
            <MdSearch color="var(--text-muted)" />
            <input 
              placeholder="Search announcements..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
            />
          </div>
          <div className="tabs" style={{ marginBottom: 0 }}>
            {['all', 'staff', 'students'].map(a => (
              <button key={a} className={`tab-btn ${filterAudience === (a === 'all' ? '' : a) ? 'active' : ''}`} onClick={() => setFilterAudience(a === 'all' ? '' : a)}>
                {a === 'all' ? 'All' : a.charAt(0).toUpperCase() + a.slice(1)}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{filtered.length} notices</span>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm(emptyForm); setEditItem(null); setShowModal(true); }}>
          <MdAdd /> Post Notice
        </button>
      </div>

      {loading ? <div className="loading-overlay"><div className="spinner" /> Loading notices...</div> : (
        filtered.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 40 }}>
            <div className="empty-state-icon"><MdAnnouncement /></div>
            <div className="empty-state-title">No notices found</div>
            <div className="empty-state-text">Post an announcement for your staff and students</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {filtered.map(n => (
              <div key={n.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderLeft: '4px solid var(--primary)', borderRadius: 'var(--radius)', padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{n.title}</div>
                      <span className={`badge ${AUDIENCE_COLORS[n.audience] || 'badge-gray'}`}>
                        {n.audience === 'all' ? 'All' : n.audience === 'staff' ? 'Staff' : 'Students'}
                      </span>
                    </div>
                    {n.content && (
                      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 10, whiteSpace: 'pre-wrap' }}>{n.content}</p>
                    )}
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 16 }}>
                      <span>Posted: {format(new Date(n.created_at), 'dd MMM yyyy, h:mm a')}</span>
                      {n.created_by_name && <span>By: {n.created_by_name}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => openEdit(n)} title="Edit Notice"><MdEdit size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Modal Add / Edit */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditItem(null); }} title={editItem ? 'Edit Notice' : 'Post New Notice'}
        footer={<><button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>{saving ? 'Posting...' : 'Save Notice'}</button></>}>
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label>Notice Title *</label><input className="input" placeholder="e.g. Annual Sports Day Announcement" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
          <div className="form-group"><label>Audience</label>
            <select className="input" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
              <option value="all">All (Staff + Students)</option>
              <option value="staff">Staff Only</option>
              <option value="students">Students Only</option>
            </select>
          </div>
          <div className="form-group"><label>Notice Message / Content</label><textarea className="input" placeholder="Notice content details..." value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={5} /></div>
        </form>
      </Modal>
    </Layout>
  );
}
