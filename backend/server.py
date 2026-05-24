from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import firebase_admin
from firebase_admin import credentials, firestore
import os
import logging
from pathlib import Path
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime, timedelta
import bcrypt
import jwt
import uuid
import requests
from apscheduler.schedulers.background import BackgroundScheduler

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import json

# Firebase / Firestore connection
firebase_creds_json = os.environ.get('FIREBASE_CREDENTIALS')
if firebase_creds_json:
    # Load directly from string environment variable (for Render/Vercel/Heroku)
    cred_dict = json.loads(firebase_creds_json)
    cred = credentials.Certificate(cred_dict)
    firebase_admin.initialize_app(cred)
elif os.environ.get('FUNCTION_NAME') or os.environ.get('K_SERVICE'):
    # Initialize with default credentials in Firebase Cloud Functions environment
    firebase_admin.initialize_app()
else:
    # Fallback to local file
    cred_path = os.environ.get('FIREBASE_CREDENTIALS_PATH', 'firebase-credentials.json')
    cred = credentials.Certificate(str(ROOT_DIR / cred_path))
    firebase_admin.initialize_app(cred)

db = firestore.client()


# JWT settings
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Security
security = HTTPBearer()

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# ==================== Models ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    age: int
    gender: str  # male, female, other

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    id: str
    email: str
    name: str
    age: int
    gender: str
    created_at: datetime

class MedicineCreate(BaseModel):
    name: str
    dosage: str
    timing: List[str]  # ["morning", "afternoon", "night"]
    frequency: str  # "daily" or "weekly"
    start_date: Optional[str] = None

class Medicine(BaseModel):
    id: str
    user_id: str
    name: str
    dosage: str
    timing: List[str]
    frequency: str
    active: bool
    created_at: datetime

class MedicineSchedule(BaseModel):
    id: str
    medicine_id: str
    medicine_name: str
    dosage: str
    scheduled_date: str
    scheduled_time: str  # morning, afternoon, night
    status: str  # pending, taken, missed
    taken_at: Optional[datetime] = None

class MedicineStatusUpdate(BaseModel):
    status: str  # taken or missed

class HealthLogCreate(BaseModel):
    weight: Optional[float] = None
    systolic_bp: Optional[int] = None
    diastolic_bp: Optional[int] = None
    blood_sugar: Optional[float] = None
    heart_rate: Optional[int] = None
    date: Optional[str] = None

class HealthLog(BaseModel):
    id: str
    user_id: str
    date: str
    weight: Optional[float] = None
    systolic_bp: Optional[int] = None
    diastolic_bp: Optional[int] = None
    blood_sugar: Optional[float] = None
    heart_rate: Optional[int] = None
    created_at: datetime

class Alert(BaseModel):
    id: str
    user_id: str
    type: str  # medicine_missed, health_abnormal
    message: str
    severity: str  # low, medium, high
    created_at: datetime
    read: bool

class RiskPrediction(BaseModel):
    overall_risk_level: str  # low, medium, high
    overall_risk_score: int  # 0-100
    diabetes_risk: dict
    hypertension_risk: dict
    heart_disease_risk: dict
    recommendations: List[str]

class PushTokenCreate(BaseModel):
    token: str

class ShareResponse(BaseModel):
    token: str
    share_url: str

# ==================== Firestore Helper ====================

def doc_to_dict(doc) -> dict:
    """Convert a Firestore DocumentSnapshot to a plain dict with 'id' field."""
    data = doc.to_dict() or {}
    data['id'] = doc.id
    return data

def query_one(collection: str, filters: list) -> Optional[dict]:
    """Query Firestore for a single document matching all filters."""
    ref = db.collection(collection)
    for field, op, value in filters:
        ref = ref.where(field, op, value)
    docs = ref.limit(1).get()
    return doc_to_dict(docs[0]) if docs else None

def query_many(collection: str, filters: list = None, order_by: str = None,
               direction=None, limit: int = 100) -> List[dict]:
    """Query Firestore for multiple documents."""
    ref = db.collection(collection)
    if filters:
        for field, op, value in filters:
            ref = ref.where(field, op, value)
    docs = ref.get()
    results = [doc_to_dict(d) for d in docs]
    if order_by:
        reverse = (direction == firestore.Query.DESCENDING)
        results.sort(key=lambda x: x.get(order_by) or datetime.min, reverse=reverse)
    return results[:limit]

