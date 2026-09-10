import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { 
  getBranches, 
  getClasses, 
  getStaff, 
  getSettings,
  getOrgDefaultTimetable, 
  saveOrgDefaultTimetable, 
  getClassAttendanceSettings, 
  saveClassAttendanceSettings 
} from '../api';
import { 
  MdSchedule, 
  MdSave, 
  MdAdd, 
  MdDelete, 
  MdFilterList, 
  MdInfo, 
  MdCheckCircle, 
  MdCancel, 
  MdAccessTime, 
  MdClass, 
  MdPerson,
  MdDomain
} from 'react-icons/md';

export default function TimetableSetup() {
  const [branches, setBranches] = useState([]);
  const [classes, setClasses] = useState([]);
  const [staffList, setStaffList] = useState([]);
  
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  
  const [hasTimetableAccess, setHasTimetableAccess] = useState(true);
  const [allowedMode, setAllowedMode] = useState('BOTH'); // 'BOTH', 'MORNING_EVENING', 'PERIOD_WISE'
  const [attendanceMode, setAttendanceMode] = useState('MORNING_EVENING'); // 'MORNING_EVENING' or 'PERIOD_WISE'
  
  // Morning & Evening Slots State (Org-Wide)
  const [morningSlot, setMorningSlot] = useState({
    slotName: 'Morning (AM)',
    startTime: '09:00',
    endTime: '09:30',
    isActive: true
  });
  const [eveningSlot, setEveningSlot] = useState({
    slotName: 'Evening (PM)',
    startTime: '15:30',
    endTime: '16:00',
    isActive: true
  });

  // Period-wise Slots State (Class-Specific)
  const [periodSlots, setPeriodSlots] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  useEffect(() => {
    getBranches().then(r => setBranches(r.data.branches || [])).catch(() => {});
    getStaff().then(r => setStaffList(r.data.staff || [])).catch(() => {});
    loadOrgPermissionsAndDefaults();
  }, []);

  const loadOrgPermissionsAndDefaults = async () => {
    setLoading(true);
    try {
      const s = await getSettings();
      const access = s.data.settings?.timetable_access !== false;
      setHasTimetableAccess(access);

      const modePermission = s.data.settings?.allowed_attendance_mode || 'BOTH';
      setAllowedMode(modePermission);

      if (modePermission === 'MORNING_EVENING') {
        setAttendanceMode('MORNING_EVENING');
      } else if (modePermission === 'PERIOD_WISE') {
        setAttendanceMode('PERIOD_WISE');
      }

      const r = await getOrgDefaultTimetable();
      const fetchedSlots = r.data.slots || [];
      const m = fetchedSlots.find(slot => slot.slot_type === 'morning') || fetchedSlots[0];
      const e = fetchedSlots.find(slot => slot.slot_type === 'evening') || fetchedSlots[1] || m;

      if (m) {
        setMorningSlot({
          slotName: m.slot_name || 'Morning (AM)',
          startTime: (m.start_time || '09:00').slice(0, 5),
          endTime: (m.end_time || '09:30').slice(0, 5),
          isActive: true
        });
      }
      if (e) {
        setEveningSlot({
          slotName: e.slot_name || 'Evening (PM)',
          startTime: (e.start_time || '15:30').slice(0, 5),
          endTime: (e.end_time || '16:00').slice(0, 5),
          isActive: true
        });
      }
    } catch {
      // Ignore
    }
    setLoading(false);
  };

  useEffect(() => {
    if (selectedBranch) {
      getClasses({ branch_id: selectedBranch }).then(r => setClasses(r.data.classes || [])).catch(() => {});
    } else { setClasses([]); setSelectedClass(''); }
  }, [selectedBranch]);

  useEffect(() => {
    if (attendanceMode === 'PERIOD_WISE' && selectedClass) {
      loadClassSettings(selectedClass);
    }
  }, [selectedClass, attendanceMode]);

  const loadClassSettings = async (classId) => {
    setLoading(true);
    try {
      const r = await getClassAttendanceSettings(classId);
      const hasCustom = r.data.hasCustomSetting;
      const mode = hasCustom ? r.data.attendanceMode : attendanceMode;
      
      if (hasCustom && allowedMode === 'BOTH') {
        setAttendanceMode(mode);
      }

      const fetchedSlots = r.data.slots || [];
      if (mode === 'PERIOD_WISE') {
        if (fetchedSlots.length > 0) {
          setPeriodSlots(fetchedSlots.map((s, idx) => ({
            id: s.id,
            slotNumber: s.slot_number || (idx + 1),
            slotName: s.slot_name || `Period ${idx + 1}`,
            startTime: (s.start_time || '09:00').slice(0, 5),
            endTime: (s.end_time || '09:45').slice(0, 5),
            subjectName: s.subject_name || '',
            teacherId: s.teacher_id || '',
            isActive: s.is_active !== false
          })));
        } else {
          setPeriodSlots([]);
        }
      }
    } catch {
      showToast('Error loading settings for selected class');
    }
    setLoading(false);
  };

  const handleAddPeriod = () => {
    const nextNum = periodSlots.length + 1;
    const lastSlot = periodSlots[periodSlots.length - 1];
    let start = '09:00';
    let end = '09:45';
    if (lastSlot && lastSlot.endTime) {
      start = lastSlot.endTime;
      const [h, m] = start.split(':').map(Number);
      const totalM = h * 60 + m + 45;
      const endH = String(Math.floor(totalM / 60) % 24).padStart(2, '0');
      const endM = String(totalM % 60).padStart(2, '0');
      end = `${endH}:${endM}`;
    }

    setPeriodSlots(prev => [
      ...prev,
      {
        slotNumber: nextNum,
        slotName: `Period ${nextNum}`,
        startTime: start,
        endTime: end,
        subjectName: '',
        teacherId: '',
        isActive: true
      }
    ]);
  };

  const handleRemovePeriod = (idx) => {
    const updated = periodSlots.filter((_, i) => i !== idx).map((s, i) => ({
      ...s,
      slotNumber: i + 1,
      slotName: s.slotName.startsWith('Period ') ? `Period ${i + 1}` : s.slotName
    }));
    setPeriodSlots(updated);
  };

  const validateTimes = (slotsToValidate) => {
    for (let i = 0; i < slotsToValidate.length; i++) {
      const s = slotsToValidate[i];
      if (!s.startTime || !s.endTime) {
        showToast(`Slot "${s.slotName}" missing start or end time!`);
        return false;
      }
      if (s.startTime >= s.endTime) {
        showToast(`Slot "${s.slotName}" start time must be earlier than end time!`);
        return false;
      }
    }
    return true;
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      if (attendanceMode === 'MORNING_EVENING') {
        const valid = validateTimes([morningSlot, eveningSlot]);
        if (!valid) { setSaving(false); return; }

        const payloadSlots = [
          {
            slotType: 'morning',
            slotNumber: 1,
            slotName: morningSlot.slotName || 'Morning (AM)',
            startTime: morningSlot.startTime,
            endTime: morningSlot.endTime,
            isActive: morningSlot.isActive
          },
          {
            slotType: 'evening',
            slotNumber: 2,
            slotName: eveningSlot.slotName || 'Evening (PM)',
            startTime: eveningSlot.startTime,
            endTime: eveningSlot.endTime,
            isActive: eveningSlot.isActive
          }
        ];

        await saveOrgDefaultTimetable({ slots: payloadSlots });
        showToast('🎉 Organisation-wide Morning & Evening Attendance times saved!');
        loadOrgPermissionsAndDefaults();
      } else {
        if (!selectedClass) {
          showToast('Please select a specific Branch & Class first!');
          setSaving(false);
          return;
        }

        const valid = validateTimes(periodSlots);
        if (!valid) { setSaving(false); return; }

        const payloadSlots = periodSlots.map((p, i) => ({
          slotType: 'period',
          slotNumber: i + 1,
          slotName: p.slotName || `Period ${i + 1}`,
          startTime: p.startTime,
          endTime: p.endTime,
          subjectName: p.subjectName,
          teacherId: p.teacherId ? parseInt(p.teacherId) : null,
          isActive: p.isActive !== false
        }));

        await saveClassAttendanceSettings(selectedClass, {
          attendanceMode: 'PERIOD_WISE',
          slots: payloadSlots
        });
        showToast('🎉 Period-wise Timetable for Class saved successfully!');
        loadClassSettings(selectedClass);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save configuration.');
    }
    setSaving(false);
  };

  if (!hasTimetableAccess) {
    return (
      <Layout 
        title="Timetable & Attendance Setup" 
        subtitle="Access Control"
      >
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🔒</div>
          <h2 style={{ marginBottom: 8, color: '#ef4444' }}>Access Disabled by Super Admin</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 15, maxWidth: 500, margin: '0 auto 24px auto' }}>
            Timetable & Attendance Setup access has been disabled for this organisation by the Super Administrator.
          </p>
          <button className="btn btn-primary" onClick={() => window.location.href = '/dashboard'}>
            Return to Dashboard
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout 
      title="Timetable & Attendance Setup" 
      subtitle="Configure Attendance Mode (Morning/Evening vs Period-wise Subject Timetable)"
      headerRight={
        <button className="btn btn-primary" onClick={handleSaveSettings} disabled={saving}>
          <MdSave /> {saving ? 'Saving...' : attendanceMode === 'MORNING_EVENING' ? 'Save Morning & Evening Times' : 'Save Class Period Timetable'}
        </button>
      }
    >
      {toast && <div className="alert alert-success">✅ {toast}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* STEP 1: ATTENDANCE MODE SELECTION (RESPONDS TO SUPERADMIN PERMISSIONS) */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ background: 'var(--primary)', color: '#fff', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>1</div>
            <h3 style={{ margin: 0, fontSize: 17 }}>Attendance Mode Configuration</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {/* Option A: Morning & Evening */}
            {(allowedMode === 'BOTH' || allowedMode === 'MORNING_EVENING') && (
              <div 
                onClick={() => {
                  if (allowedMode === 'BOTH') {
                    setAttendanceMode('MORNING_EVENING');
                    setSelectedClass('');
                  }
                }}
                style={{ 
                  border: `2px solid ${attendanceMode === 'MORNING_EVENING' ? 'var(--primary)' : 'var(--border)'}`,
                  background: attendanceMode === 'MORNING_EVENING' ? 'rgba(2,132,199,0.04)' : 'var(--card-bg)',
                  borderRadius: 12,
                  padding: 20,
                  cursor: allowedMode === 'BOTH' ? 'pointer' : 'default',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: 16, color: attendanceMode === 'MORNING_EVENING' ? 'var(--primary)' : 'var(--text-main)' }}>
                    🌅 Morning & Evening Mode (AM / PM)
                  </div>
                  <input type="radio" checked={attendanceMode === 'MORNING_EVENING'} readOnly />
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                  Attendance is taken twice a day (Morning & Evening sessions). Applies organisation-wide for all classes.
                </p>
                <div style={{ marginTop: 12, display: 'inline-flex', gap: 6, padding: '4px 10px', background: '#dcfce7', color: '#15803d', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                  Organisation-Wide (AM / PM Sessions)
                </div>
              </div>
            )}

            {/* Option B: Period-wise Attendance */}
            {(allowedMode === 'BOTH' || allowedMode === 'PERIOD_WISE') && (
              <div 
                onClick={() => {
                  if (allowedMode === 'BOTH') {
                    setAttendanceMode('PERIOD_WISE');
                  }
                }}
                style={{ 
                  border: `2px solid ${attendanceMode === 'PERIOD_WISE' ? 'var(--primary)' : 'var(--border)'}`,
                  background: attendanceMode === 'PERIOD_WISE' ? 'rgba(2,132,199,0.04)' : 'var(--card-bg)',
                  borderRadius: 12,
                  padding: 20,
                  cursor: allowedMode === 'BOTH' ? 'pointer' : 'default',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: 16, color: attendanceMode === 'PERIOD_WISE' ? 'var(--primary)' : 'var(--text-main)' }}>
                    📖 Period-wise (Subject) Mode
                  </div>
                  <input type="radio" checked={attendanceMode === 'PERIOD_WISE'} readOnly />
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                  Attendance is taken period-by-period for specific subjects and assigned teachers per Class/Section.
                </p>
                <div style={{ marginTop: 12, display: 'inline-flex', gap: 6, padding: '4px 10px', background: '#e0f2fe', color: '#0369a1', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                  Class-Specific Subject Timetable
                </div>
              </div>
            )}
          </div>
        </div>

        {/* STEP 2: MODE-SPECIFIC CONFIGURATION */}

        {/* CASE 1: MORNING & EVENING MODE */}
        {attendanceMode === 'MORNING_EVENING' && (
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ background: 'var(--primary)', color: '#fff', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>2</div>
              <h3 style={{ margin: 0, fontSize: 17 }}>Configure Organisation Morning & Evening Session Times</h3>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              These morning and evening attendance session times apply to all classes across the organisation on the mobile app.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
              {/* Morning Session Card */}
              <div style={{ background: 'var(--bg)', padding: 20, borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15, color: '#0284c7', marginBottom: 14 }}>
                  <MdAccessTime /> Morning Session (AM)
                </div>
                <div className="form-group">
                  <label>Slot Label Name</label>
                  <input 
                    className="input" 
                    value={morningSlot.slotName} 
                    onChange={e => setMorningSlot(prev => ({ ...prev, slotName: e.target.value }))} 
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label>Start Time</label>
                    <input 
                      type="time" 
                      className="input" 
                      value={morningSlot.startTime} 
                      onChange={e => setMorningSlot(prev => ({ ...prev, startTime: e.target.value }))} 
                    />
                  </div>
                  <div className="form-group">
                    <label>End Time</label>
                    <input 
                      type="time" 
                      className="input" 
                      value={morningSlot.endTime} 
                      onChange={e => setMorningSlot(prev => ({ ...prev, endTime: e.target.value }))} 
                    />
                  </div>
                </div>
              </div>

              {/* Evening Session Card */}
              <div style={{ background: 'var(--bg)', padding: 20, borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15, color: '#7c3aed', marginBottom: 14 }}>
                  <MdAccessTime /> Evening Session (PM)
                </div>
                <div className="form-group">
                  <label>Slot Label Name</label>
                  <input 
                    className="input" 
                    value={eveningSlot.slotName} 
                    onChange={e => setEveningSlot(prev => ({ ...prev, slotName: e.target.value }))} 
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label>Start Time</label>
                    <input 
                      type="time" 
                      className="input" 
                      value={eveningSlot.startTime} 
                      onChange={e => setEveningSlot(prev => ({ ...prev, startTime: e.target.value }))} 
                    />
                  </div>
                  <div className="form-group">
                    <label>End Time</label>
                    <input 
                      type="time" 
                      className="input" 
                      value={eveningSlot.endTime} 
                      onChange={e => setEveningSlot(prev => ({ ...prev, endTime: e.target.value }))} 
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CASE 2: PERIOD-WISE MODE (CLASS SELECTOR SHOWN HERE!) */}
        {attendanceMode === 'PERIOD_WISE' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* CLASS SELECTOR BAR (ONLY FOR PERIOD-WISE MODE) */}
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MdFilterList /> Select Class for Period Timetable:
                </div>

                <select className="input" style={{ width: 220 }} value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}>
                  <option value="">Select Branch</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>

                <select className="input" style={{ width: 240 }} value={selectedClass} onChange={e => setSelectedClass(e.target.value)} disabled={!selectedBranch}>
                  <option value="">Select Class & Section</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
                </select>

                {selectedClass && (() => {
                  const currentCls = classes.find(c => String(c.id) === String(selectedClass));
                  const clsName = currentCls ? `${currentCls.name} ${currentCls.section || ''}`.trim() : `Class ID: ${selectedClass}`;
                  return (
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(139,92,246,0.1)', padding: '6px 14px', borderRadius: 8, color: '#7c3aed', fontWeight: 600, fontSize: 13 }}>
                      <MdClass /> Configured Class: {clsName}
                    </div>
                  );
                })()}
              </div>
            </div>

            {!selectedClass ? (
              <div className="card" style={{ padding: 48, textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📖</div>
                <h3 style={{ marginBottom: 6 }}>Select a Branch & Class</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                  Choose a Branch and Class/Section above to create and manage its period-by-period subject timetable.
                </p>
              </div>
            ) : loading ? (
              <div className="loading-overlay"><div className="spinner" /> Loading period timetable...</div>
            ) : (
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 17 }}>Configure Period Timetable & Subjects</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                      Add, edit, or remove period slots. The mobile app will display these exact periods for teachers of this class.
                    </p>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={handleAddPeriod}>
                    <MdAdd /> Add New Period
                  </button>
                </div>

                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 80 }}>Period #</th>
                        <th style={{ minWidth: 140 }}>Period Name</th>
                        <th style={{ width: 120 }}>Start Time</th>
                        <th style={{ width: 120 }}>End Time</th>
                        <th style={{ minWidth: 160 }}>Subject Name</th>
                        <th style={{ minWidth: 180 }}>Assigned Teacher</th>
                        <th style={{ width: 90 }}>Status</th>
                        <th style={{ width: 60, textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {periodSlots.length === 0 ? (
                        <tr>
                          <td colSpan="8" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
                            No period slots created for this class yet. Click <strong>+ Add New Period</strong> above to create your first period.
                          </td>
                        </tr>
                      ) : (
                        periodSlots.map((p, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 700, textAlign: 'center', fontSize: 14, color: '#0284c7' }}>
                            P{p.slotNumber}
                          </td>
                          <td>
                            <input 
                              className="input" 
                              style={{ padding: '6px 8px', fontSize: 13 }}
                              value={p.slotName} 
                              onChange={e => {
                                const newP = [...periodSlots];
                                newP[idx].slotName = e.target.value;
                                setPeriodSlots(newP);
                              }}
                            />
                          </td>
                          <td>
                            <input 
                              type="time" 
                              className="input" 
                              style={{ padding: '6px 8px', fontSize: 13 }}
                              value={p.startTime} 
                              onChange={e => {
                                const newP = [...periodSlots];
                                newP[idx].startTime = e.target.value;
                                setPeriodSlots(newP);
                              }}
                            />
                          </td>
                          <td>
                            <input 
                              type="time" 
                              className="input" 
                              style={{ padding: '6px 8px', fontSize: 13 }}
                              value={p.endTime} 
                              onChange={e => {
                                const newP = [...periodSlots];
                                newP[idx].endTime = e.target.value;
                                setPeriodSlots(newP);
                              }}
                            />
                          </td>
                          <td>
                            <input 
                              className="input" 
                              placeholder="e.g. Mathematics" 
                              style={{ padding: '6px 8px', fontSize: 13 }}
                              value={p.subjectName} 
                              onChange={e => {
                                const newP = [...periodSlots];
                                newP[idx].subjectName = e.target.value;
                                setPeriodSlots(newP);
                              }}
                            />
                          </td>
                          <td>
                            <select 
                              className="input" 
                              style={{ padding: '6px 8px', fontSize: 13 }}
                              value={p.teacherId || ''}
                              onChange={e => {
                                const newP = [...periodSlots];
                                newP[idx].teacherId = e.target.value;
                                setPeriodSlots(newP);
                              }}
                            >
                              <option value="">Assign Teacher (Optional)</option>
                              {staffList.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.staff_id || s.id})</option>)}
                            </select>
                          </td>
                          <td>
                            <button 
                              className={`btn btn-sm ${p.isActive ? 'btn-success' : 'btn-secondary'}`}
                              onClick={() => {
                                const newP = [...periodSlots];
                                newP[idx].isActive = !newP[idx].isActive;
                                setPeriodSlots(newP);
                              }}
                              style={{ padding: '3px 8px', fontSize: 11 }}
                            >
                              {p.isActive ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button className="btn btn-sm btn-danger" onClick={() => handleRemovePeriod(idx)} title="Delete Period">
                              <MdDelete size={14} />
                            </button>
                          </td>
                        </tr>
                      )))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
