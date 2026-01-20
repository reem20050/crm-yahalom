from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import models, schemas, crud
from database import SessionLocal, engine
from google.oauth2 import id_token
from google.auth.transport import requests
from jose import jwt
from datetime import datetime, timedelta
import os
import sqlite3

# Check if database exists and has correct schema
db_path = "./crm.db"
# #region agent log
import json
try:
    log_path = r'g:\My Drive\python\מערכת CRM צוות יהלום\.cursor\debug.log'
    os.makedirs(os.path.dirname(log_path), exist_ok=True)
    with open(log_path, 'a', encoding='utf-8') as f:
        f.write(json.dumps({"location":"main.py:14","message":"Checking database schema","data":{"db_path":os.path.abspath(db_path),"exists":os.path.exists(db_path)},"timestamp":int(__import__('time').time()*1000),"sessionId":"debug-session","runId":"run2","hypothesisId":"F"})+'\n')
except Exception as e:
    print(f"[debug] Failed to write log: {e}")
# #endregion
needs_recreate = False

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        # Check if users table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        table_exists = cursor.fetchone() is not None
        
        if table_exists:
            cursor.execute("PRAGMA table_info(users)")
            columns = [col[1] for col in cursor.fetchall()]
            print(f"[startup] Users table columns: {columns}")
            if 'email' not in columns:
                print("[startup] Old database schema detected (missing email column). Recreating database...")
                needs_recreate = True
        else:
            print("[startup] Users table does not exist. Will create new database...")
            needs_recreate = True
    except Exception as e:
        print(f"[startup] Error checking database schema: {e}. Recreating database...")
        needs_recreate = True
    finally:
        conn.close()
    
    if needs_recreate:
        try:
            os.remove(db_path)
            print("[startup] Old database removed. Creating new database...")
        except Exception as e:
            print(f"[startup] Error removing old database: {e}")
else:
    print("[startup] Database does not exist. Creating new database...")

# Create tables
models.Base.metadata.create_all(bind=engine)
print("[startup] Database tables created/verified.")
# #region agent log
try:
    log_path = r'g:\My Drive\python\מערכת CRM צוות יהלום\.cursor\debug.log'
    with open(log_path, 'a', encoding='utf-8') as f:
        f.write(json.dumps({"location":"main.py:60","message":"Database tables created","data":{"db_path":os.path.abspath(db_path),"exists_after":os.path.exists(db_path)},"timestamp":int(__import__('time').time()*1000),"sessionId":"debug-session","runId":"run2","hypothesisId":"F"})+'\n')
        if os.path.exists(db_path):
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            try:
                cursor.execute("PRAGMA table_info(users)")
                columns = [col[1] for col in cursor.fetchall()]
                f.write(json.dumps({"location":"main.py:65","message":"Database schema after creation","data":{"columns":columns,"has_email":'email' in columns},"timestamp":int(__import__('time').time()*1000),"sessionId":"debug-session","runId":"run2","hypothesisId":"F"})+'\n')
            except Exception as e:
                f.write(json.dumps({"location":"main.py:68","message":"Error checking schema after creation","data":{"error":str(e)},"timestamp":int(__import__('time').time()*1000),"sessionId":"debug-session","runId":"run2","hypothesisId":"F"})+'\n')
            finally:
                conn.close()
except Exception as e:
    print(f"[debug] Failed to write log: {e}")
# #endregion

app = FastAPI(title="Tzevet Yahalom CRM", version="0.1.0")

