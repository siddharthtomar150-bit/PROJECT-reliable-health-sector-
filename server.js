import express from 'express';
import cors from 'cors';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { initDb, dbGet, dbAll, dbRun } from './database.js';
import { SYMPTOM_DATABASE, DISEASE_DATABASE } from './data.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = 'medigo_super_secret_jwt_key_2026';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(__dirname));

// Initialize Database on Startup
initDb().catch(err => {
  console.error('Failed to initialize database:', err);
});

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    req.user = user;
    next();
  });
}

// ==================== AUTHENTICATION API ====================

// 1. Register User (Patient Portal)
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  const role = 'patient';

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Please provide name, email, and password.' });
  }

  try {
    // Check if user already exists
    const existingUser = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user as patient
    const result = await dbRun(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, role]
    );

    // Create Token
    const token = jwt.sign(
      { id: result.id, name, email, role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: result.id, name, email, role }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

// 2. Login User
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Please provide email and password.' });
  }

  try {
    const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    // Generate Token
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role, hospitalId: user.hospital_id },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, hospitalId: user.hospital_id }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// Get currently logged in user info
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// ==================== HOSPITALS API ====================

// Get unique States and Districts for filter dropdowns
app.get('/api/hospitals/meta', async (req, res) => {
  try {
    const stateRows = await dbAll('SELECT DISTINCT state FROM hospitals WHERE state IS NOT NULL AND state != "" ORDER BY state ASC');
    const districtRows = await dbAll('SELECT DISTINCT state, district FROM hospitals WHERE district IS NOT NULL AND district != "" AND district != "0" ORDER BY district ASC');

    const states = stateRows.map(r => r.state);
    const districtsByState = {};

    districtRows.forEach(r => {
      if (!districtsByState[r.state]) {
        districtsByState[r.state] = [];
      }
      districtsByState[r.state].push(r.district);
    });

    res.json({ states, districtsByState });
  } catch (err) {
    console.error('Error fetching hospital metadata:', err);
    res.status(500).json({ error: 'Failed to retrieve metadata.' });
  }
});

