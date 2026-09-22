import os
import glob

directory = r"c:\Users\mig13\Videos\asistenciaConver\frontend\src\components"
files = glob.glob(os.path.join(directory, "*.jsx"))

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Reemplazar URLs estáticas y dinámicas por URLs relativas al Proxy de Vite
    content = content.replace(
        "const API_URL = `http://${window.location.hostname}:8000/api`;",
        "const API_URL = '/api';"
    )
    content = content.replace(
        "const API_URL = `http://${window.location.hostname}:8000/api/admin`;",
        "const API_URL = '/api/admin';"
    )
    content = content.replace(
        "const API_URL = 'http://localhost:8000/api';",
        "const API_URL = '/api';"
    )
    content = content.replace(
        "const API_URL = 'http://localhost:8000/api/admin';",
        "const API_URL = '/api/admin';"
    )

    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)

print("Actualización de Proxy completada.")
