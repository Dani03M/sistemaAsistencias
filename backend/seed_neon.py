import os, sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import models, auth

engine = create_engine(os.environ["DATABASE_URL"], pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

def seed_db():
    if not db.query(models.NetworkSetting).first():
        db.add(models.NetworkSetting(
            wifi_validation_enabled=False,
            allowed_ips=""
        ))
        db.commit()

    if not db.query(models.User).filter(models.User.email == "rlimasguerra19@gmail.com").first():
        new_admin = models.User(
            name="Super Admin",
            dni="88888888",
            email="rlimasguerra19@gmail.com",
            password_hash=auth.get_password_hash("Z016oXBdFn0vtX0I"),
            is_admin=True,
            is_active=True,
            work_start_time="08:00",
            work_end_time="17:00",
            tolerance_minutes=15
        )
        db.add(new_admin)
        
    if not db.query(models.User).filter(models.User.email == "superaureliocontinental@gmail.com").first():
        new_admin2 = models.User(
            name="Aurelio",
            dni="77777777",
            email="superaureliocontinental@gmail.com",
            password_hash=auth.get_password_hash("Xk9mTpL2vR7w"),
            is_admin=True,
            is_active=True,
            work_start_time="08:00",
            work_end_time="17:00",
            tolerance_minutes=15
        )
        db.add(new_admin2)
        
    db.commit()
    print("Database seeded!")

seed_db()
db.close()

