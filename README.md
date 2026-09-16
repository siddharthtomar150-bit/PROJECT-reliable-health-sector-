# 🏥 Affordable Hospital Finder

> **Helping families make the right healthcare decision at the right time.**

Affordable Hospital Finder is a healthcare discovery platform designed to help patients and caregivers find emergency, government, and private hospitals based on real medical needs, budgetary constraints, and geographical proximity. By combining directory listings, bed telemetry, government health scheme (PM-JAY) empanelment information, and emergency SOS services, the platform helps eliminate guesswork during medical emergencies.

---

## 📌 Current Status

**Working Model / Prototype:** This project was developed as a working prototype for a hackathon demonstration in a short timeframe. While core search, triage, mapping, emergency ambulance dispatch, and hospital detail views are functional, several advanced features (such as live hospital EHR synchronization and automated scheme eligibility verification) are mock-simulated or planned for future development.

---

## ✅ What's Actually Working Right Now

- **Hospital Search & Filtering:** Search by keyword, city, district, state, hospital type (Government / Private), emergency ICU availability, and maximum budget.
- **Real Hospital Data for Meerut:**
  - **30,327 total hospitals** loaded in the database across India.
  - **238 hospitals** in Meerut district.
  - **8 fully verified hospitals** (`data_confidence = "Full"`) with confirmed addresses, phone numbers, OPD timings, and PM-JAY / NABH status.
  - **33 name-verified hospitals** (`data_confidence = "Name-only-verify"`) with confirmed real institutional names in Meerut, with missing fields cleanly marked as "Details Pending" rather than showing fake or broken data.
- **Emergency Ambulance Dispatch (108 ALS):** Dedicated workflow to request emergency life-support ambulances with pickup/drop locations and driver dispatch telemetry.
- **Interactive Geospatial Map:** Leaflet.js / OpenStreetMap integration displaying hospitals with color-coded bed availability pins and direct Google Maps navigation links.
- **Transparent OPD Token Generator:** Digital appointment slips with reporting time slots, queue estimates, and printable e-Pass vouchers.
- **Side-by-Side Hospital Comparison:** Compare up to 4 hospitals simultaneously across ICU beds, standard treatment tariffs, PM-JAY coverage, and distance.
- **24x7 Blood Bank & SOS Network:** Real-time stock monitor for 8 blood groups across critical components (PRBC, Whole Blood, Platelets, FFP), active SOS blood request broadcast, and voluntary donor registry.
- **Patient Health Locker & Digital KYC:** Support for ABHA / PM-JAY Golden Card verification and encrypted clinical records storage.
- **Hospital Admin Operations Dashboard:** Portal (`/admin.html`) allowing authorized hospital staff to manage live bed occupancies, doctors, and treatments.
- **Mobile-Responsive UI:** Responsive design optimized for smartphones, tablets, and desktop displays.

---

## 🚧 What's NOT Built Yet (Future Roadmap)

- **Automated Scheme Eligibility Checker:** Currently, PM-JAY empanelment is displayed, but automated eligibility verification via Aadhaar/Ration Card integration is not yet connected to official NHA APIs.
- **Hospital Self-Service Partner Portal:** Currently, administrator updates are done via the demo `/admin.html` dashboard. A self-service onboarding and verification portal where hospitals claim and verify their own listings is planned.
- **Payments & Subscriptions:** The app does not process live monetary payments; consultation fees and booking fares are informational estimates.
- **Full Verification of National Records:** While Meerut has localized confidence levels (`Full` vs. `Name-only-verify`), the remaining bulk national directory records are from central open datasets and require district-by-district verification.
- **Multi-City Deep Verification:** Specialized verified records are currently focused on Meerut; multi-tier verification needs expansion to other cities.
- **AI Recommendation Engine:** Current hospital triage and matching rely on deterministic rule-based filtering and SQL querying rather than an automated machine learning recommendation model.
- **Live Hospital EHR / FHIR Integration:** Bed counts and casualty wait times currently update via internal database state rather than live HL7/FHIR hospital telemetry feeds.

---

## 💻 Tech Stack

- **Backend:** Node.js (v18+, ES Modules) with Express.js REST API
- **Database:** SQLite (`database/hospital_finder.db`) using the `sqlite3` driver, schema auto-migration, and transactional CSV seeding
- **Frontend:** Vanilla JavaScript (ES6+), HTML5, Vanilla CSS3 (flexbox/grid, custom design system, no Tailwind framework), Leaflet.js for interactive mapping
- **Security & Middleware:** JSON Web Tokens (JWT) for authentication, bcryptjs for password hashing, AES-256-GCM field encryption, rate limiting, and security headers

