const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const deviceAuth = require('../middleware/deviceAuth');

// Public Auth routes
router.post('/login', authController.login);
router.post('/TeacherLogin', authController.login);
router.post('/auth/login', authController.login);
router.post('/Device/ValidateUser', authController.deviceLogin);
router.post('/auth/admin/login', authController.adminLogin);
router.post('/v1/teachers-info', authController.syncTeacherInfo);

// Protected Auth routes
router.post('/Account/ChangePassword', deviceAuth, authController.changePassword);
router.post('/Contact/GetContactDetails', deviceAuth, authController.getContactDetails);

module.exports = router;