def add_document(collection: str, data: dict) -> str:
    """Add a document and return its auto-generated ID."""
    _, ref = db.collection(collection).add(data)
    return ref.id

def update_document(collection: str, doc_id: str, data: dict):
    """Update fields of a specific document."""
    db.collection(collection).document(doc_id).update(data)

def delete_document(collection: str, doc_id: str):
    """Delete a specific document."""
    db.collection(collection).document(doc_id).delete()

def get_document(collection: str, doc_id: str) -> Optional[dict]:
    """Get a document by ID."""
    doc = db.collection(collection).document(doc_id).get()
    return doc_to_dict(doc) if doc.exists else None

# ==================== Helper Functions ====================

def hash_password(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        pwd_bytes = plain_password.encode('utf-8')
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(pwd_bytes, hashed_bytes)
    except Exception:
        return False

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")

        user = get_document('users', user_id)
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")

        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def calculate_risk_prediction(user_data: dict, health_logs: List[dict]) -> RiskPrediction:
    """Rule-based AI risk prediction"""

    if not health_logs:
        return RiskPrediction(
            overall_risk_level="unknown",
            overall_risk_score=0,
            diabetes_risk={"level": "unknown", "score": 0, "reason": "No health data available"},
            hypertension_risk={"level": "unknown", "score": 0, "reason": "No health data available"},
            heart_disease_risk={"level": "unknown", "score": 0, "reason": "No health data available"},
            recommendations=["Start logging your health metrics to get personalized risk assessment"]
        )

    latest_log = health_logs[0]
    age = user_data.get('age', 0)

    # Diabetes Risk
    diabetes_score = 0
    diabetes_level = "low"
    diabetes_reason = ""

    if latest_log.get('blood_sugar'):
        sugar = latest_log['blood_sugar']
        if sugar > 140:
            diabetes_score = 80
            diabetes_level = "high"
            diabetes_reason = f"Blood sugar level {sugar} mg/dL is above normal (>140)"
        elif sugar >= 100:
            diabetes_score = 50
            diabetes_level = "medium"
            diabetes_reason = f"Blood sugar level {sugar} mg/dL is in pre-diabetic range (100-140)"
        else:
            diabetes_score = 20
            diabetes_level = "low"
            diabetes_reason = f"Blood sugar level {sugar} mg/dL is normal"

        if age > 45 and sugar > 120:
            diabetes_score = min(100, diabetes_score + 20)
            diabetes_level = "high"

    # Hypertension Risk
    hypertension_score = 0
    hypertension_level = "low"
    hypertension_reason = ""

    if latest_log.get('systolic_bp') and latest_log.get('diastolic_bp'):
        systolic = latest_log['systolic_bp']
        diastolic = latest_log['diastolic_bp']

        if systolic > 140 or diastolic > 90:
            hypertension_score = 85
            hypertension_level = "high"
            hypertension_reason = f"Blood pressure {systolic}/{diastolic} mmHg indicates hypertension (>140/90)"
        elif systolic >= 130 or diastolic >= 80:
            hypertension_score = 55
            hypertension_level = "medium"
            hypertension_reason = f"Blood pressure {systolic}/{diastolic} mmHg is elevated (130-140/80-90)"
        else:
            hypertension_score = 15
            hypertension_level = "low"
            hypertension_reason = f"Blood pressure {systolic}/{diastolic} mmHg is normal"

    # Heart Disease Risk (combined factors)
    heart_score = 0
    heart_level = "low"
    heart_factors = []

    if age > 55:
        heart_score += 25
        heart_factors.append("age over 55")
    elif age > 45:
        heart_score += 15
        heart_factors.append("age over 45")

    if hypertension_level == "high":
        heart_score += 30
        heart_factors.append("high blood pressure")
    elif hypertension_level == "medium":
        heart_score += 15
        heart_factors.append("elevated blood pressure")

    if latest_log.get('heart_rate'):
        hr = latest_log['heart_rate']
        if hr > 100 or hr < 60:
            heart_score += 20
            heart_factors.append(f"abnormal heart rate ({hr} bpm)")

    if latest_log.get('weight') and age:
        weight = latest_log['weight']
        if weight > 90:
            heart_score += 15
            heart_factors.append("high body weight")

    if heart_score > 60:
        heart_level = "high"
    elif heart_score > 30:
        heart_level = "medium"
    else:
        heart_level = "low"

    heart_reason = f"Risk factors: {', '.join(heart_factors)}" if heart_factors else "No significant risk factors detected"

    # Overall risk
    overall_score = int((diabetes_score + hypertension_score + heart_score) / 3)
    if overall_score > 60:
        overall_level = "high"
    elif overall_score > 30:
        overall_level = "medium"
    else:
        overall_level = "low"

    # Recommendations
    recommendations = []

    if diabetes_level in ["high", "medium"]:
        recommendations.append("Reduce sugar and refined carbohydrate intake")
        recommendations.append("Increase physical activity to 30 minutes daily")
        if diabetes_level == "high":
            recommendations.append("⚠️ Consult a doctor for diabetes screening")

    if hypertension_level in ["high", "medium"]:
        recommendations.append("Reduce salt intake and avoid processed foods")
        recommendations.append("Practice stress management techniques")
        if hypertension_level == "high":
            recommendations.append("⚠️ Consult a cardiologist immediately")

    if heart_level in ["high", "medium"]:
        recommendations.append("Adopt a heart-healthy diet rich in vegetables and whole grains")
        recommendations.append("Regular cardiovascular exercise")
        if heart_level == "high":
            recommendations.append("⚠️ Schedule a comprehensive cardiac evaluation")

    if overall_level == "low":
        recommendations.append("Maintain healthy lifestyle habits")
        recommendations.append("Continue regular health monitoring")

    if latest_log.get('weight') and latest_log['weight'] > 90:
        recommendations.append("Consider a weight management program")

    return RiskPrediction(
        overall_risk_level=overall_level,
        overall_risk_score=overall_score,
        diabetes_risk={
            "level": diabetes_level,
            "score": diabetes_score,
            "reason": diabetes_reason
        },
        hypertension_risk={
            "level": hypertension_level,
            "score": hypertension_score,
            "reason": hypertension_reason
        },
        heart_disease_risk={
            "level": heart_level,
            "score": heart_score,
            "reason": heart_reason
        },
        recommendations=recommendations
    )

async def generate_medicine_schedules(user_id: str):
    """Generate today's medicine schedules"""
    today = datetime.utcnow().strftime("%Y-%m-%d")

    medicines = query_many('medicines', filters=[
        ('user_id', '==', user_id),
        ('active', '==', True)
    ])

    for medicine in medicines:
        medicine_id = medicine['id']

        for timing in medicine['timing']:
            existing = query_one('medicine_schedules', [
                ('medicine_id', '==', medicine_id),
                ('scheduled_date', '==', today),
                ('scheduled_time', '==', timing),
            ])

            if not existing:
                schedule = {
                    "user_id": user_id,
                    "medicine_id": medicine_id,
                    "medicine_name": medicine['name'],
                    "dosage": medicine['dosage'],
                    "scheduled_date": today,
                    "scheduled_time": timing,
                    "status": "pending",
                    "notified": False,
                    "taken_at": None,
                    "created_at": datetime.utcnow()
                }
                add_document('medicine_schedules', schedule)

async def check_and_create_alerts(user_id: str):
    """Check for missed medicines and abnormal health values"""
    today = datetime.utcnow().strftime("%Y-%m-%d")
    current_hour = datetime.utcnow().hour

    # Check missed medicines
    time_mapping = {
        "morning": (5, 12),
        "afternoon": (12, 18),
        "night": (18, 24)
    }

    for time_name, (start, end) in time_mapping.items():
        if current_hour >= end:
            pending_schedules = query_many('medicine_schedules', filters=[
                ('scheduled_date', '==', today),
                ('scheduled_time', '==', time_name),
                ('status', '==', 'pending'),
            ])

            for schedule in pending_schedules:
                # Update status to missed
                update_document('medicine_schedules', schedule['id'], {"status": "missed"})

                # Check if alert already exists
                alert_exists = query_one('alerts', [
                    ('user_id', '==', user_id),
                    ('type', '==', 'medicine_missed'),
                    ('message', '==', f"Missed {schedule['medicine_name']} - {time_name}"),
                ])

                if not alert_exists:
                    alert = {
                        "user_id": user_id,
                        "type": "medicine_missed",
                        "message": f"Missed {schedule['medicine_name']} - {time_name}",
                        "severity": "medium",
                        "created_at": datetime.utcnow(),
                        "read": False
                    }
                    add_document('alerts', alert)

    # Check abnormal health values
    health_logs = query_many('health_logs', filters=[
        ('user_id', '==', user_id)
    ], order_by='created_at', direction=firestore.Query.DESCENDING, limit=1)

    if health_logs:
        latest_log = health_logs[0]
        alerts_to_create = []

        if latest_log.get('blood_sugar') and latest_log['blood_sugar'] > 140:
            alerts_to_create.append({
                "user_id": user_id,
                "type": "health_abnormal",
                "message": f"High blood sugar detected: {latest_log['blood_sugar']} mg/dL",
                "severity": "high",
                "created_at": datetime.utcnow(),
                "read": False
            })

        if latest_log.get('systolic_bp') and latest_log['systolic_bp'] > 140:
            alerts_to_create.append({
                "user_id": user_id,
                "type": "health_abnormal",
                "message": f"High blood pressure: {latest_log['systolic_bp']}/{latest_log.get('diastolic_bp', 0)} mmHg",
                "severity": "high",
                "created_at": datetime.utcnow(),
                "read": False
            })

        for alert_data in alerts_to_create:
            exists = query_one('alerts', [
                ('user_id', '==', user_id),
                ('type', '==', alert_data['type']),
                ('message', '==', alert_data['message']),
            ])
            if not exists:
                add_document('alerts', alert_data)

def send_expo_push_notification(token: str, title: str, body: str):
    url = "https://exp.host/--/api/v2/push/send"
    payload = {
        "to": token,
        "sound": "default",
        "title": title,
        "body": body,
        "data": {"type": "medicine_reminder"}
    }
    try:
        response = requests.post(url, json=payload, headers={"Content-Type": "application/json"})
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error(f"Error sending Expo push notification: {e}")
        return None

def check_and_send_notifications():
    """Check pending schedules and send Expo push notifications"""
    logger.info("Running medicine notification checker...")
    try:
        today = datetime.utcnow().strftime("%Y-%m-%d")
        current_hour = datetime.utcnow().hour
        
        # Determine current active time slots
        active_slots = []
        if current_hour >= 8:
            active_slots.append("morning")
        if current_hour >= 13:
            active_slots.append("afternoon")
        if current_hour >= 20:
            active_slots.append("night")
            
        if not active_slots:
            return

        # Fetch all pending schedules for today
        schedules = query_many('medicine_schedules', filters=[
            ('scheduled_date', '==', today),
            ('status', '==', 'pending')
        ])

        for schedule in schedules:
            if schedule.get('scheduled_time') in active_slots and not schedule.get('notified'):
                user_id = schedule.get('user_id')
                if not user_id:
                    medicine = get_document('medicines', schedule['medicine_id'])
                    if medicine:
                        user_id = medicine.get('user_id')
                
                if user_id:
                    user = get_document('users', user_id)
                    if user and user.get('push_token'):
                        push_token = user['push_token']
                        title = "Medicine Reminder 💊"
                        body = f"It's time to take your {schedule['medicine_name']} ({schedule['dosage']}) for {schedule['scheduled_time']}."
                        
                        logger.info(f"Sending push notification to user {user_id} for {schedule['medicine_name']}")
                        send_expo_push_notification(push_token, title, body)
                
                update_document('medicine_schedules', schedule['id'], {"notified": True})
    except Exception as e:
        logger.error(f"Error in check_and_send_notifications: {e}")

# Initialize and start Background Scheduler (only if not in a serverless/Firebase context)
if not os.environ.get('FUNCTIONS_EMULATOR') and not os.environ.get('FUNCTION_NAME') and not os.environ.get('K_SERVICE'):
    try:
        scheduler = BackgroundScheduler()
        scheduler.add_job(check_and_send_notifications, 'interval', minutes=1)
        scheduler.start()
        logger.info("Local background scheduler started successfully.")
    except Exception as e:
        logger.error(f"Failed to start local background scheduler: {e}")


# Push Notification and Sharing Endpoints
@api_router.post("/users/push-token")
async def save_push_token(token_data: PushTokenCreate, current_user=Depends(get_current_user)):
    user_id = current_user['id']
    update_document('users', user_id, {"push_token": token_data.token})
    return {"message": "Push token saved successfully"}

@api_router.post("/shares")
async def create_share(current_user=Depends(get_current_user)):
    user_id = current_user['id']
    share_token = str(uuid.uuid4())
    share_dict = {
        "user_id": user_id,
        "active": True,
        "created_at": datetime.utcnow()
    }
    db.collection('shares').document(share_token).set(share_dict)
    return {
        "token": share_token,
        "share_url": f"/share/{share_token}"
    }

@api_router.get("/public/shares/{token}")
async def get_public_share(token: str):
    share = get_document('shares', token)
    if not share or not share.get('active'):
        raise HTTPException(status_code=404, detail="Shared link not found or inactive")
        
    user_id = share['user_id']
    user = get_document('users', user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    medicines = query_many('medicines', filters=[
        ('user_id', '==', user_id),
        ('active', '==', True)
    ])
    
    health_logs = query_many('health_logs', filters=[
        ('user_id', '==', user_id)
    ], order_by='date', direction=firestore.Query.DESCENDING, limit=30)
    
    return {
        "patient": {
            "name": user.get('name'),
            "age": user.get('age'),
            "gender": user.get('gender')
        },
        "medicines": [
            {
                "id": med['id'],
                "name": med['name'],
                "dosage": med['dosage'],
                "timing": med['timing'],
                "frequency": med['frequency']
            }
            for med in medicines
        ],
        "health_logs": [
            {
                "id": log['id'],
                "date": log['date'],
                "weight": log.get('weight'),
                "systolic_bp": log.get('systolic_bp'),
                "diastolic_bp": log.get('diastolic_bp'),
                "blood_sugar": log.get('blood_sugar'),
                "heart_rate": log.get('heart_rate')
            }
            for log in health_logs
        ]
    }

# ==================== Authentication Routes ====================

@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    # Check if user exists
    existing = query_one('users', [('email', '==', user_data.email)])
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create user
    user_dict = {
        "email": user_data.email,
        "password_hash": hash_password(user_data.password),
        "name": user_data.name,
        "age": user_data.age,
        "gender": user_data.gender,
        "created_at": datetime.utcnow()
    }

    user_id = add_document('users', user_dict)
    token = create_access_token({"sub": user_id})

    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": user_data.email,
            "name": user_data.name,
            "age": user_data.age,
            "gender": user_data.gender
        }
    }

