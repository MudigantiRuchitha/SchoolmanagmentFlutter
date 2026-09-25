import { useState, useEffect, useMemo } from 'react';
import Layout from '../components/Layout';
import {
  getAcademicYears,
  getAcademicClasses,
  getAcademicStudents,
  getAcademicStaff
} from '../api';
import {
  MdSearch,
  MdDownload,
  MdFilterList,
  MdRefresh,
  MdCheckCircle,
  MdSchool,
  MdPeople
} from 'react-icons/md';

export default function AcademicData() {
  // Primary selection states
  const [entityType, setEntityType] = useState('student'); // 'student' | 'staff'
  const [academicYears, setAcademicYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');

  // Student specific dependent states
  const [availableClasses, setAvailableClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [availableSections, setAvailableSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState('');

  // Staff specific dependent states
  const [staffType, setStaffType] = useState('teaching'); // 'teaching' | 'non-teaching'

  // Additional secondary filters
  const [statusFilter, setStatusFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [search, setSearch] = useState('');

  // Results & UI states
  const [loadingDropdowns, setLoadingDropdowns] = useState(false);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchedEntity, setSearchedEntity] = useState('');
  const [searchedStaffType, setSearchedStaffType] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [toast, setToast] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // 1. Initial Load: Fetch Academic Years dynamically from DB
  useEffect(() => {
    fetchAcademicYears();
  }, []);

  const fetchAcademicYears = async () => {
    try {
      const res = await getAcademicYears();
      if (res.data.success && Array.isArray(res.data.academicYears) && res.data.academicYears.length > 0) {
        setAcademicYears(res.data.academicYears);
        setSelectedYear(res.data.academicYears[0]);
      }
    } catch (err) {
      console.error('Failed to fetch academic years:', err);
    }
  };

  // 2. Fetch classes whenever year changes (for students)
  useEffect(() => {
    if (selectedYear && entityType === 'student') {
      loadClassesForYear(selectedYear);
    }
  }, [selectedYear, entityType]);

  const loadClassesForYear = async (year) => {
    setLoadingDropdowns(true);
    try {
      const res = await getAcademicClasses({ academic_year: year });
      if (res.data.success && Array.isArray(res.data.classes)) {
        setAvailableClasses(res.data.classes);
      }
    } catch (err) {
      console.error('Failed to load classes for year:', err);
    } finally {
      setLoadingDropdowns(false);
    }
  };

  // 3. Auto-trigger search when main parameters are selected
  useEffect(() => {
    if (selectedYear && entityType) {
      executeSearch();
    }
  }, [selectedYear, entityType, selectedClass, selectedSection, staffType]);

  // Handle entity change
  const handleEntityChange = (type) => {
    setEntityType(type);
    setSelectedClass('');
    setSelectedSection('');
    setAvailableSections([]);
    setStatusFilter('');
    setGenderFilter('');
    setSearch('');
  };

  // Handle class change
  const handleClassChange = (className) => {
    setSelectedClass(className);
    setSelectedSection('');
    const foundClass = availableClasses.find((c) => c.className === className);
    if (foundClass && Array.isArray(foundClass.sections)) {
      setAvailableSections(foundClass.sections);
    } else {
      setAvailableSections([]);
    }
  };

  const handleReset = () => {
    setSelectedClass('');
    setSelectedSection('');
    setAvailableSections([]);
    setStatusFilter('');
    setGenderFilter('');
    setSearch('');
    if (academicYears.length > 0) {
      setSelectedYear(academicYears[0]);
    }
    setEntityType('student');
    setStaffType('teaching');
  };

  const canSearch = Boolean(entityType && selectedYear);

  const executeSearch = async () => {
    if (!canSearch) return;
    setSearching(true);
    setErrorMsg('');

    try {
      if (entityType === 'student') {
        const params = { academic_year: selectedYear };
        if (selectedClass) params.class_name = selectedClass;
        if (selectedSection) params.section = selectedSection;
        if (search.trim()) params.search = search.trim();
        const res = await getAcademicStudents(params);
        if (res.data.success) {
          setSearchResults(res.data.students || []);
          setSearchedEntity('student');
          setHasSearched(true);
        } else {
          setErrorMsg(res.data.message || 'Failed to fetch students.');
        }
      } else if (entityType === 'staff') {
        const params = { academic_year: selectedYear, staff_type: staffType };
        if (search.trim()) params.search = search.trim();
        const res = await getAcademicStaff(params);
        if (res.data.success) {
          setSearchResults(res.data.staff || []);
          setSearchedEntity('staff');
          setSearchedStaffType(staffType);
          setHasSearched(true);
        } else {
          setErrorMsg(res.data.message || 'Failed to fetch staff.');
        }
      }
    } catch (err) {
      console.error('Academic search error:', err);
      setErrorMsg('An error occurred while fetching academic data.');
    } finally {
      setSearching(false);
    }
  };

  // Filtered Results based on search text, status, and gender
  const filteredResults = useMemo(() => {
    return searchResults.filter((item) => {
      // 1. Text Search
      if (search.trim()) {
        const term = search.toLowerCase().trim();
        const matchesStudent =
          searchedEntity === 'student' &&
          ((item.admission_no && item.admission_no.toLowerCase().includes(term)) ||
            (item.student_name && item.student_name.toLowerCase().includes(term)) ||
            (item.class_name && item.class_name.toLowerCase().includes(term)) ||
            (item.section && item.section.toLowerCase().includes(term)) ||
            (item.parent_guardian && item.parent_guardian.toLowerCase().includes(term)) ||
            (item.contact && item.contact.toLowerCase().includes(term)));

        const matchesStaff =
          searchedEntity === 'staff' &&
          ((item.employee_id && item.employee_id.toLowerCase().includes(term)) ||
            (item.name && item.name.toLowerCase().includes(term)) ||
            (item.designation && item.designation.toLowerCase().includes(term)) ||
            (item.department && item.department.toLowerCase().includes(term)) ||
            (item.subject && item.subject.toLowerCase().includes(term)) ||
            (item.contact && item.contact.toLowerCase().includes(term)));

        if (!matchesStudent && !matchesStaff) return false;
      }

      // 2. Status Filter
      if (statusFilter) {
        const isActive = item.status === true || item.status === 'active' || item.status === 1;
        if (statusFilter === 'active' && !isActive) return false;
        if (statusFilter === 'inactive' && isActive) return false;
      }

      // 3. Gender Filter (students)
      if (genderFilter && searchedEntity === 'student') {
        const itemGender = (item.gender || '').toLowerCase();
        if (itemGender !== genderFilter.toLowerCase()) return false;
      }

      return true;
    });
  }, [searchResults, search, statusFilter, genderFilter, searchedEntity]);

  // Live Summary Counters matching the Student Attendance UI
  const summary = useMemo(() => {
    const total = filteredResults.length;
    const active = filteredResults.filter(
      (r) => r.status === true || r.status === 'active' || r.status === 1
    ).length;
    const inactive = total - active;
    const male = filteredResults.filter(
      (r) => (r.gender || '').toLowerCase() === 'male'
    ).length;
    const female = filteredResults.filter(
      (r) => (r.gender || '').toLowerCase() === 'female'
    ).length;

    return {
      total,
      active,
      inactive,
      male,
      female,
      hasGender: searchedEntity === 'student' && (male > 0 || female > 0)
    };
  }, [filteredResults, searchedEntity]);

  // CSV Export
  const handleExportCSV = () => {
    if (!filteredResults.length) {
      showToast('No rows to export. Please adjust filters.');
      return;
    }

    try {
      let headers = [];
      let rows = [];

      if (searchedEntity === 'student') {
        headers = ['#', 'Admission No', 'Student Name', 'Class', 'Section', 'Gender', 'Parent / Guardian', 'Contact', 'Status'];
        rows = filteredResults.map((s, idx) => [
          idx + 1,
          s.admission_no || '',
          s.student_name || '',
          s.class_name || '',
          s.section || '',
          s.gender || '',
          s.parent_guardian || '',
          s.contact || '',
          (s.status ? 'active' : 'inactive')
        ]);
      } else if (searchedStaffType === 'teaching') {
        headers = ['#', 'Employee ID', 'Name', 'Subject', 'Department', 'Designation', 'Class', 'Section', 'Contact', 'Status'];
        rows = filteredResults.map((st, idx) => [
          idx + 1,
          st.employee_id || '',
          st.name || '',
          st.subject || '',
          st.department || '',
          st.designation || '',
          st.class_name || '',
          st.section || '',
          st.contact || '',
          (st.status ? 'active' : 'inactive')
        ]);
      } else {
        headers = ['#', 'Employee ID', 'Name', 'Department', 'Designation', 'Contact', 'Status'];
        rows = filteredResults.map((st, idx) => [
          idx + 1,
          st.employee_id || '',
          st.name || '',
          st.department || '',
          st.designation || '',
          st.contact || '',
          (st.status ? 'active' : 'inactive')
        ]);
      }

      const csvRows = [headers, ...rows].map((row) =>
        row.map((val) => `"${String(val ?? '').replace(/"/g, '""')}"`).join(',')
      );
      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `academic_${searchedEntity}_${selectedYear}_${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('Academic records CSV exported successfully.');
    } catch (err) {
      console.error('CSV export failed:', err);
      showToast('Failed to export CSV.');
    }
  };

  return (
    <Layout
      title="Academic Data"
      subtitle="Mark, update, and manage academic student daily rosters and staff records"
      headerRight={
        hasSearched && filteredResults.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={handleExportCSV}
              title="Export CSV"
              className="btn btn-secondary btn-sm"
            >
              <MdDownload /> Export CSV
            </button>
          </div>
        )
      }
    >
      {toast && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          <MdCheckCircle style={{ fontSize: 18, flexShrink: 0 }} />
          <span>{toast}</span>
        </div>
      )}

      {/* ── Filters & Control Bar Card (All controls unified in one line) ── */}
      <div className="card" style={{ padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 14, color: 'var(--text-secondary)', marginRight: 4 }}>
            <MdFilterList style={{ fontSize: 18 }} /> Filters:
          </div>

          {/* 1. Entity Select */}
          <select
            value={entityType}
            onChange={(e) => handleEntityChange(e.target.value)}
            className="filter-dropdown"
            style={{ minWidth: 140 }}
          >
            <option value="student">Students</option>
            <option value="staff">Staff Members</option>
          </select>

          {/* 2. Academic Year Dropdown */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="filter-dropdown"
            style={{ minWidth: 150 }}
          >
            <option value="">
              {academicYears.length === 0 ? 'No Academic Years' : 'All Academic Years'}
            </option>
            {academicYears.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>

          {/* 3A. Student Dependent Dropdowns */}
          {entityType === 'student' && (
            <>
              <select
                value={selectedClass}
                onChange={(e) => handleClassChange(e.target.value)}
                disabled={loadingDropdowns}
                className="filter-dropdown"
                style={{ minWidth: 130 }}
              >
                <option value="">
                  {loadingDropdowns ? 'Loading...' : 'All Classes'}
                </option>
                {availableClasses.map((c) => (
                  <option key={c.className} value={c.className}>
                    {c.className}
                  </option>
                ))}
              </select>

              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                disabled={!selectedClass}
                className="filter-dropdown"
                style={{ minWidth: 130 }}
              >
                <option value="">All Sections</option>
                {availableSections.map((sec) => (
                  <option key={sec} value={sec}>
                    Section {sec}
                  </option>
                ))}
              </select>
            </>
          )}

          {/* 3B. Staff Dependent Dropdown */}
          {entityType === 'staff' && (
            <select
              value={staffType}
              onChange={(e) => setStaffType(e.target.value)}
              className="filter-dropdown"
              style={{ minWidth: 150 }}
            >
              <option value="teaching">Teaching Staff</option>
              <option value="non-teaching">Non-Teaching Staff</option>
            </select>
          )}

          {/* 4. Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-dropdown"
            style={{ minWidth: 130 }}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          {/* 5. Gender Filter (students) */}
          {entityType === 'student' && (
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className="filter-dropdown"
              style={{ minWidth: 130 }}
            >
              <option value="">All Genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          )}

          {/* Search Box */}
          <div
            className="search-box"
            style={{
              height: 40,
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px'
            }}
          >
            <MdSearch color="var(--text-muted)" size={18} />
            <input
              placeholder="Search classes, sections, teachers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: 230,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 13.5,
                color: '#334155'
              }}
            />
          </div>

          {/* Reset Action */}
          {(selectedClass || selectedSection || search || statusFilter || genderFilter) && (
            <button
              type="button"
              onClick={handleReset}
              className="btn btn-secondary btn-sm"
              style={{ height: 40, borderRadius: 12 }}
              title="Reset filters"
            >
              <MdRefresh /> Reset
            </button>
          )}
        </div>

        {/* Row 3: Live Summary Counters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 24, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)', fontSize: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--primary)', display: 'inline-block' }}></span>
            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{summary.total}</span>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Total</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }}></span>
            <span style={{ fontWeight: 700, color: 'var(--success)' }}>{summary.active}</span>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Active</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--danger)', display: 'inline-block' }}></span>
            <span style={{ fontWeight: 700, color: 'var(--danger)' }}>{summary.inactive}</span>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Inactive</span>
          </div>
          {summary.hasGender && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--warning)', display: 'inline-block' }}></span>
                <span style={{ fontWeight: 700, color: 'var(--warning)' }}>{summary.male}</span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Male</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#8b5cf6', display: 'inline-block' }}></span>
                <span style={{ fontWeight: 700, color: '#8b5cf6' }}>{summary.female}</span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Female</span>
              </div>
            </>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="alert alert-error" style={{ marginBottom: 20 }}>
          {errorMsg}
        </div>
      )}

      {/* ── Results Table Card ── */}
      {searching ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', marginBottom: 24 }}>
          <div className="loading-overlay" style={{ minHeight: 180 }}>
            <div className="spinner" />
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>Querying academic records from database...</span>
          </div>
        </div>
      ) : hasSearched ? (
        <div className="card" style={{ overflow: 'hidden', marginBottom: 24 }}>
          {/* Card Header with count badges */}
          <div className="card-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
                {searchedEntity === 'student'
                  ? selectedClass
                    ? `Class: ${selectedClass} ${selectedSection ? `Section ${selectedSection}` : ''}`
                    : 'All Classes'
                  : searchedStaffType === 'teaching'
                  ? 'Teaching Staff Directory'
                  : 'Non-Teaching Staff Directory'}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 400 }}>
                Academic Year: {selectedYear}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, marginRight: 4 }}>
                {filteredResults.length} {searchedEntity === 'student' ? 'Students' : 'Staff Members'}
              </span>
              <span className="badge badge-success">
                {summary.active} Active
              </span>
              <span className="badge badge-danger">
                {summary.inactive} Inactive
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
            {searchedEntity === 'student' ? (
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 48, paddingLeft: 20 }}>#</th>
                    <th>STUDENT NAME</th>
                    <th>ADMISSION NO</th>
                    <th>CLASS & SEC</th>
                    <th>GENDER</th>
                    <th>PARENT / GUARDIAN</th>
                    <th>CONTACT</th>
                    <th style={{ paddingRight: 20 }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.length === 0 ? (
                    <tr>
                      <td colSpan={8}>
                        <div className="empty-state">
                          <MdSchool className="empty-state-icon" />
                          <div className="empty-state-title">No students found</div>
                          <div className="empty-state-text">Try adjusting your filters or search term.</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredResults.map((s, idx) => {
                      const isActive = s.status === true || s.status === 'active' || s.status === 1;
                      return (
                        <tr key={s.id || idx}>
                          <td style={{ paddingLeft: 20, color: 'var(--text-secondary)' }}>{idx + 1}</td>
                          <td style={{ fontWeight: 600 }}>{s.student_name}</td>
                          <td style={{ fontWeight: 700 }}>{s.admission_no || '—'}</td>
                          <td>
                            {s.class_name} {s.section ? `• ${s.section}` : ''}
                          </td>
                          <td style={{ textTransform: 'capitalize' }}>{s.gender || '—'}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{s.parent_guardian || '—'}</td>
                          <td style={{ fontFamily: 'monospace' }}>{s.contact || '—'}</td>
                          <td style={{ paddingRight: 20 }}>
                            <span className={`badge ${isActive ? 'badge-success' : 'badge-danger'}`}>
                              {isActive ? 'active' : 'inactive'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            ) : searchedStaffType === 'teaching' ? (
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 48, paddingLeft: 20 }}>#</th>
                    <th>STAFF NAME</th>
                    <th>EMPLOYEE ID</th>
                    <th>SUBJECT</th>
                    <th>DEPARTMENT</th>
                    <th>DESIGNATION</th>
                    <th>CONTACT</th>
                    <th style={{ paddingRight: 20 }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.length === 0 ? (
                    <tr>
                      <td colSpan={8}>
                        <div className="empty-state">
                          <MdPeople className="empty-state-icon" />
                          <div className="empty-state-title">No teaching staff found</div>
                          <div className="empty-state-text">Try adjusting your filters or search term.</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredResults.map((st, idx) => {
                      const isActive = st.status === true || st.status === 'active' || st.status === 1;
                      return (
                        <tr key={st.id || idx}>
                          <td style={{ paddingLeft: 20, color: 'var(--text-secondary)' }}>{idx + 1}</td>
                          <td style={{ fontWeight: 600 }}>{st.name}</td>
                          <td style={{ fontWeight: 700 }}>{st.employee_id || '—'}</td>
                          <td>{st.subject || '—'}</td>
                          <td>{st.department || '—'}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{st.designation || '—'}</td>
                          <td style={{ fontFamily: 'monospace' }}>{st.contact || '—'}</td>
                          <td style={{ paddingRight: 20 }}>
                            <span className={`badge ${isActive ? 'badge-success' : 'badge-danger'}`}>
                              {isActive ? 'active' : 'inactive'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 48, paddingLeft: 20 }}>#</th>
                    <th>STAFF NAME</th>
                    <th>EMPLOYEE ID</th>
                    <th>DEPARTMENT</th>
                    <th>DESIGNATION</th>
                    <th>CONTACT</th>
                    <th style={{ paddingRight: 20 }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="empty-state">
                          <MdPeople className="empty-state-icon" />
                          <div className="empty-state-title">No non-teaching staff found</div>
                          <div className="empty-state-text">Try adjusting your filters or search term.</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredResults.map((st, idx) => {
                      const isActive = st.status === true || st.status === 'active' || st.status === 1;
                      return (
                        <tr key={st.id || idx}>
                          <td style={{ paddingLeft: 20, color: 'var(--text-secondary)' }}>{idx + 1}</td>
                          <td style={{ fontWeight: 600 }}>{st.name}</td>
                          <td style={{ fontWeight: 700 }}>{st.employee_id || '—'}</td>
                          <td>{st.department || '—'}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{st.designation || '—'}</td>
                          <td style={{ fontFamily: 'monospace' }}>{st.contact || '—'}</td>
                          <td style={{ paddingRight: 20 }}>
                            <span className={`badge ${isActive ? 'badge-success' : 'badge-danger'}`}>
                              {isActive ? 'active' : 'inactive'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)' }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Ready to search academic data</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Select an Entity and Academic Year above to view records.</p>
        </div>
      )}
    </Layout>
  );
}
