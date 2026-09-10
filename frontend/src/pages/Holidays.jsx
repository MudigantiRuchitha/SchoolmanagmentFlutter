import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import { getHolidays, createHoliday, updateHoliday, deleteHoliday } from '../api';
import { MdAdd, MdEdit, MdDelete, MdCalendarToday, MdFilterList } from 'react-icons/md';
import { format, getDaysInMonth, startOfMonth, getDay } from 'date-fns';

const HOLIDAY_TYPES = ['national', 'regional', 'org'];
const TYPE_COLORS = { national: '#ef4444', regional: '#f59e0b', org: '#6366f1' };

const emptyForm = { name: '', date: '', type: 'national', description: '' };

export default function Holidays() {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [filterType, setFilterType] = useState('');
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  useEffect(() => { fetchHolidays(); }, [currentYear]);

  const fetchHolidays = async () => {
    setLoading(true);
    try { const r = await getHolidays({ year: currentYear }); setHolidays(r.data.holidays); } catch {}
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editItem) {
        await updateHoliday(editItem.id, form);
        showToast('Holiday updated successfully!');
      } else {
        await createHoliday(form);
        showToast('New holiday added successfully!');
      }
      setShowModal(false);
      setEditItem(null);
      setForm(emptyForm);
      fetchHolidays();
    } catch {
      showToast('Failed to save holiday.');
    }
    setSaving(false);
  };

  const handleDelete = async (h) => {
    if (!confirm(`Delete holiday "${h.name}"?`)) return;
    try { await deleteHoliday(h.id); showToast('Holiday deleted.'); fetchHolidays(); } catch { showToast('Failed to delete.'); }
  };

  const openEdit = (h) => {
    setEditItem(h);
    setForm({
      name: h.name,
      date: h.date ? h.date.split('T')[0] : '',
      type: h.type || 'national',
      description: h.description || ''
    });
    setShowModal(true);
  };

  // Calendar helpers
  const daysInMonth = getDaysInMonth(new Date(currentYear, currentMonth));
  const firstDay = getDay(startOfMonth(new Date(currentYear, currentMonth)));
  const filteredHolidays = holidays.filter(h => !filterType || h.type === filterType);

  const monthHolidays = filteredHolidays.filter(h => {
    const d = new Date(h.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const getHolidayForDate = (day) => monthHolidays.find(h => new Date(h.date).getDate() === day);

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  return (
    <Layout title="Holidays" subtitle="Manage annual school holidays and calendar events">
      {toast && <div className="alert alert-success">✅ {toast}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
        {/* Calendar */}
        <div className="card">
          <div className="card-header">
            <div className="card-title"><MdCalendarToday /> Holiday Calendar</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => { if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); } else setCurrentMonth(m => m - 1); }}>‹</button>
              <span style={{ fontWeight: 600, fontSize: 14, minWidth: 140, textAlign: 'center' }}>{MONTHS[currentMonth]} {currentYear}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => { if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); } else setCurrentMonth(m => m + 1); }}>›</button>
              <select className="input" style={{ width: 85, padding: '6px 8px', fontSize: 13 }} value={currentYear} onChange={(e) => setCurrentYear(parseInt(e.target.value))}>
                {[2023,2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div style={{ padding: 20 }}>
            <div className="calendar-grid">
              {DAYS.map(d => <div key={d} className="calendar-day-header">{d}</div>)}
              {Array(firstDay).fill(null).map((_, i) => <div key={`empty-${i}`} />)}
              {Array(daysInMonth).fill(null).map((_, i) => {
                const day = i + 1;
                const holiday = getHolidayForDate(day);
                const isToday = new Date().getDate() === day && new Date().getMonth() === currentMonth && new Date().getFullYear() === currentYear;
                return (
                  <div key={day} className={`calendar-day ${isToday ? 'today' : ''} ${holiday ? 'holiday' : ''}`}
                    title={holiday ? `${holiday.name} (${holiday.type})` : ''}
                    style={holiday ? { background: `${TYPE_COLORS[holiday.type]}20`, color: TYPE_COLORS[holiday.type], fontWeight: 700, cursor: 'pointer', borderRadius: 8, border: `1px solid ${TYPE_COLORS[holiday.type]}40` } : {}}
                    onClick={() => holiday && openEdit(holiday)}>
                    <span>{day}</span>
                    {holiday && <span style={{ fontSize: 8, textAlign: 'center', lineHeight: 1, marginTop: 2 }}>🏖️</span>}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ marginTop: 16, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {Object.entries(TYPE_COLORS).map(([type, color]) => (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: color }} />
                  <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Holiday List Panel */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">📋 Holiday List ({currentYear})</div>
            <button className="btn btn-primary btn-sm" onClick={() => { setForm(emptyForm); setEditItem(null); setShowModal(true); }}>
              <MdAdd /> Add Holiday
            </button>
          </div>

          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <MdFilterList color="var(--text-muted)" />
            <select className="input" style={{ padding: '6px 10px', fontSize: 13 }} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="">All Holiday Types</option>
              <option value="national">National</option>
              <option value="regional">Regional</option>
              <option value="org">Organisation / School</option>
            </select>
          </div>

          <div style={{ maxHeight: 460, overflowY: 'auto' }}>
            {loading ? (
              <div className="loading-overlay" style={{ minHeight: 200 }}><div className="spinner" /></div>
            ) : filteredHolidays.length === 0 ? (
              <div className="empty-state" style={{ padding: 40 }}>
                <div className="empty-state-icon">📅</div>
                <div className="empty-state-title">No holidays found</div>
              </div>
            ) : filteredHolidays.map(h => (
              <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 44, height: 44, background: `${TYPE_COLORS[h.type]}20`, borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: TYPE_COLORS[h.type], lineHeight: 1 }}>{format(new Date(h.date), 'd')}</div>
                  <div style={{ fontSize: 9, color: TYPE_COLORS[h.type], fontWeight: 700 }}>{format(new Date(h.date), 'MMM').toUpperCase()}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }} className="truncate">{h.name}</div>
                  <div style={{ fontSize: 11 }}><span style={{ color: TYPE_COLORS[h.type], fontWeight: 700, textTransform: 'capitalize' }}>{h.type}</span>{h.description && ` — ${h.description}`}</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-sm btn-secondary" onClick={() => openEdit(h)} title="Edit"><MdEdit size={14} /></button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(h)} title="Delete"><MdDelete size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal Add / Edit */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditItem(null); }} title={editItem ? 'Edit Holiday' : 'Add New Holiday'} size="sm"
        footer={<><button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>{saving ? 'Saving...' : 'Save Holiday'}</button></>}>
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label>Holiday Name *</label><input className="input" placeholder="e.g. Independence Day" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div className="form-row">
            <div className="form-group"><label>Date *</label><input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
            <div className="form-group"><label>Type</label>
              <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {HOLIDAY_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group"><label>Description</label><input className="input" placeholder="Optional notes/description..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        </form>
      </Modal>
    </Layout>
  );
}
