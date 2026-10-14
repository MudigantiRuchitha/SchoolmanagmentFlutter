import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach token from localStorage to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('org');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Super Admin API (uses separate token)
const superApi = axios.create({
  baseURL: '/api/super-admin',
  headers: { 'Content-Type': 'application/json' },
});
superApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('superToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
superApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/login')) {
      localStorage.removeItem('superToken');
      window.location.href = '/super-admin/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const loginAdmin = (data) => api.post('/auth/login', data);
export const logoutUser = () => api.post('/auth/logout');
export const changePassword = (data) => api.post('/auth/change-password', data);
export const getMe = () => api.get('/auth/me');

// Super Admin Auth
export const loginSuperAdmin = (data) => superApi.post('/login', data);
export const getSuperAdminOrgs = () => superApi.get('/organisations');
export const createOrg = (data) => superApi.post('/organisations', data);
export const updateOrg = (id, data) => superApi.put(`/organisations/${id}`, data);
export const deleteOrg = (id) => superApi.delete(`/organisations/${id}`);
export const getSuperAdminStats = () => superApi.get('/stats');
export const changeSuperAdminPassword = (data) => superApi.post('/change-password', data);

// Dashboard
export const getDashboardStats = () => api.get('/dashboard/stats');
export const getDashboardAttendance = (params) => api.get('/dashboard/attendance-today', { params });
export const getRecentNotices = () => api.get('/dashboard/recent-notices');

// Branches
export const getBranches = (params) => api.get('/branches', { params });
export const getBranchDetails = (id) => api.get(`/branches/${id}/details`);
export const createBranch = (data) => api.post('/branches', data);
export const updateBranch = (id, data) => api.put(`/branches/${id}`, data);
export const deleteBranch = (id) => api.delete(`/branches/${id}`);

// Branch Groups
export const getBranchGroups = () => api.get('/branch-groups');
export const createBranchGroup = (data) => api.post('/branch-groups', data);
export const updateBranchGroup = (id, data) => api.put(`/branch-groups/${id}`, data);
export const deleteBranchGroup = (id) => api.delete(`/branch-groups/${id}`);

// Admin Users
export const getAdmins = () => api.get('/admins');
export const createAdmin = (data) => api.post('/admins', data);
export const updateAdmin = (id, data) => api.put(`/admins/${id}`, data);
export const deleteAdmin = (id) => api.delete(`/admins/${id}`);

// Settings
export const getSettings = () => api.get('/settings');
export const updateSettings = (data) => api.put('/settings', data);

// Academic Groups
export const getAcademicGroups = () => api.get('/academic-groups');
export const createAcademicGroup = (data) => api.post('/academic-groups', data);
export const updateAcademicGroup = (id, data) => api.put(`/academic-groups/${id}`, data);
export const deleteAcademicGroup = (id) => api.delete(`/academic-groups/${id}`);

// Classes
export const getClasses = (params) => api.get('/classes', { params });
export const getTeacherPeriods = (teacherId, classId) => api.get(`/teacher/${teacherId}/classes/${classId}/periods`);
export const createClass = (data) => api.post('/classes', data);
export const updateClass = (id, data) => api.put(`/classes/${id}`, data);
export const deleteClass = (id) => api.delete(`/classes/${id}`);

// Staff
export const getStaff = (params) => api.get('/staff', { params });
export const createStaff = (data) => api.post('/staff', data);
export const updateStaff = (id, data) => api.put(`/staff/${id}`, data);
export const deleteStaff = (id) => api.delete(`/staff/${id}`);
export const assignStaffClasses = (id, classIds) => api.put(`/staff/${id}/assign-classes`, { classIds });
export const bulkImportStaff = (data) => api.post('/staff/bulk-import', data);

// Students
export const getStudents = (params) => api.get('/students', { params });
export const createStudent = (data) => api.post('/students', data);
export const updateStudent = (id, data) => api.put(`/students/${id}`, data);
export const deleteStudent = (id) => api.delete(`/students/${id}`);
export const bulkImportStudents = (data) => api.post('/students/bulk-import', data);

// Attendance
export const getStudentAttendance = (params) => api.get('/attendance/students', { params });
export const markStudentAttendance = (data) => api.post('/attendance/students', data);
export const getStaffAttendance = (params) => api.get('/attendance/staff', { params });
export const markStaffAttendance = (data) => api.post('/attendance/staff', data);

// Timetable Setup & Class Attendance Settings
export const getOrgDefaultTimetable = () => api.get('/timetable/org-default');
export const saveOrgDefaultTimetable = (data) => api.post('/timetable/org-default', data);
export const getClassAttendanceSettings = (classId) => api.get(`/timetable/settings/${classId}`);
export const saveClassAttendanceSettings = (classId, data) => api.post(`/timetable/settings/${classId}`, data);
export const deleteTimetableSlot = (slotId) => api.delete(`/timetable/slot/${slotId}`);

// Leaves
export const getLeaves = (params) => api.get('/leaves', { params });
export const getLeaveTypes = () => api.get('/leaves/types');
export const createLeaveType = (data) => api.post('/leaves/types', data);
export const deleteLeaveType = (id) => api.delete(`/leaves/types/${id}`);
export const applyLeave = (data) => api.post('/leaves', data);
export const updateLeave = (id, data) => api.put(`/leaves/${id}`, data);
export const deleteLeave = (id) => api.delete(`/leaves/${id}`);

// Holidays
export const getHolidays = (params) => api.get('/holidays', { params });
export const createHoliday = (data) => api.post('/holidays', data);
export const updateHoliday = (id, data) => api.put(`/holidays/${id}`, data);
export const deleteHoliday = (id) => api.delete(`/holidays/${id}`);

// Notices
export const getNotices = (params) => api.get('/notices', { params });
export const createNotice = (data) => api.post('/notices', data);
export const updateNotice = (id, data) => api.put(`/notices/${id}`, data);
export const deleteNotice = (id) => api.delete(`/notices/${id}`);

// Academic Data
export const getAcademicYears = () => api.get('/academic-data/years');
export const getAcademicClasses = (params) => api.get('/academic-data/classes', { params });
export const getAcademicStudents = (params) => api.get('/academic-data/students', { params });
export const getAcademicStaff = (params) => api.get('/academic-data/staff', { params });

export default api;
