# מדריך התחברות למערכת CRM צוות יהלום

## איך להתחבר למערכת?

המערכת משתמשת באימות Google (Google OAuth) - כלומר אתה מתחבר עם חשבון Google שלך.

---

## שלב 1: הפעלת המערכת

### אופציה א' - הפעלה פשוטה (מומלץ)
1. פתח את תיקיית הפרויקט
2. לחץ פעמיים על `SIMPLE_RUN.bat`
3. המערכת תפתח 2 חלונות:
   - **Backend** (שרת אחורי) - רץ על `http://localhost:8000`
   - **Frontend** (ממשק משתמש) - רץ על `http://localhost:5173`

### אופציה ב' - הפעלה ידנית
1. **הפעלת Backend:**
   - לחץ פעמיים על `START_BACKEND.bat`
   - או פתח PowerShell והרץ:
     ```powershell
     cd backend
     python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
     ```

2. **הפעלת Frontend:**
   - לחץ פעמיים על `START_FRONTEND.bat`
   - או פתח PowerShell והרץ:
     ```powershell
     cd frontend
     dev.cmd
     ```
   - **חשוב:** השתמש ב-`dev.cmd` ולא ב-`npm run dev` ישירות!

---

## שלב 2: הגדרת Google OAuth

לפני שתוכל להתחבר, צריך להגדיר את Google Client ID.

### א. יצירת Google OAuth Client ID

1. היכנס ל-[Google Cloud Console](https://console.cloud.google.com/)
2. בחר או צור פרויקט
3. עבור ל-**APIs & Services** → **Credentials**
4. לחץ על **Create Credentials** → **OAuth client ID**
5. בחר **Web application**
6. הגדר:
   - **Name:** Diamond Team CRM (או שם אחר)
   - **Authorized JavaScript origins:**
     - `http://localhost:5173` (לפיתוח מקומי)
     - `https://your-domain.com` (לפרודקשן)
   - **Authorized redirect URIs:**
     - `http://localhost:5173` (לפיתוח מקומי)
     - `https://your-domain.com` (לפרודקשן)
7. לחץ **Create** והעתק את ה-**Client ID**

### ב. הגדרת משתני סביבה

#### Frontend (`.env` בתיקיית `frontend`):
צור קובץ `frontend/.env` עם התוכן:
```env
VITE_GOOGLE_CLIENT_ID=your-google-client-id-here
VITE_API_URL=http://localhost:8000
```

#### Backend (משתני סביבה):
הגדר את המשתנים הבאים:
- `GOOGLE_CLIENT_ID` - אותו Client ID מ-Google
- `SECRET_KEY` - מפתח סודי ל-JWT (כל מחרוזת אקראית)
- `OWNER_EMAIL` - האימייל של המנהל הראשי (אופציונלי)

**דוגמה להגדרה ב-Windows PowerShell:**
```powershell
$env:GOOGLE_CLIENT_ID="your-google-client-id"
$env:SECRET_KEY="your-secret-key-here"
$env:OWNER_EMAIL="admin@example.com"
```

**או צור קובץ `.env` בתיקיית `backend`** (אם המערכת תומכת בזה).

---

## שלב 3: התחברות למערכת

1. פתח דפדפן וגש ל: `http://localhost:5173`
2. אם אתה לא מחובר, תועבר אוטומטית לדף ההתחברות
3. לחץ על כפתור **"Sign in with Google"**
4. בחר את חשבון Google שלך
5. אם האימייל שלך מורשה, תועבר אוטומטית לדשבורד

---

## מי יכול להתחבר?

### א. משתמש ראשי (OWNER_EMAIL)
- אם הגדרת `OWNER_EMAIL` במשתני הסביבה של Backend
- האימייל הזה יכול להתחבר **תמיד** ויוצר אוטומטית משתמש Admin אם לא קיים

### ב. משתמשים שהוזמנו
- משתמשים שקיבלו הזמנה (invite) דרך המערכת
- ההזמנה קובעת את התפקיד (Role) שלהם

### ג. משתמשים ברשימת האישורים
- משתמשים שנוספו לרשימת האישורים (allowed emails)
- ניתן להוסיף דרך הסקריפט `backend/add_allowed_email.py`

**איך להוסיף משתמש לרשימת האישורים:**
```powershell
cd backend
python add_allowed_email.py user@example.com "תיאור המשתמש"
```

**דוגמה:**
```powershell
python add_allowed_email.py john@company.com "מנהל משמרות"
```

---

## פתרון בעיות

### "Google Client ID not configured"
- ודא שיצרת קובץ `frontend/.env` עם `VITE_GOOGLE_CLIENT_ID`
- ודא שהגדרת `GOOGLE_CLIENT_ID` ב-Backend
- **רענן את הדפדפן** לאחר שינוי קובץ `.env`

### "Authentication failed"
- ודא שה-Client ID זהה ב-Frontend ו-Backend
- ודא שה-URLs ב-Google Console תואמים (localhost:5173 לפיתוח)
- בדוק את הלוגים של Backend לחיפוש שגיאות

### "User not found" או "Not authorized"
- האימייל שלך לא ברשימת המשתמשים המורשים
- בקש מהמנהל להוסיף אותך או לשלוח הזמנה
- אם אתה המנהל הראשי, ודא שהגדרת `OWNER_EMAIL` נכון

### כפתור Google לא מופיע
- ודא שקובץ `index.html` טוען את Google Identity Services (כבר מוגדר)
- בדוק את קונסול הדפדפן (F12) לשגיאות JavaScript
- ודא ש-`VITE_GOOGLE_CLIENT_ID` מוגדר נכון

### Backend לא עובד
- ודא ש-Python מותקן
- ודא שהתקנת את התלויות: `pip install -r backend/requirements.txt`
- בדוק שהפורט 8000 פנוי

### Frontend לא עובד
- ודא ש-Node.js מותקן
- התקן תלויות: `npm install` בתיקיית `frontend`
- השתמש ב-`dev.cmd` ולא ב-`npm run dev` ישירות
- בדוק שהפורט 5173 פנוי

---

## קישורים שימושיים

- **Frontend (ממשק משתמש):** http://localhost:5173
- **Backend API:** http://localhost:8000
- **API Documentation:** http://localhost:8000/docs (Swagger UI)
- **Health Check:** http://localhost:8000/health

---

## הערות חשובות

1. **Cookies:** המערכת משתמשת ב-HttpOnly Cookies לאבטחה - לא צריך לשמור tokens ידנית
2. **CORS:** ב-development, Frontend ו-Backend צריכים לרוץ על הפורטים הנכונים
3. **Environment Variables:** שינויים ב-`.env` דורשים **הפעלה מחדש** של השרתים
4. **Google OAuth:** ודא שה-Client ID מוגדר נכון ב-Google Console עם ה-URLs הנכונים

---

## צור קשר

אם יש בעיות, בדוק:
1. את הלוגים של Backend (בחלון ה-terminal)
2. את קונסול הדפדפן (F12 → Console)
3. את Network tab בדפדפן (F12 → Network) לבדיקת בקשות
