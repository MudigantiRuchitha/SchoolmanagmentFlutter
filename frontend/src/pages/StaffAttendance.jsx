import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import ExportCSVModal from '../components/ExportCSVModal';
import { getStaffAttendance, markStaffAttendance, getBranches } from '../api';
import { MdSave, MdFilterList, MdAccessTime, MdSearch, MdDownload, MdFingerprint, MdCheckCircle, MdFlashOn } from 'react-icons/md';
import { format } from 'date-fns';
import { filterBranches, getBranchScope, isDedicatedBranchUser } from '../utils/branchScope';
import { useAuth } from '../context/AuthContext';
import { downloadCSV } from '../utils/csvExport';

const formatTime12 = (timeStr) => {
  if (!timeStr) return '—';
  const clean = String(timeStr).slice(0, 5);
  const [h, m] = clean.split(':');
  if (h === undefined || m === undefined) return timeStr;
  const hourNum = parseInt(h, 10);
  const ampm = hourNum >= 12 ? 'PM' : 'AM';
  const formattedHour = hourNum % 12 === 0 ? 12 : hourNum % 12;
  return `${formattedHour}:${m} ${ampm}`;
};

const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const parts = String(timeStr).trim().split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
};

const checkIsLate = (checkInTime, expectedCheckIn, graceMinutes = 15) => {
  if (!checkInTime) return false;
  const inMins = timeToMinutes(checkInTime);
  const expMins = timeToMinutes(expectedCheckIn || '09:00');
  return inMins > (expMins + graceMinutes);
};

