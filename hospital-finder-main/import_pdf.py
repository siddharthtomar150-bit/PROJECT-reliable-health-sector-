import sys
import os
import re
import csv
from database_pg import SessionLocal, HospitalModel, init_db

# Clean string or return None if empty/zero/placeholder
def clean_str(val):
    if val is None:
        return None
    s = str(val).strip()
    if s == "" or s.lower() in ["0", "null", "none", "nan", "undefined", "n/a"]:
        return None
    return s

# Clean integer or return None
def clean_int(val):
    if val is None:
        return None
    try:
        num = int(float(str(val).strip()))
        return num if num > 0 else None
    except Exception:
        return None

# Parse phone number or return None
def clean_phone(val):
    s = clean_str(val)
    if not s:
        return None
    # Filter out zero placeholders like "0" or "0000"
    digits_only = re.sub(r'\D', '', s)
    if not digits_only or re.match(r'^0+$', digits_only):
        return None
    return s

# Determine hospital type: 'Government' | 'Private' | None
def clean_hospital_type(category):
    s = clean_str(category)
    if not s:
        return None
    s_lower = s.lower()
    if any(kw in s_lower for kw in ["public", "government", "govt", "aiims", "medical college"]):
        return "Government"
    if any(kw in s_lower for kw in ["private", "pvt", "trust", "society", "limited", "ltd"]):
        return "Private"
    return None

# Determine emergency availability: True | False | None
def clean_emergency(val):
    if val is None:
        return None
    s = str(val).strip().lower()
    if any(kw in s for kw in ["true", "1", "yes", "available", "24x7", "emergency"]):
        return True
    if any(kw in s for kw in ["false", "0", "no", "unavailable"]):
        return False
    return None

# Extract records from PDF using pypdf or line text parsing
def extract_records_from_pdf(pdf_path):
    records = []
    text_content = ""

    # Try using pypdf
    try:
        # pyrefly: ignore [missing-import]
        from pypdf import PdfReader 
        reader = PdfReader(pdf_path)
        for page in reader.pages:
            t = page.extract_text()
            if t:
                text_content += t + "\n"
    except Exception as e:
        print(f"pypdf extraction notice: {e}")

    if not text_content.strip():
        # Fallback to reading raw file text
        try:
            with open(pdf_path, "r", encoding="utf-8", errors="ignore") as f:
                text_content = f.read()
        except Exception:
            pass

    # Parse hospital records from extracted text
    lines = [line.strip() for line in text_content.split("\n") if line.strip()]
    
    current_rec = {}
    for line in lines:
        line_lower = line.lower()
        if any(kw in line_lower for kw in ["hospital", "medical center", "nursing home", "clinic", "health centre", "institute"]):
            if current_rec and "name" in current_rec:
                records.append(current_rec)
            current_rec = {"name": line}
        elif current_rec:
            if "phone" not in current_rec and re.search(r'(\+91[\s-]?)?\d{10}|\d{3,5}[\s-]\d{6,8}', line):
                current_rec["phone"] = line
            elif "pincode" not in current_rec and re.search(r'\b\d{6}\b', line):
                current_rec["pincode"] = re.search(r'\b\d{6}\b', line).group(0)
            elif "hospital_type" not in current_rec and any(kw in line_lower for kw in ["government", "public", "private", "trust"]):
                current_rec["hospital_type"] = line
            elif "specialties" not in current_rec and any(kw in line_lower for kw in ["cardiology", "surgery", "orthopedics", "pediatrics", "gynaecology", "ophthalmology", "general"]):
                current_rec["specialties"] = line
            elif "address" not in current_rec:
                current_rec["address"] = line

    if current_rec and "name" in current_rec:
        records.append(current_rec)

    return records