// Get hospitals with nested details (supports search, state/district filter, type, budget, and pagination)
app.get('/api/hospitals', async (req, res) => {
  try {
    const { search, state, district, type, emergency, maxBudget, limit = 100, offset = 0 } = req.query;

    const whereClauses = [];
    const params = [];

    if (state && state !== 'all') {
      whereClauses.push('state = ?');
      params.push(state);
    }

    if (district && district !== 'all') {
      whereClauses.push('district = ?');
      params.push(district);
    }

    if (type && type !== 'all') {
      whereClauses.push('type = ?');
      params.push(type);
    }

    if (emergency === 'true') {
      whereClauses.push('icu_available > 0');
    }

    if (maxBudget && !isNaN(maxBudget)) {
      whereClauses.push('estimated_avg_cost <= ?');
      params.push(parseInt(maxBudget, 10));
    }

    if (search && search.trim() !== '') {
      const q = `%${search.trim()}%`;
      whereClauses.push('(name LIKE ? OR location LIKE ? OR specialties LIKE ? OR pincode LIKE ? OR district LIKE ? OR state LIKE ?)');
      params.push(q, q, q, q, q, q);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const numLimit = parseInt(limit, 10) || 100;
    const numOffset = parseInt(offset, 10) || 0;

    const hospitals = await dbAll(`SELECT * FROM hospitals ${whereSql} LIMIT ? OFFSET ?`, [...params, numLimit, numOffset]);
    
    if (hospitals.length === 0) {
      return res.json([]);
    }

    if (req.query.lite === 'true') {
      return res.json(hospitals);
    }

    const hospIds = hospitals.map(h => h.id);
    
    // Process in chunks to avoid SQLite 999 parameter limit if needed, 
    // but typically non-lite requests have a small limit.
    const chunkSize = 800;
    let allTreatments = [];
    let allDoctors = [];
    let allDepts = [];
    let allFacilities = [];

    for (let i = 0; i < hospIds.length; i += chunkSize) {
      const chunk = hospIds.slice(i, i + chunkSize);
      const placeholders = chunk.map(() => '?').join(',');
      
      const t = await dbAll(`SELECT * FROM treatments WHERE hospital_id IN (${placeholders})`, chunk);
      const d = await dbAll(`SELECT * FROM doctors WHERE hospital_id IN (${placeholders})`, chunk);
      const dep = await dbAll(`SELECT * FROM departments WHERE hospital_id IN (${placeholders})`, chunk);
      const f = await dbAll(`SELECT * FROM facilities WHERE hospital_id IN (${placeholders})`, chunk);

      allTreatments.push(...t);
      allDoctors.push(...d);
      allDepts.push(...dep);
      allFacilities.push(...f);
    }
    const facilities = allFacilities;
    const treatments = allTreatments;
    const doctors = allDoctors;

    const result = hospitals.map(h => {
      const ambulanceUnits = h.type === 'government' 
        ? [{ id: `amb-gov-${h.id}`, type: "Govt Life Support Ambulance", vehicleNo: "DL 01 C 4455", driver: "Anil Kumar", phone: h.phone || "+91 11 2336 0000", ratePerKm: 0 }]
        : [
            { id: `amb-pvt-1-${h.id}`, type: "Normal", vehicleNo: "UP 15 AB 1234", driver: "Ramesh Kumar", phone: h.phone || "+91 91234 56789", ratePerKm: 25 },
            { id: `amb-pvt-2-${h.id}`, type: "ICU Ventilator", vehicleNo: "UP 15 AB 5678", driver: "Suresh Singh", phone: h.phone || "+91 91234 98765", ratePerKm: 55 }
          ];

      const hospFacilities = facilities.filter(f => f.hospital_id === h.id).map(f => f.facility);
      if (hospFacilities.length === 0 && h.facilities_str) {
        hospFacilities.push(...h.facilities_str.split(',').map(s => s.trim()).filter(Boolean));
      }
      if (hospFacilities.length === 0) {
        hospFacilities.push('Emergency Care', 'OPD', 'Pharmacy', 'Diagnostic Services');
      }

      return {
        id: h.id,
        name: h.name,
        tagline: h.tagline,
        badge: h.badge,
        type: h.type,
        rating: h.rating,
        reviewCount: h.review_count,
        distanceKm: h.distance_km,
        location: h.location,
        lat: h.lat,
        lng: h.lng,
        phone: h.phone,
        state: h.state,
        district: h.district,
        pincode: h.pincode,
        specialties: h.specialties,
        emergencyAvailable: h.emergency_available === 1,
        estimatedAvgCost: h.estimated_avg_cost,
        beds: {
          icu: { total: h.icu_total, available: h.icu_available },
          emergency: { total: h.emergency_total, available: h.emergency_beds_available },
          general: { total: h.general_total, available: h.general_available }
        },
        opdWaitTimeMins: h.opd_wait_time_mins,
        treatments: treatments.filter(t => t.hospital_id === h.id).map(t => ({
          id: t.id,
          name: t.name,
          category: t.category,
          cost: t.cost,
          duration: t.duration
        })),
        doctors: doctors.filter(d => d.hospital_id === h.id).map(d => ({
          name: d.name,
          spec: d.spec,
          exp: d.exp,
          status: d.status
        })),
        facilities: hospFacilities,
        ambulanceUnits
      };
    });

    res.json(result);
  } catch (err) {
    console.error('Error fetching hospitals:', err);
    res.status(500).json({ error: 'Failed to retrieve hospitals.' });
  }
});

// Update Bed Availability (Admin only)
app.put('/api/hospitals/:id/beds', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { icu, emergency, general } = req.body;

  if (req.user.role !== 'admin' && req.user.role !== 'driver') {
    return res.status(403).json({ error: 'Permission denied. Admins or drivers only.' });
  }

  // Hospital Admins can only edit their own hospital
  if (req.user.role === 'admin' && req.user.hospitalId !== id) {
    return res.status(403).json({ error: 'Permission denied. You can only manage your own hospital.' });
  }

  try {
    const fields = [];
    const params = [];

    if (icu !== undefined) {
      fields.push('icu_available = ?');
      params.push(icu);
    }
    if (emergency !== undefined) {
      fields.push('emergency_beds_available = ?');
      params.push(emergency);
    }
    if (general !== undefined) {
      fields.push('general_available = ?');
      params.push(general);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No bed counts provided to update.' });
    }

    params.push(id);

    const sql = `UPDATE hospitals SET ${fields.join(', ')} WHERE id = ?`;
    await dbRun(sql, params);

    res.json({ message: 'Bed availability updated successfully.' });
  } catch (err) {
    console.error('Error updating beds:', err);
    res.status(500).json({ error: 'Failed to update bed counts.' });
  }
});

// Update Treatment Price (Admin only)
app.put('/api/hospitals/:id/treatments/:treatmentId', authenticateToken, async (req, res) => {
  const { id, treatmentId } = req.params;
  const { cost } = req.body;

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Permission denied. Admins only.' });
  }

  if (req.user.hospitalId !== id) {
    return res.status(403).json({ error: 'Permission denied. You can only manage your own hospital.' });
  }

  if (cost === undefined || isNaN(cost) || cost <= 0) {
    return res.status(400).json({ error: 'Invalid cost parameter.' });
  }

  try {
    await dbRun('UPDATE treatments SET cost = ? WHERE id = ? AND hospital_id = ?', [cost, treatmentId, id]);
    
    // Update estimated average cost for hospital
    const treatments = await dbAll('SELECT cost FROM treatments WHERE hospital_id = ?', [id]);
    const avgCost = Math.round(treatments.reduce((sum, t) => sum + t.cost, 0) / treatments.length);
    await dbRun('UPDATE hospitals SET estimated_avg_cost = ? WHERE id = ?', [avgCost, id]);

    res.json({ message: 'Treatment cost updated successfully.', newAverageCost: avgCost });
  } catch (err) {
    console.error('Error updating treatment cost:', err);
    res.status(500).json({ error: 'Failed to update treatment cost.' });
  }
});

// Add New Treatment (Admin only)
app.post('/api/hospitals/:id/treatments', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, category, cost, duration } = req.body;

  if (req.user.role !== 'admin' || req.user.hospitalId !== id) {
    return res.status(403).json({ error: 'Permission denied.' });
  }

  if (!name || !cost) {
    return res.status(400).json({ error: 'Treatment name and cost are required.' });
  }

  try {
    const treatId = `t-${Date.now()}`;
    await dbRun(
      'INSERT INTO treatments (id, hospital_id, name, category, cost, duration) VALUES (?, ?, ?, ?, ?, ?)',
      [treatId, id, name, category || 'General Care', parseInt(cost, 10), duration || 'Day care']
    );

    // Update estimated average cost
    const treatments = await dbAll('SELECT cost FROM treatments WHERE hospital_id = ?', [id]);
    const avgCost = Math.round(treatments.reduce((sum, t) => sum + t.cost, 0) / treatments.length);
    await dbRun('UPDATE hospitals SET estimated_avg_cost = ? WHERE id = ?', [avgCost, id]);

    res.status(201).json({ id: treatId, name, category, cost: parseInt(cost, 10), duration, newAverageCost: avgCost });
  } catch (err) {
    console.error('Error adding treatment:', err);
    res.status(500).json({ error: 'Failed to add treatment.' });
  }
});

