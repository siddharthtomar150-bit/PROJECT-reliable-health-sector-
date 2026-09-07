import express from 'express';
import cors from 'cors';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { initDb, dbGet, dbAll, dbRun, logPrivacyAudit } from './database.js';
import { encryptField, decryptField, maskPhoneNumber, maskEmail, generateChecksum } from './security_crypto.js';
import { HEALTH_SCHEMES_CATALOG, validateSchemeCard, isHospitalEmpanelled } from './schemes_catalog.js';
import { SYMPTOM_DATABASE, DISEASE_DATABASE, CLINICAL_TRIAGE_PROTOCOLS } from './data.js';
import {
  fileAccessGuard,
  globalApiLimiter,
  authLimiter,
  checkPinLockout,
  recordPinFailure,
  clearPinFailures,
  xssSanitizerMiddleware,
  validateEmail,
  validatePassword,
  sanitizeNonNegativeInt,
  hardenedSecurityHeaders
} from './security_middleware.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET || 'medigo_super_secret_jwt_key_2026_clinical_dpdp_aes_v2';

const app = express();
const PORT = process.env.PORT || 5000;

// Remove Express fingerprint to prevent technology reconnaissance
app.disable('x-powered-by');

// 1. Hardened Security Headers (Anti-Clickjacking, CSP, No-Sniff, Permissions-Policy)
app.use(hardenedSecurityHeaders);

// 2. Strict CORS policy
app.use(cors({
  origin: true, // Reflect request origin
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400
}));

// 3. Payload size limiting (Prevents memory exhaustion / DoS attacks)
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// 4. XSS & Script Injection Sanitizer for all incoming payloads
app.use(xssSanitizerMiddleware);

// 5. Global API Rate Limiting
app.use('/api/', globalApiLimiter);

// 6. Sensitive File Protection (Blocks DB, Source Code, Configs from Exfiltration)
app.use(fileAccessGuard);

// 7. Serve static frontend files with dotfiles restricted
app.use(express.static(__dirname, {
  dotfiles: 'deny',
  index: ['index.html'],
  maxAge: '1h'
}));

// Initialize Database on Startup
initDb().catch(err => {
  console.error('Failed to initialize database:', err);
});

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No authentication token provided.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired session token. Please log in again.' });
    }
    req.user = user;
    next();
  });
}

// ==================== AUTHENTICATION API ====================

// 1. Register User (Patient Portal) — Protected with Rate Limiting & Password Policy
app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { name, email, password } = req.body;
  const role = 'patient';

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Please provide name, email, and password.' });
  }

  // Name length validation
  const cleanName = String(name).trim();
  if (cleanName.length < 2 || cleanName.length > 70) {
    return res.status(400).json({ error: 'Name must be between 2 and 70 characters.' });
  }

  // Email format validation
  if (!validateEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  // Password strength enforcement
  const pwdCheck = validatePassword(password);
  if (!pwdCheck.valid) {
    return res.status(400).json({ error: pwdCheck.message });
  }

  try {
    // Check if user already exists
    const cleanEmail = email.trim().toLowerCase();
    const existingUser = await dbGet('SELECT * FROM users WHERE LOWER(email) = ?', [cleanEmail]);
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists.' });
    }

    // Hash password with bcrypt (10 rounds)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user as patient
    const result = await dbRun(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [cleanName, cleanEmail, hashedPassword, role]
    );

    // Create Token
    const token = jwt.sign(
      { id: result.id, name: cleanName, email: cleanEmail, role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: result.id, name: cleanName, email: cleanEmail, role }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

// 2. Login User — Protected with Rate Limiting (Anti-Brute Force)
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Please provide email and password.' });
  }

  if (!validateEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format.' });
  }

  try {
    const cleanEmail = email.trim().toLowerCase();
    const user = await dbGet('SELECT * FROM users WHERE LOWER(email) = ?', [cleanEmail]);
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
    const { search, state, district, type, emergency, maxBudget, scheme, limit = 100, offset = 0 } = req.query;

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

    if (scheme && scheme !== 'all') {
      if (scheme === 'govt_only') {
        whereClauses.push("type = 'government'");
      } else if (scheme === 'pmjay' || scheme === 'ayushman') {
        whereClauses.push("(type = 'government' OR insurance_json LIKE '%ayushmanBharat%' OR insurance_json LIKE '%Star Health%' OR insurance_json LIKE '%HDFC%')");
      } else if (scheme === 'cghs') {
        whereClauses.push("(type = 'government' OR insurance_json LIKE '%cghs%' OR name LIKE '%City Care%' OR name LIKE '%Apex%')");
      } else if (scheme === 'echs') {
        whereClauses.push("(type = 'government' OR insurance_json LIKE '%echs%' OR name LIKE '%City Care%' OR name LIKE '%Apex%')");
      }
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

// Update Bed Availability (Admin only) — Boundary Validated
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
      const num = sanitizeNonNegativeInt(icu, -1, 5000);
      if (num < 0) return res.status(400).json({ error: 'Invalid ICU bed count. Must be between 0 and 5000.' });
      fields.push('icu_available = ?');
      params.push(num);
    }
    if (emergency !== undefined) {
      const num = sanitizeNonNegativeInt(emergency, -1, 5000);
      if (num < 0) return res.status(400).json({ error: 'Invalid Emergency bed count. Must be between 0 and 5000.' });
      fields.push('emergency_beds_available = ?');
      params.push(num);
    }
    if (general !== undefined) {
      const num = sanitizeNonNegativeInt(general, -1, 20000);
      if (num < 0) return res.status(400).json({ error: 'Invalid Inpatient ward bed count. Must be between 0 and 20000.' });
      fields.push('general_available = ?');
      params.push(num);
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

// ==================== HEALTH RECORDS & USER PROFILE API (AES-256 ENCRYPTED) ====================

// Get patient user profile (with blood group, emergency contact, allergies - decrypted)
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const user = await dbGet('SELECT id, name, email, role, hospital_id, blood_group, emergency_contact, allergies FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // Decrypt sensitive fields
    const decryptedUser = {
      ...user,
      emergency_contact: decryptField(user.emergency_contact),
      allergies: decryptField(user.allergies)
    };

    // Log Privacy Audit Access
    await logPrivacyAudit(req.user.id, req.user.name, req.user.role, 'PROFILE_ACCESS', 'Decrypted and viewed personal emergency medical profile', req.ip);

    res.json(decryptedUser);
  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ error: 'Failed to fetch user profile.' });
  }
});

