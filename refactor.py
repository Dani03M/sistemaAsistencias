import os

# 1. ACTUALIZACIONES BACKEND
backend_dir = r"c:\Users\mig13\Videos\asistenciaConver\backend"

# models.py
with open(os.path.join(backend_dir, 'models.py'), 'r', encoding='utf-8') as f:
    models = f.read()
models = models.replace("email = Column(String(100), unique=True, index=True)", "dni = Column(String(20), unique=True, index=True)")
with open(os.path.join(backend_dir, 'models.py'), 'w', encoding='utf-8') as f:
    f.write(models)

# schemas.py
with open(os.path.join(backend_dir, 'schemas.py'), 'r', encoding='utf-8') as f:
    schemas = f.read()
schemas = schemas.replace("email: str", "dni: str")
with open(os.path.join(backend_dir, 'schemas.py'), 'w', encoding='utf-8') as f:
    f.write(schemas)

# auth.py
with open(os.path.join(backend_dir, 'auth.py'), 'r', encoding='utf-8') as f:
    auth = f.read()
auth = auth.replace("User.email ==", "User.dni ==")
with open(os.path.join(backend_dir, 'auth.py'), 'w', encoding='utf-8') as f:
    f.write(auth)

# main.py
with open(os.path.join(backend_dir, 'main.py'), 'r', encoding='utf-8') as f:
    main = f.read()
main = main.replace('email="admin@empresa.com"', 'dni="admin"')
main = main.replace('email="admin@admin.com"', 'dni="admin"')
with open(os.path.join(backend_dir, 'main.py'), 'w', encoding='utf-8') as f:
    f.write(main)

# admin_routes.py
with open(os.path.join(backend_dir, 'admin_routes.py'), 'r', encoding='utf-8') as f:
    adminr = f.read()
adminr = adminr.replace("employee_email=device.user.email", "employee_email=device.user.dni") # kept variable name but data is dni
adminr = adminr.replace("employee_email=record.user.email", "employee_email=record.user.dni")
adminr = adminr.replace("email=user.email", "email=user.dni")
with open(os.path.join(backend_dir, 'admin_routes.py'), 'w', encoding='utf-8') as f:
    f.write(adminr)


# 2. ACTUALIZACIONES FRONTEND
frontend_dir = r"c:\Users\mig13\Videos\asistenciaConver\frontend\src"

# AdminEmployees.jsx
with open(os.path.join(frontend_dir, 'components', 'AdminEmployees.jsx'), 'r', encoding='utf-8') as f:
    emp = f.read()
emp = emp.replace("Correo electrónico", "DNI")
emp = emp.replace("Correo", "DNI")
emp = emp.replace("email:", "dni:")
emp = emp.replace("setEmail(", "setDni(")
emp = emp.replace("email, ", "dni, ")
emp = emp.replace("[email, ", "[dni, ")
emp = emp.replace("employee.email", "employee.email") # will be rendered as DNI
with open(os.path.join(frontend_dir, 'components', 'AdminEmployees.jsx'), 'w', encoding='utf-8') as f:
    f.write(emp)

# Login.jsx
with open(os.path.join(frontend_dir, 'components', 'Login.jsx'), 'r', encoding='utf-8') as f:
    login = f.read()
login = login.replace("email", "dni")
login = login.replace("Email", "DNI")
login = login.replace("Correo Electrónico", "DNI del Empleado")
login = login.replace("Mail", "User")
login = login.replace("tu-correo@empresa.com", "Ej. 12345678")
login = login.replace("type=\"email\"", "type=\"text\"")
login = login.replace("Vincular tu dispositivo para marcar asistencia", "Ingresa tu DNI y vincula tu celular")
with open(os.path.join(frontend_dir, 'components', 'Login.jsx'), 'w', encoding='utf-8') as f:
    f.write(login)

# App.jsx
with open(os.path.join(frontend_dir, 'App.jsx'), 'r', encoding='utf-8') as f:
    app = f.read()
app = app.replace("Vincular Celular", "Portal del Empleado")
app = app.replace("Login y registro de dispositivo", "Ingresa y marca tu asistencia")
# Remove Scanner link logic (we'll just use string replacement or sed)
import re
app = re.sub(r'<Link to="/scanner".*?</Link>', '', app, flags=re.DOTALL)
with open(os.path.join(frontend_dir, 'App.jsx'), 'w', encoding='utf-8') as f:
    f.write(app)

print("Refactor completado!")
