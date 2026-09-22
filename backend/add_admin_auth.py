import os

backend_dir = r"c:\Users\mig13\Videos\asistenciaConver\backend"
auth_file = os.path.join(backend_dir, 'auth.py')

with open(auth_file, 'r', encoding='utf-8') as f:
    content = f.read()

admin_auth_code = """
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
        return dni
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")
"""

if "get_current_admin_user" not in content:
    with open(auth_file, 'a', encoding='utf-8') as f:
        f.write(admin_auth_code)

print("get_current_admin_user agregado a auth.py")
