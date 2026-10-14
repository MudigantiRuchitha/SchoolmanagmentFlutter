import { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import ExportCSVModal from '../components/ExportCSVModal';
import { useAuth } from '../context/AuthContext';
import { filterBranches, getBranchScope, isDedicatedBranchUser } from '../utils/branchScope';
import ClassSectionSelect from '../components/ClassSectionSelect';
import { getStaff, createStaff, updateStaff, deleteStaff, getBranches, getClasses, assignStaffClasses, bulkImportStaff } from '../api';
import { MdAdd, MdEdit, MdDelete, MdSearch, MdPeople, MdCheckCircle, MdCancel, MdDownload, MdUpload, MdClass, MdVisibility, MdVisibilityOff, MdFilePresent, MdPerson, MdWarning, MdAccessTime } from 'react-icons/md';
import { downloadCSV, filterRecordsByDateRange, generateExportFilename } from '../utils/csvExport';
const ROLES = ['teaching', 'non-teaching', 'management'];
const emptyForm = {
    staffId: '',
    firstName: '',
    lastName: '',
    username: '',
    password: '',
    phone: '',
    email: '',
    roleType: 'teaching',
    branchId: '',
    designation: '',
    gender: '',
    dateOfJoining: '',
    expectedCheckIn: '09:00',
    expectedCheckOut: '17:00',
    isActive: true
};
const cloneEmptyForm = () => ({ ...emptyForm });
const formatTime12 = (timeStr) => {
    if (!timeStr) return '09:00 AM';
    const clean = String(timeStr).slice(0, 5);
    const [h, m] = clean.split(':');
    if (h === undefined || m === undefined) return timeStr;
    const hourNum = parseInt(h, 10);
    const ampm = hourNum >= 12 ? 'PM' : 'AM';
    const formattedHour = hourNum % 12 === 0 ? 12 : hourNum % 12;
    return `${formattedHour}:${m} ${ampm}`;
};
const normalizeId = value => value === null || value === undefined ? '' : String(value).trim();
const normalizeStaffId = value => normalizeId(value).toLowerCase();
const cleanPhoneNumber = value => {
    let phone = String(value || '').replace(/\D/g, '');
    if (phone.length > 10 && phone.startsWith('91')) {
        phone = phone.slice(2);
    }
    return phone;
};
const csvEscape = value => {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
};
const parseCSV = text => {
    const rows = [];
    let row = [];
    let value = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        if (char === '"') {
            if (inQuotes && text[i + 1] === '"') {
                value += '"';
                i += 1;
            }
            else {
                inQuotes = !inQuotes;
            }
            continue;
        }
        if (char === ',' && !inQuotes) {
            row.push(value);
            value = '';
            continue;
        }
        if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && text[i + 1] === '\n') {
                i += 1;
            }
            row.push(value);
            value = '';
            if (row.some(cell => String(cell).trim() !== '')) {
                rows.push(row);
            }
            row = [];
            continue;
        }
        value += char;
    }
    if (value !== '' || row.length > 0) {
        row.push(value);
        if (row.some(cell => String(cell).trim() !== '')) {
            rows.push(row);
        }
    }
    return rows;
};
const normalizeHeader = value => String(value || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
const getAssignedTeacherIds = classItem => {
    const ids = [];
    if (Array.isArray(classItem?.teacher_ids)) {
        ids.push(...classItem.teacher_ids);
    }
    if (classItem?.teacher_id !== null &&
        classItem?.teacher_id !== undefined &&
        classItem?.teacher_id !== '') {
        ids.push(classItem.teacher_id);
    }
    return ids.map(normalizeId).filter(Boolean);
};
const isClassAssignedToStaff = (classItem, staffItem) => {
    const staffId = normalizeId(staffItem?.id);
    if (!staffId)
        return false;
    return getAssignedTeacherIds(classItem).includes(staffId);
};
export default function Staff() {
    const { user, isReadOnly, canDelete } = useAuth();
    const [staff, setStaff] = useState([]);
    const [branches, setBranches] = useState([]);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterRole, setFilterRole] = useState('');
    const [filterBranch, setFilterBranch] = useState(getBranchScope() || '');
    const [filterStatus, setFilterStatus] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    // Edit / Add Staff Modal
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [form, setForm] = useState(cloneEmptyForm);
    const [fieldErrors, setFieldErrors] = useState({});
    const [saving, setSaving] = useState(false);
    // Import Staff Modal
    const [showImportModal, setShowImportModal] = useState(false);
    const [importRows, setImportRows] = useState([]);
    const [importing, setImporting] = useState(false);
    const [importFileName, setImportFileName] = useState('');
    const [importError, setImportError] = useState('');
    const fileInputRef = useRef(null);
    // Assign Classes Modal
    const [showClassModal, setShowClassModal] = useState(false);
    const [assigningStaff, setAssigningStaff] = useState(null);
    const [selectedClassIds, setSelectedClassIds] = useState([]);
    const [assignmentClassId, setAssignmentClassId] = useState('');
    const [assigning, setAssigning] = useState(false);
    // View Assigned Classes Details Popup Modal
    const [showViewClassesModal, setShowViewClassesModal] = useState(false);
    const [viewClassesStaff, setViewClassesStaff] = useState(null);
    const [viewClassesList, setViewClassesList] = useState([]);
    // Staff View Modal
    const [showStaffViewModal, setShowStaffViewModal] = useState(false);
    const [viewStaff, setViewStaff] = useState(null);
    const [showExportModal, setShowExportModal] = useState(false);
    const [toast, setToast] = useState('');

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
    const filterBranchScoped = items => {
        const branchAccess = user?.branchAccess;
        if (!branchAccess || branchAccess === 'all') {
            return items;
        }
        return items.filter(item => normalizeId(item?.branch_id ?? item?.branchId) ===
            normalizeId(branchAccess));
    };
    const showToast = msg => {
        setToast(msg);
        window.setTimeout(() => setToast(''), 3500);
    };
    const fetchInit = async () => {
        setLoading(true);
        try {
            const [staffResponse, branchResponse, classResponse] = await Promise.all([
                getStaff(),
                getBranches(),
                getClasses()
            ]);
            const nextStaff = Array.isArray(staffResponse?.data?.staff)
                ? staffResponse.data.staff
                : [];
            const nextBranches = Array.isArray(branchResponse?.data?.branches)
                ? branchResponse.data.branches
                : [];
            const nextClasses = Array.isArray(classResponse?.data?.classes)
                ? classResponse.data.classes
                : [];
            setStaff(filterBranchScoped(nextStaff));
            setBranches(filterBranches(nextBranches));
            setClasses(filterBranchScoped(nextClasses));
        }
        catch (err) {
            console.error('Failed to load staff data:', err);
            showToast(err.response?.data?.message ||
                err.message ||
                'Failed to load staff data.');
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        fetchInit();
        // The logged-in user's branch scope determines which records can be shown.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.branchAccess]);
    const validateForm = () => {
        const errors = {};
        if (!String(form.firstName || '').trim()) {
            errors.firstName = 'First name is required';
        }
        if (!String(form.lastName || '').trim()) {
            errors.lastName = 'Last name is required';
        }
        if (!String(form.staffId || '').trim()) {
            errors.staffId = 'Staff ID is required';
        }
        if (!editItem && !String(form.password || '').trim()) {
            errors.password = 'Password is required for new staff';
        }
        if (form.phone) {
            const cleanedPhone = cleanPhoneNumber(form.phone);
            if (cleanedPhone.length !== 10) {
                errors.phone = 'Phone number must be exactly 10 digits';
            }
        }
        if (form.email &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(form.email).trim())) {
            errors.email = 'Please enter a valid email address';
        }
        const branchId = form.branchId || getBranchScope() || '';
        if (!branchId) {
            errors.branchId = 'Branch is required';
        }
        if (!ROLES.includes(form.roleType)) {
            errors.roleType = 'Please select a valid role';
        }
        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };
    const executeSave = async () => {
        const cleanedPhone = cleanPhoneNumber(form.phone);
        const branchId = form.branchId || getBranchScope() || '';
        const payload = {
            ...form,
            staffId: String(form.staffId || '').trim(),
            firstName: String(form.firstName || '').trim(),
            lastName: String(form.lastName || '').trim(),
            username: String(form.username || '').trim(),
            email: String(form.email || '').trim(),
            designation: String(form.designation || '').trim(),
            phone: cleanedPhone,
            branchId,
            expectedCheckIn: form.expectedCheckIn || '09:00',
            expectedCheckOut: form.expectedCheckOut || '17:00'
        };
        // Do not overwrite an existing password with an empty value while editing.
        if (editItem && !String(form.password || '').trim()) {
            delete payload.password;
        }
        setSaving(true);
        try {
            if (editItem) {
                await updateStaff(editItem.id, payload);
                showToast('Staff member updated successfully!');
            }
            else {
                await createStaff(payload);
                showToast('Staff member added successfully!');
            }
            setShowModal(false);
            setEditItem(null);
            setForm(cloneEmptyForm());
            setFieldErrors({});
            setShowPassword(false);
            await fetchInit();
        }
        catch (err) {
            const msg = err.response?.data?.message ||
                err.message ||
                'Error occurred while saving staff.';
            const lowerMsg = msg.toLowerCase();
            if (lowerMsg.includes('username')) {
                setFieldErrors(prev => ({
                    ...prev,
                    username: msg
                }));
            }
            else if (lowerMsg.includes('staff id') ||
                lowerMsg.includes('staff_id')) {
                setFieldErrors(prev => ({
                    ...prev,
                    staffId: msg
                }));
            }
            else if (lowerMsg.includes('branch')) {
                setFieldErrors(prev => ({
                    ...prev,
                    branchId: msg
                }));
            }
            else {
                showToast(msg);
            }
        }
        finally {
            setSaving(false);
        }
    };

    const handleSubmit = async (e) => {
        e?.preventDefault();
        if (!validateForm()) {
            return;
        }

        if (!editItem) {
            const staffName = `${form.firstName || ''} ${form.lastName || ''}`.trim() || form.username || 'this staff member';
            requestConfirm({
                title: 'Are you sure?',
                message: `Are you sure you want to add new staff member "${staffName}"?`,
                confirmText: 'Yes, Add Staff',
                type: 'primary',
                onConfirm: async () => {
                    await executeSave();
                }
            });
            return;
        }

        await executeSave();
    };

    const handleToggleStatus = (s) => {
        const nextStatus = !Boolean(s.is_active);
        requestConfirm({
            title: 'Are you sure?',
            message: `Are you sure you want to ${nextStatus ? 'activate' : 'deactivate'} staff member "${s.full_name || s.staff_id}"?`,
            confirmText: nextStatus ? 'Yes, Activate' : 'Yes, Deactivate',
            type: nextStatus ? 'success' : 'warning',
            onConfirm: async () => {
                try {
                    await updateStaff(s.id, {
                        isActive: nextStatus
                    });
                    showToast(`Staff "${s.full_name || s.staff_id}" ${nextStatus ? 'activated' : 'deactivated'}.`);
                    await fetchInit();
                    if (viewStaff && viewStaff.id === s.id) {
                        setViewStaff(prev => ({ ...prev, is_active: nextStatus }));
                    }
                }
                catch (err) {
                    showToast(err.response?.data?.message ||
                        err.message ||
                        'Failed to update status.');
                }
            }
        });
    };

    const handleDelete = (s) => {
        const name = s.full_name || s.staff_id || 'this staff member';
        requestConfirm({
            title: 'Are you sure?',
            message: `Are you sure you want to delete staff member "${name}"? This action cannot be undone.`,
            confirmText: 'Yes, Delete',
            type: 'danger',
            onConfirm: async () => {
                try {
                    await deleteStaff(s.id);
                    showToast('Staff deleted.');
                    await fetchInit();
                }
                catch (err) {
                    showToast(err.response?.data?.message ||
                        err.message ||
                        'Failed to delete staff.');
                }
            }
        });
    };
    const openEdit = s => {
        setFieldErrors({});
        setEditItem(s);
        setShowPassword(false);
        const firstName = s.first_name ||
            (s.full_name ? String(s.full_name).split(' ')[0] : '');
        const lastName = s.last_name ||
            (s.full_name
                ? String(s.full_name).split(' ').slice(1).join(' ')
                : '');
        setForm({
            staffId: s.staff_id || '',
            firstName,
            lastName,
            username: s.username || '',
            password: '',
            phone: cleanPhoneNumber(s.phone),
            email: s.email || '',
            roleType: s.role_type || 'teaching',
            branchId: s.branch_id ?? s.branchId ?? '',
            designation: s.designation || '',
            gender: s.gender || '',
            dateOfJoining: s.date_of_joining
                ? String(s.date_of_joining).split('T')[0]
                : '',
            expectedCheckIn: s.expected_check_in ? String(s.expected_check_in).slice(0, 5) : '09:00',
            expectedCheckOut: s.expected_check_out ? String(s.expected_check_out).slice(0, 5) : '17:00',
            isActive: s.is_active !== undefined
                ? Boolean(s.is_active)
                : true
        });
        setShowModal(true);
    };
    const openAdd = () => {
        setFieldErrors({});
        setEditItem(null);
        setForm({
            ...cloneEmptyForm(),
            branchId: getBranchScope() || ''
        });
        setShowPassword(false);
        setShowModal(true);
    };
    const openStaffView = s => {
        setViewStaff(s);
        setShowStaffViewModal(true);
    };
    const openClassModal = s => {
        setAssigningStaff(s);
        const currentClassIds = classes
            .filter(c => isClassAssignedToStaff(c, s))
            .map(c => normalizeId(c.id))
            .filter(Boolean);
        setSelectedClassIds(currentClassIds);
        setAssignmentClassId('');
        setShowClassModal(true);
    };
    const addAssignmentClass = () => {
        const classId = normalizeId(assignmentClassId);
        if (!classId) {
            return;
        }
        setSelectedClassIds(prev => {
            const normalized = prev.map(normalizeId);
            return normalized.includes(classId)
                ? prev
                : [...prev, classId];
        });
        setAssignmentClassId('');
    };
    const openViewClassesDetails = s => {
        const assigned = classes.filter(c => isClassAssignedToStaff(c, s));
        setViewClassesStaff(s);
        setViewClassesList(assigned);
        setShowViewClassesModal(true);
    };
    const handleSaveClasses = async () => {
        if (!assigningStaff) {
            return;
        }
        setAssigning(true);
        try {
            await assignStaffClasses(assigningStaff.id, selectedClassIds.map(normalizeId).filter(Boolean));
            showToast(`Assigned classes updated for ${assigningStaff.full_name || assigningStaff.staff_id}!`);
            setShowClassModal(false);
            setAssigningStaff(null);
            setSelectedClassIds([]);
            setAssignmentClassId('');
            await fetchInit();
        }
        catch (err) {
            showToast(err.response?.data?.message ||
                err.message ||
                'Failed to save class assignments.');
        }
        finally {
            setAssigning(false);
        }
    };
    const handleExecuteExport = ({ fromDate, fromTime, toDate, toTime, preset }) => {
        try {
            if (!staff || !staff.length) {
                return { error: 'No staff records available to export.' };
            }

            const isDateFiltered = preset !== 'all' && (Boolean(fromDate) || Boolean(toDate));
            const targetStaff = isDateFiltered
                ? filterRecordsByDateRange(staff, { fromDate, fromTime, toDate, toTime })
                : staff;

            if (targetStaff.length === 0) {
                return { error: 'No staff records found within the selected date & time range.' };
            }

            const headers = [
                'Staff ID',
                'Username',
                'First Name',
                'Last Name',
                'Full Name',
                'Role Type',
                'Designation',
                'Branch',
                'Assigned Classes',
                'School Hours (In)',
                'School Hours (Out)',
                'Date of Joining',
                'Phone',
                'Email',
                'Gender',
                'Status'
            ];
            const rows = targetStaff.map(s => [
                s.staff_id || '',
                s.username || '',
                s.first_name || '',
                s.last_name || '',
                s.full_name || '',
                s.role_type || '',
                s.designation || '',
                s.branch_name || '',
                s.assigned_classes || '',
                s.expected_check_in ? String(s.expected_check_in).slice(0, 5) : '09:00',
                s.expected_check_out ? String(s.expected_check_out).slice(0, 5) : '17:00',
                s.date_of_joining ? String(s.date_of_joining).split('T')[0] : '',
                s.phone || '',
                s.email || '',
                s.gender || '',
                s.is_active ? 'Active' : 'Inactive'
            ]);

            const filename = generateExportFilename('staff_list', { fromDate, toDate, preset });
            downloadCSV(filename, headers, rows);

            setShowExportModal(false);
            showToast(`Staff CSV exported successfully (${targetStaff.length} rows).`);
            return { success: true };
        }
        catch (error) {
            console.error('Staff CSV export failed:', error);
            return { error: 'CSV export failed. Please try again.' };
        }
    };
    const downloadSampleCSV = () => {
        const headers = [
            'Staff ID',
            'First Name',
            'Last Name',
            'Username',
            'Role Type',
            'Designation',
            'Branch Name',
            'Phone',
            'Email',
            'Gender',
            'Date of Joining (YYYY-MM-DD)',
            'Password'
        ];
        const sampleRows = [
            [
                'STF101',
                'Rahul',
                'Verma',
                'rahul101',
                'teaching',
                'Mathematics Teacher',
                branches[0]?.name || 'Main Campus',
                '9876543210',
                'rahul@school.edu.in',
                'Male',
                '2024-06-01',
                'Teacher@123'
            ],
            [
                'STF102',
                'Pooja',
                'Sharma',
                'pooja102',
                'teaching',
                'Science Teacher',
                branches[0]?.name || 'Main Campus',
                '9876543211',
                'pooja@school.edu.in',
                'Female',
                '2024-06-01',
                'Teacher@123'
            ]
        ];
        downloadCSV('sample_staff_import.csv', headers, sampleRows);
    };
    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (e.target) {
            e.target.value = '';
        }
        if (!file) {
            return;
        }

        setImportError('');
        setImportFileName(file.name);
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = String(event.target?.result || '').replace(/^\uFEFF/, '');
                const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
                if (lines.length < 2) {
                    showToast('CSV file is empty or missing headers.');
                    return;
                }

                const headers = lines[0].split(',').map(c => normalizeHeader(c.replace(/^"|"$/g, '')));
                const hasStaffIdHeader = headers.some(h => h.includes('staff') || h.includes('id'));

                const getVal = (row, ...aliases) => {
                    for (const alias of aliases) {
                        const idx = headers.indexOf(normalizeHeader(alias));
                        if (idx !== -1 && row[idx] !== undefined) {
                            return String(row[idx]).trim();
                        }
                    }
                    return '';
                };

                const parsed = [];
                for (let i = 1; i < lines.length; i++) {
                    const row = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                    if (row.length < 2 || row.every(c => !c)) continue;

                    let staffId = hasStaffIdHeader ? getVal(row, 'staff_id', 'staff id', 'id') : (row[0] || '');
                    let firstName = hasStaffIdHeader ? getVal(row, 'first_name', 'first name') : (row[1] || '');
                    let lastName = hasStaffIdHeader ? getVal(row, 'last_name', 'last name') : (row[2] || '');
                    let username = hasStaffIdHeader ? getVal(row, 'username', 'user name') : (row[3] || '');
                    let roleType = (hasStaffIdHeader ? getVal(row, 'role_type', 'role type', 'role') : row[4]) || 'teaching';
                    let designation = hasStaffIdHeader ? getVal(row, 'designation') : (row[5] || '');
                    let branchName = hasStaffIdHeader ? getVal(row, 'branch_name', 'branch name', 'branch') : (row[6] || '');
                    let phone = hasStaffIdHeader ? getVal(row, 'phone', 'mobile') : (row[7] || '');
                    let email = hasStaffIdHeader ? getVal(row, 'email') : (row[8] || '');
                    let gender = hasStaffIdHeader ? getVal(row, 'gender') : (row[9] || '');
                    let dateOfJoining = hasStaffIdHeader ? getVal(row, 'date_of_joining', 'date of joining', 'date of joining yyyy mm dd') : (row[10] || '');
                    let password = (hasStaffIdHeader ? getVal(row, 'password') : row[11]) || 'Teacher@123';

                    parsed.push({
                        staffId,
                        firstName,
                        lastName,
                        fullName: `${firstName} ${lastName}`.trim(),
                        username,
                        roleType: roleType.toLowerCase(),
                        designation,
                        branchName,
                        phone: cleanPhoneNumber(phone),
                        email,
                        gender,
                        dateOfJoining,
                        password
                    });
                }
                setImportRows(parsed);
            } catch (err) {
                console.error('CSV parse error:', err);
                setImportError('Failed to parse CSV file.');
            }
        };
        reader.readAsText(file);
    };

    const handleConfirmImport = async () => {
        if (importRows.length === 0) {
            setImportError('Please upload a valid CSV file first.');
            return;
        }

        setImportError('');
        setImporting(true);

        const getImportErrorMessage = (data) => {
            if (!data) return 'Failed to import staff.';

            const messages = [];

            if (Array.isArray(data.errors)) {
                data.errors.forEach((error) => {
                    if (typeof error === 'string') {
                        messages.push(error);
                    } else if (error && typeof error === 'object') {
                        messages.push(
                            error.message ||
                            error.error ||
                            error.reason ||
                            JSON.stringify(error)
                        );
                    }
                });
            }

            return messages.length > 0
                ? messages.join('\n')
                : (data.message || 'Failed to import staff.');
        };

        try {
            const branchScope = getBranchScope();
            const branchNameForScope = branches.find(b => normalizeId(b.id) === normalizeId(branchScope))?.name || '';
            const rowsToImport = importRows.map(row => ({
                ...row,
                ...(isDedicatedBranchUser() && branchNameForScope ? { branchName: branchNameForScope } : {})
            }));

            const res = await bulkImportStaff({ staff: rowsToImport });
            const responseData = res.data || {};

            if (Array.isArray(responseData.errors) && responseData.errors.length > 0 && (!responseData.importedCount || responseData.importedCount === 0)) {
                setImportError(getImportErrorMessage(responseData));
                fetchInit();
                return;
            }

            showToast(
                responseData.message ||
                `Successfully imported ${responseData.importedCount || rowsToImport.length} staff member(s)!`
            );

            setShowImportModal(false);
            setImportRows([]);
            setImportFileName('');
            setImportError('');
            fetchInit();
        } catch (err) {
            console.error('Staff import failed:', err);
            setImportError(getImportErrorMessage(err.response?.data));
        } finally {
            setImporting(false);
        }
    };
    const filtered = staff.filter(s => {
        const searchLower = String(search || '')
            .trim()
            .toLowerCase();
        const matchesSearch = !searchLower ||
            [
                s.full_name,
                s.first_name,
                s.last_name,
                s.username,
                s.staff_id,
                s.designation,
                s.phone,
                s.email
            ].some(value => String(value || '')
                .toLowerCase()
                .includes(searchLower));
        const matchesRole = !filterRole ||
            String(s.role_type || '').toLowerCase() ===
                String(filterRole).toLowerCase();
        const matchesBranch = !filterBranch ||
            normalizeId(s.branch_id ?? s.branchId) ===
                normalizeId(filterBranch);
        const matchesStatus = !filterStatus ||
            (filterStatus === 'active'
                ? Boolean(s.is_active)
                : !Boolean(s.is_active));
        return (matchesSearch &&
            matchesRole &&
            matchesBranch &&
            matchesStatus);
    });
    const roleBadge = (role) => {
        const map = {
            teaching: 'badge-info',
            'non-teaching': 'badge-warning',
            management: 'badge-purple'
        };
        return map[role] || 'badge-gray';
    };
    const stats = {
        total: staff.length,
        teaching: staff.filter(s => s.role_type === 'teaching').length,
        nonTeaching: staff.filter(s => s.role_type === 'non-teaching').length,
        management: staff.filter(s => s.role_type === 'management').length,
        active: staff.filter(s => s.is_active).length
    };
    return (<Layout title="Staff" subtitle="Manage teaching, non-teaching, and management staff">
      {toast && (<div className="alert alert-success alert-toast">
          <MdCheckCircle style={{
                verticalAlign: 'middle',
                marginRight: 6
            }}/>
          {toast}
        </div>)}

      {/* Top Stats */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{
            background: '#eff6ff',
            color: '#3b82f6'
        }}>
            <MdPeople />
          </div>

          <div className="stat-info">
            <div className="stat-value">
              {stats.total}
            </div>

            <div className="stat-label">
              Total Staff
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{
            background: '#f0fdf4',
            color: '#10b981'
        }}>
            <MdPeople />
          </div>

          <div className="stat-info">
            <div className="stat-value" style={{ color: '#10b981' }}>
              {stats.teaching}
            </div>

            <div className="stat-label">
              Teaching Staff
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{
            background: '#fefce8',
            color: '#eab308'
        }}>
            <MdPerson />
          </div>

          <div className="stat-info">
            <div className="stat-value" style={{ color: '#eab308' }}>
              {stats.nonTeaching}
            </div>

            <div className="stat-label">
              Non-Teaching Staff
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{
            background: '#fdf4ff',
            color: '#a855f7'
        }}>
            <MdClass />
          </div>

          <div className="stat-info">
            <div className="stat-value" style={{ color: '#a855f7' }}>
              {stats.management}
            </div>

            <div className="stat-label">
              Management Staff
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar" style={{
            flexWrap: 'nowrap',
            gap: 8
        }}>
        <div className="toolbar-left" style={{
            flexWrap: 'nowrap',
            gap: 6,
            flex: 1,
            minWidth: 0
        }}>
          <div className="search-box" style={{
            flex: '1 1 160px',
            minWidth: 140,
            maxWidth: 220,
            padding: '7px 10px',
            height: 36
        }}>
            <MdSearch color="var(--text-muted)" size={18}/>

            <input placeholder="Search staff..." value={search} onChange={e => setSearch(e.target.value)} style={{
            width: '100%',
            fontSize: 13
        }}/>
          </div>

          <select className="input" style={{
            width: 110,
            padding: '6px 8px',
            fontSize: 12.5,
            height: 36
        }} value={filterRole} onChange={e => setFilterRole(e.target.value)}>
            <option value="">
              All Roles
            </option>

            {ROLES.map(r => (<option key={r} value={r}>
                {r.charAt(0).toUpperCase() +
                r.slice(1)}
              </option>))}
          </select>

          <select className="input" style={{
            width: 120,
            padding: '6px 8px',
            fontSize: 12.5,
            height: 36
        }} value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
            {!isDedicatedBranchUser() && (<option value="">
                All Branches
              </option>)}

            {branches.map(b => (<option key={b.id} value={b.id}>
                {b.name}
              </option>))}
          </select>

          <select className="input" style={{
            width: 100,
            padding: '6px 8px',
            fontSize: 12.5,
            height: 36
        }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">
              All Status
            </option>

            <option value="active">
              Active
            </option>

            <option value="inactive">
              Inactive
            </option>
          </select>
        </div>

        <div className="toolbar-right" style={{
            flexWrap: 'nowrap',
            gap: 6,
            flexShrink: 0
        }}>
          <button className="btn btn-secondary btn-sm" onClick={downloadSampleCSV} title="Download Sample CSV Template" style={{
            padding: '6px 10px',
            fontSize: 12.5,
            height: 36,
            whiteSpace: 'nowrap'
        }}>
            <MdDownload size={14}/>
            {' '}Sample CSV
          </button>

        {!isReadOnly && (
          <button className="btn btn-secondary btn-sm" onClick={() => {
              setImportError('');
              setImportRows([]);
              setImportFileName('');
              setShowImportModal(true);
          }} title="Import Staff from CSV" style={{
              padding: '6px 10px',
              fontSize: 12.5,
              height: 36,
              whiteSpace: 'nowrap'
          }}>
              <MdUpload size={14}/>
              {' '}Import Staff
            </button>
        )}

          <button className="btn btn-secondary btn-sm" onClick={() => setShowExportModal(true)} title="Export CSV with Custom Time Range" style={{
            padding: '6px 10px',
            fontSize: 12.5,
            height: 36,
            whiteSpace: 'nowrap'
        }}>
            <MdDownload size={14}/>
            {' '}Export CSV
          </button>

        {!isReadOnly && (
          <button className="btn btn-primary" onClick={openAdd} style={{
            padding: '6px 12px',
            fontSize: 12.5,
            height: 36,
            whiteSpace: 'nowrap'
        }}>
            <MdAdd size={16}/>
            {' '}Add Staff
          </button>
        )}
        </div>
      </div>

      {/* Staff Table */}
      {loading ? (<div className="loading-overlay">
          <div className="spinner"/>
          Loading staff...
        </div>) : (<div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Staff ID</th>
                <th>Name / User</th>
                <th>Role</th>
                <th>Designation</th>
                <th>Branch & Assigned Classes</th>
                <th>School Hours</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filtered.length === 0 ? (<tr>
                  <td colSpan={9}>
                    <div className="empty-state">
                      <div className="empty-state-icon">
                        <MdPeople />
                      </div>

                      <div className="empty-state-title">
                        No staff members found
                      </div>
                    </div>
                  </td>
                </tr>) : (filtered.map(s => (<tr key={s.id}>
                    <td>
                      <span style={{
                    fontFamily: 'monospace',
                    fontSize: 13,
                    fontWeight: 700
                }}>
                        {s.staff_id || '—'}
                      </span>
                    </td>

                    <td>
                      <div style={{
                    fontWeight: 600
                }}>
                        {s.first_name
                    ? `${s.first_name} ${s.last_name || ''}`
                    : s.full_name}
                      </div>

                      {s.username && (<div style={{
                        fontSize: 11,
                        color: '#4f46e5',
                        fontWeight: 600
                    }}>
                          @{s.username}
                        </div>)}

                      {s.gender && (<div style={{
                        fontSize: 11,
                        color: 'var(--text-muted)'
                    }}>
                          {s.gender}
                        </div>)}
                    </td>

                    <td>
                      <span className={`badge ${roleBadge(s.role_type)}`}>
                        {s.role_type}
                      </span>
                    </td>

                    <td style={{
                    fontSize: 13
                }}>
                      {s.designation || '—'}
                    </td>

                    <td style={{
                    fontSize: 13
                }}>
                      <div style={{
                    fontWeight: 600,
                    color: 'var(--text-main)'
                }}>
                        {s.branch_name || '—'}
                      </div>

                      {(() => {
                    const assigned = classes.filter(c => isClassAssignedToStaff(c, s));
                    const count = assigned.length;
                    return (<button className={`badge ${count > 0
                            ? 'badge-purple'
                            : 'badge-gray'}`} style={{
                            cursor: 'pointer',
                            border: 'none',
                            padding: '4px 10px',
                            fontSize: 12,
                            fontWeight: 600,
                            marginTop: 4,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5
                        }} onClick={() => openViewClassesDetails(s)} title="Click to view assigned classes details">
                            <MdClass size={13}/>
                            {count}{' '}
                            {count === 1
                            ? 'Class'
                            : 'Classes'}
                          </button>);
                })()}
                    </td>

                    <td style={{ fontSize: 12 }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        padding: '4px 8px',
                        borderRadius: 6,
                        fontWeight: 600,
                        color: 'var(--text-main, #334155)',
                        whiteSpace: 'nowrap'
                      }} title="Expected School Hours">
                        <MdAccessTime size={13} style={{ color: 'var(--primary, #4f46e5)' }} />
                        {formatTime12(s.expected_check_in || '09:00')} – {formatTime12(s.expected_check_out || '17:00')}
                      </span>
                    </td>

                    <td style={{
                    fontSize: 13
                }}>
                      {s.phone && (<div>
                          <MdPerson style={{
                        verticalAlign: 'middle',
                        marginRight: 4
                    }}/>
                          {s.phone}
                        </div>)}

                      {s.email && (<div style={{
                        fontSize: 11,
                        color: 'var(--text-muted)'
                    }}>
                          <MdPerson style={{
                        verticalAlign: 'middle',
                        marginRight: 4
                    }}/>
                          {s.email}
                        </div>)}
                    </td>

                    <td>
                      <span className={`badge ${s.is_active
                    ? 'badge-success'
                    : 'badge-danger'}`}>
                        {s.is_active
                    ? '● Active'
                    : '● Inactive'}
                      </span>
                    </td>

                    <td>
                      <div className="table-actions">
                        <button className="btn btn-sm btn-secondary" onClick={() => openStaffView(s)} title="View staff details and actions">
                          <MdVisibility size={14}/>
                        </button>
                      </div>
                    </td>
                  </tr>)))}
            </tbody>
          </table>
        </div>)}

      {/* Staff View Modal */}
      <Modal isOpen={showStaffViewModal} onClose={() => setShowStaffViewModal(false)} title={viewStaff
            ? `Staff: ${viewStaff.full_name}`
            : 'Staff Details'} size="sm" footer={<button className="btn btn-secondary" onClick={() => setShowStaffViewModal(false)}>
            Close
          </button>}>
        {viewStaff && (<div>
            <div style={{
                display: 'grid',
                gap: 10,
                marginBottom: 20
            }}>
              <div>
                <strong>Staff ID:</strong>{' '}
                {viewStaff.staff_id || '—'}
              </div>

              <div>
                <strong>Role:</strong>{' '}
                {viewStaff.role_type || '—'}
              </div>

              <div>
                <strong>Designation:</strong>{' '}
                {viewStaff.designation || '—'}
              </div>

              <div>
                <strong>Branch:</strong>{' '}
                {viewStaff.branch_name || '—'}
              </div>

              <div>
                <strong>School Hours:</strong>{' '}
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  background: '#f1f5f9',
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-main)'
                }}>
                  <MdAccessTime size={14} style={{ color: 'var(--primary, #4f46e5)' }} />
                  {formatTime12(viewStaff.expected_check_in || '09:00')} – {formatTime12(viewStaff.expected_check_out || '17:00')}
                </span>
              </div>

              <div>
                <strong>Status:</strong>{' '}
                {viewStaff.is_active
                ? 'Active'
                : 'Inactive'}
              </div>
            </div>

            <div style={{
                display: 'grid',
                gap: 10
            }}>
              {!isReadOnly && (
                <>
                  <button className="btn btn-secondary" onClick={() => {
                    setShowStaffViewModal(false);
                    openEdit(viewStaff);
                }}>
                    <MdEdit /> Edit Staff
                  </button>

                  <button className="btn btn-secondary" onClick={() => {
                    setShowStaffViewModal(false);
                    openClassModal(viewStaff);
                }}>
                    <MdClass /> Staff Allocation
                  </button>

                  <button className="btn" onClick={() => handleToggleStatus(viewStaff)} style={{
                    background: viewStaff.is_active
                        ? '#fef3c7'
                        : '#dcfce7',
                    color: viewStaff.is_active
                        ? '#d97706'
                        : '#15803d'
                }}>
                    <MdCancel />{' '}
                    {viewStaff.is_active
                    ? 'Deactivate Staff'
                    : 'Activate Staff'}
                  </button>
                </>
              )}

              {canDelete && (
                <button className="btn btn-danger" onClick={() => {
                  setShowStaffViewModal(false);
                  handleDelete(viewStaff);
              }}>
                  <MdDelete /> Delete Staff
                </button>
              )}
            </div>
          </div>)}
      </Modal>

      {/* Edit / Add Staff Modal */}
      <Modal isOpen={showModal} onClose={() => {
            setShowModal(false);
            setFieldErrors({});
        }} title={editItem
            ? 'Edit Staff Member'
            : 'Add Staff Member'} size="lg" footer={<>
            <button type="button" className="btn btn-secondary" onClick={() => {
                setShowModal(false);
                setFieldErrors({});
            }}>
              Cancel
            </button>

            <button type="submit" form="staff-edit-form" className="btn btn-primary" disabled={saving}>
              {saving
                ? 'Saving...'
                : (editItem ? 'Save Staff' : 'Add Staff')}
            </button>
          </>}>
        <form id="staff-edit-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>
                First Name *
              </label>

              <input className="input" placeholder="First name" value={form.firstName} onChange={e => {
            setForm({
                ...form,
                firstName: e.target.value
            });
            setFieldErrors({
                ...fieldErrors,
                firstName: ''
            });
        }} style={{
            borderColor: fieldErrors.firstName
                ? '#ef4444'
                : ''
        }} required/>

              {fieldErrors.firstName && (<div style={{
                color: '#ef4444',
                fontSize: 12,
                marginTop: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 4
            }}>
                  <MdWarning />
                  {fieldErrors.firstName}
                </div>)}
            </div>

            <div className="form-group">
              <label>
                Last Name *
              </label>

              <input className="input" placeholder="Last name" value={form.lastName} onChange={e => {
            setForm({
                ...form,
                lastName: e.target.value
            });
            setFieldErrors({
                ...fieldErrors,
                lastName: ''
            });
        }} style={{
            borderColor: fieldErrors.lastName
                ? '#ef4444'
                : ''
        }} required/>

              {fieldErrors.lastName && (<div style={{
                color: '#ef4444',
                fontSize: 12,
                marginTop: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 4
            }}>
                  <MdWarning />
                  {fieldErrors.lastName}
                </div>)}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>
                Staff ID *
              </label>

              <input className="input" placeholder="e.g. STF001" value={form.staffId} onChange={e => {
            setForm({
                ...form,
                staffId: e.target.value
            });
            setFieldErrors({
                ...fieldErrors,
                staffId: ''
            });
        }} style={{
            fontFamily: 'monospace',
            borderColor: fieldErrors.staffId
                ? '#ef4444'
                : ''
        }}/>

              {fieldErrors.staffId && (<div style={{
                color: '#ef4444',
                fontSize: 12,
                marginTop: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 4
            }}>
                  <MdWarning />
                  {fieldErrors.staffId}
                </div>)}
            </div>

            <div className="form-group">
              <label>
                Username (Device Login)
              </label>

              <input className="input" placeholder="e.g. teacher123" value={form.username} onChange={e => {
            setForm({
                ...form,
                username: e.target.value
            });
            setFieldErrors({
                ...fieldErrors,
                username: ''
            });
        }} style={{
            fontFamily: 'monospace',
            borderColor: fieldErrors.username
                ? '#ef4444'
                : ''
        }}/>

              {fieldErrors.username && (<div style={{
                color: '#ef4444',
                fontSize: 12,
                marginTop: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 4
            }}>
                  <MdWarning />
                  {fieldErrors.username}
                </div>)}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>
                Password{' '}
                {editItem
            ? '(Leave blank to keep unchanged)'
            : '*'}
              </label>

              <div style={{
            position: 'relative'
        }}>
                <input className="input" type={showPassword
            ? 'text'
            : 'password'} placeholder={editItem
            ? '••••••••'
            : 'Login password'} value={form.password} onChange={e => setForm({
            ...form,
            password: e.target.value
        })} style={{
            paddingRight: '38px'
        }}/>

                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{
            position: 'absolute',
            right: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            padding: '4px'
        }} title={showPassword
            ? 'Hide password'
            : 'Show password'}>
                  {showPassword ? (<MdVisibilityOff size={18}/>) : (<MdVisibility size={18}/>)}
                </button>
              </div>

              {fieldErrors.password && (<div style={{
                color: '#ef4444',
                fontSize: 12,
                marginTop: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 4
            }}>
                  <MdWarning />
                  {fieldErrors.password}
                </div>)}
            </div>

            <div className="form-group">
              <label>
                Role Type *
              </label>

              <select className="input" value={form.roleType} onChange={e => setForm({
            ...form,
            roleType: e.target.value
        })}>
                {ROLES.map(r => (<option key={r} value={r}>
                    {r.charAt(0).toUpperCase() +
                r.slice(1)}
                  </option>))}
              </select>

              {fieldErrors.roleType && (<div style={{
                color: '#ef4444',
                fontSize: 12,
                marginTop: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 4
            }}>
                  <MdWarning />
                  {fieldErrors.roleType}
                </div>)}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>
                Branch
              </label>

              <select className="input" value={form.branchId || getBranchScope() || ''} onChange={e => setForm({
            ...form,
            branchId: e.target.value
        })} disabled={isDedicatedBranchUser()}>
                {!isDedicatedBranchUser() && (<option value="">
                    Select Branch
                  </option>)}

                {branches.map(b => (<option key={b.id} value={b.id}>
                    {b.name}
                  </option>))}
              </select>

              {fieldErrors.branchId && (<div style={{
                color: '#ef4444',
                fontSize: 12,
                marginTop: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 4
            }}>
                  <MdWarning />
                  {fieldErrors.branchId}
                </div>)}
            </div>

            <div className="form-group">
              <label>
                Designation
              </label>

              <input className="input" placeholder="e.g. Senior Teacher, Vice Principal" value={form.designation} onChange={e => setForm({
            ...form,
            designation: e.target.value
        })}/>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>
                Phone Number
              </label>

              <input className="input" placeholder="10-digit mobile number" value={form.phone} onChange={e => {
            setForm({
                ...form,
                phone: e.target.value
            });
            setFieldErrors({
                ...fieldErrors,
                phone: ''
            });
        }} style={{
            borderColor: fieldErrors.phone
                ? '#ef4444'
                : ''
        }}/>

              {fieldErrors.phone && (<div style={{
                color: '#ef4444',
                fontSize: 12,
                marginTop: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 4
            }}>
                  <MdWarning />
                  {fieldErrors.phone}
                </div>)}
            </div>

            <div className="form-group">
              <label>
                Email Address
              </label>

              <input className="input" type="email" placeholder="staff@school.edu.in" value={form.email} onChange={e => {
            setForm({
                ...form,
                email: e.target.value
            });
            setFieldErrors({
                ...fieldErrors,
                email: ''
            });
        }} style={{
            borderColor: fieldErrors.email
                ? '#ef4444'
                : ''
        }}/>

              {fieldErrors.email && (<div style={{
                color: '#ef4444',
                fontSize: 12,
                marginTop: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 4
            }}>
                  <MdWarning />
                  {fieldErrors.email}
                </div>)}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>
                Gender
              </label>

              <select className="input" value={form.gender} onChange={e => setForm({
            ...form,
            gender: e.target.value
        })}>
                <option value="">
                  Select Gender
                </option>

                <option>
                  Male
                </option>

                <option>
                  Female
                </option>

                <option>
                  Other
                </option>
              </select>
            </div>

            <div className="form-group">
              <label>
                Date of Joining
              </label>

              <input className="input" type="date" value={form.dateOfJoining} onChange={e => setForm({
            ...form,
            dateOfJoining: e.target.value
        })}/>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <MdAccessTime size={15} style={{ color: 'var(--primary, #4f46e5)' }} />
                School Check-In Time (Arrival)
              </label>
              <input
                className="input"
                type="time"
                value={form.expectedCheckIn || '09:00'}
                onChange={e => setForm({
                  ...form,
                  expectedCheckIn: e.target.value
                })}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'block' }}>
                Standard time staff should arrive at school (e.g. 09:00 AM)
              </span>
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <MdAccessTime size={15} style={{ color: 'var(--primary, #4f46e5)' }} />
                School Check-Out Time (Departure)
              </label>
              <input
                className="input"
                type="time"
                value={form.expectedCheckOut || '17:00'}
                onChange={e => setForm({
                  ...form,
                  expectedCheckOut: e.target.value
                })}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'block' }}>
                Standard time staff should leave school (e.g. 05:00 PM)
              </span>
            </div>
          </div>

          {editItem && (<div className="form-group" style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginTop: 10
            }}>
              <input type="checkbox" id="staffIsActive" checked={form.isActive} onChange={e => setForm({
                ...form,
                isActive: e.target.checked
            })} style={{
                accentColor: 'var(--primary)',
                width: 18,
                height: 18
            }}/>

              <label htmlFor="staffIsActive" style={{
                marginBottom: 0,
                cursor: 'pointer',
                fontWeight: 600
            }}>
                Active Staff Member
              </label>
            </div>)}
        </form>
      </Modal>

      {/* Bulk Import Staff Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => {
          setShowImportModal(false);
          setImportRows([]);
          setImportFileName('');
          setImportError('');
        }}
        title="Import Staff Members from CSV"
        size="lg"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setShowImportModal(false);
                setImportRows([]);
                setImportFileName('');
                setImportError('');
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirmImport}
              disabled={importing || importRows.length === 0}
            >
              {importing
                ? 'Importing...'
                : `Import ${importRows.length} Staff Members`}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {importError && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderLeft: '4px solid #ef4444',
                borderRadius: 8,
                padding: '12px 14px',
                color: '#991b1b'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontWeight: 700,
                  fontSize: 14,
                  marginBottom: 6
                }}
              >
                <MdWarning size={18} />
                Import Failed
              </div>

              <div
                style={{
                  fontSize: 13,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-line'
                }}
              >
                {importError}
              </div>
            </div>
          )}

          <div
            style={{
              background: '#f8fafc',
              padding: 16,
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                1. Download Sample CSV Template
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Pre-formatted template with headers for staff registration.
              </div>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={downloadSampleCSV}
            >
              <MdDownload /> Download Template
            </button>
          </div>

          <div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
              2. Upload Filled CSV File
            </div>
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed #cbd5e1',
                borderRadius: 8,
                padding: '24px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                background: '#fafafa',
                transition: 'all 0.2s'
              }}
            >
              <MdFilePresent
                size={32}
                color="#64748b"
                style={{ margin: '0 auto 8px auto', display: 'block' }}
              />
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                {importFileName
                  ? `Selected: ${importFileName}`
                  : 'Click to select .CSV file from your computer'}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  marginTop: 4
                }}
              >
                Only CSV format is supported
              </div>
            </div>
          </div>

          {importRows.length > 0 && (
            <div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 14,
                  marginBottom: 8,
                  display: 'flex',
                  justifyContent: 'space-between'
                }}
              >
                <span>3. Preview Records ({importRows.length} ready)</span>
              </div>
              <div
                style={{
                  maxHeight: 240,
                  overflowY: 'auto',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8
                }}
              >
                <table style={{ fontSize: 12, width: '100%' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9' }}>
                      <th style={{ padding: '6px 10px' }}>#</th>
                      <th style={{ padding: '6px 10px' }}>Staff ID</th>
                      <th style={{ padding: '6px 10px' }}>Full Name</th>
                      <th style={{ padding: '6px 10px' }}>Role</th>
                      <th style={{ padding: '6px 10px' }}>Designation</th>
                      <th style={{ padding: '6px 10px' }}>Branch</th>
                      <th style={{ padding: '6px 10px' }}>Phone</th>
                      <th style={{ padding: '6px 10px' }}>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.map((r, i) => (
                      <tr
                        key={i}
                        style={{ borderBottom: '1px solid #f1f5f9' }}
                      >
                        <td style={{ padding: '6px 10px' }}>{i + 1}</td>
                        <td
                          style={{
                            padding: '6px 10px',
                            fontFamily: 'monospace',
                            fontWeight: 600
                          }}
                        >
                          {r.staffId || '—'}
                        </td>
                        <td
                          style={{
                            padding: '6px 10px',
                            fontWeight: 600
                          }}
                        >
                          {r.fullName || '—'}
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          <span className={`badge ${roleBadge(r.roleType)}`}>
                            {r.roleType || 'teaching'}
                          </span>
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          {r.designation || '—'}
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          {r.branchName || '—'}
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          {r.phone || '—'}
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          {r.email || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Assign Classes Modal */}
      <Modal isOpen={showClassModal} onClose={() => setShowClassModal(false)} title={assigningStaff
            ? `Assign Classes to ${assigningStaff.full_name}`
            : 'Assign Classes'} footer={<>
            <button className="btn btn-secondary" onClick={() => setShowClassModal(false)}>
              Cancel
            </button>

            <button className="btn btn-primary" onClick={handleSaveClasses} disabled={assigning}>
              {assigning
                ? 'Saving...'
                : 'Save Class Assignments'}
            </button>
          </>}>
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12
        }}>
          <p style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            margin: 0
        }}>
            Select the classes and sections
            that this staff member is authorized
            to teach and mark attendance for:
          </p>

          <div style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center'
        }}>
            <ClassSectionSelect classes={classes} value={assignmentClassId} onChange={setAssignmentClassId} classStyle={{ flex: 1 }} sectionStyle={{ flex: 1 }} style={{ flex: 1 }}/>

            <button type="button" className="btn btn-secondary" onClick={addAssignmentClass} disabled={!assignmentClassId}>
              Add
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 10,
            maxHeight: 320,
            overflowY: 'auto',
            padding: '4px 0'
        }}>
            {classes.map(c => {
            const isChecked = selectedClassIds
                .map(normalizeId)
                .includes(normalizeId(c.id));
            return (<label key={c.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: `1px solid ${isChecked
                        ? 'var(--primary)'
                        : 'var(--border)'}`,
                    background: isChecked
                        ? 'rgba(2,132,199,0.06)'
                        : 'var(--card-bg)',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                }}>
                  <input type="checkbox" checked={isChecked} onChange={e => {
                    if (e.target.checked) {
                        setSelectedClassIds(prev => {
                            const classId = normalizeId(c.id);
                            const exists = prev
                                .map(normalizeId)
                                .includes(classId);
                            return exists ? prev : [...prev, classId];
                        });
                    }
                    else {
                        setSelectedClassIds(prev => prev.filter(id => normalizeId(id) !==
                            normalizeId(c.id)));
                    }
                }} style={{
                    accentColor: 'var(--primary)',
                    width: 16,
                    height: 16
                }}/>

                  <div>
                    <div style={{
                    fontWeight: 600,
                    fontSize: 13
                }}>
                      {c.name}{' '}
                      {c.section}
                    </div>

                    <div style={{
                    fontSize: 11,
                    color: 'var(--text-muted)'
                }}>
                      {c.subject ||
                    'All Subjects'}
                    </div>
                  </div>
                </label>);
        })}
          </div>
        </div>
      </Modal>

      {/* View Assigned Classes Details Popup Modal */}
      <Modal isOpen={showViewClassesModal} onClose={() => setShowViewClassesModal(false)} title={viewClassesStaff
            ? `Assigned Classes for ${viewClassesStaff.full_name}`
            : 'Assigned Classes Details'} footer={<button className="btn btn-secondary" onClick={() => setShowViewClassesModal(false)}>
            Close
          </button>}>
        <div>
          {viewClassesList.length === 0 ? (<div style={{
                padding: 24,
                textAlign: 'center',
                color: 'var(--text-muted)'
            }}>
              No classes currently assigned
              to this staff member.
            </div>) : (<div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12
            }}>
              <div style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                marginBottom: 4
            }}>
                <strong>
                  {viewClassesStaff?.full_name}
                </strong>{' '}
                is assigned to the following{' '}
                <strong>
                  {viewClassesList.length}
                </strong>{' '}
                class(es):
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 10
            }}>
                {viewClassesList.map(c => (<div key={c.id} style={{
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: 12,
                    background: 'var(--bg)'
                }}>
                    <div style={{
                    fontWeight: 700,
                    fontSize: 14,
                    color: 'var(--primary)'
                }}>
                      {c.name}{' '}
                      {c.section &&
                    `(${c.section})`}
                    </div>

                    <div style={{
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    marginTop: 4
                }}>
                      Subject:{' '}
                      <strong>
                        {c.subject ||
                    'General'}
                      </strong>
                    </div>

                    <div style={{
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    marginTop: 2
                }}>
                      Students:{' '}
                      <strong>
                        {c.student_count ||
                    0}{' '}
                        enrolled
                      </strong>
                    </div>
                  </div>))}
              </div>
            </div>)}
        </div>
      </Modal>

      {/* Export CSV Modal */}
      <ExportCSVModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Staff Records"
        isAttendance={false}
        records={staff}
        onExport={handleExecuteExport}
      />

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
    </Layout>);
}
