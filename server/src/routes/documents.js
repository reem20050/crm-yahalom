const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');
const googleService = require('../services/google');

const router = express.Router();
router.use(authenticateToken);

// Multer memory storage (max 10MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Upload a document
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { entity_type, entity_id } = req.body;
    if (!entity_type || !entity_id || !req.file) {
      return res.status(400).json({ message: 'נדרש קובץ, סוג ישות ומזהה ישות' });
    }

    // Get Google tokens
    const settings = query(`SELECT google_tokens FROM integration_settings WHERE id = 'main'`);
    if (!settings.rows.length || !settings.rows[0].google_tokens) {
      return res.status(400).json({ message: 'Google Drive לא מחובר. חבר את Google בהגדרות.' });
    }

    const tokens = JSON.parse(settings.rows[0].google_tokens);
    googleService.setCredentials(tokens);

    // Upload to Google Drive
    const driveResult = await googleService.uploadFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    // Save to DB
    const id = crypto.randomUUID();
    query(`
      INSERT INTO documents (id, entity_type, entity_id, file_name, file_type, file_size, google_drive_id, google_drive_url, uploaded_by, uploaded_by_name)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [id, entity_type, entity_id, req.file.originalname, req.file.mimetype, req.file.size,
        driveResult.id, driveResult.url, req.user?.id || null, req.user?.name || 'מערכת']);

    res.json({
      document: {
        id,
        file_name: req.file.originalname,
        file_type: req.file.mimetype,
        file_size: req.file.size,
        google_drive_url: driveResult.url,
        created_at: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({ message: 'שגיאה בהעלאת מסמך: ' + (error.message || '') });
  }
});

// Get documents by entity
router.get('/', (req, res) => {
  try {
    const { entity_type, entity_id } = req.query;
    if (!entity_type || !entity_id) {
      return res.status(400).json({ message: 'נדרש סוג ישות ומזהה ישות' });
    }

    const result = query(
      'SELECT * FROM documents WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC',
      [entity_type, entity_id]
    );

    res.json({ documents: result.rows });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ message: 'שגיאה בטעינת מסמכים' });
  }
});

// Delete a document
router.delete('/:id', async (req, res) => {
  try {
    const doc = query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (!doc.rows.length) {
      return res.status(404).json({ message: 'מסמך לא נמצא' });
    }

    // Try to delete from Google Drive (non-blocking)
    if (doc.rows[0].google_drive_id) {
      try {
        const settings = query(`SELECT google_tokens FROM integration_settings WHERE id = 'main'`);
        if (settings.rows.length && settings.rows[0].google_tokens) {
          const tokens = JSON.parse(settings.rows[0].google_tokens);
          googleService.setCredentials(tokens);
          const { google } = require('googleapis');
          const drive = google.drive({ version: 'v3', auth: googleService.oauth2Client });
          await drive.files.delete({ fileId: doc.rows[0].google_drive_id });
        }
      } catch (driveErr) {
        console.error('Drive delete error (non-blocking):', driveErr.message);
      }
    }

    query('DELETE FROM documents WHERE id = $1', [req.params.id]);
    res.json({ message: 'מסמך נמחק' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ message: 'שגיאה במחיקת מסמך' });
  }
});

module.exports = router;
