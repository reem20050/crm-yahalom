# תיקון Railway - npm error

## הבעיה:
Railway מנסה להריץ npm במקום Python.

## הפתרון:

### 1. ב-Railway Dashboard:
**Settings > General:**
- **Root Directory** = `backend` (חובה!)

**Settings > Deploy:**
- **Start Command** = `uvicorn main:app --host 0.0.0.0 --port $PORT`

### 2. קבצים (כבר תוקנו):
- ✅ `railway.json` - עודכן
- ✅ `backend/Procfile` - תקין
- ✅ `backend/requirements.txt` - כולל fastapi ו-uvicorn

### 3. Start Command ל-Railway:
```
uvicorn main:app --host 0.0.0.0 --port $PORT
```

**זה הכל!**
