const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const IMAGE_DIR = process.env.IMAGE_DIR || 'uploads';

app.set('trust proxy', 1);

// Ensure uploads directory exists
const uploadsPath = path.resolve(__dirname, IMAGE_DIR);
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5174',
  'https://acsdemo.co.in',
  'https://www.acsdemo.co.in',
  'http://acsdemo.co.in',
  'http://www.acsdemo.co.in'
];

// Global Middlewares
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
}));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Static files (uploaded photos)
app.use('/uploads', express.static(uploadsPath));
app.use('/' + IMAGE_DIR, express.static(uploadsPath));

// Logging Middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// ============================================================
// WEB MANAGEMENT PORTAL API ROUTES (/api/*)
// ============================================================
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/super-admin', require('./src/routes/superAdmin'));
app.use('/api/dashboard', require('./src/routes/dashboard'));
app.use('/api/branches', require('./src/routes/branches'));
app.use('/api/branch-groups', require('./src/routes/branchGroups'));
app.use('/api/admins', require('./src/routes/admins'));
app.use('/api/settings', require('./src/routes/settings'));
app.use('/api/academic-groups', require('./src/routes/academicGroups'));
app.use('/api/classes', require('./src/routes/classes'));
app.use('/api/staff', require('./src/routes/staff'));
app.use('/api/students', require('./src/routes/students'));
app.use('/api/attendance', require('./src/routes/attendance'));
app.use('/api/leaves', require('./src/routes/leaves'));
app.use('/api/holidays', require('./src/routes/holidays'));
app.use('/api/notices', require('./src/routes/notices'));
app.use('/api/timetable', require('./src/routes/timetable'));

// ============================================================
// MOBILE APP & ATTENDANCE DEVICE API ROUTER
// ============================================================
const mobileApiRouter = express.Router();

const mobileAuthRoutes = require('./src/routes/mobileAuth');
const mobileClassRoutes = require('./src/routes/mobileClasses');
const mobileStudentRoutes = require('./src/routes/mobileStudents');
const mobileAttendanceRoutes = require('./src/routes/mobileAttendance');
const mobileTelemetryRoutes = require('./src/routes/mobileTelemetry');

mobileApiRouter.use(mobileAuthRoutes);
mobileApiRouter.use(mobileClassRoutes);
mobileApiRouter.use(mobileStudentRoutes);
mobileApiRouter.use(mobileAttendanceRoutes);
mobileApiRouter.use(mobileTelemetryRoutes);

// Mock face recognition endpoints
mobileApiRouter.post('/v1/session/init', (req, res) => {
  res.json({
    success: true,
    message: 'Face Recognition Session initialized',
    sessionId: 'sess_' + Date.now()
  });
});

mobileApiRouter.post('/v1/recognize', async (req, res) => {
  const db = require('./src/config/db');
  try {
    const [rows] = await db.query('SELECT id, full_name, roll_number FROM students WHERE has_face_data = true LIMIT 1');
    if (rows.length > 0) {
      const s = rows[0];
      res.json({
        success: true,
        recognized: true,
        studentId: s.id,
        name: s.full_name,
        rollNumber: s.roll_number,
        confidence: 0.94
      });
    } else {
      res.json({
        success: true,
        recognized: false,
        message: 'No registered face records found'
      });
    }
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

mobileApiRouter.delete('/v1/session/:sessionId', (req, res) => {
  res.json({ success: true, message: 'Session closed' });
});

mobileApiRouter.post('/v1/validate-license', (req, res) => {
  res.json({
    Status: 1,
    status: 'active',
    message: 'License key validation successful and active',
    expiryDate: '2030-12-31'
  });
});

// Health check endpoints
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Central School Management API is running', timestamp: new Date().toISOString() });
});

app.get('/api/Health/Check', (req, res) => {
  res.json({ Status: 1, Message: 'Healthy' });
});

// Mount mobileApiRouter under /api
app.use('/api', mobileApiRouter);

// Dynamic Organization Route Prefixing
app.use('/attendance/:orgCode/api', (req, res, next) => {
  req.orgCode = req.params.orgCode;
  next();
}, mobileApiRouter);

// Root Route
app.get('/', (req, res) => {
  res.send('<h1>Central School Management & Attendance API</h1><p>Server is active and operational.</p>');
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.stack);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 Central School Management API running on http://localhost:${PORT}`);
  console.log(`📊 Super Admin: POST http://localhost:${PORT}/api/super-admin/login`);
  console.log(`🏫 Org Admin:   POST http://localhost:${PORT}/api/auth/login`);
  console.log(`📱 Device Login: POST http://localhost:${PORT}/api/Device/ValidateUser`);
  console.log(`==================================================`);
});