// Delete Treatment (Admin only)
app.delete('/api/hospitals/:id/treatments/:treatmentId', authenticateToken, async (req, res) => {
  const { id, treatmentId } = req.params;

  if (req.user.role !== 'admin' || req.user.hospitalId !== id) {
    return res.status(403).json({ error: 'Permission denied.' });
  }

  try {
    await dbRun('DELETE FROM treatments WHERE id = ? AND hospital_id = ?', [treatmentId, id]);
    res.json({ message: 'Treatment removed successfully.' });
  } catch (err) {
    console.error('Error deleting treatment:', err);
    res.status(500).json({ error: 'Failed to delete treatment.' });
  }
});

// Add New Doctor (Admin only)
app.post('/api/hospitals/:id/doctors', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, spec, exp, status } = req.body;

  if (req.user.role !== 'admin' || req.user.hospitalId !== id) {
    return res.status(403).json({ error: 'Permission denied.' });
  }

  if (!name || !spec) {
    return res.status(400).json({ error: 'Doctor name and specialty are required.' });
  }

  try {
    const result = await dbRun(
      'INSERT INTO doctors (hospital_id, name, spec, exp, status) VALUES (?, ?, ?, ?, ?)',
      [id, name, spec, exp || '5 yrs', status || 'Available']
    );

    res.status(201).json({ id: result.id, name, spec, exp, status });
  } catch (err) {
    console.error('Error adding doctor:', err);
    res.status(500).json({ error: 'Failed to add doctor.' });
  }
});

// Delete Doctor (Admin only)
app.delete('/api/hospitals/:id/doctors/:doctorId', authenticateToken, async (req, res) => {
  const { id, doctorId } = req.params;

  if (req.user.role !== 'admin' || req.user.hospitalId !== id) {
    return res.status(403).json({ error: 'Permission denied.' });
  }

  try {
    await dbRun('DELETE FROM doctors WHERE id = ? AND hospital_id = ?', [doctorId, id]);
    res.json({ message: 'Doctor removed from roster.' });
  } catch (err) {
    console.error('Error deleting doctor:', err);
    res.status(500).json({ error: 'Failed to remove doctor.' });
  }
});

// Update Hospital Settings (Admin only)
app.put('/api/hospitals/:id/settings', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { tagline, phone, emergencyAvailable, opdWaitTimeMins } = req.body;

  if (req.user.role !== 'admin' || req.user.hospitalId !== id) {
    return res.status(403).json({ error: 'Permission denied.' });
  }

  try {
    await dbRun(`
      UPDATE hospitals SET tagline = ?, phone = ?, emergency_available = ?, opd_wait_time_mins = ?
      WHERE id = ?
    `, [tagline, phone, emergencyAvailable ? 1 : 0, parseInt(opdWaitTimeMins, 10) || 15, id]);

    res.json({ message: 'Hospital settings updated successfully.' });
  } catch (err) {
    console.error('Error updating hospital settings:', err);
    res.status(500).json({ error: 'Failed to update hospital settings.' });
  }
});

// Add Hospital Facility (Admin only)
app.post('/api/hospitals/:id/facilities', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { facility } = req.body;

  if (req.user.role !== 'admin' || req.user.hospitalId !== id) {
    return res.status(403).json({ error: 'Permission denied.' });
  }

  if (!facility || !facility.trim()) {
    return res.status(400).json({ error: 'Facility name is required.' });
  }

  try {
    await dbRun('INSERT OR IGNORE INTO facilities (hospital_id, facility) VALUES (?, ?)', [id, facility.trim()]);
    res.status(201).json({ message: 'Facility added successfully.', facility: facility.trim() });
  } catch (err) {
    console.error('Error adding facility:', err);
    res.status(500).json({ error: 'Failed to add facility.' });
  }
});

// Delete Hospital Facility (Admin only)
app.delete('/api/hospitals/:id/facilities/:facility', authenticateToken, async (req, res) => {
  const { id, facility } = req.params;

  if (req.user.role !== 'admin' || req.user.hospitalId !== id) {
    return res.status(403).json({ error: 'Permission denied.' });
  }

  try {
    await dbRun('DELETE FROM facilities WHERE hospital_id = ? AND facility = ?', [id, decodeURIComponent(facility)]);
    res.json({ message: 'Facility removed successfully.' });
  } catch (err) {
    console.error('Error deleting facility:', err);
    res.status(500).json({ error: 'Failed to delete facility.' });
  }
});

// ==================== BOOKINGS API ====================

// Get bookings for logged-in patient
app.get('/api/bookings', authenticateToken, async (req, res) => {
  try {
    const bookings = await dbAll('SELECT * FROM bookings WHERE patient_name = ?', [req.user.name]);
    res.json(bookings);
  } catch (err) {
    console.error('Error retrieving bookings:', err);
    res.status(500).json({ error: 'Failed to retrieve bookings.' });
  }
});

