import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import { useAuth } from '../context/AuthContext';
import {
  getClasses,
  createClass,
  updateClass,
  deleteClass,
  getAcademicGroups,
  getBranches,
  getStaff,
  getAcademicYears
} from '../api';

import {
  MdAdd,
  MdEdit,
  MdDelete,
  MdSearch,
  MdSchool,
  MdCheckCircle,
  MdCancel,
  MdPerson,
  MdVisibility
} from 'react-icons/md';
import { filterBranches, filterBranchItems, getBranchScope, isDedicatedBranchUser } from '../utils/branchScope';


// ============================================================
// DEFAULT ACADEMIC YEARS
// ============================================================

const DEFAULT_ACADEMIC_YEARS = [
  '2026-2027',
  '2025-2026',
  '2024-2025',
  '2027-2028',
  '2028-2029'
];


// ============================================================
// EMPTY FORM
// ============================================================

const emptyForm = {
  name: '',
  section: '',
  academicGroupId: '',
  branchId: '',
  academicYear: '2026-2027',
  teacherId: '',
  isActive: true
};


// ============================================================
// DEFAULT CLASS OPTIONS
// Used if classes are not yet present in database
// ============================================================

const DEFAULT_CLASS_OPTIONS = [
  'Class 1',
  'Class 2',
  'Class 3',
  'Class 4',
  'Class 5',
  'Class 6',
  'Class 7',
  'Class 8',
  'Class 9',
  'Class 10',
  'Class 11',
  'Class 12'
];


// ============================================================
// DEFAULT SECTION OPTIONS
// ============================================================

const DEFAULT_SECTION_OPTIONS = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F'
];