@api_router.post("/auth/login")
async def login(user_login: UserLogin):
    user = query_one('users', [('email', '==', user_login.email)])

    if not user or not verify_password(user_login.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_id = user['id']
    token = create_access_token({"sub": user_id})

    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": user['email'],
            "name": user['name'],
            "age": user['age'],
            "gender": user['gender']
        }
    }

@api_router.get("/auth/me")
async def get_me(current_user=Depends(get_current_user)):
    return {
        "id": current_user['id'],
        "email": current_user['email'],
        "name": current_user['name'],
        "age": current_user['age'],
        "gender": current_user['gender']
    }

# ==================== Medicine Routes ====================

@api_router.post("/medicines")
async def create_medicine(medicine_data: MedicineCreate, current_user=Depends(get_current_user)):
    user_id = current_user['id']

    medicine_dict = {
        "user_id": user_id,
        "name": medicine_data.name,
        "dosage": medicine_data.dosage,
        "timing": medicine_data.timing,
        "frequency": medicine_data.frequency,
        "active": True,
        "created_at": datetime.utcnow()
    }

    medicine_id = add_document('medicines', medicine_dict)

    # Generate schedules for today
    await generate_medicine_schedules(user_id)

    return {
        "id": medicine_id,
        "user_id": user_id,
        "name": medicine_data.name,
        "dosage": medicine_data.dosage,
        "timing": medicine_data.timing,
        "frequency": medicine_data.frequency,
        "active": True,
        "created_at": medicine_dict["created_at"].isoformat()
    }

