const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

// GET /api/holidays
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { year } = req.query;
    let query = 'SELECT * FROM holidays WHERE org_id = $1 AND (is_deleted IS NOT TRUE)';
    const params = [req.admin.orgId];

    if (year) {
      query += ' AND EXTRACT(YEAR FROM date) = $2';
      params.push(year);
    }
    query += ' ORDER BY date ASC';

    const result = await pool.query(query, params);
    res.json({ success: true, holidays: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/holidays
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, date, type, description } = req.body;
    if (!name || !date) return res.status(400).json({ success: false, message: 'Name and date are required.' });

    const result = await pool.query(
      'INSERT INTO holidays (org_id, name, date, type, description) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.admin.orgId, name, date, type || 'national', description || null]
    );
    res.status(201).json({ success: true, holiday: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/holidays/:id
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { name, date, type, description } = req.body;
    const result = await pool.query(
      'UPDATE holidays SET name = COALESCE($1, name), date = COALESCE($2, date), type = COALESCE($3, type), description = COALESCE($4, description) WHERE id = $5 AND org_id = $6 RETURNING *',
      [name, date, type, description, req.params.id, req.admin.orgId]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Holiday not found.' });
    res.json({ success: true, holiday: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// DELETE /api/holidays/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('UPDATE holidays SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND org_id = $2', [req.params.id, req.admin.orgId]);
    res.json({ success: true, message: 'Holiday deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
