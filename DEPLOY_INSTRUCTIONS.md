# הוראות עדכון Railway - Deploy Instructions

## הבעיה
השינויים בקוד לא מתעדכנים ב-Railway כי הקוד לא מחובר ל-Git repository.

## פתרון מהיר - דרך Railway Dashboard

1. היכנס ל-[Railway Dashboard](https://railway.app)
2. בחר את הפרויקט `crm-yahalom-production`
3. בחר את השירות (Backend)
4. לחץ על **"Settings"** → **"Trigger Deploy"** → **"Deploy Latest"**

## פתרון קבוע - חיבור ל-GitHub

### שלב 1: יצירת GitHub Repository

1. היכנס ל-[GitHub](https://github.com) ויצור repository חדש
2. העתק את ה-URL של ה-repository

### שלב 2: חיבור הקוד המקומי ל-GitHub

```bash
cd "g:\My Drive\python\מערכת CRM צוות יהלום"
git remote add origin <URL של ה-GitHub repository שלך>
git branch -M main
git push -u origin main
```

### שלב 3: חיבור Railway ל-GitHub

1. ב-Railway Dashboard → הפרויקט שלך
2. לחץ על **"Settings"** → **"Source"**
3. בחר **"Connect GitHub Repo"**
4. בחר את ה-repository שיצרת
5. Railway יתעדכן אוטומטית בכל push ל-GitHub

### שלב 4: עדכון עתידי

לאחר החיבור, כל פעם שתרצה לעדכן את Railway:

```bash
git add .
git commit -m "תיאור השינויים"
git push
```

Railway יזהה את ה-push ויעדכן אוטומטית!

## פתרון דרך Railway CLI

אם תרצה להשתמש ב-CLI:

1. פתח terminal חדש (לא דרך Cursor)
2. הרץ: `railway login`
3. אחרי ה-login, חזור לכאן והרץ:
   ```bash
   railway link
   railway up
   ```

## מה כבר נעשה

✅ Git repository נוצר
✅ כל הקבצים ב-commit
✅ .gitignore נוצר
✅ Railway CLI מותקן

## הערות חשובות

- השינויים ב-`database.py` מאפשרים SQLite לפיתוח מקומי
- השינויים ב-`START_BACKEND.bat` ו-`SIMPLE_RUN.bat` כוללים `--reload` לפיתוח מקומי
- ב-Railway, השרת רץ עם `railway.json` שכבר מוגדר נכון
