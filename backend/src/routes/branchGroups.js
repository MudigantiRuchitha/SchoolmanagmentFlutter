const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

// GET /api/branch-groups
router.get('/', authMiddleware, async (req, res) => {
  try {
    const groups = await pool.query(
      'SELECT * FROM branch_groups WHERE org_id = $1 ORDER BY name',
      [req.admin.orgId]
    );
    // Get members for each group
    const result = await Promise.all(groups.rows.map(async (group) => {
      const members = await pool.query(
        `SELECT b.id, b.name, b.code FROM branch_group_members bgm
         JOIN branches b ON b.id = bgm.branch_id WHERE bgm.group_id = $1`,
        [group.id]
      );
      return { ...group, branches: members.rows };
    }));
    res.json({ success: true, groups: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/branch-groups
router.post('/', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, branchIds = [] } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Group name is required.' });

    await client.query('BEGIN');
    const groupResult = await client.query(
      'INSERT INTO branch_groups (org_id, name) VALUES ($1, $2) RETURNING *',
      [req.admin.orgId, name]
    );
    const group = groupResult.rows[0];

    for (const branchId of branchIds) {
      await client.query('INSERT INTO branch_group_members (group_id, branch_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [group.id, branchId]);
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, group });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  } finally {
    client.release();
  }
});

// PUT /api/branch-groups/:id
router.put('/:id', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, branchIds = [] } = req.body;
    await client.query('BEGIN');

    const result = await client.query(
      'UPDATE branch_groups SET name = COALESCE($1, name) WHERE id = $2 AND org_id = $3 RETURNING *',
      [name, req.params.id, req.admin.orgId]
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Group not found.' });
    }

    await client.query('DELETE FROM branch_group_members WHERE group_id = $1', [req.params.id]);
    for (const branchId of branchIds) {
      await client.query('INSERT INTO branch_group_members (group_id, branch_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.params.id, branchId]);
    }

    await client.query('COMMIT');
    res.json({ success: true, group: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: 'Server error.' });
  } finally {
    client.release();
  }
});

// DELETE /api/branch-groups/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM branch_groups WHERE id = $1 AND org_id = $2', [req.params.id, req.admin.orgId]);
    res.json({ success: true, message: 'Branch group deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
