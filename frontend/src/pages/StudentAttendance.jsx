import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { getStudentAttendance, markStudentAttendance, getBranches, getClasses } from '../api';
import { MdSave, MdFilterList, MdSearch, MdDownload, MdCheckCircle, MdCancel } from 'react-icons/md';
import { format } from 'date-fns';

export default function StudentAttendance() {
  const [records, setRecords] = useState([]);
  const [periodRecords, setPeriodRecords] = useState([]);
  const [branches, setBranches] = useState([]);
  const [allClasses, setAllClasses] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [branchId, setBranchId] = useState('');
  const [classId, setClassId] = useState('');
  const [period, setPeriod] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [changes, setChanges] = useState({});

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  useEffect(() => {
    getBranches().then(r => setBranches(r.data.branches)).catch(() => { });
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
    if (field === 'status') return record.status || 'absent';
    if (field === 'check_in') return record.check_in || '';
    if (field === 'check_out') return record.check_out || '';
    return '';
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const recordsToSave = records.map(r => {
        const ch = changes[r.id] || {};
        return {
          studentId: r.id,
          date,
          status: ch.status || r.status || 'absent',
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

  const exportCSV = () => {
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
          const hitsStatus = !statusFilter || (record.status || 'absent') === statusFilter;
          return hitsText && hitsStatus;
        });
      });
    });

    if (flatRows.length === 0) {
      showToast('No rows to export for the current filters.');
      return;
    }

    const headers = ['Date', 'Period', 'Class', 'Admission No', 'Student Name', 'Roll No', 'Branch', 'Punch Time', 'Status'];
    const rows = flatRows.map(r => [
      date,
      String(r.period_number ?? r.period_name ?? 'Unassigned'),
      `${r.class_name || ''} ${r.section || ''}`.trim(),
      r.admission_no || '',
      r.full_name || '',
      r.roll_no || '',
      r.branch_name || '',
      r.check_in || '—',
      r.status || 'present'
    ]);

    const csvRows = [headers, ...rows].map(row => {
      return row.map(value => {
        const safeValue = String(value ?? '');
        return `"${safeValue.replace(/"/g, '""')}"`;
      }).join(',');
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `student_attendance_${date}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
            <option value="">All Branches</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>

          <select className="input" style={{ width: 160, padding: '7px 10px', fontSize: 13 }} value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
          </select>

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

          <select className="input" style={{ width: 130, padding: '7px 10px', fontSize: 13 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="present">Present</option>
            <option value="absent">Absent</option>
            <option value="late">Late</option>
            <option value="half-day">Half Day</option>
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
          {renderedPeriods.length > 0 && renderedPeriods.flatMap(periodKey => {
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
                const hitsStatus = !statusFilter || (record.status || 'absent') === statusFilter;
                return hitsText && hitsStatus;
              });
              const present = filteredRows.filter(r => (r.status || 'absent') === 'present').length;
              const absent = filteredRows.filter(r => (r.status || 'absent') === 'absent').length;

              return (
                <div className="card" style={{ marginBottom: 20 }}>
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
                            <td><span className={`badge ${record.status === 'present' ? 'badge-success' : record.status === 'absent' ? 'badge-danger' : 'badge-warning'}`}>{record.status || 'present'}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            });
          })}
        </>
      )}
    </Layout>
  );
}