@api_router.get("/medicines")
async def get_medicines(current_user=Depends(get_current_user)):
    user_id = current_user['id']
    medicines = query_many('medicines', filters=[
        ('user_id', '==', user_id),
        ('active', '==', True)
    ])

    return [
        {
            "id": med['id'],
            "name": med['name'],
            "dosage": med['dosage'],
            "timing": med['timing'],
            "frequency": med['frequency'],
            "active": med['active'],
            "created_at": med['created_at']
        }
        for med in medicines
    ]

@api_router.delete("/medicines/{medicine_id}")
async def delete_medicine(medicine_id: str, current_user=Depends(get_current_user)):
    user_id = current_user['id']

    medicine = get_document('medicines', medicine_id)
    if not medicine or medicine.get('user_id') != user_id:
        raise HTTPException(status_code=404, detail="Medicine not found")

    update_document('medicines', medicine_id, {"active": False})
    return {"message": "Medicine deleted successfully"}

@api_router.get("/medicines/today")
async def get_today_medicines(current_user=Depends(get_current_user)):
    user_id = current_user['id']

    # Generate schedules for today if not exists
    await generate_medicine_schedules(user_id)

    today = datetime.utcnow().strftime("%Y-%m-%d")

    medicines = query_many('medicines', filters=[
        ('user_id', '==', user_id),
        ('active', '==', True)
    ])

    schedules = []
    for medicine in medicines:
        medicine_id = medicine['id']
        med_schedules = query_many('medicine_schedules', filters=[
            ('medicine_id', '==', medicine_id),
            ('scheduled_date', '==', today),
        ])

        for schedule in med_schedules:
            schedules.append({
                "id": schedule['id'],
                "medicine_id": medicine_id,
                "medicine_name": schedule['medicine_name'],
                "dosage": schedule['dosage'],
                "scheduled_date": schedule['scheduled_date'],
                "scheduled_time": schedule['scheduled_time'],
                "status": schedule['status'],
                "taken_at": schedule.get('taken_at')
            })

    return schedules

