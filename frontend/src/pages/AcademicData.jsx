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
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleExportCSV}
              title="Export CSV"
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/80 transition-colors shadow-none cursor-pointer"
            >
              <MdDownload className="text-base" /> Export CSV
            </button>
          </div>
        )
      }
    >
      {toast && (
        <div className="mb-4 flex items-center gap-2 p-3 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl">
          <MdCheckCircle className="text-lg text-emerald-600 flex-shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* ── Filters & Control Bar Card (All controls unified in one line) ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 md:p-6 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 font-semibold text-sm text-slate-700 mr-1">
            <MdFilterList className="text-lg text-slate-600" /> Filters:
          </div>

          {/* 1. Entity Select */}
          <select
            value={entityType}
            onChange={(e) => handleEntityChange(e.target.value)}
            className="filter-dropdown min-w-[140px]"
          >
            <option value="student">Students</option>
            <option value="staff">Staff Members</option>
          </select>

          {/* 2. Academic Year Dropdown */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="filter-dropdown min-w-[150px]"
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
                className="filter-dropdown min-w-[130px]"
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
                className="filter-dropdown min-w-[130px]"
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
              className="filter-dropdown min-w-[150px]"
            >
              <option value="teaching">Teaching Staff</option>
              <option value="non-teaching">Non-Teaching Staff</option>
            </select>
          )}

          {/* 4. Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-dropdown min-w-[130px]"
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
              className="filter-dropdown min-w-[130px]"
            >
              <option value="">All Genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          )}

          {/* Search Box as in reference image */}
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
              className="text-xs text-slate-500 hover:text-slate-800 font-medium px-2.5 h-[40px] rounded-xl hover:bg-slate-100 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
              title="Reset filters"
            >
              <MdRefresh /> Reset
            </button>
          )}
        </div>

        {/* Row 3: Live Summary Counters (Styled like Student Attendance dots) */}
        <div className="flex flex-wrap items-center gap-6 mt-4 pt-1 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#4f46e5] inline-block"></span>
            <span className="font-bold text-[#4f46e5]">{summary.total}</span>
            <span className="text-slate-500 font-medium">Total</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
            <span className="font-bold text-emerald-600">{summary.active}</span>
            <span className="text-slate-500 font-medium">Active</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
            <span className="font-bold text-rose-600">{summary.inactive}</span>
            <span className="text-slate-500 font-medium">Inactive</span>
          </div>
          {summary.hasGender && (
            <>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                <span className="font-bold text-amber-600">{summary.male}</span>
                <span className="text-slate-500 font-medium">Male</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block"></span>
                <span className="font-bold text-purple-600">{summary.female}</span>
                <span className="text-slate-500 font-medium">Female</span>
              </div>
            </>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl border border-rose-200 bg-rose-50 text-sm text-rose-700">
          {errorMsg}
        </div>
      )}

      {/* ── Results Table Card (Styled like Period Card in Attendance) ── */}
      {searching ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium">Querying academic records from database...</span>
        </div>
      ) : hasSearched ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden mb-6">
          {/* Card Header with count badges */}
          <div className="p-5 md:px-6 md:py-4 border-b border-slate-100 flex flex-col gap-1.5">
            <div className="flex items-center flex-wrap gap-x-3 gap-y-1">
              <span className="font-bold text-base md:text-lg text-slate-900">
                {searchedEntity === 'student'
                  ? selectedClass
                    ? `Class: ${selectedClass} ${selectedSection ? `Section ${selectedSection}` : ''}`
                    : 'All Classes'
                  : searchedStaffType === 'teaching'
                  ? 'Teaching Staff Directory'
                  : 'Non-Teaching Staff Directory'}
              </span>
              <span className="text-xs md:text-sm text-slate-500 font-normal">
                Academic Year: {selectedYear}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-slate-400 font-medium mr-2">
                {filteredResults.length} {searchedEntity === 'student' ? 'Students' : 'Staff Members'}
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100/60">
                {summary.active} Active
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-100/60">
                {summary.inactive} Inactive
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {searchedEntity === 'student' ? (
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/60 border-t border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4 pl-6 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-12">#</th>
                    <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">STUDENT NAME</th>
                    <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">ADMISSION NO</th>
                    <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">CLASS & SEC</th>
                    <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">GENDER</th>
                    <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">PARENT / GUARDIAN</th>
                    <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">CONTACT</th>
                    <th className="py-3 px-4 pr-6 text-[11px] font-bold text-slate-500 uppercase tracking-wider">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredResults.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <MdSchool size={36} className="mx-auto mb-2 opacity-40 text-slate-400" />
                        <p className="font-semibold text-slate-600 text-sm">No students found</p>
                        <p className="text-xs text-slate-400 mt-0.5">Try adjusting your filters or search term.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredResults.map((s, idx) => {
                      const isActive = s.status === true || s.status === 'active' || s.status === 1;
                      return (
                        <tr key={s.id || idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 px-4 pl-6 text-sm text-slate-700">{idx + 1}</td>
                          <td className="py-3.5 px-4 text-sm font-medium text-slate-800">{s.student_name}</td>
                          <td className="py-3.5 px-4 text-sm font-bold text-slate-900">{s.admission_no || '—'}</td>
                          <td className="py-3.5 px-4 text-sm text-slate-600">
                            {s.class_name} {s.section ? `• ${s.section}` : ''}
                          </td>
                          <td className="py-3.5 px-4 text-sm text-slate-600 capitalize">{s.gender || '—'}</td>
                          <td className="py-3.5 px-4 text-sm text-slate-500">{s.parent_guardian || '—'}</td>
                          <td className="py-3.5 px-4 text-sm text-slate-500 font-mono">{s.contact || '—'}</td>
                          <td className="py-3.5 px-4 pr-6">
                            <span
                              className={`inline-flex items-center justify-center px-4 py-1 rounded-full text-xs font-semibold ${
                                isActive
                                  ? 'bg-emerald-50 text-emerald-600'
                                  : 'bg-rose-100/80 text-rose-600'
                              }`}
                            >
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
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/60 border-t border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4 pl-6 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-12">#</th>
                    <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">STAFF NAME</th>
                    <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">EMPLOYEE ID</th>
                    <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">SUBJECT</th>
                    <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">DEPARTMENT</th>
                    <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">DESIGNATION</th>
                    <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">CONTACT</th>
                    <th className="py-3 px-4 pr-6 text-[11px] font-bold text-slate-500 uppercase tracking-wider">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredResults.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <MdPeople size={36} className="mx-auto mb-2 opacity-40 text-slate-400" />
                        <p className="font-semibold text-slate-600 text-sm">No teaching staff found</p>
                        <p className="text-xs text-slate-400 mt-0.5">Try adjusting your filters or search term.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredResults.map((st, idx) => {
                      const isActive = st.status === true || st.status === 'active' || st.status === 1;
                      return (
                        <tr key={st.id || idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 px-4 pl-6 text-sm text-slate-700">{idx + 1}</td>
                          <td className="py-3.5 px-4 text-sm font-medium text-slate-800">{st.name}</td>
                          <td className="py-3.5 px-4 text-sm font-bold text-slate-900">{st.employee_id || '—'}</td>
                          <td className="py-3.5 px-4 text-sm text-slate-600">{st.subject || '—'}</td>
                          <td className="py-3.5 px-4 text-sm text-slate-600">{st.department || '—'}</td>
                          <td className="py-3.5 px-4 text-sm text-slate-500">{st.designation || '—'}</td>
                          <td className="py-3.5 px-4 text-sm text-slate-500 font-mono">{st.contact || '—'}</td>
                          <td className="py-3.5 px-4 pr-6">
                            <span
                              className={`inline-flex items-center justify-center px-4 py-1 rounded-full text-xs font-semibold ${
                                isActive
                                  ? 'bg-emerald-50 text-emerald-600'
                                  : 'bg-rose-100/80 text-rose-600'
                              }`}
                            >
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
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/60 border-t border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4 pl-6 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-12">#</th>
                    <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">STAFF NAME</th>
                    <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">EMPLOYEE ID</th>
                    <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">DEPARTMENT</th>
                    <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">DESIGNATION</th>
                    <th className="py-3 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">CONTACT</th>
                    <th className="py-3 px-4 pr-6 text-[11px] font-bold text-slate-500 uppercase tracking-wider">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredResults.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <MdPeople size={36} className="mx-auto mb-2 opacity-40 text-slate-400" />
                        <p className="font-semibold text-slate-600 text-sm">No non-teaching staff found</p>
                        <p className="text-xs text-slate-400 mt-0.5">Try adjusting your filters or search term.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredResults.map((st, idx) => {
                      const isActive = st.status === true || st.status === 'active' || st.status === 1;
                      return (
                        <tr key={st.id || idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 px-4 pl-6 text-sm text-slate-700">{idx + 1}</td>
                          <td className="py-3.5 px-4 text-sm font-medium text-slate-800">{st.name}</td>
                          <td className="py-3.5 px-4 text-sm font-bold text-slate-900">{st.employee_id || '—'}</td>
                          <td className="py-3.5 px-4 text-sm text-slate-600">{st.department || '—'}</td>
                          <td className="py-3.5 px-4 text-sm text-slate-500">{st.designation || '—'}</td>
                          <td className="py-3.5 px-4 text-sm text-slate-500 font-mono">{st.contact || '—'}</td>
                          <td className="py-3.5 px-4 pr-6">
                            <span
                              className={`inline-flex items-center justify-center px-4 py-1 rounded-full text-xs font-semibold ${
                                isActive
                                  ? 'bg-emerald-50 text-emerald-600'
                                  : 'bg-rose-100/80 text-rose-600'
                              }`}
                            >
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
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-12 text-center text-slate-500">
          <p className="text-base font-medium text-slate-700">Ready to search academic data</p>
          <p className="text-xs text-slate-400 mt-1">Select an Entity and Academic Year above to view records.</p>
        </div>
      )}
    </Layout>
  );
}
