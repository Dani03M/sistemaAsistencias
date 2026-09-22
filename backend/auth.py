import os
from datetime import datetime, timedelta, timezone
from typing import Optional
import pyotp
import jwt  # PyJWT, no python-jose
import bcrypt
from dotenv import load_dotenv

load_dotenv()

# Configuraciones de seguridad
SECRET_KEY = os.environ.get("SECRET_KEY")
if not SECRET_KEY:
    import sys
    print("FATAL: SECRET_KEY no configurada en variables de entorno.")
    sys.exit(1)
    
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30  # 30 minutos de sesión

# El "Secreto del Kiosco" es la semilla matemática para los Códigos QR dinámicos.
# Usamos una semilla fija (derivada de SECRET_KEY) para que sobreviva reinicios del servidor.
# En producción, esto debería configurarse como variable de entorno separada.
KIOSK_TOTP_SECRET = os.environ.get("KIOSK_TOTP_SECRET")
if not KIOSK_TOTP_SECRET:
    import sys
    print("FATAL: KIOSK_TOTP_SECRET no configurada en variables de entorno.")
    sys.exit(1)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_qr_totp(totp_code: str) -> bool:
    """Verifica si el código TOTP del QR dinámico es válido (cambia cada 10 segundos)."""
    totp = pyotp.TOTP(KIOSK_TOTP_SECRET, interval=10)
    # valid_window=1 permite un ligero margen de error (10 segundos hacia atrás o adelante)
    # por si el celular del usuario tiene un ligero retraso de red al escanear.
    return totp.verify(totp_code, valid_window=1)


def get_current_qr_data() -> str:
    """Devuelve el código TOTP actual para mostrar en el QR del kiosco."""
    totp = pyotp.TOTP(KIOSK_TOTP_SECRET, interval=10)
    return totp.now()

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
import models
from database import get_db

security = HTTPBearer()

def get_current_admin_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        dni: str = payload.get("sub")
        is_admin: bool = payload.get("admin")
        if dni is None or not is_admin:
            raise HTTPException(status_code=403, detail="Permisos insuficientes")
            
        user = db.query(models.User).filter(models.User.dni == dni).first()
        if not user or not user.is_active or not user.is_admin:
            raise HTTPException(status_code=403, detail="Cuenta desactivada o sin permisos")
            
        return dni
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        dni: str = payload.get("sub")
        if dni is None:
            raise HTTPException(status_code=401, detail="Token inválido")
        user = db.query(models.User).filter(models.User.dni == dni).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        if not user.is_active:
            raise HTTPException(status_code=403, detail="Tu cuenta está desactivada. Contacta a RRHH.")
        return user
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")