# Extract records from CSV dataset
def extract_records_from_csv(csv_path):
    records = []
    with open(csv_path, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rec = {
                "name": row.get("Hospital_Name"),
                "address": row.get("Address_Original_First_Line") or row.get("Location"),
                "city": row.get("District") or row.get("Town"),
                "state": row.get("State"),
                "pincode": row.get("Pincode"),
                "phone": row.get("Emergency_Num") or row.get("Ambulance_Phone_No") or row.get("Telephone") or row.get("Mobile_Number"),
                "hospital_type": row.get("Hospital_Category"),
                "specialties": row.get("Specialties"),
                "emergency_available": row.get("Emergency_Services") or row.get("Emergency_Num"),
                "estimated_avg_cost": row.get("Tariff_Range"),
                "icu_beds_available": row.get("Total_Num_Beds")
            }
            records.append(rec)
    return records

def import_file(file_path):
    init_db()

    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return 0

    ext = os.path.splitext(file_path)[1].lower()
    print(f"Reading and extracting hospital records from {file_path}...")

    if ext == ".csv":
        raw_records = extract_records_from_csv(file_path)
    elif ext == ".pdf":
        raw_records = extract_records_from_pdf(file_path)
    else:
        print(f"Unsupported file format: {ext}")
        return 0

    print(f"Extracted {len(raw_records)} raw records. Cleaning and deduplicating...")

    # Fetch existing records from DB to avoid duplicate insertion across runs
    db = SessionLocal()
    existing_keys = set()
    try:
        existing_rows = db.query(HospitalModel.name, HospitalModel.city, HospitalModel.state).all()
        for r_name, r_city, r_state in existing_rows:
            existing_keys.add(((r_name or "").lower(), (r_city or "").lower(), (r_state or "").lower()))
    except Exception as e:
        print(f"Notice querying existing records: {e}")

    cleaned_records = []
    seen_keys = set()

    for r in raw_records:
        name = clean_str(r.get("name"))
        if not name:
            continue

        city = clean_str(r.get("city"))
        state = clean_str(r.get("state"))
        
        # Deduplication Key: (name, city, state)
        dedup_key = (name.lower(), (city or "").lower(), (state or "").lower())
        if dedup_key in seen_keys or dedup_key in existing_keys:
            continue
        seen_keys.add(dedup_key)

        cleaned_item = {
            "name": name,
            "address": clean_str(r.get("address")),
            "city": city,
            "state": state,
            "pincode": clean_str(r.get("pincode")),
            "phone": clean_phone(r.get("phone")),
            "hospital_type": clean_hospital_type(r.get("hospital_type")),
            "specialties": clean_str(r.get("specialties")),
            "emergency_available": clean_emergency(r.get("emergency_available")),
            "estimated_avg_cost": clean_int(r.get("estimated_avg_cost")),
            "icu_beds_available": clean_int(r.get("icu_beds_available"))
        }

        cleaned_records.append(cleaned_item)

    print(f"{len(cleaned_records)} new unique hospital records to import.")

    if not cleaned_records:
        print("No new unique records to import (all records already in database).")
        db.close()
        return 0

    # Bulk insert into Database
    imported_count = 0
    try:
        for item in cleaned_records:
            hosp = HospitalModel(
                name=item["name"],
                address=item["address"],
                city=item["city"],
                state=item["state"],
                pincode=item["pincode"],
                phone=item["phone"],
                hospital_type=item["hospital_type"],
                specialties=item["specialties"],
                emergency_available=item["emergency_available"],
                estimated_avg_cost=item["estimated_avg_cost"],
                icu_beds_available=item["icu_beds_available"]
            )
            db.add(hosp)
            imported_count += 1

            if imported_count % 1000 == 0:
                db.commit()

        db.commit()
        print(f"Successfully imported {imported_count} real hospital records into Database!")
    except Exception as e:
        db.rollback()
        print(f"Error during database import: {e}")
    finally:
        db.close()

    return imported_count

if __name__ == "__main__":
    if len(sys.argv) > 1:
        import_file(sys.argv[1])
    else:
        # Default run on hospital_directory.csv if present
        import_file("hospital_directory.csv")