default_origins = ["http://localhost:5173", "http://localhost:3000"]
frontend_url_env = os.getenv("FRONTEND_URL", "").strip()
extra_origins = [origin.strip() for origin in frontend_url_env.split(",") if origin.strip()]
allowed_origins = list(dict.fromkeys(default_origins + extra_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Google Auth Configuration ---
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "YOUR_GOOGLE_CLIENT_ID")
SECRET_KEY = os.getenv("SECRET_KEY", "YOUR_SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 1 day
security = HTTPBearer()

print(f"[startup] GOOGLE_CLIENT_ID set: {GOOGLE_CLIENT_ID not in ['', 'YOUR_GOOGLE_CLIENT_ID']}")
print(f"[startup] SECRET_KEY set: {SECRET_KEY not in ['', 'YOUR_SECRET_KEY']}")

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Invalid token payload")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = crud.get_user_by_email(db, email=email)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def require_admin(user: models.User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

@app.get("/")
def read_root():
    return {"message": "Welcome to Tzevet Yahalom CRM API"}

@app.post("/auth/google", response_model=schemas.Token)
def google_login(login_data: schemas.GoogleLogin, db: Session = Depends(get_db)):
    # #region agent log
    import json
    with open(r'g:\My Drive\python\מערכת CRM צוות יהלום\.cursor\debug.log', 'a', encoding='utf-8') as f:
        f.write(json.dumps({"location":"main.py:75","message":"google_login called","data":{"token_len":len(login_data.token) if login_data.token else 0,"client_id_value":GOOGLE_CLIENT_ID[:20]+"..." if len(GOOGLE_CLIENT_ID) > 20 else GOOGLE_CLIENT_ID,"client_id_set":GOOGLE_CLIENT_ID not in ['', 'YOUR_GOOGLE_CLIENT_ID']},"timestamp":int(__import__('time').time()*1000),"sessionId":"debug-session","runId":"run1","hypothesisId":"B,C"})+'\n')
    # #endregion
    try:
        print(f"[auth/google] request received; token_len={len(login_data.token)}; client_id_set={GOOGLE_CLIENT_ID not in ['', 'YOUR_GOOGLE_CLIENT_ID']}")
        if GOOGLE_CLIENT_ID == "YOUR_GOOGLE_CLIENT_ID":
            # #region agent log
            with open(r'g:\My Drive\python\מערכת CRM צוות יהלום\.cursor\debug.log', 'a', encoding='utf-8') as f:
                f.write(json.dumps({"location":"main.py:79","message":"GOOGLE_CLIENT_ID check failed","data":{"client_id_value":GOOGLE_CLIENT_ID},"timestamp":int(__import__('time').time()*1000),"sessionId":"debug-session","runId":"run1","hypothesisId":"C"})+'\n')
            # #endregion
            raise HTTPException(status_code=400, detail="GOOGLE_CLIENT_ID is not configured")

        # #region agent log
        with open(r'g:\My Drive\python\מערכת CRM צוות יהלום\.cursor\debug.log', 'a', encoding='utf-8') as f:
            f.write(json.dumps({"location":"main.py:82","message":"Before verify_oauth2_token","data":{"client_id_length":len(GOOGLE_CLIENT_ID)},"timestamp":int(__import__('time').time()*1000),"sessionId":"debug-session","runId":"run1","hypothesisId":"D"})+'\n')
        # #endregion
        id_info = id_token.verify_oauth2_token(
            login_data.token, requests.Request(), GOOGLE_CLIENT_ID
        )
        # #region agent log
        with open(r'g:\My Drive\python\מערכת CRM צוות יהלום\.cursor\debug.log', 'a', encoding='utf-8') as f:
            f.write(json.dumps({"location":"main.py:85","message":"verify_oauth2_token succeeded","data":{"has_email":'email' in id_info},"timestamp":int(__import__('time').time()*1000),"sessionId":"debug-session","runId":"run1","hypothesisId":"D"})+'\n')
        # #endregion

        email = id_info.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="Google token does not contain email")

        user = crud.get_user_by_email(db, email=email)
        if not user:
            first_user = crud.get_user_count(db) == 0
            role = "admin" if first_user else "user"
            user = crud.create_google_user(db, email=email, role=role)
        
        access_token = create_access_token(data={"sub": user.email, "role": user.role})
        return {"access_token": access_token, "token_type": "bearer"}

    except ValueError as e:
        # #region agent log
        with open(r'g:\My Drive\python\מערכת CRM צוות יהלום\.cursor\debug.log', 'a', encoding='utf-8') as f:
            f.write(json.dumps({"location":"main.py:100","message":"ValueError in verify_oauth2_token","data":{"error":str(e)},"timestamp":int(__import__('time').time()*1000),"sessionId":"debug-session","runId":"run1","hypothesisId":"D"})+'\n')
        # #endregion
        # Invalid token
        raise HTTPException(status_code=401, detail=f"Invalid Google Token: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        # #region agent log
        with open(r'g:\My Drive\python\מערכת CRM צוות יהלום\.cursor\debug.log', 'a', encoding='utf-8') as f:
            f.write(json.dumps({"location":"main.py:107","message":"Unexpected exception","data":{"error_type":type(e).__name__,"error":str(e)},"timestamp":int(__import__('time').time()*1000),"sessionId":"debug-session","runId":"run1","hypothesisId":"B,D"})+'\n')
        # #endregion
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/auth/me", response_model=schemas.UserOut)
def get_me(user: models.User = Depends(get_current_user)):
    return user

@app.get("/users", response_model=list[schemas.UserOut])
def list_users(db: Session = Depends(get_db), user: models.User = Depends(require_admin)):
    return crud.list_users(db)

@app.patch("/users/{user_id}/role", response_model=schemas.UserOut)
def update_user_role(user_id: int, role_update: schemas.UserRoleUpdate, db: Session = Depends(get_db), user: models.User = Depends(require_admin)):
    updated = crud.update_user_role(db, user_id=user_id, role=role_update.role)
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    return updated

# --- Employee Routes ---
@app.post("/employees/", response_model=schemas.Employee)
def create_employee(employee: schemas.EmployeeCreate, db: Session = Depends(get_db)):
    db_employee = crud.get_employees(db, limit=1) # Check effectively by ID if unique logic added
    # In real app check if ID exists
    return crud.create_employee(db=db, employee=employee)

@app.get("/employees/", response_model=list[schemas.Employee])
def read_employees(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    employees = crud.get_employees(db, skip=skip, limit=limit)
    return employees

# --- Client Routes ---
@app.post("/clients/", response_model=schemas.Client)
def create_client(client: schemas.ClientCreate, db: Session = Depends(get_db)):
    return crud.create_client(db=db, client=client)

@app.get("/clients/", response_model=list[schemas.Client])
def read_clients(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    clients = crud.get_clients(db, skip=skip, limit=limit)
    return clients