@api_router.patch("/medicines/schedule/{schedule_id}")
async def update_medicine_status(
    schedule_id: str,
    status_update: MedicineStatusUpdate,
    current_user=Depends(get_current_user)
):
    schedule = get_document('medicine_schedules', schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    update_data = {"status": status_update.status}
    if status_update.status == "taken":
        update_data["taken_at"] = datetime.utcnow()

    update_document('medicine_schedules', schedule_id, update_data)
    return {"message": "Status updated successfully"}

# ==================== Health Log Routes ====================

@api_router.post("/health-logs")
async def create_health_log(log_data: HealthLogCreate, current_user=Depends(get_current_user)):
    user_id = current_user['id']

    log_dict = {
        "user_id": user_id,
        "date": log_data.date or datetime.utcnow().strftime("%Y-%m-%d"),
        "weight": log_data.weight,
        "systolic_bp": log_data.systolic_bp,
        "diastolic_bp": log_data.diastolic_bp,
        "blood_sugar": log_data.blood_sugar,
        "heart_rate": log_data.heart_rate,
        "created_at": datetime.utcnow()
    }

    log_id = add_document('health_logs', log_dict)

    # Check and create alerts for abnormal values
    await check_and_create_alerts(user_id)

    return {
        "id": log_id,
        "user_id": user_id,
        "date": log_dict["date"],
        "weight": log_data.weight,
        "systolic_bp": log_data.systolic_bp,
        "diastolic_bp": log_data.diastolic_bp,
        "blood_sugar": log_data.blood_sugar,
        "heart_rate": log_data.heart_rate,
        "created_at": log_dict["created_at"].isoformat()
    }

@api_router.get("/health-logs")
async def get_health_logs(limit: int = 30, current_user=Depends(get_current_user)):
    user_id = current_user['id']

    logs = query_many('health_logs', filters=[
        ('user_id', '==', user_id)
    ], order_by='date', direction=firestore.Query.DESCENDING, limit=limit)

    return [
        {
            "id": log['id'],
            "date": log['date'],
            "weight": log.get('weight'),
            "systolic_bp": log.get('systolic_bp'),
            "diastolic_bp": log.get('diastolic_bp'),
            "blood_sugar": log.get('blood_sugar'),
            "heart_rate": log.get('heart_rate'),
            "created_at": log['created_at']
        }
        for log in logs
    ]

# ==================== Risk Prediction Routes ====================

@api_router.get("/risk-prediction")
async def get_risk_prediction(current_user=Depends(get_current_user)):
    user_id = current_user['id']

    health_logs = query_many('health_logs', filters=[
        ('user_id', '==', user_id)
    ], order_by='created_at', direction=firestore.Query.DESCENDING, limit=10)

    prediction = calculate_risk_prediction(current_user, health_logs)
    return prediction

# ==================== Alerts Routes ====================

@api_router.get("/alerts")
async def get_alerts(unread_only: bool = False, current_user=Depends(get_current_user)):
    user_id = current_user['id']

    # Check and create new alerts
    await check_and_create_alerts(user_id)

    filters = [('user_id', '==', user_id)]
    if unread_only:
        filters.append(('read', '==', False))

    alerts = query_many('alerts', filters=filters,
                        order_by='created_at', direction=firestore.Query.DESCENDING, limit=50)

    return [
        {
            "id": alert['id'],
            "type": alert['type'],
            "message": alert['message'],
            "severity": alert['severity'],
            "created_at": alert['created_at'],
            "read": alert['read']
        }
        for alert in alerts
    ]

@api_router.patch("/alerts/{alert_id}/read")
async def mark_alert_read(alert_id: str, current_user=Depends(get_current_user)):
    user_id = current_user['id']

    alert = get_document('alerts', alert_id)
    if not alert or alert.get('user_id') != user_id:
        raise HTTPException(status_code=404, detail="Alert not found")

    update_document('alerts', alert_id, {"read": True})
    return {"message": "Alert marked as read"}

@api_router.delete("/alerts/{alert_id}")
async def delete_alert(alert_id: str, current_user=Depends(get_current_user)):
    user_id = current_user['id']

    alert = get_document('alerts', alert_id)
    if not alert or alert.get('user_id') != user_id:
        raise HTTPException(status_code=404, detail="Alert not found")

    delete_document('alerts', alert_id)
    return {"message": "Alert deleted successfully"}

# ==================== Dashboard Route ====================

@api_router.get("/dashboard")
async def get_dashboard(current_user=Depends(get_current_user)):
    user_id = current_user['id']

    # Generate today's schedules
    await generate_medicine_schedules(user_id)

    today = datetime.utcnow().strftime("%Y-%m-%d")

    medicines = query_many('medicines', filters=[
        ('user_id', '==', user_id),
        ('active', '==', True)
    ])

    today_schedules = []
    for medicine in medicines:
        medicine_id = medicine['id']
        med_schedules = query_many('medicine_schedules', filters=[
            ('medicine_id', '==', medicine_id),
            ('scheduled_date', '==', today),
        ])

        for schedule in med_schedules:
            today_schedules.append({
                "id": schedule['id'],
                "medicine_name": schedule['medicine_name'],
                "dosage": schedule['dosage'],
                "scheduled_time": schedule['scheduled_time'],
                "status": schedule['status']
            })

    # Get latest health log
    health_logs = query_many('health_logs', filters=[
        ('user_id', '==', user_id)
    ], order_by='created_at', direction=firestore.Query.DESCENDING, limit=1)

    health_stats = None
    if health_logs:
        latest_health = health_logs[0]
        health_stats = {
            "weight": latest_health.get('weight'),
            "blood_pressure": f"{latest_health.get('systolic_bp', 0)}/{latest_health.get('diastolic_bp', 0)}" if latest_health.get('systolic_bp') else None,
            "blood_sugar": latest_health.get('blood_sugar'),
            "heart_rate": latest_health.get('heart_rate'),
            "date": latest_health['date']
        }

    # Get unread alerts
    await check_and_create_alerts(user_id)
    unread_alerts = query_many('alerts', filters=[
        ('user_id', '==', user_id),
        ('read', '==', False)
    ], order_by='created_at', direction=firestore.Query.DESCENDING, limit=5)

    alerts_list = [
        {
            "id": alert['id'],
            "type": alert['type'],
            "message": alert['message'],
            "severity": alert['severity'],
            "created_at": alert['created_at']
        }
        for alert in unread_alerts
    ]

    # Get risk prediction
    health_logs_full = query_many('health_logs', filters=[
        ('user_id', '==', user_id)
    ], order_by='created_at', direction=firestore.Query.DESCENDING, limit=10)

    risk_prediction = calculate_risk_prediction(current_user, health_logs_full)

    return {
        "today_medicines": today_schedules,
        "health_stats": health_stats,
        "alerts": alerts_list,
        "risk_prediction": risk_prediction
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
