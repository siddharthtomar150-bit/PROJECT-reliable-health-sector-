import os
import socket
from datetime import datetime
from urllib.parse import urlparse
# pyrefly: ignore [missing-import]
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, Text, DateTime, text
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import declarative_base, sessionmaker

# Default PostgreSQL Connection URL (can be overridden via environment variable DATABASE_URL)
POSTGRES_DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/hospital_db")
SQLITE_FALLBACK_URL = "sqlite:///./hospital_pg_fallback.db"

Base = declarative_base()

class HospitalModel(Base):
    __tablename__ = "hospitals"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), index=True, nullable=False)
    address = Column(Text, nullable=True)
    city = Column(String(100), index=True, nullable=True)
    state = Column(String(100), index=True, nullable=True)
    pincode = Column(String(20), nullable=True)
    phone = Column(String(100), nullable=True)
    hospital_type = Column(String(50), nullable=True)  # 'Government' | 'Private'
    specialties = Column(Text, nullable=True)
    emergency_available = Column(Boolean, nullable=True)
    estimated_avg_cost = Column(Integer, nullable=True)
    icu_beds_available = Column(Integer, nullable=True)
    rating = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.now)

    def to_dict(self):
        clean_facilities = []
        if self.specialties:
            clean_facilities = [f.strip() for f in self.specialties.replace("\n", ",").split(",") if f.strip() and f.strip() != "0"]
        if not clean_facilities:
            clean_facilities = ["Emergency Services", "OPD", "Pharmacy", "Diagnostic Services"]

        return {
            "id": f"hosp-pg-{self.id}",
            "raw_id": self.id,
            "name": self.name,
            "tagline": f"{self.specialties or 'Multi-Specialty'} Healthcare Facility",
            "badge": f"🏛️ {self.hospital_type} Hospital" if self.hospital_type == 'Government' else f"🏥 {self.hospital_type or 'Private'} Hospital",
            "type": "government" if self.hospital_type == "Government" else "private",
            "rating": self.rating if self.rating is not None else 4.5,
            "reviewCount": 35,
            "distanceKm": 2.5,
            "location": ", ".join(filter(None, [self.address, self.city, self.state, self.pincode])) or "Location N/A",
            "city": self.city,
            "state": self.state,
            "pincode": self.pincode,
            "phone": self.phone or "N/A",
            "specialties": self.specialties,
            "emergencyAvailable": bool(self.emergency_available) if self.emergency_available is not None else True,
            "estimatedAvgCost": self.estimated_avg_cost if self.estimated_avg_cost is not None else 15000,
            "beds": {
                "icu": {"total": 10, "available": self.icu_beds_available if self.icu_beds_available is not None else 3},
                "emergency": {"total": 15, "available": 5},
                "general": {"total": 50, "available": 20}
            },
            "opdWaitTimeMins": 20,
            "treatments": [
                {"id": f"t1-{self.id}", "name": "General Surgery", "category": "Surgery", "cost": self.estimated_avg_cost or 15000, "duration": "2 Days"}
            ],
            "doctors": [],
            "facilities": clean_facilities[:5],
            "ambulanceUnits": [
                {"id": f"amb-{self.id}", "type": "Normal", "vehicleNo": "DL 01 AB 1234", "driver": "Driver", "phone": self.phone or "+91 108", "ratePerKm": 20}
            ]
        }

def is_db_reachable(db_url):
    if not db_url or not db_url.startswith("postgresql"):
        return False
    try:
        parsed = urlparse(db_url)
        host = parsed.hostname or "localhost"
        port = parsed.port or 5432
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(0.5)
        result = sock.connect_ex((host, port))
        sock.close()
        return result == 0
    except Exception:
        return False

engine = None
if is_db_reachable(POSTGRES_DB_URL):
    try:
        engine = create_engine(POSTGRES_DB_URL, pool_pre_ping=True)
        print(f"Connected to PostgreSQL database at {POSTGRES_DB_URL}")
    except Exception:
        engine = create_engine(SQLITE_FALLBACK_URL, connect_args={"check_same_thread": False})
        print(f"Using database engine: SQLite ({SQLITE_FALLBACK_URL})")
else:
    print(f"Using database engine: SQLite ({SQLITE_FALLBACK_URL})")
    engine = create_engine(SQLITE_FALLBACK_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)
    
    # Run column migrations for existing PostgreSQL / SQLite tables
    with engine.begin() as conn:
        try:
            if "postgresql" in str(engine.url):
                conn.execute(text("ALTER TABLE hospitals DROP CONSTRAINT IF EXISTS hospitals_id_fkey"))
                conn.execute(text("CREATE SEQUENCE IF NOT EXISTS hospitals_id_seq"))
                conn.execute(text("ALTER TABLE hospitals ALTER COLUMN id SET DEFAULT nextval('hospitals_id_seq')"))
        except Exception:
            pass

        cols_to_add = [
            ("city", "VARCHAR(100)"),
            ("state", "VARCHAR(100)"),
            ("pincode", "VARCHAR(20)"),
            ("phone", "VARCHAR(100)"),
            ("hospital_type", "VARCHAR(50)"),
            ("specialties", "TEXT"),
            ("emergency_available", "BOOLEAN"),
            ("estimated_avg_cost", "INTEGER"),
            ("icu_beds_available", "INTEGER"),
            ("rating", "FLOAT"),
            ("created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
        ]
        for col_name, col_type in cols_to_add:
            try:
                conn.execute(text(f"ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS {col_name} {col_type}"))
            except Exception:
                pass
    print("Database tables & schema verified successfully.")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
