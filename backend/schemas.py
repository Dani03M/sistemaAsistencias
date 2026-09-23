from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

# ----- Esquemas para Login -----
class UserLogin(BaseModel):
    dni: str
    password: str
    device_fingerprint: str
    device_name: str # ej. "Chrome en Windows"

class Token(BaseModel):
    access_token: Optional[str] = None
    token_type: str
    user_id: int
    is_admin: bool
    device_approved: bool

# ----- Esquemas para Asistencia -----
class AttendanceScan(BaseModel):
    totp_code: str
    device_fingerprint: str

class AttendanceResponse(BaseModel):
    status: str
    message: str
    record_type: Optional[str] = None
    attendance_status: Optional[str] = None  # "PUNTUAL", "TARDANZA", "SALIDA"
    tardiness_minutes: Optional[int] = 0
    hours_worked: Optional[float] = None
    timestamp: Optional[datetime] = None

# ----- Esquemas Generales -----
class UserOut(BaseModel):
    id: int
    name: str
    dni: str
    is_admin: bool
    work_start_time: Optional[str] = "08:00"
    work_end_time: Optional[str] = "17:00"
    tolerance_minutes: Optional[int] = 15

    class Config:
        from_attributes = True

class DeviceOut(BaseModel):
    id: int
    device_name: Optional[str] = None
    is_approved: bool
    created_at: datetime

    class Config:
        from_attributes = True

# ----- Esquemas para Empleados -----
class EmployeeCreate(BaseModel):
    name: str
    dni: str
    password: str
    work_start_time: Optional[str] = "08:00"
    work_end_time: Optional[str] = "17:00"
    tolerance_minutes: Optional[int] = 15
    is_active: Optional[bool] = True

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    dni: Optional[str] = None
    password: Optional[str] = None
    work_start_time: Optional[str] = None
    work_end_time: Optional[str] = None
    tolerance_minutes: Optional[int] = None
    is_active: Optional[bool] = None
