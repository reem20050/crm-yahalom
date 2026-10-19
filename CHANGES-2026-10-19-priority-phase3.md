# שלב 3: חיבור ה-CRM למסמכי Priority (19/10/2026)

המפרט: `C:\הכנת CLI לPRIORITY\RESEARCH-2026-10-19-CRM-PRIORITY.md`, סעיפים 4, 5ב, 5ד ו-7.
נבנה ונבדק מקומית בלבד. **לא נפרס, ולא בקומיט.**

## מה השתנה

**קישור לקוח ↔ Priority (ה-CRM הוא הבעלים)**
- `server/src/config/database.js`:
  - עמודות חדשות ב-`customers`: `priority_customer_no`, `priority_matched_by` (vat|name|manual), `priority_confirmed_by` (מזהה משתמש), `priority_confirmed_at`.
  - אינדקס ייחודי חלקי על `priority_customer_no` (רק כשהערך לא NULL).
- `server/src/services/priorityLink.js` (חדש): פונקציות טהורות להתאמה ולסיכומי מסמכים.
  - **ההתאמה:** קודם ח.פ. (ספרות בלבד, בלי אפסים מובילים). אם אין, שם מנורמל זהה (בלי בע"מ, ע"ר, Ltd ופיסוק).
  - **שם לא נבדק** כששני הצדדים מחזיקים ח.פ. תקין ושונה.
  - **דו-משמעי, לא הצעה:** חשבון שתואם כמה לקוחות, או כמה חשבונות שתואמים לקוח אחד (כפילות ב-Priority).
  - אין יצירה ואין מיזוג אוטומטיים.
- `server/test/priorityLink.test.js` (חדש): 26 בדיקות. הרצה מתוך `server/`: `node --test "test/**/*.test.js"`.

**`server/src/routes/priority.js`** (הכל ממשיך להיות `requireManager`, ושומרי ההזרקה נשמרו)
- `GET /documents?party_key=200xxx`: מסנן לפי לקוח, ספרות בלבד (אחרת 400).
- `GET /customer/:customerId`: מחזיר את הקישור, את חשבון ה-Priority (יתרה בכרטסת) ואת כל המסמכים, כולל מבוטלים.
  - הסיכומים לפי סוג מסמך, בלי מבוטלים, וזיכוי (330) בשלילה.
  - אין סכום כולל אחד: קבלה משלמת חשבונית, ו-PI הוא לא חוב.
- `GET /link-proposals`: תור הבדיקה. מחזיר הצעות, דו-משמעיים, לא-מותאמים, מקושרים וקישורים יתומים.
  - `summary.accounts_read = 0` פירושו שה-RLS החזיר מערך ריק, ולא ש"אין התאמות".
- `POST /links`: אישור או קביעה של קישור.
  - המספר נבדק מול `p_accounts` (422 אם לא נמצא), ו-409 אם הוא כבר מקושר ללקוח אחר.
  - כל אישור נרשם ב-activity_log.
- `DELETE /links/:customerId`: ניתוק. עובד גם על לקוח שנמחק, כדי שהמספר שלו לא יינעל.

**ממשק (client)**
- `CustomerDetails.tsx`:
  - כרטיס "מסמכי Priority" (`components/PriorityCustomerDocs.tsx`): תווית לכל סוג מסמך, מבוטל מוצג מחוק, זיכוי בשלילה, שורת סיכומים ויתרה בכרטסת.
  - כרטיס "קישור ל-Priority" (`components/PriorityLinkControl.tsx`): הצעה עם כפתור "אשר", חיפוש ידני, וניתוק.
  - כשהלקוח מקושר, רשימת "חשבוניות אחרונות" של חשבונית ירוקה מוסתרת.

**חשבונית ירוקה ומע"מ**
- `services/scheduler.js`: המשימות `overdue-invoice-check` ו-`customer-invoice-reminders` כבויות בקוד, כברירת מחדל.
  - הכיבוי חל על cron, השלמת ריצות שהוחמצו, ניסיונות חוזרים והפעלה ידנית.
  - במסך האוטומציה הן מוצגות כבויות (`disabled_reason: green_invoice_data`).
  - מדליקים אותן רק עם `GREEN_INVOICE_JOBS_ENABLED=true`.
- `POST /integrations/green-invoice/sync` מחזיר 410, וכפתור "סנכרן" הוסר ממסך החשבוניות. הסנכרון הזה גם הכפיל רשומות.
- מע"מ 17% → 18%: `invoices.js` (POST) ו-`autoInvoiceGenerator.js` (ברירת המחדל האחרונה בשרשרת).

**תיקוני סכמה**
- **הוספת פעילות** ללקוח וליד: נוספו העמודות `activity_log.description` ו-`user_name`, ו-`user_id` ריק נשמר כ-NULL ולא כ-''.
- **העלאת מסמך** (`documents.js`): כותב לעמודות האמיתיות (name/type/size/file_url), ו-GET מחזיר את השמות שהממשק מצפה להם.
- **`/invoices/calculate`**: `events.actual_cost` → `price`, והוסרה `contracts.service_type`, עמודה שלא קיימת.

