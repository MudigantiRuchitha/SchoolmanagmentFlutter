import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import { getStaffAttendance, markStaffAttendance, getBranches } from '../api';
import { MdSave, MdFilterList, MdAccessTime, MdSearch, MdDownload, MdFingerprint } from 'react-icons/md';
import { format } from 'date-fns';

export default function StaffAttendance() {
  const [records, setRecords] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [branchId, setBranchId] = useState('');
  const [roleType, setRoleType] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [changes, setChanges] = useState({});

  // Punches Modal State
  const [showPunchesModal, setShowPunchesModal] = useState(false);
  const [punchStaffRecord, setPunchStaffRecord] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  useEffect(() => { getBranches().then(r => setBranches(r.data.branches)).catch(() => {}); }, []);
  useEffect(() => { fetchAttendance(); }, [date, branchId, roleType]);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const params = { date };
      if (branchId) params.branch_id = branchId;
      if (roleType) params.role_type = roleType;
      const r = await getStaffAttendance(params);
      setRecords(r.data.records);
      setChanges({});
    } catch {}
    setLoading(false);
  };

  const openPunchesModal = (r) => {
    setPunchStaffRecord(r);
    setShowPunchesModal(true);
  };

  const getVal = (record, field) => {
    const ch = changes[record.id];
    if (ch && ch[field] !== undefined) return ch[field];
    if (field === 'status') return record.status || 'absent';
    if (field === 'check_in') return record.check_in || '';
    if (field === 'check_out') return record.check_out || '';
    return '';
  };

  const updateChange = (id, field, value) => {
    setChanges(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const markAll = (status) => {
    const nc = {};
    records.forEach(r => { nc[r.id] = { status }; });
    setChanges(nc);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const recs = records.map(r => {
        const ch = changes[r.id] || {};
        return { 
          staffId: r.id, 
          date, 
          status: ch.status || r.status || 'absent', 
          checkIn: ch.check_in !== undefined ? ch.check_in : (r.check_in || null), 
          checkOut: ch.check_out !== undefined ? ch.check_out : (r.check_out || null), 
          mode: 'manual' 
        };
      });
      await markStaffAttendance({ records: recs });
      showToast('Staff attendance saved successfully!');
      fetchAttendance();
    } catch { showToast('Failed to save staff attendance.'); }
    setSaving(false);
  };

  const exportCSV = () => {
    if (records.length === 0) return;
    const headers = ['Date', 'Staff ID', 'Staff Name', 'Role', 'Branch', 'Check In', 'Check Out', 'Status'];
    const rows = records.map(r => [
      date, r.staff_id || '', `"${r.full_name}"`, r.role_type, `"${r.branch_name || ''}"`, getVal(r, 'check_in'), getVal(r, 'check_out'), getVal(r, 'status')
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `staff_attendance_${date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredRecords = records.filter(r => {
    const matchesSearch = !search || 
      r.full_name.toLowerCase().includes(search.toLowerCase()) || 
      (r.staff_id || '').toLowerCase().includes(search.toLowerCase());
    const currentStatus = getVal(r, 'status');
    const matchesStatus = !statusFilter || currentStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const summary = {
    total: records.length,
    present: records.filter(r => getVal(r, 'status') === 'present').length,
    absent: records.filter(r => getVal(r, 'status') === 'absent').length,
    late: records.filter(r => getVal(r, 'status') === 'late').length,
    halfDay: records.filter(r => getVal(r, 'status') === 'half-day').length,
  };

  return (
    <Layout 
      title="Staff Attendance" 
      subtitle="Mark, check-in, check-out, view biometric punches and manage staff daily attendance"
      headerRight={
        records.length > 0 && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary btn-sm" onClick={exportCSV} title="Export CSV">
              <MdDownload /> Export CSV
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              <MdSave /> {saving ? 'Saving...' : 'Save Attendance'}
            </button>
          </div>
        )
      }
    >
      {toast && <div className="alert alert-success">✅ {toast}</div>}

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <MdFilterList color="var(--text-muted)" />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 12, marginBottom: 0 }}>Date:</label>
            <input type="date" className="input" style={{ width: 150, padding: '7px 10px', fontSize: 13 }} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <select className="input" style={{ width: 160, padding: '7px 10px', fontSize: 13 }} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">All Branches</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          
          <select className="input" style={{ width: 150, padding: '7px 10px', fontSize: 13 }} value={roleType} onChange={(e) => setRoleType(e.target.value)}>
            <option value="">All Roles</option>
            <option value="teaching">Teaching</option>
            <option value="non-teaching">Non-Teaching</option>
            <option value="management">Management</option>
          </select>

          <div className="search-box" style={{ padding: '6px 12px' }}>
            <MdSearch color="var(--text-muted)" />
            <input 
              placeholder="Search staff..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              style={{ width: 140 }}
            />
          </div>

          <select className="input" style={{ width: 130, padding: '7px 10px', fontSize: 13 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="late">Late</option>
            <option value="half-day">Half Day</option>
          </select>

          {records.length > 0 && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button className="btn btn-sm btn-success" onClick={() => markAll('present')}>✓ All Present</button>
              <button className="btn btn-sm btn-danger" onClick={() => markAll('absent')}>✗ All Absent</button>
            </div>
          )}
        </div>

        {records.length > 0 && (
          <div style={{ display: 'flex', gap: 24, padding: '12px 20px', background: 'var(--bg)', borderTop: '1px solid var(--border)' }}>
            {[
              { label: 'Total', value: summary.total, color: 'var(--primary)' },
              { label: 'Present', value: summary.present, color: 'var(--success)' },
              { label: 'Absent', value: summary.absent, color: 'var(--danger)' },
              { label: 'Late', value: summary.late, color: 'var(--warning)' },
              { label: 'Half Day', value: summary.halfDay, color: '#a855f7' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{s.value}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading ? <div className="loading-overlay"><div className="spinner" /> Loading staff attendance...</div> : (
        <div className="table-container">
          <table>
            <thead><tr><th>Staff ID</th><th>Name & Designation</th><th>Role</th><th>Branch</th><th>Check In</th><th>Check Out</th><th>Status</th><th>Punches</th></tr></thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr><td colSpan={8}><div className="empty-state"><div className="empty-state-icon"><MdAccessTime /></div><div className="empty-state-title">No staff attendance records</div></div></td></tr>
              ) : filteredRecords.map(r => {
                const inTime = getVal(r, 'check_in');
                const outTime = getVal(r, 'check_out');
                return (
                  <tr key={r.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700 }}>{r.staff_id || '—'}</td>
                    <td><div style={{ fontWeight: 600 }}>{r.full_name}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.designation}</div></td>
                    <td><span className={`badge ${r.role_type === 'teaching' ? 'badge-info' : r.role_type === 'management' ? 'badge-purple' : 'badge-warning'}`}>{r.role_type}</span></td>
                    <td style={{ fontSize: 13 }}>{r.branch_name || '—'}</td>
                    <td><input type="time" className="input" style={{ width: 120, padding: '5px 8px', fontSize: 13 }} value={inTime} onChange={(e) => updateChange(r.id, 'check_in', e.target.value)} /></td>
                    <td><input type="time" className="input" style={{ width: 120, padding: '5px 8px', fontSize: 13 }} value={outTime} onChange={(e) => updateChange(r.id, 'check_out', e.target.value)} /></td>
                    <td>
                      <select className="input" style={{ padding: '6px 10px', fontSize: 13, width: 120, 
                        background: getVal(r, 'status') === 'present' ? '#f0fdf4' : getVal(r, 'status') === 'absent' ? '#fef2f2' : getVal(r, 'status') === 'late' ? '#fffbeb' : '#faf5ff',
                        color: getVal(r, 'status') === 'present' ? '#15803d' : getVal(r, 'status') === 'absent' ? '#dc2626' : getVal(r, 'status') === 'late' ? '#d97706' : '#7e22ce', 
                        fontWeight: 700 }}
                        value={getVal(r, 'status')} onChange={(e) => updateChange(r.id, 'status', e.target.value)}>
                        <option value="present">Present</option>
                        <option value="absent">Absent</option>
                        <option value="late">Late</option>
                        <option value="half-day">Half Day</option>
                      </select>
                    </td>
                    <td>
                      <button 
                        className="btn btn-sm btn-secondary" 
                        onClick={() => openPunchesModal(r)}
                        title="View Biometric & Mobile Attendance Punches"
                        style={{ background: '#f3e8ff', color: '#7e22ce', border: '1px solid #d8b4fe', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <MdFingerprint size={16} /> View Punches
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Attendance Punches Modal */}
      <Modal
        isOpen={showPunchesModal}
        onClose={() => setShowPunchesModal(false)}
        title={punchStaffRecord ? `Attendance Punches: ${punchStaffRecord.full_name} (${date})` : 'Attendance Punches Log'}
        size="lg"
        footer={<button className="btn btn-secondary" onClick={() => setShowPunchesModal(false)}>Close</button>}
      >
        {punchStaffRecord && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#f3e8ff', color: '#7e22ce', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18 }}>
                <MdFingerprint size={24} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)' }}>{punchStaffRecord.full_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Staff ID: <strong>{punchStaffRecord.staff_id || '—'}</strong> | Branch: <strong>{punchStaffRecord.branch_name || 'Main Branch'}</strong>
                </div>
              </div>
            </div>

            <h4 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)', marginBottom: 12 }}>
              Detailed Punch Time Logs ({date})
            </h4>

            {(() => {
              const inT = getVal(punchStaffRecord, 'check_in');
              const outT = getVal(punchStaffRecord, 'check_out');
              const statusVal = getVal(punchStaffRecord, 'status');

              const storedPunches = Array.isArray(punchStaffRecord.punches) ? punchStaffRecord.punches : [];
              const punchTimes = storedPunches.length > 0
                ? storedPunches
                : [inT, outT].filter(Boolean).map((time, index) => ({ time, mode: punchStaffRecord.mode || 'manual', index }));
              const punches = punchTimes.map((punch, index) => ({
                id: `${punch.time}-${index}`,
                time: punch.time
              }));

              if (punches.length === 0) {
                return (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', background: '#fafafa', borderRadius: 8 }}>
                    <MdAccessTime size={32} style={{ marginBottom: 6, opacity: 0.4 }} />
                    <div style={{ fontWeight: 600, fontSize: 14 }}>No biometric punches logged for {date}.</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>Attendance status: <span className="badge badge-danger">{statusVal}</span></div>
                  </div>
                );
              }

              return (
                <div>
                  <div style={{ marginBottom: 10, fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Total punches: {punches.length}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {punches.map(p => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'monospace', color: 'var(--text-main)' }}>
                        {p.time}
                      </div>
                    </div>
                  ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </Modal>
    </Layout>
  );
}
