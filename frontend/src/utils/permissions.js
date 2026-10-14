// =======================================================================
// Role-Based Access Control (RBAC) & Permission Specifications
// Supports:
// 1. Full Access (Admin)
// 2. Read and Write Access (Manager)
// 3. Only Read Access (Viewer)
// =======================================================================

export const ACCESS_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  VIEWER: 'viewer',
};

export const ROLE_DEFINITIONS = {
  admin: {
    key: 'admin',
    name: 'Full Access (Admin)',
    shortName: 'Full Access',
    badgeClass: 'badge-purple',
    badgeBg: '#ede9fe',
    badgeColor: '#7c3aed',
    accentColor: '#7c3aed',
    summary: 'Complete administrative control. Full permission to view, create, edit, and delete all records, configure organization parameters, and manage administrators.',
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canManageAdmins: true,
    canManageSettings: true,
  },
  manager: {
    key: 'manager',
    name: 'Read and Write Access (Manager)',
    shortName: 'Read & Write',
    badgeClass: 'badge-info',
    badgeBg: '#dbeafe',
    badgeColor: '#1d4ed8',
    accentColor: '#2563eb',
    summary: 'Operational read and write privileges. Can view, create, and update records across students, staff, classes, attendance, and leaves. Master record deletions and administrator account management are restricted.',
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: false,
    canManageAdmins: false,
    canManageSettings: false,
  },
  viewer: {
    key: 'viewer',
    name: 'Only Read Access (Viewer)',
    shortName: 'Only Read',
    badgeClass: 'badge-gray',
    badgeBg: '#f1f5f9',
    badgeColor: '#475569',
    accentColor: '#64748b',
    summary: 'Strict read-only access. Can browse records, view profiles, inspect timetables, and download analytical reports across all modules. All creation, editing, and deletion capabilities are completely disabled.',
    canView: true,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canManageAdmins: false,
    canManageSettings: false,
  },
};

