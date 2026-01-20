# התחלה מהירה - מערכת CRM

## הפעלה מקומית (30 שניות)

```bash
START_ALL.bat
```

זה הכל! שני השרתים יעלו אוטומטית:
- Backend: http://localhost:8000
- Frontend: http://localhost:5173

---

## הפעלה אוטומטית (בכל הפעלה של Windows)

```bash
SETUP_AUTO_START.bat
```

אחרי זה, המערכת תתחיל אוטומטית בכל פעם שתדליק את המחשב.

---

## דומיין חינמי (5 דקות)

### ngrok (הכי פשוט)
1. הורד: https://ngrok.com/download
2. הרשם: https://dashboard.ngrok.com/signup
3. הרץ: `ngrok config add-authtoken YOUR_TOKEN`
4. הרץ: `SETUP_NGROK.bat`

תקבל URL כמו: `https://xxxx-xx-xx-xx-xx.ngrok-free.app`

**חשוב:** עדכן את Google Cloud Console עם ה-URL החדש!

---

## העלאה ל-Cloud (15 דקות)

קרא את: `RAILWAY_DEPLOYMENT.md`

Railway נותן:
- ✅ דומיין חינמי
- ✅ HTTPS אוטומטי
- ✅ רץ תמיד (לא נרדם)
- ✅ $5 חינמי כל חודש

---

## פתרון בעיות

**השרת לא עולה?**
- הרץ `START_ALL.bat` מחדש

**Google Login לא עובד?**
- ודא שה-URL נוסף ל-Google Cloud Console
- ודא שה-URL מתחיל ב-`https://`

**צריך עזרה?**
- קרא: `README_DEPLOYMENT.md`
- קרא: `DEPLOYMENT_PLAN.md`
