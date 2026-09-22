import datetime
from typing import Optional
from sqlalchemy import String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    dni: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True)
    work_start_time: Mapped[str] = mapped_column(String(10), default="08:00")  # Formato "HH:MM"
    work_end_time: Mapped[str] = mapped_column(String(10), default="17:00")    # Formato "HH:MM"
    tolerance_minutes: Mapped[int] = mapped_column(default=15)                 # Minutos de tolerancia

    # Relationships
    devices: Mapped[list["Device"]] = relationship("Device", back_populates="user")
    attendances: Mapped[list["AttendanceRecord"]] = relationship("AttendanceRecord", back_populates="user")
    justifications: Mapped[list["Justification"]] = relationship("Justification", back_populates="user")


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    fingerprint: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    device_name: Mapped[Optional[str]] = mapped_column(String(100))
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.timezone.utc)
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="devices")
    attendances: Mapped[list["AttendanceRecord"]] = relationship("AttendanceRecord", back_populates="device")


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    device_id: Mapped[Optional[int]] = mapped_column(ForeignKey("devices.id"))

    record_type: Mapped[str] = mapped_column(String(20))  # "ENTRADA" o "SALIDA"
    status: Mapped[str] = mapped_column(String(20), default="PUNTUAL")  # "PUNTUAL", "TARDANZA", "SALIDA"
    tardiness_minutes: Mapped[int] = mapped_column(default=0)  # Minutos de retraso
    hours_worked: Mapped[Optional[float]] = mapped_column(nullable=True, default=None)  # Horas laboradas en la jornada
    
    timestamp: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.timezone.utc), index=True
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="attendances")
    device: Mapped["Device"] = relationship("Device", back_populates="attendances")




class Justification(Base):
    __tablename__ = "justifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    justification_type: Mapped[str] = mapped_column(String(50))  # VACACIONES, DESCANSO_MEDICO, PERMISO, FERIADO, OTRO
    start_date: Mapped[str] = mapped_column(String(10))  # YYYY-MM-DD
    end_date: Mapped[str] = mapped_column(String(10))     # YYYY-MM-DD
    reason: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.timezone.utc)
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="justifications")

class NetworkSetting(Base):
    __tablename__ = "network_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    wifi_validation_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    allowed_ips: Mapped[str] = mapped_column(String(1000), default="")  # IPs públicas o subredes separadas por comas
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), 
        default=lambda: datetime.datetime.now(datetime.timezone.utc),
        onupdate=lambda: datetime.datetime.now(datetime.timezone.utc)
    )