// Create Booking (Patient)
app.post('/api/bookings', authenticateToken, async (req, res) => {
  const { hospitalId, hospitalName, ambulanceType, pickupLocation, dropLocation, fare } = req.body;

  try {
    const bookingId = 'BK-' + Math.floor(1000 + Math.random() * 9000);
    const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');

    await dbRun(`
      INSERT INTO bookings (
        id, patient_name, patient_phone, hospital_id, hospital_name,
        ambulance_type, pickup_location, drop_location, status, eta_mins, fare, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      bookingId,
      req.user.name,
      '+91 98123 45678', // Default simulated phone
      hospitalId,
      hospitalName,
      ambulanceType,
      pickupLocation,
      dropLocation,
      'Pending',
      15, // ETA initial mock
      fare || 0,
      timestamp
    ]);

    const booking = await dbGet('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    res.status(201).json(booking);
  } catch (err) {
    console.error('Error creating booking:', err);
    res.status(500).json({ error: 'Failed to dispatch ambulance booking.' });
  }
});

// Update Booking Status (Driver or Admin)
app.put('/api/bookings/:id/status', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { status, etaMins } = req.body;

  if (req.user.role !== 'driver' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Permission denied.' });
  }

  try {
    const fields = ['status = ?'];
    const params = [status];

    if (etaMins !== undefined) {
      fields.push('eta_mins = ?');
      params.push(etaMins);
    }

    params.push(id);

    await dbRun(`UPDATE bookings SET ${fields.join(', ')} WHERE id = ?`, params);
    
    const updatedBooking = await dbGet('SELECT * FROM bookings WHERE id = ?', [id]);
    res.json(updatedBooking);
  } catch (err) {
    console.error('Error updating booking status:', err);
    res.status(500).json({ error: 'Failed to update booking status.' });
  }
});

// ==================== HEALTH RECORDS API ====================

// ==================== HEALTH RECORDS & USER PROFILE API ====================

// Get patient user profile (with blood group, emergency contact, allergies)
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const user = await dbGet('SELECT id, name, email, role, hospital_id, blood_group, emergency_contact, allergies FROM users WHERE id = ?', [req.user.id]);
    res.json(user);
  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ error: 'Failed to fetch user profile.' });
  }
});

// Update patient user profile (blood_group, emergency_contact, allergies)
app.put('/api/user/profile', authenticateToken, async (req, res) => {
  const { bloodGroup, emergencyContact, allergies } = req.body;

  try {
    await dbRun(`
      UPDATE users SET blood_group = ?, emergency_contact = ?, allergies = ?
      WHERE id = ?
    `, [bloodGroup, emergencyContact, allergies, req.user.id]);

    const updatedUser = await dbGet('SELECT id, name, email, role, hospital_id, blood_group, emergency_contact, allergies FROM users WHERE id = ?', [req.user.id]);
    res.json({ message: 'Profile updated successfully.', user: updatedUser });
  } catch (err) {
    console.error('Error updating user profile:', err);
    res.status(500).json({ error: 'Failed to update user profile.' });
  }
});

// Get health records for patient
app.get('/api/records', authenticateToken, async (req, res) => {
  if (req.user.role !== 'patient') {
    return res.status(403).json({ error: 'Only patients have access to health vaults.' });
  }

  try {
    const records = await dbAll('SELECT * FROM health_records WHERE user_id = ? ORDER BY date DESC', [req.user.id]);
    res.json(records);
  } catch (err) {
    console.error('Error fetching records:', err);
    res.status(500).json({ error: 'Failed to retrieve digital health records.' });
  }
});

// Add new health record (Patient or Admin)
app.post('/api/records', authenticateToken, async (req, res) => {
  const { title, hospital, doctor, type, summary, date, bloodGroup, fileRef } = req.body;

  if (!title || !hospital) {
    return res.status(400).json({ error: 'Record title and hospital name are required.' });
  }

  try {
    const recordId = `REC-${Math.floor(100 + Math.random() * 900)}`;
    const recordDate = date || new Date().toISOString().slice(0, 10);

    await dbRun(`
      INSERT INTO health_records (id, user_id, date, title, hospital, doctor, type, summary, file_ref, blood_group)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      recordId,
      req.user.id,
      recordDate,
      title,
      hospital,
      doctor || 'Primary Care Physician',
      type || 'General Medical Report',
      summary || 'Digital health record stored securely.',
      fileRef || 'health_report.pdf',
      bloodGroup || 'O+'
    ]);

    const newRecord = await dbGet('SELECT * FROM health_records WHERE id = ?', [recordId]);
    res.status(201).json(newRecord);
  } catch (err) {
    console.error('Error adding health record:', err);
    res.status(500).json({ error: 'Failed to add health record.' });
  }
});

// Delete health record
app.delete('/api/records/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    await dbRun('DELETE FROM health_records WHERE id = ? AND user_id = ?', [id, req.user.id]);
    res.json({ message: 'Record deleted successfully.' });
  } catch (err) {
    console.error('Error deleting health record:', err);
    res.status(500).json({ error: 'Failed to delete health record.' });
  }
});

// ==================== AI SYMPTOM CHECKER API ====================

