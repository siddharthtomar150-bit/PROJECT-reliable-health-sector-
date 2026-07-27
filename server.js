import express from 'express';
import cors from 'cors';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { initDb, dbGet, dbAll, dbRun } from './database.js';
import { SYMPTOM_DATABASE } from './data.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = 'healthrought_super_secret_jwt_key_2026';

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

// 1. Register User
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role, hospitalId } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Please provide name, email, password and role.' });
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

    // Insert user
    const result = await dbRun(
      'INSERT INTO users (name, email, password, role, hospital_id) VALUES (?, ?, ?, ?, ?)',
      [name, email, hashedPassword, role, hospitalId || null]
    );

    // Create Token
    const token = jwt.sign(
      { id: result.id, name, email, role, hospitalId },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: result.id, name, email, role, hospitalId }
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
    const numLimit = Math.min(parseInt(limit, 10) || 100, 500);
    const numOffset = parseInt(offset, 10) || 0;

    const hospitals = await dbAll(`SELECT * FROM hospitals ${whereSql} LIMIT ? OFFSET ?`, [...params, numLimit, numOffset]);
    
    if (hospitals.length === 0) {
      return res.json([]);
    }

    const hospIds = hospitals.map(h => h.id);
    const placeholders = hospIds.map(() => '?').join(',');

    const treatments = await dbAll(`SELECT * FROM treatments WHERE hospital_id IN (${placeholders})`, hospIds);
    const doctors = await dbAll(`SELECT * FROM doctors WHERE hospital_id IN (${placeholders})`, hospIds);
    const facilities = await dbAll(`SELECT * FROM facilities WHERE hospital_id IN (${placeholders})`, hospIds);

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

// ==================== BOOKINGS API ====================

// Get bookings based on user role
app.get('/api/bookings', authenticateToken, async (req, res) => {
  try {
    let bookings;
    if (req.user.role === 'patient') {
      bookings = await dbAll('SELECT * FROM bookings WHERE patient_name = ?', [req.user.name]);
    } else if (req.user.role === 'admin') {
      bookings = await dbAll('SELECT * FROM bookings WHERE hospital_id = ?', [req.user.hospitalId]);
    } else {
      // Driver gets all bookings (or active ones)
      bookings = await dbAll('SELECT * FROM bookings');
    }
    res.json(bookings);
  } catch (err) {
    console.error('Error retrieving bookings:', err);
    res.status(500).json({ error: 'Failed to retrieve bookings.' });
  }
});

// Create Booking (Patient only)
app.post('/api/bookings', authenticateToken, async (req, res) => {
  const { hospitalId, hospitalName, ambulanceType, pickupLocation, dropLocation, fare } = req.body;

  if (req.user.role !== 'patient') {
    return res.status(403).json({ error: 'Only patients can book ambulances.' });
  }

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

// Get health records for patient
app.get('/api/records', authenticateToken, async (req, res) => {
  if (req.user.role !== 'patient') {
    return res.status(403).json({ error: 'Only patients have access to health vaults.' });
  }

  try {
    const records = await dbAll('SELECT * FROM health_records WHERE user_id = ?', [req.user.id]);
    res.json(records);
  } catch (err) {
    console.error('Error fetching records:', err);
    res.status(500).json({ error: 'Failed to retrieve digital health records.' });
  }
});

// ==================== AI SYMPTOM CHECKER API ====================

// Symptom Chat Endpoint
app.post('/api/symptoms/check', async (req, res) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Query is required.' });
  }

  const match = SYMPTOM_DATABASE.find(s => 
    s.symptom.toLowerCase().includes(query.toLowerCase()) || 
    query.toLowerCase().includes(s.suggestedTreatment.toLowerCase())
  );

  if (match) {
    return res.json({
      reply: `
        <strong>💡 AI Medical Recommendation:</strong><br/>
        • <strong>Department:</strong> ${match.suggestedDepartment}<br/>
        • <strong>Suggested Treatment:</strong> ${match.suggestedTreatment}<br/>
        • <strong>Urgency Level:</strong> <span style="color: #ef4444; font-weight:700;">${match.urgency}</span><br/>
        • <strong>Est. Treatment Cost:</strong> ${match.estimatedCostRange}<br/>
        <em>Tip: Click "Search Hospitals" to filter hospitals providing this procedure.</em>
      `
    });
  }

  res.json({
    reply: `
      Based on your symptom ("${query}"), we recommend consulting a <strong>General Physician</strong> for immediate assessment. Recommended nearby hospitals with active OPD: City Care Hospital & Apex Heart Institute.
    `
  });
});

// Start the Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