---

## 📊 Data Sources & Accuracy Note

Hospital listings for Meerut city and district were compiled from publicly accessible records, including:
- Ayushman Bharat (PM-JAY) hospital empanelment lists
- Public healthcare directories (Practo, myupchar, Bajaj Finserv Health)
- District administrative directories (`meerut.nic.in`)
- Open Government Data (OGD) national healthcare directory

**Data Transparency:**
- Records tagged **`Full Verification`** have confirmed physical addresses, phone numbers, and working hours.
- Records tagged **`Details Pending / Name Verified`** have confirmed real hospital names operating in Meerut, but their contact numbers and departmental rosters are actively being verified. Missing data is stored as empty/null and clearly indicated to the user—no data is guessed or fabricated.

---

## 🚀 How to Run It Locally

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18 or higher)
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/hospital-finder.git
cd hospital-finder
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the root directory by copying the sample template:

On Windows (PowerShell):
```powershell
Copy-Item .env.example .env
```
On Linux / macOS:
```bash
cp .env.example .env
```

Open `.env` and configure the variables (the app runs out-of-the-box in development mode with defaults):

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Security Secrets
JWT_SECRET=your_jwt_secret_key_here
PATIENT_DATA_ENCRYPTION_KEY=your_32_byte_aes_256_key_here

# Legacy / Experimental Database (Optional)
DATABASE_URL=postgresql://username:password@localhost:5432/hospital_db

# Optional Third-Party Services
GOOGLE_MAPS_API_KEY=your_google_maps_key_optional
FAST2SMS_API_KEY=your_fast2sms_api_key_here
TWILIO_ACCOUNT_SID=your_twilio_account_sid_here
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

### 4. Start the Application
```bash
npm start
```
The server will initialize the SQLite database, apply any pending migrations, and start listening on **http://localhost:5000**.

### 5. Open in Browser
- **Patient Discovery Portal:** [http://localhost:5000](http://localhost:5000)
- **Hospital Admin Portal:** [http://localhost:5000/admin.html](http://localhost:5000/admin.html)

#### Demo Patient Login
- **Email:** `patient@medigo.com`
- **Password:** `patient123`

---

## 📁 Folder Structure

```text
hospital-finder-main/
│
├── frontend/                     # Client-side user interface (served by Express)
│   ├── index.html                # Patient discovery portal & search UI
│   ├── admin.html                # Hospital administrator operations dashboard
│   ├── styles.css                # Patient portal styling & responsive design
│   ├── admin.css                 # Admin dashboard styling
│   ├── app.js                    # Application coordinator & state manager
│   ├── patient.js                # Hospital card rendering, modals & comparison
│   ├── blood_bank.js             # Blood bank inventory, SOS & donor network
│   └── hospital.js               # Telemetry and hospital profile helpers
│
├── backend/                      # Node.js Express REST API
│   ├── server.js                 # Primary server entrypoint & route handlers
│   ├── middleware/
│   │   └── security_middleware.js # Rate limiting, XSS filters, security headers
│   └── utils/
│       ├── security_crypto.js    # AES-256 data encryption & masking utilities
│       └── schemes_catalog.js    # Health schemes validation rules
│
├── database/                     # Active data store & seed assets
│   ├── database.js               # SQLite manager, migrations & seeders
│   ├── data.js                   # Clinical triage, symptom & initial seed data
│   ├── hospital_finder.db        # Active SQLite database file
│   ├── hospital_directory.csv    # National hospital directory dataset (30k+ records)
│   └── meerut-hospitals-expanded-38.csv # Curated Meerut hospital dataset
│
├── .env                          # Local environment configuration (untracked)
├── .env.example                  # Environment variable template
├── package.json                  # Node.js scripts and project dependencies
├── Dockerfile                    # Containerization instructions
└── README.md                     # Project documentation
```

---

## 👥 Team

- **Siddharth Tomar** — *Idea, Project Conception & Lead Development* ([siddharthtomar150@gmail.com](mailto:siddharthtomar150@gmail.com))

---

## ⚠️ Medical & Legal Disclaimer

This application is an informational tool and decision-support prototype. It does **not** provide medical diagnosis, does **not** replace consultation with qualified healthcare professionals, and does **not** guarantee exact treatment costs or bed availability. All clinical costs, wait times, and bed capacities are estimates or periodic updates. In the event of a life-threatening medical emergency, call **108** or proceed immediately to the nearest hospital casualty department.#   P R O J E C T - r e l i a b l e - h e a l t h - s e c t o r -  
 