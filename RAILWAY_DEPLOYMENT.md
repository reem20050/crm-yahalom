# פריסה ל-Railway - הוראות מפורטות

## למה Railway?
- **חינמי:** $5 חינמי כל חודש
- **קל:** פריסה אוטומטית מ-GitHub
- **יציב:** לא נרדם, רץ תמיד
- **HTTPS:** אוטומטי
- **דומיין:** דומיין חינמי (railway.app)

---

## שלב 1: הכנת הפרויקט

### 1.1 יצירת GitHub Repository
```bash
cd C:\crm-yahalom
git init
git add .
git commit -m "Initial commit"
# העלה ל-GitHub (צור repository חדש ב-GitHub)
```

### 1.2 יצירת קבצי הגדרה

#### `backend/railway.json` (אם צריך)
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "uvicorn main:app --host 0.0.0.0 --port $PORT"
  }
}
```

#### `backend/Procfile` (אלטרנטיבה)
```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

#### `backend/runtime.txt` (אם צריך Python ספציפי)
```
python-3.14
```

---

## שלב 2: פריסת Backend

### 2.1 יצירת פרויקט ב-Railway
1. לך ל: https://railway.app/
2. התחבר עם GitHub
3. לחץ "New Project"
4. בחר "Deploy from GitHub repo"
5. בחר את ה-repository שלך
6. בחר את התיקייה `backend`

### 2.2 הגדרת משתני סביבה
ב-Railway Dashboard:
1. לחץ על השרת
2. לך ל-"Variables"
3. הוסף:
   - `GOOGLE_CLIENT_ID` = `833831270176-1c2ahvh32fbffuqkf5gp3ns1pieoe7lk.apps.googleusercontent.com`
   - `SECRET_KEY` = `some_random_secret` (או מפתח חזק יותר)
   - `PORT` = `8000` (Railway יקבע אוטומטית)

### 2.3 הגדרת Database
1. ב-Railway Dashboard, לחץ "New" > "Database" > "PostgreSQL" (או SQLite)
2. Railway יצור database אוטומטית
3. הוסף משתנה סביבה: `DATABASE_URL` (Railway יקבע אוטומטית)

### 2.4 עדכון `database.py` (אם צריך)
```python
import os
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./crm.db")
```

---

## שלב 3: פריסת Frontend

### 3.1 יצירת פרויקט נוסף ב-Railway
1. ב-Railway Dashboard, לחץ "New Project"
2. בחר "Deploy from GitHub repo"
3. בחר את אותו repository
4. בחר את התיקייה `frontend`

### 3.2 עדכון `frontend/src/api.js`
```javascript
const api = axios.create({
  baseURL: process.env.VITE_API_URL || 'http://localhost:8000',
});
```

### 3.3 יצירת `frontend/.env.production`
```
VITE_API_URL=https://your-backend-url.railway.app
```

### 3.4 עדכון `vite.config.js` (אם צריך)
```javascript
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
  },
})
```

---

## שלב 4: עדכון Google OAuth

1. לך ל: https://console.cloud.google.com/
2. APIs & Services > Credentials
3. ערוך את ה-Client ID
4. הוסף ל-"Authorized JavaScript origins":
   - `https://your-frontend.railway.app`
   - `https://your-backend.railway.app`

---

## שלב 5: בדיקה

1. פתח את ה-URL של הפרונטאנד: `https://your-frontend.railway.app`
2. נסה להתחבר עם Google
3. בדוק שהכל עובד

---

## טיפים

- **Logs:** ב-Railway Dashboard, לך ל-"Deployments" > "View Logs"
- **Custom Domain:** ב-Railway, אפשר להוסיף דומיין מותאם אישית
- **Environment Variables:** כל שינוי ב-Variables דורש redeploy

---

## עלויות

- **Free Tier:** $5 חינמי כל חודש
- **Hobby Plan:** $5/חודש (אם צריך יותר)
- **Pro Plan:** $20/חודש (לשימוש מסחרי)
