import os

backend_dir = r"c:\Users\mig13\Videos\asistenciaConver\backend"
routes_file = os.path.join(backend_dir, 'admin_routes.py')

with open(routes_file, 'r', encoding='utf-8') as f:
    content = f.read()

admin_login_endpoint = """
from pydantic import BaseModel
class AdminLogin(BaseModel):
    dni: str
    password: str

@router.post("/login")
def admin_login(data: AdminLogin, db: Session = Depends(get_db)):
    import auth
    user = db.query(models.User).filter(models.User.dni == data.dni).first()
    if not user or not auth.verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="DNI o contraseña incorrectos")
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="No tienes permisos de administrador")
    
    access_token = auth.create_access_token(data={"sub": user.dni, "admin": True})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "name": user.name
    }
"""

if "@router.post(\"/login\")" not in content:
    content = content.replace("router = APIRouter(prefix=\"/api/admin\", tags=[\"Admin\"])", "router = APIRouter(prefix=\"/api/admin\", tags=[\"Admin\"])\n" + admin_login_endpoint)
    with open(routes_file, 'w', encoding='utf-8') as f:
        f.write(content)
