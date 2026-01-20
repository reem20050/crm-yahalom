# פריסה ל-Railway (דומיין חינמי)

## דרישות מקדימות
- חשבון GitHub
- חשבון Railway
- Google Client ID פעיל

## שלב 1: העלאה ל-GitHub
```bat
cd /d C:\crm-yahalom
git init
git add .
git commit -m "Deploy prep"
git branch -M main
git remote add origin <GITHUB_REPO_URL>
git push -u origin main
```

## שלב 2: פריסת Backend ב-Railway
1. Railway > New Project > Deploy from GitHub.
2. בחר את הריפו שלך.
3. קבע Root Directory: `backend`.
4. ודא שה-Procfile קיים: `backend/Procfile`.
5. Variables (ב-Backend service):
   - `GOOGLE_CLIENT_ID` = המזהה שלך
   - `SECRET_KEY` = מפתח סודי
   - `FRONTEND_URL` = ה-URL של הפרונטאנד (יוגדר אחרי הפריסה שלו)
   - `DATABASE_URL` = אופציונלי (אם הוספת Postgres ב-Railway)

## שלב 3: פריסת Frontend ב-Railway
1. Railway > New Project > Deploy from GitHub.
2. בחר את אותו ריפו.
3. קבע Root Directory: `frontend`.
4. Variables (ב-Frontend service):
   - `VITE_API_URL` = ה-URL של ה-Backend (למשל `https://xxx.up.railway.app`)
5. Start Command מומלץ:
   ```
   npm run preview -- --host 0.0.0.0 --port $PORT
   ```

## שלב 4: חיבור דומיין
1. ב-Railway, עבור לשירות Frontend.
2. Settings > Domains > Add Domain.
3. Railway יציג רשומת CNAME.
4. עדכן את ה-DNS אצל ספק הדומיין שלך.

## שלב 5: עדכון Google OAuth
קרא את `UPDATE_GOOGLE_OAUTH.md` והוסף את הדומיין החדש ל-Google Cloud Console.

## הערות חשובות
- `frontend/src/api.js` כבר תומך ב-`VITE_API_URL`.
- `backend/main.py` משתמש ב-`FRONTEND_URL` לצורך CORS.
- אם משתמשים ב-Postgres ב-Railway, ודא שיש Driver תואם ב-`backend/requirements.txt`.