// Symptom Chat Endpoint
app.post('/api/symptoms/check', async (req, res) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Query is required.' });
  }

  const queryLower = query.toLowerCase();

  // --- Step 1: Score each disease by how many of its symptoms appear in the query ---
  const diseaseScores = DISEASE_DATABASE.map(d => {
    const matchedSymptoms = d.symptoms.filter(s => queryLower.includes(s.toLowerCase()));
    // Also match by disease name
    const nameMatch = queryLower.includes(d.disease.toLowerCase()) ? 2 : 0;
    return { ...d, score: matchedSymptoms.length + nameMatch, matchedSymptoms };
  }).filter(d => d.score > 0)
    .sort((a, b) => b.score - a.score);

  // --- Step 2: Check legacy SYMPTOM_DATABASE for procedure-level matches ---
  const legacyMatch = SYMPTOM_DATABASE.find(s =>
    s.symptom.toLowerCase().includes(queryLower) ||
    queryLower.includes(s.suggestedTreatment.toLowerCase())
  );

  // --- Step 3: Build response ---
  if (diseaseScores.length > 0) {
    const severityColor = { Low: '#22c55e', Medium: '#f59e0b', High: '#ef4444' };
    const emergencyBanner = diseaseScores.some(d => d.emergency)
      ? `<div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 8px 12px; margin-bottom: 10px; font-size: 0.85rem; color: #dc2626; font-weight: 600;">⚠️ One or more conditions may require <strong>emergency care</strong>. If symptoms are severe, use the 🚨 SOS button immediately.</div>`
      : '';

    const diseasePills = diseaseScores.slice(0, 3).map(d => {
      const color = severityColor[d.severity] || '#64748b';
      const emergencyTag = d.emergency
        ? `<span style="margin-left: 6px; background: #fef2f2; color: #dc2626; padding: 1px 6px; border-radius: 4px; font-size: 0.72rem; font-weight: 700;">🚨 EMERGENCY RISK</span>`
        : '';
      return `
        <div style="background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 10px 12px; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap;">
            <strong style="font-size: 0.95rem;">${d.disease}</strong>
            <span style="background: ${color}22; color: ${color}; padding: 1px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700;">● ${d.severity} Severity</span>
            ${emergencyTag}
          </div>
          <div style="font-size: 0.82rem; color: #94a3b8; margin-bottom: 4px;">🏥 <strong>Department:</strong> ${d.department} &nbsp;|&nbsp; 👨‍⚕️ <strong>See:</strong> ${d.specialist}</div>
          <div style="font-size: 0.8rem; color: #64748b;">Matching symptoms: ${d.matchedSymptoms.join(', ')}</div>
        </div>`;
    }).join('');

    const topDept = diseaseScores[0].department;
    const topSpecialist = diseaseScores[0].specialist;

    let reply = `
      <strong>🩺 AI Symptom Analysis:</strong><br/><br/>
      ${emergencyBanner}
      ${diseasePills}
      <div style="margin-top: 8px; font-size: 0.83rem; color: #94a3b8;">📌 <em>Recommended: Visit the <strong>${topDept}</strong> department and consult a <strong>${topSpecialist}</strong>. Use the hospital search to find nearby specialists.</em></div>
    `;

    // Append legacy procedure info if also relevant
    if (legacyMatch) {
      reply += `
        <br/><div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px; margin-top: 4px; font-size: 0.83rem;">
          <strong>💊 Procedure Reference:</strong> ${legacyMatch.suggestedTreatment} &nbsp;|&nbsp; Est. Cost: ${legacyMatch.estimatedCostRange}
        </div>`;
    }

    return res.json({ reply });
  }

  // Fallback: legacy procedure match
  if (legacyMatch) {
    return res.json({
      reply: `
        <strong>💡 AI Medical Recommendation:</strong><br/>
        • <strong>Department:</strong> ${legacyMatch.suggestedDepartment}<br/>
        • <strong>Suggested Treatment:</strong> ${legacyMatch.suggestedTreatment}<br/>
        • <strong>Urgency Level:</strong> <span style="color: #ef4444; font-weight:700;">${legacyMatch.urgency}</span><br/>
        • <strong>Est. Treatment Cost:</strong> ${legacyMatch.estimatedCostRange}<br/>
        <em>Tip: Click "Search Hospitals" to filter hospitals providing this procedure.</em>
      `
    });
  }

  // Generic fallback
  res.json({
    reply: `
      Based on your symptom ("${query}"), we recommend consulting a <strong>General Physician</strong> for immediate assessment. Recommended nearby hospitals with active OPD: City Care Hospital &amp; Apex Heart Institute.
    `
  });
});

// ==================== HOSPITAL ADMIN DASHBOARD API ====================

