const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// Verify JWT token middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'גישה נדחתה - נדרשת התחברות' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const result = await query(
      'SELECT id, email, first_name, last_name, role, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'משתמש לא נמצא' });
    }

    if (!result.rows[0].is_active) {
      return res.status(401).json({ error: 'משתמש לא פעיל' });
    }

    req.user = result.rows[0];

    // Look up linked employee record for employee users
    try {
      const empResult = await query(
        'SELECT id FROM employees WHERE user_id = $1',
        [decoded.userId]
      );
      if (empResult.rows.length > 0) {
        req.user.employeeId = empResult.rows[0].id;
      } else {
        req.user.employeeId = null;
      }
    } catch (e) {
      req.user.employeeId = null;
    }

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'פג תוקף ההתחברות - נא להתחבר מחדש' });
    }
    return res.status(403).json({ error: 'טוקן לא תקין' });
  }
};

// Check role middleware
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'נדרשת התחברות' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'אין לך הרשאה לפעולה זו' });
    }

    next();
  };
};

// Admin only middleware
const requireAdmin = requireRole('admin');

// Manager or above middleware
const requireManager = requireRole('admin', 'manager');

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  requireManager
};
