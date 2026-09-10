const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');
const deviceAuth = require('../middleware/deviceAuth');

router.get('/teacher/:teacherId/classes', deviceAuth, classController.getClasses);
router.get('/teacher/:teacherId/classes/:classId/periods', deviceAuth, classController.getTeacherPeriods);
router.get('/teacher/:teacherId/periods', deviceAuth, classController.getTeacherPeriods);
router.all('/Device/GetUserClasses', deviceAuth, classController.getDeviceUserClasses);
router.all('/Device/UserClasses', deviceAuth, classController.getDeviceUserClasses);
router.all('/Device/GetUserClassInfo', deviceAuth, classController.getDeviceUserClasses);

module.exports = router;
