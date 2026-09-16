# pyrefly: ignore [missing-import]
from fastapi import FastAPI, Depends, Query, UploadFile, File, HTTPException
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session
# pyrefly: ignore [missing-import]
from sqlalchemy import or_, and_
from typing import Optional, List
import os
import shutil

from database_pg import init_db, get_db, HospitalModel

app = FastAPI(
    title="MediGo Healthcare API",
    description="FastAPI REST API powering Smart Hospital Finder with real PostgreSQL hospital data",
    version="1.0.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database on startup
@app.on_event("startup")
def startup_db_init():
    init_db()

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "MediGo FastAPI Hospital Search Service",
        "docs_url": "/docs"
    }

# ==================== METADATA API ====================

@app.get("/api/hospitals/meta")
def get_hospitals_meta(db: Session = Depends(get_db)):
    """Return unique States, Cities, and District mappings."""
    states_query = db.query(HospitalModel.state).filter(HospitalModel.state.isnot(None), HospitalModel.state != "").distinct().order_by(HospitalModel.state.asc()).all()
    cities_query = db.query(HospitalModel.state, HospitalModel.city).filter(HospitalModel.city.isnot(None), HospitalModel.city != "").distinct().order_by(HospitalModel.city.asc()).all()

    states = [s[0] for s in states_query]
    districts_by_state = {}

    for state_val, city_val in cities_query:
        if state_val and city_val:
            if state_val not in districts_by_state:
                districts_by_state[state_val] = []
            if city_val not in districts_by_state[state_val]:
                districts_by_state[state_val].append(city_val)

    return {
        "states": states,
        "districtsByState": districts_by_state
    }

# ==================== SEARCH HOSPITALS API ====================

@app.get("/api/hospitals")
def search_hospitals(
    name: Optional[str] = Query(None, description="Search by Hospital Name"),
    city: Optional[str] = Query(None, description="Filter by City / District"),
    state: Optional[str] = Query(None, description="Filter by State"),
    max_budget: Optional[int] = Query(None, alias="maxBudget", description="Max Treatment Budget"),
    specialty: Optional[str] = Query(None, description="Filter by Medical Specialty"),
    emergency_only: Optional[bool] = Query(None, alias="emergency", description="Only show ICU / Emergency available"),
    type: Optional[str] = Query(None, description="Hospital Type: 'government' | 'private'"),
    search: Optional[str] = Query(None, description="General keyword search across name, city, state, pincode, specialty"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Search & filter hospitals by Name, City, State, Budget, Specialty, and Emergency Services.
    """
    query = db.query(HospitalModel)

    # 1. Filter by Name
    if name and name.strip():
        query = query.filter(HospitalModel.name.ilike(f"%{name.strip()}%"))

    # 2. Filter by City
    if city and city.strip() and city.lower() != "all":
        query = query.filter(HospitalModel.city.ilike(f"%{city.strip()}%"))

    # 3. Filter by State
    if state and state.strip() and state.lower() != "all":
        query = query.filter(HospitalModel.state.ilike(f"%{state.strip()}%"))

    # 4. Filter by Budget
    if max_budget is not None and max_budget > 0:
        query = query.filter(
            or_(
                HospitalModel.estimated_avg_cost.is_(None),
                HospitalModel.estimated_avg_cost <= max_budget
            )
        )

    # 5. Filter by Specialty
    if specialty and specialty.strip() and specialty.lower() != "all":
        query = query.filter(HospitalModel.specialties.ilike(f"%{specialty.strip()}%"))

    # 6. Filter by Emergency availability
    if emergency_only is True:
        query = query.filter(HospitalModel.emergency_available == True)

    # 7. Filter by Hospital Sector Type (Government / Private)
    if type and type.strip() and type.lower() != "all":
        if type.lower() == "government":
            query = query.filter(HospitalModel.hospital_type == "Government")
        elif type.lower() == "private":
            query = query.filter(or_(HospitalModel.hospital_type == "Private", HospitalModel.hospital_type.is_(None)))

    # 8. General search keyword across fields
    if search and search.strip():
        q_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                HospitalModel.name.ilike(q_term),
                HospitalModel.address.ilike(q_term),
                HospitalModel.city.ilike(q_term),
                HospitalModel.state.ilike(q_term),
                HospitalModel.pincode.ilike(q_term),
                HospitalModel.specialties.ilike(q_term)
            )
        )

    results = query.offset(offset).limit(limit).all()
    return [h.to_dict() for h in results]

# ==================== SINGLE HOSPITAL PROFILE API ====================

@app.get("/api/hospitals/{hospital_id}")
def get_hospital_detail(hospital_id: str, db: Session = Depends(get_db)):
    """Get single hospital details by ID."""
    # Extract raw numeric ID if prefixed e.g. hosp-pg-123
    try:
        raw_id = int(hospital_id.replace("hosp-pg-", "").replace("hosp-csv-", ""))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid hospital ID format.")

    hospital = db.query(HospitalModel).filter(HospitalModel.id == raw_id).first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found.")

    return hospital.to_dict()

# ==================== PDF UPLOAD & IMPORT API ====================

@app.post("/api/import-pdf")
def upload_pdf_and_import(file: UploadFile = File(...)):
    """Upload a PDF file and extract/import hospital records into the database."""
    if not file.filename.endswith(".pdf") and not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only PDF and CSV files are allowed.")

    temp_path = f"temp_upload_{file.filename}"
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        from import_pdf import import_file
        count = import_file(temp_path)

        return {
            "message": f"File '{file.filename}' processed successfully.",
            "imported_records": count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF import error: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
