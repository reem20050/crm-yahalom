function validateEnv() {
  const required = ['JWT_SECRET'];
  const requiredInProd = ['DATABASE_URL'];
  // מראת Priority (src/routes/priority.js). ארבעתם נדרשים יחד — חסר אחד
  // ומסך Priority מחזיר 503 מפורש במקום להיכשל בשקט מול Supabase.
  const optional = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'WHATSAPP_TOKEN', 'GREEN_INVOICE_API_KEY',
    'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'PRIORITY_MIRROR_EMAIL', 'PRIORITY_MIRROR_PASSWORD'];

  const missing = [];
  for (const key of required) {
    if (!process.env[key]) missing.push(key);
  }
  if (process.env.NODE_ENV === 'production') {
    for (const key of requiredInProd) {
      if (!process.env[key]) missing.push(key);
    }
  }
  if (missing.length > 0) {
    console.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
  const missingOptional = optional.filter(key => !process.env[key]);
  if (missingOptional.length > 0) {
    console.warn(`WARNING: Missing optional env vars (some features disabled): ${missingOptional.join(', ')}`);
  }
}

module.exports = validateEnv;