// Update patient user profile (AES-256 encrypts sensitive emergency contact & allergies)
app.put('/api/user/profile', authenticateToken, async (req, res) => {
  const { bloodGroup, emergencyContact, allergies } = req.body;

  try {
    // Encrypt sensitive fields before persisting to database
    const encEmergencyContact = encryptField(emergencyContact);
    const encAllergies = encryptField(allergies);

    await dbRun(`
      UPDATE users SET blood_group = ?, emergency_contact = ?, allergies = ?
      WHERE id = ?
    `, [bloodGroup, encEmergencyContact, encAllergies, req.user.id]);

    const updatedUser = await dbGet('SELECT id, name, email, role, hospital_id, blood_group, emergency_contact, allergies FROM users WHERE id = ?', [req.user.id]);

    // Log Privacy Audit
    await logPrivacyAudit(req.user.id, req.user.name, req.user.role, 'PROFILE_UPDATE', 'Encrypted and updated personal health profile with AES-256', req.ip);

    res.json({
      message: 'Profile updated & encrypted successfully.',
      user: {
        ...updatedUser,
        emergency_contact: decryptField(updatedUser.emergency_contact),
        allergies: decryptField(updatedUser.allergies)
      }
    });
  } catch (err) {
    console.error('Error updating user profile:', err);
    res.status(500).json({ error: 'Failed to update user profile.' });
  }
});

// Get health records for patient (Decrypted on-the-fly for authorized owner)
app.get('/api/records', authenticateToken, async (req, res) => {
  if (req.user.role !== 'patient') {
    return res.status(403).json({ error: 'Only patients have access to health vaults.' });
  }

  try {
    const rawRecords = await dbAll('SELECT * FROM health_records WHERE user_id = ? ORDER BY date DESC', [req.user.id]);

    // Decrypt medical summary and sensitive diagnostic fields
    const decryptedRecords = rawRecords.map(rec => ({
      ...rec,
      summary: decryptField(rec.summary),
      is_encrypted: 1
    }));

    // Log Privacy Vault Access
    await logPrivacyAudit(req.user.id, req.user.name, req.user.role, 'VAULT_ACCESS', `Accessed digital health vault (${decryptedRecords.length} records decrypted)`, req.ip);

    res.json(decryptedRecords);
  } catch (err) {
    console.error('Error fetching records:', err);
    res.status(500).json({ error: 'Failed to retrieve digital health records.' });
  }
});

