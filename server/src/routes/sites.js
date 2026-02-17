const express = require('express');
const { query, generateUUID } = require('../config/database');
const { authenticateToken, requireManager } = require('../middleware/auth');
const { geocodeAddress } = require('../utils/geocoder');

const router = express.Router();
router.use(authenticateToken);

// Get all active sites with customer info
router.get('/', (req, res) => {
  try {
    const result = query(`
      SELECT s.*, c.company_name
      FROM sites s
      JOIN customers c ON s.customer_id = c.id
      WHERE s.is_active = 1 AND (c.deleted_at IS NULL OR c.deleted_at = '')
      ORDER BY c.company_name, s.name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Get sites error:', error);
    res.status(500).json({ message: 'שגיאה בטעינת אתרים' });
  }
});

// Get sites with coordinates (for map)
router.get('/with-coordinates', (req, res) => {
  try {
    const result = query(`
      SELECT s.*, c.company_name
      FROM sites s
      JOIN customers c ON s.customer_id = c.id
      WHERE s.is_active = 1 AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL
        AND (c.deleted_at IS NULL OR c.deleted_at = '')
      ORDER BY c.company_name, s.name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Get sites with coordinates error:', error);
    res.status(500).json({ message: 'שגיאה בטעינת אתרים' });
  }
});

// Batch geocode all sites without coordinates (admin only)
router.post('/geocode-all', requireManager, async (req, res) => {
  try {
    const result = query(`
      SELECT s.id, s.address, s.city FROM sites s
      WHERE s.is_active = 1 AND (s.latitude IS NULL OR s.longitude IS NULL)
    `);

    let success = 0;
    let failed = 0;

    for (const site of result.rows) {
      try {
        const geo = await geocodeAddress(site.address, site.city);
        if (geo) {
          query(`UPDATE sites SET latitude = $1, longitude = $2 WHERE id = $3`,
            [geo.latitude, geo.longitude, site.id]);
          success++;
        } else {
          failed++;
        }
        // Rate limit: 50ms between requests
        await new Promise(r => setTimeout(r, 50));
      } catch (e) {
        failed++;
      }
    }

    res.json({ message: `Geocoded ${success} sites, ${failed} failed`, success, failed });
  } catch (error) {
    console.error('Geocode all error:', error);
    res.status(500).json({ message: 'שגיאה ב-geocoding' });
  }
});

module.exports = router;
