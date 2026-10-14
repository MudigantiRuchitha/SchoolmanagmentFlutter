const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

// GET /api/academic-groups
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ag.*, 
        (SELECT COUNT(*) FROM classes WHERE academic_group_id = ag.id AND (is_deleted IS NOT TRUE)) as class_count
       FROM academic_groups ag WHERE ag.org_id = $1 AND (ag.is_deleted IS NOT TRUE) ORDER BY ag.name`,
      [req.admin.orgId]
    );
    res.json({ success: true, groups: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/academic-groups
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Group name is required.' });

    const result = await pool.query(
      'INSERT INTO academic_groups (org_id, name, description) VALUES ($1, $2, $3) RETURNING *',
      [req.admin.orgId, name, description || null]
    );
    res.status(201).json({ success: true, group: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// PUT /api/academic-groups/:id
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { name, description } = req.body;
    const result = await pool.query(
      'UPDATE academic_groups SET name = COALESCE($1, name), description = COALESCE($2, description) WHERE id = $3 AND org_id = $4 RETURNING *',
      [name, description, req.params.id, req.admin.orgId]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Group not found.' });
    res.json({ success: true, group: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// DELETE /api/academic-groups/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('UPDATE academic_groups SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND org_id = $2', [req.params.id, req.admin.orgId]);
    res.json({ success: true, message: 'Academic group deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