// 1. Register Hospital Admin and Create/Link Hospital Profile
app.post('/api/auth/register-hospital', async (req, res) => {
  const { name, email, password, hospitalName, city, state, existingHospitalId, licenseNumber, verificationDoc } = req.body;

  if (!name || !email || !password || (!hospitalName && !existingHospitalId)) {
    return res.status(400).json({ error: 'Please provide admin name, email, password, and hospital name.' });
  }

  try {
    const existingUser = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    let hospitalId = existingHospitalId;
    const verStatus = (licenseNumber || verificationDoc) ? 'verified' : 'pending';

    if (hospitalId) {
      const existingHosp = await dbGet('SELECT * FROM hospitals WHERE id = ?', [hospitalId]);
      if (existingHosp) {
        // Update existing hospital with admin verification info
        await dbRun(`
          UPDATE hospitals 
          SET owner_name = ?, reg_number = COALESCE(NULLIF(?, ''), reg_number), 
              verification_doc_ref = COALESCE(NULLIF(?, ''), verification_doc_ref), 
              verification_status = ? 
          WHERE id = ?
        `, [name, licenseNumber || '', verificationDoc || '', verStatus, hospitalId]);
      } else {
        hospitalId = null;
      }
    }

    if (!hospitalId) {
      hospitalId = `hosp-admin-${Date.now()}`;
      // Create Hospital Profile with verification status
      await dbRun(`
        INSERT INTO hospitals (
          id, name, tagline, badge, type, rating, review_count, distance_km,
          location, lat, lng, phone, emergency_available, estimated_avg_cost,
          icu_total, icu_available, emergency_total, emergency_beds_available,
          general_total, general_available, opd_wait_time_mins, state, district, pincode,
          specialties, facilities_str, status, city, is_247, owner_name, reg_number, verification_doc_ref, verification_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        hospitalId,
        hospitalName,
        'Hospital Profile Draft',
        '🏥 Private Hospital',
        'private',
        5.0, 0, 1.0,
        `${city || ''}, ${state || ''}`.trim(),
        28.6139, 77.2090,
        '',
        1, 0,
        0, 0, 0, 0, 0, 0, 15,
        state || '', city || '', '',
        '', '', 'draft', city || '', 1,
        name, licenseNumber || '', verificationDoc || '', verStatus
      ]);
    }

    // Insert Admin User
    const userResult = await dbRun(
      'INSERT INTO users (name, email, password, role, hospital_id) VALUES (?, ?, ?, ?, ?)',
      [name, email, hashedPassword, 'admin', hospitalId]
    );

    const token = jwt.sign(
      { id: userResult.id, name, email, role: 'admin', hospitalId },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Hospital registered successfully',
      token,
      user: { id: userResult.id, name, email, role: 'admin', hospitalId },
      hospitalId
    });
  } catch (err) {
    console.error('Hospital registration error:', err);
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

// 2. Upload Handler (Images & PDFs Base64)
app.post('/api/upload', authenticateToken, async (req, res) => {
  const { dataUrl, fileName } = req.body;
  if (!dataUrl) {
    return res.status(400).json({ error: 'No file data provided.' });
  }
  // In pure JS mode without multipart libs, dataUrl (base64) works seamlessly for both browser preview & database storage
  res.json({ fileUrl: dataUrl, fileName: fileName || 'uploaded_document' });
});

// 3. Get Complete Hospital Profile (For Admin Dashboard)
app.get('/api/hospital-admin/full-profile', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin' || !req.user.hospitalId) {
    return res.status(403).json({ error: 'Access denied. Hospital Admins only.' });
  }

  const hospId = req.user.hospitalId;

  try {
    const hospital = await dbGet('SELECT * FROM hospitals WHERE id = ?', [hospId]);
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital record not found.' });
    }

    const departments = await dbAll('SELECT * FROM departments WHERE hospital_id = ? ORDER BY id ASC', [hospId]);
    const doctors = await dbAll('SELECT * FROM doctors WHERE hospital_id = ? ORDER BY id ASC', [hospId]);
    const treatments = await dbAll('SELECT * FROM treatments WHERE hospital_id = ? ORDER BY id ASC', [hospId]);
    const facilitiesRows = await dbAll('SELECT facility FROM facilities WHERE hospital_id = ?', [hospId]);
    const gallery = await dbAll('SELECT * FROM hospital_gallery WHERE hospital_id = ? ORDER BY sort_order ASC, id ASC', [hospId]);
    const awards = await dbAll('SELECT * FROM awards_certs WHERE hospital_id = ? ORDER BY id ASC', [hospId]);

    const facilities = facilitiesRows.map(f => f.facility);

    res.json({
      hospital: {
        id: hospital.id,
        name: hospital.name || '',
        logo: hospital.logo || '',
        coverImage: hospital.cover_image || '',
        about: hospital.about || '',
        type: hospital.type || 'private',
        regNumber: hospital.reg_number || '',
        estYear: hospital.est_year || '',
        accreditation: hospital.accreditation || '',
        description: hospital.description || '',
        address: hospital.address || '',
        googleMapsUrl: hospital.google_maps_url || '',
        city: hospital.city || hospital.district || '',
        state: hospital.state || '',
        pincode: hospital.pincode || '',
        contactNumber: hospital.contact_number || hospital.phone || '',
        emergencyNumber: hospital.emergency_number || '',
        email: hospital.email || '',
        website: hospital.website || '',
        workingHours: hospital.working_hours || '24x7',
        is247: hospital.is_247 !== 0,
        status: hospital.status || 'draft',
        // Beds
        beds: {
          generalTotal: hospital.general_total || 0,
          generalAvailable: hospital.general_available || 0,
          icuTotal: hospital.icu_total || 0,
          icuAvailable: hospital.icu_available || 0,
          emergencyTotal: hospital.emergency_total || 0,
          emergencyBedsAvailable: hospital.emergency_beds_available || 0,
          privateRooms: hospital.private_rooms || 0,
          deluxeRooms: hospital.deluxe_rooms || 0,
          vipRooms: hospital.vip_rooms || 0
        },
        // Parsed JSON modules
        pricing: hospital.pricing_json ? JSON.parse(hospital.pricing_json) : { opd: 500, emergency: 1000, icu: 5000, room: 2000, surgeryPackages: '', diagnosticTests: '' },
        lab: hospital.lab_json ? JSON.parse(hospital.lab_json) : { tests: '', homeSample: false, reportDeliveryTime: '24 Hours' },
        pharmacy: hospital.pharmacy_json ? JSON.parse(hospital.pharmacy_json) : { is247: true, homeDelivery: false, emergencyMedicines: '' },
        ambulance: hospital.ambulance_json ? JSON.parse(hospital.ambulance_json) : { count: 1, phone: hospital.phone || '', charges: '₹500 / 5km', available: true },
        insurance: hospital.insurance_json ? JSON.parse(hospital.insurance_json) : { companies: 'HDFC ERGO, Star Health, ICICI Lombard', ayushmanBharat: true, cghs: false, echs: false, cashless: true },
        contactSocial: hospital.contact_social_json ? JSON.parse(hospital.contact_social_json) : { whatsapp: '', facebook: '', instagram: '', linkedin: '', twitter: '' }
      },
      departments,
      doctors,
      treatments,
      facilities,
      gallery,
      awards
    });
  } catch (err) {
    console.error('Error fetching full admin profile:', err);
    res.status(500).json({ error: 'Failed to load profile.' });
  }
});

// 4. Save/Update Hospital Profile (Supports Draft & Publish)
app.put('/api/hospital-admin/full-profile', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin' || !req.user.hospitalId) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  const hospId = req.user.hospitalId;
  const {
    name, logo, coverImage, about, type, regNumber, estYear, accreditation,
    description, address, googleMapsUrl, city, state, pincode, contactNumber,
    emergencyNumber, email, website, workingHours, is247, status,
    beds, pricing, lab, pharmacy, ambulance, insurance, contactSocial, facilities
  } = req.body;

  try {
    await dbRun(`
      UPDATE hospitals SET
        name = ?, logo = ?, cover_image = ?, about = ?, type = ?, reg_number = ?,
        est_year = ?, accreditation = ?, description = ?, address = ?, google_maps_url = ?,
        city = ?, state = ?, pincode = ?, contact_number = ?, emergency_number = ?,
        email = ?, website = ?, working_hours = ?, is_247 = ?, status = ?,
        phone = ?, location = ?,
        general_total = ?, general_available = ?, icu_total = ?, icu_available = ?,
        emergency_total = ?, emergency_beds_available = ?, private_rooms = ?, deluxe_rooms = ?, vip_rooms = ?,
        pricing_json = ?, lab_json = ?, pharmacy_json = ?, ambulance_json = ?, insurance_json = ?, contact_social_json = ?
      WHERE id = ?
    `, [
      name || 'Hospital', logo || '', coverImage || '', about || '', type || 'private', regNumber || '',
      estYear || '', accreditation || '', description || '', address || '', googleMapsUrl || '',
      city || '', state || '', pincode || '', contactNumber || '', emergencyNumber || '',
      email || '', website || '', workingHours || '24x7', is247 ? 1 : 0, status || 'draft',
      contactNumber || '', `${address || ''}, ${city || ''}, ${state || ''}`.trim(),
      beds?.generalTotal || 0, beds?.generalAvailable || 0, beds?.icuTotal || 0, beds?.icuAvailable || 0,
      beds?.emergencyTotal || 0, beds?.emergencyBedsAvailable || 0, beds?.privateRooms || 0, beds?.deluxeRooms || 0, beds?.vipRooms || 0,
      JSON.stringify(pricing || {}), JSON.stringify(lab || {}), JSON.stringify(pharmacy || {}),
      JSON.stringify(ambulance || {}), JSON.stringify(insurance || {}), JSON.stringify(contactSocial || {}),
      hospId
    ]);

    // Sync facilities if provided
    if (Array.isArray(facilities)) {
      await dbRun('DELETE FROM facilities WHERE hospital_id = ?', [hospId]);
      for (const f of facilities) {
        if (f && f.trim()) {
          await dbRun('INSERT OR IGNORE INTO facilities (hospital_id, facility) VALUES (?, ?)', [hospId, f.trim()]);
        }
      }
      await dbRun('UPDATE hospitals SET facilities_str = ? WHERE id = ?', [facilities.join(' • '), hospId]);
    }

    res.json({ message: `Hospital profile saved successfully as ${status === 'published' ? 'Published' : 'Draft'}.`, status });
  } catch (err) {
    console.error('Error saving full profile:', err);
    res.status(500).json({ error: 'Failed to save hospital profile.' });
  }
});

// 5. Publish Profile Endpoint
app.post('/api/hospital-admin/publish', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin' || !req.user.hospitalId) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  try {
    await dbRun("UPDATE hospitals SET status = 'published' WHERE id = ?", [req.user.hospitalId]);
    res.json({ message: 'Hospital profile published live successfully!', status: 'published' });
  } catch (err) {
    console.error('Error publishing hospital:', err);
    res.status(500).json({ error: 'Failed to publish profile.' });
  }
});

// 6. Departments Endpoints (Add / Delete)
app.post('/api/hospital-admin/departments', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin' || !req.user.hospitalId) return res.status(403).json({ error: 'Access denied.' });
  const { name, description, image, floor, head } = req.body;
  if (!name) return res.status(400).json({ error: 'Department name is required.' });

  try {
    const resDb = await dbRun(
      'INSERT INTO departments (hospital_id, name, description, image, floor, head) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.hospitalId, name, description || '', image || '', floor || '', head || '']
    );
    res.status(201).json({ id: resDb.id, name, description, image, floor, head });
  } catch (err) {
    console.error('Error adding department:', err);
    res.status(500).json({ error: 'Failed to add department.' });
  }
});

app.delete('/api/hospital-admin/departments/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin' || !req.user.hospitalId) return res.status(403).json({ error: 'Access denied.' });
  try {
    await dbRun('DELETE FROM departments WHERE id = ? AND hospital_id = ?', [req.params.id, req.user.hospitalId]);
    res.json({ message: 'Department removed.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove department.' });
  }
});

// 7. Doctors Admin Endpoints
app.post('/api/hospital-admin/doctors', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin' || !req.user.hospitalId) return res.status(403).json({ error: 'Access denied.' });
  const { name, photo, qualification, exp, department, spec, fee, opdTiming, availableDays, languages, status } = req.body;

  if (!name || !spec) return res.status(400).json({ error: 'Doctor name and specialization required.' });

  try {
    const resDb = await dbRun(`
      INSERT INTO doctors (
        hospital_id, name, photo, qualification, exp, department, spec, fee, opd_timing, available_days, languages, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      req.user.hospitalId, name, photo || '', qualification || '', exp || '5 yrs',
      department || 'General', spec, parseInt(fee, 10) || 500,
      opdTiming || '09:00 AM - 05:00 PM', availableDays || 'Mon-Sat',
      languages || 'English, Hindi', status || 'Available'
    ]);

    res.status(201).json({ id: resDb.id, name, spec, status: status || 'Available' });
  } catch (err) {
    console.error('Error adding doctor:', err);
    res.status(500).json({ error: 'Failed to add doctor.' });
  }
});

app.delete('/api/hospital-admin/doctors/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin' || !req.user.hospitalId) return res.status(403).json({ error: 'Access denied.' });
  try {
    await dbRun('DELETE FROM doctors WHERE id = ? AND hospital_id = ?', [req.params.id, req.user.hospitalId]);
    res.json({ message: 'Doctor removed from roster.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete doctor.' });
  }
});