**אבטחה**
- הגדרות האינטגרציה, החיבור והניתוק של Google, WhatsApp וחשבונית ירוקה: admin בלבד (`requireAdmin`).
  - נשארו פתוחים למנהלים: `google-maps-key`, `whatsapp/send` ו-`scheduler/status`.
- MCP: הטוקן מתקבל רק בכותרת `Authorization: Bearer`, ו-`?api_key=` נדחה (401).

## מה צריך בפריסה ב-Render
1. **4 משתני סביבה:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `PRIORITY_MIRROR_EMAIL`, `PRIORITY_MIRROR_PASSWORD`. אחריהם Manual Deploy.
2. **HERMES וכל לקוח MCP אחר** חייבים לשלוח `Authorization: Bearer <MCP_API_TOKEN>`. קישור עם `?api_key=` יפסיק לעבוד.
3. **בדיקה אחרי הפריסה:**
   - `/api/priority/summary` מחזיר 200.
   - ב-`/api/priority/link-proposals` צריך `summary.accounts_read > 0`. אם יוצא 0, זה RLS על `p_accounts`.
4. **מע"מ:** אם ב-Neon יש `system_config.default_vat_rate = 17`, הערך הזה גובר על ברירת המחדל החדשה. צריך לבדוק ולעדכן.
5. **סכמה ישנה:** `database/migrations/001_initial_schema.sql` מגדיר `activity_log.changes` כ-JSONB ו-`entity_id` כ-UUID. אם Neon נבנה ממנו, רישום הקישור עדיין תקין, כי `changes` הוא JSON תקין. בקובץ הזה אין טבלת `documents`, כך שאין התנגשות עם תיקון ההעלאה.
6. העמודות והאינדקס נוצרים בעלייה (safeMigrate). אם יש כפילות של מספר Priority, תופיע רק אזהרה בלוג. היום אין נתונים כאלה.

## מה לא נעשה (החלטות של רעם / המשך)
- **ה-CRM עדיין יכול להפיק מסמכים בחשבונית ירוקה:** `POST /invoices` דוחף לחשבונית ירוקה כשהיא מחוברת, ויש גם `/green-invoice/create-invoice`. המשימה `auto-generate-invoices` עדיין פעילה.
  - המפרט (5ב 8) אומר שה-CRM מפסיק להפיק. זה תלוי בתאריך החיתוך בין חשבונית ירוקה ל-Priority (סעיף 8.3), ולכן לא שיניתי.
- **הרשאות שנשארו פתוחות:** `POST /integrations/green-invoice/create-invoice` (מפיק מסמך מס אמיתי) ו-`/whatsapp/send` פתוחים לכל משתמש מחובר, כולל `employee`. זה מחוץ לסעיף "הגדרות רק ל-admin", ולכן לא שיניתי. מומלץ להגביל ל-`requireManager`.
- לא טופלו:
  - אימות ה-webhook של WhatsApp;
  - בדיקת החוזים (`customer_contracts`);
  - ה-Dockerfile שבולע כשל בבנייה ומגיש bundle ישן.
- **עד ה-`--commit` של שלב 1** המראה מחזיקה בערך רק את יולי. עד אז לקוח מקושר יראה כרטיס Priority כמעט ריק, במקום רשימת חשבונית ירוקה.
- **ליטוש:**
  - ב-5xx מוצגים שני toast: ה-interceptor הכללי ב-`api.ts` וגם ההודעה הספציפית.
  - ב-`Priority.tsx` תוויות סוגי המסמכים שונות (אין 310, ו-"זיכוי" במקום "חשבונית זיכוי").
  - `npm test` של השרת שבור (`jest.config.js` חסר). זה היה שבור עוד לפני השינויים.
- **השלמת ריצות שהוחמצו בפועל לא רצה:** `addJob` דורס את `next_run_at` לפני הלולאה. לכן הלולאה לא מוצאת ריצה שהוחמצה. ממילא הכיבוי יושב ב-`executeJob`.

## נבדק / לא נבדק
- **נבדק מקומית (SQLite, בלי `DATABASE_URL`):**
  - השרת עולה גם על DB ריק וגם על ה-DB הקיים, והעמודות והאינדקס נוצרים.
  - בדיקת עשן ב-curl עברה בכל הנתיבים שלמעלה, כולל הרשאות manager/admin, MCP, ‏410, מע"מ 180/1180 ופעילות עם שם משתמש.
  - הכיבוי של משימות חשבונית ירוקה עובד, והדגל מדליק אותן מחדש.
  - הבדיקות של `priorityLink` עוברות (26/26).
  - `client`: ‏`npm run build` (tsc + vite) עובר.
  - הנתיבים מול מראה מדומה (קישור, 409, ‏422, כרטיס לקוח, ניתוק) נבדקו בסשן המשנה.
- **לא נבדק:**
  - ריצה על Postgres. ה-SQL החדש עובר את ההמרה בלי שינוי, אבל לא הורץ על PG.
  - מראה Supabase אמיתית: האם `p_accounts` מלאה, ו-RLS.
  - הממשק בדפדפן מול שרת חי.
- `server/data/crm.db` המקומי הוחזר למצבו המקורי אחרי הבדיקות.
