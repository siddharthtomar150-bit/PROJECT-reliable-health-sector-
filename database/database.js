import sqlite3 from 'sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { INITIAL_HOSPITALS, INITIAL_BOOKINGS, SAMPLE_HEALTH_RECORDS } from './data.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, 'hospital_finder.db');

// Enable verbose mode for debugging
const sqlite3Verbose = sqlite3.verbose();
const db = new sqlite3Verbose.Database(dbPath);

// Helper functions for Promises
export function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

// DPDP / HIPAA Compliant Audit Logger
export async function logPrivacyAudit(userId, actorName, actorRole, action, details = '', ipAddress = '127.0.0.1', status = 'SUCCESS') {
  try {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await dbRun(`
      INSERT INTO privacy_audit_logs (user_id, actor_name, actor_role, action, details, ip_address, timestamp, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [userId, actorName, actorRole, action, details, ipAddress, timestamp, status]);
  } catch (err) {
    console.error('Failed to write privacy audit log:', err);
  }
}


// RFC 4180 compliant CSV parser
function parseCSV(text) {
  const rows = [];
  let currentRow = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentVal.trim());
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentVal.trim());
      currentVal = '';
      if (currentRow.length > 1 || currentRow[0] !== '') {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentVal += char;
    }
  }

  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    rows.push(currentRow);
  }

  return rows;
}

export async function initDb() {
  try {
    console.log('Checking database tables...');

    // 1. Create Users Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        hospital_id TEXT
      )
    `);

    // 2. Create Hospitals Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS hospitals (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        tagline TEXT,
        badge TEXT,
        type TEXT,
        rating REAL,
        review_count INTEGER,
        distance_km REAL,
        location TEXT,
        lat REAL,
        lng REAL,
        phone TEXT,
        emergency_available INTEGER,
        estimated_avg_cost INTEGER,
        icu_total INTEGER,
        icu_available INTEGER,
        emergency_total INTEGER,
        emergency_beds_available INTEGER,
        general_total INTEGER,
        general_available INTEGER,
        opd_wait_time_mins INTEGER,
        state TEXT,
        district TEXT,
        pincode TEXT,
        specialties TEXT,
        facilities_str TEXT
      )
    `);

    // Ensure columns exist if table was created previously without new columns
    const columns = await dbAll("PRAGMA table_info(hospitals)");
    const colNames = columns.map(c => c.name);
    if (!colNames.includes('state')) await dbRun('ALTER TABLE hospitals ADD COLUMN state TEXT');
    if (!colNames.includes('district')) await dbRun('ALTER TABLE hospitals ADD COLUMN district TEXT');
    if (!colNames.includes('pincode')) await dbRun('ALTER TABLE hospitals ADD COLUMN pincode TEXT');
    if (!colNames.includes('specialties')) await dbRun('ALTER TABLE hospitals ADD COLUMN specialties TEXT');
    if (!colNames.includes('facilities_str')) await dbRun('ALTER TABLE hospitals ADD COLUMN facilities_str TEXT');
    if (!colNames.includes('status')) await dbRun("ALTER TABLE hospitals ADD COLUMN status TEXT DEFAULT 'published'");
    if (!colNames.includes('logo')) await dbRun('ALTER TABLE hospitals ADD COLUMN logo TEXT');
    if (!colNames.includes('cover_image')) await dbRun('ALTER TABLE hospitals ADD COLUMN cover_image TEXT');
    if (!colNames.includes('about')) await dbRun('ALTER TABLE hospitals ADD COLUMN about TEXT');
    if (!colNames.includes('reg_number')) await dbRun('ALTER TABLE hospitals ADD COLUMN reg_number TEXT');
    if (!colNames.includes('est_year')) await dbRun('ALTER TABLE hospitals ADD COLUMN est_year TEXT');
    if (!colNames.includes('accreditation')) await dbRun('ALTER TABLE hospitals ADD COLUMN accreditation TEXT');
    if (!colNames.includes('description')) await dbRun('ALTER TABLE hospitals ADD COLUMN description TEXT');
    if (!colNames.includes('address')) await dbRun('ALTER TABLE hospitals ADD COLUMN address TEXT');
    if (!colNames.includes('google_maps_url')) await dbRun('ALTER TABLE hospitals ADD COLUMN google_maps_url TEXT');
    if (!colNames.includes('city')) await dbRun('ALTER TABLE hospitals ADD COLUMN city TEXT');
    if (!colNames.includes('contact_number')) await dbRun('ALTER TABLE hospitals ADD COLUMN contact_number TEXT');
    if (!colNames.includes('emergency_number')) await dbRun('ALTER TABLE hospitals ADD COLUMN emergency_number TEXT');
    if (!colNames.includes('email')) await dbRun('ALTER TABLE hospitals ADD COLUMN email TEXT');
    if (!colNames.includes('website')) await dbRun('ALTER TABLE hospitals ADD COLUMN website TEXT');
    if (!colNames.includes('working_hours')) await dbRun('ALTER TABLE hospitals ADD COLUMN working_hours TEXT');
    if (!colNames.includes('is_247')) await dbRun('ALTER TABLE hospitals ADD COLUMN is_247 INTEGER DEFAULT 1');
    if (!colNames.includes('private_rooms')) await dbRun('ALTER TABLE hospitals ADD COLUMN private_rooms INTEGER DEFAULT 0');
    if (!colNames.includes('deluxe_rooms')) await dbRun('ALTER TABLE hospitals ADD COLUMN deluxe_rooms INTEGER DEFAULT 0');
    if (!colNames.includes('vip_rooms')) await dbRun('ALTER TABLE hospitals ADD COLUMN vip_rooms INTEGER DEFAULT 0');
    if (!colNames.includes('pricing_json')) await dbRun('ALTER TABLE hospitals ADD COLUMN pricing_json TEXT');
    if (!colNames.includes('lab_json')) await dbRun('ALTER TABLE hospitals ADD COLUMN lab_json TEXT');
    if (!colNames.includes('pharmacy_json')) await dbRun('ALTER TABLE hospitals ADD COLUMN pharmacy_json TEXT');
    if (!colNames.includes('ambulance_json')) await dbRun('ALTER TABLE hospitals ADD COLUMN ambulance_json TEXT');
    if (!colNames.includes('insurance_json')) await dbRun('ALTER TABLE hospitals ADD COLUMN insurance_json TEXT');
    if (!colNames.includes('contact_social_json')) await dbRun('ALTER TABLE hospitals ADD COLUMN contact_social_json TEXT');
    if (!colNames.includes('owner_name')) await dbRun('ALTER TABLE hospitals ADD COLUMN owner_name TEXT');
    if (!colNames.includes('verification_status')) await dbRun("ALTER TABLE hospitals ADD COLUMN verification_status TEXT DEFAULT 'verified'");
    if (!colNames.includes('verification_doc_ref')) await dbRun('ALTER TABLE hospitals ADD COLUMN verification_doc_ref TEXT');

    // 3. Create Departments Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hospital_id TEXT,
        name TEXT NOT NULL,
        description TEXT,
        image TEXT,
        floor TEXT,
        head TEXT,
        FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
      )
    `);

    // 4. Create Treatments Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS treatments (
        id TEXT,
        hospital_id TEXT,
        name TEXT,
        category TEXT,
        department TEXT,
        description TEXT,
        cost INTEGER,
        duration TEXT,
        PRIMARY KEY (id, hospital_id),
        FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
      )
    `);

    const treatCols = await dbAll("PRAGMA table_info(treatments)");
    const treatColNames = treatCols.map(c => c.name);
    if (!treatColNames.includes('department')) await dbRun('ALTER TABLE treatments ADD COLUMN department TEXT');
    if (!treatColNames.includes('description')) await dbRun('ALTER TABLE treatments ADD COLUMN description TEXT');

    // 5. Create Doctors Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS doctors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hospital_id TEXT,
        name TEXT,
        photo TEXT,
        qualification TEXT,
        exp TEXT,
        department TEXT,
        spec TEXT,
        fee INTEGER,
        opd_timing TEXT,
        available_days TEXT,
        languages TEXT,
        status TEXT,
        FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
      )
    `);

    const docCols = await dbAll("PRAGMA table_info(doctors)");
    const docColNames = docCols.map(c => c.name);
    if (!docColNames.includes('photo')) await dbRun('ALTER TABLE doctors ADD COLUMN photo TEXT');
    if (!docColNames.includes('qualification')) await dbRun('ALTER TABLE doctors ADD COLUMN qualification TEXT');
    if (!docColNames.includes('department')) await dbRun('ALTER TABLE doctors ADD COLUMN department TEXT');
    if (!docColNames.includes('fee')) await dbRun('ALTER TABLE doctors ADD COLUMN fee INTEGER');
    if (!docColNames.includes('opd_timing')) await dbRun('ALTER TABLE doctors ADD COLUMN opd_timing TEXT');
    if (!docColNames.includes('available_days')) await dbRun('ALTER TABLE doctors ADD COLUMN available_days TEXT');
    if (!docColNames.includes('languages')) await dbRun('ALTER TABLE doctors ADD COLUMN languages TEXT');

    // 6. Create Facilities Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS facilities (
        hospital_id TEXT,
        facility TEXT,
        PRIMARY KEY (hospital_id, facility),
        FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
      )
    `);

    // 7. Create Hospital Gallery Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS hospital_gallery (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hospital_id TEXT,
        category TEXT,
        image_url TEXT,
        caption TEXT,
        sort_order INTEGER DEFAULT 0,
        FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
      )
    `);

    // 8. Create Awards & Certifications Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS awards_certs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hospital_id TEXT,
        title TEXT NOT NULL,
        type TEXT,
        file_url TEXT,
        file_type TEXT,
        issue_date TEXT,
        FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
      )
    `);

    // 9. Create Bookings Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        patient_name TEXT,
        patient_phone TEXT,
        hospital_id TEXT,
        hospital_name TEXT,
        ambulance_type TEXT,
        pickup_location TEXT,
        drop_location TEXT,
        status TEXT,
        eta_mins INTEGER,
        fare INTEGER,
        timestamp TEXT,
        FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
      )
    `);

    // 10. Create Health Records Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS health_records (
        id TEXT PRIMARY KEY,
        user_id INTEGER,
        date TEXT,
        title TEXT,
        hospital TEXT,
        doctor TEXT,
        type TEXT,
        summary TEXT,
        file_ref TEXT,
        blood_group TEXT,
        is_encrypted INTEGER DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 11. Create Privacy & Security Audit Logs Table (DPDP / HIPAA Compliant)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS privacy_audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        actor_name TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        ip_address TEXT,
        timestamp TEXT NOT NULL,
        status TEXT DEFAULT 'SUCCESS',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 12. Create Patient Privacy Settings & Consent Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS patient_privacy_settings (
        user_id INTEGER PRIMARY KEY,
        emergency_sos_auto_share INTEGER DEFAULT 1,
        mask_contact_details INTEGER DEFAULT 1,
        emergency_pin TEXT DEFAULT '1234',
        allow_research_analytics INTEGER DEFAULT 0,
        consent_token TEXT,
        updated_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 13. Create Patient Health Schemes & Digital KYC Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS patient_schemes_kyc (
        id TEXT PRIMARY KEY,
        user_id INTEGER,
        scheme_type TEXT NOT NULL,
        scheme_name TEXT NOT NULL,
        beneficiary_name TEXT NOT NULL,
        card_number TEXT NOT NULL,
        id_proof_type TEXT,
        id_proof_number TEXT,
        coverage_amount INTEGER DEFAULT 500000,
        valid_till TEXT,
        kyc_status TEXT DEFAULT 'verified',
        verification_doc_ref TEXT,
        verified_at TEXT,
        family_members_count INTEGER DEFAULT 1,
        notes TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 14. Create Patient Favorite & Bookmarked Hospitals Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS patient_favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        hospital_id TEXT NOT NULL,
        created_at TEXT,
        UNIQUE(user_id, hospital_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 15. Create Blood Inventory Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS blood_inventory (
        id TEXT PRIMARY KEY,
        hospital_id TEXT NOT NULL,
        hospital_name TEXT NOT NULL,
        city TEXT,
        state TEXT,
        blood_group TEXT NOT NULL,
        component TEXT NOT NULL,
        units_available INTEGER NOT NULL DEFAULT 0,
        contact_phone TEXT,
        last_updated TEXT
      )
    `);

    // 16. Create Urgent Emergency Blood Requests Table (SOS)
    await dbRun(`
      CREATE TABLE IF NOT EXISTS blood_requests (
        id TEXT PRIMARY KEY,
        patient_name TEXT NOT NULL,
        blood_group TEXT NOT NULL,
        component TEXT NOT NULL,
        units_needed INTEGER NOT NULL,
        hospital_name TEXT NOT NULL,
        city TEXT NOT NULL,
        contact_phone TEXT NOT NULL,
        urgency TEXT NOT NULL,
        status TEXT DEFAULT 'ACTIVE',
        created_at TEXT
      )
    `);

    // 17. Create Voluntary Blood Donors Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS blood_donors (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        blood_group TEXT NOT NULL,
        city TEXT NOT NULL,
        contact_phone TEXT NOT NULL,
        email TEXT,
        last_donation_date TEXT,
        availability TEXT DEFAULT 'AVAILABLE',
        created_at TEXT
      )
    `);

    // Schema migrations for existing database
    const userCols = await dbAll("PRAGMA table_info(users)");
    const userColNames = userCols.map(c => c.name);
    if (!userColNames.includes('blood_group')) await dbRun('ALTER TABLE users ADD COLUMN blood_group TEXT');
    if (!userColNames.includes('emergency_contact')) await dbRun('ALTER TABLE users ADD COLUMN emergency_contact TEXT');
    if (!userColNames.includes('allergies')) await dbRun('ALTER TABLE users ADD COLUMN allergies TEXT');

    const recCols = await dbAll("PRAGMA table_info(health_records)");
    const recColNames = recCols.map(c => c.name);
    if (!recColNames.includes('blood_group')) await dbRun('ALTER TABLE health_records ADD COLUMN blood_group TEXT');
    if (!recColNames.includes('is_encrypted')) await dbRun('ALTER TABLE health_records ADD COLUMN is_encrypted INTEGER DEFAULT 1');

    // Seed default sample KYC schemes for demo patient if empty
    const kycCount = await dbGet('SELECT COUNT(*) as count FROM patient_schemes_kyc');
    if (kycCount.count === 0) {
      const demoUser = await dbGet('SELECT id FROM users WHERE email = ?', ['patient@medigo.com']);
      const patientId = demoUser ? demoUser.id : 1;

      await dbRun(`
        INSERT OR IGNORE INTO patient_schemes_kyc (
          id, user_id, scheme_type, scheme_name, beneficiary_name, card_number,
          id_proof_type, id_proof_number, coverage_amount, valid_till, kyc_status,
          verified_at, family_members_count, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'KYC-PMJAY-101',
        patientId,
        'pmjay',
        'Ayushman Bharat - PM-JAY (Pradhan Mantri Jan Arogya Yojana)',
        'Rahul Sharma',
        'PMJAY-9842-7105-3318',
        'Aadhaar Card',
        'XXXX-XXXX-8912',
        500000,
        '2028-12-31',
        'verified',
        new Date().toISOString().slice(0, 10),
        4,
        'Active Golden Card Verified with Aadhaar biometric e-KYC.'
      ]);

      await dbRun(`
        INSERT OR IGNORE INTO patient_schemes_kyc (
          id, user_id, scheme_type, scheme_name, beneficiary_name, card_number,
          id_proof_type, id_proof_number, coverage_amount, valid_till, kyc_status,
          verified_at, family_members_count, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'KYC-ABHA-102',
        patientId,
        'abha',
        'ABHA Health Account (Ayushman Bharat Digital Mission)',
        'Rahul Sharma',
        '91-4589-2314-8790',
        'Aadhaar OTP',
        'rahul.sharma@abdm',
        0,
        'Lifetime',
        'verified',
        new Date().toISOString().slice(0, 10),
        1,
        'Universal Health Identifier linked with ABHA Address rahul.sharma@abdm.'
      ]);
    }

    // Check if default users exist
    const userCount = await dbGet('SELECT COUNT(*) as count FROM users');
    if (userCount.count === 0) {
      console.log('Seeding default users and initial sample hospitals...');

      for (const h of INITIAL_HOSPITALS) {
        await dbRun(`
          INSERT OR IGNORE INTO hospitals (
            id, name, tagline, badge, type, rating, review_count, distance_km,
            location, lat, lng, phone, emergency_available, estimated_avg_cost,
            icu_total, icu_available, emergency_total, emergency_beds_available,
            general_total, general_available, opd_wait_time_mins, state, district, pincode, specialties, facilities_str
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          h.id, h.name, h.tagline, h.badge, h.type, h.rating, h.reviewCount, h.distanceKm,
          h.location, h.lat || 28.5672, h.lng || 77.2100, h.phone, h.emergencyAvailable ? 1 : 0, h.estimatedAvgCost,
          h.beds.icu.total, h.beds.icu.available, h.beds.emergency.total, h.beds.emergency.available,
          h.beds.general.total, h.beds.general.available, h.opdWaitTimeMins,
          'Delhi', 'New Delhi', '110029', 'General Medicine, Surgery, Cardiology', h.facilities.join(' • ')
        ]);

        for (const t of h.treatments) {
          await dbRun(`
            INSERT OR IGNORE INTO treatments (id, hospital_id, name, category, cost, duration)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [t.id, h.id, t.name, t.category, t.cost, t.duration]);
        }

        for (const d of h.doctors) {
          await dbRun(`
            INSERT INTO doctors (hospital_id, name, spec, exp, status)
            VALUES (?, ?, ?, ?, ?)
          `, [h.id, d.name, d.spec, d.exp, d.status]);
        }

        for (const f of h.facilities) {
          await dbRun(`
            INSERT OR IGNORE INTO facilities (hospital_id, facility)
            VALUES (?, ?)
          `, [h.id, f]);
        }
      }

      const saltRounds = 10;
      const patientPassword = await bcrypt.hash('patient123', saltRounds);

      const userPatientRes = await dbRun(`
        INSERT INTO users (name, email, password, role)
        VALUES (?, ?, ?, ?)
      `, ['Rahul Sharma', 'patient@medigo.com', patientPassword, 'patient']);

      for (const b of INITIAL_BOOKINGS) {
        await dbRun(`
          INSERT OR IGNORE INTO bookings (
            id, patient_name, patient_phone, hospital_id, hospital_name,
            ambulance_type, pickup_location, drop_location, status, eta_mins, fare, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          b.id, b.patientName, b.patientPhone, b.hospitalId, b.hospitalName,
          b.ambulanceType, b.pickupLocation, b.dropLocation, b.status, b.etaMins, b.fare, b.timestamp
        ]);
      }

      for (const r of SAMPLE_HEALTH_RECORDS) {
        await dbRun(`
          INSERT OR IGNORE INTO health_records (id, user_id, date, title, hospital, doctor, type, summary, file_ref)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [r.id, userPatientRes.id, r.date, r.title, r.hospital, r.doctor, r.type, r.summary, r.fileRef]);
      }
    }

    // Check if CSV dataset needs to be seeded
    const hospCount = await dbGet("SELECT COUNT(*) as count FROM hospitals WHERE id LIKE 'hosp-csv-%'");
    if (hospCount.count === 0) {
      await seedCSVHospitals();
    } else {
      console.log(`CSV hospitals already seeded (${hospCount.count} records).`);
    }

    // Seed Blood Bank initial data if empty
    await seedBloodBankData();

    console.log('Database initialized successfully.');
  } catch (error) {
    console.error('Error during database initialization:', error);
  }
}

