const express = require('express');
const router = express.Router();
const telemetryController = require('../controllers/telemetryController');
const deviceAuth = require('../middleware/deviceAuth');

router.post('/app_metrics', telemetryController.saveAppMetrics);
router.post('/app_failure_logs', telemetryController.saveAppFailureLog);
router.post('/schoolattendancemanagement/log', deviceAuth, telemetryController.saveAttendanceLog);

module.exports = router;
