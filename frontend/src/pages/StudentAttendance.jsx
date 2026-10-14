import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import ClassSectionSelect from '../components/ClassSectionSelect';
import ExportCSVModal from '../components/ExportCSVModal';
import { getStudentAttendance, markStudentAttendance, getBranches, getClasses } from '../api';
import { MdSave, MdFilterList, MdSearch, MdDownload, MdCheckCircle, MdCancel } from 'react-icons/md';
import { format } from 'date-fns';
import { filterBranches, getBranchScope, isDedicatedBranchUser } from '../utils/branchScope';
import { useAuth } from '../context/AuthContext';
import { downloadCSV } from '../utils/csvExport';

export default function StudentAttendance() {
  const { isReadOnly } = useAuth();
  const [records, setRecords] = useState([]);
  const [periodRecords, setPeriodRecords] = useState([]);
  const [branches, setBranches] = useState([]);
  const [allClasses, setAllClasses] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [branchId, setBranchId] = useState(getBranchScope);
  const [classId, setClassId] = useState('');
  const [period, setPeriod] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [changes, setChanges] = useState({});
  const [showExportModal, setShowExportModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  useEffect(() => {
    getBranches().then(r => setBranches(filterBranches(r.data.branches || []))).catch(() => { });
  }, []);

  useEffect(() => {
    getClasses().then(r => {
      const list = r.data.classes || [];
      setAllClasses(list);
      setClasses(list);
    }).catch(() => { });
  }, []);

  useEffect(() => {
    if (branchId) {
      getClasses({ branch_id: branchId }).then(r => {
        setClasses(r.data.classes || []);
      }).catch(() => { });
    } else {
      setClasses(allClasses);
      setClassId('');
    }
  }, [branchId, allClasses]);

  useEffect(() => { fetchAttendance(); }, [date, branchId, classId, period]);

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const params = { date };
      if (branchId) params.branch_id = branchId;
      if (classId) params.class_id = classId;
      if (period) params.period = period;
      const r = await getStudentAttendance(params);
      setRecords(r.data.records || []);
      setPeriodRecords(r.data.period_records || []);
      setChanges({});
    } catch { }
    setLoading(false);
  };

  const updateChange = (studentId, field, value) => {
    setChanges(prev => ({ ...prev, [studentId]: { ...prev[studentId], [field]: value } }));
  };

  const getVal = (record, field) => {
    const ch = changes[record.id];
    if (ch && ch[field] !== undefined) return ch[field];
    if (field === 'status') return record.status || '';
    if (field === 'check_in') return record.check_in || '';
    if (field === 'check_out') return record.check_out || '';
    return '';
  };

  const markAll = (status) => {
    const nc = { ...changes };
    records.forEach(r => { nc[r.id] = { ...nc[r.id], status }; });
    setChanges(nc);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const recordsToSave = records.map(r => {
        const ch = changes[r.id] || {};
        return {
          studentId: r.id,
          date,
          status: ch.status !== undefined ? ch.status : (r.status || ''),
          checkIn: ch.check_in !== undefined ? ch.check_in : (r.check_in || null),
          checkOut: ch.check_out !== undefined ? ch.check_out : (r.check_out || null),
          mode: 'manual',
        };
      });
      await markStudentAttendance({ records: recordsToSave });
      showToast('Student attendance records saved successfully!');
      fetchAttendance();
    } catch { showToast('Failed to save attendance.'); }
    setSaving(false);
  };

  const filteredDailyRecords = records.filter(record => {
    const term = (search || '').trim().toLowerCase();
    const hitsText = !term || `${record.full_name || ''} ${record.admission_no || ''} ${record.roll_no || ''} ${record.branch_name || ''} ${record.class_name || ''} ${record.section || ''}`.toLowerCase().includes(term);
    const recStatus = getVal(record, 'status');
    const hitsStatus = !statusFilter ? true : statusFilter === 'not_marked' ? !recStatus : recStatus === statusFilter;
    return hitsText && hitsStatus;
  });

  const handleExecuteExport = async ({ fromDate, fromTime, toDate, toTime, reportType, preset }) => {
    setExporting(true);
    try {
      let exportRows = [];
      let headers = [];
      let filename = `student_attendance_${fromDate || 'all'}_to_${toDate || 'all'}.csv`;

      if (preset === 'today' && fromDate === date && toDate === date && reportType === 'detailed' && records.length > 0) {
        if (renderedPeriods.length > 0) {
          headers = ['Date', 'Period', 'Class', 'Admission No', 'Student Name', 'Roll No', 'Branch', 'Punch Time', 'Status'];
          const flatRows = renderedPeriods.flatMap(periodKey => {
            const group = periodGroups[periodKey] || [];
            const periodClassGroups = group.reduce((acc, record) => {
              const classKey = `${record.class_name || ''} ${record.section || ''}`.trim() || 'Unassigned Class';
              acc[classKey] ||= [];
              acc[classKey].push(record);
              return acc;
            }, {});

            return Object.keys(periodClassGroups).sort().flatMap(classKey => {
              const classRows = periodClassGroups[classKey] || [];
              return classRows.filter(record => {
                const term = (search || '').trim().toLowerCase();
                const hitsText = !term || `${record.full_name || ''} ${record.admission_no || ''} ${record.roll_no || ''} ${record.branch_name || ''} ${record.class_name || ''} ${record.section || ''}`.toLowerCase().includes(term);
                const recStatus = record.status || '';
                const hitsStatus = !statusFilter ? true : statusFilter === 'not_marked' ? !recStatus : recStatus === statusFilter;
                return hitsText && hitsStatus;
              });
            });
          });

          exportRows = flatRows.map(r => [
            date,
            String(r.period_number ?? r.period_name ?? 'Unassigned'),
            `${r.class_name || ''} ${r.section || ''}`.trim(),
            r.admission_no || '',
            `"${r.full_name || ''}"`,
            r.roll_no || '',
            `"${r.branch_name || ''}"`,
            r.check_in || '',
            r.status || ''
          ]);
        } else {
          headers = ['Date', 'Daily/Session', 'Class', 'Admission No', 'Student Name', 'Roll No', 'Branch', 'Check In', 'Status'];
          exportRows = filteredDailyRecords.map(r => [
            date,
            'Daily',
            `${r.class_name || ''} ${r.section || ''}`.trim(),
            r.admission_no || '',
            `"${r.full_name || ''}"`,
            r.roll_no || '',
            `"${r.branch_name || ''}"`,
            getVal(r, 'check_in') || '',
            getVal(r, 'status') || ''
          ]);
        }
        filename = `student_attendance_${date}.csv`;
      } else {
        const params = {
          from_date: fromDate || '2000-01-01',
          to_date: toDate || '2099-12-31',
          from_time: fromTime || '00:00',
          to_time: toTime || '23:59',
          report_type: reportType
        };
        if (branchId) params.branch_id = branchId;
        if (classId) params.class_id = classId;

        const res = await getStudentAttendance(params);
        const data = res.data?.records || [];

        if (data.length === 0) {
          setExporting(false);
          return { error: 'No student attendance records found for the selected date & time range.' };
        } else if (reportType === 'detailed') {
          headers = ['Date', 'Admission No', 'Student Name', 'Roll No', 'Class', 'Section', 'Branch', 'Check In', 'Check Out', 'Status'];
          exportRows = data.map(r => [
            r.date || '',
            r.admission_no || '',
            r.full_name || '',
            r.roll_no || '',
            r.class_name || '',
            r.section || '',
            r.branch_name || '',
            r.check_in || '',
            r.check_out || '',
            r.status || ''
          ]);
          filename = `student_attendance_detailed_${fromDate || 'all'}_to_${toDate || 'all'}.csv`;
        } else {
          headers = ['Admission No', 'Student Name', 'Roll No', 'Class', 'Section', 'Branch', 'Total Days', 'Present Days', 'Absent Days', 'Late Days', 'Attendance %'];
          exportRows = data.map(r => {
            const tot = Number(r.total_days || 0);
            const pres = Number(r.present_days || 0);
            const pct = tot > 0 ? ((pres / tot) * 100).toFixed(1) + '%' : '0%';
            return [
              r.admission_no || '',
              r.full_name || '',
              r.roll_no || '',
              r.class_name || '',
              r.section || '',
              r.branch_name || '',
              tot,
              pres,
              Number(r.absent_days || 0),
              Number(r.late_days || 0),
              pct
            ];
          });
          filename = `student_attendance_summary_${fromDate || 'all'}_to_${toDate || 'all'}.csv`;
        }
      }

      setShowExportModal(false);
      showToast(`Student attendance CSV exported successfully (${exportRows.length} rows).`);
      return { success: true };
    } catch (error) {
      console.error('Student attendance CSV export failed:', error);
      return { error: 'CSV export failed. Please try again.' };
    } finally {
      setExporting(false);
    }
  };

  const periodGroups = periodRecords.reduce((groups, record) => {
    const periodKey = String(record.period_number ?? record.period_name ?? 'Unassigned');
    if (!groups[periodKey]) groups[periodKey] = [];
    groups[periodKey].push(record);
    return groups;
  }, {});

  const periodNames = Object.keys(periodGroups).sort((a, b) => {
    const aNumber = Number.parseInt(a, 10);
    const bNumber = Number.parseInt(b, 10);
    if (Number.isNaN(aNumber) || Number.isNaN(bNumber)) return a.localeCompare(b);
    return aNumber - bNumber;
  });

  const periodOptions = Array.from(new Map(
    periodRecords
      .filter(record => record.period_number || record.period_name)
      .map(record => {
        const value = String(record.period_number ?? record.period_name ?? 'Unassigned');
        const label = record.period_name || (record.period_number ? `Period ${record.period_number}` : 'Unassigned');
        return [value, { value, label }];
      })
  ).values()).sort((a, b) => {
    const aNum = Number.parseInt(a.value, 10);
    const bNum = Number.parseInt(b.value, 10);
    if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
    return a.label.localeCompare(b.label);
  });

  const renderedPeriods = periodNames.filter(periodKey => !period || periodKey === period);

  const getMapKey = (periodKey, record) => {
    const className = `${record.class_name || ''} ${record.section || ''}`.trim();
    return `${periodKey}::${className || 'Unassigned Class'}`;
  };

  const summary = {
    total: records.length,
    present: records.filter(r => getVal(r, 'status') === 'present').length,
    absent: records.filter(r => getVal(r, 'status') === 'absent').length,
    late: records.filter(r => getVal(r, 'status') === 'late').length,
    halfDay: records.filter(r => getVal(r, 'status') === 'half-day').length,
  };

  return (
    <Layout
      title="Student Attendance"
      subtitle="Mark, update, and manage student daily attendance"
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

      {/* Filters & Control Bar */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <MdFilterList /> Filters:
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 12, marginBottom: 0 }}>Date:</label>
            <input type="date" className="input" style={{ width: 150, padding: '7px 10px', fontSize: 13 }} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <select className="input" style={{ width: 160, padding: '7px 10px', fontSize: 13 }} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            {!isDedicatedBranchUser() && <option value="">All Branches</option>}
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>

          <ClassSectionSelect
            classes={classes}
            value={classId}
            onChange={setClassId}
            includeAll
            classStyle={{ width: 160, padding: '7px 10px', fontSize: 13 }}
            sectionStyle={{ width: 140, padding: '7px 10px', fontSize: 13 }}
          />

          <select className="input" style={{ width: 160, padding: '7px 10px', fontSize: 13 }} value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="">All Periods</option>
            {periodOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          <div className="search-box" style={{ padding: '6px 12px' }}>
            <MdSearch color="var(--text-muted)" />
            <input
              placeholder="Search student..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 140 }}
            />
          </div>

          <select className="input" style={{ width: 160, padding: '7px 10px', fontSize: 13 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="late">Late</option>
            <option value="half-day">Half Day</option>
            <option value="not_marked">Not Marked (Blank)</option>
          </select>

        </div>

        {/* Live Attendance Summary */}
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

      {loading ? <div className="loading-overlay"><div className="spinner" /> Loading attendance records...</div> : (
        <>
          {renderedPeriods.length > 0 ? renderedPeriods.flatMap(periodKey => {
            const group = periodGroups[periodKey] || [];
            const periodClassGroups = group.reduce((acc, record) => {
              const classKey = `${record.class_name || ''} ${record.section || ''}`.trim() || 'Unassigned Class';
              acc[classKey] ||= [];
              acc[classKey].push(record);
              return acc;
            }, {});

            const classKeys = Object.keys(periodClassGroups).sort();
            return classKeys.map(classKey => {
              const classRows = periodClassGroups[classKey] || [];
              const startTime = classRows[0]?.period_start_time || classRows[0]?.start_time || '—';
              const endTime = classRows[0]?.period_end_time || classRows[0]?.end_time || '—';
              const filteredRows = classRows.filter(record => {
                const term = (search || '').trim().toLowerCase();
                const hitsText = !term || `${record.full_name || ''} ${record.admission_no || ''} ${record.roll_no || ''} ${record.branch_name || ''} ${record.class_name || ''} ${record.section || ''}`.toLowerCase().includes(term);
                const recStatus = record.status || '';
                const hitsStatus = !statusFilter ? true : statusFilter === 'not_marked' ? !recStatus : recStatus === statusFilter;
                return hitsText && hitsStatus;
              });
              const present = filteredRows.filter(r => r.status === 'present').length;
              const absent = filteredRows.filter(r => r.status === 'absent').length;

              return (
                <div key={`${periodKey}-${classKey}`} className="card" style={{ marginBottom: 20 }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>
                        Period {periodKey}
                        <span style={{ marginLeft: 12, fontWeight: 500, fontSize: 12, color: 'var(--text-secondary)' }}>Class: {classKey}</span>
                        <span style={{ marginLeft: 12, fontWeight: 500, fontSize: 12, color: 'var(--text-secondary)' }}>{startTime} - {endTime}</span>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                        {filteredRows.length} Students &nbsp;&nbsp;&nbsp;
                        <span className="badge badge-success" style={{ marginRight: 8 }}>{present} Present</span>
                        <span className="badge badge-danger">{absent} Absent</span>
                      </div>
                    </div>
                  </div>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Student Name</th>
                          <th>Admission No</th>
                          <th>Roll No</th>
                          <th>Branch</th>
                          <th>Punch Time</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.map((record, idx) => (
                          <tr key={`${periodKey}-${classKey}-${record.id || idx}`}>
                            <td>{idx + 1}</td>
                            <td>{record.full_name}</td>
                            <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{record.admission_no || '—'}</td>
                            <td>{record.roll_no || '—'}</td>
                            <td>{record.branch_name || '—'}</td>
                            <td>{record.check_in || '—'}</td>
                            <td>
                              {record.status ? (
                                <span className={`badge ${record.status === 'present' ? 'badge-success' : record.status === 'absent' ? 'badge-danger' : record.status === 'late' ? 'badge-warning' : 'badge-secondary'}`}>
                                  {record.status}
                                </span>
                              ) : (
                                ''
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            });
          }) : (
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>Student Daily Attendance</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                    {filteredDailyRecords.length} Students &nbsp;&nbsp;&nbsp;
                    <span className="badge badge-success" style={{ marginRight: 8 }}>{summary.present} Present</span>
                    <span className="badge badge-danger">{summary.absent} Absent</span>
                  </div>
                </div>
                {!isReadOnly && records.length > 0 && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-sm btn-success" onClick={() => markAll('present')}>✓ All Present</button>
                    <button className="btn btn-sm btn-danger" onClick={() => markAll('absent')}>✗ All Absent</button>
                    <button className="btn btn-sm btn-secondary" onClick={() => markAll('')}>Clear All</button>
                  </div>
                )}
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Student Name</th>
                      <th>Admission No</th>
                      <th>Roll No</th>
                      <th>Class</th>
                      <th>Branch</th>
                      <th>Check In</th>
                      <th>Check Out</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDailyRecords.length === 0 ? (
                      <tr>
                        <td colSpan={9}>
                          <div className="empty-state">
                            <div className="empty-state-title">No student attendance records</div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredDailyRecords.map((r, idx) => (
                        <tr key={r.id}>
                          <td>{idx + 1}</td>
                          <td style={{ fontWeight: 600 }}>{r.full_name}</td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.admission_no || '—'}</td>
                          <td>{r.roll_no || '—'}</td>
                          <td>{r.class_name ? `${r.class_name} ${r.section || ''}`.trim() : '—'}</td>
                          <td>{r.branch_name || '—'}</td>
                          <td>
                            <input 
                              type="time" 
                              className="input" 
                              style={{ width: 110, padding: '5px 8px', fontSize: 13 }} 
                              value={getVal(r, 'check_in')} 
                              disabled={isReadOnly}
                              onChange={(e) => updateChange(r.id, 'check_in', e.target.value)} 
                            />
                          </td>
                          <td>
                            <input 
                              type="time" 
                              className="input" 
                              style={{ width: 110, padding: '5px 8px', fontSize: 13 }} 
                              value={getVal(r, 'check_out')} 
                              disabled={isReadOnly}
                              onChange={(e) => updateChange(r.id, 'check_out', e.target.value)} 
                            />
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
                              <option value="">—--—</option>
                              <option value="present">Present</option>
                              <option value="absent">Absent</option>
                              <option value="late">Late</option>
                              <option value="half-day">Half Day</option>
                            </select>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Export CSV Modal */}
      <ExportCSVModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Student Attendance"
        isAttendance={true}
        loading={exporting}
        onExport={handleExecuteExport}
      />
    </Layout>
  );
}
