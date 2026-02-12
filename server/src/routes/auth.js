const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { OAuth2Client } = require('google-auth-library');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const router = express.Router();

// Login
router.post('/login', [
  body('email').isEmail().withMessage('אימייל לא תקין'),
  body('password').notEmpty().withMessage('נדרשת סיסמה')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const result = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'אימייל או סיסמה שגויים' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({ error: 'משתמש לא פעיל' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'אימייל או סיסמה שגויים' });
    }

    // Look up linked employee record
    let employeeId = null;
    try {
      const empResult = db.query('SELECT id FROM employees WHERE user_id = $1', [user.id]);
      if (empResult.rows.length > 0) employeeId = empResult.rows[0].id;
    } catch (e) { /* ignore */ }

    // Update last login
    await db.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Generate token
    const token = jwt.sign(
      { userId: user.id, role: user.role, employeeId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        employeeId
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'שגיאה בהתחברות' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  res.json({ user: req.user });
});

// Change password
router.post('/change-password', authenticateToken, [
  body('currentPassword').notEmpty().withMessage('נדרשת סיסמה נוכחית'),
  body('newPassword').isLength({ min: 6 }).withMessage('סיסמה חדשה חייבת להכיל לפחות 6 תווים')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const result = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'סיסמה נוכחית שגויה' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update password
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [passwordHash, req.user.id]
    );

    res.json({ message: 'סיסמה שונתה בהצלחה' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'שגיאה בשינוי סיסמה' });
  }
});

// Google OAuth login - only for existing users
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ error: 'חסר טוקן Google' });
    }

    // Verify the Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const email = payload.email?.toLowerCase();

    if (!email) {
      return res.status(400).json({ error: 'לא ניתן לקבל אימייל מ-Google' });
    }

    // Check if user exists in our database
    const result = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'משתמש לא מורשה',
        message: 'המשתמש עם האימייל הזה לא קיים במערכת. פנה למנהל המערכת לקבלת גישה.'
      });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({ error: 'משתמש לא פעיל' });
    }

    // Look up linked employee record
    let employeeId = null;
    try {
      const empResult = db.query('SELECT id FROM employees WHERE user_id = $1', [user.id]);
      if (empResult.rows.length > 0) employeeId = empResult.rows[0].id;
    } catch (e) { /* ignore */ }

    // Update last login
    await db.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, role: user.role, employeeId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        employeeId
      }
    });
  } catch (error) {
    console.error('Google login error:', error);

    if (error.message?.includes('Token used too late') || error.message?.includes('Invalid token')) {
      return res.status(401).json({ error: 'טוקן Google לא תקין או פג תוקף' });
    }

    res.status(500).json({ error: 'שגיאה בהתחברות עם Google' });
  }
});

// Get Google Client ID (public endpoint for frontend)
router.get('/google/client-id', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return res.status(404).json({ error: 'Google Login לא מוגדר' });
  }
  res.json({ clientId });
});

module.exports = router;