// 8. Treatments Admin Endpoints
app.post('/api/hospital-admin/treatments', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin' || !req.user.hospitalId) return res.status(403).json({ error: 'Access denied.' });
  const { name, department, description, cost, duration, category } = req.body;
  if (!name || !cost) return res.status(400).json({ error: 'Treatment name and cost required.' });

  try {
    const treatId = `t-${Date.now()}`;
    await dbRun(`
      INSERT INTO treatments (id, hospital_id, name, category, department, description, cost, duration)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      treatId, req.user.hospitalId, name, category || 'General Care',
      department || 'General', description || '', parseInt(cost, 10), duration || '1 Day'
    ]);
    res.status(201).json({ id: treatId, name, cost: parseInt(cost, 10) });
  } catch (err) {
    console.error('Error adding treatment:', err);
    res.status(500).json({ error: 'Failed to add treatment.' });
  }
});

app.delete('/api/hospital-admin/treatments/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin' || !req.user.hospitalId) return res.status(403).json({ error: 'Access denied.' });
  try {
    await dbRun('DELETE FROM treatments WHERE id = ? AND hospital_id = ?', [req.params.id, req.user.hospitalId]);
    res.json({ message: 'Treatment removed.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete treatment.' });
  }
});

// 9. Gallery Endpoints
app.post('/api/hospital-admin/gallery', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin' || !req.user.hospitalId) return res.status(403).json({ error: 'Access denied.' });
  const { category, imageUrl, caption } = req.body;
  if (!imageUrl) return res.status(400).json({ error: 'Image URL/data is required.' });

  try {
    const resDb = await dbRun(
      'INSERT INTO hospital_gallery (hospital_id, category, image_url, caption) VALUES (?, ?, ?, ?)',
      [req.user.hospitalId, category || 'General', imageUrl, caption || '']
    );
    res.status(201).json({ id: resDb.id, category, imageUrl, caption });
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload photo.' });
  }
});

app.delete('/api/hospital-admin/gallery/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin' || !req.user.hospitalId) return res.status(403).json({ error: 'Access denied.' });
  try {
    await dbRun('DELETE FROM hospital_gallery WHERE id = ? AND hospital_id = ?', [req.params.id, req.user.hospitalId]);
    res.json({ message: 'Photo deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete photo.' });
  }
});

// 10. Awards & Certifications Endpoints
app.post('/api/hospital-admin/awards', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin' || !req.user.hospitalId) return res.status(403).json({ error: 'Access denied.' });
  const { title, type, fileUrl, fileType, issueDate } = req.body;
  if (!title) return res.status(400).json({ error: 'Certificate title is required.' });

  try {
    const resDb = await dbRun(
      'INSERT INTO awards_certs (hospital_id, title, type, file_url, file_type, issue_date) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.hospitalId, title, type || 'Certificate', fileUrl || '', fileType || 'Image', issueDate || '']
    );
    res.status(201).json({ id: resDb.id, title, type, fileUrl });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add certificate.' });
  }
});

app.delete('/api/hospital-admin/awards/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin' || !req.user.hospitalId) return res.status(403).json({ error: 'Access denied.' });
  try {
    await dbRun('DELETE FROM awards_certs WHERE id = ? AND hospital_id = ?', [req.params.id, req.user.hospitalId]);
    res.json({ message: 'Certificate removed.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove certificate.' });
  }
});

// Start the Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
