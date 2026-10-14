import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import { useAuth } from '../context/AuthContext';
import {
  getLeaves,
  applyLeave,
  updateLeave,
  deleteLeave,
  getLeaveTypes,
  createLeaveType,
  deleteLeaveType,
  getStaff
} from '../api';

import {
  MdAdd,
  MdCheck,
  MdClose,
  MdDelete,
  MdSearch,
  MdBeachAccess,
  MdFilterList,
  MdVisibility
} from 'react-icons/md';

import { format } from 'date-fns';

export default function LeaveManagement() {
  const { user, isReadOnly, canDelete } = useAuth();

  const [leaves, setLeaves] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [staff, setStaff] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [search, setSearch] = useState('');

  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);

  /* Review modal */
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewItem, setReviewItem] = useState(null);
  const [reviewAction, setReviewAction] = useState('approved');
  const [reviewComment, setReviewComment] = useState('');

  /* NEW: View Leave Details */
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const [formError, setFormError] = useState('');
  const [typeFormError, setTypeFormError] = useState('');

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

  const [form, setForm] = useState({
    staffId: '',
    leaveTypeId: '',
    leaveTypeName: '',
    fromDate: '',
    toDate: '',
    reason: ''
  });

  const [typeForm, setTypeForm] = useState({
    name: '',
    maxDays: 1
  });

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const isManagementRole = (value) =>
    /principal|management/i.test(String(value || ''));

  const isManagementUser =
    isManagementRole(user?.role) ||
    isManagementRole(user?.fullName) ||
    isManagementRole(user?.username);

  const isManagementStaff = (member) => {
    if (!member) return false;

    return (
      isManagementRole(member.designation) ||
      isManagementRole(member.role_type) ||
      isManagementRole(member.full_name) ||
      isManagementRole(member.username)
    );
  };

  const selectedStaff = staff.find((s) => s.id == form.staffId);
  const selectedStaffIsManagement = isManagementStaff(selectedStaff);

  useEffect(() => {
    fetchInit();
  }, []);

  const fetchInit = async () => {
    setLoading(true);

    try {
      const [l, lt, s] = await Promise.all([
        getLeaves(),
        getLeaveTypes(),
        getStaff()
      ]);

      setLeaves(l.data.leaves);
      setStats(l.data.stats);
      setLeaveTypes(lt.data.leaveTypes);
      setStaff(s.data.staff);
    } catch {}

    setLoading(false);
  };

  const fetchLeaves = async () => {
    const params = {};

    if (filterStatus) {
      params.status = filterStatus;
    }

    try {
      const r = await getLeaves(params);

      setLeaves(r.data.leaves);
      setStats(r.data.stats);
    } catch {}
  };

  useEffect(() => {
    fetchLeaves();
  }, [filterStatus]);

  /* =========================
     APPLY LEAVE
  ========================= */

  const executeApply = async () => {
    setSaving(true);

    try {
      const lt = leaveTypes.find((l) => l.id == form.leaveTypeId);

      const leaveStatus = selectedStaffIsManagement
        ? 'informed'
        : 'pending';

      await applyLeave({
        ...form,
        leaveTypeName: lt?.name || '',
        status: leaveStatus
      });

      showToast(
        leaveStatus === 'informed'
          ? 'Management leave informed successfully.'
          : 'Leave application submitted!'
      );

      setShowApplyModal(false);
      setFormError('');

      setForm({
        staffId: '',
        leaveTypeId: '',
        leaveTypeName: '',
        fromDate: '',
        toDate: '',
        reason: ''
      });

      fetchInit();
    } catch (err) {
      showToast(
        err.response?.data?.message || 'Error occurred.'
      );
    }

    setSaving(false);
  };

  const handleApply = (e) => {
    e?.preventDefault();

    if (!form.staffId || !form.fromDate || !form.toDate) {
      setFormError(
        'Please select a staff member and enter both the from and to dates.'
      );
      return;
    }

    if (form.toDate < form.fromDate) {
      setFormError('The to date cannot be earlier than the from date.');
      return;
    }

    setFormError('');

    requestConfirm({
      title: 'Are you sure?',
      message: 'Are you sure you want to submit this leave application?',
      confirmText: 'Yes, Submit Leave',
      type: 'primary',
      onConfirm: async () => {
        await executeApply();
      }
    });
  };

  /* =========================
     OPEN LEAVE DETAILS
  ========================= */

  const openLeaveDetails = (leave) => {
    setSelectedLeave(leave);
    setShowDetailsModal(true);
  };

  /* =========================
     CLOSE LEAVE DETAILS
  ========================= */

  const closeLeaveDetails = () => {
    setShowDetailsModal(false);
    setSelectedLeave(null);
  };

  /* =========================
     OPEN APPROVE / REJECT
  ========================= */

  const openReviewModal = (leave, action) => {
    setReviewItem(leave);
    setReviewAction(action);
    setReviewComment('');
    setShowReviewModal(true);
  };

  /* =========================
     CONFIRM APPROVE / REJECT
  ========================= */

  const handleConfirmReview = async (e) => {
    e.preventDefault();

    if (!reviewItem) return;

    setSaving(true);

    try {
      await updateLeave(reviewItem.id, {
        status: reviewAction,
        reviewComment
      });

      showToast(
        `Leave application ${reviewAction}!`
      );

      setShowReviewModal(false);
      setReviewItem(null);
      setReviewComment('');

      /* Close details after approval/rejection */
      setShowDetailsModal(false);
      setSelectedLeave(null);

      await fetchLeaves();
    } catch {
      showToast('Failed to update leave request.');
    }

    setSaving(false);
  };

  /* =========================
     DELETE LEAVE
  ========================= */

  const handleDelete = (id) => {
    requestConfirm({
      title: 'Are you sure?',
      message: 'Are you sure you want to delete this leave record? This action cannot be undone.',
      confirmText: 'Yes, Delete',
      type: 'danger',
      onConfirm: async () => {
        try {
          await deleteLeave(id);
          showToast('Leave record deleted.');
          setShowDetailsModal(false);
          setSelectedLeave(null);
          fetchLeaves();
        } catch {
          showToast('Failed to delete.');
        }
      }
    });
  };

  /* =========================
     LEAVE TYPE
  ========================= */

  const executeAddType = async () => {
    setTypeFormError('');
    setSaving(true);

    try {
      await createLeaveType(typeForm);
      showToast('New leave type added!');
      setTypeForm({
        name: '',
        maxDays: 1
      });
      setTypeFormError('');
      fetchInit();
    } catch {
      showToast('Failed to add leave type.');
    }

    setSaving(false);
  };

  const handleAddType = (e) => {
    e?.preventDefault();

    if (!typeForm.name.trim()) {
      setTypeFormError('Leave type name is required.');
      return;
    }

    requestConfirm({
      title: 'Are you sure?',
      message: `Are you sure you want to add leave type "${typeForm.name}"?`,
      confirmText: 'Yes, Add Leave Type',
      type: 'primary',
      onConfirm: async () => {
        await executeAddType();
      }
    });
  };

  const handleDeleteType = (id) => {
    requestConfirm({
      title: 'Are you sure?',
      message: 'Are you sure you want to delete this leave type? This action cannot be undone.',
      confirmText: 'Yes, Delete',
      type: 'danger',
      onConfirm: async () => {
        try {
          await deleteLeaveType(id);
          showToast('Leave type deleted.');
          fetchInit();
        } catch {
          showToast('Failed to delete leave type.');
        }
      }
    });
  };

  /* =========================
     STATUS
  ========================= */

  const statusBadge = (status) => ({
    pending: 'badge-warning',
    approved: 'badge-success',
    rejected: 'badge-danger',
    informed: 'badge-secondary'
  }[status] || 'badge-gray');

  const statusLabel = (status) => ({
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    informed: 'Informed'
  }[status] || status);

  /* =========================
     FILTER
  ========================= */

  const filteredLeaves = leaves.filter((l) => {
    const matchesSearch =
      !search ||
      (l.staff_name || '')
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      (l.reason || '')
        .toLowerCase()
        .includes(search.toLowerCase());

    const matchesType =
      !filterType || l.leave_type_id == filterType;

    return matchesSearch && matchesType;
  });

  return (
    <Layout
      title="Leave Management"
      subtitle="Review staff leave applications, approve/reject requests, and configure leave types"
    >

      {/* Toast */}
      {toast && (
        <div className="alert alert-success">
          <MdCheck
            style={{
              verticalAlign: 'middle',
              marginRight: 6
            }}
          />
          {toast}
        </div>
      )}

      {/* =========================
          STATS CARDS
      ========================= */}

      <div
        style={{
          display: 'flex',
          gap: 16,
          marginBottom: 24
        }}
      >
        {[
          {
            label: 'Total Requests',
            value: stats.total || 0,
            color: 'var(--primary)',
            bg: '#eff6ff'
          },
          {
            label: 'Pending',
            value: stats.pending || 0,
            color: 'var(--warning)',
            bg: '#fffbeb'
          },
          {
            label: 'Approved',
            value: stats.approved || 0,
            color: 'var(--success)',
            bg: '#f0fdf4'
          },
          {
            label: 'Rejected',
            value: stats.rejected || 0,
            color: 'var(--danger)',
            bg: '#fef2f2'
          }
        ].map((s) => (
          <div
            key={s.label}
            className="stat-card"
            style={{
              flex: 1,
              padding: '16px'
            }}
          >
            <div
              className="stat-icon"
              style={{
                background: s.bg,
                width: 44,
                height: 44
              }}
            >
              <MdBeachAccess
                color={s.color}
                size={20}
              />
            </div>

            <div className="stat-info">
              <div
                className="stat-value"
                style={{
                  color: s.color,
                  fontSize: 22
                }}
              >
                {s.value}
              </div>

              <div className="stat-label">
                {s.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* =========================
          TOOLBAR
      ========================= */}

      <div className="toolbar">

        <div className="toolbar-left">

          <div className="search-box">
            <MdSearch color="var(--text-muted)" />

            <input
              placeholder="Search by staff name..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
            />
          </div>

          <select
            className="input"
            style={{
              width: 140,
              padding: '9px 10px',
              fontSize: 13
            }}
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(e.target.value)
            }
          >
            <option value="">
              All Statuses
            </option>

            <option value="pending">
              Pending
            </option>

            <option value="approved">
              Approved
            </option>

            <option value="rejected">
              Rejected
            </option>

            <option value="informed">
              Informed
            </option>
          </select>

          <select
            className="input"
            style={{
              width: 160,
              padding: '9px 10px',
              fontSize: 13
            }}
            value={filterType}
            onChange={(e) =>
              setFilterType(e.target.value)
            }
          >
            <option value="">
              All Leave Types
            </option>

            {leaveTypes.map((lt) => (
              <option
                key={lt.id}
                value={lt.id}
              >
                {lt.name}
              </option>
            ))}
          </select>

        </div>

        <div className="toolbar-right">

          {!isReadOnly && (
            <>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  setShowTypeModal(true)
                }
              >
                <MdFilterList
                  style={{
                    verticalAlign: 'middle',
                    marginRight: 6
                  }}
                />
                Manage Leave Types
              </button>

              <button
                className="btn btn-primary"
                onClick={() =>
                  setShowApplyModal(true)
                }
              >
                <MdAdd />
                {isManagementUser
                  ? 'Inform About Leave'
                  : 'Apply Leave'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* =========================
          LEAVE TABLE
      ========================= */}

      {loading ? (
        <div className="loading-overlay">
          <div className="spinner" />
          Loading leave requests...
        </div>
      ) : (
        <div className="table-container">

          <table>

            <thead>
              <tr>
                <th>Staff Member</th>
                <th>Leave Type</th>
                <th>From Date</th>
                <th>To Date</th>
                <th>Days</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Review Details</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>

              {filteredLeaves.length === 0 ? (
                <tr>
                  <td colSpan={9}>

                    <div className="empty-state">

                      <div className="empty-state-icon">
                        <MdBeachAccess />
                      </div>

                      <div className="empty-state-title">
                        No leave requests found
                      </div>

                    </div>

                  </td>
                </tr>
              ) : (

                filteredLeaves.map((l) => (

                  <tr key={l.id}>

                    {/* Staff */}
                    <td>

                      <div
                        style={{
                          fontWeight: 600
                        }}
                      >
                        {l.staff_name}
                      </div>

                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted)'
                        }}
                      >
                        {l.role_type} (
                        {l.branch_name || 'Main'}
                        )
                      </div>

                    </td>

                    {/* Leave Type */}
                    <td
                      style={{
                        fontSize: 13
                      }}
                    >
                      {l.leave_type_name || '—'}
                    </td>

                    {/* From */}
                    <td
                      style={{
                        fontSize: 13
                      }}
                    >
                      {l.from_date
                        ? format(
                            new Date(l.from_date),
                            'dd MMM yyyy'
                          )
                        : '—'}
                    </td>

                    {/* To */}
                    <td
                      style={{
                        fontSize: 13
                      }}
                    >
                      {l.to_date
                        ? format(
                            new Date(l.to_date),
                            'dd MMM yyyy'
                          )
                        : '—'}
                    </td>

                    {/* Days */}
                    <td>
                      <span className="badge badge-info">
                        {l.total_days} day
                        {l.total_days > 1
                          ? 's'
                          : ''}
                      </span>
                    </td>

                    {/* Reason */}
                    <td
                      style={{
                        fontSize: 13,
                        maxWidth: 180
                      }}
                      className="truncate"
                      title={l.reason}
                    >
                      {l.reason || '—'}
                    </td>

                    {/* Status */}
                    <td>

                      {isManagementStaff(l) ? (
                        <span
                          style={{
                            color:
                              'var(--text-muted)'
                          }}
                        >
                          —
                        </span>
                      ) : (
                        <span
                          className={`badge ${statusBadge(
                            l.status
                          )}`}
                        >
                          {statusLabel(l.status)}
                        </span>
                      )}

                    </td>

                    {/* Review Details */}
                    <td
                      style={{
                        fontSize: 12
                      }}
                    >

                      {l.reviewed_by_name && (
                        <div>
                          By: {l.reviewed_by_name}
                        </div>
                      )}

                      {l.review_comment && (
                        <div
                          style={{
                            color:
                              'var(--text-muted)'
                          }}
                        >
                          "{l.review_comment}"
                        </div>
                      )}

                      {!l.reviewed_by_name &&
                        !l.review_comment && (
                          <span
                            style={{
                              color:
                                'var(--text-muted)'
                            }}
                          >
                            —
                          </span>
                        )}

                    </td>

                    {/* NEW ACTION */}
                    <td>

                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() =>
                          openLeaveDetails(l)
                        }
                        title="View Leave Details"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          whiteSpace: 'nowrap'
                        }}
                      >
                        <MdVisibility size={15} />
                        View
                      </button>

                    </td>

                  </tr>

                ))

              )}

            </tbody>

          </table>

        </div>
      )}

      {/* =====================================================
          NEW: LEAVE DETAILS VIEW
      ===================================================== */}

      <Modal
        isOpen={showDetailsModal}
        onClose={closeLeaveDetails}
        title="Leave Application Details"
        size="lg"

        footer={
          <>

            <button
              className="btn btn-secondary"
              onClick={closeLeaveDetails}
            >
              Close
            </button>

            {selectedLeave &&
              selectedLeave.status !== 'informed' &&
              !isManagementStaff(selectedLeave) &&
              canDelete && (
                <button
                  className="btn"
                  style={{
                    background: '#f1f5f9',
                    color: '#475569'
                  }}
                  onClick={() =>
                    handleDelete(selectedLeave.id)
                  }
                >
                  <MdDelete
                    style={{
                      verticalAlign: 'middle',
                      marginRight: 5
                    }}
                  />
                  Delete
                </button>
              )}

            {selectedLeave &&
              selectedLeave.status === 'pending' &&
              !isManagementStaff(selectedLeave) &&
              !isReadOnly && (
                <>
                  <button
                    className="btn btn-danger"
                    onClick={() =>
                      openReviewModal(
                        selectedLeave,
                        'rejected'
                      )
                    }
                  >
                    <MdClose
                      style={{
                        verticalAlign: 'middle',
                        marginRight: 5
                      }}
                    />
                    Reject
                  </button>

                  <button
                    className="btn btn-success"
                    onClick={() =>
                      openReviewModal(
                        selectedLeave,
                        'approved'
                      )
                    }
                  >
                    <MdCheck
                      style={{
                        verticalAlign: 'middle',
                        marginRight: 5
                      }}
                    />
                    Approve
                  </button>
                </>
              )}

          </>
        }
      >

        {selectedLeave && (

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 20
            }}
          >

            {/* =========================
                STAFF INFORMATION
            ========================= */}

            <div
              style={{
                background: '#f8fafc',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: 16
              }}
            >

              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  marginBottom: 12,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}
              >
                Staff Information
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(2, minmax(0, 1fr))',
                  gap: 16
                }}
              >

                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      marginBottom: 4
                    }}
                  >
                    Staff Member
                  </div>

                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700
                    }}
                  >
                    {selectedLeave.staff_name ||
                      '—'}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      marginBottom: 4
                    }}
                  >
                    Role / Designation
                  </div>

                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600
                    }}
                  >
                    {selectedLeave.role_type ||
                      '—'}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      marginBottom: 4
                    }}
                  >
                    Branch
                  </div>

                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600
                    }}
                  >
                    {selectedLeave.branch_name ||
                      'Main'}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      marginBottom: 4
                    }}
                  >
                    Staff ID
                  </div>

                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600
                    }}
                  >
                    {selectedLeave.staff_id ||
                      selectedLeave.staffId ||
                      '—'}
                  </div>
                </div>

              </div>

            </div>

            {/* =========================
                LEAVE INFORMATION
            ========================= */}

            <div
              style={{
                background: '#ffffff',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: 16
              }}
            >

              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  marginBottom: 16,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}
              >
                Leave Information
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(3, minmax(0, 1fr))',
                  gap: 18
                }}
              >

                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      marginBottom: 5
                    }}
                  >
                    Leave Type
                  </div>

                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600
                    }}
                  >
                    {selectedLeave.leave_type_name ||
                      '—'}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      marginBottom: 5
                    }}
                  >
                    From Date
                  </div>

                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600
                    }}
                  >
                    {selectedLeave.from_date
                      ? format(
                          new Date(
                            selectedLeave.from_date
                          ),
                          'dd MMM yyyy'
                        )
                      : '—'}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      marginBottom: 5
                    }}
                  >
                    To Date
                  </div>

                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600
                    }}
                  >
                    {selectedLeave.to_date
                      ? format(
                          new Date(
                            selectedLeave.to_date
                          ),
                          'dd MMM yyyy'
                        )
                      : '—'}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      marginBottom: 5
                    }}
                  >
                    Total Days
                  </div>

                  <div>
                    <span className="badge badge-info">
                      {selectedLeave.total_days}{' '}
                      day
                      {selectedLeave.total_days >
                      1
                        ? 's'
                        : ''}
                    </span>
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      marginBottom: 5
                    }}
                  >
                    Status
                  </div>

                  {isManagementStaff(
                    selectedLeave
                  ) ? (
                    <span
                      style={{
                        color:
                          'var(--text-muted)'
                      }}
                    >
                      Inform only
                    </span>
                  ) : (
                    <span
                      className={`badge ${statusBadge(
                        selectedLeave.status
                      )}`}
                    >
                      {statusLabel(
                        selectedLeave.status
                      )}
                    </span>
                  )}
                </div>

              </div>

            </div>

            {/* =========================
                REASON
            ========================= */}

            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: 16
              }}
            >

              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  marginBottom: 7,
                  fontWeight: 600,
                  textTransform: 'uppercase'
                }}
              >
                Reason for Leave
              </div>

              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: 'var(--text-primary)',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {selectedLeave.reason ||
                  'No reason provided.'}
              </div>

            </div>

            {/* =========================
                REVIEW DETAILS
            ========================= */}

            {(selectedLeave.reviewed_by_name ||
              selectedLeave.review_comment) && (

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: 16
                }}
              >

                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    marginBottom: 12
                  }}
                >
                  Review Details
                </div>

                {selectedLeave.reviewed_by_name && (
                  <div
                    style={{
                      fontSize: 13,
                      marginBottom: 7
                    }}
                  >
                    <strong>
                      Reviewed by:
                    </strong>{' '}
                    {selectedLeave.reviewed_by_name}
                  </div>
                )}

                {selectedLeave.review_comment && (
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--text-secondary)'
                    }}
                  >
                    <strong>
                      Review comment:
                    </strong>{' '}
                    "{selectedLeave.review_comment}"
                  </div>
                )}

              </div>

            )}

          </div>

        )}

      </Modal>

      {/* =====================================================
          APPLY LEAVE MODAL
      ===================================================== */}

      <Modal
        isOpen={showApplyModal}
        onClose={() => {
          setShowApplyModal(false);
          setFormError('');
        }}
        title={
          isManagementUser
            ? 'Inform About Leave'
            : 'Apply for Staff Leave'
        }
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() =>
                setShowApplyModal(false)
              }
            >
              Cancel
            </button>

            <button
              className="btn btn-primary"
              onClick={handleApply}
              disabled={saving}
            >
              {saving
                ? 'Submitting...'
                : isManagementUser
                ? 'Inform Leave'
                : 'Submit Leave'}
            </button>
          </>
        }
      >

        <form onSubmit={handleApply}>

          {formError && (
            <div
              className="alert alert-danger"
              style={{
                marginBottom: 12,
                color: '#b91c1c'
              }}
            >
              {formError}
            </div>
          )}

          {isManagementUser && (
            <div
              className="alert alert-info"
              style={{
                marginBottom: 12
              }}
            >
              Management leave is recorded as an
              informed leave and does not require
              approval or rejection.
            </div>
          )}

          <div className="form-group">

            <label>
              Staff Member *
            </label>

            <select
              className="input"
              value={form.staffId}
              onChange={(e) =>
                setForm({
                  ...form,
                  staffId: e.target.value
                })
              }
              required
            >
              <option value="">
                Select Staff
              </option>

              {staff.map((s) => (
                <option
                  key={s.id}
                  value={s.id}
                >
                  {s.full_name} ({s.role_type})
                </option>
              ))}
            </select>

          </div>

          {selectedStaffIsManagement && (
            <div
              className="alert alert-warning"
              style={{
                marginBottom: 12
              }}
            >
              This staff member is part of
              management. The leave will be recorded
              as informed, with no approval actions.
            </div>
          )}

          <div className="form-group">

            <label>
              Leave Type
            </label>

            <select
              className="input"
              value={form.leaveTypeId}
              onChange={(e) =>
                setForm({
                  ...form,
                  leaveTypeId: e.target.value
                })
              }
            >
              <option value="">
                Select Leave Type
              </option>

              {leaveTypes.map((lt) => (
                <option
                  key={lt.id}
                  value={lt.id}
                >
                  {lt.name} (Max {lt.max_days} days)
                </option>
              ))}
            </select>

          </div>

          <div className="form-row">

            <div className="form-group">

              <label>
                From Date *
              </label>

              <input
                className="input"
                type="date"
                value={form.fromDate}
                onChange={(e) =>
                  setForm({
                    ...form,
                    fromDate: e.target.value
                  })
                }
                required
              />

            </div>

            <div className="form-group">

              <label>
                To Date *
              </label>

              <input
                className="input"
                type="date"
                min={form.fromDate}
                value={form.toDate}
                onChange={(e) =>
                  setForm({
                    ...form,
                    toDate: e.target.value
                  })
                }
                required
              />

            </div>

          </div>

          <div className="form-group">

            <label>
              Reason for Leave
            </label>

            <textarea
              className="input"
              placeholder="Enter reason for leave..."
              value={form.reason}
              onChange={(e) =>
                setForm({
                  ...form,
                  reason: e.target.value
                })
              }
              rows={3}
            />

          </div>

        </form>

      </Modal>

      {/* =====================================================
          APPROVE / REJECT MODAL
      ===================================================== */}

      <Modal
        isOpen={showReviewModal}
        onClose={() =>
          setShowReviewModal(false)
        }
        title={
          `${
            reviewAction === 'approved'
              ? 'Approve'
              : 'Reject'
          } Leave Request`
        }
        size="sm"
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() =>
                setShowReviewModal(false)
              }
            >
              Cancel
            </button>

            <button
              className={`btn ${
                reviewAction === 'approved'
                  ? 'btn-success'
                  : 'btn-danger'
              }`}
              onClick={handleConfirmReview}
              disabled={saving}
            >
              {saving
                ? 'Processing...'
                : `Confirm ${
                    reviewAction === 'approved'
                      ? 'Approval'
                      : 'Rejection'
                  }`}
            </button>
          </>
        }
      >

        <form onSubmit={handleConfirmReview}>

          <p
            style={{
              fontSize: 13,
              marginBottom: 12
            }}
          >
            Staff:{' '}
            <strong>
              {reviewItem?.staff_name}
            </strong>{' '}
            ({reviewItem?.total_days} days leave
            from{' '}
            {reviewItem?.from_date
              ? format(
                  new Date(reviewItem.from_date),
                  'dd MMM'
                )
              : ''}
            {' '}to{' '}
            {reviewItem?.to_date
              ? format(
                  new Date(reviewItem.to_date),
                  'dd MMM'
                )
              : ''}
            )
          </p>

          <div className="form-group">

            <label>
              Approval / Rejection Comment
              (Optional)
            </label>

            <textarea
              className="input"
              placeholder="e.g. Approved by Principal / Documentation required"
              value={reviewComment}
              onChange={(e) =>
                setReviewComment(
                  e.target.value
                )
              }
              rows={3}
            />

          </div>

        </form>

      </Modal>

      {/* =====================================================
          MANAGE LEAVE TYPES MODAL
      ===================================================== */}

      <Modal
        isOpen={showTypeModal}
        onClose={() => {
          setShowTypeModal(false);
          setTypeFormError('');
        }}
        title="Manage Organisation Leave Types"
        size="lg"
        footer={
          <button
            className="btn btn-secondary"
            onClick={() =>
              setShowTypeModal(false)
            }
          >
            Close
          </button>
        }
      >

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 20
          }}
        >

          <form
            onSubmit={handleAddType}
            style={{
              background: 'var(--bg)',
              padding: 16,
              borderRadius: 'var(--radius-sm)'
            }}
          >

            <h4
              style={{
                fontSize: 14,
                fontWeight: 700,
                marginBottom: 12
              }}
            >
              Add New Leave Type
            </h4>

            {typeFormError && (
              <div
                className="alert alert-danger"
                style={{
                  marginBottom: 12,
                  color: '#b91c1c'
                }}
              >
                {typeFormError}
              </div>
            )}

            <div className="form-row">

              <div
                className="form-group"
                style={{
                  marginBottom: 0
                }}
              >

                <label>
                  Type Name *
                </label>

                <input
                  className="input"
                  placeholder="e.g. Casual Leave, Sabbatical"
                  value={typeForm.name}
                  onChange={(e) =>
                    setTypeForm({
                      ...typeForm,
                      name: e.target.value
                    })
                  }
                  required
                />

              </div>

              <div
                className="form-group"
                style={{
                  marginBottom: 0
                }}
              >

                <label>
                  Max Days Allowed
                </label>

                <input
                  className="input"
                  type="number"
                  min={1}
                  value={typeForm.maxDays}
                  onChange={(e) =>
                    setTypeForm({
                      ...typeForm,
                      maxDays:
                        parseInt(
                          e.target.value
                        ) || 1
                    })
                  }
                />

              </div>

            </div>

            <button
              type="submit"
              className="btn btn-primary btn-sm"
              style={{
                marginTop: 12
              }}
              disabled={saving}
            >
              {saving
                ? 'Adding...'
                : '+ Add Leave Type'}
            </button>

          </form>

          <div>

            <h4
              style={{
                fontSize: 14,
                fontWeight: 700,
                marginBottom: 8
              }}
            >
              Existing Leave Types
            </h4>

            {leaveTypes.length === 0 ? (

              <div
                style={{
                  fontSize: 13,
                  color: 'var(--text-muted)'
                }}
              >
                No custom leave types created yet.
              </div>

            ) : (

              <div
                style={{
                  border:
                    '1px solid var(--border)',
                  borderRadius: 6,
                  overflow: 'hidden'
                }}
              >

                <table>

                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Max Days</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>

                    {leaveTypes.map((lt) => (

                      <tr key={lt.id}>

                        <td
                          style={{
                            fontWeight: 600,
                            fontSize: 13
                          }}
                        >
                          {lt.name}
                        </td>

                        <td
                          style={{
                            fontSize: 13
                          }}
                        >
                          {lt.max_days} days
                        </td>

                        <td>

                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() =>
                              handleDeleteType(
                                lt.id
                              )
                            }
                            title="Delete"
                          >
                            <MdDelete size={14} />
                          </button>

                        </td>

                      </tr>

                    ))}

                  </tbody>

                </table>

              </div>

            )}

          </div>

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