# Staging Environment Setup Guide

This guide explains how to set up a separate staging environment on Railway for testing before production deployment.

## Prerequisites

- Railway account
- Access to Google Cloud Console for OAuth configuration
- GitHub repository connected to Railway

## Step 1: Create Staging Service on Railway

1. Log in to [Railway](https://railway.app)
2. Create a new project or select existing project
3. Click "New Service" → "GitHub Repo" → Select your repository
4. Name the service: `crm-yahalom-staging`
5. Railway will auto-detect Python and attempt to deploy

## Step 2: Create PostgreSQL Database for Staging

1. In the Railway project, click "New" → "Database" → "Add PostgreSQL"
2. Name it: `crm-yahalom-staging-db`
3. Railway will provide a `DATABASE_URL` connection string
4. Copy this URL for Step 3

## Step 3: Configure Environment Variables

In Railway dashboard → Your staging service → Variables tab, add:

### Required Variables

```env
# Database
DATABASE_URL=postgresql://postgres:password@host:port/railway
# (Use the PostgreSQL URL from Step 2)

# Environment
ENVIRONMENT=staging

# Authentication
GOOGLE_CLIENT_ID=your-staging-google-client-id
SECRET_KEY=your-staging-secret-key-32-chars-minimum
OWNER_EMAIL=your-admin@email.com

# Frontend URL (for CORS)
FRONTEND_URL=https://crm-yahalom-staging-frontend.up.railway.app
# (or your staging frontend URL)

# Monitoring (optional but recommended)
SENTRY_DSN=your-sentry-dsn-for-staging
```

### Generating SECRET_KEY

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

**Important:** Use a different `SECRET_KEY` for staging than production!

## Step 4: Configure Google OAuth for Staging

You have two options:

### Option A: Same OAuth Client with Multiple Redirect URIs (Recommended)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to "APIs & Services" → "Credentials"
3. Select your existing OAuth 2.0 Client ID
4. Click "Edit"
5. Under "Authorized JavaScript origins", add:
   - `https://crm-yahalom-staging-frontend.up.railway.app`
6. Under "Authorized redirect URIs", add:
   - `https://crm-yahalom-staging-frontend.up.railway.app/auth/callback`
   - (Add any other staging redirect URIs you need)
7. Click "Save"

### Option B: Separate OAuth Client for Staging

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to "APIs & Services" → "Credentials"
3. Click "Create Credentials" → "OAuth client ID"
4. Application type: "Web application"
5. Name: "CRM Staging"
6. Add authorized JavaScript origins:
   - `https://crm-yahalom-staging-frontend.up.railway.app`
   - `http://localhost:5173` (for local testing)
7. Add authorized redirect URIs:
   - `https://crm-yahalom-staging-frontend.up.railway.app/auth/callback`
8. Click "Create"
9. Copy the Client ID
10. Use this Client ID in Railway `GOOGLE_CLIENT_ID` environment variable

## Step 5: Deploy Backend

Railway will auto-deploy on git push to your repository. To trigger manually:

1. Go to Railway dashboard → Staging service
2. Click "Settings" → "Trigger Deploy" → "Deploy Latest"

Or deploy via Railway CLI:
```bash
railway up --service crm-yahalom-staging
```

## Step 6: Set Up Frontend (Separate Service)

1. Create another Railway service for frontend: `crm-yahalom-staging-frontend`
2. Connect to same GitHub repo
3. Railway will detect Vite/React
4. Add environment variable:
   ```env
   VITE_API_URL=https://crm-yahalom-staging.up.railway.app
   ```
5. Update frontend build to use this API URL

## Step 7: Run Database Migrations

After first deployment, run migrations:

### Option A: Via Railway CLI
```bash
railway link --service crm-yahalom-staging
railway run alembic upgrade head
```

### Option B: Via Railway Dashboard
1. Go to service → "Deployments"
2. Click on latest deployment → "View Logs"
3. Migrations should run automatically if configured in startup script

### Option C: Manual Migration Script
Add to your deployment script or Railway start command:
```bash
alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port $PORT
```

## Step 8: Verify Staging Environment

1. **Health Check:**
   ```bash
   curl https://crm-yahalom-staging.up.railway.app/health
   ```
   Should return: `{"status": "healthy", "database": "connected"}`

2. **Test Login:**
   - Open staging frontend URL
   - Attempt Google login
   - Verify `OWNER_EMAIL` can login and create first admin

3. **Check Logs:**
   - Railway dashboard → Service → "Deployments" → "View Logs"
   - Verify no errors during startup

## Step 9: Seed Initial Data (Optional)

If needed, create initial data:

```bash
railway run python seed_data.py
```

Or via Railway dashboard → Service → "Connect" → Terminal

## Environment Differences

| Setting | Staging | Production |
|---------|---------|------------|
| Database | `crm-yahalom-staging-db` | `crm-yahalom-production-db` |
| URL | `crm-yahalom-staging.up.railway.app` | `crm-yahalom-production.up.railway.app` |
| SECRET_KEY | Different from production | Production key |
| ENVIRONMENT | `staging` | `production` |
| Sentry DSN | Staging project | Production project |
| Google OAuth | Same client (Option A) or separate (Option B) | Production client |

## Troubleshooting

### Database Connection Errors
- Verify `DATABASE_URL` is correct
- Check Railway PostgreSQL service is running
- Ensure database credentials are valid

### OAuth Login Fails
- Verify `GOOGLE_CLIENT_ID` matches the client with correct redirect URIs
- Check browser console for OAuth errors
- Verify frontend URL matches authorized origins in Google Console

### CORS Errors
- Verify `FRONTEND_URL` environment variable matches actual frontend URL
- Check backend logs for CORS errors
- Ensure `allow_credentials=True` in CORS middleware

### Migration Errors
- Check Alembic version in database: `railway run alembic current`
- Review migration files: `railway run alembic history`
- Rollback if needed: `railway run alembic downgrade -1`

## Best Practices

1. **Never use production credentials in staging**
2. **Test all migrations in staging before production**
3. **Use staging for all feature testing**
4. **Keep staging data separate from production**
5. **Regularly sync schema between staging and production (after migrations)**
6. **Monitor staging logs for errors**

## Next Steps

After staging is set up:
1. Test P0 changes in staging first
2. Verify all endpoints work correctly
3. Test authentication and authorization
4. Only deploy to production after staging tests pass

## Support

For issues:
- Check Railway logs
- Review backend application logs
- Verify environment variables are set correctly
- Test database connection separately
