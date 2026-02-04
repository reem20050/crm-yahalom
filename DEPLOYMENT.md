# הוראות העלאה לענן - מערכת CRM צוות יהלום

## אפשרות 1: Railway (מומלץ - הכי קל)

### שלבים:
1. היכנס ל-https://railway.app
2. הירשם/התחבר עם חשבון GitHub
3. לחץ על "New Project"
4. בחר "Deploy from GitHub repo"
5. בחר את הריפו של המערכת
6. Railway יזהה אוטומטית את ה-Dockerfile ויתחיל לבנות
7. הגדר משתני סביבה (Environment Variables):
   - `JWT_SECRET` - מפתח סודי להצפנת JWT
   - `NODE_ENV` - production
8. לאחר הבנייה, תקבל כתובת URL לגישה למערכת

### העלאה ראשונה מ-CLI:
```bash
# התקן Railway CLI
npm install -g @railway/cli

# התחבר
railway login

# צור פרויקט חדש
railway init

# העלה
railway up
```

---

## אפשרות 2: Render

### שלבים:
1. היכנס ל-https://render.com
2. הירשם/התחבר עם חשבון GitHub
3. לחץ על "New" -> "Web Service"
4. בחר את הריפו של המערכת
5. Render ישתמש בקובץ render.yaml שכבר קיים
6. לחץ על "Create Web Service"
7. המתן לסיום הבנייה

---

## אפשרות 3: Docker בשרת עצמי

### דרישות:
- שרת Linux עם Docker מותקן
- דומיין (אופציונלי)

### שלבים:
```bash
# העתק את הפרויקט לשרת
git clone <your-repo-url>
cd tzevet-yahalom-crm

# בנה והרץ עם Docker Compose
docker-compose up -d --build

# המערכת תהיה זמינה בפורט 5000
# http://your-server-ip:5000
```

### הגדרת Nginx כ-Reverse Proxy (אופציונלי):
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## אפשרות 4: Fly.io

### התקנה:
```bash
# התקן Fly CLI
# Windows:
iwr https://fly.io/install.ps1 -useb | iex

# התחבר
fly auth login

# צור אפליקציה
fly launch

# העלה
fly deploy
```

---

## משתני סביבה נדרשים

| משתנה | תיאור | ערך לדוגמה |
|--------|--------|------------|
| `NODE_ENV` | סביבת ריצה | `production` |
| `PORT` | פורט השרת | `5000` |
| `JWT_SECRET` | מפתח להצפנת JWT | `your-secret-key-here` |
| `JWT_EXPIRES_IN` | תוקף ה-JWT | `7d` |

## משתני אינטגרציות (אופציונלי)

| משתנה | תיאור |
|--------|--------|
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Secret |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp Business Phone ID |
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp Business Access Token |
| `GREEN_INVOICE_API_KEY` | Green Invoice API Key |
| `GREEN_INVOICE_API_SECRET` | Green Invoice API Secret |

---

## פרטי התחברות ברירת מחדל

- **אימייל:** admin@tzevetyahalom.co.il
- **סיסמה:** Admin123!

⚠️ **חשוב:** שנה את הסיסמה לאחר ההתחברות הראשונה!

---

## תמיכה

לשאלות או בעיות, פנה לתמיכה הטכנית.
