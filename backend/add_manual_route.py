import re

content = open('admin_routes.py', 'r', encoding='utf-8').read()

new_route = """
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone

class ManualAttendance(BaseModel):
    employee_id: int
    timestamp: str
    record_type: str

@protected_router.post("/attendance/manual")
def add_manual_attendance(data: ManualAttendance, db: Session = Depends(get_db)):
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
"""

if "@protected_router.post(\"/attendance/manual\")" not in content:
    content = content.replace("@protected_router.get(\"/attendance\")", new_route + "\n\n@protected_router.get(\"/attendance\")")
    open('admin_routes.py', 'w', encoding='utf-8').write(content)
    print("Added route")
else:
    print("Already exists")