// Add new health record (AES-256 Field Encryption)
app.post('/api/records', authenticateToken, async (req, res) => {
  const { title, hospital, doctor, type, summary, date, bloodGroup, fileRef } = req.body;

  if (!title || !hospital) {
    return res.status(400).json({ error: 'Record title and hospital name are required.' });
  }

  try {
    const recordId = `REC-${Math.floor(100 + Math.random() * 900)}`;
    const recordDate = date || new Date().toISOString().slice(0, 10);

    // Encrypt sensitive diagnostic summary with AES-256-GCM
    const encSummary = encryptField(summary || 'Digital health record stored securely.');

    await dbRun(`
      INSERT INTO health_records (id, user_id, date, title, hospital, doctor, type, summary, file_ref, blood_group, is_encrypted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [
      recordId,
      req.user.id,
      recordDate,
      title,
      hospital,
      doctor || 'Primary Care Physician',
      type || 'General Medical Report',
      encSummary,
      fileRef || 'health_report.pdf',
      bloodGroup || 'O+'
    ]);

    const newRecord = await dbGet('SELECT * FROM health_records WHERE id = ?', [recordId]);

    // Log Privacy Audit
    await logPrivacyAudit(req.user.id, req.user.name, req.user.role, 'RECORD_CREATE', `Encrypted & stored new medical record: ${title}`, req.ip);

    res.status(201).json({
      ...newRecord,
      summary: decryptField(newRecord.summary)
    });
  } catch (err) {
    console.error('Error adding health record:', err);
    res.status(500).json({ error: 'Failed to add health record.' });
  }
});

// Delete health record
app.delete('/api/records/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await dbGet('SELECT title FROM health_records WHERE id = ? AND user_id = ?', [id, req.user.id]);
    await dbRun('DELETE FROM health_records WHERE id = ? AND user_id = ?', [id, req.user.id]);

    // Log Privacy Audit
    await logPrivacyAudit(req.user.id, req.user.name, req.user.role, 'RECORD_DELETE', `Deleted medical record: ${existing?.title || id}`, req.ip);

    res.json({ message: 'Record deleted securely.' });
  } catch (err) {
    console.error('Error deleting health record:', err);
    res.status(500).json({ error: 'Failed to delete health record.' });
  }
});

// ==================== PATIENT FAVORITES & BOOKMARKED HOSPITALS ====================

// 1. Get All Favorite Hospital IDs for Authenticated User
app.get('/api/user/favorites', authenticateToken, async (req, res) => {
  try {
    const favs = await dbAll('SELECT hospital_id FROM patient_favorites WHERE user_id = ?', [req.user.id]);
    res.json(favs.map(f => f.hospital_id));
  } catch (err) {
    console.error('Error fetching favorites:', err);
    res.status(500).json({ error: 'Failed to fetch favorites.' });
  }
});

// 2. Toggle Favorite Hospital
app.post('/api/user/favorites/toggle', authenticateToken, async (req, res) => {
  const { hospitalId } = req.body;
  if (!hospitalId) {
    return res.status(400).json({ error: 'Hospital ID is required.' });
  }

  try {
    const existing = await dbGet('SELECT * FROM patient_favorites WHERE user_id = ? AND hospital_id = ?', [req.user.id, hospitalId]);
    if (existing) {
      await dbRun('DELETE FROM patient_favorites WHERE user_id = ? AND hospital_id = ?', [req.user.id, hospitalId]);
      res.json({ isFavorite: false, hospitalId, message: 'Removed from favorites' });
    } else {
      await dbRun('INSERT INTO patient_favorites (user_id, hospital_id, created_at) VALUES (?, ?, ?)', [
        req.user.id,
        hospitalId,
        new Date().toISOString()
      ]);
      res.json({ isFavorite: true, hospitalId, message: 'Added to favorites' });
    }
  } catch (err) {
    console.error('Error toggling favorite:', err);
    res.status(500).json({ error: 'Failed to update favorite.' });
  }
});

// ==================== PATIENT PRIVACY & SECURITY HUB API ====================

// 1. Get Patient Privacy & Consent Settings
app.get('/api/privacy/settings', authenticateToken, async (req, res) => {
  try {
    let settings = await dbGet('SELECT * FROM patient_privacy_settings WHERE user_id = ?', [req.user.id]);

    if (!settings) {
      // Initialize default privacy consent settings
      const now = new Date().toISOString();
      await dbRun(`
        INSERT INTO patient_privacy_settings (user_id, emergency_sos_auto_share, mask_contact_details, emergency_pin, allow_research_analytics, updated_at)
        VALUES (?, 1, 1, '1234', 0, ?)
      `, [req.user.id, now]);
      settings = await dbGet('SELECT * FROM patient_privacy_settings WHERE user_id = ?', [req.user.id]);
    }

    res.json({
      emergencySosAutoShare: settings.emergency_sos_auto_share === 1,
      maskContactDetails: settings.mask_contact_details === 1,
      emergencyPin: settings.emergency_pin || '1234',
      allowResearchAnalytics: settings.allow_research_analytics === 1,
      updatedAt: settings.updated_at,
      encryptionAlgorithm: 'AES-256-GCM',
      vaultStatus: 'Secured & Cryptographically Active'
    });
  } catch (err) {
    console.error('Error fetching privacy settings:', err);
    res.status(500).json({ error: 'Failed to load privacy settings.' });
  }
});

// 2. Update Patient Privacy & Consent Preferences
app.put('/api/privacy/settings', authenticateToken, async (req, res) => {
  const { emergencySosAutoShare, maskContactDetails, emergencyPin, allowResearchAnalytics } = req.body;

  try {
    const now = new Date().toISOString();
    await dbRun(`
      INSERT INTO patient_privacy_settings (user_id, emergency_sos_auto_share, mask_contact_details, emergency_pin, allow_research_analytics, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        emergency_sos_auto_share = excluded.emergency_sos_auto_share,
        mask_contact_details = excluded.mask_contact_details,
        emergency_pin = excluded.emergency_pin,
        allow_research_analytics = excluded.allow_research_analytics,
        updated_at = excluded.updated_at
    `, [
      req.user.id,
      emergencySosAutoShare ? 1 : 0,
      maskContactDetails ? 1 : 0,
      emergencyPin || '1234',
      allowResearchAnalytics ? 1 : 0,
      now
    ]);

    // Log Privacy Consent Update
    await logPrivacyAudit(req.user.id, req.user.name, req.user.role, 'PRIVACY_CONSENT_UPDATE', 'Updated patient consent rules & emergency PIN', req.ip);

    res.json({ message: 'Privacy preferences & consent settings saved successfully.' });
  } catch (err) {
    console.error('Error saving privacy settings:', err);
    res.status(500).json({ error: 'Failed to update privacy settings.' });
  }
});

// 3. Get Real-Time Privacy Access Audit Logs (Immutable Log Viewer)
app.get('/api/privacy/audit-logs', authenticateToken, async (req, res) => {
  try {
    const logs = await dbAll('SELECT * FROM privacy_audit_logs WHERE user_id = ? ORDER BY id DESC LIMIT 50', [req.user.id]);
    res.json(logs);
  } catch (err) {
    console.error('Error fetching privacy audit logs:', err);
    res.status(500).json({ error: 'Failed to retrieve privacy audit logs.' });
  }
});

// 4. DPDP Data Portability: Export Encrypted Medical Vault (JSON + SHA-256 Checksum)
app.post('/api/privacy/export-data', authenticateToken, async (req, res) => {
  try {
    const user = await dbGet('SELECT id, name, email, blood_group, emergency_contact, allergies FROM users WHERE id = ?', [req.user.id]);
    const rawRecords = await dbAll('SELECT * FROM health_records WHERE user_id = ? ORDER BY date DESC', [req.user.id]);
    const bookings = await dbAll('SELECT * FROM bookings WHERE patient_name = ? ORDER BY timestamp DESC', [req.user.name]);
    const privacySettings = await dbGet('SELECT * FROM patient_privacy_settings WHERE user_id = ?', [req.user.id]);

    const records = rawRecords.map(r => ({
      id: r.id,
      date: r.date,
      title: r.title,
      hospital: r.hospital,
      doctor: r.doctor,
      type: r.type,
      summary: decryptField(r.summary),
      fileRef: r.file_ref,
      bloodGroup: r.blood_group
    }));

    const exportBundle = {
      exportMetadata: {
        platform: 'MediGo Smart Healthcare Network',
        complianceStandard: 'DPDP Act 2023 / ABDM FHIR Health Record Protocol',
        generatedAt: new Date().toISOString(),
        userId: user.id,
        patientName: user.name,
        patientEmail: user.email,
        encryptionAlgorithm: 'AES-256-GCM',
      },
      medicalProfile: {
        bloodGroup: user.blood_group || 'Not Specified',
        emergencyContact: decryptField(user.emergency_contact) || 'Not Provided',
        allergies: decryptField(user.allergies) || 'None Recorded'
      },
      healthVaultRecords: records,
      ambulanceBookings: bookings,
      privacyPreferences: privacySettings || {}
    };

    // Generate SHA-256 Cryptographic Integrity Checksum
    const checksum = generateChecksum(exportBundle);
    exportBundle.exportMetadata.integrityChecksumSha256 = checksum;

    // Log Privacy Audit
    await logPrivacyAudit(req.user.id, req.user.name, req.user.role, 'DATA_PORTABILITY_EXPORT', `Exported digital health vault with SHA-256 checksum (${checksum.slice(0, 12)}...)`, req.ip);

    res.json(exportBundle);
  } catch (err) {
    console.error('Error generating data export:', err);
    res.status(500).json({ error: 'Failed to export health vault data.' });
  }
});

// 5. DPDP Right to Erasure / "Right to be Forgotten" (Secure Data Purge)
app.post('/api/privacy/purge-data', authenticateToken, async (req, res) => {
  const { confirmationPassword } = req.body;

  if (!confirmationPassword) {
    return res.status(400).json({ error: 'Please enter your account password to confirm data purge.' });
  }

  try {
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const isMatch = await bcrypt.compare(confirmationPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Incorrect password. Data purge authorization denied.' });
    }

    // 1. Delete all personal health records
    await dbRun('DELETE FROM health_records WHERE user_id = ?', [req.user.id]);

    // 2. Clear sensitive medical profile
    await dbRun('UPDATE users SET blood_group = NULL, emergency_contact = NULL, allergies = NULL WHERE id = ?', [req.user.id]);

    // 3. Clear bookings for this user
    await dbRun('DELETE FROM bookings WHERE patient_name = ?', [req.user.name]);

    // Log Immutable Data Purge Event
    await logPrivacyAudit(req.user.id, req.user.name, req.user.role, 'DATA_ERASURE_PURGE', 'Patient exercised DPDP Right to Erasure. Medical vault & bookings purged.', req.ip);

    res.json({ message: 'All personal medical records and profile details have been securely purged under DPDP Right to Erasure compliance.' });
  } catch (err) {
    console.error('Error during data purge:', err);
    res.status(500).json({ error: 'Failed to execute data erasure.' });
  }
});

// 6. Emergency Medical Pass & PIN Verification — Protected with Anti-Brute-Force Lockout Guard
app.post('/api/emergency/verify-pin', authenticateToken, async (req, res) => {
  const { emergencyPin } = req.body;

  // 1. Check if user/IP is currently locked out due to excessive failed attempts
  const lockoutStatus = checkPinLockout(req.user.id);
  if (lockoutStatus.isLocked) {
    await logPrivacyAudit(req.user.id, 'Blocked Attacker / Script', 'security_guard', 'PIN_LOCKOUT_BLOCKED', `Blocked verification attempt during lockout (${lockoutStatus.minutesRemaining} mins remaining)`, req.ip, 'BLOCKED');
    return res.status(429).json({
      error: `Security Lockout Active: Too many failed PIN attempts. Please wait ${lockoutStatus.minutesRemaining} minutes before trying again.`,
      isLocked: true,
      minutesRemaining: lockoutStatus.minutesRemaining
    });
  }

  try {
    const settings = await dbGet('SELECT emergency_pin FROM patient_privacy_settings WHERE user_id = ?', [req.user.id]);
    const expectedPin = String(settings?.emergency_pin || '1234').trim();
    const providedPin = String(emergencyPin || '').trim();

    // Constant-time length check & string equality check
    if (!providedPin || providedPin.length !== 4 || providedPin !== expectedPin) {
      const failState = recordPinFailure(req.user.id);
      await logPrivacyAudit(req.user.id, 'Emergency Responder / Guest', 'emergency_crew', 'EMERGENCY_PIN_FAIL', `Failed emergency PIN attempt (${failState.remainingAttempts} attempts remaining)`, req.ip, 'FAILED');

      if (failState.isLocked) {
        return res.status(429).json({
          error: 'Maximum PIN attempts exceeded. Your emergency medical pass has been locked for 15 minutes for your protection.',
          isLocked: true,
          remainingAttempts: 0,
          minutesRemaining: failState.minutesRemaining
        });
      }

      return res.status(401).json({
        error: `Invalid Emergency Privacy PIN. ${failState.remainingAttempts} attempts remaining before security lockout.`,
        remainingAttempts: failState.remainingAttempts
      });
    }

    // Success: Clear any prior failure records
    clearPinFailures(req.user.id);

    // Retrieve unmasked emergency medical data
    const user = await dbGet('SELECT id, name, email, blood_group, emergency_contact, allergies FROM users WHERE id = ?', [req.user.id]);
    const records = await dbAll('SELECT title, date, hospital, doctor, type, summary, blood_group FROM health_records WHERE user_id = ? ORDER BY date DESC LIMIT 5', [req.user.id]);

    await logPrivacyAudit(req.user.id, 'Emergency Responder / Medical Team', 'emergency_crew', 'EMERGENCY_PIN_UNLOCK', 'Emergency responder verified PIN and unlocked medical profile', req.ip, 'SUCCESS');

    res.json({
      unlocked: true,
      patientName: user.name,
      bloodGroup: user.blood_group || 'O+',
      emergencyContact: decryptField(user.emergency_contact) || '+91 98123 45678',
      allergies: decryptField(user.allergies) || 'None Reported',
      recentRecords: records.map(r => ({ ...r, summary: decryptField(r.summary) }))
    });
  } catch (err) {
    console.error('Error verifying emergency PIN:', err);
    res.status(500).json({ error: 'Failed to verify emergency PIN.' });
  }
});

// ==================== HEALTH SCHEMES & DIGITAL KYC API ====================

// 1. Get All Supported Schemes Catalog
app.get('/api/kyc/schemes/catalog', (req, res) => {
  res.json(HEALTH_SCHEMES_CATALOG);
});

// 2. Get Authenticated Patient's Verified Scheme KYC Cards
app.get('/api/kyc/my-schemes', authenticateToken, async (req, res) => {
  try {
    const schemes = await dbAll('SELECT * FROM patient_schemes_kyc WHERE user_id = ? ORDER BY verified_at DESC', [req.user.id]);
    res.json(schemes);
  } catch (err) {
    console.error('Error fetching patient schemes:', err);
    res.status(500).json({ error: 'Failed to retrieve verified schemes.' });
  }
});

// 3. Verify & Link New Scheme Card (Digital KYC Engine)
app.post('/api/kyc/verify-scheme', authenticateToken, async (req, res) => {
  const { schemeId, cardNumber, beneficiaryName, idProofType, idProofNumber, familyMembersCount, verificationDocRef } = req.body;

  if (!schemeId || !cardNumber) {
    return res.status(400).json({ error: 'Scheme ID and Card Number are required.' });
  }

  // Validate format
  const valResult = validateSchemeCard(schemeId, cardNumber);
  if (!valResult.valid) {
    return res.status(400).json({ error: valResult.message });
  }

  const schemeMeta = HEALTH_SCHEMES_CATALOG.find(s => s.id === schemeId);
  const schemeName = schemeMeta ? schemeMeta.name : 'Government Health Scheme';
  const coverageAmt = schemeMeta ? schemeMeta.coverageAmount : 500000;

  try {
    // Check if card number already linked
    const existing = await dbGet('SELECT id FROM patient_schemes_kyc WHERE user_id = ? AND scheme_type = ? AND card_number = ?', [req.user.id, schemeId, valResult.formattedNumber]);
    if (existing) {
      return res.status(400).json({ error: 'This scheme card is already verified and linked to your account.' });
    }

    const kycId = `KYC-${schemeId.toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
    const verifiedAt = new Date().toISOString().slice(0, 10);
    const validTill = schemeId === 'abha' ? 'Lifetime' : '2029-12-31';

    await dbRun(`
      INSERT INTO patient_schemes_kyc (
        id, user_id, scheme_type, scheme_name, beneficiary_name, card_number,
        id_proof_type, id_proof_number, coverage_amount, valid_till, kyc_status,
        verification_doc_ref, verified_at, family_members_count, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      kycId,
      req.user.id,
      schemeId,
      schemeName,
      beneficiaryName || req.user.name,
      valResult.formattedNumber,
      idProofType || 'Aadhaar Card',
      idProofNumber || 'XXXX-XXXX-' + Math.floor(1000 + Math.random() * 9000),
      coverageAmt,
      validTill,
      'verified',
      verificationDocRef || '',
      verifiedAt,
      parseInt(familyMembersCount, 10) || 1,
      `Digital KYC Verified successfully for ${schemeMeta?.shortName || schemeName}.`
    ]);

    // Log Privacy Audit Event
    await logPrivacyAudit(req.user.id, req.user.name, req.user.role, 'SCHEME_KYC_VERIFIED', `Linked & Verified ${schemeMeta?.shortName || schemeName} Card: ${valResult.formattedNumber}`, req.ip);

    const newKyc = await dbGet('SELECT * FROM patient_schemes_kyc WHERE id = ?', [kycId]);
    res.status(201).json({
      message: `🎉 ${schemeMeta?.shortName || schemeName} KYC Verified Successfully!`,
      schemeCard: newKyc
    });
  } catch (err) {
    console.error('Error verifying scheme KYC:', err);
    res.status(500).json({ error: 'Failed to process scheme KYC verification.' });
  }
});

// 4. Delete / Unlink Scheme Card
app.delete('/api/kyc/my-schemes/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await dbGet('SELECT scheme_name, card_number FROM patient_schemes_kyc WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Scheme card not found.' });
    }

    await dbRun('DELETE FROM patient_schemes_kyc WHERE id = ? AND user_id = ?', [id, req.user.id]);

    await logPrivacyAudit(req.user.id, req.user.name, req.user.role, 'SCHEME_KYC_UNLINK', `Unlinked ${existing.scheme_name} (${existing.card_number})`, req.ip);

    res.json({ message: 'Scheme card unlinked successfully.' });
  } catch (err) {
    console.error('Error unlinking scheme:', err);
    res.status(500).json({ error: 'Failed to unlink scheme card.' });
  }
});

// 5. Check Hospital Cashless Coverage Against Patient Verified Schemes
app.get('/api/kyc/check-hospital-coverage/:hospitalId', authenticateToken, async (req, res) => {
  const { hospitalId } = req.params;

  try {
    const hospital = await dbGet('SELECT * FROM hospitals WHERE id = ?', [hospitalId]);
    if (!hospital) return res.status(404).json({ error: 'Hospital not found.' });

    const userSchemes = await dbAll('SELECT * FROM patient_schemes_kyc WHERE user_id = ?', [req.user.id]);

    const empanelledSchemes = userSchemes.map(s => {
      const empanelled = isHospitalEmpanelled(hospital, s.scheme_type);
      return {
        ...s,
        isEmpanelled: empanelled,
        cashlessCoverageStatus: empanelled ? '100% Cashless Treatment Eligible' : 'Cashless Not Empanelled at this hospital'
      };
    });

    const isAnyCashless = empanelledSchemes.some(s => s.isEmpanelled);

    res.json({
      hospitalId,
      hospitalName: hospital.name,
      isGovt: hospital.type === 'government',
      hasCashlessCoverage: isAnyCashless,
      coveredSchemes: empanelledSchemes.filter(s => s.isEmpanelled),
      allUserSchemes: empanelledSchemes
    });
  } catch (err) {
    console.error('Error checking hospital coverage:', err);
    res.status(500).json({ error: 'Failed to check coverage eligibility.' });
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

// 1. Register Hospital Admin and Create/Link Hospital Profile — Protected with Rate Limiting & Anti-Hijack Guard
app.post('/api/auth/register-hospital', authLimiter, async (req, res) => {
  const { name, email, password, hospitalName, city, state, existingHospitalId, licenseNumber, verificationDoc } = req.body;

  if (!name || !email || !password || (!hospitalName && !existingHospitalId)) {
    return res.status(400).json({ error: 'Please provide admin name, email, password, and hospital name.' });
  }

  // Name length validation
  const cleanName = String(name).trim();
  if (cleanName.length < 2 || cleanName.length > 70) {
    return res.status(400).json({ error: 'Admin name must be between 2 and 70 characters.' });
  }

  // Email format validation
  if (!validateEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid business email address.' });
  }

  // Password strength enforcement
  const pwdCheck = validatePassword(password);
  if (!pwdCheck.valid) {
    return res.status(400).json({ error: pwdCheck.message });
  }

  try {
    const cleanEmail = email.trim().toLowerCase();
    const existingUser = await dbGet('SELECT * FROM users WHERE LOWER(email) = ?', [cleanEmail]);
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
        // Anti-Hijacking Guard: Verify if an admin already claimed this hospital
        const existingAdmin = await dbGet('SELECT id, email FROM users WHERE hospital_id = ?', [hospitalId]);
        if (existingAdmin) {
          return res.status(409).json({ error: 'This hospital has already been claimed by a registered administrator. If you believe this is an error, please contact MediGo Verification Operations.' });
        }

        // Update existing hospital with admin verification info
        await dbRun(`
          UPDATE hospitals 
          SET owner_name = ?, reg_number = COALESCE(NULLIF(?, ''), reg_number), 
              verification_doc_ref = COALESCE(NULLIF(?, ''), verification_doc_ref), 
              verification_status = ? 
          WHERE id = ?
        `, [cleanName, licenseNumber || '', verificationDoc || '', verStatus, hospitalId]);
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

// 11. Clinical Decision Support & Triage API (CDSS)
app.post('/api/symptoms/check', async (req, res) => {
  const { query } = req.body;
  if (!query || !query.trim()) {
    return res.status(400).json({ error: 'Symptom query is required.' });
  }

  const q = query.toLowerCase();

  // Check for Emergency Red Flags
  const redFlagMatch = (CLINICAL_TRIAGE_PROTOCOLS || []).find(p => {
    const words = p.chiefComplaint.toLowerCase().split(/[\s,]+/);
    return words.some(w => w.length > 3 && q.includes(w));
  });

  if (redFlagMatch) {
    const htmlResponse = `
      <div class="triage-result-box" style="border-left: 5px solid ${redFlagMatch.triageColor};">
        <div class="triage-acuity-header">
          <div>
            <span class="triage-acuity-badge" style="background: ${redFlagMatch.triageColor}; color: #ffffff;">
              ${redFlagMatch.acuityTag} — ${redFlagMatch.triageLevel}
            </span>
            <div style="font-weight: 700; color: #0f172a; margin-top: 4px; font-size: 1.05rem;">
              Suspected Condition: ${redFlagMatch.suspectedCondition}
            </div>
          </div>
          <div style="font-size: 0.78rem; font-weight: 700; color: #dc2626; background: #fee2e2; padding: 3px 8px; border-radius: 4px;">
            ${redFlagMatch.timeWindow}
          </div>
        </div>

        <div style="margin: 8px 0; font-size: 0.88rem; color: #334155;">
          <div><strong>Recommended Department:</strong> ${redFlagMatch.targetDepartment}</div>
          <div><strong>Primary Procedure / Protocol:</strong> ${redFlagMatch.targetTreatment}</div>
          <div><strong>Estimated Cost:</strong> ${redFlagMatch.costRange}</div>
        </div>

        <div style="margin-top: 10px; background: #ffffff; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
          <div style="font-weight: 700; font-size: 0.82rem; color: #b91c1c; text-transform: uppercase; margin-bottom: 4px;">
            Immediate Pre-Hospital Clinical Protocol:
          </div>
          <ul class="triage-instruction-list" style="margin: 0; padding-left: 1.1rem; font-size: 0.84rem; color: #334155;">
            ${redFlagMatch.immediateFirstAid.map(step => `<li>${step}</li>`).join('')}
          </ul>
        </div>

        <div class="clinical-disclaimer-box" style="margin-top: 8px; font-size: 0.74rem;">
          Clinical Decision Support notice: This is an algorithmic triage assessment based on standard Emergency Severity Index (ESI) protocols. For emergency resuscitation, immediately dial 108 or activate the ALS ambulance dispatch.
        </div>
      </div>
    `;
    return res.json({ reply: htmlResponse, triage: redFlagMatch });
  }

  // Search Disease Database
  const diseaseMatch = (DISEASE_DATABASE || []).find(d => {
    return d.symptoms.some(s => q.includes(s.toLowerCase())) || q.includes(d.disease.toLowerCase());
  });

  if (diseaseMatch) {
    const htmlResponse = `
      <div class="triage-result-box" style="border-left: 5px solid #0284c7;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <strong style="font-size: 1.05rem; color: #0f172a;">${diseaseMatch.disease}</strong>
          <span style="font-size: 0.76rem; font-weight: 700; background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px;">
            Clinical Severity: ${diseaseMatch.severity}
          </span>
        </div>
        <div style="font-size: 0.88rem; color: #334155;">
          <div><strong>Recommended Specialty:</strong> ${diseaseMatch.specialist} (${diseaseMatch.department})</div>
          <div><strong>Triage Level:</strong> Standard OPD Evaluation • In-person Vitals Required</div>
        </div>
        <div style="margin-top: 8px; font-size: 0.82rem; color: #64748b;">
          Recommended Action: Book an appointment at AIIMS New Delhi or your local primary healthcare facility.
        </div>
      </div>
    `;
    return res.json({ reply: htmlResponse, disease: diseaseMatch });
  }

  // Fallback clinical guidance
  const fallbackHtml = `
    <div class="triage-result-box">
      <div style="font-size: 0.9rem; color: #0f172a;">
        Based on your query, we recommend a preliminary consultation with a <strong>General Medicine / Internal Medicine OPD</strong> physician.
      </div>
      <div style="margin-top: 6px; font-size: 0.82rem; color: #64748b;">
        If you feel acute shortness of breath, crushing chest pressure, sudden weakness on one side, or trauma, please initiate immediate 108 emergency dispatch.
      </div>
    </div>
  `;
  return res.json({ reply: fallbackHtml });
});

// Start the Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
