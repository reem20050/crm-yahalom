const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const leadsRoutes = require('./routes/leads');
const customersRoutes = require('./routes/customers');
const employeesRoutes = require('./routes/employees');
const shiftsRoutes = require('./routes/shifts');
const eventsRoutes = require('./routes/events');
const invoicesRoutes = require('./routes/invoices');
const reportsRoutes = require('./routes/reports');
const dashboardRoutes = require('./routes/dashboard');
const integrationsRoutes = require('./routes/integrations');
const searchRoutes = require('./routes/search');

// Import scheduler
const scheduler = require('./services/scheduler');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/shifts', shiftsRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/integrations', integrationsRoutes);
app.use('/api/search', searchRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Tzevet Yahalom CRM Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'שגיאה בשרת',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Serve static files (frontend build)
const publicDir = path.join(__dirname, '../public');
const fs = require('fs');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));

  // Handle SPA routing - send all non-API requests to index.html
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(publicDir, 'index.html'));
    } else {
      res.status(404).json({ error: 'נתיב לא נמצא' });
    }
  });
} else {
  // 404 handler when no frontend build
  app.use((req, res) => {
    res.status(404).json({ error: 'נתיב לא נמצא' });
  });
}

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Tzevet Yahalom CRM Backend Ready`);

  // Start scheduled tasks (cron jobs)
  scheduler.start();
});

module.exports = app;
