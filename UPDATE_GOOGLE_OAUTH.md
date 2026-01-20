# עדכון Google OAuth אחרי פריסה

## מתי צריך לעדכן?
אחרי שקיבלת URL ציבורי חדש (Railway/דומיין מותאם), חייבים להוסיף אותו ל-Google Cloud Console.

## שלבים
1. פתח: https://console.cloud.google.com/
2. APIs & Services > Credentials
3. לחץ על ה-Client ID שלך
4. תחת **Authorized JavaScript origins** הוסף:
   - `https://your-frontend-domain.com`
   - אם יש תת-דומיין נוסף לפרונטאנד, הוסף גם אותו
5. שמור (Save).

## הערות
- עבור Google Identity Services (GSI) מספיק להוסיף **Authorized JavaScript origins**.
- אם אתה משתמש בזרימת OAuth עם Redirect, הוסף גם **Authorized redirect URIs** בהתאם לנתיב שלך.