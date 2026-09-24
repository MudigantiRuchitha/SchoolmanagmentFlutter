import { useState, useEffect, useRef } from 'react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { filterBranches, getBranchScope, isDedicatedBranchUser } from '../utils/branchScope';
import ClassSectionSelect from '../components/ClassSectionSelect';
import { getStaff, createStaff, updateStaff, deleteStaff, getBranches, getClasses, assignStaffClasses, bulkImportStaff } from '../api';
import { MdAdd, MdEdit, MdDelete, MdSearch, MdPeople, MdCheckCircle, MdCancel, MdDownload, MdUpload, MdClass, MdVisibility, MdVisibilityOff, MdFilePresent, MdPerson, MdWarning } from 'react-icons/md';
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
    isActive: true
};
const cloneEmptyForm = () => ({ ...emptyForm });
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
    const { user } = useAuth();
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
    const [duplicateRows, setDuplicateRows] = useState([]);
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
    const [toast, setToast] = useState('');
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
    const handleSubmit = async (e) => {
        e?.preventDefault();
        if (!validateForm()) {
            return;
        }
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
            branchId
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
    const handleToggleStatus = async (s) => {
        try {
            await updateStaff(s.id, {
                isActive: !Boolean(s.is_active)
            });
            showToast(`Staff "${s.full_name || s.staff_id}" ${!s.is_active ? 'activated' : 'deactivated'}.`);
            await fetchInit();
        }
        catch (err) {
            showToast(err.response?.data?.message ||
                err.message ||
                'Failed to update status.');
        }
    };
    const handleDelete = async (s) => {
        const name = s.full_name || s.staff_id || 'this staff member';
        if (!window.confirm(`Delete staff member "${name}"?`)) {
            return;
        }
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
    const exportCSV = () => {
        try {
            if (!staff.length) {
                showToast('No rows to export. There are no staff records available.');
                return;
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
                'Phone',
                'Email',
                'Gender',
                'Status'
            ];
            const rows = staff.map(s => [
                s.staff_id,
                s.username,
                s.first_name,
                s.last_name,
                s.full_name,
                s.role_type,
                s.designation,
                s.branch_name,
                s.assigned_classes,
                s.phone,
                s.email,
                s.gender,
                s.is_active ? 'Active' : 'Inactive'
            ]);
            const csvContent = [
                headers.map(csvEscape).join(','),
                ...rows.map(row => row.map(csvEscape).join(','))
            ].join('\r\n');
            const blob = new Blob(['\uFEFF', csvContent], {
                type: 'text/csv;charset=utf-8;'
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `staff_list_${new Date()
                .toISOString()
                .slice(0, 10)}.csv`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
            showToast('Staff CSV exported successfully.');
        }
        catch (error) {
            console.error('Staff CSV export failed:', error);
            showToast('CSV export failed. Please try again.');
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
        const csvContent = [
            headers.map(csvEscape).join(','),
            ...sampleRows.map(row => row.map(csvEscape).join(','))
        ].join('\r\n');
        const blob = new Blob(['\uFEFF', csvContent], {
            type: 'text/csv;charset=utf-8;'
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'sample_staff_import.csv';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };
    const handleFileUpload = e => {
        const file = e.target.files?.[0];
        // Allow selecting the same file again after clearing.
        if (e.target) {
            e.target.value = '';
        }
        if (!file) {
            return;
        }
        if (!/\.csv$/i.test(file.name)) {
            setImportError('Please select a CSV file.');
            setImportFileName('');
            return;
        }
        setImportError('');
        setImportFileName(file.name);
        setDuplicateRows([]);
        setImportRows([]);
        const reader = new FileReader();
        reader.onload = event => {
            try {
                const text = String(event.target?.result || '')
                    .replace(/^\uFEFF/, '');
                const rows = parseCSV(text);
                if (rows.length < 2) {
                    setImportError('CSV file is empty or missing data rows.');
                    return;
                }
                const headers = rows[0].map(normalizeHeader);
                const headerIndex = {};
                headers.forEach((header, index) => {
                    if (header) {
                        headerIndex[header] = index;
                    }
                });
                const getCell = (row, ...names) => {
                    for (const name of names) {
                        const index = headerIndex[normalizeHeader(name)];
                        if (index !== undefined) {
                            return String(row[index] ?? '').trim();
                        }
                    }
                    return '';
                };
                const parsed = [];
                const rowErrors = [];
                rows.slice(1).forEach((row, index) => {
                    const staffId = getCell(row, 'Staff ID', 'staff_id');
                    if (!staffId) {
                        rowErrors.push(`Row ${index + 2}: Staff ID is required.`);
                        return;
                    }
                    const firstName = getCell(row, 'First Name', 'first_name');
                    const lastName = getCell(row, 'Last Name', 'last_name');
                    if (!firstName || !lastName) {
                        rowErrors.push(`Row ${index + 2}: First Name and Last Name are required.`);
                        return;
                    }
                    const roleType = (getCell(row, 'Role Type', 'role_type') ||
                        'teaching').toLowerCase();
                    if (!ROLES.includes(roleType)) {
                        rowErrors.push(`Row ${index + 2}: Invalid role "${roleType}".`);
                        return;
                    }
                    const phone = getCell(row, 'Phone', 'phone');
                    if (phone && cleanPhoneNumber(phone).length !== 10) {
                        rowErrors.push(`Row ${index + 2}: Phone number must contain exactly 10 digits.`);
                        return;
                    }
                    const email = getCell(row, 'Email', 'email');
                    if (email &&
                        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                        rowErrors.push(`Row ${index + 2}: Invalid email address.`);
                        return;
                    }
                    parsed.push({
                        staffId,
                        firstName,
                        lastName,
                        fullName: `${firstName} ${lastName}`.trim(),
                        username: getCell(row, 'Username', 'username'),
                        roleType,
                        designation: getCell(row, 'Designation', 'designation'),
                        branchName: getCell(row, 'Branch Name', 'Branch', 'branch_name', 'branch'),
                        phone: cleanPhoneNumber(phone),
                        email,
                        gender: getCell(row, 'Gender', 'gender'),
                        dateOfJoining: getCell(row, 'Date of Joining YYYY-MM-DD', 'Date of Joining', 'date_of_joining'),
                        password: getCell(row, 'Password', 'password') ||
                            'Teacher@123'
                    });
                });
                const existingStaffIds = new Set(staff
                    .map(s => normalizeStaffId(s.staff_id))
                    .filter(Boolean));
                const csvStaffIds = new Set();
                const newRows = [];
                const duplicates = [];
                parsed.forEach(row => {
                    const normalizedId = normalizeStaffId(row.staffId);
                    if (existingStaffIds.has(normalizedId)) {
                        duplicates.push({
                            ...row,
                            duplicateReason: 'Already exists'
                        });
                        return;
                    }
                    if (csvStaffIds.has(normalizedId)) {
                        duplicates.push({
                            ...row,
                            duplicateReason: 'Duplicate in CSV'
                        });
                        return;
                    }
                    csvStaffIds.add(normalizedId);
                    newRows.push(row);
                });
                setImportRows(newRows);
                setDuplicateRows(duplicates);
                if (rowErrors.length) {
                    setImportError(`${rowErrors.length} row(s) could not be prepared for import. ` +
                        rowErrors.slice(0, 5).join(' '));
                }
                if (duplicates.length > 0 && newRows.length > 0) {
                    showToast(`${duplicates.length} duplicate staff ID(s) skipped. ` +
                        `${newRows.length} new staff member(s) ready to import.`);
                }
                else if (duplicates.length > 0 &&
                    newRows.length === 0) {
                    showToast(`All ${duplicates.length} staff record(s) are duplicates. Nothing new to import.`);
                }
                else if (newRows.length > 0) {
                    showToast(`${newRows.length} new staff member(s) ready to import.`);
                }
            }
            catch (error) {
                console.error('CSV parsing failed:', error);
                setImportRows([]);
                setDuplicateRows([]);
                setImportError('Unable to read this CSV file. Please use the downloaded template.');
            }
        };
        reader.onerror = () => {
            setImportRows([]);
            setDuplicateRows([]);
            setImportError('Unable to read the selected CSV file.');
        };
        reader.readAsText(file, 'UTF-8');
    };
    const handleConfirmImport = async () => {
        if (importRows.length === 0) {
            showToast(duplicateRows.length > 0
                ? 'All uploaded Staff IDs are duplicates. Nothing new to import.'
                : 'Please upload a valid CSV file first.');
            return;
        }
        setImporting(true);
        setImportError('');
        try {
            const branchScope = getBranchScope();
            const branchNameForScope = branches.find(b => normalizeId(b.id) === normalizeId(branchScope))?.name || '';
            const rowsToImport = importRows.map(row => ({
                ...row,
                ...(isDedicatedBranchUser() && branchNameForScope
                    ? { branchName: branchNameForScope }
                    : {})
            }));
            const res = await bulkImportStaff({
                staff: rowsToImport
            });
            const importedCount = res?.data?.importedCount ?? rowsToImport.length;
            showToast(`${importedCount} new staff member(s) imported successfully. ` +
                `${duplicateRows.length} duplicate(s) skipped.`);
            setShowImportModal(false);
            setImportRows([]);
            setDuplicateRows([]);
            setImportFileName('');
            setImportError('');
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            await fetchInit();
        }
        catch (err) {
            const message = err.response?.data?.message ||
                err.message ||
                'Failed to import staff members.';
            setImportError(message);
        }
        finally {
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
      {toast && (<div className="alert alert-success">
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

        <button className="btn btn-secondary btn-sm" onClick={() => {
            setImportError('');
            setImportRows([]);
            setDuplicateRows([]);
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

          <button className="btn btn-secondary btn-sm" onClick={exportCSV} title="Export CSV" style={{
            padding: '6px 10px',
            fontSize: 12.5,
            height: 36,
            whiteSpace: 'nowrap'
        }}>
            <MdDownload size={14}/>
            {' '}Export CSV
          </button>

          <button className="btn btn-primary" onClick={openAdd} style={{
            padding: '6px 12px',
            fontSize: 12.5,
            height: 36,
            whiteSpace: 'nowrap'
        }}>
            <MdAdd size={16}/>
            {' '}Add Staff
          </button>
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
                <th>Contact</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filtered.length === 0 ? (<tr>
                  <td colSpan={8}>
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

              <button className="btn btn-danger" onClick={() => {
                setShowStaffViewModal(false);
                handleDelete(viewStaff);
            }}>
                <MdDelete /> Delete Staff
              </button>
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
                : 'Save Staff'}
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
      <Modal isOpen={showImportModal} onClose={() => {
            setShowImportModal(false);
            setImportRows([]);
            setDuplicateRows([]);
            setImportFileName('');
            setImportError('');
        }} title="Import Staff Members from CSV" size="lg" footer={<>
            <button type="button" className="btn btn-secondary" onClick={() => {
                setShowImportModal(false);
                setImportRows([]);
                setDuplicateRows([]);
                setImportFileName('');
                setImportError('');
            }}>
              Cancel
            </button>

            <button type="button" className="btn btn-primary" onClick={handleConfirmImport} disabled={importing ||
                importRows.length === 0}>
              {importing
                ? 'Importing...'
                : `Import ${importRows.length} Staff Members`}
            </button>
          </>}>
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16
        }}>
          {importError && (<div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                borderRadius: 8,
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                fontSize: 13,
                lineHeight: 1.5
            }}>
              <MdWarning size={18} style={{
                flexShrink: 0,
                marginTop: 1
            }}/>

              <div style={{ flex: 1 }}>
                <div style={{
                fontWeight: 700,
                marginBottom: 2
            }}>
                  Import failed
                </div>

                <div>
                  {importError}
                </div>
              </div>

              <button type="button" onClick={() => setImportError('')} style={{
                border: 'none',
                background: 'transparent',
                color: '#b91c1c',
                cursor: 'pointer',
                fontSize: 18,
                lineHeight: 1,
                padding: 0
            }} title="Dismiss">
                ×
              </button>
            </div>)}

          {/* Step 1 */}
          <div style={{
            background: '#f8fafc',
            padding: 16,
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
        }}>
            <div>
              <div style={{
            fontWeight: 700,
            fontSize: 14
        }}>
                1. Download Sample CSV Template
              </div>

              <div style={{
            fontSize: 12,
            color: 'var(--text-muted)'
        }}>
                Use our pre-formatted CSV
                template to organize your
                staff records.
              </div>
            </div>

            <button className="btn btn-secondary btn-sm" onClick={downloadSampleCSV}>
              <MdDownload />
              {' '}Download Template
            </button>
          </div>
          {/* Step 2 */}
          <div>
            <div style={{
            fontWeight: 700,
            fontSize: 14,
            marginBottom: 8
        }}>
              2. Upload Filled CSV File
            </div>

            <input type="file" ref={fileInputRef} accept=".csv,text/csv" style={{ display: 'none' }} onChange={handleFileUpload}/>

            <div onClick={() => {
            if (!importing) {
                fileInputRef.current?.click();
            }
        }} style={{
            position: 'relative',
            zIndex: 10,
            border: importError
                ? '2px solid #ef4444'
                : '2px dashed #cbd5e1',
            borderRadius: 10,
            padding: '24px 16px',
            textAlign: 'center',
            cursor: importing
                ? 'not-allowed'
                : 'pointer',
            background: importError
                ? '#fff7f7'
                : '#fafafa',
            transition: 'all 0.2s',
            overflow: 'visible',
            boxShadow: importError
                ? '0 0 0 3px rgba(239,68,68,0.08)'
                : 'none'
        }}>
              <MdFilePresent size={32} color={importError ? '#ef4444' : '#64748b'} style={{
            margin: '0 auto 8px auto',
            display: 'block'
        }}/>

              <div style={{
            fontWeight: 600,
            fontSize: 14,
            color: importError
                ? '#991b1b'
                : 'inherit'
        }}>
                {importFileName
            ? `Selected: ${importFileName}`
            : 'Click to select .CSV file from your computer'}
              </div>

              <div style={{
            fontSize: 12,
            color: importError
                ? '#b91c1c'
                : 'var(--text-muted)',
            marginTop: 4
        }}>
                Only CSV format is supported
              </div>

              {/* ERROR INSIDE UPLOAD CARD */}
              {importError && (<div role="alert" aria-live="assertive" onClick={e => e.stopPropagation()} style={{
                position: 'relative',
                zIndex: 999,
                marginTop: 14,
                background: '#fef2f2',
                border: '1px solid #ef4444',
                borderRadius: 8,
                padding: '11px 12px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                textAlign: 'left',
                color: '#991b1b',
                fontSize: 13,
                lineHeight: 1.45,
                boxShadow: '0 3px 10px rgba(127,29,29,0.12)'
            }}>
                  <MdWarning size={19} style={{
                flexShrink: 0,
                marginTop: 1
            }}/>

                  <div style={{ flex: 1 }}>
                    <div style={{
                fontWeight: 700,
                marginBottom: 3
            }}>
                      CSV Import Error
                    </div>

                    <div>
                      {importError}
                    </div>
                  </div>

                  <button type="button" onClick={e => {
                e.stopPropagation();
                setImportError('');
            }} style={{
                border: 'none',
                background: 'transparent',
                color: '#991b1b',
                cursor: 'pointer',
                fontSize: 18,
                fontWeight: 700,
                lineHeight: 1,
                padding: 0
            }} title="Close error">
                    ×
                  </button>
                </div>)}
            </div>

            {/* No records warning */}
            {importFileName &&
            !importError &&
            importRows.length === 0 && (<div style={{
                marginTop: 10,
                background: '#fffbeb',
                border: '1px solid #f59e0b',
                color: '#92400e',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 8
            }}>
                  <MdWarning size={18}/>

                  <span>
                    No valid staff records were found
                    in this CSV file.
                  </span>
                </div>)}
          </div>

          {/* Step 3 - New Record Preview */}
          {importRows.length > 0 && (<div>
              <div style={{
                fontWeight: 700,
                fontSize: 14,
                marginBottom: 8,
                display: 'flex',
                justifyContent: 'space-between'
            }}>
                <span>
                  3. Preview Records (
                  {importRows.length} new)
                </span>

                {duplicateRows.length > 0 && (<span style={{
                    color: '#d97706',
                    fontSize: 12,
                    fontWeight: 600
                }}>
                    {duplicateRows.length}{' '}
                    duplicate(s) skipped
                  </span>)}
              </div>

              <div style={{
                maxHeight: 240,
                overflowY: 'auto',
                border: '1px solid #e2e8f0',
                borderRadius: 8
            }}>
                <table style={{
                fontSize: 12,
                width: '100%'
            }}>
                  <thead>
                    <tr style={{
                background: '#f1f5f9'
            }}>
                      <th style={{
                padding: '6px 10px'
            }}>
                        #
                      </th>

                      <th style={{
                padding: '6px 10px'
            }}>
                        Staff ID
                      </th>

                      <th style={{
                padding: '6px 10px'
            }}>
                        Full Name
                      </th>

                      <th style={{
                padding: '6px 10px'
            }}>
                        Role
                      </th>

                      <th style={{
                padding: '6px 10px'
            }}>
                        Phone
                      </th>

                      <th style={{
                padding: '6px 10px'
            }}>
                        Branch
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {importRows.map((r, i) => (<tr key={i} style={{
                    borderBottom: '1px solid #f1f5f9'
                }}>
                        <td style={{
                    padding: '6px 10px'
                }}>
                          {i + 1}
                        </td>

                        <td style={{
                    padding: '6px 10px',
                    fontFamily: 'monospace',
                    fontWeight: 600
                }}>
                          {r.staffId || '—'}
                        </td>

                        <td style={{
                    padding: '6px 10px',
                    fontWeight: 600
                }}>
                          {r.fullName || '—'}
                        </td>

                        <td style={{
                    padding: '6px 10px'
                }}>
                          {r.roleType}
                        </td>

                        <td style={{
                    padding: '6px 10px'
                }}>
                          {r.phone || '—'}
                        </td>

                        <td style={{
                    padding: '6px 10px'
                }}>
                          {r.branchName || '—'}
                        </td>
                      </tr>))}
                  </tbody>
                </table>
              </div>

              {/* =====================================================
                LAST-CHANGE INSERTION POINT
                
                This is immediately AFTER the new-record preview
                table, exactly where you asked for the new content.
                
                I have NOT invented the missing content because the
                actual code/snippet you wanted to add is not visible
                in the conversation.
               ===================================================== */}

              {/* where to add this */}

            </div>)}
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
    </Layout>);
}
