# הוראות להקמה מחדש - Clean Start

## מה כבר בוצע אוטומטית:

✅ ניקוי קבצי documentation מיותרים  
✅ הקבצים החשובים קיימים ונבדקו

---

## שלבים שצריך לבצע ידנית:

### שלב 1: מחיקת Railway Project

1. לך ל-Railway Dashboard: https://railway.app
2. פתח את הפרויקט "crm-yahalom" (או "pure-insight")
3. לך ל-Settings (התפריט בצד)
4. גלול למטה ל-"Danger Zone"
5. לחץ על "Delete Project"
6. הקלד את שם הפרויקט כדי לאשר
7. לחץ על "Delete Project" סופי

**⚠️ זה ימחק הכל:** Services, Databases, Deployments, Environment Variables

---

### שלב 2: מחיקת GitHub Repository

#### אפשרות A: למחוק לגמרי (מומלץ)

1. לך ל-GitHub: https://github.com/reem20050/crm-yahalom
2. לך ל-Settings (בתפריט העליון)
3. גלול למטה ל-"Danger Zone"
4. לחץ על "Delete this repository"
5. הקלד `reem20050/crm-yahalom` כדי לאשר
6. לחץ על "I understand the consequences, delete this repository"

#### אפשרות B: לנקות את ה-History (אם אתה רוצה לשמור את ה-repo)

אחרי שתסיים את המחיקות, תריץ את הפקודות הבאות:

```bash
cd "G:\My Drive\python\מערכת CRM צוות יהלום"
git checkout --orphan clean-main
git add .
git commit -m "Initial commit - clean start"
git branch -D main
git branch -M main
git push -f origin main
```

---

### שלב 3: יצירת Repository חדש ב-GitHub

1. לך ל-GitHub: https://github.com/new
2. Repository name: `crm-yahalom`
3. בחר Private או Public (לפי בחירתך)
4. **⚠️ אל תסמן** "Initialize with README"
5. לחץ על "Create repository"

---

### שלב 4: התחברות מחדש והעלאה ל-GitHub

אחרי שיצרת את ה-Repository החדש, תריץ את הפקודות הבאות:

```bash
cd "G:\My Drive\python\מערכת CRM צוות יהלום"
git remote remove origin
git remote add origin https://github.com/reem20050/crm-yahalom.git
git add .
git commit -m "Initial commit - clean start"
git branch -M main
git push -u origin main
```

---

### שלב 5: יצירת Railway Project חדש

1. לך ל-Railway Dashboard: https://railway.app
2. לחץ על "New Project"
3. בחר "Deploy from GitHub repo"
4. הרשא ל-Railway לגשת ל-GitHub (אם נדרש)
5. בחר את ה-repository `reem20050/crm-yahalom`
6. בחר branch: `main`
7. לחץ על "Deploy Now"

---

### שלב 6: הגדרת Railway Service

1. **Root Directory:**
   - פתח את ה-Backend service
   - לך ל-Settings > General
   - Root Directory: `backend`
   - שמור

2. **Start Command:**
   - לך ל-Settings > Deploy
   - Custom Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - שמור

---

### שלב 7: הוספת PostgreSQL

1. בפרויקט ב-Railway
2. לחץ על "+ New"
3. בחר "Database" > "Add PostgreSQL"
4. Railway ייצור PostgreSQL service אוטומטית
5. Railway יקבע אוטומטית את `DATABASE_URL` ב-Backend service

---

### שלב 8: הגדרת Environment Variables

ב-Backend Service > Settings > Variables, הוסף:

1. **ENVIRONMENT** = `production`

2. **SECRET_KEY** = (צור מחרוזת אקראית)
   - אפשר ליצור עם PowerShell:
   ```powershell
   -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
   ```
   - או פשוט השתמש ב-string אקראי ארוך (לפחות 32 תווים)

3. **GOOGLE_CLIENT_ID** = `833831270176-1c2ahvh32fbffuqkf5gp3ns1pieoe7lk.apps.googleusercontent.com`

4. **FRONTEND_URL** = `https://crm-yahalom-production.up.railway.app`
   - (אפשר לעדכן אחרי ש-Railway יוצר domain)

5. **DATABASE_URL** = (לא צריך להוסיף ידנית - נקבע אוטומטית על ידי PostgreSQL)

---

### שלב 9: בדיקת Deployment

1. לך ל-Deployments tab
2. פתח את ה-Deployment החדש
3. בדוק את ה-Logs - אמור לראות:
   - `[database] Database engine created successfully`
   - `[startup] Creating database tables...`
   - `[startup] Database tables created successfully`
   - `Application startup complete`

4. בדוק את ה-API:
   - פתח: `https://crm-yahalom-production.up.railway.app/`
   - צריך לראות: `{"message": "Welcome to Tzevet Yahalom CRM API"}`

---

## Checklist:

- [ ] מחקתי את הפרויקט ב-Railway
- [ ] מחקתי את ה-Repository ב-GitHub
- [ ] יצרתי Repository חדש ב-GitHub
- [ ] התחברתי מחדש והעליתי את הקוד ל-GitHub
- [ ] יצרתי Railway Project חדש
- [ ] הגדרתי Root Directory = `backend`
- [ ] הגדרתי Start Command = `uvicorn main:app --host 0.0.0.0 --port $PORT`
- [ ] הוספתי PostgreSQL Database
- [ ] הגדרתי Environment Variables
- [ ] בדקתי שה-Deployment עובד

---

**אחרי שתסיים את כל השלבים, האפליקציה אמורה לעבוד!** 🚀
