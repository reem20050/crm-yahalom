# 💎 מערכת CRM - צוות יהלום

מערכת ניהול לקוחות מקיפה לחברת האבטחה "צוות יהלום"

## 🚀 התקנה מהירה

### דרישות מקדימות
- Node.js 18+
- PostgreSQL 14+
- חשבון Google Cloud (לאינטגרציות)
- חשבון WhatsApp Business
- חשבון חשבונית ירוקה

### התקנה

1. **שכפול הפרויקט**
```bash
cd tzevet-yahalom-crm
```

2. **התקנת Backend**
```bash
cd server
npm install
cp .env.example .env
# ערוך את .env עם הפרטים שלך
```

3. **יצירת מסד נתונים**
```bash
# התחבר ל-PostgreSQL
psql -U postgres
CREATE DATABASE tzevet_yahalom_crm;
\q

# הרץ את ה-migrations
psql -U postgres -d tzevet_yahalom_crm -f database/migrations/001_initial_schema.sql
```

4. **התקנת Frontend**
```bash
cd ../client
npm install
```

5. **הרצת המערכת**
```bash
# בטרמינל ראשון - Backend
cd server
npm run dev

# בטרמינל שני - Frontend
cd client
npm run dev
```

6. **גישה למערכת**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api
- משתמש ברירת מחדל: admin@tzevetyahalom.co.il / Admin123!

## 📁 מבנה הפרויקט

```
tzevet-yahalom-crm/
├── client/                 # React Frontend
│   ├── src/
│   │   ├── components/     # רכיבים משותפים
│   │   ├── pages/          # דפי האפליקציה
│   │   ├── services/       # קריאות API
│   │   ├── stores/         # ניהול state (Zustand)
│   │   └── styles/         # CSS/Tailwind
│   └── package.json
│
├── server/                 # Node.js Backend
│   ├── src/
│   │   ├── routes/         # API endpoints
│   │   ├── middleware/     # Auth, logging
│   │   ├── services/       # אינטגרציות חיצוניות
│   │   └── config/         # הגדרות
│   └── package.json
│
├── database/
│   └── migrations/         # SQL schemas
│
└── docs/
    └── plans/              # תיעוד תכנון
```

## 🔧 מודולים

### דשבורד
- סיכום יומי של הפעילות
- לידים חדשים וממתינים
- משמרות ואירועים קרובים
- התראות על חשבוניות וחוזים

### ניהול לידים
- מעקב אחרי פניות חדשות
- משפך מכירות (Kanban)
- המרה אוטומטית ללקוח

### ניהול לקוחות
- פרופיל לקוח מלא
- אנשי קשר מרובים
- אתרים ונקודות שמירה
- חוזים וחידושים

### ניהול עובדים
- פרטי עובד ומסמכים
- רישיונות ותעודות
- זמינות לעבודה

### לוח משמרות
- תצוגה שבועית/חודשית
- שיבוץ חכם
- דיווח נוכחות מהשטח

### ניהול אירועים
- אירועים חד-פעמיים
- תכנון צוות ודרישות
- מעקב סטטוס

### חשבוניות
- סנכרון עם חשבונית ירוקה
- מעקב תשלומים
- התראות על איחורים

### דוחות
- דוח מכירות
- דוח לקוחות
- דוח שעות עובדים
- דוח כספי

## 🔗 אינטגרציות

### Google Workspace
- **Gmail**: שליחת הצעות מחיר וחשבוניות
- **Calendar**: סנכרון משמרות ואירועים
- **Drive**: אחסון מסמכים וחוזים

### WhatsApp Business
- תזכורות משמרת לעובדים
- אישורי הזמנה ללקוחות
- התראות והודעות אוטומטיות

### חשבונית ירוקה
- יצירת הצעות מחיר וחשבוניות
- סנכרון סטטוס תשלום
- דוחות הכנסות

## 🔐 אבטחה

- JWT Authentication
- Role-based access control
- HTTPS בפרודקשן
- הצפנת סיסמאות עם bcrypt

## 📱 תמיכה

המערכת מותאמת לשימוש מ:
- מחשב שולחני
- טאבלט
- טלפון נייד (Responsive)

---

פותח עבור צוות יהלום 💎
