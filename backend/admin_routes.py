from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import cast, Date
from datetime import datetime, timezone, timedelta
from typing import Optional
import csv
import io
import re
import os
import json
import urllib.request
import urllib.error

import models
import schemas
import auth
from database import get_db

router = APIRouter(prefix="/api/admin", tags=["Admin"])
protected_router = APIRouter(prefix="/api/admin", tags=["Admin"], dependencies=[Depends(auth.get_current_admin_user)])

from pydantic import BaseModel
class AdminLogin(BaseModel):
    email: str
    password: str

@router.post("/login")
def admin_login(data: AdminLogin, db: Session = Depends(get_db)):
    email = data.email.strip().lower()
    user = db.query(models.User).filter(
        models.User.email.ilike(email),
        models.User.is_admin == True
    ).first()
    if not user or not auth.verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Tu cuenta está desactivada. Contacta a RRHH.")
    
    access_token = auth.create_access_token(data={"sub": user.dni, "admin": True})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "name": user.name
    }

from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

class GoogleLoginRequest(BaseModel):
    credential: str

@router.post("/google-login")
def admin_google_login(data: GoogleLoginRequest, db: Session = Depends(get_db)):
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    if not client_id:
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID no configurado en el servidor")
    
    try:
        id_info = id_token.verify_oauth2_token(
            data.credential, 
            google_requests.Request(), 
            client_id
        )
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token de Google inválido: {str(e)}")
    
    email = id_info.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="No se pudo obtener el correo de la cuenta de Google")
    
    email = email.strip().lower()
    admin_env_email = (os.getenv("ADMIN_GOOGLE_EMAIL") or "").strip().lower()

    user = db.query(models.User).filter(
        models.User.email.ilike(email),
        models.User.is_admin == True
    ).first()

    if not user and admin_env_email and email == admin_env_email:
        user = db.query(models.User).filter(models.User.is_admin == True).first()
        if user:
            user.email = email
            db.commit()

    if not user:
        raise HTTPException(
            status_code=403, 
            detail=f"El correo '{email}' no tiene permisos de Administrador en este sistema."
        )

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Tu cuenta de administrador está desactivada.")

    access_token = auth.create_access_token(data={"sub": user.dni, "admin": True, "email": email})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "name": user.name,
        "email": email
    }

class PasswordVerifyRequest(BaseModel):
    password: str

@protected_router.post("/verify-password")
def verify_admin_password(data: PasswordVerifyRequest, admin_dni: str = Depends(auth.get_current_admin_user), db: Session = Depends(get_db)):
    admin_user = db.query(models.User).filter(models.User.dni == admin_dni).first()
    if not admin_user or not auth.verify_password(data.password, admin_user.password_hash):
        raise HTTPException(status_code=401, detail="Contraseña incorrecta")
    return {"success": True}

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

@protected_router.put("/change-password")
def change_admin_password(data: ChangePasswordRequest, admin_dni: str = Depends(auth.get_current_admin_user), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.dni == admin_dni).first()
    if not user or not auth.verify_password(data.current_password, user.password_hash):
        raise HTTPException(status_code=401, detail="La contraseña actual es incorrecta.")
    
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="La nueva contraseña debe tener al menos 6 caracteres.")
        
    user.password_hash = auth.get_password_hash(data.new_password)
    db.commit()
    return {"message": "Contraseña actualizada exitosamente."}


# ==========================================
# DASHBOARD - Resumen del día
# ==========================================
@protected_router.get("/dashboard")
def get_dashboard(db: Session = Depends(get_db)):
    # Usar hora local Perú (UTC-5) para evaluar el día de hoy
    local_now = datetime.now(timezone.utc) - timedelta(hours=5)
    today = local_now.date()

    total_employees = db.query(models.User).filter(
        models.User.is_admin == False,
        models.User.is_active == True
    ).count()

    today_records = db.query(models.AttendanceRecord).filter(
        cast(models.AttendanceRecord.timestamp - timedelta(hours=5), Date) == today
    ).all()

    # Empleados con entrada hoy
    entry_records = [r for r in today_records if r.record_type == "ENTRADA"]
    checked_in_users = {r.user_id for r in entry_records}
    checked_in_today = len(checked_in_users)

    # Puntuales vs Tardanzas
    punctual_today = sum(1 for r in entry_records if r.status == "PUNTUAL")
    tardy_today = sum(1 for r in entry_records if r.status == "TARDANZA")

    pending_devices = db.query(models.Device).filter(
        models.Device.is_approved == False
    ).count()

    recent_records = db.query(models.AttendanceRecord).order_by(
        models.AttendanceRecord.timestamp.desc()
    ).limit(10).all()

    recent_list = []
    for record in recent_records:
        ts = record.timestamp
        recent_list.append({
            "id": record.id,
            "employee_name": record.user.name,
            "record_type": record.record_type,
            "status": record.status or ("PUNTUAL" if record.record_type == "ENTRADA" else "SALIDA"),
            "tardiness_minutes": record.tardiness_minutes or 0,
            "timestamp": ts.isoformat(),
        })

    return {
        "total_employees": total_employees,
        "checked_in_today": checked_in_today,
        "present_today": checked_in_today,
        "absent_today": max(0, total_employees - checked_in_today),
        "punctual_today": punctual_today,
        "tardy_today": tardy_today,
        "pending_devices": pending_devices,
        "recent_records": recent_list,
    }