export default function Classes() {
  const { isReadOnly, canDelete } = useAuth();

  // ==========================================================
  // MAIN DATA
  // ==========================================================

  const [classes, setClasses] = useState([]);
  const [allClasses, setAllClasses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [branches, setBranches] = useState([]);
  const [staff, setStaff] = useState([]);

  // Class dropdown options
  const [classOptions, setClassOptions] = useState(
    DEFAULT_CLASS_OPTIONS
  );

  // Sections grouped according to class
  const [sectionsByClass, setSectionsByClass] = useState({});

  // Loading
  const [loading, setLoading] = useState(true);

  // Search
  const [search, setSearch] = useState('');

  // Filters
  const [filterGroup, setFilterGroup] = useState('');
  const [filterBranch, setFilterBranch] = useState(getBranchScope);
  const [filterAcademicYear, setFilterAcademicYear] = useState('');

  // Academic Years list for dropdown
  const [academicYears, setAcademicYears] = useState(DEFAULT_ACADEMIC_YEARS);


  // ==========================================================
  // ADD / EDIT CLASS MODAL
  // ==========================================================

  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const [form, setForm] = useState(emptyForm);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');


  // ==========================================================
  // QUICK MULTI-STAFF ASSIGNMENT MODAL
  // ==========================================================

  const [showStaffModal, setShowStaffModal] = useState(false);

  const [selectedClass, setSelectedClass] = useState(null);

  const [selectedTeacherIds, setSelectedTeacherIds] = useState([]);

  const [assigning, setAssigning] = useState(false);


  // ==========================================================
  // VIEW ASSIGNED STAFF MODAL
  // ==========================================================

  const [showViewStaffModal, setShowViewStaffModal] = useState(false);

  const [viewStaffClass, setViewStaffClass] = useState(null);

  const [viewStaffList, setViewStaffList] = useState([]);

  // CLASS VIEW / ACTIONS MODAL
  const [showClassViewModal, setShowClassViewModal] = useState(false);
  const [viewClass, setViewClass] = useState(null);


  // ==========================================================
  // TOAST
  // ==========================================================

  const [toast, setToast] = useState(null);

  // Confirmation Warning Modal state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: 'Are you sure?',
    message: '',
    confirmText: 'Yes, Proceed',
    type: 'warning',
    onConfirm: null,
    loading: false
  });

  const requestConfirm = ({ title = 'Are you sure?', message, confirmText, type = 'warning', onConfirm }) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      confirmText,
      type,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, loading: true }));
        try {
          await onConfirm();
          setConfirmDialog(prev => ({ ...prev, isOpen: false, loading: false }));
        } catch (err) {
          setConfirmDialog(prev => ({ ...prev, loading: false }));
        }
      },
      loading: false
    });
  };


  const showToast = (msg, type = 'success') => {
    setToast({
      message: typeof msg === 'string' ? msg : (msg?.message || 'Action completed'),
      type
    });

    setTimeout(() => {
      setToast(null);
    }, 4000);
  };


  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {
    fetchInit();
  }, []);


  // ==========================================================
  // FETCH ALL INITIAL DATA
  // ==========================================================

  const fetchInit = async () => {

    setLoading(true);

    try {

      const [c, g, b, s, y] = await Promise.all([
        getClasses(),
        getAcademicGroups(),
        getBranches(),
        getStaff(),
        getAcademicYears().catch(() => ({ data: { academicYears: [] } }))
      ]);


      const rawClasses = c.data.classes || [];
      setAllClasses(rawClasses);

      const classRows = filterBranchItems(rawClasses);
      setClasses(classRows);


      // ------------------------------------------------------
      // CLASS DROPDOWN
      //
      // Backend now returns:
      //
      // classOptions
      //
      // Example:
      //
      // Class 10
      // Class 11
      // Class 12
      // ------------------------------------------------------

      const dbClassOptions = (c.data.classOptions && Array.isArray(c.data.classOptions))
        ? c.data.classOptions
            .map(item => {
              if (typeof item === 'string') return item;
              return item.className || item.class_name || item.name || '';
            })
            .filter(Boolean)
            .map(name => String(name).trim())
        : classRows
            .map(item => item.class_name || item.name)
            .filter(Boolean)
            .map(name => String(name).trim());

      const combined = [...dbClassOptions, ...DEFAULT_CLASS_OPTIONS];
      const seenNorm = new Set();
      const uniqueClassOptions = [];
      combined.forEach(opt => {
        const norm = String(opt || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (norm && !seenNorm.has(norm)) {
          seenNorm.add(norm);
          uniqueClassOptions.push(opt);
        }
      });

      setClassOptions(uniqueClassOptions);


      // ------------------------------------------------------
      // SECTIONS BY CLASS
      //
      // Backend returns something like:
      //
      // {
      //   "Class 10": [
      //      {
      //        section: "A",
      //        classId: 4
      //      }
      //   ],
      //
      //   "Class 11": [
      //      {
      //        section: "A",
      //        classId: 6
      //   ]
      // }
      // ------------------------------------------------------

      if (
        c.data.sectionsByClass &&
        typeof c.data.sectionsByClass === 'object'
      ) {

        setSectionsByClass(c.data.sectionsByClass);

      } else {

        // Fallback: build sections from class rows

        const sectionMap = {};


        classRows.forEach(item => {

          const className = String(
            item.class_name || item.name || ''
          ).trim();

          const section = String(
            item.section || ''
          ).trim();


          if (!className || !section) {
            return;
          }


          if (!sectionMap[className]) {
            sectionMap[className] = [];
          }


          const alreadyExists = sectionMap[className].some(
            existing => existing.section === section
          );


          if (!alreadyExists) {

            sectionMap[className].push({
              section: section,
              classId: item.id
            });

          }

        });


        setSectionsByClass(sectionMap);
      }


      // ------------------------------------------------------
      // OTHER DATA
      // ------------------------------------------------------

      setGroups(g.data.groups || []);

      setBranches(filterBranches(b.data.branches || []));

      setStaff(s.data.staff || []);

      const dbYears = (y?.data?.academicYears && Array.isArray(y.data.academicYears))
        ? y.data.academicYears
        : [];
      const combinedYears = Array.from(new Set([...dbYears, ...DEFAULT_ACADEMIC_YEARS]));
      setAcademicYears(combinedYears);


    } catch (error) {

      console.error('Failed to load classes:', error);

    }


    setLoading(false);
  };


  // ==========================================================
  // FETCH CLASSES WHEN FILTER CHANGES
  // ==========================================================

  const fetchClasses = async () => {

    const params = {};


    if (filterGroup) {
      params.academic_group_id = filterGroup;
    }


    if (filterBranch) {
      params.branch_id = filterBranch;
    }

    if (filterAcademicYear) {
      params.academic_year = filterAcademicYear;
    }


    try {

      const r = await getClasses(params);


      setClasses(
        filterBranchItems(r.data.classes || [])
      );


    } catch (error) {

      console.error('Failed to fetch classes:', error);

    }

  };


  useEffect(() => {

    fetchClasses();

  }, [filterGroup, filterBranch, filterAcademicYear]);


  const normalizeString = (str) => {
    return String(str || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  };

  const isSectionExistingForClass = (className, sectionName, excludeId = null, branchId = null, academicYear = null) => {
    if (!className || !sectionName) return false;
    const cNameNorm = normalizeString(className);
    const sNameNorm = normalizeString(sectionName);
    const targetBranch = branchId ? Number(branchId) : null;
    const targetYear = (academicYear || '').trim();
    const poolToCheck = allClasses.length > 0 ? allClasses : classes;

    return poolToCheck.some(c => {
      if (excludeId && c.id === excludeId) return false;
      const rawName = normalizeString(c.class_name || c.name);
      const rawSec = normalizeString(c.section);

      if (rawSec !== sNameNorm) return false;

      const cBranch = c.branch_id ? Number(c.branch_id) : null;
      const sameBranch = targetBranch === null || cBranch === null || targetBranch === cBranch;
      if (!sameBranch) return false;

      if (targetYear && c.academic_year) {
        if (targetYear !== c.academic_year.trim()) return false;
      }

      if (rawName === cNameNorm) return true;

      // Handle cases where section is suffix in class name, e.g. "class10a" vs "class10"
      const strippedRawName = rawSec && rawName.endsWith(rawSec) ? rawName.slice(0, -rawSec.length) : rawName;
      const strippedInputName = sNameNorm && cNameNorm.endsWith(sNameNorm) ? cNameNorm.slice(0, -sNameNorm.length) : cNameNorm;

      return (
        strippedRawName === strippedInputName ||
        strippedRawName === cNameNorm ||
        rawName === strippedInputName
      );
    });
  };


  // ==========================================================
  // GET SECTIONS FOR SELECTED CLASS
  // ==========================================================

  const getSectionsForClass = (className) => {
    if (!className) {
      return DEFAULT_SECTION_OPTIONS;
    }

    const normTarget = normalizeString(className);
    let matchingSections = [];
    Object.keys(sectionsByClass).forEach(key => {
      if (normalizeString(key) === normTarget) {
        matchingSections = matchingSections.concat(sectionsByClass[key] || []);
      }
    });

    const dbSections = matchingSections
      .map(item => {
        if (typeof item === 'string') {
          return item;
        }
        return item.section || '';
      })
      .filter(Boolean)
      .map(section => String(section).trim());

    return Array.from(new Set([...DEFAULT_SECTION_OPTIONS, ...dbSections]));
  };


  const executeSave = async () => {
    const editingClass = editItem;
    setSaving(true);

    try {
      const payload = {
        name: form.name.trim(),
        section: form.section.trim(),
        academicGroupId: form.academicGroupId || null,
        branchId: form.branchId,
        academicYear: (form.academicYear || '').trim(),
        teacherId: form.teacherId || null,
        isActive: form.isActive
      };

      if (editItem) {
        await updateClass(
          editItem.id,
          payload
        );
        showToast('Class updated!');
      } else {
        await createClass(payload);
        showToast('Class created!');
      }

      setShowModal(false);
      setEditItem(null);
      setForm(emptyForm);
      setFormError('');

      await fetchInit();

      if (editingClass) {
        const branchObj = branches.find(b => String(b.id) === String(form.branchId));
        const updatedClass = {
          ...editingClass,
          name: form.name.trim(),
          class_name: form.name.trim(),
          section: form.section.trim(),
          branch_id: form.branchId ? Number(form.branchId) : editingClass.branch_id,
          branch_name: branchObj ? branchObj.name : editingClass.branch_name,
          academic_year: (form.academicYear || '').trim(),
          is_active: form.isActive
        };
        returnToClassView(updatedClass);
      }
    } catch (error) {
      console.error(
        'Error saving class:',
        error
      );

      const errMsg = error.response?.data?.message || 'Error occurred while saving class.';
      setFormError(errMsg);
      showToast(errMsg, 'error');
    }

    setSaving(false);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setFormError('');

    const trimmedName = (form.name || '').trim();
    const trimmedSection = (form.section || '').trim();
    const branchIdVal = form.branchId;
    const academicYearVal = (form.academicYear || '').trim();

    if (!trimmedName) {
      setFormError('Class Name is required!');
      showToast('Class Name is required!', 'error');
      return;
    }

    if (!trimmedSection) {
      setFormError('Section is required!');
      showToast('Section is required!', 'error');
      return;
    }

    if (!branchIdVal) {
      setFormError('Branch is required!');
      showToast('Branch is required!', 'error');
      return;
    }

    if (!academicYearVal) {
      setFormError('Academic Year is required!');
      showToast('Academic Year is required!', 'error');
      return;
    }

    if (!form.teacherId) {
      setFormError('Assigned Staff is required!');
      showToast('Assigned Staff is required!', 'error');
      return;
    }

    // Duplicate validation
    if (isSectionExistingForClass(trimmedName, trimmedSection, editItem?.id, branchIdVal, academicYearVal)) {
      const errMsg = `Class "${trimmedName}" with section "${trimmedSection}" already exists in this branch and academic year.`;
      setFormError(errMsg);
      showToast(errMsg, 'error');
      return;
    }

    if (!editItem) {
      const branchObj = branches.find(b => String(b.id) === String(branchIdVal));
      const branchLabel = branchObj ? ` (${branchObj.name})` : '';
      const staffObj = staff.find(s => String(s.id) === String(form.teacherId));
      const staffLabel = staffObj ? `, Staff: ${staffObj.full_name}` : '';
      requestConfirm({
        title: 'Are you sure?',
        message: `Are you sure you want to add new class "${trimmedName}" (${trimmedSection})${branchLabel} for academic year ${academicYearVal}${staffLabel}?`,
        confirmText: 'Yes, Add Class',
        type: 'primary',
        onConfirm: async () => {
          await executeSave();
        }
      });
      return;
    }

    await executeSave();
  };


  // ==========================================================
  // OPEN STAFF ASSIGNMENT MODAL
  // ==========================================================

  const openAssignStaffModal = (c) => {

    setSelectedClass(c);


    const initialIds =
      c.teacher_ids &&
      Array.isArray(c.teacher_ids)
        ? c.teacher_ids
        : (
            c.teacher_id
              ? [c.teacher_id]
              : []
          );


    setSelectedTeacherIds(initialIds);

    setShowStaffModal(true);
  };

  const openClassView = (c) => {
    setViewClass(c);
    setShowClassViewModal(true);
  };

  const returnToClassView = (c = viewClass || selectedClass) => {
    if (c) {
      setViewClass(c);
      setShowClassViewModal(true);
    }
  };

  const openEditClass = (c) => {
    setEditItem(c);
    setFormError('');
    const yr = c.academic_year || '2026-2027';
    if (yr && !academicYears.includes(yr)) {
      setAcademicYears(prev => [yr, ...prev]);
    }
    setForm({
      name: c.class_name || c.name || '',
      section: c.section || '',
      academicGroupId: c.academic_group_id || '',
      branchId: c.branch_id ? String(c.branch_id) : (getBranchScope() || ''),
      academicYear: yr,
      teacherId: c.teacher_id || '',
      isActive: c.is_active !== undefined ? c.is_active : true
    });
    setShowClassViewModal(false);
    setShowModal(true);
  };

  const closeClassEdit = () => {
    const classToView = editItem || viewClass;
    setShowModal(false);
    setEditItem(null);
    setForm(emptyForm);
    setFormError('');
    returnToClassView(classToView);
  };

  const closeStaffAssignment = () => {
    setShowStaffModal(false);
    returnToClassView(selectedClass);
  };


  // ==========================================================
  // VIEW ASSIGNED STAFF
  // ==========================================================

  const openViewStaffDetails = (c) => {

    const assigned = staff.filter(st =>

      (
        c.teacher_ids &&
        Array.isArray(c.teacher_ids) &&
        c.teacher_ids.includes(st.id)
      )

      ||

      c.teacher_id === st.id

    );


    setViewStaffClass(c);

    setViewStaffList(assigned);

    setShowViewStaffModal(true);
  };


  // ==========================================================
  // SAVE STAFF ASSIGNMENT
  // ==========================================================

  const handleSaveStaffAssignment = async () => {

    if (!selectedClass) {
      return;
    }

    if (!selectedTeacherIds || selectedTeacherIds.length === 0) {
      showToast('Please select at least one staff member.', 'error');
      return;
    }

    const assignedClass = selectedClass;
    setAssigning(true);


    try {

      await updateClass(
        selectedClass.id,
        {
          teacherIds: selectedTeacherIds
        }
      );


      showToast(
        `Staff assignments updated for ${selectedClass.name}!`
      );


      setShowStaffModal(false);


      await fetchInit();

      returnToClassView({
        ...assignedClass,
        teacher_ids: selectedTeacherIds,
        teacher_id: selectedTeacherIds[0] || null
      });


    } catch (error) {

      console.error(
        'Failed to assign staff:',
        error
      );


      showToast(
        'Failed to assign staff.'
      );

    }


    setAssigning(false);
  };


  // ==========================================================
  // TOGGLE CLASS STATUS
  // ==========================================================

  const handleToggleStatus = (c) => {
    const nextStatus = !c.is_active;
    requestConfirm({
      title: 'Are you sure?',
      message: `Are you sure you want to ${nextStatus ? 'activate' : 'deactivate'} class "${c.name}"?`,
      confirmText: nextStatus ? 'Yes, Activate' : 'Yes, Deactivate',
      type: nextStatus ? 'success' : 'warning',
      onConfirm: async () => {
        try {
          await updateClass(
            c.id,
            {
              isActive: nextStatus
            }
          );

          showToast(
            `Class "${c.name}" ${
              nextStatus
                ? 'activated'
                : 'deactivated'
            }.`
          );

          await fetchInit();

          returnToClassView({
            ...c,
            is_active: nextStatus
          });
        } catch (error) {
          console.error(
            'Failed to update status:',
            error
          );

          showToast(
            'Failed to update class status.',
            'error'
          );
        }
      }
    });
  };


  // ==========================================================
  // DELETE CLASS
  // ==========================================================

  const handleDelete = (c) => {
    requestConfirm({
      title: 'Are you sure?',
      message: `Are you sure you want to delete class "${c.name}"? This action cannot be undone.`,
      confirmText: 'Yes, Delete',
      type: 'danger',
      onConfirm: async () => {
        try {
          await deleteClass(c.id);
          showToast('Class deleted.');
          await fetchInit();
        } catch (error) {
          console.error(
            'Failed to delete class:',
            error
          );
          showToast(
            'Failed to delete class.',
            'error'
          );
        }
      }
    });
  };


  // ==========================================================
  // FILTER SEARCH
  // ==========================================================

  const filtered = classes.filter(c => {
    if (filterAcademicYear && c.academic_year && c.academic_year !== filterAcademicYear) {
      return false;
    }

    return (
      !search ||
      `${c.name} ${c.section} ${c.branch_name || ''} ${c.academic_year || ''} ${c.teacher_name || ''}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  });


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <Layout
      title="Classes"
      subtitle="Manage classes, sections, and staff assignments"
    >

      {/* =====================================================
          TOAST
      ====================================================== */}

      {toast && (
        <div
          className={`alert alert-${toast.type === 'error' ? 'danger' : 'success'}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          {toast.type === 'error' ? (
            <MdCancel size={18} />
          ) : (
            <MdCheckCircle size={18} />
          )}
          <span>{toast.message}</span>
        </div>
      )}


      {/* =====================================================
          TOOLBAR
      ====================================================== */}

      <div className="toolbar">

        <div className="toolbar-left">

          {/* SEARCH */}

          <div className="search-box">

            <MdSearch color="var(--text-muted)" />

            <input
              placeholder="Search classes, sections, teachers..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
            />

          </div>


          {/* ACADEMIC GROUP FILTER */}

          <select
            className="input"
            style={{
              width: 160,
              padding: '9px 10px',
              fontSize: 13
            }}
            value={filterGroup}
            onChange={(e) =>
              setFilterGroup(e.target.value)
            }
          >

            <option value="">
              All Groups
            </option>

            {groups.map(g => (

              <option
                key={g.id}
                value={g.id}
              >
                {g.name}
              </option>

            ))}

          </select>


          {/* BRANCH FILTER */}

          <select
            className="input"
            style={{
              width: 160,
              padding: '9px 10px',
              fontSize: 13
            }}
            value={filterBranch}
            onChange={(e) =>
              setFilterBranch(e.target.value)
            }
          >

            <option value="">
              {isDedicatedBranchUser() ? 'Assigned Branch' : 'All Branches'}
            </option>

            {branches.map(b => (

              <option
                key={b.id}
                value={b.id}
              >
                {b.name}
              </option>

            ))}

          </select>


          {/* ACADEMIC YEAR FILTER */}

          <select
            className="input"
            style={{
              width: 160,
              padding: '9px 10px',
              fontSize: 13
            }}
            value={filterAcademicYear}
            onChange={(e) =>
              setFilterAcademicYear(e.target.value)
            }
          >

            <option value="">
              All Academic Years
            </option>

            {academicYears.map(yr => (

              <option
                key={yr}
                value={yr}
              >
                {yr}
              </option>

            ))}

          </select>


          <span
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)'
            }}
          >
            Showing {filtered.length} classes
          </span>

        </div>


        {/* ADD CLASS */}
        {!isReadOnly && (
          <button
            className="btn btn-primary"
            onClick={() => {
              setForm({
                ...emptyForm,
                branchId: getBranchScope() || (branches.length === 1 ? String(branches[0].id) : ''),
                academicYear: academicYears[0] || '2026-2027'
              });
              setEditItem(null);
              setFormError('');
              setShowModal(true);
            }}
          >
            <MdAdd />
            Add Class
          </button>
        )}
      </div>


      {/* =====================================================
          CLASS TABLE
      ====================================================== */}

      {loading ? (

        <div className="loading-overlay">

          <div className="spinner" />

          Loading classes...

        </div>

      ) : (

        <div className="table-container">

          <table>

            <thead>

              <tr>

                <th>Class Name</th>

                <th>Section</th>

                <th>Academic Group</th>

                <th>Branch</th>

                <th>Academic Year</th>

                <th>Assigned Staff</th>

                <th>Enrolled Students</th>

                <th>Status</th>

                <th>Actions</th>

              </tr>

            </thead>


            <tbody>

              {filtered.length === 0 ? (

                <tr>

                  <td colSpan={9}>

                    <div className="empty-state">

                      <div className="empty-state-icon">

                        <MdSchool />

                      </div>

                      <div className="empty-state-title">

                        No classes found

                      </div>

                    </div>

                  </td>

                </tr>

              ) : (

                filtered.map(c => (

                  <tr key={c.id}>

                    {/* CLASS NAME */}

                    <td>

                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 14
                        }}
                      >

                        {c.name}

                      </div>

                    </td>


                    {/* SECTION */}

                    <td>

                      {c.section || '—'}

                    </td>


                    {/* ACADEMIC GROUP */}

                    <td>

                      <span className="badge badge-purple">

                        {c.academic_group_name || '—'}

                      </span>

                    </td>


                    {/* BRANCH */}

                    <td
                      style={{
                        fontSize: 13
                      }}
                    >

                      {c.branch_name || '—'}

                    </td>


                    {/* ACADEMIC YEAR */}

                    <td
                      style={{
                        fontSize: 13
                      }}
                    >

                      <span className="badge badge-gray" style={{ fontSize: 12 }}>

                        {c.academic_year || '2026-2027'}

                      </span>

                    </td>


                    {/* ASSIGNED STAFF */}

                    <td
                      style={{
                        fontSize: 13
                      }}
                    >

                      {(() => {

                        const assigned =
                          staff.filter(st =>

                            (
                              c.teacher_ids &&
                              Array.isArray(c.teacher_ids) &&
                              c.teacher_ids.includes(st.id)
                            )

                            ||

                            c.teacher_id === st.id

                          );


                        const count =
                          assigned.length;


                        return (

                          <button

                            className={
                              `badge ${
                                count > 0
                                  ? 'badge-info'
                                  : 'badge-gray'
                              }`
                            }

                            style={{
                              cursor: 'pointer',
                              border: 'none',
                              padding: '6px 12px',
                              fontSize: 12,
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5
                            }}

                            onClick={() =>
                              openViewStaffDetails(c)
                            }

                            title="Click to view assigned staff details"

                          >

                            <MdPerson size={14} />

                            {count}{' '}

                            {count === 1
                              ? 'Staff'
                              : 'Staff'}

                          </button>

                        );

                      })()}

                    </td>


                    {/* STUDENTS */}

                    <td>

                      <span className="badge badge-info">

                        {c.student_count || 0}

                        {' students'}

                      </span>

                    </td>


                    {/* STATUS */}

                    <td>

                      <span
                        className={
                          `badge ${
                            c.is_active
                              ? 'badge-success'
                              : 'badge-danger'
                          }`
                        }
                      >

                        {c.is_active
                          ? '● Active'
                          : '● Inactive'}

                      </span>

                    </td>


                    {/* ACTIONS */}

                    <td>

                      <div className="table-actions">
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => openClassView(c)}
                          title="View class details and actions"
                        >
                          <MdVisibility size={14} />
                        </button>
                      </div>

                    </td>

                  </tr>

                ))

              )}

            </tbody>

          </table>

        </div>

      )}


      {/* CLASS DETAILS AND ACTIONS */}
      <Modal
        isOpen={showClassViewModal}
        onClose={() => { setShowClassViewModal(false); setViewClass(null); }}
        title={viewClass ? `${viewClass.name || viewClass.class_name}${viewClass.section ? ` (${viewClass.section})` : ''}` : 'Class Details'}
        size="sm"
        footer={<button className="btn btn-secondary" onClick={() => setShowClassViewModal(false)}>Close</button>}
      >
        {viewClass && (
          <div>
            <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
              <div><strong>Class:</strong> {viewClass.name || viewClass.class_name || '—'}</div>
              <div><strong>Section:</strong> {viewClass.section || '—'}</div>
              <div><strong>Branch:</strong> {viewClass.branch_name || '—'}</div>
              <div><strong>Academic Year:</strong> {viewClass.academic_year || '2026-2027'}</div>
              <div><strong>Status:</strong> {viewClass.is_active ? 'Active' : 'Inactive'}</div>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {!isReadOnly && (
                <>
                  <button className="btn btn-secondary" onClick={() => openEditClass(viewClass)}>
                    <MdEdit /> Edit Class
                  </button>
                  <button className="btn btn-secondary" onClick={() => { setShowClassViewModal(false); openAssignStaffModal(viewClass); }}>
                    <MdPerson /> Staff Allocation
                  </button>
                  <button
                    className="btn"
                    onClick={() => handleToggleStatus(viewClass)}
                    style={{ background: viewClass.is_active ? '#fef3c7' : '#dcfce7', color: viewClass.is_active ? '#d97706' : '#15803d' }}
                  >
                    {viewClass.is_active ? <MdCancel /> : <MdCheckCircle />}
                    {viewClass.is_active ? 'Mark Inactive' : 'Mark Active'}
                  </button>
                </>
              )}
              {canDelete && (
                <button className="btn btn-danger" onClick={() => { setShowClassViewModal(false); handleDelete(viewClass); }}>
                  <MdDelete /> Delete Class
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* =====================================================
          ADD / EDIT CLASS MODAL
      ======================================================*/}

      <Modal

        isOpen={showModal}

        onClose={closeClassEdit}

        title={
          editItem
            ? 'Edit Class'
            : 'Add New Class'
        }

        footer={

          <>

            <button
              className="btn btn-secondary"
              onClick={closeClassEdit}
            >
              Cancel
            </button>


            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={saving}
            >

              {saving
                ? 'Saving...'
                : (editItem ? 'Save Class' : 'Add Class')}

            </button>

          </>

        }

      >

        <form onSubmit={handleSubmit}>
          {formError && (
            <div
              className="alert alert-danger"
              style={{
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                fontWeight: 500
              }}
            >
              <MdCancel size={18} />
              <span>{formError}</span>
            </div>
          )}

          {/* =================================================
              CLASS + SECTION
          ================================================== */}

          <div className="form-row">

            {/* CLASS INPUT */}
            <div className="form-group">
              <label>
                Class Name *
              </label>
              <input
                type="text"
                className="input"
                placeholder="Enter class name (e.g. Class 1, Grade 10, UKG)"
                value={form.name}
                onChange={(e) => {
                  if (formError) setFormError('');
                  setForm({
                    ...form,
                    name: e.target.value
                  });
                }}
                required
              />
            </div>

            {/* SECTION INPUT */}
            <div className="form-group">
              <label>
                Section / Division *
              </label>
              <input
                type="text"
                className="input"
                placeholder="Enter section (e.g. A, B, Rose)"
                value={form.section}
                onChange={(e) => {
                  if (formError) setFormError('');
                  setForm({
                    ...form,
                    section: e.target.value
                  });
                }}
                required
              />
            </div>

          </div>


          {/* =================================================
              BRANCH + ACADEMIC YEAR (MANDATORY)
          ================================================== */}

          <div className="form-row">

            {/* BRANCH */}
            <div className="form-group">
              <label>
                Branch <span style={{ color: 'var(--danger, #ef4444)' }}>*</span>
              </label>
              <select
                className="input"
                value={form.branchId}
                onChange={(e) => {
                  if (formError) setFormError('');
                  setForm({
                    ...form,
                    branchId: e.target.value
                  });
                }}
                required
              >
                <option value="">
                  Select Branch
                </option>
                {branches.map(b => (
                  <option
                    key={b.id}
                    value={b.id}
                  >
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* ACADEMIC YEAR */}
            <div className="form-group">
              <label>
                Academic Year <span style={{ color: 'var(--danger, #ef4444)' }}>*</span>
              </label>
              <select
                className="input"
                value={form.academicYear}
                onChange={(e) => {
                  if (formError) setFormError('');
                  setForm({
                    ...form,
                    academicYear: e.target.value
                  });
                }}
                required
              >
                <option value="">
                  Select Academic Year
                </option>
                {academicYears.map(yr => (
                  <option
                    key={yr}
                    value={yr}
                  >
                    {yr}
                  </option>
                ))}
              </select>
            </div>

          </div>


          {/* =================================================
              ACADEMIC GROUP + ASSIGNED STAFF (OPTIONAL)
          ================================================== */}

          <div className="form-row">

            {/* ACADEMIC GROUP */}
            <div className="form-group">
              <label>
                Academic Group
              </label>
              <select
                className="input"
                value={form.academicGroupId}
                onChange={(e) => {
                  setForm({
                    ...form,
                    academicGroupId: e.target.value
                  });
                }}
              >
                <option value="">
                  Select Academic Group (Optional)
                </option>
                {groups.map(g => (
                  <option
                    key={g.id}
                    value={g.id}
                  >
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            {/* ASSIGNED STAFF */}
            <div className="form-group">
              <label>
                Assigned Staff <span style={{ color: 'var(--danger, #ef4444)' }}>*</span>
              </label>
              <select
                className="input"
                value={form.teacherId}
                onChange={(e) => {
                  if (formError) setFormError('');
                  setForm({
                    ...form,
                    teacherId: e.target.value
                  });
                }}
                required
              >
                <option value="">
                  Select Staff
                </option>
                {staff.map(st => (
                  <option
                    key={st.id}
                    value={st.id}
                  >
                    {st.full_name}
                    {st.staff_id
                      ? ` (${st.staff_id})`
                      : ''}
                  </option>
                ))}
              </select>
            </div>

          </div>


          {/* =================================================
              ACTIVE STATUS
          ================================================== */}

          {editItem && (

            <div

              className="form-group"

              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10
              }}

            >

              <input

                type="checkbox"

                id="classIsActive"

                checked={
                  form.isActive
                }

                onChange={(e) => {

                  setForm({

                    ...form,

                    isActive:
                      e.target.checked

                  });

                }}

                style={{
                  accentColor:
                    'var(--primary)',

                  width: 18,

                  height: 18
                }}

              />


              <label

                htmlFor="classIsActive"

                style={{
                  marginBottom: 0,
                  cursor: 'pointer',
                  fontWeight: 600
                }}

              >

                Active Class Status

              </label>

            </div>

          )}

        </form>

      </Modal>


      {/* =====================================================
          VIEW ASSIGNED STAFF DETAILS
      ====================================================== */}

      <Modal

        isOpen={showViewStaffModal}

        onClose={() =>
          setShowViewStaffModal(false)
        }

        title={

          viewStaffClass

            ? `Assigned Staff for ${
                viewStaffClass.name
              } ${
                viewStaffClass.section
                  ? '(' +
                    viewStaffClass.section +
                    ')'
                  : ''
              }`

            : 'Assigned Staff Details'

        }

        footer={

          <button
            className="btn btn-secondary"
            onClick={() =>
              setShowViewStaffModal(false)
            }
          >

            Close

          </button>

        }

      >

        <div>

          {viewStaffList.length === 0 ? (

            <div

              style={{
                padding: 24,
                textAlign: 'center',
                color: 'var(--text-muted)'
              }}

            >

              <MdPerson
                size={36}
                style={{
                  marginBottom: 8,
                  opacity: 0.5
                }}
              />


              <div
                style={{
                  fontWeight: 600,
                  fontSize: 14
                }}
              >

                No staff members assigned
                to this class.

              </div>


              <div
                style={{
                  fontSize: 12,
                  marginTop: 4
                }}
              >

                Use the assign button
                in the table to assign teachers.

              </div>

            </div>

          ) : (

            <div

              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                maxHeight: 350,
                overflowY: 'auto'
              }}

            >

              {viewStaffList.map(st => (

                <div

                  key={st.id}

                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    background: '#f8fafc'
                  }}

                >

                  <div

                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12
                    }}

                  >

                    <div

                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: '#e0f2fe',
                        color: '#0284c7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 16
                      }}

                    >

                      {(
                        st.first_name ||
                        st.full_name ||
                        'S'
                      )
                        .charAt(0)
                        .toUpperCase()}

                    </div>


                    <div>

                      <div

                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: 'var(--text-main)'
                        }}

                      >

                        {st.full_name}

                      </div>


                      <div

                        style={{
                          fontSize: 12,
                          color: 'var(--text-secondary)',
                          display: 'flex',
                          gap: 8,
                          marginTop: 2
                        }}

                      >

                        <span>

                          🆔 Staff ID:

                          {' '}

                          <strong>
                            {st.staff_id || '—'}
                          </strong>

                        </span>


                        <span>
                          • Role:
                        </span>


                        <span
                          className="badge badge-info"
                          style={{
                            padding: '2px 6px',
                            fontSize: 10
                          }}
                        >

                          {st.role_type}

                        </span>

                      </div>

                    </div>

                  </div>


                  <div

                    style={{
                      textAlign: 'right',
                      fontSize: 12,
                      color: 'var(--text-secondary)'
                    }}

                  >

                    {st.phone && (

                      <div>
                        <MdPerson style={{ verticalAlign: 'middle', marginRight: 4 }} /> {st.phone}
                      </div>

                    )}


                    {st.email && (

                      <div

                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted)'
                        }}

                      >

                        <MdPerson style={{ verticalAlign: 'middle', marginRight: 4 }} /> {st.email}

                      </div>

                    )}


                    {st.designation && (

                      <div

                        style={{
                          fontSize: 11,
                          color: '#4f46e5',
                          fontWeight: 600
                        }}

                      >

                        {st.designation}

                      </div>

                    )}

                  </div>

                </div>

              ))}

            </div>

          )}

        </div>

      </Modal>


      {/* =====================================================
          QUICK MULTI-STAFF ASSIGNMENT MODAL
      ====================================================== */}

      <Modal

        isOpen={showStaffModal}

        onClose={closeStaffAssignment}

        title={

          selectedClass

            ? `Assign Staff Members to ${
                selectedClass.name
              } ${
                selectedClass.section
                  ? '(' +
                    selectedClass.section +
                    ')'
                  : ''
              }`

            : 'Assign Staff Members'

        }

        footer={

          <>

            <button

              className="btn btn-secondary"

              onClick={closeStaffAssignment}

            >

              Cancel

            </button>


            <button

              className="btn btn-primary"

              onClick={
                handleSaveStaffAssignment
              }

              disabled={assigning}

            >

              {assigning
                ? 'Saving...'
                : 'Save Staff Assignments'}

            </button>

          </>

        }

      >

        <div>

          <p

            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              marginBottom: 16
            }}

          >

            Select all teachers / staff
            members to assign to{' '}

            <strong>

              {selectedClass?.name}{' '}

              {selectedClass?.section
                ? `(${selectedClass?.section})`
                : ''}

            </strong>

            :

          </p>


          {staff.length === 0 ? (

            <div

              style={{
                padding: 20,
                textAlign: 'center',
                color: 'var(--text-muted)'
              }}

            >

              No staff members found.

            </div>

          ) : (

            <div

              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 12,
                maxHeight: 300,
                overflowY: 'auto'
              }}

            >

              {staff.map(st => {

                const isChecked =
                  selectedTeacherIds.includes(
                    st.id
                  );


                return (

                  <label

                    key={st.id}

                    style={{

                      display: 'flex',

                      alignItems: 'center',

                      gap: 10,

                      padding: '10px 14px',

                      borderRadius: 8,

                      border:
                        `1.5px solid ${
                          isChecked
                            ? 'var(--primary)'
                            : '#e2e8f0'
                        }`,

                      background:
                        isChecked
                          ? '#f0fdf4'
                          : '#fff',

                      cursor: 'pointer',

                      transition:
                        'all 0.15s ease'

                    }}

                  >

                    <input

                      type="checkbox"

                      checked={isChecked}

                      onChange={(e) => {

                        if (
                          e.target.checked
                        ) {

                          setSelectedTeacherIds([
                            ...selectedTeacherIds,
                            st.id
                          ]);

                        } else {

                          setSelectedTeacherIds(
                            selectedTeacherIds.filter(
                              id =>
                                id !== st.id
                            )
                          );

                        }

                      }}

                      style={{
                        accentColor:
                          'var(--primary)',
                        width: 16,
                        height: 16
                      }}

                    />


                    <div>

                      <div

                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--text-main)'
                        }}

                      >

                        {st.full_name}

                      </div>


                      <div

                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted)'
                        }}

                      >

                        {st.role_type}

                        {st.staff_id
                          ? ` • ID: ${st.staff_id}`
                          : ''}

                      </div>

                    </div>

                  </label>

                );

              })}

            </div>

          )}

        </div>
      </Modal>

      {/* Confirmation Warning Card Modal */}
      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText="Cancel"
        type={confirmDialog.type}
        loading={confirmDialog.loading}
      />
    </Layout>
  );
}