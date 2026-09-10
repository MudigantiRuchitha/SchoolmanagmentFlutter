const db = require('../config/db');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const IMAGE_DIR = process.env.IMAGE_DIR || 'uploads';

// Save Telemetry App Metrics
async function saveAppMetrics(req, res) {
  const {
    device_id,
    login_time_ms,
    student_sync_time_ms,
    server_capture_time_ms,
    submit_time_ms,
    login_status,
    sync_status,
    capture_status,
    capture_reason,
    submit_status
  } = req.body;

  try {
    await db.query(
      `INSERT INTO app_metrics 
      (device_id, login_time_ms, student_sync_time_ms, server_capture_time_ms, submit_time_ms, login_status, sync_status, capture_status, capture_reason, submit_status) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [device_id, login_time_ms, student_sync_time_ms, server_capture_time_ms, submit_time_ms, login_status, sync_status, capture_status, capture_reason, submit_status]
    );

    res.status(201).json({
      success: true,
      message: 'App metrics recorded',
      data: { metric_id: 'met_' + Date.now(), created_at: new Date().toISOString() }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to save app metrics: ' + err.message });
  }
}

// Save Telemetry App Failure Log
async function saveAppFailureLog(req, res) {
  const { device_id, event_name, reason, stack_trace, operation_context, severity } = req.body;

  try {
    const logId = 'log_' + Date.now();
    await db.query(
      `INSERT INTO app_failure_logs 
      (log_id, device_id, event_name, reason, stack_trace, operation_context, severity) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [logId, device_id, event_name, reason, stack_trace, operation_context, severity || 'error']
    );

    res.status(201).json({
      success: true,
      message: 'Failure log recorded',
      data: { log_id: logId, created_at: new Date().toISOString() }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to record failure log: ' + err.message });
  }
}

// Save Individual Attendance Synchronization Log
async function saveAttendanceLog(req, res) {
  const { faceId, name, timestamp, latitude, longitude, method, imageBase64 } = req.body;

  try {
    let imagePath = null;
    if (imageBase64) {
      const buffer = Buffer.from(imageBase64, 'base64');
      const filename = `punch-${faceId || 'temp'}-${Date.now()}.jpg`;
      imagePath = path.join(IMAGE_DIR, filename);
      fs.writeFileSync(imagePath, buffer);
    }

    const [rows, result] = await db.query(
      `INSERT INTO attendance_logs (person_id, enroll_id, face_id, name, timestamp, latitude, longitude, method, image_path) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [faceId, faceId, faceId, name, timestamp || Date.now(), latitude, longitude, method || 'face', imagePath]
    );

    res.json({
      success: true,
      message: 'Attendance log recorded',
      data: { serverId: result.insertId ? result.insertId.toString() : '1' }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to record attendance log: ' + err.message });
  }
}

module.exports = {
  saveAppMetrics,
  saveAppFailureLog,
  saveAttendanceLog
};
