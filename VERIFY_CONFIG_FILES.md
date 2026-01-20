# ✅ בדיקת קבצי Configuration

## קבצים שצריכים להיות קיימים:

### Railway Configuration:
- [x] `railway.json` - ✅ קיים
  ```json
  {
    "build": { "builder": "NIXPACKS" },
    "deploy": {
      "startCommand": "uvicorn main:app --host 0.0.0.0 --port $PORT"
    }
  }
  ```

### Backend Configuration:
- [x] `backend/Procfile` - ✅ קיים
  ```
  web: uvicorn main:app --host 0.0.0.0 --port $PORT
  ```

- [x] `backend/runtime.txt` - ✅ קיים
  ```
  python-3.11
  ```

- [x] `backend/requirements.txt` - ✅ קיים
  - כולל את כל ה-packages הנדרשים

### Application Files:
- [x] `backend/main.py` - ✅ קיים
  - FastAPI application
  - Startup event handlers
  - Routes configured

- [x] `backend/database.py` - ✅ קיים
  - Database connection handling
  - Lazy initialization
  - Error handling

- [x] `backend/models.py` - ✅ קיים
  - Database models

---

## מה לבדוק ב-Railway Dashboard:

### 1. Root Directory:
- **צריך להיות:** `backend`
- **איפה לבדוק:** Settings > General > Root Directory

### 2. Start Command:
- **צריך להיות:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **איפה לבדוק:** Settings > Deploy > Start Command

### 3. Builder:
- **צריך להיות:** `NIXPACKS` (אוטומטי בדרך כלל)
- **איפה לבדוק:** Settings > Build

---

## Environment Variables שצריכים להיות:

| Variable | Value | Required |
|----------|-------|----------|
| `DATABASE_URL` | (Auto-set by PostgreSQL) | ✅ Yes |
| `ENVIRONMENT` | `production` | ✅ Yes |
| `SECRET_KEY` | (Random 32+ chars) | ✅ Yes |
| `GOOGLE_CLIENT_ID` | `833831270176-1c2ahvh32fbffuqkf5gp3ns1pieoe7lk.apps.googleusercontent.com` | ✅ Yes |
| `FRONTEND_URL` | `https://crm-yahalom-production.up.railway.app` | ✅ Yes |
| `SENTRY_DSN` | (Optional) | ❌ No |

---

## אם קבצים חסרים:

### אם `railway.json` חסר:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "uvicorn main:app --host 0.0.0.0 --port $PORT",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### אם `backend/Procfile` חסר:
```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

### אם `backend/runtime.txt` חסר:
```
python-3.11
```

---

**כל הקבצים קיימים ונבדקו!** ✅
