# סיכום שינויים - תכונות חדשות במערכת CRM

## ✅ מה נוסף:

### Backend (FastAPI):
1. **מודלים חדשים** (`backend/models.py`):
   - `Shift` - משמרות (employee_id, client_id, start_time, end_time, status, notes)
   - `Task` - משימות (title, description, assigned_to, created_by, due_date, status, priority)
   - `Notification` - התראות (user_id, title, message, notif_type, is_read)

2. **Schemas חדשים** (`backend/schemas.py`):
   - ShiftBase, ShiftCreate, Shift
   - TaskBase, TaskCreate, Task
   - NotificationBase, NotificationCreate, Notification
   - ShiftReport, EmployeeReport

3. **CRUD Operations** (`backend/crud.py`):
   - Shift: create, get, get_by_employee, get_by_date_range, update, delete
   - Task: create, get, get_by_employee, update, delete
   - Notification: create, get, mark_read
   - Reports: generate_shift_report, generate_employee_report

4. **Routes חדשים** (`backend/main.py`):
   - `/shifts/` - GET, POST
   - `/shifts/{shift_id}` - GET, PUT, DELETE
   - `/shifts/by-employee/{employee_id}` - GET
   - `/shifts/by-date-range` - GET
   - `/tasks/` - GET, POST
   - `/tasks/{task_id}` - GET, PUT, DELETE
   - `/tasks/by-employee/{user_id}` - GET
   - `/notifications/` - GET, POST
   - `/notifications/{notification_id}/read` - PATCH
   - `/reports/shifts` - GET
   - `/reports/employees` - GET

### Frontend (React):
1. **דפים חדשים** (`frontend/src/pages/`):
   - `Shifts.jsx` - ניהול משמרות (טבלה, יצירה, עריכה, מחיקה)
   - `Tasks.jsx` - ניהול משימות (טבלה, יצירה, עריכה, סינון)
   - `Calendar.jsx` - לוח שנה (תצוגה חודשית/שבועית עם react-big-calendar)
   - `Reports.jsx` - דוחות (גרפים עם recharts)

2. **קומפוננטות חדשות** (`frontend/src/components/`):
   - `NotificationBell.jsx` - פעמון התראות עם מונה

3. **עדכונים**:
   - `Navbar.jsx` - הוספת קישורים חדשים + NotificationBell
   - `App.jsx` - הוספת routes חדשים
   - `Dashboard.jsx` - הוספת סטטיסטיקות חדשות (משמרות, משימות)

4. **Dependencies חדשות** (`frontend/package.json`):
   - `react-big-calendar` - ללוח שנה
   - `recharts` - לגרפים
   - `date-fns` - לעבודה עם תאריכים

## 📋 איך להשתמש:

### 1. התקנת Dependencies:
```bash
cd frontend
npm.cmd install
```

### 2. הפעלת השרתים:
- **Backend**: `cd backend` ואז `START_SERVER.bat`
- **Frontend**: `cd frontend` ואז `START_FRONTEND.bat`

### 3. גישה לתכונות:
- **משמרות**: לחץ על "משמרות" בנאבבר או גש ל-`/shifts`
- **משימות**: לחץ על "משימות" בנאבבר או גש ל-`/tasks`
- **לוח שנה**: לחץ על "לוח שנה" בנאבבר או גש ל-`/calendar`
- **דוחות**: לחץ על "דוחות" בנאבבר או גש ל-`/reports`
- **התראות**: פעמון התראות (🔔) מופיע בנאבבר

## 🔧 תכונות:

- **משמרות**: יצירה, עריכה, מחיקה, חיפוש לפי עובד או תאריך
- **משימות**: יצירה, הקצאה לעובדים, מעקב אחר סטטוס, עדיפות
- **לוח שנה**: תצוגה ויזואלית של משמרות ומשימות
- **דוחות**: סטטיסטיקות על משמרות ועובדים עם גרפים
- **התראות**: מערכת התראות אוטומטית (מתעדכן כל 30 שניות)

## 🌐 תמיכה בעברית:

כל התכונות תומכות בעברית מלאה עם RTL (Right-to-Left).

## ⚠️ הערות חשובות:

1. **הרשאות**: חלק מהתכונות דורשות הרשאות מסוימות (Admin, OperationsManager, וכו')
2. **Authentication**: כל התכונות דורשות התחברות (Google OAuth)
3. **Database**: המודלים החדשים יווצרו אוטומטית בעת הפעלת השרת
