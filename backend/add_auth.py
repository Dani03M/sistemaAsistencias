import os

backend_dir = r"c:\Users\mig13\Videos\asistenciaConver\backend"
routes_file = os.path.join(backend_dir, 'admin_routes.py')

with open(routes_file, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if line.startswith('router = APIRouter'):
        new_lines.append('import auth\n')
        new_lines.append('router = APIRouter(prefix="/api/admin", tags=["Admin"])\n')
        new_lines.append('protected_router = APIRouter(prefix="/api/admin", tags=["Admin"], dependencies=[Depends(auth.get_current_admin_user)])\n')
    elif line.startswith('@router.') and not line.startswith('@router.post("/login")'):
        new_lines.append(line.replace('@router.', '@protected_router.'))
    else:
        new_lines.append(line)

with open(routes_file, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

# Also need to update main.py to include protected_router
main_file = os.path.join(backend_dir, 'main.py')
with open(main_file, 'r', encoding='utf-8') as f:
    main_content = f.read()

if "admin_routes.protected_router" not in main_content:
    main_content = main_content.replace('app.include_router(admin_routes.router)', 
        'app.include_router(admin_routes.router)\napp.include_router(admin_routes.protected_router)')
    with open(main_file, 'w', encoding='utf-8') as f:
        f.write(main_content)

print("Auth agregada a admin_routes.py")
