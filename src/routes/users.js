const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query } = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// All routes require authentication + admin role
router.use(authenticateToken);
router.use(requireAdmin);

// GET /api/users - List all users (with linked employee info)
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.role, u.is_active, u.last_login, u.created_at, u.updated_at,
              e.id as employee_id, e.first_name as employee_first_name, e.last_name as employee_last_name
       FROM users u
       LEFT JOIN employees e ON e.user_id = u.id
       ORDER BY u.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'שגיאה בטעינת משתמשים' });
  }
});

// GET /api/users/unlinked-employees - Employees without a user account
router.get('/unlinked-employees', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, first_name, last_name, phone, email
       FROM employees
       WHERE (user_id IS NULL OR user_id = '')
       AND status = 'active'
       ORDER BY first_name, last_name`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching unlinked employees:', error);
    res.status(500).json({ error: 'שגיאה בטעינת עובדים' });
  }
});

// GET /api/users/all-employees - All active employees (for linking dropdown)
router.get('/all-employees', async (req, res) => {
  try {
    const result = await query(
      `SELECT e.id, e.first_name, e.last_name, e.phone, e.email, e.user_id,
              u.first_name as linked_user_first_name, u.last_name as linked_user_last_name
       FROM employees e
       LEFT JOIN users u ON e.user_id = u.id
       WHERE e.status = 'active'
       ORDER BY e.first_name, e.last_name`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching all employees:', error);
    res.status(500).json({ error: 'שגיאה בטעינת עובדים' });
  }
});

// POST /api/users - Create new user
router.post('/', async (req, res) => {
  try {
    const { email, password, first_name, last_name, phone, role, employee_id } = req.body;

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

    // If linking to employee, verify employee exists and isn't already linked
    if (employee_id) {
      const emp = await query('SELECT id, user_id FROM employees WHERE id = $1', [employee_id]);
      if (emp.rows.length === 0) {
        return res.status(400).json({ error: 'עובד לא נמצא' });
      }
      if (emp.rows[0].user_id) {
        return res.status(400).json({ error: 'העובד כבר משויך למשתמש אחר' });
      }
    }

    const id = crypto.randomUUID();
    const password_hash = await bcrypt.hash(password, 10);

    await query(
      `INSERT INTO users (id, email, password_hash, first_name, last_name, phone, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, email.toLowerCase(), password_hash, first_name, last_name, phone || null, role || 'employee']
    );

    // Link employee to user
    if (employee_id) {
      await query('UPDATE employees SET user_id = $1 WHERE id = $2', [id, employee_id]);
    }

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

// PUT /api/users/:id/link-employee - Link or unlink employee to user
router.put('/:id/link-employee', async (req, res) => {
  try {
    const { id } = req.params;
    const { employee_id } = req.body; // null or '' to unlink, employee ID to link

    // Check user exists
    const userResult = await query('SELECT id, first_name, last_name FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'משתמש לא נמצא' });
    }

    // Find current linked employee (if any)
    const currentLink = await query('SELECT id FROM employees WHERE user_id = $1', [id]);

    if (!employee_id) {
      // UNLINK: remove user_id from currently linked employee
      if (currentLink.rows.length > 0) {
        await query('UPDATE employees SET user_id = NULL WHERE user_id = $1', [id]);
      }
      return res.json({ message: 'שיוך העובד הוסר בהצלחה', employee_id: null });
    }

    // LINK: verify new employee exists and isn't linked to someone else
    const empResult = await query('SELECT id, user_id, first_name, last_name FROM employees WHERE id = $1', [employee_id]);
    if (empResult.rows.length === 0) {
      return res.status(400).json({ error: 'עובד לא נמצא' });
    }
    if (empResult.rows[0].user_id && empResult.rows[0].user_id !== id) {
      return res.status(400).json({ error: 'העובד כבר משויך למשתמש אחר' });
    }

    // Remove old link if exists
    if (currentLink.rows.length > 0 && currentLink.rows[0].id !== employee_id) {
      await query('UPDATE employees SET user_id = NULL WHERE user_id = $1', [id]);
    }

    // Set new link
    await query('UPDATE employees SET user_id = $1 WHERE id = $2', [id, employee_id]);

    res.json({
      message: 'העובד שויך בהצלחה',
      employee_id: employee_id,
      employee_name: `${empResult.rows[0].first_name} ${empResult.rows[0].last_name}`
    });
  } catch (error) {
    console.error('Error linking employee:', error);
    res.status(500).json({ error: 'שגיאה בשיוך עובד' });
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