export default function StaffAttendance() {
  const { isReadOnly } = useAuth();
  const [records, setRecords] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [branchId, setBranchId] = useState(getBranchScope);
  const [roleType, setRoleType] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [changes, setChanges] = useState({});

  // Export Modal State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Punches Modal State
  const [showPunchesModal, setShowPunchesModal] = useState(false);
  const [punchStaffRecord, setPunchStaffRecord] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  useEffect(() => { getBranches().then(r => setBranches(filterBranches(r.data.branches || []))).catch(() => { }); }, []);
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
    } catch { }
    setLoading(false);
  };

  const openPunchesModal = (r) => {
    setPunchStaffRecord(r);
    setShowPunchesModal(true);
  };

  const getVal = (record, field) => {
    const ch = changes[record.id];
    if (ch && ch[field] !== undefined) return ch[field];
    if (field === 'status') return record.status || '';
    if (field === 'check_in') return record.check_in || '';
    if (field === 'check_out') return record.check_out || '';
    return '';
  };

  const updateChange = (id, field, value) => {
    setChanges(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const markAll = (status) => {
    const nc = { ...changes };
    records.forEach(r => { nc[r.id] = { ...nc[r.id], status }; });
    setChanges(nc);
  };


  const handleSave = async () => {
    setSaving(true);
    try {
      const recs = records.map(r => {
        const ch = changes[r.id] || {};
        const checkInVal = ch.check_in !== undefined ? ch.check_in : (r.check_in || null);
        const checkOutVal = ch.check_out !== undefined ? ch.check_out : (r.check_out || null);
        let statusVal = ch.status !== undefined ? ch.status : (r.status || '');

        if (checkInVal && checkOutVal) {
          const inM = timeToMinutes(checkInVal);
          const outM = timeToMinutes(checkOutVal);
          const dur = Math.max(0, outM - inM);
          const expInM = timeToMinutes(r.expected_check_in || '09:00');
          const expOutM = timeToMinutes(r.expected_check_out || '17:00');
          const totalSch = (expOutM > expInM) ? (expOutM - expInM) : 480;
          const halfM = Math.floor(totalSch / 2);
          const isLate = checkIsLate(checkInVal, r.expected_check_in || '09:00');

          if (dur >= halfM) {
            if (dur >= (totalSch - 30)) {
              statusVal = isLate ? 'late' : 'present';
            } else {
              statusVal = 'half-day';
            }
          } else {
            // Stayed less than half day (e.g. 1 min from 3:44 to 3:45)
            // Under user rule: Must NOT show half-day!
            if (isLate) {
              statusVal = 'late';
            } else if (dur < 30) {
              statusVal = 'absent';
            }
          }
        } else if (checkInVal) {
          const isLate = checkIsLate(checkInVal, r.expected_check_in || '09:00');
          if (isLate && (!statusVal || statusVal === 'present')) {
            statusVal = 'late';
          }
        }

        return {
          staffId: r.id,
          date,
          status: statusVal,
          checkIn: checkInVal,
          checkOut: checkOutVal,
          mode: 'manual'
        };
      });
      await markStaffAttendance({ records: recs });
      showToast('Staff attendance saved successfully!');
      fetchAttendance();
    } catch { showToast('Failed to save staff attendance.'); }
    setSaving(false);
  };

  const handleExecuteExport = async ({ fromDate, fromTime, toDate, toTime, reportType, preset }) => {
    setExporting(true);
    try {
      let exportRows = [];
      let headers = [];
      let filename = `staff_attendance_${fromDate || 'all'}_to_${toDate || 'all'}.csv`;

      if (preset === 'today' && fromDate === date && toDate === date && reportType === 'detailed' && records.length > 0) {
        headers = ['Date', 'Staff ID', 'Staff Name', 'Role', 'Designation', 'Branch', 'School Check In', 'School Check Out', 'Actual Check In', 'Actual Check Out', 'Status'];
        exportRows = filteredRecords.map(r => [
          date,
          r.staff_id || '',
          `"${r.full_name}"`,
          r.role_type,
          `"${r.designation || ''}"`,
          `"${r.branch_name || ''}"`,
          r.expected_check_in || '09:00',
          r.expected_check_out || '17:00',
          getVal(r, 'check_in'),
          getVal(r, 'check_out'),
          getVal(r, 'status')
        ]);
        filename = `staff_attendance_${date}.csv`;
      } else {
        const params = {
          from_date: fromDate || '2000-01-01',
          to_date: toDate || '2099-12-31',
          from_time: fromTime || '00:00',
          to_time: toTime || '23:59',
          report_type: reportType
        };
        if (branchId) params.branch_id = branchId;
        if (roleType) params.role_type = roleType;

        const res = await getStaffAttendance(params);
        const data = res.data?.records || [];

        if (data.length === 0) {
          setExporting(false);
          return { error: 'No staff attendance records found for the selected date & time range.' };
        } else if (reportType === 'detailed') {
          headers = ['Date', 'Staff ID', 'Staff Name', 'Role', 'Designation', 'Branch', 'School Check In', 'School Check Out', 'Actual Check In', 'Actual Check Out', 'Status'];
          exportRows = data.map(r => [
            r.date || '',
            r.staff_id || '',
            r.full_name || '',
            r.role_type || '',
            r.designation || '',
            r.branch_name || '',
            r.expected_check_in || '09:00',
            r.expected_check_out || '17:00',
            r.check_in || '',
            r.check_out || '',
            r.status || ''
          ]);
          filename = `staff_attendance_detailed_${fromDate || 'all'}_to_${toDate || 'all'}.csv`;
        } else {
          headers = ['Staff ID', 'Staff Name', 'Role', 'Branch', 'Total Days', 'Present Days', 'Absent Days', 'Attendance %'];
          exportRows = data.map(r => {
            const tot = Number(r.total_days || 0);
            const pres = Number(r.present_days || 0);
            const pct = tot > 0 ? ((pres / tot) * 100).toFixed(1) + '%' : '0%';
            return [
              r.staff_id || '',
              r.full_name || '',
              r.role_type || '',
              r.branch_name || '',
              tot,
              pres,
              Number(r.absent_days || 0),
              pct
            ];
          });
          filename = `staff_attendance_summary_${fromDate || 'all'}_to_${toDate || 'all'}.csv`;
        }
      }

      downloadCSV(filename, headers, exportRows);
      setShowExportModal(false);
      showToast(`Staff attendance CSV exported successfully (${exportRows.length} rows).`);
      return { success: true };
    } catch (err) {
      console.error(err);
      return { error: 'Failed to export staff attendance.' };
    } finally {
      setExporting(false);
    }
  };

  const filteredRecords = records.filter(r => {
    const matchesSearch = !search ||
      r.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (r.staff_id || '').toLowerCase().includes(search.toLowerCase());
    const currentStatus = getVal(r, 'status');
    const matchesStatus = !statusFilter
      ? true
      : statusFilter === 'not_marked'
        ? !currentStatus
        : currentStatus === statusFilter;
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
      subtitle="Staff School Timings (Arrival & Departure Hours)"
      headerRight={
        records.length > 0 && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowExportModal(true)} title="Export CSV with Custom Time Range">
              <MdDownload /> Export CSV
            </button>
            {!isReadOnly && (
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                <MdSave /> {saving ? 'Saving...' : 'Save Attendance'}
              </button>
            )}
            {isReadOnly && (
              <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600, padding: '5px 10px', background: '#f1f5f9', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                Only Read (Viewer Mode)
              </span>
            )}
          </div>
        )
      }
    >
      {toast && <div className="alert alert-success alert-toast"><MdCheckCircle style={{ verticalAlign: 'middle', marginRight: 6 }} /> {toast}</div>}

      {/* School Timing Banner */}

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ padding: '12px 18px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap', overflowX: 'auto' }}>
          <MdFilterList color="var(--text-muted)" size={18} style={{ flexShrink: 0 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <label style={{ fontSize: 12, marginBottom: 0, fontWeight: 600 }}>Date:</label>
            <input type="date" className="input" style={{ width: 130, padding: '6px 8px', fontSize: 12.5, height: 36 }} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <select className="input" style={{ width: 125, padding: '6px 8px', fontSize: 12.5, height: 36, flexShrink: 0 }} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            {!isDedicatedBranchUser() && <option value="">All Branches</option>}
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>

          <select className="input" style={{ width: 110, padding: '6px 8px', fontSize: 12.5, height: 36, flexShrink: 0 }} value={roleType} onChange={(e) => setRoleType(e.target.value)}>
            <option value="">All Roles</option>
            <option value="teaching">Teaching</option>
            <option value="non-teaching">Non-Teaching</option>
            <option value="management">Management</option>
          </select>

          <div className="search-box" style={{ padding: '5px 10px', height: 36, minWidth: 110, maxWidth: 150, flex: '1 1 110px' }}>
            <MdSearch color="var(--text-muted)" size={18} />
            <input
              placeholder="Search staff..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', fontSize: 12.5 }}
            />
          </div>

          <select className="input" style={{ width: 120, padding: '6px 8px', fontSize: 12.5, height: 36, flexShrink: 0 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="late">Late</option>
            <option value="half-day">Half Day</option>
            <option value="not_marked">Not Marked (Blank)</option>
          </select>

          {records.length > 0 && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
              <button className="btn btn-sm btn-success" onClick={() => markAll('present')} style={{ padding: '6px 10px', fontSize: 12, height: 36, whiteSpace: 'nowrap' }}>✓ All Present</button>
              <button className="btn btn-sm btn-danger" onClick={() => markAll('absent')} style={{ padding: '6px 10px', fontSize: 12, height: 36, whiteSpace: 'nowrap' }}>✗ All Absent</button>
              <button className="btn btn-sm btn-secondary" onClick={() => markAll('')} style={{ padding: '6px 10px', fontSize: 12, height: 36, whiteSpace: 'nowrap' }}>Clear All</button>
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
            <thead><tr><th>Staff ID</th><th>Name & Designation</th><th>Role</th><th>Branch</th><th>School Hours</th><th>Check In</th><th>Check Out</th><th>Status</th><th>Punches</th></tr></thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr><td colSpan={9}><div className="empty-state"><div className="empty-state-icon"><MdAccessTime /></div><div className="empty-state-title">No staff attendance records</div></div></td></tr>
              ) : filteredRecords.map(r => {
                const inTime = getVal(r, 'check_in');
                const outTime = getVal(r, 'check_out');
                return (
                  <tr key={r.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700 }}>{r.staff_id || '—'}</td>
                    <td><div style={{ fontWeight: 600 }}>{r.full_name}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.designation}</div></td>
                    <td><span className={`badge ${r.role_type === 'teaching' ? 'badge-info' : r.role_type === 'management' ? 'badge-purple' : 'badge-warning'}`}>{r.role_type}</span></td>
                    <td style={{ fontSize: 13 }}>{r.branch_name || '—'}</td>
                    <td>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 8px', background: '#f1f5f9', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }} title="Expected School Timings">
                        <MdAccessTime size={13} style={{ color: '#4f46e5' }} />
                        {formatTime12(r.expected_check_in || '09:00')} – {formatTime12(r.expected_check_out || '17:00')}
                      </div>
                    </td>
                    <td>
                      <div>
                        <div style={{
                          fontSize: 13,
                          fontWeight: inTime ? 700 : 500,
                          color: inTime
                            ? (checkIsLate(inTime, r.expected_check_in || '09:00') ? '#b45309' : '#0f172a')
                            : 'var(--text-muted, #94a3b8)'
                        }}>
                          {inTime ? formatTime12(inTime) : '—'}
                          {inTime && checkIsLate(inTime, r.expected_check_in || '09:00') && (
                            <span
                              style={{
                                marginLeft: 6,
                                fontSize: 10,
                                padding: '2px 6px',
                                background: '#fef3c7',
                                color: '#b45309',
                                borderRadius: 4,
                                fontWeight: 700
                              }}
                            >
                              Late
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                          Exp: {formatTime12(r.expected_check_in || '09:00')} <span style={{ color: '#64748b', fontSize: 9 }}>(+15m grace)</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>
                        <div style={{
                          fontSize: 13,
                          fontWeight: outTime ? 700 : 500,
                          color: outTime ? '#0f172a' : 'var(--text-muted, #94a3b8)'
                        }}>
                          {outTime ? formatTime12(outTime) : '—'}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                          Exp: {formatTime12(r.expected_check_out || '17:00')}
                        </div>
                      </div>
                    </td>
                    <td>
                      <select
                        className="input"
                        style={{
                          padding: '6px 10px',
                          fontSize: 13,
                          width: 125,
                          background: getVal(r, 'status') === 'present' ? '#f0fdf4' : getVal(r, 'status') === 'absent' ? '#fef2f2' : getVal(r, 'status') === 'late' ? '#fffbeb' : getVal(r, 'status') === 'half-day' ? '#faf5ff' : 'var(--bg, #ffffff)',
                          color: getVal(r, 'status') === 'present' ? '#15803d' : getVal(r, 'status') === 'absent' ? '#dc2626' : getVal(r, 'status') === 'late' ? '#d97706' : getVal(r, 'status') === 'half-day' ? '#7e22ce' : 'var(--text-muted, #94a3b8)',
                          fontWeight: getVal(r, 'status') ? 700 : 400
                        }}
                        value={getVal(r, 'status')}
                        disabled={isReadOnly}
                        onChange={(e) => updateChange(r.id, 'status', e.target.value)}
                      >
                        <option value="">—---—</option>
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
                <div style={{ fontSize: 12, color: '#4338ca', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MdAccessTime size={14} /> Expected School Hours: <strong>{formatTime12(punchStaffRecord.expected_check_in || '09:00')} – {formatTime12(punchStaffRecord.expected_check_out || '17:00')}</strong>
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

      {/* Export CSV Modal */}
      <ExportCSVModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Staff Attendance"
        isAttendance={true}
        loading={exporting}
        onExport={handleExecuteExport}
      />
    </Layout>
  );
}
