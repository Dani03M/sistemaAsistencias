import os
from typing import Optional
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, status, Request, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
import ipaddress

load_dotenv()

# Importaciones locales
import models
import schemas
import auth
from database import get_db, engine
import admin_routes

# Crear tablas en la BD
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="API de Asistencia Local", version="1.0.0")

# Registrar rutas de administración
app.include_router(admin_routes.router)
app.include_router(admin_routes.protected_router)

allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,https://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in allowed_origins if origin.strip()], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# RUTAS DE AUTENTICACIÓN Y DISPOSITIVOS
# ==========================================
@app.post("/api/auth/login", response_model=schemas.Token)
def login(login_data: schemas.UserLogin, db: Session = Depends(get_db)):
    # 1. Buscar usuario
    user = db.query(models.User).filter(models.User.dni == login_data.dni).first()
    if not user or not auth.verify_password(login_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="DNI o contraseña incorrectos")
        
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Tu cuenta está desactivada. Contacta a RRHH.")

    # 2. Manejo de Device Binding — MÁXIMO 1 DISPOSITIVO POR EMPLEADO
    existing_device = db.query(models.Device).filter(
        models.Device.user_id == user.id
    ).first()

    if existing_device:
        # Ya tiene un dispositivo registrado
        if existing_device.fingerprint == login_data.device_fingerprint:
            # Es el MISMO dispositivo → permitir login
            # Actualizar nombre del dispositivo si cambió
            if login_data.device_name and login_data.device_name != existing_device.device_name:
                existing_device.device_name = login_data.device_name
                db.commit()
            device = existing_device
        else:
            # Es OTRO dispositivo → RECHAZAR
            raise HTTPException(
                status_code=403, 
                detail="Ya tienes un dispositivo vinculado. Contacta a RRHH para cambiarlo."
            )
    else:
        # Check if fingerprint is already used by another user
        fingerprint_owner = db.query(models.Device).filter(models.Device.fingerprint == login_data.device_fingerprint).first()
        if fingerprint_owner:
            raise HTTPException(
                status_code=403,
                detail="Este dispositivo ya está vinculado a otro empleado. Contacta a RRHH."
            )

        # Primera vez → registrar dispositivo como "Pendiente"
        device = models.Device(
            user_id=user.id,
            fingerprint=login_data.device_fingerprint,
            device_name=login_data.device_name,
            is_approved=False
        )
        db.add(device)
        db.commit()
        db.refresh(device)

    # 3. Crear token de sesión solo si el dispositivo está aprobado
    access_token = None
    if device.is_approved:
        access_token = auth.create_access_token(data={"sub": user.dni, "device": device.fingerprint})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "is_admin": user.is_admin,
        "device_approved": device.is_approved
    }

# ==========================================
# RUTAS DEL PORTAL DEL EMPLEADO
# ==========================================
LOCAL_TZ = timezone(timedelta(hours=-5))  # Zona horaria Perú (UTC-5)
ATTENDANCE_COOLDOWN_MINUTES = 15  # Tiempo mínimo de espera entre marcaciones consecutivas (Anti-Doble Marcación)

@app.get("/api/employee/me")
def get_employee_me(user: models.User = Depends(auth.get_current_user)):
    return {
        "id": user.id,
        "name": user.name,
        "dni": user.dni,
        "work_start_time": user.work_start_time or "08:00",
        "work_end_time": user.work_end_time or "17:00",
        "tolerance_minutes": user.tolerance_minutes if user.tolerance_minutes is not None else 15
    }

class EmployeeChangePassword(BaseModel):
    current_password: str
    new_password: str

@app.put("/api/employee/change-password")
def change_employee_password(data: EmployeeChangePassword, user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    if not auth.verify_password(data.current_password, user.password_hash):
        raise HTTPException(status_code=401, detail="La contraseña actual es incorrecta.")
    
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="La nueva contraseña debe tener al menos 6 caracteres.")
        
    user.password_hash = auth.get_password_hash(data.new_password)
    db.commit()
    return {"message": "Contraseña actualizada exitosamente."}