# ==========================================
# REPORTES — Datos para gráficos y Planilla
# ==========================================
@protected_router.get("/reports/weekly")
def get_weekly_report(db: Session = Depends(get_db)):
    """Devuelve la cantidad de entradas y salidas por día de los últimos 7 días."""
    local_now = datetime.now(timezone.utc) - timedelta(hours=5)
    today = local_now.date()
    days = []

    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_names_es = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
        day_name = day_names_es[day.weekday()]

        entradas = db.query(models.AttendanceRecord).filter(
            cast(models.AttendanceRecord.timestamp - timedelta(hours=5), Date) == day,
            models.AttendanceRecord.record_type == "ENTRADA"
        ).count()

        salidas = db.query(models.AttendanceRecord).filter(
            cast(models.AttendanceRecord.timestamp - timedelta(hours=5), Date) == day,
            models.AttendanceRecord.record_type == "SALIDA"
        ).count()

        days.append({
            "day": day_name,
            "date": day.isoformat(),
            "entradas": entradas,
            "salidas": salidas,
        })

    return days


@protected_router.get("/reports/payroll-summary")
def get_payroll_summary(
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """Genera el resumen de asistencias, horas y tardanzas por empleado para la planilla."""
    local_now = datetime.now(timezone.utc) - timedelta(hours=5)
    target_month = month or local_now.month
    target_year = year or local_now.year

    # 1. Obtener todos los empleados (1 consulta)
    employees = db.query(models.User).filter(models.User.is_admin == False).all()
    
    # Calcular primer y último día del mes
    from calendar import monthrange
    _, last_day = monthrange(target_year, target_month)
    start_date = datetime(target_year, target_month, 1).date()
    end_date = datetime(target_year, target_month, last_day).date()

    # 2. Obtener TODOS los registros del mes en UNA SOLA consulta
    all_month_records = db.query(models.AttendanceRecord).filter(
        cast(models.AttendanceRecord.timestamp - timedelta(hours=5), Date) >= start_date,
        cast(models.AttendanceRecord.timestamp - timedelta(hours=5), Date) <= end_date
    ).all()

    # 3. Agrupar registros por empleado en memoria de Python (O(N))
    from collections import defaultdict
    records_by_user = defaultdict(list)
    for r in all_month_records:
        records_by_user[r.user_id].append(r)

    summary = []
    for emp in employees:
        month_records = records_by_user.get(emp.id, [])

        days_set = {(r.timestamp - timedelta(hours=5)).date() for r in month_records if r.record_type == "ENTRADA"}
        days_attended = len(days_set)

        entries = [r for r in month_records if r.record_type == "ENTRADA"]
        punctual_count = sum(1 for r in entries if r.status == "PUNTUAL")
        tardy_count = sum(1 for r in entries if r.status == "TARDANZA")
        total_tardiness_minutes = sum(r.tardiness_minutes or 0 for r in entries)

        total_hours = sum(r.hours_worked or 0.0 for r in month_records)

        summary.append({
            "employee_id": emp.id,
            "name": emp.name,
            "dni": emp.dni,
            "days_attended": days_attended,
            "total_hours": round(total_hours, 2),
            "punctual_count": punctual_count,
            "tardy_count": tardy_count,
            "total_tardiness_minutes": total_tardiness_minutes,
        })

    return {
        "month": target_month,
        "year": target_year,
        "summary": summary
    }


@protected_router.get("/reports/export-payroll-csv")
def export_payroll_excel(
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """Descarga el reporte de nómina/planilla en formato Excel (XLSX)."""
    data = get_payroll_summary(month, year, db)
    summary = data["summary"]

    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = f"Planilla {data['year']}-{data['month']:02d}"

    # Estilos
    header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid") # Indigo 900
    header_font = Font(color="FFFFFF", bold=True, name="Calibri")
    centered_align = Alignment(horizontal="center", vertical="center")
    border = Border(
        left=Side(style='thin', color='E2E8F0'), 
        right=Side(style='thin', color='E2E8F0'), 
        top=Side(style='thin', color='E2E8F0'), 
        bottom=Side(style='thin', color='E2E8F0')
    )

    headers = ["ID", "Empleado", "DNI", "Días Asistidos", "Total Horas Laboradas", "Puntuales", "Tardanzas", "Minutos Tardanza Acumulados"]
    ws.append(headers)

    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = centered_align
        cell.border = border

    row_idx = 2
    for row in summary:
        row_data = [
            row["employee_id"],
            row["name"],
            row["dni"],
            row["days_attended"],
            round(row["total_hours"], 2),
            row["punctual_count"],
            row["tardy_count"],
            row["total_tardiness_minutes"],
        ]
        ws.append(row_data)

        fill_color = "F8FAFC" if row_idx % 2 == 0 else "FFFFFF"
        row_fill = PatternFill(start_color=fill_color, end_color=fill_color, fill_type="solid")
        
        for col_idx in range(1, len(row_data) + 1):
            cell = ws.cell(row=row_idx, column=col_idx)
            cell.fill = row_fill
            cell.border = border
            if col_idx in [1, 3, 4, 5, 6, 7, 8]: # Centrar datos numéricos
                cell.alignment = centered_align
        row_idx += 1

    # Auto-ajuste de columnas
    for col in ws.columns:
        max_length = 0
        column_letter = get_column_letter(col[0].column)
        for cell in col:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        ws.column_dimensions[column_letter].width = (max_length + 3)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    filename = f"reporte_planilla_{data['year']}_{data['month']:02d}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ==========================================
# CONSULTA DNI PÚBLICA Y GRATUITA ($0 COSTO)
# ==========================================
DNI_CACHE = {}

def lookup_dni_peru(dni: str) -> dict:
    dni = dni.strip()
    if not dni.isdigit() or len(dni) != 8:
        return {"success": False, "message": "El DNI debe tener exactamente 8 dígitos numéricos."}

    # Caché en memoria para evitar consultas repetidas y 0ms de respuesta
    if dni in DNI_CACHE:
        return DNI_CACHE[dni]

    token = os.getenv("DNI_API_TOKEN", "").strip()
    url = f"https://api.apis.net.pe/v1/dni?numero={dni}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://apis.net.pe/api-consulta-dni",
        "Accept": "application/json",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=5) as resp:
            if resp.status == 200:
                raw_data = json.loads(resp.read().decode("utf-8"))
                nombres = raw_data.get("nombres", "").strip()
                ap_pat = raw_data.get("apellidoPaterno", "").strip()
                ap_mat = raw_data.get("apellidoMaterno", "").strip()

                if nombres and ap_pat:
                    full_name = f"{nombres} {ap_pat} {ap_mat}".strip()
                else:
                    full_name = raw_data.get("nombre", "").strip()

                if not full_name:
                    return {"success": False, "message": "DNI no encontrado en los padrones públicos."}

                result = {
                    "success": True,
                    "dni": dni,
                    "full_name": full_name,
                    "nombres": nombres,
                    "apellido_paterno": ap_pat,
                    "apellido_materno": ap_mat,
                }
                DNI_CACHE[dni] = result
                return result
    except urllib.error.HTTPError as e:
        if e.code == 429:
            return {"success": False, "message": "El servicio de RENIEC gratuito está ocupado momentáneamente. Ingrese el nombre de forma manual."}
        elif e.code in (404, 422):
            return {"success": False, "message": "DNI no encontrado en el registro nacional."}
        else:
            return {"success": False, "message": f"Servicio no disponible (HTTP {e.code}). Ingrese el nombre de forma manual."}
    except Exception as e:
        return {"success": False, "message": "No se pudo conectar con el servicio de consulta. Ingrese el nombre manualmente."}


@protected_router.get("/lookup-dni/{dni}")
def api_lookup_dni(dni: str):
    """Consulta pública gratuita ($0) para autocompletar nombres y apellidos por DNI."""
    return lookup_dni_peru(dni)


# ==========================================
# GESTIÓN DE EMPLEADOS
# ==========================================
@protected_router.get("/employees")
def list_employees(db: Session = Depends(get_db)):
    employees = db.query(models.User).options(joinedload(models.User.devices)).order_by(models.User.name.asc()).all()
    result = []
    for emp in employees:
        result.append({
            "id": emp.id,
            "name": emp.name,
            "dni": emp.dni,
            "is_admin": emp.is_admin,
            "is_active": emp.is_active,
            "work_start_time": emp.work_start_time or "08:00",
            "work_end_time": emp.work_end_time or "17:00",
            "tolerance_minutes": emp.tolerance_minutes if emp.tolerance_minutes is not None else 15,
            "devices_count": len(emp.devices),
        })
    return result


@protected_router.post("/employees")
def create_employee(
    data: schemas.EmployeeCreate,
    db: Session = Depends(get_db)
):
    name = (data.name or "").strip()
    dni = (data.dni or "").strip()
    password = data.password
    work_start_time = data.work_start_time or "08:00"
    work_end_time = data.work_end_time or "17:00"
    tolerance_minutes = data.tolerance_minutes if data.tolerance_minutes is not None else 15

    if not name or len(name) < 3:
        raise HTTPException(status_code=400, detail="El nombre debe tener al menos 3 caracteres.")
    if not re.match(r"^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s\-\'\.]+$", name):
        raise HTTPException(status_code=400, detail="El nombre contiene caracteres no permitidos.")

    if not re.match(r"^\d{8}$", dni):
        raise HTTPException(status_code=400, detail="El DNI debe tener exactamente 8 dígitos numéricos.")

    if not password or len(password) < 6:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres.")

    if tolerance_minutes is not None and (tolerance_minutes < 0 or tolerance_minutes > 60):
        raise HTTPException(status_code=400, detail="La tolerancia debe estar entre 0 y 60 minutos.")

    if work_start_time and not re.match(r"^(?:[01]\d|2[0-3]):[0-5]\d$", work_start_time):
        raise HTTPException(status_code=400, detail="El formato de la hora de entrada debe ser HH:MM (ej. 08:00) y válida.")

    if work_end_time and not re.match(r"^(?:[01]\d|2[0-3]):[0-5]\d$", work_end_time):
        raise HTTPException(status_code=400, detail="El formato de la hora de salida debe ser HH:MM (ej. 17:00) y válida.")

    existing = db.query(models.User).filter(models.User.dni == dni).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un usuario con ese DNI.")

    new_user = models.User(
        name=name,
        dni=dni,
        password_hash=auth.get_password_hash(password),
        is_admin=False,
        work_start_time=work_start_time or "08:00",
        work_end_time=work_end_time or "17:00",
        tolerance_minutes=tolerance_minutes if tolerance_minutes is not None else 15,
        is_active=data.is_active if data.is_active is not None else True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": f"Empleado '{name}' creado exitosamente.", "id": new_user.id}


@protected_router.put("/employees/{employee_id}")
def update_employee(
    employee_id: int,
    data: schemas.EmployeeUpdate,
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.id == employee_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Empleado no encontrado.")
    
    if data.name is not None:
        name = data.name.strip()
        if len(name) < 3:
            raise HTTPException(status_code=400, detail="El nombre debe tener al menos 3 caracteres.")
        if not re.match(r"^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s\-\'\.]+$", name):
            raise HTTPException(status_code=400, detail="El nombre contiene caracteres no permitidos.")
        user.name = name

    if data.dni is not None:
        dni = data.dni.strip()
        if not re.match(r"^\d{8}$", dni):
            raise HTTPException(status_code=400, detail="El DNI debe tener exactamente 8 dígitos numéricos.")
        existing = db.query(models.User).filter(models.User.dni == dni, models.User.id != employee_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Ya existe otro usuario con ese DNI.")
        user.dni = dni

    if data.password is not None and data.password != "":
        if len(data.password) < 6:
            raise HTTPException(status_code=400, detail="La nueva contraseña debe tener al menos 6 caracteres.")
        user.password_hash = auth.get_password_hash(data.password)

    if data.tolerance_minutes is not None:
        if data.tolerance_minutes < 0 or data.tolerance_minutes > 60:
            raise HTTPException(status_code=400, detail="La tolerancia debe estar entre 0 y 60 minutos.")
        user.tolerance_minutes = data.tolerance_minutes

    if data.work_start_time is not None:
        if not re.match(r"^(?:[01]\d|2[0-3]):[0-5]\d$", data.work_start_time):
            raise HTTPException(status_code=400, detail="El formato de hora de entrada debe ser HH:MM válida.")
        user.work_start_time = data.work_start_time

    if data.work_end_time is not None:
        if not re.match(r"^(?:[01]\d|2[0-3]):[0-5]\d$", data.work_end_time):
            raise HTTPException(status_code=400, detail="El formato de hora de salida debe ser HH:MM válida.")
        user.work_end_time = data.work_end_time
        
    if data.is_active is not None:
        user.is_active = data.is_active
    
    db.commit()
    return {"message": f"Empleado '{user.name}' actualizado exitosamente."}


@protected_router.delete("/employees/{employee_id}")
def delete_employee(employee_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == employee_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Empleado no encontrado.")
    if user.is_admin:
        raise HTTPException(status_code=400, detail="No se puede eliminar un administrador.")
    
    # Soft delete
    user.is_active = False
    db.query(models.Device).filter(models.Device.user_id == user.id).update({"is_approved": False})
    db.commit()
    return {"message": "Empleado inactivado exitosamente (borrado lógico)."}


# ==========================================
# GESTIÓN DE DISPOSITIVOS (Aprobar / Bloquear / Eliminar)
# ==========================================
@protected_router.get("/devices")
def list_devices(db: Session = Depends(get_db)):
    devices = db.query(models.Device).options(joinedload(models.Device.user)).order_by(models.Device.created_at.desc()).all()
    result = []
    for dev in devices:
        result.append({
            "id": dev.id,
            "employee_name": dev.user.name,
            "employee_dni": dev.user.dni,
            "device_name": dev.device_name or "Desconocido",
            "is_approved": dev.is_approved,
            "created_at": dev.created_at.isoformat(),
        })
    return result


@protected_router.put("/devices/{device_id}/approve")
def approve_device(device_id: int, db: Session = Depends(get_db)):
    device = db.query(models.Device).filter(models.Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Dispositivo no encontrado.")
    device.is_approved = True
    db.commit()
    return {"message": f"Dispositivo de {device.user.name} aprobado exitosamente."}


@protected_router.put("/devices/{device_id}/block")
def block_device(device_id: int, db: Session = Depends(get_db)):
    device = db.query(models.Device).filter(models.Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Dispositivo no encontrado.")
    device.is_approved = False
    db.commit()
    return {"message": f"Dispositivo de {device.user.name} bloqueado."}


@protected_router.delete("/devices/{device_id}")
def delete_device(device_id: int, db: Session = Depends(get_db)):
    """Elimina un dispositivo para que el empleado pueda vincular otro."""
    device = db.query(models.Device).filter(models.Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Dispositivo no encontrado.")
    user_name = device.user.name
    # Limpiar referencias en asistencias antes de borrar
    db.query(models.AttendanceRecord).filter(
        models.AttendanceRecord.device_id == device.id
    ).update({models.AttendanceRecord.device_id: None})
    db.delete(device)
    db.commit()
    return {"message": f"Dispositivo de {user_name} eliminado. Puede vincular uno nuevo."}


# ==========================================
# JUSTIFICACIONES / PERMISOS / FALTAS
# ==========================================

from pydantic import BaseModel as PydanticBaseModel

class JustificationCreate(PydanticBaseModel):
    employee_id: int
    justification_type: str  # VACACIONES, DESCANSO_MEDICO, PERMISO, FERIADO, OTRO
    start_date: str  # YYYY-MM-DD
    end_date: str    # YYYY-MM-DD
    reason: Optional[str] = None

@protected_router.get("/justifications")
def list_justifications(
    employee_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(models.Justification).options(joinedload(models.Justification.user))
    if employee_id:
        query = query.filter(models.Justification.user_id == employee_id)
    justifications = query.order_by(models.Justification.start_date.desc()).all()
    
    TYPE_LABELS = {
        "VACACIONES": "Vacaciones",
        "DESCANSO_MEDICO": "Descanso Médico",
        "PERMISO": "Permiso Personal",
        "FERIADO": "Feriado",
        "OTRO": "Otro"
    }
    
    result = []
    for j in justifications:
        # Calcular días
        from datetime import datetime as dt_cls
        try:
            d1 = dt_cls.strptime(j.start_date, "%Y-%m-%d").date()
            d2 = dt_cls.strptime(j.end_date, "%Y-%m-%d").date()
            days = (d2 - d1).days + 1
        except:
            days = 1
        
        result.append({
            "id": j.id,
            "employee_id": j.user_id,
            "employee_name": j.user.name if j.user else "Desconocido",
            "employee_dni": j.user.dni if j.user else "N/A",
            "justification_type": j.justification_type,
            "type_label": TYPE_LABELS.get(j.justification_type, j.justification_type),
            "start_date": j.start_date,
            "end_date": j.end_date,
            "days": days,
            "reason": j.reason or "",
            "created_at": j.created_at.isoformat() if j.created_at else None,
        })
    return result

@protected_router.post("/justifications")
def create_justification(data: JustificationCreate, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == data.employee_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
    
    if data.justification_type not in ["VACACIONES", "DESCANSO_MEDICO", "PERMISO", "FERIADO", "OTRO"]:
        raise HTTPException(status_code=400, detail="Tipo de justificación inválido")
    
    # Validar fechas
    try:
        from datetime import datetime as dt_cls
        d1 = dt_cls.strptime(data.start_date, "%Y-%m-%d")
        d2 = dt_cls.strptime(data.end_date, "%Y-%m-%d")
        if d2 < d1:
            raise HTTPException(status_code=400, detail="La fecha fin no puede ser anterior a la fecha inicio")
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido (use YYYY-MM-DD)")
    
    new_justification = models.Justification(
        user_id=data.employee_id,
        justification_type=data.justification_type,
        start_date=data.start_date,
        end_date=data.end_date,
        reason=data.reason,
    )
    db.add(new_justification)
    db.commit()
    db.refresh(new_justification)
    return {"message": "Justificación registrada exitosamente", "id": new_justification.id}

@protected_router.delete("/justifications/{justification_id}")
def delete_justification(justification_id: int, db: Session = Depends(get_db)):
    j = db.query(models.Justification).filter(models.Justification.id == justification_id).first()
    if not j:
        raise HTTPException(status_code=404, detail="Justificación no encontrada")
    db.delete(j)
    db.commit()
    return {"message": "Justificación eliminada"}


# ==========================================
# REPORTES: DATOS PARA GRÁFICOS DEL DASHBOARD
# ==========================================

@protected_router.get("/reports/weekly-detail")
def get_weekly_detail(db: Session = Depends(get_db)):
    """Devuelve puntuales y tardanzas por día de los últimos 7 días para el gráfico."""
    local_now = datetime.now(timezone.utc) - timedelta(hours=5)
    today = local_now.date()
    days = []

    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_names_es = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
        day_name = day_names_es[day.weekday()]

        puntuales = db.query(models.AttendanceRecord).filter(
            cast(models.AttendanceRecord.timestamp - timedelta(hours=5), Date) == day,
            models.AttendanceRecord.record_type == "ENTRADA",
            models.AttendanceRecord.status == "PUNTUAL"
        ).count()

        tardanzas = db.query(models.AttendanceRecord).filter(
            cast(models.AttendanceRecord.timestamp - timedelta(hours=5), Date) == day,
            models.AttendanceRecord.record_type == "ENTRADA",
            models.AttendanceRecord.status == "TARDANZA"
        ).count()

        days.append({
            "day": f"{day_name} {day.day:02d}",
            "puntuales": puntuales,
            "tardanzas": tardanzas,
        })

    return days


# ==========================================
# HISTORIAL DE ASISTENCIAS (con filtros)
# ==========================================

from pydantic import BaseModel
from datetime import datetime, timedelta, timezone

class ManualAttendance(BaseModel):
    employee_id: int
    timestamp: str
    record_type: str
    admin_password: str

@protected_router.post("/attendance/manual")
def add_manual_attendance(data: ManualAttendance, db: Session = Depends(get_db), current_admin: models.User = Depends(auth.get_current_admin_user)):
    if not auth.verify_password(data.admin_password, current_admin.password_hash):
        raise HTTPException(status_code=401, detail="Contraseña de administrador incorrecta")

    user = db.query(models.User).filter(models.User.id == data.employee_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
        
    try:
        dt_local = datetime.fromisoformat(data.timestamp.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido")
        
    LOCAL_TZ = timezone(timedelta(hours=-5))
    if dt_local.tzinfo is None:
        dt_local = dt_local.replace(tzinfo=LOCAL_TZ)
        
    dt_utc = dt_local.astimezone(timezone.utc)
    
    tardiness_minutes = 0
    status = "PUNTUAL"
    hours_worked = None
    
    if data.record_type == "ENTRADA":
        start_time_str = user.work_start_time or "08:00"
        try:
            h, m = map(int, start_time_str.split(':'))
            expected_local = dt_local.replace(hour=h, minute=m, second=0, microsecond=0)
            diff_seconds = (dt_local - expected_local).total_seconds()
            tolerance = user.tolerance_minutes * 60
            if diff_seconds > tolerance:
                status = "TARDANZA"
                tardiness_minutes = int(diff_seconds // 60)
        except Exception:
            pass
    else:
        status = "SALIDA"
        today_local = dt_local.date()
        start_of_day_utc = datetime(today_local.year, today_local.month, today_local.day, tzinfo=LOCAL_TZ).astimezone(timezone.utc)
        end_of_day_utc = start_of_day_utc + timedelta(days=1)
        
        entry = db.query(models.AttendanceRecord).filter(
            models.AttendanceRecord.user_id == user.id,
            models.AttendanceRecord.record_type == "ENTRADA",
            models.AttendanceRecord.timestamp >= start_of_day_utc,
            models.AttendanceRecord.timestamp < end_of_day_utc,
            models.AttendanceRecord.timestamp < dt_utc
        ).order_by(models.AttendanceRecord.timestamp.desc()).first()
        
        if entry:
            entry_ts = entry.timestamp if entry.timestamp.tzinfo else entry.timestamp.replace(tzinfo=timezone.utc)
            diff_secs = max(0, (dt_utc - entry_ts).total_seconds())
            hours_worked = round(diff_secs / 3600.0, 2)

    new_record = models.AttendanceRecord(
        user_id=user.id,
        device_id=None,
        record_type=data.record_type,
        status=status,
        tardiness_minutes=tardiness_minutes,
        hours_worked=hours_worked,
        timestamp=dt_utc
    )
    
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    
    return {"message": "Registro manual creado exitosamente", "id": new_record.id}


@protected_router.get("/attendance")
def list_attendance(
    start_date: Optional[str] = Query(None, description="Fecha inicio YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="Fecha fin YYYY-MM-DD"),
    employee_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1, description="Número de página"),
    limit: int = Query(50, ge=1, le=200, description="Registros por página"),
    db: Session = Depends(get_db)
):
    query = db.query(models.AttendanceRecord).options(
        joinedload(models.AttendanceRecord.user),
        joinedload(models.AttendanceRecord.device)
    )

    if start_date:
        # Convertir inicio del día Perú (UTC-5) a UTC para buscar
        # 00:00 Peru = 05:00 UTC
        start_utc = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc) + timedelta(hours=5)
        query = query.filter(models.AttendanceRecord.timestamp >= start_utc)
    
    if end_date:
        # Convertir fin del día Perú a UTC
        # 23:59 Peru = al día siguiente 04:59:59 UTC -> < 05:00 UTC del día siguiente
        end_utc = datetime.strptime(end_date, "%Y-%m-%d").replace(tzinfo=timezone.utc) + timedelta(days=1, hours=5)
        query = query.filter(models.AttendanceRecord.timestamp < end_utc)
        
    if employee_id:
        query = query.filter(models.AttendanceRecord.user_id == employee_id)

    total = query.count()
    pages = (total + limit - 1) // limit if limit > 0 else 1
    records = query.order_by(models.AttendanceRecord.timestamp.desc()).offset((page - 1) * limit).limit(limit).all()

    result = []
    for record in records:
        ts = record.timestamp
        result.append({
            "id": record.id,
            "employee_name": record.user.name if record.user else "Desconocido",
            "employee_dni": record.user.dni if record.user else "N/A",
            "record_type": record.record_type,
            "status": record.status or ("PUNTUAL" if record.record_type == "ENTRADA" else "SALIDA"),
            "tardiness_minutes": record.tardiness_minutes or 0,
            "hours_worked": record.hours_worked,
            "timestamp": ts.isoformat() if ts else None,
            "device_name": record.device.device_name if record.device else "Registro Manual",
        })
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "pages": pages,
        "data": result
    }


# ==========================================
# EXPORTAR CSV
# ==========================================
@protected_router.get("/reports/export-csv")
def export_excel(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    employee_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    """Genera y descarga un archivo Excel (XLSX) con los registros de asistencia formateado."""
    query = db.query(models.AttendanceRecord).options(
        joinedload(models.AttendanceRecord.user),
        joinedload(models.AttendanceRecord.device)
    )

    if start_date:
        start_utc = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc) + timedelta(hours=5)
        query = query.filter(models.AttendanceRecord.timestamp >= start_utc)
    if end_date:
        end_utc = datetime.strptime(end_date, "%Y-%m-%d").replace(tzinfo=timezone.utc) + timedelta(days=1, hours=5)
        query = query.filter(models.AttendanceRecord.timestamp < end_utc)
    if employee_id:
        query = query.filter(models.AttendanceRecord.user_id == employee_id)

    records = query.order_by(models.AttendanceRecord.timestamp.desc()).all()

    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Reporte de Asistencia"

    # Estilos
    header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid") # Indigo 900
    header_font = Font(color="FFFFFF", bold=True, name="Calibri")
    centered_align = Alignment(horizontal="center", vertical="center")
    border = Border(
        left=Side(style='thin', color='E2E8F0'), 
        right=Side(style='thin', color='E2E8F0'), 
        top=Side(style='thin', color='E2E8F0'), 
        bottom=Side(style='thin', color='E2E8F0')
    )

    headers = ["ID", "Empleado", "DNI", "Tipo", "Estado", "Tardanza (min)", "Horas Trabajadas", "Fecha", "Hora", "Dispositivo"]
    ws.append(headers)

    # Aplicar estilos de cabecera
    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = centered_align
        cell.border = border

    row_idx = 2
    for record in records:
        ts = record.timestamp
        # Convertir a hora de Perú para exportar (UTC-5)
        local_ts = ts - timedelta(hours=5) if ts.tzinfo is None else ts.astimezone(timezone(timedelta(hours=-5)))
        
        row_data = [
            record.id,
            record.user.name if record.user else "Desconocido",
            record.user.dni if record.user else "N/A",
            record.record_type,
            record.status or ("PUNTUAL" if record.record_type == "ENTRADA" else "SALIDA"),
            record.tardiness_minutes if record.tardiness_minutes else 0,
            round(record.hours_worked, 2) if record.hours_worked is not None else "-",
            local_ts.strftime("%Y-%m-%d"),
            local_ts.strftime("%H:%M:%S"),
            record.device.device_name if record.device else "Registro Manual",
        ]
        ws.append(row_data)

        # Aplicar estilos a las filas
        fill_color = "F8FAFC" if row_idx % 2 == 0 else "FFFFFF" # Alternar filas
        row_fill = PatternFill(start_color=fill_color, end_color=fill_color, fill_type="solid")
        
        for col_idx in range(1, len(row_data) + 1):
            cell = ws.cell(row=row_idx, column=col_idx)
            cell.fill = row_fill
            cell.border = border
            if col_idx in [1, 3, 4, 5, 6, 7, 8, 9]: # Centrar datos numéricos/fechas/estados
                cell.alignment = centered_align
        
        row_idx += 1

    # Auto-ajustar ancho de columnas
    for col in ws.columns:
        max_length = 0
        column_letter = get_column_letter(col[0].column)
        for cell in col:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        adjusted_width = (max_length + 3)
        ws.column_dimensions[column_letter].width = adjusted_width

    # Guardar en memoria
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=reporte_asistencia.xlsx"}
    )


# ==========================================
# CONFIGURACIÓN DE RED Y WI-FI DE LA EMPRESA
# ==========================================
class NetworkSettingUpdate(BaseModel):
    wifi_validation_enabled: bool
    allowed_ips: str


def get_client_ip(request: Request) -> str:
    """Obtiene la IP local real del cliente o desde el proxy de la nube."""
    x_forwarded_for = request.headers.get("X-Forwarded-For")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
        
    if request.client:
        return request.client.host
    return "127.0.0.1"


@protected_router.get("/network-settings")
def get_network_settings(request: Request, db: Session = Depends(get_db)):
    setting = db.query(models.NetworkSetting).first()
    if not setting:
        setting = models.NetworkSetting(wifi_validation_enabled=False, allowed_ips="")
        db.add(setting)
        db.commit()
        db.refresh(setting)

    detected_ip = get_client_ip(request)
    return {
        "wifi_validation_enabled": setting.wifi_validation_enabled,
        "allowed_ips": setting.allowed_ips or "",
        "client_detected_ip": detected_ip,
        "updated_at": setting.updated_at.isoformat() if setting.updated_at else None
    }


@protected_router.post("/network-settings")
def update_network_settings(data: NetworkSettingUpdate, db: Session = Depends(get_db)):
    setting = db.query(models.NetworkSetting).first()
    if not setting:
        setting = models.NetworkSetting()
        db.add(setting)

    raw_ips = re.split(r'[,\n\r]+', data.allowed_ips)
    cleaned_ips = [ip.strip() for ip in raw_ips if ip.strip()]

    setting.wifi_validation_enabled = data.wifi_validation_enabled
    setting.allowed_ips = ", ".join(cleaned_ips)
    db.commit()
    db.refresh(setting)

    return {
        "message": "Configuración de red guardada exitosamente.",
        "wifi_validation_enabled": setting.wifi_validation_enabled,
        "allowed_ips": setting.allowed_ips
    }
