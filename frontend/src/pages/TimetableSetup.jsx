import { useState, useEffect, useRef } from 'react';
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
  MdAccessTime,
  MdClass
} from 'react-icons/md';
import { filterBranches, getBranchScope, isDedicatedBranchUser } from '../utils/branchScope';

export default function TimetableSetup() {

  // =========================================================
  // BASIC DATA
  // =========================================================

  const [branches, setBranches] = useState([]);
  const [classes, setClasses] = useState([]);
  const [staffList, setStaffList] = useState([]);

  // =========================================================
  // BRANCH / CLASS / SECTION
  // =========================================================

  const [selectedBranch, setSelectedBranch] = useState(getBranchScope);

  // Actual classes.id
  // This is what the timetable API needs.
  const [selectedClass, setSelectedClass] = useState('');

  // Class name shown in dropdown
  // Example: Class 10
  const [selectedClassName, setSelectedClassName] = useState('');

  // Section shown in dropdown
  // Example: A
  const [selectedSection, setSelectedSection] = useState('');

  // Unique class names returned by backend
  const [classOptions, setClassOptions] = useState([]);

  // Example:
  // {
  //   "Class 10": [
  //      { section: "A", classId: 10 },
  //      { section: "B", classId: 11 }
  //   ]
  // }
  const [sectionsByClass, setSectionsByClass] = useState({});

  // =========================================================
  // ORGANISATION SETTINGS
  // =========================================================

  const [hasTimetableAccess, setHasTimetableAccess] =
    useState(true);

  const [allowedMode, setAllowedMode] =
    useState('BOTH');

  const [attendanceMode, setAttendanceMode] =
    useState('MORNING_EVENING');

  // =========================================================
  // MORNING SLOT
  // =========================================================

  const [morningSlot, setMorningSlot] = useState({
    slotName: 'Morning (AM)',
    startTime: '09:00',
    endTime: '09:30',
    isActive: true
  });

  // =========================================================
  // EVENING SLOT
  // =========================================================

  const [eveningSlot, setEveningSlot] = useState({
    slotName: 'Evening (PM)',
    startTime: '15:30',
    endTime: '16:00',
    isActive: true
  });

  // =========================================================
  // PERIOD-WISE SLOTS
  // =========================================================

  const [periodSlots, setPeriodSlots] = useState([]);

  // =========================================================
  // ADD PERIOD MODAL
  // =========================================================

  const [showAddPeriodModal, setShowAddPeriodModal] =
    useState(false);

  const [newPeriod, setNewPeriod] = useState({
    slotName: '',
    startTime: '09:00',
    endTime: '09:45',
    subjectName: '',
    teacherId: '',
    isActive: true
  });

  // Reference for last period
  const newPeriodRowRef = useRef(null);

  // =========================================================
  // LOADING / SAVING
  // =========================================================

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  // =========================================================
  // TOAST
  // =========================================================

  const showToast = (msg) => {
    setToast(msg);

    setTimeout(() => {
      setToast('');
    }, 3500);
  };

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {

    getBranches()
      .then(r => {
        setBranches(filterBranches(r.data.branches || []));
      })
      .catch(() => {
        setBranches([]);
      });

    getStaff()
      .then(r => {
        setStaffList(r.data.staff || []);
      })
      .catch(() => {
        setStaffList([]);
      });

    loadOrgPermissionsAndDefaults();

  }, []);

  // =========================================================
  // LOAD ORGANISATION SETTINGS
  // =========================================================

  const loadOrgPermissionsAndDefaults = async () => {

    setLoading(true);

    try {

      const s = await getSettings();

      const access =
        s.data.settings?.timetable_access !== false;

      setHasTimetableAccess(access);

      const modePermission =
        s.data.settings?.allowed_attendance_mode ||
        'BOTH';

      setAllowedMode(modePermission);

      if (
        modePermission ===
        'MORNING_EVENING'
      ) {
        setAttendanceMode(
          'MORNING_EVENING'
        );
      }

      else if (
        modePermission ===
        'PERIOD_WISE'
      ) {
        setAttendanceMode(
          'PERIOD_WISE'
        );
      }

      const r =
        await getOrgDefaultTimetable();

      const fetchedSlots =
        r.data.slots || [];

      const m =
        fetchedSlots.find(
          slot =>
            slot.slot_type === 'morning'
        ) ||
        fetchedSlots[0];

      const e =
        fetchedSlots.find(
          slot =>
            slot.slot_type === 'evening'
        ) ||
        fetchedSlots[1] ||
        m;

      if (m) {

        setMorningSlot({
          slotName:
            m.slot_name ||
            'Morning (AM)',

          startTime:
            (m.start_time ||
              '09:00').slice(0, 5),

          endTime:
            (m.end_time ||
              '09:30').slice(0, 5),

          isActive: true
        });

      }

      if (e) {

        setEveningSlot({
          slotName:
            e.slot_name ||
            'Evening (PM)',

          startTime:
            (e.start_time ||
              '15:30').slice(0, 5),

          endTime:
            (e.end_time ||
              '16:00').slice(0, 5),

          isActive: true
        });

      }

    }

    catch (err) {

      console.error(
        'Error loading organisation settings:',
        err
      );

    }

    setLoading(false);
  };

  // =========================================================
  // LOAD CLASSES WHEN BRANCH CHANGES
  // =========================================================

  useEffect(() => {

    if (!selectedBranch) {

      setClasses([]);
      setClassOptions([]);
      setSectionsByClass({});

      setSelectedClass('');
      setSelectedClassName('');
      setSelectedSection('');

      setPeriodSlots([]);

      return;
    }

    getClasses({
      branch_id: selectedBranch
    })

      .then(r => {

        const rows =
          r.data.classes || [];

        const classNames =
          r.data.classOptions || [];

        const sections =
          r.data.sectionsByClass || {};

        setClasses(rows);

        setClassOptions(
          classNames
        );

        setSectionsByClass(
          sections
        );

        // Reset previous selection
        setSelectedClass('');
        setSelectedClassName('');
        setSelectedSection('');

        setPeriodSlots([]);

      })

      .catch(err => {

        console.error(
          'Error loading classes:',
          err
        );

        setClasses([]);
        setClassOptions([]);
        setSectionsByClass({});

        setSelectedClass('');
        setSelectedClassName('');
        setSelectedSection('');

        setPeriodSlots([]);

        showToast(
          'Unable to load classes.'
        );

      });

  }, [selectedBranch]);

  // =========================================================
  // CLASS CHANGE
  // =========================================================

  const handleClassChange = (className) => {

    setSelectedClassName(className);

    // Whenever class changes,
    // section must be selected again.
    setSelectedSection('');

    // Actual class ID is not known
    // until section is selected.
    setSelectedClass('');

    setPeriodSlots([]);

  };

  // =========================================================
  // SECTION CHANGE
  // =========================================================

  const handleSectionChange = (section) => {

    setSelectedSection(section);

    const sectionOptions =
      sectionsByClass[selectedClassName] ||
      [];

    const selected =
      sectionOptions.find(
        item =>
          String(item.section) ===
          String(section)
      );

    if (selected) {

      // IMPORTANT:
      // Store the actual classes.id.
      //
      // Example:
      // Class 10 + Section A
      // -> classId = 25
      //
      // Existing timetable API
      // continues using this ID.

      setSelectedClass(
        String(selected.classId)
      );

    }

    else {

      setSelectedClass('');

      setPeriodSlots([]);

    }

  };

  // =========================================================
  // LOAD CLASS TIMETABLE
  // =========================================================

  useEffect(() => {

    if (
      attendanceMode ===
        'PERIOD_WISE' &&
      selectedClass
    ) {

      loadClassSettings(
        selectedClass
      );

    }

  }, [
    selectedClass,
    attendanceMode
  ]);

  // =========================================================
  // LOAD SELECTED CLASS SETTINGS
  // =========================================================

  const loadClassSettings =
    async (classId) => {

      setLoading(true);

      try {

        const r =
          await getClassAttendanceSettings(
            classId
          );

        const hasCustom =
          r.data.hasCustomSetting;

        const mode =
          hasCustom
            ? r.data.attendanceMode
            : attendanceMode;

        if (
          hasCustom &&
          allowedMode === 'BOTH'
        ) {

          setAttendanceMode(mode);

        }

        const fetchedSlots =
          r.data.slots || [];

        if (
          mode ===
          'PERIOD_WISE'
        ) {

          if (
            fetchedSlots.length > 0
          ) {

            setPeriodSlots(

              fetchedSlots.map(
                (s, idx) => ({

                  id: s.id,

                  slotNumber:
                    s.slot_number ||
                    idx + 1,

                  slotName:
                    s.slot_name ||
                    `Period ${idx + 1}`,

                  startTime:
                    (
                      s.start_time ||
                      '09:00'
                    ).slice(0, 5),

                  endTime:
                    (
                      s.end_time ||
                      '09:45'
                    ).slice(0, 5),

                  subjectName:
                    s.subject_name ||
                    '',

                  teacherId:
                    s.teacher_id ||
                    '',

                  isActive:
                    s.is_active !== false

                })
              )

            );

          }

          else {

            setPeriodSlots([]);

          }

        }

      }

      catch (err) {

        console.error(
          'Error loading class settings:',
          err
        );

        showToast(
          'Error loading settings for selected class.'
        );

      }

      setLoading(false);

    };

  // =========================================================
  // ADD NEW PERIOD
  // =========================================================

  const handleAddPeriod = () => {

    const nextNum =
      periodSlots.length + 1;

    const lastSlot =
      periodSlots[
        periodSlots.length - 1
      ];

    let start = '09:00';
    let end = '09:45';

    if (
      lastSlot &&
      lastSlot.endTime
    ) {

      start =
        lastSlot.endTime;

      const [h, m] =
        start
          .split(':')
          .map(Number);

      const totalM =
        h * 60 +
        m +
        45;

      const endH =
        String(
          Math.floor(
            totalM / 60
          ) % 24
        ).padStart(2, '0');

      const endM =
        String(
          totalM % 60
        ).padStart(2, '0');

      end =
        `${endH}:${endM}`;

    }

    setNewPeriod({

      slotName:
        `Period ${nextNum}`,

      startTime:
        start,

      endTime:
        end,

      subjectName:
        '',

      teacherId:
        '',

      isActive:
        true

    });

    setShowAddPeriodModal(
      true
    );

  };

  // =========================================================
  // CREATE NEW PERIOD
  // =========================================================

  const handleCreatePeriod = () => {

    if (
      !newPeriod.slotName.trim()
    ) {

      showToast(
        'Please enter a period name.'
      );

      return;
    }

    if (
      !newPeriod.startTime ||
      !newPeriod.endTime
    ) {

      showToast(
        'Please enter start and end time.'
      );

      return;
    }

    if (
      newPeriod.startTime >=
      newPeriod.endTime
    ) {

      showToast(
        'Start time must be earlier than end time.'
      );

      return;
    }

    const nextNum =
      periodSlots.length + 1;

    const periodToAdd = {

      slotNumber:
        nextNum,

      slotName:
        newPeriod.slotName.trim(),

      startTime:
        newPeriod.startTime,

      endTime:
        newPeriod.endTime,

      subjectName:
        newPeriod.subjectName.trim(),

      teacherId:
        newPeriod.teacherId,

      isActive:
        newPeriod.isActive

    };

    setPeriodSlots(
      prev => [
        ...prev,
        periodToAdd
      ]
    );

    setShowAddPeriodModal(
      false
    );

    // Scroll to the newly added row.
    setTimeout(() => {

      if (
        newPeriodRowRef.current
      ) {

        newPeriodRowRef.current.scrollIntoView(
          {
            behavior: 'smooth',
            block: 'center'
          }
        );

      }

    }, 150);

    showToast(
      `P${nextNum} created successfully.`
    );

  };

  // =========================================================
  // REMOVE PERIOD
  // =========================================================

  const handleRemovePeriod =
    (idx) => {

      const updated =
        periodSlots

          .filter(
            (_, i) =>
              i !== idx
          )

          .map(
            (s, i) => ({

              ...s,

              slotNumber:
                i + 1,

              slotName:
                s.slotName.startsWith(
                  'Period '
                )
                  ? `Period ${i + 1}`
                  : s.slotName

            })
          );

      setPeriodSlots(
        updated
      );

    };

  // =========================================================
  // VALIDATE TIMES
  // =========================================================

  const validateTimes =
    (slotsToValidate) => {

      for (
        let i = 0;
        i <
        slotsToValidate.length;
        i++
      ) {

        const s =
          slotsToValidate[i];

        if (
          !s.startTime ||
          !s.endTime
        ) {

          showToast(
            `Slot "${s.slotName}" missing start or end time!`
          );

          return false;

        }

        if (
          s.startTime >=
          s.endTime
        ) {

          showToast(
            `Slot "${s.slotName}" start time must be earlier than end time!`
          );

          return false;

        }

      }

      return true;

    };

  // =========================================================
  // SAVE SETTINGS
  // =========================================================

  const handleSaveSettings =
    async () => {

      setSaving(true);

      try {

        // =====================================================
        // MORNING / EVENING
        // =====================================================

        if (
          attendanceMode ===
          'MORNING_EVENING'
        ) {

          const valid =
            validateTimes([
              morningSlot,
              eveningSlot
            ]);

          if (!valid) {

            setSaving(false);

            return;

          }

          const payloadSlots = [

            {
              slotType:
                'morning',

              slotNumber:
                1,

              slotName:
                morningSlot.slotName ||
                'Morning (AM)',

              startTime:
                morningSlot.startTime,

              endTime:
                morningSlot.endTime,

              isActive:
                morningSlot.isActive

            },

            {
              slotType:
                'evening',

              slotNumber:
                2,

              slotName:
                eveningSlot.slotName ||
                'Evening (PM)',

              startTime:
                eveningSlot.startTime,

              endTime:
                eveningSlot.endTime,

              isActive:
                eveningSlot.isActive

            }

          ];

          await saveOrgDefaultTimetable({
            slots:
              payloadSlots
          });

          showToast(
            'Organisation-wide Morning & Evening Attendance times saved!'
          );

          loadOrgPermissionsAndDefaults();

        }

        // =====================================================
        // PERIOD-WISE
        // =====================================================

        else {

          if (
            !selectedBranch ||
            !selectedClassName ||
            !selectedSection ||
            !selectedClass
          ) {

            showToast(
              'Please select a Branch, Class and Section first!'
            );

            setSaving(false);

            return;

          }

          const valid =
            validateTimes(
              periodSlots
            );

          if (!valid) {

            setSaving(false);

            return;

          }

          const payloadSlots =
            periodSlots.map(
              (p, i) => ({

                slotType:
                  'period',

                slotNumber:
                  i + 1,

                slotName:
                  p.slotName ||
                  `Period ${i + 1}`,

                startTime:
                  p.startTime,

                endTime:
                  p.endTime,

                subjectName:
                  p.subjectName,

                teacherId:
                  p.teacherId
                    ? parseInt(
                        p.teacherId
                      )
                    : null,

                isActive:
                  p.isActive !== false

              })
            );

          await saveClassAttendanceSettings(

            selectedClass,

            {
              attendanceMode:
                'PERIOD_WISE',

              slots:
                payloadSlots

            }

          );

          showToast(
            'Period-wise Timetable for Class & Section saved successfully!'
          );

          loadClassSettings(
            selectedClass
          );

        }

      }

      catch (err) {

        console.error(
          'Save timetable error:',
          err
        );

        showToast(

          err.response?.data?.message ||
          'Failed to save configuration.'

        );

      }

      setSaving(false);

    };

  // =========================================================
  // ACCESS DENIED
  // =========================================================

  if (
    !hasTimetableAccess
  ) {

    return (

      <Layout
        title="Timetable & Attendance Setup"
        subtitle="Access Control"
      >

        <div
          className="card"
          style={{
            padding: 48,
            textAlign: 'center'
          }}
        >

          <div
            style={{
              fontSize: 56,
              marginBottom: 16
            }}
          >
            <MdAccessTime />
          </div>

          <h2
            style={{
              marginBottom: 8,
              color: '#ef4444'
            }}
          >
            Access Disabled by Super Admin
          </h2>

          <p
            style={{
              color:
                'var(--text-muted)',
              fontSize: 15,
              maxWidth: 500,
              margin:
                '0 auto 24px auto'
            }}
          >
            Timetable & Attendance Setup
            access has been disabled for
            this organisation by the
            Super Administrator.
          </p>

          <button
            className="btn btn-primary"
            onClick={() =>
              window.location.href =
                '/dashboard'
            }
          >
            Return to Dashboard
          </button>

        </div>

      </Layout>

    );

  }

  // =========================================================
  // MAIN UI
  // =========================================================

  return (

    <Layout
      title="Timetable & Attendance Setup"
      subtitle="Configure Attendance Mode (Morning/Evening vs Period-wise Subject Timetable)"
      headerRight={

        <button
          className="btn btn-primary"
          onClick={
            handleSaveSettings
          }
          disabled={saving}
        >

          <MdSave />

          {saving

            ? 'Saving...'

            : attendanceMode ===
              'MORNING_EVENING'

              ? 'Save Morning & Evening Times'

              : 'Save Class Period Timetable'

          }

        </button>

      }
    >

      {/* =====================================================
          TOAST
      ====================================================== */}

      {toast && (

        <div className="alert alert-success">
          <MdCheckCircle style={{ verticalAlign: 'middle', marginRight: 6 }} /> {toast}
        </div>

      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 24
        }}
      >

        {/* ===================================================
            STEP 1: ATTENDANCE MODE
        ==================================================== */}

        <div
          className="card"
          style={{
            padding: 24
          }}
        >

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 16
            }}
          >

            <div
              style={{
                background:
                  'var(--primary)',
                color: '#fff',
                width: 28,
                height: 28,
                borderRadius: '50%',
                display: 'flex',
                alignItems:
                  'center',
                justifyContent:
                  'center',
                fontWeight: 700,
                fontSize: 14
              }}
            >
              1
            </div>

            <h3
              style={{
                margin: 0,
                fontSize: 17
              }}
            >
              Attendance Mode Configuration
            </h3>

          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16
            }}
          >

            {/* =================================================
                MORNING / EVENING
            ================================================== */}

            {(
              allowedMode === 'BOTH' ||
              allowedMode ===
                'MORNING_EVENING'
            ) && (

              <div
                onClick={() => {

                  if (
                    allowedMode ===
                    'BOTH'
                  ) {

                    setAttendanceMode(
                      'MORNING_EVENING'
                    );

                    setSelectedClass(
                      ''
                    );

                    setSelectedClassName(
                      ''
                    );

                    setSelectedSection(
                      ''
                    );

                  }

                }}
                style={{
                  border:
                    `2px solid ${
                      attendanceMode ===
                      'MORNING_EVENING'
                        ? 'var(--primary)'
                        : 'var(--border)'
                    }`,

                  background:
                    attendanceMode ===
                    'MORNING_EVENING'
                      ? 'rgba(2,132,199,0.04)'
                      : 'var(--card-bg)',

                  borderRadius: 12,

                  padding: 20,

                  cursor:
                    allowedMode ===
                    'BOTH'
                      ? 'pointer'
                      : 'default',

                  transition:
                    'all 0.2s'
                }}
              >

                <div
                  style={{
                    display:
                      'flex',
                    justifyContent:
                      'space-between',
                    alignItems:
                      'center',
                    marginBottom:
                      10
                  }}
                >

                  <div
                    style={{
                      display:
                        'flex',
                      alignItems:
                        'center',
                      gap: 10,
                      fontWeight:
                        700,
                      fontSize: 16,

                      color:
                        attendanceMode ===
                        'MORNING_EVENING'
                          ? 'var(--primary)'
                          : 'var(--text-main)'
                    }}
                  >
                    <MdAccessTime style={{ verticalAlign: 'middle' }} /> Morning & Evening Mode
                    (AM / PM)
                  </div>

                  <input
                    type="radio"
                    checked={
                      attendanceMode ===
                      'MORNING_EVENING'
                    }
                    readOnly
                  />

                </div>

                <p
                  style={{
                    fontSize: 13,
                    color:
                      'var(--text-muted)',
                    margin: 0,
                    lineHeight: 1.5
                  }}
                >
                  Attendance is taken
                  twice a day
                  (Morning &
                  Evening
                  sessions).
                  Applies
                  organisation-wide
                  for all
                  classes.
                </p>

                <div
                  style={{
                    marginTop: 12,
                    display:
                      'inline-flex',
                    gap: 6,
                    padding:
                      '4px 10px',
                    background:
                      '#dcfce7',
                    color:
                      '#15803d',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600
                  }}
                >
                  Organisation-Wide
                  (AM / PM Sessions)
                </div>

              </div>

            )}

            {/* =================================================
                PERIOD-WISE
            ================================================== */}

            {(
              allowedMode === 'BOTH' ||
              allowedMode ===
                'PERIOD_WISE'
            ) && (

              <div
                onClick={() => {

                  if (
                    allowedMode ===
                    'BOTH'
                  ) {

                    setAttendanceMode(
                      'PERIOD_WISE'
                    );

                  }

                }}
                style={{
                  border:
                    `2px solid ${
                      attendanceMode ===
                      'PERIOD_WISE'
                        ? 'var(--primary)'
                        : 'var(--border)'
                    }`,

                  background:
                    attendanceMode ===
                    'PERIOD_WISE'
                      ? 'rgba(2,132,199,0.04)'
                      : 'var(--card-bg)',

                  borderRadius: 12,

                  padding: 20,

                  cursor:
                    allowedMode ===
                    'BOTH'
                      ? 'pointer'
                      : 'default',

                  transition:
                    'all 0.2s'
                }}
              >

                <div
                  style={{
                    display:
                      'flex',
                    justifyContent:
                      'space-between',
                    alignItems:
                      'center',
                    marginBottom:
                      10
                  }}
                >

                  <div
                    style={{
                      display:
                        'flex',
                      alignItems:
                        'center',
                      gap: 10,
                      fontWeight:
                        700,
                      fontSize: 16,

                      color:
                        attendanceMode ===
                        'PERIOD_WISE'
                          ? 'var(--primary)'
                          : 'var(--text-main)'
                    }}
                  >
                    <MdClass style={{ verticalAlign: 'middle' }} /> Period-wise
                    (Subject)
                    Mode
                  </div>

                  <input
                    type="radio"
                    checked={
                      attendanceMode ===
                      'PERIOD_WISE'
                    }
                    readOnly
                  />

                </div>

                <p
                  style={{
                    fontSize: 13,
                    color:
                      'var(--text-muted)',
                    margin: 0,
                    lineHeight: 1.5
                  }}
                >
                  Attendance is taken
                  period-by-period
                  for specific
                  subjects and
                  assigned
                  teachers per
                  Class/Section.
                </p>

                <div
                  style={{
                    marginTop: 12,
                    display:
                      'inline-flex',
                    gap: 6,
                    padding:
                      '4px 10px',
                    background:
                      '#e0f2fe',
                    color:
                      '#0369a1',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600
                  }}
                >
                  Class-Specific Subject Timetable
                </div>

              </div>

            )}

          </div>

        </div>

        {/* ===================================================
            MORNING / EVENING MODE
        ==================================================== */}

        {attendanceMode ===
          'MORNING_EVENING' && (

          <div
            className="card"
            style={{
              padding: 24
            }}
          >

            <div
              style={{
                display:
                  'flex',
                alignItems:
                  'center',
                gap: 10,
                marginBottom:
                  16
              }}
            >

              <div
                style={{
                  background:
                    'var(--primary)',
                  color: '#fff',
                  width: 28,
                  height: 28,
                  borderRadius:
                    '50%',
                  display:
                    'flex',
                  alignItems:
                    'center',
                  justifyContent:
                    'center',
                  fontWeight: 700,
                  fontSize: 14
                }}
              >
                2
              </div>

              <h3
                style={{
                  margin: 0,
                  fontSize: 17
                }}
              >
                Configure Organisation Morning & Evening Session Times
              </h3>

            </div>

            <p
              style={{
                fontSize: 13,
                color:
                  'var(--text-muted)',
                marginBottom:
                  20
              }}
            >
              These morning and
              evening attendance
              session times apply
              to all classes
              across the
              organisation on the
              mobile app.
            </p>

            <div
              style={{
                display:
                  'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(320px, 1fr))',
                gap: 20
              }}
            >

              {/* MORNING */}

              <div
                style={{
                  background:
                    'var(--bg)',
                  padding: 20,
                  border:
                    '1px solid var(--border)',
                  borderRadius: 10
                }}
              >

                <div
                  style={{
                    display:
                      'flex',
                    alignItems:
                      'center',
                    gap: 8,
                    fontWeight:
                      700,
                    fontSize: 15,
                    color:
                      '#0284c7',
                    marginBottom:
                      14
                  }}
                >
                  <MdAccessTime />
                  Morning Session (AM)
                </div>

                <div className="form-group">

                  <label>
                    Slot Label Name
                  </label>

                  <input
                    className="input"
                    value={
                      morningSlot.slotName
                    }
                    onChange={e =>
                      setMorningSlot(
                        prev => ({
                          ...prev,
                          slotName:
                            e.target.value
                        })
                      )
                    }
                  />

                </div>

                <div
                  style={{
                    display:
                      'grid',
                    gridTemplateColumns:
                      '1fr 1fr',
                    gap: 12
                  }}
                >

                  <div
                    className="form-group"
                  >

                    <label>
                      Start Time
                    </label>

                    <input
                      type="time"
                      className="input"
                      value={
                        morningSlot.startTime
                      }
                      onChange={e =>
                        setMorningSlot(
                          prev => ({
                            ...prev,
                            startTime:
                              e.target.value
                          })
                        )
                      }
                    />

                  </div>

                  <div
                    className="form-group"
                  >

                    <label>
                      End Time
                    </label>

                    <input
                      type="time"
                      className="input"
                      value={
                        morningSlot.endTime
                      }
                      onChange={e =>
                        setMorningSlot(
                          prev => ({
                            ...prev,
                            endTime:
                              e.target.value
                          })
                        )
                      }
                    />

                  </div>

                </div>

              </div>

              {/* EVENING */}

              <div
                style={{
                  background:
                    'var(--bg)',
                  padding: 20,
                  border:
                    '1px solid var(--border)',
                  borderRadius: 10
                }}
              >

                <div
                  style={{
                    display:
                      'flex',
                    alignItems:
                      'center',
                    gap: 8,
                    fontWeight:
                      700,
                    fontSize: 15,
                    color:
                      '#7c3aed',
                    marginBottom:
                      14
                  }}
                >
                  <MdAccessTime />
                  Evening Session (PM)
                </div>

                <div className="form-group">

                  <label>
                    Slot Label Name
                  </label>

                  <input
                    className="input"
                    value={
                      eveningSlot.slotName
                    }
                    onChange={e =>
                      setEveningSlot(
                        prev => ({
                          ...prev,
                          slotName:
                            e.target.value
                        })
                      )
                    }
                  />

                </div>

                <div
                  style={{
                    display:
                      'grid',
                    gridTemplateColumns:
                      '1fr 1fr',
                    gap: 12
                  }}
                >

                  <div
                    className="form-group"
                  >

                    <label>
                      Start Time
                    </label>

                    <input
                      type="time"
                      className="input"
                      value={
                        eveningSlot.startTime
                      }
                      onChange={e =>
                        setEveningSlot(
                          prev => ({
                            ...prev,
                            startTime:
                              e.target.value
                          })
                        )
                      }
                    />

                  </div>

                  <div
                    className="form-group"
                  >

                    <label>
                      End Time
                    </label>

                    <input
                      type="time"
                      className="input"
                      value={
                        eveningSlot.endTime
                      }
                      onChange={e =>
                        setEveningSlot(
                          prev => ({
                            ...prev,
                            endTime:
                              e.target.value
                          })
                        )
                      }
                    />

                  </div>

                </div>

              </div>

            </div>

          </div>

        )}

        {/* ===================================================
            PERIOD-WISE MODE
        ==================================================== */}

        {attendanceMode ===
          'PERIOD_WISE' && (

          <div
            style={{
              display:
                'flex',
              flexDirection:
                'column',
              gap: 24
            }}
          >

            {/* =================================================
                CLASS / SECTION SELECTOR
            ================================================== */}

            <div
              className="card"
              style={{
                padding: 20
              }}
            >

              <div
                style={{
                  display:
                    'flex',
                  gap: 16,
                  alignItems:
                    'flex-end',
                  flexWrap:
                    'wrap'
                }}
              >

                {/* LABEL */}

                <div
                  style={{
                    fontWeight:
                      600,
                    fontSize: 14,
                    color:
                      'var(--text-secondary)',
                    display:
                      'flex',
                    alignItems:
                      'center',
                    gap: 6,
                    paddingBottom:
                      8
                  }}
                >

                  <MdFilterList />

                  Select Class & Section
                  for Period Timetable:

                </div>

                {/* =================================================
                    BRANCH
                ================================================== */}

                <div
                  className="form-group"
                  style={{
                    margin: 0,
                    minWidth: 220
                  }}
                >

                  <label
                    style={{
                      fontSize: 12,
                      marginBottom: 4
                    }}
                  >
                    Branch
                  </label>

                  <select
                    className="input"
                    style={{
                      width: 220
                    }}
                    value={
                      selectedBranch
                    }
                    onChange={e =>
                      setSelectedBranch(
                        e.target.value
                      )
                    }
                  >

                    {!isDedicatedBranchUser() && <option value="">Select Branch</option>}

                    {branches.map(
                      b => (

                        <option
                          key={b.id}
                          value={b.id}
                        >
                          {b.name}
                        </option>

                      )
                    )}

                  </select>

                </div>

                {/* =================================================
                    CLASS
                ================================================== */}

                <div
                  className="form-group"
                  style={{
                    margin: 0,
                    minWidth: 220
                  }}
                >

                  <label
                    style={{
                      fontSize: 12,
                      marginBottom: 4
                    }}
                  >
                    Class
                  </label>

                  <select
                    className="input"
                    style={{
                      width: 220
                    }}
                    value={
                      selectedClassName
                    }
                    onChange={e =>
                      handleClassChange(
                        e.target.value
                      )
                    }
                    disabled={
                      !selectedBranch
                    }
                  >

                    <option value="">
                      Select Class
                    </option>

                    {classOptions.map(
                      c => (

                        <option
                          key={
                            c.className
                          }
                          value={
                            c.className
                          }
                        >
                          {c.className}
                        </option>

                      )
                    )}

                  </select>

                </div>

                {/* =================================================
                    SECTION
                ================================================== */}

                <div
                  className="form-group"
                  style={{
                    margin: 0,
                    minWidth: 180
                  }}
                >

                  <label
                    style={{
                      fontSize: 12,
                      marginBottom: 4
                    }}
                  >
                    Section
                  </label>

                  <select
                    className="input"
                    style={{
                      width: 180
                    }}
                    value={
                      selectedSection
                    }
                    onChange={e =>
                      handleSectionChange(
                        e.target.value
                      )
                    }
                    disabled={
                      !selectedClassName
                    }
                  >

                    <option value="">
                      Select Section
                    </option>

                    {(
                      sectionsByClass[
                        selectedClassName
                      ] || []
                    ).map(
                      item => (

                        <option
                          key={
                            `${selectedClassName}-${item.section}-${item.classId}`
                          }
                          value={
                            item.section
                          }
                        >
                          {item.section}
                        </option>

                      )
                    )}

                  </select>

                </div>

                {/* =================================================
                    SELECTED CLASS DISPLAY
                ================================================== */}

                {selectedClass &&
                  selectedSection && (

                    <div
                      style={{
                        marginLeft:
                          'auto',

                        display:
                          'flex',

                        alignItems:
                          'center',

                        gap: 8,

                        background:
                          'rgba(139,92,246,0.1)',

                        padding:
                          '8px 14px',

                        borderRadius: 8,

                        color:
                          '#7c3aed',

                        fontWeight:
                          600,

                        fontSize: 13
                      }}
                    >

                      <MdClass />

                      {selectedClassName}
                      {' - Section '}
                      {selectedSection}

                    </div>

                  )}

              </div>

            </div>

            {/* =================================================
                NO CLASS / SECTION
            ================================================== */}

            {!selectedClass ? (

              <div
                className="card"
                style={{
                  padding: 48,
                  textAlign:
                    'center'
                }}
              >

                <div
                  style={{
                    fontSize: 48,
                    marginBottom: 12
                  }}
                >
                  <MdClass />
                </div>

                <h3
                  style={{
                    marginBottom: 6
                  }}
                >
                  Select a Branch, Class & Section
                </h3>

                <p
                  style={{
                    color:
                      'var(--text-muted)',
                    fontSize: 14
                  }}
                >
                  Choose a Branch,
                  Class, and Section
                  above to create and
                  manage its
                  period-by-period
                  subject timetable.
                </p>

              </div>

            ) : loading ? (

              <div className="loading-overlay">

                <div className="spinner" />

                Loading period timetable...

              </div>

            ) : (

              /* =================================================
                 TIMETABLE TABLE
              ================================================== */

              <div
                className="card"
                style={{
                  padding: 24
                }}
              >

                {/* TABLE HEADER */}

                <div
                  style={{
                    display:
                      'flex',
                    justifyContent:
                      'space-between',
                    alignItems:
                      'center',
                    marginBottom:
                      16
                  }}
                >

                  <div>

                    <h3
                      style={{
                        margin: 0,
                        fontSize: 17
                      }}
                    >
                      Configure Period Timetable & Subjects
                    </h3>

                    <p
                      style={{
                        fontSize: 13,
                        color:
                          'var(--text-muted)',
                        margin:
                          '4px 0 0 0'
                      }}
                    >
                      Add, edit, or remove
                      period slots. The
                      mobile app will
                      display these exact
                      periods for teachers
                      of this class and
                      section.
                    </p>

                  </div>

                  {/* ADD NEW PERIOD */}

                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={
                      handleAddPeriod
                    }
                  >

                    <MdAdd />

                    Add New Period

                  </button>

                </div>

                {/* =================================================
                    TABLE
                ================================================== */}

                <div className="table-container">

                  <table>

                    <thead>

                      <tr>

                        <th
                          style={{
                            width: 80
                          }}
                        >
                          Period #
                        </th>

                        <th
                          style={{
                            minWidth: 140
                          }}
                        >
                          Period Name
                        </th>

                        <th
                          style={{
                            width: 120
                          }}
                        >
                          Start Time
                        </th>

                        <th
                          style={{
                            width: 120
                          }}
                        >
                          End Time
                        </th>

                        <th
                          style={{
                            minWidth: 160
                          }}
                        >
                          Subject Name
                        </th>

                        <th
                          style={{
                            minWidth: 180
                          }}
                        >
                          Assigned Teacher
                        </th>

                        <th
                          style={{
                            width: 90
                          }}
                        >
                          Status
                        </th>

                        <th
                          style={{
                            width: 60,
                            textAlign:
                              'center'
                          }}
                        >
                          Action
                        </th>

                      </tr>

                    </thead>

                    <tbody>

                      {/* NO PERIODS */}

                      {periodSlots.length ===
                      0 ? (

                        <tr>

                          <td
                            colSpan="8"
                            style={{
                              textAlign:
                                'center',
                              padding:
                                '36px 16px',
                              color:
                                'var(--text-muted)'
                            }}
                          >

                            No period slots
                            created for this
                            class yet.

                            Click

                            <strong>
                              {' '}
                              + Add New Period{' '}
                            </strong>

                            above to create
                            your first period.

                          </td>

                        </tr>

                      ) : (

                        periodSlots.map(
                          (p, idx) => (

                            <tr
                              key={
                                p.id ||
                                `${p.slotNumber}-${idx}`
                              }

                              ref={
                                idx ===
                                periodSlots.length -
                                  1
                                  ? newPeriodRowRef
                                  : null
                              }
                            >

                              {/* PERIOD NUMBER */}

                              <td
                                style={{
                                  fontWeight:
                                    700,
                                  textAlign:
                                    'center',
                                  fontSize:
                                    14,
                                  color:
                                    '#0284c7'
                                }}
                              >
                                P
                                {
                                  p.slotNumber
                                }
                              </td>

                              {/* PERIOD NAME */}

                              <td>

                                <input
                                  className="input"
                                  style={{
                                    padding:
                                      '6px 8px',
                                    fontSize:
                                      13
                                  }}
                                  value={
                                    p.slotName
                                  }
                                  onChange={
                                    e => {

                                      const newP =
                                        [
                                          ...periodSlots
                                        ];

                                      newP[idx] =
                                        {
                                          ...newP[
                                            idx
                                          ],

                                          slotName:
                                            e
                                              .target
                                              .value
                                        };

                                      setPeriodSlots(
                                        newP
                                      );

                                    }
                                  }
                                />

                              </td>

                              {/* START TIME */}

                              <td>

                                <input
                                  type="time"
                                  className="input"
                                  style={{
                                    padding:
                                      '6px 8px',
                                    fontSize:
                                      13
                                  }}
                                  value={
                                    p.startTime
                                  }
                                  onChange={
                                    e => {

                                      const newP =
                                        [
                                          ...periodSlots
                                        ];

                                      newP[idx] =
                                        {
                                          ...newP[
                                            idx
                                          ],

                                          startTime:
                                            e
                                              .target
                                              .value
                                        };

                                      setPeriodSlots(
                                        newP
                                      );

                                    }
                                  }
                                />

                              </td>

                              {/* END TIME */}

                              <td>

                                <input
                                  type="time"
                                  className="input"
                                  style={{
                                    padding:
                                      '6px 8px',
                                    fontSize:
                                      13
                                  }}
                                  value={
                                    p.endTime
                                  }
                                  onChange={
                                    e => {

                                      const newP =
                                        [
                                          ...periodSlots
                                        ];

                                      newP[idx] =
                                        {
                                          ...newP[
                                            idx
                                          ],

                                          endTime:
                                            e
                                              .target
                                              .value
                                        };

                                      setPeriodSlots(
                                        newP
                                      );

                                    }
                                  }
                                />

                              </td>

                              {/* SUBJECT */}

                              <td>

                                <input
                                  className="input"
                                  placeholder="e.g. Mathematics"
                                  style={{
                                    padding:
                                      '6px 8px',
                                    fontSize:
                                      13
                                  }}
                                  value={
                                    p.subjectName
                                  }
                                  onChange={
                                    e => {

                                      const newP =
                                        [
                                          ...periodSlots
                                        ];

                                      newP[idx] =
                                        {
                                          ...newP[
                                            idx
                                          ],

                                          subjectName:
                                            e
                                              .target
                                              .value
                                        };

                                      setPeriodSlots(
                                        newP
                                      );

                                    }
                                  }
                                />

                              </td>

                              {/* TEACHER */}

                              <td>

                                <select
                                  className="input"
                                  style={{
                                    padding:
                                      '6px 8px',
                                    fontSize:
                                      13
                                  }}
                                  value={
                                    p.teacherId ||
                                    ''
                                  }
                                  onChange={
                                    e => {

                                      const newP =
                                        [
                                          ...periodSlots
                                        ];

                                      newP[idx] =
                                        {
                                          ...newP[
                                            idx
                                          ],

                                          teacherId:
                                            e
                                              .target
                                              .value
                                        };

                                      setPeriodSlots(
                                        newP
                                      );

                                    }
                                  }
                                >

                                  <option value="">
                                    Assign Teacher
                                    (Optional)
                                  </option>

                                  {staffList.map(
                                    s => (

                                      <option
                                        key={
                                          s.id
                                        }
                                        value={
                                          s.id
                                        }
                                      >
                                        {
                                          s.full_name
                                        }

                                        {' '}

                                        (
                                        {
                                          s.staff_id ||
                                          s.id
                                        }
                                        )

                                      </option>

                                    )
                                  )}

                                </select>

                              </td>

                              {/* STATUS */}

                              <td>

                                <button
                                  className={`btn btn-sm ${
                                    p.isActive
                                      ? 'btn-success'
                                      : 'btn-secondary'
                                  }`}
                                  onClick={() => {

                                    const newP =
                                      [
                                        ...periodSlots
                                      ];

                                    newP[idx] =
                                      {
                                        ...newP[
                                          idx
                                        ],

                                        isActive:
                                          !newP[
                                            idx
                                          ]
                                            .isActive
                                      };

                                    setPeriodSlots(
                                      newP
                                    );

                                  }}
                                  style={{
                                    padding:
                                      '3px 8px',
                                    fontSize:
                                      11
                                  }}
                                >

                                  {p.isActive
                                    ? 'Active'
                                    : 'Inactive'}

                                </button>

                              </td>

                              {/* DELETE */}

                              <td
                                style={{
                                  textAlign:
                                    'center'
                                }}
                              >

                                <button
                                  className="btn btn-sm btn-danger"
                                  onClick={() =>
                                    handleRemovePeriod(
                                      idx
                                    )
                                  }
                                  title="Delete Period"
                                >

                                  <MdDelete
                                    size={14}
                                  />

                                </button>

                              </td>

                            </tr>

                          )
                        )

                      )}

                    </tbody>

                  </table>

                </div>

              </div>

            )}

          </div>

        )}

      </div>

      {/* =====================================================
          ADD NEW PERIOD MODAL
      ====================================================== */}

      {showAddPeriodModal && (

        <div
          style={{
            position:
              'fixed',
            inset: 0,
            background:
              'rgba(15, 23, 42, 0.55)',
            display:
              'flex',
            alignItems:
              'center',
            justifyContent:
              'center',
            zIndex: 9999,
            padding: 20
          }}

          onClick={() =>
            setShowAddPeriodModal(
              false
            )
          }
        >

          {/* MODAL BOX */}

          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 560,
              maxHeight:
                '90vh',
              overflowY:
                'auto',
              padding: 28,
              borderRadius:
                16,
              boxShadow:
                '0 25px 60px rgba(0,0,0,0.25)',
              background:
                'var(--card-bg)'
            }}

            onClick={e =>
              e.stopPropagation()
            }
          >

            {/* HEADER */}

            <div
              style={{
                display:
                  'flex',
                justifyContent:
                  'space-between',
                alignItems:
                  'center',
                marginBottom:
                  22
              }}
            >

              <div>

                <h2
                  style={{
                    margin: 0,
                    fontSize: 20,
                    fontWeight:
                      700
                  }}
                >
                  Add New Period
                </h2>

                <p
                  style={{
                    margin:
                      '5px 0 0',
                    fontSize: 13,
                    color:
                      'var(--text-muted)'
                  }}
                >
                  Create a new
                  period for
                  this class
                  timetable.
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  setShowAddPeriodModal(
                    false
                  )
                }
                style={{
                  border:
                    'none',
                  background:
                    'transparent',
                  fontSize:
                    28,
                  cursor:
                    'pointer',
                  color:
                    'var(--text-muted)',
                  lineHeight:
                    1
                }}
              >
                ×
              </button>

            </div>

            {/* PERIOD NAME */}

            <div className="form-group">

              <label>
                Period Name
              </label>

              <input
                className="input"
                value={
                  newPeriod.slotName
                }
                onChange={e =>
                  setNewPeriod(
                    prev => ({
                      ...prev,
                      slotName:
                        e.target
                          .value
                    })
                  )
                }
                placeholder="e.g. Period 8"
              />

            </div>

            {/* START / END */}

            <div
              style={{
                display:
                  'grid',
                gridTemplateColumns:
                  '1fr 1fr',
                gap: 14
              }}
            >

              <div
                className="form-group"
              >

                <label>
                  Start Time
                </label>

                <input
                  type="time"
                  className="input"
                  value={
                    newPeriod.startTime
                  }
                  onChange={e =>
                    setNewPeriod(
                      prev => ({
                        ...prev,
                        startTime:
                          e.target
                            .value
                      })
                    )
                  }
                />

              </div>

              <div
                className="form-group"
              >

                <label>
                  End Time
                </label>

                <input
                  type="time"
                  className="input"
                  value={
                    newPeriod.endTime
                  }
                  onChange={e =>
                    setNewPeriod(
                      prev => ({
                        ...prev,
                        endTime:
                          e.target
                            .value
                      })
                    )
                  }
                />

              </div>

            </div>

            {/* SUBJECT */}

            <div className="form-group">

              <label>
                Subject Name
              </label>

              <input
                className="input"
                value={
                  newPeriod.subjectName
                }
                onChange={e =>
                  setNewPeriod(
                    prev => ({
                      ...prev,
                      subjectName:
                        e.target
                          .value
                    })
                  )
                }
                placeholder="e.g. Mathematics"
              />

            </div>

            {/* TEACHER */}

            <div className="form-group">

              <label>
                Assigned Teacher
              </label>

              <select
                className="input"
                value={
                  newPeriod.teacherId
                }
                onChange={e =>
                  setNewPeriod(
                    prev => ({
                      ...prev,
                      teacherId:
                        e.target
                          .value
                    })
                  )
                }
              >

                <option value="">
                  Assign Teacher
                  (Optional)
                </option>

                {staffList.map(
                  s => (

                    <option
                      key={s.id}
                      value={s.id}
                    >
                      {
                        s.full_name
                      }

                      {' '}

                      (
                      {
                        s.staff_id ||
                        s.id
                      }
                      )

                    </option>

                  )
                )}

              </select>

            </div>

            {/* ACTIVE */}

            <div
              style={{
                display:
                  'flex',
                alignItems:
                  'center',
                gap: 10,
                marginTop:
                  12,
                marginBottom:
                  24
              }}
            >

              <input
                type="checkbox"
                checked={
                  newPeriod.isActive
                }
                onChange={e =>
                  setNewPeriod(
                    prev => ({
                      ...prev,
                      isActive:
                        e.target
                          .checked
                    })
                  )
                }
              />

              <label
                style={{
                  margin: 0,
                  fontSize: 14
                }}
              >
                Active Period
              </label>

            </div>

            {/* BUTTONS */}

            <div
              style={{
                display:
                  'flex',
                justifyContent:
                  'flex-end',
                gap: 10,
                paddingTop:
                  18,
                borderTop:
                  '1px solid var(--border)'
              }}
            >

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  setShowAddPeriodModal(
                    false
                  )
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={
                  handleCreatePeriod
                }
              >

                <MdAdd />

                Create Period

              </button>

            </div>

          </div>

        </div>

      )}

    </Layout>

  );

}