async function seedBloodBankData() {
  try {
    const bloodInvCount = await dbGet('SELECT COUNT(*) as count FROM blood_inventory');
    if (bloodInvCount && bloodInvCount.count > 0) return;

    console.log('Seeding real-time Blood Bank inventory, SOS requests, and donor network...');

    const hospitals = [
      { id: 'hosp-gov-1', name: 'AIIMS New Delhi', city: 'New Delhi', state: 'Delhi', phone: '+91 11 2658 8500' },
      { id: 'hosp-gov-2', name: 'Safdarjung Hospital & VMMC', city: 'New Delhi', state: 'Delhi', phone: '+91 11 2616 5060' },
      { id: 'hosp-1', name: 'Max Super Speciality Hospital, Saket', city: 'New Delhi', state: 'Delhi', phone: '+91 11 2651 5050' },
      { id: 'hosp-2', name: 'Fortis Escorts Heart Institute', city: 'New Delhi', state: 'Delhi', phone: '+91 11 4713 5000' },
      { id: 'hosp-3', name: 'Indraprastha Apollo Hospital', city: 'New Delhi', state: 'Delhi', phone: '+91 11 7179 1090' },
      { id: 'hosp-gov-3', name: 'King George’s Medical University (KGMU)', city: 'Lucknow', state: 'Uttar Pradesh', phone: '+91 522 225 7450' }
    ];

    const bloodGroups = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
    const components = ['Packed Red Blood Cells (PRBC)', 'Whole Blood', 'Platelets', 'Fresh Frozen Plasma (FFP)'];

    let invIndex = 1;
    for (const h of hospitals) {
      for (const bg of bloodGroups) {
        for (const comp of components) {
          let units = 0;
          if (bg === 'O+' || bg === 'B+') {
            units = comp === 'Platelets' ? Math.floor(12 + Math.random() * 15) : Math.floor(25 + Math.random() * 35);
          } else if (bg === 'A+') {
            units = comp === 'Platelets' ? Math.floor(8 + Math.random() * 12) : Math.floor(20 + Math.random() * 25);
          } else if (bg === 'AB+') {
            units = comp === 'Platelets' ? Math.floor(6 + Math.random() * 8) : Math.floor(14 + Math.random() * 16);
          } else if (bg === 'O-') {
            units = comp === 'Platelets' ? Math.floor(2 + Math.random() * 4) : Math.floor(3 + Math.random() * 6);
          } else if (bg === 'A-' || bg === 'B-') {
            units = comp === 'Platelets' ? Math.floor(3 + Math.random() * 5) : Math.floor(4 + Math.random() * 8);
          } else if (bg === 'AB-') {
            units = comp === 'Platelets' ? Math.floor(1 + Math.random() * 3) : Math.floor(2 + Math.random() * 4);
          }

          await dbRun(`
            INSERT OR IGNORE INTO blood_inventory (
              id, hospital_id, hospital_name, city, state, blood_group, component, units_available, contact_phone, last_updated
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            `binv-${invIndex++}`,
            h.id,
            h.name,
            h.city,
            h.state,
            bg,
            comp,
            units,
            h.phone,
            new Date().toISOString()
          ]);
        }
      }
    }

    // Seed Active Emergency SOS Requests
    const initialRequests = [
      {
        id: 'breq-101',
        patientName: 'Aarav Mehra',
        bloodGroup: 'O-',
        component: 'Packed Red Blood Cells (PRBC)',
        unitsNeeded: 2,
        hospitalName: 'AIIMS New Delhi (Trauma Emergency)',
        city: 'New Delhi',
        contactPhone: '+91 98112 34567',
        urgency: 'Critical - Within 2 hrs',
        status: 'ACTIVE',
        createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString()
      },
      {
        id: 'breq-102',
        patientName: 'Priyanka Verma',
        bloodGroup: 'B-',
        component: 'Platelets',
        unitsNeeded: 4,
        hospitalName: 'Max Super Speciality Hospital, Saket',
        city: 'New Delhi',
        contactPhone: '+91 98234 56789',
        urgency: 'Urgent - Within 6 hrs',
        status: 'ACTIVE',
        createdAt: new Date(Date.now() - 120 * 60 * 1000).toISOString()
      },
      {
        id: 'breq-103',
        patientName: 'Rameshwar Singh',
        bloodGroup: 'AB-',
        component: 'Whole Blood',
        unitsNeeded: 1,
        hospitalName: 'Safdarjung Hospital & VMMC',
        city: 'New Delhi',
        contactPhone: '+91 99100 88776',
        urgency: 'Standard - Within 24 hrs',
        status: 'ACTIVE',
        createdAt: new Date(Date.now() - 240 * 60 * 1000).toISOString()
      }
    ];

    for (const req of initialRequests) {
      await dbRun(`
        INSERT OR IGNORE INTO blood_requests (
          id, patient_name, blood_group, component, units_needed, hospital_name, city, contact_phone, urgency, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        req.id, req.patientName, req.bloodGroup, req.component, req.unitsNeeded,
        req.hospitalName, req.city, req.contactPhone, req.urgency, req.status, req.createdAt
      ]);
    }

    // Seed Sample Verified Voluntary Donors
    const initialDonors = [
      { id: 'bdon-1', name: 'Vikram Malhotra', bloodGroup: 'O-', city: 'New Delhi', phone: '+91 98101 22334', email: 'vikram.m@example.com', lastDonation: '2026-05-10', availability: 'AVAILABLE' },
      { id: 'bdon-2', name: 'Ananya Deshmukh', bloodGroup: 'O+', city: 'New Delhi', phone: '+91 98220 44556', email: 'ananya.d@example.com', lastDonation: '2026-04-18', availability: 'AVAILABLE' },
      { id: 'bdon-3', name: 'Mohd. Tariq', bloodGroup: 'B+', city: 'New Delhi', phone: '+91 99554 11223', email: 'tariq.m@example.com', lastDonation: '2026-06-01', availability: 'AVAILABLE' },
      { id: 'bdon-4', name: 'Sunita Chawla', bloodGroup: 'A+', city: 'New Delhi', phone: '+91 97118 99887', email: 'sunita.c@example.com', lastDonation: '2026-03-22', availability: 'AVAILABLE' },
      { id: 'bdon-5', name: 'Deepak Rawat', bloodGroup: 'AB+', city: 'New Delhi', phone: '+91 98990 77665', email: 'deepak.r@example.com', lastDonation: '2026-07-15', availability: 'AVAILABLE' },
      { id: 'bdon-6', name: 'Pooja Hegde', bloodGroup: 'A-', city: 'New Delhi', phone: '+91 98331 66554', email: 'pooja.h@example.com', lastDonation: '2026-05-30', availability: 'AVAILABLE' }
    ];

    for (const d of initialDonors) {
      await dbRun(`
        INSERT OR IGNORE INTO blood_donors (
          id, name, blood_group, city, contact_phone, email, last_donation_date, availability, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        d.id, d.name, d.bloodGroup, d.city, d.phone, d.email, d.lastDonation, d.availability, new Date().toISOString()
      ]);
    }

    console.log('Blood Bank inventory, requests, and donor network seeded successfully.');
  } catch (err) {
    console.error('Error seeding blood bank data:', err);
  }
}

async function seedCSVHospitals() {
  const csvPath = join(__dirname, 'hospital_directory.csv');
  if (!fs.existsSync(csvPath)) {
    console.log('hospital_directory.csv not found, skipping CSV import.');
    return;
  }

  console.log('Parsing and seeding hospital_directory.csv into database...');
  const content = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCSV(content);

  if (rows.length <= 1) {
    console.log('No valid data rows in CSV.');
    return;
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);

  // Column index map
  const colMap = {};
  headers.forEach((h, i) => {
    colMap[h.replace(/^"|"$/g, '').trim()] = i;
  });

  await dbRun('BEGIN TRANSACTION');

  try {
    let count = 0;
    for (const row of dataRows) {
      if (!row || row.length < 5) continue;

      const srNo = row[colMap['Sr_No']] || `${count + 1}`;
      const name = row[colMap['Hospital_Name']] || 'Unnamed Hospital';
      const category = row[colMap['Hospital_Category']] || '';
      const careType = row[colMap['Hospital_Care_Type']] || '';
      const system = row[colMap['Discipline_Systems_of_Medicine']] || '';
      const address = row[colMap['Address_Original_First_Line']] || row[colMap['Location']] || '';
      const state = row[colMap['State']] || '';
      const district = row[colMap['District']] || '';
      const pincode = row[colMap['Pincode']] || '';
      const coordsStr = row[colMap['Location_Coordinates']] || '';
      const tel = row[colMap['Telephone']] || '';
      const mob = row[colMap['Mobile_Number']] || '';
      const emg = row[colMap['Emergency_Num']] || '';
      const amb = row[colMap['Ambulance_Phone_No']] || '';
      const specialties = row[colMap['Specialties']] || '';
      const facilities = row[colMap['Facilities']] || '';
      const totalBedsStr = row[colMap['Total_Num_Beds']] || '0';

      const isGovt = category.toLowerCase().includes('public') || category.toLowerCase().includes('government');
      const type = isGovt ? 'government' : 'private';
      const badge = isGovt ? '🏛️ Govt Hospital' : '🏥 Private Hospital';

      // Parse coordinates
      let lat = 28.6139;
      let lng = 77.2090;
      if (coordsStr && coordsStr.includes(',')) {
        const parts = coordsStr.split(',');
        const pLat = parseFloat(parts[0].trim());
        const pLng = parseFloat(parts[1].trim());
        if (!isNaN(pLat) && !isNaN(pLng) && pLat !== 0 && pLng !== 0) {
          lat = pLat;
          lng = pLng;
        }
      }

      // Phone
      const phone = [emg, amb, mob, tel].find(p => p && p !== '0' && p !== '') || '108';

      // Beds
      const totalBeds = parseInt(totalBedsStr, 10) || (isGovt ? 150 : 50);
      const icuTotal = Math.max(2, Math.floor(totalBeds * 0.15));
      const icuAvail = Math.max(1, Math.floor(icuTotal * 0.3));
      const emgTotal = Math.max(5, Math.floor(totalBeds * 0.2));
      const emgAvail = Math.max(2, Math.floor(emgTotal * 0.4));
      const genTotal = Math.max(10, Math.floor(totalBeds * 0.65));
      const genAvail = Math.max(3, Math.floor(genTotal * 0.5));

      // Estimated avg cost
      const estimatedCost = isGovt ? Math.floor(300 + (srNo % 10) * 100) : Math.floor(12000 + (srNo % 50) * 800);
      const rating = (4.0 + (srNo % 10) * 0.1).toFixed(1);
      const reviewCount = 20 + (srNo % 300);
      const distanceKm = (1.2 + (srNo % 15) * 0.7).toFixed(1);
      const opdWait = isGovt ? 35 : 15;

      const locationStr = [address, district, state, pincode].filter(Boolean).join(', ');
      const tagline = `${system || careType || 'Multi-Specialty'} Healthcare Facility`;

      const id = `hosp-csv-${srNo}`;

      await dbRun(`
        INSERT OR REPLACE INTO hospitals (
          id, name, tagline, badge, type, rating, review_count, distance_km,
          location, lat, lng, phone, emergency_available, estimated_avg_cost,
          icu_total, icu_available, emergency_total, emergency_beds_available,
          general_total, general_available, opd_wait_time_mins, state, district, pincode, specialties, facilities_str
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id, name, tagline, badge, type, parseFloat(rating), parseInt(reviewCount), parseFloat(distanceKm),
        locationStr, lat, lng, phone, 1, estimatedCost,
        icuTotal, icuAvail, emgTotal, emgAvail,
        genTotal, genAvail, opdWait, state, district, pincode, specialties, facilities
      ]);

      // Insert default treatments for CSV hospital
      const defaultTreatments = [
        { id: `t1-${id}`, name: "Appendix Surgery", category: "General Surgery", cost: isGovt ? 2500 : 45000, duration: "2 Days" },
        { id: `t2-${id}`, name: "Cataract Operation", category: "Ophthalmology", cost: isGovt ? 500 : 22000, duration: "1 Day" },
        { id: `t3-${id}`, name: "Angioplasty", category: "Cardiology", cost: isGovt ? 45000 : 150000, duration: "3 Days" }
      ];

      for (const t of defaultTreatments) {
        await dbRun(`
          INSERT OR IGNORE INTO treatments (id, hospital_id, name, category, cost, duration)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [t.id, id, t.name, t.category, t.cost, t.duration]);
      }

      count++;
    }

    await dbRun('COMMIT');
    console.log(`Successfully seeded ${count} hospitals from hospital_directory.csv!`);
  } catch (err) {
    await dbRun('ROLLBACK');
    console.error('Failed to seed CSV hospitals:', err);
  }
}

export default db;
