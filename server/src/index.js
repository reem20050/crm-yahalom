const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Validate required environment variables
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required. Set it before starting the server.');
  process.exit(1);
}

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
const usersRoutes = require('./routes/users');
const incidentsRoutes = require('./routes/incidents');
const certificationsRoutes = require('./routes/certifications');
const weaponsRoutes = require('./routes/weapons');
const shiftTemplatesRoutes = require('./routes/shiftTemplates');
const patrolsRoutes = require('./routes/patrols');
const performanceRoutes = require('./routes/performance');
const equipmentRoutes = require('./routes/equipment');
const documentsRoutes = require('./routes/documents');
const sitesRoutes = require('./routes/sites');

// Import scheduler
const scheduler = require('./services/scheduler');

const app = express();

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com", "https://apis.google.com", "https://maps.googleapis.com", "https://maps.gstatic.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com", "https://fonts.googleapis.com", "https://maps.googleapis.com", "https://maps.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://accounts.google.com", "https://graph.facebook.com", "https://api.greeninvoice.co.il", "https://maps.googleapis.com", "https://maps.gstatic.com", "https://*.googleapis.com", "https://*.gstatic.com"],
      frameSrc: ["'self'", "https://accounts.google.com", "https://maps.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://maps.gstatic.com"],
      workerSrc: ["'self'", "blob:"],
    },
  },
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
}));
app.use(cors());
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Compression for production
try {
  const compression = require('compression');
  app.use(compression());
} catch (e) { /* compression not installed, skip */ }

// Rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'יותר מדי בקשות, נסה שוב מאוחר יותר' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 login attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'יותר מדי ניסיונות התחברות, נסה שוב מאוחר יותר' }
});

app.use('/api', globalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/google', authLimiter);

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
app.use('/api/users', usersRoutes);
app.use('/api/incidents', incidentsRoutes);
app.use('/api/certifications', certificationsRoutes);
app.use('/api/weapons', weaponsRoutes);
app.use('/api/shift-templates', shiftTemplatesRoutes);
app.use('/api/patrols', patrolsRoutes);
app.use('/api/sites', sitesRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/documents', documentsRoutes);

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

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../public')));

  // Handle SPA routing - send all non-API requests to index.html
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(__dirname, '../public/index.html'));
    } else {
      res.status(404).json({ error: 'נתיב לא נמצא' });
    }
  });
} else {
  // 404 handler for development
  app.use((req, res) => {
    res.status(404).json({ error: 'נתיב לא נמצא' });
  });
}

// Process-level error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Tzevet Yahalom CRM Backend Ready`);

  // Start scheduled tasks (cron jobs)
  scheduler.start();
});

module.exports = app;
