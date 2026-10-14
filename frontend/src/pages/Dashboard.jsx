import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import ClassSectionSelect from '../components/ClassSectionSelect';
import {
  getDashboardStats,
  getDashboardAttendance,
  getRecentNotices,
  getBranches,
  getClasses
} from '../api';

import {
  MdPeople,
  MdSchool,
  MdBusiness,
  MdPerson,
  MdAdminPanelSettings,
  MdCategory,
  MdEventNote,
  MdAnnouncement,
  MdSearch,
  MdCalendarToday,
  MdTrendingUp
} from 'react-icons/md';

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts';

import { format } from 'date-fns';

import {
  filterBranches,
  getBranchScope,
  isDedicatedBranchUser
} from '../utils/branchScope';


const COLORS = ['#10b981', '#ef4444', '#f59e0b'];


export default function Dashboard() {

  const [stats, setStats] = useState(null);

  const [attendance, setAttendance] = useState({
    records: [],
    summary: {}
  });

  const [notices, setNotices] = useState([]);

  const [branches, setBranches] = useState([]);
  const [classes, setClasses] = useState([]);

  const [loading, setLoading] = useState(true);

  const [attType, setAttType] = useState('student');

  const [selectedBranch, setSelectedBranch] = useState(
    getBranchScope
  );

  const [selectedClass, setSelectedClass] = useState('');

  const [selectedDate, setSelectedDate] = useState(
    format(new Date(), 'yyyy-MM-dd')
  );

  const [searchTerm, setSearchTerm] = useState('');


  /* ---------------- INITIAL DATA ---------------- */

  useEffect(() => {
    fetchInit();
  }, []);


  /* ---------------- ATTENDANCE ---------------- */

  useEffect(() => {
    fetchAttendance();
  }, [
    attType,
    selectedBranch,
    selectedClass,
    selectedDate
  ]);


  const fetchInit = async () => {

    try {

      const [
        statsResponse,
        branchesResponse,
        noticesResponse
      ] = await Promise.all([
        getDashboardStats(),
        getBranches(),
        getRecentNotices()
      ]);

      setStats(statsResponse.data.stats);

      setBranches(
        filterBranches(
          branchesResponse.data.branches || []
        )
      );

      setNotices(
        noticesResponse.data.notices || []
      );

    } catch (error) {

      console.error(
        'Failed to load dashboard:',
        error
      );

    }

    setLoading(false);
  };


  const fetchAttendance = async () => {

    try {

      const params = {
        type: attType,
        date: selectedDate
      };

      if (selectedBranch) {
        params.branch_id = selectedBranch;
      }

      if (
        selectedClass &&
        attType === 'student'
      ) {
        params.class_id = selectedClass;
      }

      const response =
        await getDashboardAttendance(params);

      setAttendance(
        response.data
      );

    } catch (error) {

      console.error(
        'Failed to load attendance:',
        error
      );

    }
  };


  /* ---------------- CLASSES ---------------- */

  useEffect(() => {

    if (selectedBranch) {

      getClasses({
        branch_id: selectedBranch
      })
        .then(response => {

          setClasses(
            response.data.classes || []
          );

        })
        .catch(() => {

          setClasses([]);

        });

    } else {

      setClasses([]);

      setSelectedClass('');

    }

  }, [selectedBranch]);


  /* ---------------- STAT CARDS ---------------- */

  const statCards = stats
    ? [

        {
          label: 'Total Students',
          value: stats.total_students,
          icon: <MdSchool />,
          className: 'blue'
        },

        {
          label: 'Teaching Staff',
          value: stats.teaching_staff,
          icon: <MdPeople />,
          className: 'green'
        },

        {
          label: 'Non-Teaching',
          value: stats.non_teaching_staff,
          icon: <MdPerson />,
          className: 'yellow'
        },

        {
          label: 'Management',
          value: stats.management_staff,
          icon: <MdAdminPanelSettings />,
          className: 'purple'
        },

        {
          label: 'Total Staff',
          value: stats.total_staff,
          icon: <MdPeople />,
          className: 'orange'
        },

        {
          label: 'Admin Users',
          value: stats.total_admins,
          icon: <MdAdminPanelSettings />,
          className: 'red'
        },

        {
          label: 'Classes',
          value: stats.total_classes,
          icon: <MdCategory />,
          className: 'teal'
        },

        {
          label: 'Branches',
          value: stats.total_branches,
          icon: <MdBusiness />,
          className: 'indigo'
        }

      ]
    : [];


  /* ---------------- ATTENDANCE SUMMARY ---------------- */

  const summary =
    attendance.summary || {};


  const pieData = [

    {
      name: 'Present',
      value: summary.present || 0
    },

    {
      name: 'Absent',
      value: summary.absent || 0
    },

    {
      name: 'Late',
      value: summary.late || 0
    }

  ].filter(
    item => item.value > 0
  );


  /* ---------------- SEARCH ---------------- */

  const filteredRecords =
    (attendance.records || []).filter(record => {

      if (!searchTerm.trim()) {
        return true;
      }

      const search =
        searchTerm.toLowerCase();

      return (

        String(record.full_name || '')
          .toLowerCase()
          .includes(search)

        ||

        String(
          record.admission_no ||
          record.staff_id ||
          ''
        )
          .toLowerCase()
          .includes(search)

        ||

        String(
          record.class_name ||
          record.role_type ||
          ''
        )
          .toLowerCase()
          .includes(search)

        ||

        String(
          record.branch_name || ''
        )
          .toLowerCase()
          .includes(search)

      );

    });


  /* ---------------- LOADING ---------------- */

  if (loading) {

    return (

      <Layout title="Dashboard">

        <div className="loading-overlay">

          <div className="spinner" />

          Loading dashboard...

        </div>

      </Layout>

    );

  }


  /* ---------------- UI ---------------- */

  return (

    <Layout
      title="Dashboard"
      subtitle={`Today: ${format(
        new Date(),
        'EEEE, MMMM d yyyy'
      )}`}
    >

      <div className="dashboard-page">


        {/* =====================================================
            STATISTICS
        ===================================================== */}

        <div className="stats-grid dashboard-stats-grid">

          {statCards.map(card => (

            <div
              key={card.label}
              className={`stat-card dashboard-stat-card ${card.className}`}
            >

              <div className="stat-icon">

                {card.icon}

              </div>

              <div className="stat-info">

                <div className="stat-value">

                  {card.value ?? 0}

                </div>

                <div className="stat-label">

                  {card.label}

                </div>

              </div>

            </div>

          ))}

        </div>



        {/* =====================================================
            MAIN DASHBOARD GRID
        ===================================================== */}

        <div className="dashboard-main-grid">


          {/* =================================================
              LEFT SIDE
          ================================================= */}

          <div className="dashboard-attendance-card card">


            {/* HEADER */}

            <div className="dashboard-attendance-header">

              <div>

                <div className="dashboard-attendance-title">

                  <div className="dashboard-title-icon">

                    <MdEventNote />

                  </div>

                  <div>

                    <h2>
                      Today's Attendance
                    </h2>

                    <p>
                      Attendance overview for selected date
                    </p>

                  </div>

                </div>

              </div>


              <div className="dashboard-attendance-date">

                <MdCalendarToday />

                <input
                  type="date"
                  value={selectedDate}
                  onChange={e =>
                    setSelectedDate(
                      e.target.value
                    )
                  }
                />

              </div>

            </div>



            {/* FILTERS */}

            <div className="dashboard-attendance-filters">


              {/* Student / Staff */}

              <div className="dashboard-tabs">

                <button
                  className={
                    attType === 'student'
                      ? 'active'
                      : ''
                  }
                  onClick={() =>
                    setAttType('student')
                  }
                >
                  Students
                </button>

                <button
                  className={
                    attType === 'staff'
                      ? 'active'
                      : ''
                  }
                  onClick={() =>
                    setAttType('staff')
                  }
                >
                  Staff
                </button>

              </div>



              {/* Branch */}

              <select
                className="dashboard-filter-select"
                value={selectedBranch}
                onChange={e => {

                  setSelectedBranch(
                    e.target.value
                  );

                  setSelectedClass('');

                }}
              >

                {!isDedicatedBranchUser() && (

                  <option value="">
                    All Branches
                  </option>

                )}

                {branches.map(branch => (

                  <option
                    key={branch.id}
                    value={branch.id}
                  >
                    {branch.name}
                  </option>

                ))}

              </select>



              {/* Class */}

              {attType === 'student' &&
                selectedBranch &&
                classes.length > 0 && (

                  <ClassSectionSelect
                    classes={classes}
                    value={selectedClass}
                    onChange={setSelectedClass}
                    includeAll
                    classStyle={{
                      width: 160,
                      padding: '8px 10px',
                      fontSize: 13
                    }}
                    sectionStyle={{
                      width: 140,
                      padding: '8px 10px',
                      fontSize: 13
                    }}
                  />

                )}



              {/* Search */}

              <div className="dashboard-search">

                <MdSearch />

                <input
                  type="text"
                  placeholder="Search attendance..."
                  value={searchTerm}
                  onChange={e =>
                    setSearchTerm(
                      e.target.value
                    )
                  }
                />

              </div>

            </div>



            {/* SUMMARY */}

            <div className="dashboard-attendance-summary">


              <div className="dashboard-summary-item total">

                <span className="summary-number">
                  {summary.total || 0}
                </span>

                <span className="summary-label">
                  Total
                </span>

              </div>


              <div className="dashboard-summary-item present">

                <span className="summary-number">
                  {summary.present || 0}
                </span>

                <span className="summary-label">
                  Present
                </span>

              </div>


              <div className="dashboard-summary-item absent">

                <span className="summary-number">
                  {summary.absent || 0}
                </span>

                <span className="summary-label">
                  Absent
                </span>

              </div>


              <div className="dashboard-summary-item late">

                <span className="summary-number">
                  {summary.late || 0}
                </span>

                <span className="summary-label">
                  Late
                </span>

              </div>

            </div>



            {/* TABLE */}

            <div className="dashboard-table-container">

              <table>

                <thead>

                  <tr>

                    <th>Name</th>

                    <th>
                      {attType === 'student'
                        ? 'Class'
                        : 'Role'}
                    </th>

                    <th>
                      Branch
                    </th>

                    <th>
                      Punch Time
                    </th>

                    <th>
                      Status
                    </th>

                  </tr>

                </thead>


                <tbody>

                  {filteredRecords.length === 0 ? (

                    <tr>

                      <td colSpan={5}>

                        <div className="empty-state dashboard-empty-state">

                          <div>
                            No attendance records found
                          </div>

                        </div>

                      </td>

                    </tr>

                  ) : (

                    filteredRecords.map(record => (

                      <tr key={record.id}>

                        <td>

                          <div className="dashboard-person">

                            <div className="dashboard-person-avatar">

                              {record.full_name
                                ?.charAt(0)
                                ?.toUpperCase() || '?'
                              }

                            </div>

                            <div>

                              <div className="dashboard-person-name">

                                {record.full_name}

                              </div>

                              <div className="dashboard-person-id">

                                {attType === 'student'
                                  ? record.admission_no
                                  : record.staff_id
                                }

                              </div>

                            </div>

                          </div>

                        </td>


                        <td>

                          {attType === 'student'
                            ? `${record.class_name || ''} ${record.section || ''}`
                            : record.role_type || '—'
                          }

                        </td>


                        <td>

                          {record.branch_name || '—'}

                        </td>


                        <td>

                          {record.check_in ||
                            record.check_out ||
                            '—'
                          }

                        </td>


                        <td>
                          {record.status ? (
                            <span
                              className={
                                `dashboard-status ${
                                  record.status === 'absent'
                                    ? 'absent'
                                    : record.status === 'present'
                                      ? 'present'
                                      : record.status === 'late'
                                        ? 'late'
                                        : 'other'
                                }`
                              }
                            >
                              {record.status}
                            </span>
                          ) : (
                            ''
                          )}
                        </td>

                      </tr>

                    ))

                  )}

                </tbody>

              </table>

            </div>

          </div>



          {/* =================================================
              RIGHT SIDE
          ================================================= */}

          <div className="dashboard-right-column">


            {/* ATTENDANCE SUMMARY */}

            <div className="dashboard-side-card card">

              <div className="dashboard-side-header">

                <div>

                  <h3>
                    Attendance Summary
                  </h3>

                  <p>
                    Daily attendance breakdown
                  </p>

                </div>

                <div className="dashboard-side-icon">

                  <MdTrendingUp />

                </div>

              </div>


              {pieData.length > 0 ? (

                <>

                  <div className="dashboard-chart">

                    <ResponsiveContainer
                      width="100%"
                      height={220}
                    >

                      <PieChart>

                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={82}
                          paddingAngle={3}
                          dataKey="value"
                        >

                          {pieData.map(
                            (_, index) => (

                              <Cell
                                key={index}
                                fill={
                                  COLORS[index]
                                }
                              />

                            )
                          )}

                        </Pie>

                        <Tooltip />

                      </PieChart>

                    </ResponsiveContainer>

                  </div>


                  <div className="dashboard-chart-legend">

                    {pieData.map(
                      (item, index) => (

                        <div
                          key={item.name}
                          className="dashboard-legend-item"
                        >

                          <span
                            className="dashboard-legend-dot"
                            style={{
                              background:
                                COLORS[index]
                            }}
                          />

                          <span>
                            {item.name}
                          </span>

                          <strong>
                            {item.value}
                          </strong>

                        </div>

                      )
                    )}

                  </div>

                </>

              ) : (

                <div className="dashboard-no-chart">

                  No attendance data available.

                </div>

              )}

            </div>



            {/* RECENT NOTICES */}

            <div className="dashboard-side-card dashboard-notices-card card">

              <div className="dashboard-side-header">

                <div>

                  <h3>
                    Recent Notices
                  </h3>

                  <p>
                    Latest announcements
                  </p>

                </div>

                <div className="dashboard-side-icon purple">

                  <MdAnnouncement />

                </div>

              </div>


              <div className="dashboard-notices">

                {notices.length === 0 ? (

                  <div className="dashboard-no-notices">

                    No notices available.

                  </div>

                ) : (

                  notices.map(notice => (

                    <div
                      key={notice.id}
                      className="dashboard-notice"
                    >

                      <div className="dashboard-notice-icon">

                        <MdAnnouncement />

                      </div>

                      <div className="dashboard-notice-content">

                        <div className="dashboard-notice-title">

                          {notice.title}

                        </div>

                        <div className="dashboard-notice-text">

                          {notice.content}

                        </div>

                        <div className="dashboard-notice-meta">

                          <span
                            className={`dashboard-audience ${
                              notice.audience === 'all'
                                ? 'purple'
                                : notice.audience === 'staff'
                                  ? 'blue'
                                  : 'green'
                            }`}
                          >

                            {notice.audience}

                          </span>

                        </div>

                      </div>

                    </div>

                  ))

                )}

              </div>

            </div>

          </div>

        </div>

      </div>

    </Layout>

  );
}