const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const studentController = require('../controllers/studentController');
const deviceAuth = require('../middleware/deviceAuth');
require('dotenv').config();

const IMAGE_DIR = process.env.IMAGE_DIR || 'uploads';

// Configure Multer Storage for student/profile photos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, IMAGE_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Standard routes
router.get('/class/:classId/students', deviceAuth, studentController.getStudents);
router.get('/Device/GetStudents', deviceAuth, studentController.getDeviceStudents);

// Face registration & Syncing
router.post('/faces/register', deviceAuth, studentController.registerFace);
router.post('/faces/upload', deviceAuth, studentController.uploadFaceImage);
router.get('/faces/all', deviceAuth, studentController.getAllFaces);

// Device photo utilities
router.get('/Device/GetStudentFacePhotos', deviceAuth, studentController.getStudentFacePhotos);
router.post('/Device/SaveStudentPhoto', deviceAuth, studentController.saveStudentPhoto);
router.put('/Device/SaveProfilePhoto', deviceAuth, studentController.saveProfilePhoto);
router.get('/Device/GetPhoneTypes', studentController.getPhoneTypes);

// File Upload endpoint
router.post('/Device/UploadFile', upload.single('file'), studentController.uploadFile);

// Recognition Enrollment endpoint
router.post('/v1/enroll-student', studentController.enrollStudent);

module.exports = router;
