# הוראות עדכון Railway - Quick Guide

## ✅ מה כבר נעשה:

1. ✅ Git repository נוצר
2. ✅ כל הקבצים ב-commit
3. ✅ GitHub CLI מותקן
4. ✅ Railway CLI מותקן

## 🚀 השלבים הבאים:

### אפשרות 1: דרך הסקריפטים (מומלץ)

**שלב 1: Login ל-GitHub**
```bash
QUICK_DEPLOY.bat
```
זה יפתח דפדפן - אשר את ה-login.

**שלב 2: אחרי ה-login**
```bash
AFTER_LOGIN_DEPLOY.bat
```
זה ייצור את ה-repository וידחוף את הקוד.

**שלב 3: חיבור Railway**
1. לך ל: https://railway.app
2. בחר את הפרויקט: `crm-yahalom-production`
3. לך ל: **Settings** → **Source**
4. לחץ: **"Connect GitHub Repo"**
5. בחר: `crm-yahalom`

Railway יתעדכן אוטומטית!

### אפשרות 2: עדכון ידני (מהיר)

אם אתה רוצה לעדכן מיד בלי GitHub:

1. לך ל: https://railway.app
2. בחר את הפרויקט: `crm-yahalom-production`
3. בחר את השירות (Backend)
4. לך ל: **Settings** → **Trigger Deploy** → **Deploy Latest**

## 📝 עדכונים עתידיים:

לאחר החיבור ל-GitHub, כל פעם שתרצה לעדכן:

```bash
git add .
git commit -m "תיאור השינויים"
git push
```

Railway יזהה את ה-push ויעדכן אוטומטית!

## 🔧 קבצים שנוצרו:

- `QUICK_DEPLOY.bat` - Login ל-GitHub ויצירת repository
- `AFTER_LOGIN_DEPLOY.bat` - דחיפת קוד אחרי login
- `COMPLETE_DEPLOY.bat` - סקריפט מלא אוטומטי
- `DEPLOY_INSTRUCTIONS.md` - הוראות מפורטות

## ⚠️ הערות:

- השינויים ב-`database.py` מאפשרים SQLite לפיתוח מקומי
- השינויים ב-`START_BACKEND.bat` כוללים `--reload` לפיתוח מקומי
- ב-Railway, השרת רץ עם `railway.json` שכבר מוגדר נכון
