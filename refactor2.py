import os
import re

backend_dir = r"c:\Users\mig13\Videos\asistenciaConver\backend"

for file in os.listdir(backend_dir):
    if file.endswith('.py'):
        path = os.path.join(backend_dir, file)
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        content = content.replace("email", "dni")
        content = content.replace("Email", "DNI")
        content = content.replace("EMAIL", "DNI")
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)

print("Backend email replaced with dni")
