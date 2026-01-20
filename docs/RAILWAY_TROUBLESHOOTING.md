# פתרון בעיות Railway - האתר לא עולה

## 🔧 תיקונים שבוצעו:

1. **תיקון railway.json** - הסרתי את `alembic upgrade head` שגרם לכשל ב-deployment
2. **עדכון runtime.txt** - שינוי מ-Python 3.14 (לא קיים) ל-Python 3.11

## ✅ מה צריך לבדוק ב-Railway:

### 1. Root Directory ב-Railway Service
- לך ל-Railway Dashboard > הפרויקט שלך > Backend Service
- לך ל-Settings > General
- ודא ש-**Root Directory** מוגדר ל: `backend`
- אם לא, שנה ל-`backend` ושמור

### 2. Environment Variables - חובה!
בדוק שכל המשתנים הבאים מוגדרים ב-Railway:

#### Backend Service Variables:
```
GOOGLE_CLIENT_ID=833831270176-1c2ahvh32fbffuqkf5gp3ns1pieoe7lk.apps.googleusercontent.com
SECRET_KEY=<some-random-secret-key>
FRONTEND_URL=https://crm-yahalom-production.up.railway.app
ENVIRONMENT=production
DATABASE_URL=<auto-provided-by-railway-if-postgres-added>
```

**⚠️ חשוב:**
- אם יש לך PostgreSQL service ב-Railway, ה-`DATABASE_URL` אמור להיקבע אוטומטית
- אם אין PostgreSQL, המערכת תשתמש ב-SQLite (אבל זה לא מומלץ ל-production)

### 3. Build & Deploy Settings
- ודא שה-Service מוגדר כ-Web Service (לא Background Service)
- ודא שה-Port מוגדר נכון (Railway משתמש ב-$PORT)

### 4. בדיקת Logs
1. לך ל-Railway Dashboard > הפרויקט > Backend Service
2. לחץ על ה-Tab "Deployments"
3. לחץ על ה-Deployment האחרון
4. בדוק את ה-Logs לבעיות:
   - שגיאות Python
   - בעיות database connection
   - בעיות import
   - בעיות environment variables

## 🐛 בעיות נפוצות ופתרונות:

### בעיה: "ModuleNotFoundError" או "Import Error"
**פתרון:**
- ודא ש-`requirements.txt` מעודכן עם כל ה-packages
- בדוק שהבנייה (build) הצליחה ב-Logs

### בעיה: "Database connection failed"
**פתרון:**
- אם משתמשים ב-PostgreSQL:
  1. לך ל-Railway Dashboard
  2. לחץ "New" > "Database" > "PostgreSQL"
  3. Railway יצור database ויגדיר `DATABASE_URL` אוטומטית
- אם משתמשים ב-SQLite:
  - זה אמור לעבוד, אבל בדוק שיש הרשאות כתיבה

### בעיה: "Port already in use" או "Can't bind to port"
**פתרון:**
- ודא שה-Procfile משתמש ב-`$PORT` (לא פורט קבוע)
- ודא שה-railway.json משתמש ב-`$PORT`

### בעיה: "502 Bad Gateway" או "Site can't be reached"
**פתרון:**
1. בדוק שה-Service רץ (Status = Running ב-Railway)
2. בדוק את ה-Logs לבעיות startup
3. נסה להפעיל Redeploy:
   - Settings > Trigger Deploy > Redeploy

### בעיה: "Application failed to start"
**פתרון:**
- בדוק את ה-Logs מההתחלה
- ודא שכל ה-Environment Variables מוגדרים
- בדוק שאין שגיאות syntax ב-main.py

## 📋 Checklist לפני Deployment:

- [ ] Root Directory מוגדר ל-`backend`
- [ ] כל ה-Environment Variables מוגדרים
- [ ] `requirements.txt` מעודכן
- [ ] `Procfile` קיים ותקין
- [ ] `railway.json` מתוקן (ללא alembic)
- [ ] Database מוגדר (PostgreSQL מומלץ)
- [ ] Service מוגדר כ-Web Service
- [ ] בנית מחדש את ה-Deployment לאחר התיקונים

## 🚀 שלבים לפריסה מחדש:

1. **Commit השינויים:**
   ```bash
   git add railway.json backend/runtime.txt
   git commit -m "Fix Railway deployment configuration"
   git push origin main
   ```

2. **Trigger Deploy ב-Railway:**
   - לך ל-Railway Dashboard
   - בחר את ה-Backend Service
   - לך ל-Settings > Trigger Deploy > Redeploy

3. **בדוק את ה-Logs:**
   - לחץ על ה-Deployment החדש
   - בדוק שהכל רץ בלי שגיאות

4. **בדוק את ה-URL:**
   - פתח: https://crm-yahalom-production.up.railway.app/
   - או את ה-URL ש-Railway נתן

## 📞 אם עדיין לא עובד:

1. **שתף את ה-Logs:**
   - העתק את כל ה-Logs מה-Deployment האחרון
   - חפש שגיאות באדום

2. **בדוק את Health Check:**
   - נסה לגשת ל: `https://crm-yahalom-production.up.railway.app/health`
   - זה אמור להחזיר JSON עם status

3. **בדוק את ה-API:**
   - נסה: `https://crm-yahalom-production.up.railway.app/`
   - זה אמור להחזיר: `{"message": "Welcome to Tzevet Yahalom CRM API"}`

---

**עדכון אחרון:** אחרי תיקון railway.json ו-runtime.txt
