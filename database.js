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

    // 3. Create Treatments Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS treatments (
        id TEXT,
        hospital_id TEXT,
        name TEXT,
        category TEXT,
        cost INTEGER,
        duration TEXT,
        PRIMARY KEY (id, hospital_id),
        FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
      )
    `);

    // 4. Create Doctors Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS doctors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hospital_id TEXT,
        name TEXT,
        spec TEXT,
        exp TEXT,
        status TEXT,
        FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
      )
    `);

    // 5. Create Facilities Table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS facilities (
        hospital_id TEXT,
        facility TEXT,
        PRIMARY KEY (hospital_id, facility),
        FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
      )
    `);

    // 6. Create Bookings Table
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

    // 7. Create Health Records Table
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
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
      const adminPassword = await bcrypt.hash('admin123', saltRounds);
      const driverPassword = await bcrypt.hash('driver123', saltRounds);

      const userPatientRes = await dbRun(`
        INSERT INTO users (name, email, password, role)
        VALUES (?, ?, ?, ?)
      `, ['Rahul Sharma', 'patient@healthrought.com', patientPassword, 'patient']);

      await dbRun(`
        INSERT INTO users (name, email, password, role, hospital_id)
        VALUES (?, ?, ?, ?, ?)
      `, ['City Care Admin', 'admin@citycare.com', adminPassword, 'admin', 'hosp-1']);

      await dbRun(`
        INSERT INTO users (name, email, password, role)
        VALUES (?, ?, ?, ?)
      `, ['Driver Ramesh', 'driver@healthrought.com', driverPassword, 'driver']);

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

    console.log('Database initialized successfully.');
  } catch (error) {
    console.error('Error during database initialization:', error);
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
