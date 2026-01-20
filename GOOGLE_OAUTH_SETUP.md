# הגדרת Google OAuth - הוראות

## הבעיה
Google OAuth דורש הגדרת JavaScript origins ב-Google Cloud Console.

## פתרון - הגדרת Google Cloud Console

### שלב 1: כניסה ל-Google Cloud Console
1. פתח: https://console.cloud.google.com/
2. בחר את הפרויקט שלך (או צור חדש)

### שלב 2: הגדרת OAuth 2.0 Client ID
1. לך ל: **APIs & Services** > **Credentials**
2. מצא את ה-Client ID: `833831270176-1c2ahvh32fbffuqkf5gp3ns1pieoe7lk.apps.googleusercontent.com`
3. לחץ עליו לעריכה

### שלב 3: הוסף Authorized JavaScript origins
הוסף את ה-URLs הבאים:

```
http://localhost:5173
http://localhost:5174
http://localhost:3000
http://127.0.0.1:5173
http://127.0.0.1:5174
http://127.0.0.1:3000
```

**איך להוסיף:**
- לחץ על **+ ADD URI** תחת "Authorized JavaScript origins"
- הזן כל URL בנפרד
- לחץ **SAVE**

### שלב 4: בדיקה
1. הפעל את הפרונטאנד: `cd C:\crm-yahalom\frontend && npm run dev`
2. פתח בדפדפן: `http://localhost:5173`
3. נסה להתחבר עם Google

## הערות חשובות
- **לא צריך** להגדיר Authorized redirect URIs עבור Google Identity Services (GSI)
- ה-Client ID כבר מוגדר בקוד: `833831270176-1c2ahvh32fbffuqkf5gp3ns1pieoe7lk.apps.googleusercontent.com`
- אם הפרונטאנד רץ על פורט אחר, הוסף גם אותו

## אם עדיין לא עובד
1. בדוק שהפרונטאנד רץ (פתח `http://localhost:5173`)
2. בדוק שהשרת רץ (`http://localhost:8000`)
3. פתח את Console בדפדפן (F12) ובדוק אם יש שגיאות
4. ודא שה-Client ID ב-Google Cloud Console תואם לקוד
