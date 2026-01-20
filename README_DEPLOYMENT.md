# הוראות הפעלה - מערכת CRM צוות יהלום

## הפעלה מהירה (מקומי)

### אפשרות 1: הפעלה ידנית
```bash
START_ALL.bat
```
זה מפעיל את שני השרתים (backend + frontend) בחלונות נפרדים.

### אפשרות 2: הפעלה אוטומטית (בכל הפעלה של Windows)
```bash
SETUP_AUTO_START.bat
```
זה יוצר Windows Task שיפעיל את המערכת אוטומטית בכל הפעלה.

---

## הפעלה עם דומיין חינמי

### אפשרות 1: ngrok (מומלץ)
1. הורד והתקן ngrok: https://ngrok.com/download
2. הרשם ב: https://dashboard.ngrok.com/signup
3. קבל authtoken: https://dashboard.ngrok.com/get-started/your-authtoken
4. הרץ: `ngrok config add-authtoken YOUR_TOKEN`
5. הרץ: `SETUP_NGROK.bat`

**יתרונות:**
- יציב
- HTTPS אוטומטי
- דומיין קבוע בתשלום ($8/חודש)

### אפשרות 2: Cloudflare Tunnel (חינמי לחלוטין)
1. הורד cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
2. הרשם ב: https://dash.cloudflare.com/sign-up
3. הרץ: `cloudflared tunnel login`
4. הרץ: `SETUP_CLOUDFLARE_TUNNEL.bat`

**יתרונות:**
- חינמי לחלוטין
- יציב
- HTTPS אוטומטי

### אפשרות 3: localhost.run (הכי פשוט, אבל פחות יציב)
```bash
# Terminal 1: Backend
ssh -R 80:localhost:8000 serveo.net

# Terminal 2: Frontend  
ssh -R 80:localhost:5173 serveo.net
```

**יתרונות:**
- חינמי
- לא דורש התקנה
- פשוט

**חסרונות:**
- דורש SSH
- דומיין משתנה

---

## העלאה ל-Cloud (הכי יציב)

### Railway (מומלץ)
1. קרא את: `RAILWAY_DEPLOYMENT.md`
2. עקוב אחרי ההוראות שם

**יתרונות:**
- $5 חינמי כל חודש
- רץ תמיד (לא נרדם)
- HTTPS + דומיין אוטומטי
- קל להגדרה

---

## עדכון Google OAuth

**חשוב:** אחרי שתקבל דומיין ציבורי (מ-ngrok/Railway/וכו'), עדכן את Google Cloud Console:

1. לך ל: https://console.cloud.google.com/
2. APIs & Services > Credentials
3. לחץ על ה-Client ID שלך
4. תחת "Authorized JavaScript origins", הוסף:
   - `https://your-frontend-url.com`
   - `https://your-backend-url.com` (אם צריך)
5. לחץ SAVE

---

## פתרון בעיות

### השרת לא עולה
- בדוק שהפורטים 8000 ו-5173 פנויים
- הרץ `START_ALL.bat` מחדש

### Google Login לא עובד
- ודא שה-URL נוסף ל-Google Cloud Console
- ודא שה-URL מתחיל ב-`https://` (לא `http://`)

### Tunnel לא עובד
- בדוק שהשרתים רצים מקומית
- בדוק את הלוגים בחלון ה-tunnel

---

## קישורים שימושיים

- **ngrok:** https://ngrok.com/
- **Cloudflare Tunnel:** https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/
- **Railway:** https://railway.app/
- **Google Cloud Console:** https://console.cloud.google.com/
