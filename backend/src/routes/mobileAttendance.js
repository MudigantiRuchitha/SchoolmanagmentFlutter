const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const deviceAuth = require('../middleware/deviceAuth');

// Attendance routing
router.post('/attendance/submit', deviceAuth, attendanceController.submitAttendance);
router.post('/Device/BulkAttendanceMark', deviceAuth, attendanceController.bulkAttendanceMark);
router.post('/Device/SubmitTeacherAttendance', deviceAuth, attendanceController.submitTeacherAttendance);

// Reports routing
router.post('/Report/GetContactMonthlyAttendance', deviceAuth, attendanceController.getContactMonthlyAttendance);
router.post('/Report/GetContactMonthlyAttendanceCount', deviceAuth, attendanceController.getContactMonthlyAttendanceCount);
router.post('/Report/GetDailyAttendance', deviceAuth, attendanceController.getDailyAttendance);
router.post('/Report/GetDailyChartAttendance', deviceAuth, attendanceController.getDailyChartAttendance);
router.post('/Report/DownloadContactMonthlyAttendanceReport', deviceAuth, attendanceController.downloadReport);

// Holiday routing
router.post('/Holiday/GetHolidayDetails', deviceAuth, attendanceController.getHolidayDetails);

// Leaves routing
router.get('/Leave/GetLeaveMaster', deviceAuth, attendanceController.getLeaveMaster);
router.post('/Leave/SaveContactLeave', deviceAuth, attendanceController.saveContactLeave);
router.get('/Leave/GetContactLeaveBalance', deviceAuth, attendanceController.getContactLeaveBalance);
router.get('/Leave/GetContactLeaveStatus', deviceAuth, attendanceController.getContactLeaveStatus);

module.exports = router;
