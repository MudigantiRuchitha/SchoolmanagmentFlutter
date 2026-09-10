const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

// GET /api/notices
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { audience } = req.query;
    let query = `
      SELECT n.*, au.full_name as created_by_name
      FROM notices n LEFT JOIN admin_users au ON au.id = n.created_by
      WHERE n.org_id = $1 AND n.is_active = true`;
    const params = [req.admin.orgId];

    if (audience) { query += ' AND (n.audience = $2 OR n.audience = \'all\')'; params.push(audience); }
    query += ' ORDER BY n.created_at DESC';

    const result = await pool.query(query, params);
    res.json({ success: true, notices: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/notices
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, audience, content } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title is required.' });

    const result = await pool.query(
      'INSERT INTO notices (org_id, title, audience, content, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.admin.orgId, title, audience || 'all', content || null, req.admin.adminId]
    );
    res.status(201).json({ success: true, notice: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/notices/:id
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { title, audience, content, isActive } = req.body;
    const result = await pool.query(
      'UPDATE notices SET title = COALESCE($1, title), audience = COALESCE($2, audience), content = COALESCE($3, content), is_active = COALESCE($4, is_active) WHERE id = $5 AND org_id = $6 RETURNING *',
      [title, audience, content, isActive, req.params.id, req.admin.orgId]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Notice not found.' });
    res.json({ success: true, notice: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// DELETE /api/notices/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('UPDATE notices SET is_active = false WHERE id = $1 AND org_id = $2', [req.params.id, req.admin.orgId]);
    res.json({ success: true, message: 'Notice removed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
