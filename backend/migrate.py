import database
from sqlalchemy import text

db = database.SessionLocal()

try:
    db.execute(text("ALTER TABLE attendance_records ADD COLUMN ip_address VARCHAR(50);"))
    print("Added ip_address column")
except Exception as e:
    print(e)
    
try:
    db.execute(text("ALTER TABLE attendance_records ADD COLUMN network_validated BOOLEAN;"))
    print("Added network_validated column")
except Exception as e:
    print(e)

db.commit()
print("Migration complete")
