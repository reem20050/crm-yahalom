# סטטוס פריסה - Railway

## ✅ שינויים שנעשו:

1. **פתרון קונפליקטי merge** - כל הקונפליקטים נפתרו
2. **Commit השינויים** - כל השינויים הוגשו
3. **Push ל-GitHub** - כל השינויים נדחפו ל-repository

**Commit אחרון:** `b7a9876 - Resolve merge conflicts and prepare for deployment`

## 🚀 עדכון Railway:

### אם Railway מחובר ל-GitHub (Auto-Deploy):
- Railway צריך להתחיל deployment אוטומטית תוך דקות ספורות
- בדוק את ה-Deployments ב-Railway Dashboard
- URL: https://railway.app/project/[PROJECT_ID]

### אם Railway לא מחובר או צריך Deployment ידני:

#### אפשרות 1: דרך Railway Dashboard (מומלץ)
1. לך ל: https://railway.app
2. בחר את הפרויקט: `crm-yahalom-production`
3. לחץ על ה-Backend service
4. לך ל: **Settings** > **Trigger Deploy** > **Deploy Latest**
5. חזור על התהליך גם ל-Frontend service (אם יש נפרד)

#### אפשרות 2: דרך Railway CLI
```bash
# התחברות ל-Railway
railway login

# חיבור לפרויקט
railway link

# פריסה ידנית
railway up
```

## 🔍 איך לבדוק שהפריסה הצליחה:

1. **בדוק את הלוגים ב-Railway:**
   - לך ל-Deployments ב-Dashboard
   - לחץ על ה-Deployment האחרון
   - בדוק את ה-Logs לבעיות

2. **בדוק את הדומיין:**
   - פתח: https://crm-yahalom-production.up.railway.app/
   - ודא שהאתר עובד

3. **אם יש שגיאות:**
   - בדוק את Environment Variables ב-Railway
   - ודא שה-`GOOGLE_CLIENT_ID` מוגדר
   - ודא שה-`FRONTEND_URL` מוגדר
   - ודא שה-`DATABASE_URL` מוגדר (אם משתמשים ב-Postgres)

## 📝 Environment Variables שצריכים להיות מוגדרים ב-Railway:

### Backend Service:
- `GOOGLE_CLIENT_ID` - מזהה Google OAuth
- `SECRET_KEY` - מפתח סודי ל-JWT
- `FRONTEND_URL` - URL של הפרונטאנד (למשל: `https://crm-yahalom-production.up.railway.app`)
- `DATABASE_URL` - (אופציונלי) אם משתמשים ב-Postgres
- `ENVIRONMENT` - `production` או `staging`

### Frontend Service (אם נפרד):
- `VITE_API_URL` - URL של ה-Backend (למשל: `https://backend-service.up.railway.app`)

## ⚠️ בעיות נפוצות:

1. **האתר לא מתעדכן:**
   - בדוק שהשינויים באמת נדחפו ל-GitHub
   - בדוק ש-Railway מחובר ל-GitHub repository
   - נסה להפעיל Deployment ידני

2. **שגיאות ב-Deployment:**
   - בדוק את ה-Logs ב-Railway
   - ודא שה-`requirements.txt` מעודכן
   - ודא שה-`Procfile` נכון

3. **Google Login לא עובד:**
   - ודא שה-URL של Railway נוסף ל-Google Cloud Console
   - ודא שה-`GOOGLE_CLIENT_ID` נכון ב-Railway

## 📞 תמיכה:

אם יש בעיות, בדוק את:
- Railway Dashboard: https://railway.app
- GitHub Repository: https://github.com/reem20050/crm-yahalom
- Railway Logs: בדוק את ה-Logs ב-Dashboard

---

**תאריך עדכון:** $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