@app.get("/api/employee/today-status")
def get_employee_today_status(user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    now_utc = datetime.now(timezone.utc)
    now_local = now_utc.astimezone(LOCAL_TZ)
    today_local = now_local.date()

    from sqlalchemy import cast, Date
    from datetime import timedelta
    
    records_today = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.user_id == user.id,
        cast(models.AttendanceRecord.timestamp - timedelta(hours=5), Date) == today_local
    ).order_by(models.AttendanceRecord.timestamp.asc()).all()

    entry_record = next((r for r in records_today if r.record_type == "ENTRADA"), None)
    exit_record = next((r for r in reversed(records_today) if r.record_type == "SALIDA"), None)

    last_record = records_today[-1] if records_today else None

    # Cálculo de cooldown
    cooldown_seconds_remaining = 0
    if last_record:
        last_ts = last_record.timestamp if last_record.timestamp.tzinfo else last_record.timestamp.replace(tzinfo=timezone.utc)
        diff_sec = (now_utc - last_ts).total_seconds()
        if diff_sec < ATTENDANCE_COOLDOWN_MINUTES * 60:
            cooldown_seconds_remaining = int((ATTENDANCE_COOLDOWN_MINUTES * 60) - diff_sec)

    is_shift_completed = (entry_record is not None and exit_record is not None)
    next_action = "COMPLETADO" if is_shift_completed else ("SALIDA" if entry_record else "ENTRADA")

    total_hours_today = 0.0
    for r in records_today:
        if r.hours_worked:
            total_hours_today += r.hours_worked

    current_shift_minutes = 0
    if last_record and last_record.record_type == "ENTRADA" and not exit_record:
        last_ts = last_record.timestamp if last_record.timestamp.tzinfo else last_record.timestamp.replace(tzinfo=timezone.utc)
        current_shift_minutes = int(max(0, (now_utc - last_ts).total_seconds()) // 60)

    entry_time_str = None
    if entry_record:
        ts = entry_record.timestamp if entry_record.timestamp.tzinfo else entry_record.timestamp.replace(tzinfo=timezone.utc)
        entry_time_str = ts.astimezone(LOCAL_TZ).strftime("%H:%M")

    exit_time_str = None
    if exit_record:
        ts = exit_record.timestamp if exit_record.timestamp.tzinfo else exit_record.timestamp.replace(tzinfo=timezone.utc)
        exit_time_str = ts.astimezone(LOCAL_TZ).strftime("%H:%M")

    return {
        "today_date": today_local.strftime("%d/%m/%Y"),
        "has_entry": entry_record is not None,
        "has_exit": exit_record is not None,
        "is_shift_completed": is_shift_completed,
        "entry_time": entry_time_str,
        "entry_status": entry_record.status if entry_record else None,
        "tardiness_minutes": entry_record.tardiness_minutes if entry_record else 0,
        "exit_time": exit_time_str,
        "next_action": next_action,
        "is_currently_working": entry_record is not None and exit_record is None,
        "cooldown_seconds_remaining": cooldown_seconds_remaining,
        "current_shift_minutes": current_shift_minutes,
        "total_hours_today": round(total_hours_today, 2)
    }

@app.get("/api/employee/my-attendance")
def get_my_attendance(user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    records = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.user_id == user.id
    ).order_by(models.AttendanceRecord.timestamp.desc()).limit(30).all()

    result = []
    for r in records:
        ts = r.timestamp if r.timestamp.tzinfo else r.timestamp.replace(tzinfo=timezone.utc)
        local_ts = ts.astimezone(LOCAL_TZ)
        result.append({
            "id": r.id,
            "record_type": r.record_type,
            "status": r.status or ("PUNTUAL" if r.record_type == "ENTRADA" else "SALIDA"),
            "tardiness_minutes": r.tardiness_minutes or 0,
            "hours_worked": r.hours_worked,
            "date": local_ts.strftime("%d/%m/%Y"),
            "time": local_ts.strftime("%H:%M"),
            "timestamp": ts.isoformat()
        })
    return result

# ==========================================
# UTILIDADES DE RED Y SEGURIDAD
# ==========================================
def is_ip_allowed(client_ip: str, allowed_list: list[str]) -> bool:
    if not allowed_list:
        return True
    try:
        c_ip = ipaddress.ip_address(client_ip)
    except ValueError:
        return False

    for allowed in allowed_list:
        allowed = allowed.strip()
        if not allowed:
            continue
        try:
            net = ipaddress.ip_network(allowed, strict=False)
            if c_ip in net:
                return True
        except ValueError:
            if client_ip == allowed:
                return True
KIOSK_API_KEY = os.getenv("KIOSK_API_KEY")
if not KIOSK_API_KEY:
    import sys
    print("FATAL: KIOSK_API_KEY no configurada en variables de entorno.")
    sys.exit(1)

# ==========================================
# RUTAS DEL KIOSCO (PANTALLA DE LA EMPRESA)
# ==========================================

class KioskAuthReq(BaseModel):
    email: str
    password: str

@app.post("/api/kiosk/authorize")
def authorize_kiosk(data: KioskAuthReq, db: Session = Depends(get_db)):
    email = data.email.strip().lower()
    user = db.query(models.User).filter(models.User.email.ilike(email), models.User.is_admin == True).first()
    if not user or not auth.verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales de administrador inválidas.")
    return {"kiosk_api_key": KIOSK_API_KEY}

@app.get("/api/kiosk/qr-data")
def get_kiosk_qr(
    request: Request,
    db: Session = Depends(get_db),
    x_kiosk_key: Optional[str] = Header(None, alias="X-Kiosk-Key")
):
    # 1. Validar clave de autorización del Kiosco
    if not x_kiosk_key or x_kiosk_key != KIOSK_API_KEY:
        raise HTTPException(status_code=403, detail="Acceso no autorizado al terminal Kiosco.")

    # 2. Validar también red Wi-Fi si está activada
    network_setting = db.query(models.NetworkSetting).first()
    if network_setting and network_setting.wifi_validation_enabled:
        client_ip = admin_routes.get_client_ip(request)
        allowed_list = [ip.strip() for ip in network_setting.allowed_ips.split(",") if ip.strip()]
        if not is_ip_allowed(client_ip, allowed_list):
            raise HTTPException(
                status_code=403,
                detail=f"Red no autorizada ({client_ip}) para terminal Kiosco."
            )

    # Devuelve el código matemático (TOTP) de este exacto momento.
    current_code = auth.get_current_qr_data()
    return {"totp_code": current_code, "refresh_interval_seconds": 10}

# ==========================================
# RUTAS DE ASISTENCIA (EL TRABAJADOR ESCANEA)
# ==========================================


@app.post("/api/attendance/scan", response_model=schemas.AttendanceResponse)
def scan_attendance(
    scan_data: schemas.AttendanceScan,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # 0. Validar Red Wi-Fi de la Empresa (Geofencing de Red / Opción B)
    network_setting = db.query(models.NetworkSetting).first()
    if network_setting and network_setting.wifi_validation_enabled:
        client_ip = admin_routes.get_client_ip(request)
        allowed_list = [ip.strip() for ip in network_setting.allowed_ips.split(",") if ip.strip()]
        
        if not is_ip_allowed(client_ip, allowed_list):
            raise HTTPException(
                status_code=403,
                detail=f"Red no autorizada ({client_ip}): Debes estar conectado a la red Wi-Fi de la oficina para marcar asistencia."
            )

    # 1. Validar el QR Dinámico (Antifraude 1)
    if not auth.verify_qr_totp(scan_data.totp_code):
        raise HTTPException(status_code=400, detail="Código QR expirado o inválido. Intenta de nuevo.")

    # 2. Validar que el dispositivo esté aprobado (Antifraude 2)
    device = db.query(models.Device).filter(models.Device.fingerprint == scan_data.device_fingerprint).first()
    if not device:
        raise HTTPException(status_code=403, detail="Dispositivo no reconocido.")
    if not device.is_approved:
        raise HTTPException(status_code=403, detail="Tu dispositivo aún no ha sido aprobado por el administrador.")
        
    if device.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Este dispositivo está registrado a otro usuario.")

    # Bloquear el usuario (para concurrencia y evitar doble marcación)
    locked_user = db.query(models.User).filter(models.User.id == current_user.id).with_for_update().first()
    if not locked_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    user = locked_user
    
    now_utc = datetime.now(timezone.utc)
    now_local = now_utc.astimezone(LOCAL_TZ)
    today_local = now_local.date()

    # 3. Obtener los registros de hoy usando SQL filtering (cast al timezone correcto / Date)
    from sqlalchemy import cast, Date
    # Aproximación segura para PostgreSQL (asumiendo timestamp almacenado en UTC)
    # Filtramos donde la fecha local coincida. En su defecto, restamos 5 horas a nivel SQL
    from datetime import timedelta
    today_records = db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.user_id == user.id,
        cast(models.AttendanceRecord.timestamp - timedelta(hours=5), Date) == today_local
    ).order_by(models.AttendanceRecord.timestamp.asc()).all()

    entry_today = next((r for r in today_records if r.record_type == "ENTRADA"), None)
    exit_today = next((r for r in reversed(today_records) if r.record_type == "SALIDA"), None)

    # REGLA 1: Límite diario de jornada (1 Entrada y 1 Salida por día)
    if entry_today and exit_today:
        raise HTTPException(
            status_code=400,
            detail="Jornada finalizada: Ya registraste tu Entrada y tu Salida el día de hoy. ¡Hasta mañana!"
        )

    # REGLA 2: Cooldown Anti-Doble Marcación Involuntaria (Mínimo 15 minutos)
    last_record = today_records[-1] if today_records else None
    if last_record:
        last_ts = last_record.timestamp if last_record.timestamp.tzinfo else last_record.timestamp.replace(tzinfo=timezone.utc)
        diff_seconds = (now_utc - last_ts).total_seconds()
        if diff_seconds < ATTENDANCE_COOLDOWN_MINUTES * 60:
            remaining_seconds = int((ATTENDANCE_COOLDOWN_MINUTES * 60) - diff_seconds)
            remaining_minutes = max(1, (remaining_seconds + 59) // 60)
            tipo_anterior = "Entrada" if last_record.record_type == "ENTRADA" else "Salida"
            raise HTTPException(
                status_code=400,
                detail=f"Acabas de registrar tu {tipo_anterior} hace instantes. Por seguridad contra doble marcación, debes esperar al menos {remaining_minutes} minuto(s) para volver a marcar."
            )

    # 4. Determinar si corresponde ENTRADA o SALIDA
    if entry_today and not exit_today:
        record_type = "SALIDA"
        attendance_status = "SALIDA"
        tardiness_minutes = 0

        # Cálculo de horas trabajadas entre Entrada y Salida
        prev_ts = entry_today.timestamp if entry_today.timestamp.tzinfo else entry_today.timestamp.replace(tzinfo=timezone.utc)
        diff_seconds = max(0, (now_utc - prev_ts).total_seconds())
        hours_worked = round(diff_seconds / 3600.0, 2)
        hours_int = int(diff_seconds // 3600)
        mins_int = int((diff_seconds % 3600) // 60)

        message = f"Salida registrada para {user.name}. Jornada: {hours_int}h {mins_int}m."
    else:
        record_type = "ENTRADA"
        hours_worked = None

        # Evaluación de PUNTUALIDAD vs TARDANZA
        start_time_str = user.work_start_time or "08:00"
        tolerance_mins = user.tolerance_minutes if user.tolerance_minutes is not None else 15

        try:
            sh, sm = map(int, start_time_str.split(":"))
        except Exception:
            sh, sm = 8, 0

        scheduled_start = now_local.replace(hour=sh, minute=sm, second=0, microsecond=0)
        tolerance_limit = scheduled_start + timedelta(minutes=tolerance_mins)

        if now_local > tolerance_limit:
            # Llegó después de la tolerancia -> TARDANZA
            tardiness_minutes = max(1, int((now_local - scheduled_start).total_seconds() // 60))
            attendance_status = "TARDANZA"
            message = f"Entrada registrada con TARDANZA ({tardiness_minutes} min de retraso) para {user.name}."
        else:
            # Llegó a tiempo o dentro de la tolerancia -> PUNTUAL
            tardiness_minutes = 0
            attendance_status = "PUNTUAL"
            message = f"¡Entrada registrada PUNTUAL para {user.name}!"

    # 4. Guardar en Base de Datos
    new_record = models.AttendanceRecord(
        user_id=user.id,
        device_id=device.id,
        record_type=record_type,
        status=attendance_status,
        tardiness_minutes=tardiness_minutes,
        hours_worked=hours_worked,
        timestamp=now_utc
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)

    return {
        "status": "success",
        "message": message,
        "record_type": record_type,
        "attendance_status": attendance_status,
        "tardiness_minutes": tardiness_minutes,
        "hours_worked": hours_worked,
        "timestamp": new_record.timestamp
    }


