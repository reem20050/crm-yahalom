const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query } = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// All routes require authentication + admin role
router.use(authenticateToken);
router.use(requireAdmin);

// GET /api/users - List all users
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, email, first_name, last_name, phone, role, is_active, last_login, created_at, updated_at
       FROM users ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'שגיאה בטעינת משתמשים' });
  }
});

// POST /api/users - Create new user
router.post('/', async (req, res) => {
  try {
    const { email, password, first_name, last_name, phone, role } = req.body;

    // Validation
    if (!email || !password || !first_name || !last_name) {
      return res.status(400).json({ error: 'נא למלא את כל השדות הנדרשים' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'הסיסמה חייבת להכיל לפחות 6 תווים' });
    }

    const validRoles = ['admin', 'manager', 'employee'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: 'תפקיד לא תקין' });
    }

    // Check if email already exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'כתובת האימייל כבר קיימת במערכת' });
    }

    const id = crypto.randomUUID();
    const password_hash = await bcrypt.hash(password, 10);

    await query(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, phone, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, email.toLowerCase(), password_hash, first_name, last_name, phone || null, role || 'employee']
    );

    const newUser = await query(
      `SELECT id, email, first_name, last_name, phone, role, is_active, created_at
       FROM users WHERE id = $1`,
      [id]
    );

    res.status(201).json(newUser.rows[0]);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'שגיאה ביצירת משתמש' });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, phone, role, is_active, email } = req.body;

    // Check user exists
    const existing = await query('SELECT id FROM users WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'משתמש לא נמצא' });
    }

    // Prevent admin from disabling themselves
    if (id === req.user.id && is_active === 0) {
      return res.status(400).json({ error: 'לא ניתן להשבית את המשתמש שלך' });
    }

    // Prevent admin from removing their own admin role
    if (id === req.user.id && role && role !== 'admin') {
      return res.status(400).json({ error: 'לא ניתן להסיר הרשאות מנהל מעצמך' });
    }

    const validRoles = ['admin', 'manager', 'employee'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: 'תפקיד לא תקין' });
    }

    // Check email uniqueness if changing email
    if (email) {
      const emailCheck = await query('SELECT id FROM users WHERE email = $1 AND id != $2', [email.toLowerCase(), id]);
      if (emailCheck.rows.length > 0) {
        return res.status(400).json({ error: 'כתובת האימייל כבר קיימת במערכת' });
      }
    }

    await query(
      `UPDATE users SET
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        phone = COALESCE($3, phone),
        role = COALESCE($4, role),
        is_active = COALESCE($5, is_active),
        email = COALESCE($6, email),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $7`,
      [first_name, last_name, phone, role, is_active, email ? email.toLowerCase() : null, id]
    );

    const updated = await query(
      `SELECT id, email, first_name, last_name, phone, role, is_active, last_login, created_at, updated_at
       FROM users WHERE id = $1`,
      [id]
    );

    res.json(updated.rows[0]);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'שגיאה בעדכון משתמש' });
  }
});

// DELETE /api/users/:id - Soft delete (deactivate) user
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({ error: 'לא ניתן למחוק את המשתמש שלך' });
    }

    const existing = await query('SELECT id FROM users WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'משתמש לא נמצא' });
    }

    await query('UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);

    res.json({ message: 'המשתמש הושבת בהצלחה' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'שגיאה במחיקת משתמש' });
  }
});

// POST /api/users/:id/reset-password - Reset user password (admin)
router.post('/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { new_password } = req.body;

    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ error: 'הסיסמה חייבת להכיל לפחות 6 תווים' });
    }

    const existing = await query('SELECT id FROM users WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'משתמש לא נמצא' });
    }

    const password_hash = await bcrypt.hash(new_password, 10);
    await query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [password_hash, id]
    );

    res.json({ message: 'הסיסמה אופסה בהצלחה' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ error: 'שגיאה באיפוס סיסמה' });
  }
});

module.exports = router;
