import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import {
  getClasses,
  createClass,
  updateClass,
  deleteClass,
  getAcademicGroups,
  getBranches,
  getStaff
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
// EMPTY FORM
// ============================================================

const emptyForm = {
  name: '',
  section: '',
  academicGroupId: '',
  branchId: '',
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

      const [c, g, b, s] = await Promise.all([
        getClasses(),
        getAcademicGroups(),
        getBranches(),
        getStaff()
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

  }, [filterGroup, filterBranch]);


  const normalizeString = (str) => {
    return String(str || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  };

  const isSectionExistingForClass = (className, sectionName, excludeId = null, branchId = null) => {
    if (!className || !sectionName) return false;
    const cNameNorm = normalizeString(className);
    const sNameNorm = normalizeString(sectionName);
    const targetBranch = branchId ? Number(branchId) : null;
    const poolToCheck = allClasses.length > 0 ? allClasses : classes;

    return poolToCheck.some(c => {
      if (excludeId && c.id === excludeId) return false;
      const rawName = normalizeString(c.class_name || c.name);
      const rawSec = normalizeString(c.section);

      if (rawSec !== sNameNorm) return false;

      const cBranch = c.branch_id ? Number(c.branch_id) : null;
      const sameBranch = targetBranch === null || cBranch === null || targetBranch === cBranch;
      if (!sameBranch) return false;

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


  // ==========================================================
  // SUBMIT ADD / EDIT CLASS
  // ==========================================================

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const trimmedName = (form.name || '').trim();
    const trimmedSection = (form.section || '').trim();

    if (!trimmedName) {
      setFormError('Class Name is required!');
      showToast('Class Name is required!', 'error');
      return;
    }

    if (!trimmedSection) {
      setFormError('Please select a Section!');
      showToast('Please select a Section!', 'error');
      return;
    }

    // Duplicate validation
    if (isSectionExistingForClass(trimmedName, trimmedSection, editItem?.id, form.branchId)) {
      const errMsg = `Class "${trimmedName}" with section "${trimmedSection}" already exists.`;
      setFormError(errMsg);
      showToast(errMsg, 'error');
      return;
    }

    const editingClass = editItem;
    setSaving(true);

    try {
      if (editItem) {
        await updateClass(
          editItem.id,
          form
        );
        showToast('Class updated!');
      } else {
        await createClass(form);
        showToast('Class created!');
      }

      setShowModal(false);
      setEditItem(null);
      setForm(emptyForm);
      setFormError('');

      await fetchInit();

      if (editingClass) {
        const updatedClass = {
          ...editingClass,
          name: form.name,
          class_name: form.name,
          section: form.section,
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
    setForm({
      name: c.class_name || c.name || '',
      section: c.section || '',
      academicGroupId: c.academic_group_id || '',
      branchId: c.branch_id || '',
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

  const handleToggleStatus = async (c) => {

    try {

      await updateClass(
        c.id,
        {
          isActive: !c.is_active
        }
      );


      showToast(
        `Class "${c.name}" ${
          !c.is_active
            ? 'activated'
            : 'deactivated'
        }.`
      );


      await fetchInit();

      returnToClassView({
        ...c,
        is_active: !c.is_active
      });


    } catch (error) {

      console.error(
        'Failed to update status:',
        error
      );


      showToast(
        'Failed to update class status.'
      );

    }
  };


  // ==========================================================
  // DELETE CLASS
  // ==========================================================

  const handleDelete = async (c) => {

    if (
      !confirm(
        `Delete class "${c.name}"?`
      )
    ) {
      return;
    }


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
        'Failed to delete class.'
      );

    }
  };


  // ==========================================================
  // FILTER SEARCH
  // ==========================================================

  const filtered = classes.filter(c =>

    !search ||

    `${c.name} ${
      c.section
    } ${
      c.teacher_name || ''
    }`
      .toLowerCase()
      .includes(
        search.toLowerCase()
      )

  );


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

        <button
          className="btn btn-primary"
          onClick={() => {
            setForm(emptyForm);
            setEditItem(null);
            setFormError('');
            setShowModal(true);
          }}
        >

          <MdAdd />

          Add Class

        </button>

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

                <th>Assigned Staff</th>

                <th>Enrolled Students</th>

                <th>Status</th>

                <th>Actions</th>

              </tr>

            </thead>


            <tbody>

              {filtered.length === 0 ? (

                <tr>

                  <td colSpan={8}>

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
              <div><strong>Status:</strong> {viewClass.is_active ? 'Active' : 'Inactive'}</div>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
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
              <button className="btn btn-danger" onClick={() => { setShowClassViewModal(false); handleDelete(viewClass); }}>
                <MdDelete /> Delete Class
              </button>
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
                : 'Save Class'}

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


            {/* CLASS DROPDOWN */}

            <div className="form-group">

              <label>
                Class *
              </label>


              <select

                className="input"

                value={form.name}

                onChange={(e) => {
                  if (formError) setFormError('');
                  setForm({

                    ...form,

                    name: e.target.value,

                    // Reset section when class changes
                    section: ''

                  });

                }}

                required

              >

                <option value="">
                  Select Class
                </option>


                {classOptions.map(
                  className => (

                    <option
                      key={className}
                      value={className}
                    >

                      {className}

                    </option>

                  )
                )}

              </select>

            </div>


            {/* SECTION DROPDOWN */}

            <div className="form-group">

              <label>
                Section / Division *
              </label>


              <select

                className="input"

                value={form.section}

                onChange={(e) => {
                  if (formError) setFormError('');
                  setForm({

                    ...form,

                    section:
                      e.target.value

                  });

                }}

                disabled={!form.name}
                required

              >

                <option value="">
                  Select Section
                </option>


                {getSectionsForClass(
                  form.name
                ).map(section => {
                  const alreadyExists = isSectionExistingForClass(
                    form.name,
                    section,
                    editItem?.id,
                    form.branchId
                  );
                  return (
                    <option
                      key={section}
                      value={section}
                    >
                      {section} {alreadyExists ? '(Already exists)' : ''}
                    </option>
                  );
                })}

              </select>

            </div>

          </div>


          {/* =================================================
              ACADEMIC GROUP + BRANCH
          ================================================== */}

          <div className="form-row">


            {/* ACADEMIC GROUP */}

            <div className="form-group">

              <label>
                Academic Group
              </label>


              <select

                className="input"

                value={
                  form.academicGroupId
                }

                onChange={(e) => {

                  setForm({

                    ...form,

                    academicGroupId:
                      e.target.value

                  });

                }}

              >

                <option value="">
                  Select Academic Group
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


            {/* BRANCH */}

            <div className="form-group">

              <label>
                Branch
              </label>


              <select

                className="input"

                value={
                  form.branchId
                }

                onChange={(e) => {

                  setForm({

                    ...form,

                    branchId:
                      e.target.value

                  });

                }}

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

          </div>


          {/* =================================================
              STAFF
          ================================================== */}

          <div className="form-group">

            <label>
              Assigned Staff
            </label>


            <select

              className="input"

              value={
                form.teacherId
              }

              onChange={(e) => {

                setForm({

                  ...form,

                  teacherId:
                    e.target.value

                });

              }}

            >

              <option value="">
                No staff assigned
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

    </Layout>

  );
}