// Detailed Module-by-Module Permission Specification Matrix
export const PERMISSION_SPECIFICATIONS = [
  {
    category: 'Student Management',
    icon: 'MdPersonAdd',
    module: 'Students & Enrollment',
    description: 'Student profiles, admission details, parent info, and enrollment',
    permissions: {
      admin: { view: true, create: true, edit: true, delete: true, import: true, export: true, notes: 'Full CRUD & bulk import/export' },
      manager: { view: true, create: true, edit: true, delete: false, import: true, export: true, notes: 'Enroll & update students, bulk import. Deletions disabled' },
      viewer: { view: true, create: false, edit: false, delete: false, import: false, export: true, notes: 'View directory & export CSV report only' },
    }
  },
  {
    category: 'Staff Management',
    icon: 'MdPeople',
    module: 'Staff Directory',
    description: 'Teacher profiles, employment records, designations, and class assignments',
    permissions: {
      admin: { view: true, create: true, edit: true, delete: true, import: true, export: true, notes: 'Full CRUD & class assignment control' },
      manager: { view: true, create: true, edit: true, delete: false, import: true, export: true, notes: 'Add & update staff, assign classes. Deletions disabled' },
      viewer: { view: true, create: false, edit: false, delete: false, import: false, export: true, notes: 'View staff directory & export CSV report only' },
    }
  },
  {
    category: 'Academic Structure',
    icon: 'MdSchool',
    module: 'Classes & Sections',
    description: 'Classrooms, sections, room assignments, and academic groups',
    permissions: {
      admin: { view: true, create: true, edit: true, delete: true, import: true, export: true, notes: 'Create, modify, and delete classes & sections' },
      manager: { view: true, create: true, edit: true, delete: false, import: true, export: true, notes: 'Create & edit classes and sections. Deletions disabled' },
      viewer: { view: true, create: false, edit: false, delete: false, import: false, export: true, notes: 'View class rosters and section layouts only' },
    }
  },
  {
    category: 'Attendance Tracking',
    icon: 'MdEventNote',
    module: 'Student & Staff Attendance',
    description: 'Daily attendance marking, biometric logs, check-ins, and summaries',
    permissions: {
      admin: { view: true, create: true, edit: true, delete: true, import: true, export: true, notes: 'Mark, modify, override, and export attendance records' },
      manager: { view: true, create: true, edit: true, delete: false, import: true, export: true, notes: 'Mark & update daily attendance registers. Records locked from deletion' },
      viewer: { view: true, create: false, edit: false, delete: false, import: false, export: true, notes: 'View attendance registers & export analytical reports only' },
    }
  },
  {
    category: 'Timetable & Scheduling',
    icon: 'MdAccessTime',
    module: 'Timetable Setup',
    description: 'Period configuration, subject allotments, teacher scheduling',
    permissions: {
      admin: { view: true, create: true, edit: true, delete: true, import: true, export: true, notes: 'Configure periods, assign teacher slots, and clear timetables' },
      manager: { view: true, create: true, edit: true, delete: false, import: true, export: true, notes: 'Configure periods and assign subjects/teachers to slots' },
      viewer: { view: true, create: false, edit: false, delete: false, import: false, export: true, notes: 'View class schedules and teacher timetables only' },
    }
  },
  {
    category: 'Operations & Management',
    icon: 'MdBeachAccess',
    module: 'Leaves, Notices & Holidays',
    description: 'Staff leave approvals, school-wide notices, and academic calendars',
    permissions: {
      admin: { view: true, create: true, edit: true, delete: true, import: true, export: true, notes: 'Approve/reject leaves, publish notices, add/remove holidays' },
      manager: { view: true, create: true, edit: true, delete: false, import: true, export: true, notes: 'Review leaves, publish notices, add holidays' },
      viewer: { view: true, create: false, edit: false, delete: false, import: false, export: true, notes: 'View leave applications, notices, and calendar only' },
    }
  },
  {
    category: 'Organisation & Branches',
    icon: 'MdBusiness',
    module: 'Branches & Branch Groups',
    description: 'Multi-branch setups, geo-fencing, coordinates, and branch clusters',
    permissions: {
      admin: { view: true, create: true, edit: true, delete: true, import: true, export: true, notes: 'Add, edit, configure geo-fence, and delete branches' },
      manager: { view: true, create: false, edit: false, delete: false, import: false, export: true, notes: 'View branch listings within permitted scope only' },
      viewer: { view: true, create: false, edit: false, delete: false, import: false, export: true, notes: 'View branch listings within permitted scope only' },
    }
  },
  {
    category: 'Security & Control',
    icon: 'MdAdminPanelSettings',
    module: 'Admin Users & RBAC',
    description: 'Manage admin accounts, set role levels, and assign branch scopes',
    permissions: {
      admin: { view: true, create: true, edit: true, delete: true, import: false, export: true, notes: 'Create, update, activate/deactivate, and delete admin users' },
      manager: { view: false, create: false, edit: false, delete: false, import: false, export: false, notes: 'Restricted: Cannot manage admin accounts' },
      viewer: { view: false, create: false, edit: false, delete: false, import: false, export: false, notes: 'Restricted: Cannot manage admin accounts' },
    }
  },
  {
    category: 'System Configuration',
    icon: 'MdSettings',
    module: 'Organisation Settings',
    description: 'School name, logo, global timetable access, and attendance modes',
    permissions: {
      admin: { view: true, create: true, edit: true, delete: false, import: false, export: true, notes: 'Modify organization profile, logo, attendance mode, and timetable toggle' },
      manager: { view: true, create: false, edit: false, delete: false, import: false, export: false, notes: 'View organization details only (cannot modify settings)' },
      viewer: { view: true, create: false, edit: false, delete: false, import: false, export: false, notes: 'View organization details only (cannot modify settings)' },
    }
  },
];

// Helper: Normalize role string
export function getUserRole(user) {
  const role = (user?.role || '').toLowerCase().trim();
  if (role === 'viewer') return 'viewer';
  if (role === 'manager') return 'manager';
  return 'admin';
}

// Helper: Boolean checks
export function isReadOnlyUser(user) {
  return getUserRole(user) === 'viewer';
}

export function hasWriteAccess(user) {
  const role = getUserRole(user);
  return role === 'admin' || role === 'manager';
}

export function isFullAdmin(user) {
  return getUserRole(user) === 'admin';
}

export function canDeleteRecords(user) {
  return getUserRole(user) === 'admin';
}

export function canManageAdmins(user) {
  return getUserRole(user) === 'admin';
}

export function canManageSettings(user) {
  return getUserRole(user) === 'admin';
}

// Helper: Get role badge details
export function getRoleBadgeInfo(role) {
  const normalized = (role || '').toLowerCase().trim();
  return ROLE_DEFINITIONS[normalized] || ROLE_DEFINITIONS.admin;
}
