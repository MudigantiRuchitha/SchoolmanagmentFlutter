import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import ClassSectionSelect from '../components/ClassSectionSelect';
import { getDashboardStats, getDashboardAttendance, getRecentNotices, getBranches, getClasses } from '../api';
import { MdPeople, MdSchool, MdBusiness, MdPerson, MdAdminPanelSettings, MdCategory, MdEventNote, MdTune, MdAnnouncement } from 'react-icons/md';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { format } from 'date-fns';
import { filterBranches, getBranchScope, isDedicatedBranchUser } from '../utils/branchScope';

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#6366f1'];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [attendance, setAttendance] = useState({ records: [], summary: {} });
  const [notices, setNotices] = useState([]);
  const [branches, setBranches] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [attType, setAttType] = useState('student');
  const [selectedBranch, setSelectedBranch] = useState(getBranchScope);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => { fetchInit(); }, []);
  useEffect(() => { fetchAttendance(); }, [attType, selectedBranch, selectedClass, selectedDate]);

  const fetchInit = async () => {
    try {
      const [s, b, n] = await Promise.all([getDashboardStats(), getBranches(), getRecentNotices()]);
      setStats(s.data.stats);
      setBranches(filterBranches(b.data.branches || []));
      setNotices(n.data.notices);
    } catch {}
    setLoading(false);
  };

  const fetchAttendance = async () => {
    try {
      const params = { type: attType, date: selectedDate };
      if (selectedBranch) params.branch_id = selectedBranch;
      if (selectedClass && attType === 'student') params.class_id = selectedClass;
      const res = await getDashboardAttendance(params);
      setAttendance(res.data);
    } catch {}
  };

  useEffect(() => {
    if (selectedBranch) {
      getClasses({ branch_id: selectedBranch }).then(r => setClasses(r.data.classes)).catch(() => {});
    } else {
      setClasses([]);
      setSelectedClass('');
    }
  }, [selectedBranch]);

  const statCards = stats ? [
    { label: 'Total Students', value: stats.total_students, icon: <MdSchool />, bg: '#eff6ff', color: '#3b82f6' },
    { label: 'Teaching Staff', value: stats.teaching_staff, icon: <MdPeople />, bg: '#f0fdf4', color: '#10b981' },
    { label: 'Non-Teaching', value: stats.non_teaching_staff, icon: <MdPerson />, bg: '#fefce8', color: '#eab308' },
    { label: 'Management', value: stats.management_staff, icon: <MdAdminPanelSettings />, bg: '#fdf4ff', color: '#a855f7' },
    { label: 'Total Staff', value: stats.total_staff, icon: <MdPeople />, bg: '#fff7ed', color: '#f97316' },
    { label: 'Admin Users', value: stats.total_admins, icon: <MdAdminPanelSettings />, bg: '#fef2f2', color: '#ef4444' },
    { label: 'Classes', value: stats.total_classes, icon: <MdCategory />, bg: '#f0fdfa', color: '#14b8a6' },
    { label: 'Branches', value: stats.total_branches, icon: <MdBusiness />, bg: '#eff6ff', color: '#6366f1' },
  ] : [];

  const summary = attendance.summary || {};
  const pieData = [
    { name: 'Present', value: summary.present || 0 },
    { name: 'Absent', value: summary.absent || 0 },
    { name: 'Late', value: summary.late || 0 },
  ].filter(d => d.value > 0);

  if (loading) return (
    <Layout title="Dashboard">
      <div className="loading-overlay"><div className="spinner" /> Loading dashboard...</div>
    </Layout>
  );

  return (
    <Layout title="Dashboard" subtitle={`Today: ${format(new Date(), 'EEEE, MMMM d yyyy')}`}>
      {/* Stats */}
      <div className="stats-grid">
        {statCards.map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.bg }}>
              <span style={{ fontSize: 22 }}>{s.icon}</span>
            </div>
            <div className="stat-info">
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
        {/* Attendance Panel */}
        <div className="card">
          <div className="card-header">
            <div className="card-title"><MdEventNote /> Today's Attendance</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="date"
                className="input"
                style={{ width: 160, padding: '6px 10px', fontSize: 13 }}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
          </div>

          {/* Filters & Tabs */}
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div className="tabs" style={{ marginBottom: 0 }}>
              <button className={`tab-btn ${attType === 'student' ? 'active' : ''}`} onClick={() => setAttType('student')}>Students</button>
              <button className={`tab-btn ${attType === 'staff' ? 'active' : ''}`} onClick={() => setAttType('staff')}>Staff</button>
            </div>
            <select className="input" style={{ width: 160, padding: '8px 10px', fontSize: 13 }} value={selectedBranch} onChange={(e) => { setSelectedBranch(e.target.value); setSelectedClass(''); }}>
              {!isDedicatedBranchUser() && <option value="">All Branches</option>}
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            {attType === 'student' && selectedBranch && classes.length > 0 && (
              <ClassSectionSelect
                classes={classes}
                value={selectedClass}
                onChange={setSelectedClass}
                includeAll
                classStyle={{ width: 160, padding: '8px 10px', fontSize: 13 }}
                sectionStyle={{ width: 140, padding: '8px 10px', fontSize: 13 }}
              />
            )}
          </div>

          {/* Summary */}
          <div style={{ display: 'flex', gap: 16, padding: '16px 24px', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
            {[
              { label: 'Total', value: summary.total || 0, color: 'var(--primary)' },
              { label: 'Present', value: summary.present || 0, color: 'var(--success)' },
              { label: 'Absent', value: summary.absent || 0, color: 'var(--danger)' },
              { label: 'Late', value: summary.late || 0, color: 'var(--warning)' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Records table */}
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>{attType === 'student' ? 'Class' : 'Role'}</th>
                  <th>Branch</th>
                  <th>Punch Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {attendance.records?.length === 0 ? (
                  <tr><td colSpan={5}><div className="empty-state" style={{ padding: 30 }}><div>No records found</div></div></td></tr>
                ) : attendance.records?.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{r.full_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {attType === 'student' ? r.admission_no : r.staff_id}
                      </div>
                    </td>
                    <td style={{ fontSize: 13 }}>{attType === 'student' ? `${r.class_name} ${r.section || ''}` : r.role_type}</td>
                    <td style={{ fontSize: 13 }}>{r.branch_name}</td>
                    <td style={{ fontSize: 13 }}>{r.check_in || r.check_out || '—'}</td>
                    <td>
                      <span className={`badge ${!r.status || r.status === 'absent' ? 'badge-danger' : r.status === 'present' ? 'badge-success' : r.status === 'late' ? 'badge-warning' : 'badge-info'}`}>
                        {r.status || 'absent'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Pie Chart */}
          {pieData.length > 0 && (
            <div className="card">
              <div className="card-header" style={{ padding: '16px 20px' }}>
                <div className="card-title" style={{ fontSize: 14 }}>Attendance Summary</div>
              </div>
              <div style={{ padding: '12px 0' }}>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Notices */}
          <div className="card" style={{ flex: 1 }}>
            <div className="card-header" style={{ padding: '16px 20px' }}>
              <div className="card-title" style={{ fontSize: 14 }}><MdAnnouncement /> Recent Notices</div>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {notices.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>No notices</div>
              ) : notices.map((n) => (
                <div key={n.id} className="notice-card">
                  <div className="notice-title">{n.title}</div>
                  <div className="notice-content" style={{ WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {n.content}
                  </div>
                  <div className="notice-meta">
                    <span className={`badge badge-${n.audience === 'all' ? 'purple' : n.audience === 'staff' ? 'info' : 'success'}`} style={{ fontSize: 10 }}>
                      {n.audience}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
