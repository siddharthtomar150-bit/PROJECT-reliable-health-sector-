/* ==========================================================================
   HEALTHCARE SAAS ADMIN DASHBOARD JAVASCRIPT
   Handles Auth, 15 Modules Form State, Dynamic CRUD, Preview & Publish
   ========================================================================== */

const API_BASE = 'http://localhost:5000/api';

const ALL_FACILITIES = [
  'Emergency', 'ICU', 'NICU', 'PICU', 'Blood Bank', 'Pharmacy',
  'Laboratory', 'MRI', 'CT Scan', 'X-Ray', 'Ultrasound', 'Dialysis',
  'Physiotherapy', 'Operation Theatre', 'Ventilator', 'Oxygen',
  'Ambulance', 'Parking', 'Wheelchair Access', 'Cafeteria',
  'Waiting Lounge', 'Free Wi-Fi', 'ATM'
];

let state = {
  token: localStorage.getItem('hospital_admin_token') || '',
  user: null,
  hospitalData: null,
  departments: [],
  doctors: [],
  treatments: [],
  facilities: [],
  gallery: [],
  awards: []
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  renderFacilitiesCheckboxes();
  loadRegisteredHospitalsDropdown();
  if (state.token) {
    checkAuth();
  } else {
    showAuthModal();
  }
});

// Toast Alert Helper
function showToast(message, type = 'success') {
  const toast = document.getElementById('toastAlert');
  toast.innerText = message;
  toast.style.display = 'block';
  toast.style.backgroundColor = type === 'error' ? '#ef4444' : '#0f172a';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 3500);
}

// Auth Tab Switching
function switchAuthTab(tab) {
  document.getElementById('btnTabLogin').classList.toggle('active', tab === 'login');
  document.getElementById('btnTabRegister').classList.toggle('active', tab === 'register');
  document.getElementById('formLogin').classList.toggle('active', tab === 'login');
  document.getElementById('formRegister').classList.toggle('active', tab === 'register');
  if (tab === 'register') {
    loadRegisteredHospitalsDropdown();
  }
}

let allDirectoryHospitals = [];

async function loadRegisteredHospitalsDropdown() {
  const select = document.getElementById('regExistingHospital');
  const datalist = document.getElementById('hospitalDirectoryDatalist');
  if (!select || (select.options.length > 1 && datalist && datalist.options.length > 0)) return;

  try {
    const res = await fetch(`${API_BASE}/hospitals?limit=50000&lite=true`);
    if (res.ok) {
      allDirectoryHospitals = await res.json();

      // Populate Select Dropdown
      select.innerHTML = '<option value="">-- Select Existing Hospital from Directory (30,000+ Database) --</option>' +
        allDirectoryHospitals.map(h => `<option value="${h.id}">${h.name} (${h.city || h.district || h.state || 'India'})</option>`).join('');

      // Populate Datalist for Search
      if (datalist) {
        datalist.innerHTML = allDirectoryHospitals.map(h => `<option value="${h.name} (${h.city || h.district || h.state || 'India'})" data-id="${h.id}">${h.name}</option>`).join('');
      }

      select.onchange = (e) => {
        selectAndAutoDetectHospital(e.target.value);
      };
    }
  } catch (err) {
    console.error('Error loading directory dropdown:', err);
  }
}

function onDirectoryHospitalSearch(input) {
  const val = input.value.trim().toLowerCase();
  if (!val) return;

  const found = allDirectoryHospitals.find(h => 
    h.name.toLowerCase() === val ||
    `${h.name} (${h.city || h.district || h.state || 'India'})`.toLowerCase() === val
  );

  if (found) {
    document.getElementById('regExistingHospital').value = found.id;
    selectAndAutoDetectHospital(found.id);
  }
}

function autoDetectHospitalOwner(hosp) {
  if (hosp.owner_name) return hosp.owner_name;
  if (hosp.admin_name) return hosp.admin_name;
  if (hosp.doctors && hosp.doctors.length > 0 && hosp.doctors[0].name) {
    return hosp.doctors[0].name;
  }
  if (hosp.tagline && hosp.tagline.includes('Dr.')) {
    const match = hosp.tagline.match(/(Dr\.\s+[A-Za-z\s\.]+)/);
    if (match) return match[1].trim();
  }
  const cleanName = (hosp.name || '').replace(/(Hospital|Medical|College|Institute|Center|Centre|Super|Specialty|Govt|Government|Private|Pvt|Ltd)/gi, '').trim();
  return `Dr. ${cleanName || 'Medical Director'} (Administrator)`;
}

function selectAndAutoDetectHospital(hospitalId) {
  if (!hospitalId) return;
  const hosp = allDirectoryHospitals.find(h => h.id === hospitalId);
  if (!hosp) return;

  // Auto fill Hospital Name
  const nameInput = document.getElementById('regHospitalName');
  if (nameInput) nameInput.value = hosp.name || '';

  // Auto Detect Owner / Administrator Name
  const adminInput = document.getElementById('regAdminName');
  if (adminInput) adminInput.value = autoDetectHospitalOwner(hosp);

  // Auto fill City & State
  const cityInput = document.getElementById('regCity');
  if (cityInput) cityInput.value = hosp.city || hosp.district || '';

  const stateInput = document.getElementById('regState');
  if (stateInput) stateInput.value = hosp.state || '';

  // Auto fill Work Email
  const emailInput = document.getElementById('regEmail');
  if (emailInput && (!emailInput.value || emailInput.value.includes('@metrohospital.com'))) {
    const slug = (hosp.name || 'hospital').toLowerCase().replace(/[^a-z0-9]/g, '');
    emailInput.value = hosp.email || `admin@${slug || 'medigo'}.com`;
  }

  showToast(`Auto-detected details for ${hosp.name}!`, 'success');
}

function showAuthModal() {
  document.getElementById('authModal').style.display = 'flex';
  document.getElementById('appLayout').style.display = 'none';
}

function hideAuthModal() {
  document.getElementById('authModal').style.display = 'none';
  document.getElementById('appLayout').style.display = 'flex';
}

// Mobile Sidebar Toggle
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('mobile-open');
}

// Check Authenticated User
async function checkAuth() {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (!res.ok) throw new Error('Session expired');
    const data = await res.json();

    if (data.user.role !== 'admin' || !data.user.hospitalId) {
      showToast('Access denied. Please log in as a Hospital Admin.', 'error');
      handleLogout();
      return;
    }

    state.user = data.user;
    document.getElementById('headerUserName').innerText = data.user.name || 'Admin';
    hideAuthModal();
    await fetchFullProfile();
  } catch (err) {
    console.error('Auth verification failed:', err);
    handleLogout();
  }
}

// Handle Admin Login
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');

    if (data.user.role !== 'admin') {
      showToast('Login restricted to Hospital Admin accounts.', 'error');
      return;
    }

    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('hospital_admin_token', data.token);

    hideAuthModal();
    showToast('Logged in successfully!');
    await fetchFullProfile();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function readDocFileAsBase64(file) {
  return new Promise((resolve) => {
    if (!file) return resolve('');
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

// Handle Hospital Registration
async function handleRegister(e) {
  e.preventDefault();
  const existingSelect = document.getElementById('regExistingHospital');
  const existingHospitalId = existingSelect ? existingSelect.value : '';
  const hospitalName = document.getElementById('regHospitalName').value.trim();
  const name = document.getElementById('regAdminName').value.trim();
  const city = document.getElementById('regCity').value.trim();
  const stateVal = document.getElementById('regState').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const licenseNumber = document.getElementById('regLicenseNumber') ? document.getElementById('regLicenseNumber').value.trim() : '';
  const fileInput = document.getElementById('regDocFile');
  const verificationDoc = fileInput && fileInput.files.length > 0 ? await readDocFileAsBase64(fileInput.files[0]) : '';

  try {
    const res = await fetch(`${API_BASE}/auth/register-hospital`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hospitalName, name, city, state: stateVal, email, password, existingHospitalId, licenseNumber, verificationDoc })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');

    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('hospital_admin_token', data.token);

    hideAuthModal();
    showToast('Hospital account registered successfully! Enter your details below.');
    await fetchFullProfile();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Logout
function handleLogout() {
  localStorage.removeItem('hospital_admin_token');
  state.token = '';
  state.user = null;
  state.hospitalData = null;
  showAuthModal();
}

// Switch Sidebar Tabs
function switchTab(tabId) {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === `tab-${tabId}`);
  });

  document.getElementById('sidebar').classList.remove('mobile-open');
}

// Render Facilities Toggle Checkboxes
function renderFacilitiesCheckboxes() {
  const container = document.getElementById('facilitiesGrid');
  container.innerHTML = ALL_FACILITIES.map(fac => `
    <label class="facility-card-toggle">
      <input type="checkbox" value="${fac}" class="facility-checkbox" onchange="updateFacilitiesState()" />
      <span class="toggle-label">${fac}</span>
    </label>
  `).join('');
}

function updateFacilitiesState() {
  state.facilities = Array.from(document.querySelectorAll('.facility-checkbox:checked')).map(cb => cb.value);
  document.getElementById('statFacilitiesCount').innerText = state.facilities.length;
}

// Fetch Full Hospital Admin Profile (All 15 Modules)
async function fetchFullProfile() {
  try {
    const res = await fetch(`${API_BASE}/hospital-admin/full-profile`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (!res.ok) throw new Error('Failed to load profile');
    const data = await res.json();

    state.hospitalData = data.hospital;
    state.departments = data.departments || [];
    state.doctors = data.doctors || [];
    state.treatments = data.treatments || [];
    state.facilities = data.facilities || [];
    state.gallery = data.gallery || [];
    state.awards = data.awards || [];

    populateFormFields();
    renderOverviewStats();
    renderDepartmentsTable();
    renderDoctorsTable();
    renderTreatmentsTable();
    renderGalleryGrid();
    renderAwardsGrid();
  } catch (err) {
    console.error(err);
    showToast(err.message, 'error');
  }
}

// Populate UI Form Fields from State
function populateFormFields() {
  const h = state.hospitalData;
  if (!h) return;

  // Header Elements
  document.getElementById('headerHospitalName').innerText = h.name || 'Hospital Name';
  const statusBadge = document.getElementById('headerStatusBadge');
  statusBadge.innerText = h.status === 'published' ? 'Published Live' : 'Draft';
  statusBadge.className = `hosp-status-pill ${h.status === 'published' ? 'published' : 'draft'}`;

  const bannerStatus = document.getElementById('overviewStatusBanner');
  bannerStatus.className = `status-indicator-lg ${h.status === 'published' ? 'published' : ''}`;
  bannerStatus.querySelector('.status-title-text').innerText = `Profile Status: ${h.status === 'published' ? 'Published Live' : 'Draft'}`;

  if (h.logo) {
    document.getElementById('headerLogoThumb').innerHTML = `<img src="${h.logo}" alt="Logo" />`;
    document.getElementById('pLogoPreview').innerHTML = `<img src="${h.logo}" alt="Logo" />`;
    document.getElementById('profLogoData').value = h.logo;
  }
  if (h.coverImage) {
    document.getElementById('pCoverPreview').innerHTML = `<img src="${h.coverImage}" alt="Cover" />`;
    document.getElementById('profCoverData').value = h.coverImage;
  }

  // 2. Profile Module
  document.getElementById('profName').value = h.name || '';
  document.getElementById('profType').value = h.type || 'private';
  document.getElementById('profRegNumber').value = h.regNumber || '';
  document.getElementById('profEstYear').value = h.estYear || '';
  document.getElementById('profAccreditation').value = h.accreditation || '';
  document.getElementById('profAbout').value = h.about || '';
  document.getElementById('profDescription').value = h.description || '';
  document.getElementById('profAddress').value = h.address || '';
  document.getElementById('profCity').value = h.city || '';
  document.getElementById('profState').value = h.state || '';
  document.getElementById('profPincode').value = h.pincode || '';
  document.getElementById('profMapsUrl').value = h.googleMapsUrl || '';
  document.getElementById('profWorkingHours').value = h.workingHours || '24x7';
  document.getElementById('profIs247').checked = h.is247;

  // 6. Facilities Checkboxes
  document.querySelectorAll('.facility-checkbox').forEach(cb => {
    cb.checked = state.facilities.includes(cb.value);
  });

  // 8. Room & Bed Management
  const b = h.beds || {};
  document.getElementById('bedGenTotal').value = b.generalTotal || 0;
  document.getElementById('bedGenAvail').value = b.generalAvailable || 0;
  document.getElementById('bedIcuTotal').value = b.icuTotal || 0;
  document.getElementById('bedIcuAvail').value = b.icuAvailable || 0;
  document.getElementById('bedEmgTotal').value = b.emergencyTotal || 0;
  document.getElementById('bedEmgAvail').value = b.emergencyBedsAvailable || 0;
  document.getElementById('roomPrivate').value = b.privateRooms || 0;
  document.getElementById('roomDeluxe').value = b.deluxeRooms || 0;
  document.getElementById('roomVip').value = b.vipRooms || 0;

  // 9. Pricing
  const p = h.pricing || {};
  document.getElementById('priceOpd').value = p.opd || 500;
  document.getElementById('priceEmergency').value = p.emergency || 1000;
  document.getElementById('priceIcu').value = p.icu || 5000;
  document.getElementById('priceRoom').value = p.room || 2000;
  document.getElementById('priceSurgeryPackages').value = p.surgeryPackages || '';
  document.getElementById('priceDiagnosticTests').value = p.diagnosticTests || '';

  // 10. Laboratory
  const l = h.lab || {};
  document.getElementById('labTests').value = l.tests || '';
  document.getElementById('labHomeSample').checked = !!l.homeSample;
  document.getElementById('labDeliveryTime').value = l.reportDeliveryTime || '24 Hours';

  // 11. Pharmacy
  const ph = h.pharmacy || {};
  document.getElementById('pharmacyIs247').checked = ph.is247 !== false;
  document.getElementById('pharmacyHomeDelivery').checked = !!ph.homeDelivery;
  document.getElementById('pharmacyEmergencyMedicines').value = ph.emergencyMedicines || '';

  // 12. Ambulance
  const amb = h.ambulance || {};
  document.getElementById('ambCount').value = amb.count || 1;
  document.getElementById('ambPhone').value = amb.phone || h.contactNumber || '';
  document.getElementById('ambCharges').value = amb.charges || '';
  document.getElementById('ambAvailable').checked = amb.available !== false;

  // 13. Insurance & Govt Schemes
  const ins = h.insurance || {};
  document.getElementById('insAyushman').checked = ins.ayushmanBharat !== false;
  document.getElementById('insCGHS').checked = !!ins.cghs;
  document.getElementById('insECHS').checked = !!ins.echs;
  document.getElementById('insCashless').checked = ins.cashless !== false;
  document.getElementById('insCompanies').value = ins.companies || '';

  // 15. Contact Info
  const cs = h.contactSocial || {};
  document.getElementById('cntReception').value = h.contactNumber || '';
  document.getElementById('cntEmergency').value = h.emergencyNumber || '';
  document.getElementById('cntWhatsapp').value = cs.whatsapp || '';
  document.getElementById('cntEmail').value = h.email || '';
  document.getElementById('cntWebsite').value = h.website || '';
  document.getElementById('cntFacebook').value = cs.facebook || '';
  document.getElementById('cntInstagram').value = cs.instagram || '';
  document.getElementById('cntLinkedin').value = cs.linkedin || '';
  document.getElementById('cntTwitter').value = cs.twitter || '';
}

// Render Overview Statistics
function renderOverviewStats() {
  document.getElementById('statDoctorsCount').innerText = state.doctors.length;
  document.getElementById('statDeptsCount').innerText = state.departments.length;

  const genTot = parseInt(document.getElementById('bedGenTotal').value, 10) || 0;
  const icuTot = parseInt(document.getElementById('bedIcuTotal').value, 10) || 0;
  const emgTot = parseInt(document.getElementById('bedEmgTotal').value, 10) || 0;

  const genAvail = parseInt(document.getElementById('bedGenAvail').value, 10) || 0;
  const icuAvail = parseInt(document.getElementById('bedIcuAvail').value, 10) || 0;
  const emgAvail = parseInt(document.getElementById('bedEmgAvail').value, 10) || 0;

  document.getElementById('statTotalBeds').innerText = genTot + icuTot + emgTot;
  document.getElementById('statAvailBeds').innerText = genAvail + icuAvail + emgAvail;
  document.getElementById('statTreatmentsCount').innerText = state.treatments.length;
  document.getElementById('statFacilitiesCount').innerText = state.facilities.length;
}

// Collect All Form Values across 15 Modules
function collectFormData(status = 'draft') {
  updateFacilitiesState();

  return {
    name: document.getElementById('profName').value.trim() || 'Hospital Name',
    logo: document.getElementById('profLogoData').value,
    coverImage: document.getElementById('profCoverData').value,
    type: document.getElementById('profType').value,
    regNumber: document.getElementById('profRegNumber').value.trim(),
    estYear: document.getElementById('profEstYear').value.trim(),
    accreditation: document.getElementById('profAccreditation').value.trim(),
    about: document.getElementById('profAbout').value.trim(),
    description: document.getElementById('profDescription').value.trim(),
    address: document.getElementById('profAddress').value.trim(),
    city: document.getElementById('profCity').value.trim(),
    state: document.getElementById('profState').value.trim(),
    pincode: document.getElementById('profPincode').value.trim(),
    googleMapsUrl: document.getElementById('profMapsUrl').value.trim(),
    workingHours: document.getElementById('profWorkingHours').value.trim(),
    is247: document.getElementById('profIs247').checked,
    status: status,

    contactNumber: document.getElementById('cntReception').value.trim(),
    emergencyNumber: document.getElementById('cntEmergency').value.trim(),
    email: document.getElementById('cntEmail').value.trim(),
    website: document.getElementById('cntWebsite').value.trim(),

    beds: {
      generalTotal: parseInt(document.getElementById('bedGenTotal').value, 10) || 0,
      generalAvailable: parseInt(document.getElementById('bedGenAvail').value, 10) || 0,
      icuTotal: parseInt(document.getElementById('bedIcuTotal').value, 10) || 0,
      icuAvailable: parseInt(document.getElementById('bedIcuAvail').value, 10) || 0,
      emergencyTotal: parseInt(document.getElementById('bedEmgTotal').value, 10) || 0,
      emergencyBedsAvailable: parseInt(document.getElementById('bedEmgAvail').value, 10) || 0,
      privateRooms: parseInt(document.getElementById('roomPrivate').value, 10) || 0,
      deluxeRooms: parseInt(document.getElementById('roomDeluxe').value, 10) || 0,
      vipRooms: parseInt(document.getElementById('roomVip').value, 10) || 0
    },
    pricing: {
      opd: parseInt(document.getElementById('priceOpd').value, 10) || 0,
      emergency: parseInt(document.getElementById('priceEmergency').value, 10) || 0,
      icu: parseInt(document.getElementById('priceIcu').value, 10) || 0,
      room: parseInt(document.getElementById('priceRoom').value, 10) || 0,
      surgeryPackages: document.getElementById('priceSurgeryPackages').value.trim(),
      diagnosticTests: document.getElementById('priceDiagnosticTests').value.trim()
    },
    lab: {
      tests: document.getElementById('labTests').value.trim(),
      homeSample: document.getElementById('labHomeSample').checked,
      reportDeliveryTime: document.getElementById('labDeliveryTime').value.trim()
    },
    pharmacy: {
      is247: document.getElementById('pharmacyIs247').checked,
      homeDelivery: document.getElementById('pharmacyHomeDelivery').checked,
      emergencyMedicines: document.getElementById('pharmacyEmergencyMedicines').value.trim()
    },
    ambulance: {
      count: parseInt(document.getElementById('ambCount').value, 10) || 0,
      phone: document.getElementById('ambPhone').value.trim(),
      charges: document.getElementById('ambCharges').value.trim(),
      available: document.getElementById('ambAvailable').checked
    },
    insurance: {
      ayushmanBharat: document.getElementById('insAyushman').checked,
      cghs: document.getElementById('insCGHS').checked,
      echs: document.getElementById('insECHS').checked,
      cashless: document.getElementById('insCashless').checked,
      companies: document.getElementById('insCompanies').value.trim()
    },
    contactSocial: {
      whatsapp: document.getElementById('cntWhatsapp').value.trim(),
      facebook: document.getElementById('cntFacebook').value.trim(),
      instagram: document.getElementById('cntInstagram').value.trim(),
      linkedin: document.getElementById('cntLinkedin').value.trim(),
      twitter: document.getElementById('cntTwitter').value.trim()
    },
    facilities: state.facilities
  };
}

// Save Draft Profile API
async function saveDraftProfile() {
  const payload = collectFormData('draft');

  try {
    const res = await fetch(`${API_BASE}/hospital-admin/full-profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save draft');

    showToast('💾 Hospital profile draft saved!');
    await fetchFullProfile();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Publish Profile Live API
async function publishProfile() {
  const payload = collectFormData('published');

  try {
    const res = await fetch(`${API_BASE}/hospital-admin/full-profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to publish');

    showToast('🚀 Hospital profile published live on public search!');
    await fetchFullProfile();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// File Upload Handler (Base64 Reader)
function handleFileUpload(event, previewId, hiddenInputId) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const dataUrl = e.target.result;
    document.getElementById(hiddenInputId).value = dataUrl;
    document.getElementById(previewId).innerHTML = `<img src="${dataUrl}" alt="Preview" />`;
  };
  reader.readAsDataURL(file);
}

// ==================== DEPARTMENTS MODULE CRUD ====================
function renderDepartmentsTable() {
  const tbody = document.getElementById('deptTableBody');
  const deptSelect = document.getElementById('docDeptSelect');

  if (state.departments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#94a3b8;">No departments added yet.</td></tr>`;
    deptSelect.innerHTML = `<option value="General">General Care</option>`;
    return;
  }

  tbody.innerHTML = state.departments.map(d => `
    <tr>
      <td><strong>${d.name}</strong></td>
      <td>${d.head || 'N/A'}</td>
      <td>${d.floor || 'N/A'}</td>
      <td>${d.description || '-'}</td>
      <td>
        <button type="button" class="btn-danger-sm" onclick="deleteDepartment(${d.id})">Delete</button>
      </td>
    </tr>
  `).join('');

  deptSelect.innerHTML = state.departments.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
}

async function addDepartment() {
  const name = document.getElementById('deptName').value.trim();
  const head = document.getElementById('deptHead').value.trim();
  const floor = document.getElementById('deptFloor').value.trim();
  const description = document.getElementById('deptDesc').value.trim();

  if (!name) {
    showToast('Please enter department name.', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/hospital-admin/departments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ name, head, floor, description })
    });
    if (!res.ok) throw new Error('Failed to add department');

    document.getElementById('deptName').value = '';
    document.getElementById('deptHead').value = '';
    document.getElementById('deptFloor').value = '';
    document.getElementById('deptDesc').value = '';

    showToast('Department added!');
    await fetchFullProfile();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteDepartment(id) {
  try {
    const res = await fetch(`${API_BASE}/hospital-admin/departments/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (!res.ok) throw new Error('Failed to delete department');
    showToast('Department removed.');
    await fetchFullProfile();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==================== DOCTORS MODULE CRUD ====================
function renderDoctorsTable() {
  const tbody = document.getElementById('doctorsTableBody');
  if (state.doctors.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#94a3b8;">No doctors added to roster yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.doctors.map(d => `
    <tr>
      <td><strong>${d.name}</strong></td>
      <td>${d.spec}<br/><small style="color:#64748b;">${d.department || 'General'}</small></td>
      <td>${d.qualification || 'MBBS'}</td>
      <td>${d.exp || '5 yrs'}</td>
      <td>₹${d.fee || 500}</td>
      <td>${d.opd_timing || '10AM-2PM'}<br/><small style="color:#0284c7;">${d.available_days || 'Mon-Sat'}</small></td>
      <td>
        <button type="button" class="btn-danger-sm" onclick="deleteDoctor(${d.id})">Delete</button>
      </td>
    </tr>
  `).join('');
}

async function addDoctor() {
  const name = document.getElementById('docName').value.trim();
  const spec = document.getElementById('docSpec').value.trim();
  const department = document.getElementById('docDeptSelect').value;
  const qualification = document.getElementById('docQual').value.trim();
  const exp = document.getElementById('docExp').value.trim();
  const fee = document.getElementById('docFee').value;
  const opdTiming = document.getElementById('docTiming').value.trim();
  const availableDays = document.getElementById('docDays').value.trim();
  const languages = document.getElementById('docLanguages').value.trim();

  if (!name || !spec) {
    showToast('Please enter doctor name and specialization.', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/hospital-admin/doctors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ name, spec, department, qualification, exp, fee, opdTiming, availableDays, languages })
    });
    if (!res.ok) throw new Error('Failed to add doctor');

    document.getElementById('docName').value = '';
    document.getElementById('docSpec').value = '';
    document.getElementById('docQual').value = '';
    document.getElementById('docExp').value = '';
    document.getElementById('docFee').value = '';

    showToast('Doctor added to roster!');
    await fetchFullProfile();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteDoctor(id) {
  try {
    const res = await fetch(`${API_BASE}/hospital-admin/doctors/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (!res.ok) throw new Error('Failed to delete doctor');
    showToast('Doctor removed.');
    await fetchFullProfile();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==================== TREATMENTS MODULE CRUD ====================
function renderTreatmentsTable() {
  const tbody = document.getElementById('treatmentsTableBody');
  if (state.treatments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#94a3b8;">No treatments or surgeries added yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.treatments.map(t => `
    <tr>
      <td><strong>${t.name}</strong></td>
      <td>${t.department || t.category || 'General'}</td>
      <td><strong>₹${t.cost.toLocaleString()}</strong></td>
      <td>${t.duration || '1 Day'}</td>
      <td>${t.description || '-'}</td>
      <td>
        <button type="button" class="btn-danger-sm" onclick="deleteTreatment('${t.id}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

async function addTreatment() {
  const name = document.getElementById('treatName').value.trim();
  const department = document.getElementById('treatDept').value.trim();
  const cost = document.getElementById('treatCost').value;
  const duration = document.getElementById('treatDuration').value.trim();
  const description = document.getElementById('treatDesc').value.trim();

  if (!name || !cost) {
    showToast('Treatment name and cost are required.', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/hospital-admin/treatments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ name, department, cost, duration, description })
    });
    if (!res.ok) throw new Error('Failed to add treatment');

    document.getElementById('treatName').value = '';
    document.getElementById('treatDept').value = '';
    document.getElementById('treatCost').value = '';
    document.getElementById('treatDuration').value = '';
    document.getElementById('treatDesc').value = '';

    showToast('Treatment added!');
    await fetchFullProfile();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteTreatment(id) {
  try {
    const res = await fetch(`${API_BASE}/hospital-admin/treatments/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (!res.ok) throw new Error('Failed to delete treatment');
    showToast('Treatment removed.');
    await fetchFullProfile();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==================== GALLERY MODULE CRUD ====================
function renderGalleryGrid() {
  const grid = document.getElementById('galleryGrid');
  if (state.gallery.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #94a3b8; padding: 20px;">No photos uploaded yet.</div>`;
    return;
  }

  grid.innerHTML = state.gallery.map(img => `
    <div class="gallery-card">
      <img src="${img.image_url}" alt="${img.caption}" />
      <div class="gallery-card-info">
        <span>${img.caption || 'Hospital Photo'}</span>
        <button type="button" class="btn-danger-sm" onclick="deleteGalleryImage(${img.id})">✕</button>
      </div>
    </div>
  `).join('');
}

async function addGalleryImage() {
  const category = document.getElementById('galleryCategory').value;
  const fileInput = document.getElementById('galleryFile');
  const caption = document.getElementById('galleryCaption').value.trim();

  const file = fileInput.files[0];
  if (!file) {
    showToast('Please select a photo file.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = async function (e) {
    const imageUrl = e.target.result;

    try {
      const res = await fetch(`${API_BASE}/hospital-admin/gallery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.token}`
        },
        body: JSON.stringify({ category, imageUrl, caption })
      });
      if (!res.ok) throw new Error('Failed to upload photo');

      fileInput.value = '';
      document.getElementById('galleryCaption').value = '';
      showToast('Photo uploaded to gallery!');
      await fetchFullProfile();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
  reader.readAsDataURL(file);
}

async function deleteGalleryImage(id) {
  try {
    const res = await fetch(`${API_BASE}/hospital-admin/gallery/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (!res.ok) throw new Error('Failed to delete photo');
    showToast('Photo deleted.');
    await fetchFullProfile();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==================== AWARDS & CERTS MODULE CRUD ====================
function renderAwardsGrid() {
  const grid = document.getElementById('awardsGrid');
  if (state.awards.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #94a3b8; padding: 20px;">No certificates uploaded yet.</div>`;
    return;
  }

  grid.innerHTML = state.awards.map(a => `
    <div class="award-item-card">
      <span class="award-type-tag">${a.type}</span>
      <strong>${a.title}</strong>
      <small style="color: #64748b;">${a.issue_date || 'Valid'}</small>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
        ${a.file_url ? `<a href="${a.file_url}" target="_blank" class="btn btn-outline btn-sm">📄 View Doc</a>` : ''}
        <button type="button" class="btn-danger-sm" onclick="deleteAwardDoc(${a.id})">Delete</button>
      </div>
    </div>
  `).join('');
}

async function addAwardDoc() {
  const title = document.getElementById('awardTitle').value.trim();
  const type = document.getElementById('awardType').value;
  const issueDate = document.getElementById('awardDate').value.trim();
  const fileInput = document.getElementById('awardFile');

  if (!title) {
    showToast('Document title required.', 'error');
    return;
  }

  const file = fileInput.files[0];
  const uploadAndSave = async (fileUrl = '') => {
    try {
      const res = await fetch(`${API_BASE}/hospital-admin/awards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.token}`
        },
        body: JSON.stringify({ title, type, issueDate, fileUrl, fileType: file ? file.type : 'Doc' })
      });
      if (!res.ok) throw new Error('Failed to save document');

      document.getElementById('awardTitle').value = '';
      document.getElementById('awardDate').value = '';
      fileInput.value = '';

      showToast('Accreditation certificate added!');
      await fetchFullProfile();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  if (file) {
    const reader = new FileReader();
    reader.onload = e => uploadAndSave(e.target.result);
    reader.readAsDataURL(file);
  } else {
    uploadAndSave('');
  }
}

async function deleteAwardDoc(id) {
  try {
    const res = await fetch(`${API_BASE}/hospital-admin/awards/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (!res.ok) throw new Error('Failed to delete document');
    showToast('Document removed.');
    await fetchFullProfile();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ==================== LIVE PATIENT VIEW SIMULATOR (PREVIEW MODAL) ====================
function openPreviewModal() {
  const data = collectFormData(state.hospitalData ? state.hospitalData.status : 'draft');

  const content = document.getElementById('previewContent');

  content.innerHTML = `
    <div class="patient-preview-card">
      <div class="patient-cover-banner" style="background-image: url('${data.coverImage || 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1000&q=80'}');"></div>

      <div class="patient-header-content">
        <div class="patient-logo-box">
          ${data.logo ? `<img src="${data.logo}" alt="Logo" />` : '🏥'}
        </div>
        <div class="patient-meta-details">
          <h2 class="patient-hosp-name">${data.name}</h2>
          <p class="patient-tagline">${data.about || 'Multi-Specialty Healthcare Facility'}</p>

          <div class="patient-badges-row">
            <span class="badge-tag primary">${data.type.toUpperCase()}</span>
            ${data.accreditation ? `<span class="badge-tag success">🏆 ${data.accreditation}</span>` : ''}
            ${data.is247 ? `<span class="badge-tag success">🚨 24x7 Emergency</span>` : ''}
          </div>
        </div>
      </div>

      <div class="preview-section">
        <h4 class="preview-section-title">📍 Address & Location</h4>
        <p style="font-size: 0.9rem; color: #475569;">${data.address ? `${data.address}, ` : ''}${data.city}, ${data.state} ${data.pincode}</p>
        <p style="font-size: 0.85rem; color: #0284c7; margin-top: 4px;">📞 Contact: ${data.contactNumber || 'N/A'} &nbsp;|&nbsp; 🚨 Emergency: ${data.emergencyNumber || '108'}</p>
      </div>

      <div class="preview-section">
        <h4 class="preview-section-title">🛏️ Live Bed Capacity Status</h4>
        <div style="display: flex; gap: 16px; flex-wrap: wrap;">
          <div style="background: #f1f5f9; padding: 10px 16px; border-radius: 8px;">
            <div style="font-size: 0.75rem; color: #64748b;">GENERAL BEDS</div>
            <strong style="font-size: 1.1rem; color: #16a34a;">${data.beds.generalAvailable} / ${data.beds.generalTotal} Available</strong>
          </div>
          <div style="background: #f1f5f9; padding: 10px 16px; border-radius: 8px;">
            <div style="font-size: 0.75rem; color: #64748b;">ICU BEDS</div>
            <strong style="font-size: 1.1rem; color: #9333ea;">${data.beds.icuAvailable} / ${data.beds.icuTotal} Available</strong>
          </div>
          <div style="background: #f1f5f9; padding: 10px 16px; border-radius: 8px;">
            <div style="font-size: 0.75rem; color: #64748b;">EMERGENCY BEDS</div>
            <strong style="font-size: 1.1rem; color: #dc2626;">${data.beds.emergencyBedsAvailable} / ${data.beds.emergencyTotal} Available</strong>
          </div>
        </div>
      </div>

      <div class="preview-section">
        <h4 class="preview-section-title">⚡ Available Facilities</h4>
        <div class="preview-chips-list">
          ${data.facilities.map(f => `<span class="chip-item">✅ ${f}</span>`).join('')}
        </div>
      </div>

      <div class="preview-section">
        <h4 class="preview-section-title">👨‍⚕️ Doctors Roster (${state.doctors.length})</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px;">
          ${state.doctors.map(d => `
            <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px;">
              <strong>${d.name}</strong><br/>
              <small style="color: #0284c7;">${d.spec}</small><br/>
              <small style="color: #64748b;">Fee: ₹${d.fee} | ${d.opd_timing}</small>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="preview-section">
        <h4 class="preview-section-title">💉 Treatments & Costs (${state.treatments.length})</h4>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${state.treatments.map(t => `
            <div style="display: flex; justify-content: space-between; font-size: 0.88rem; padding: 6px 0; border-bottom: 1px dashed #e2e8f0;">
              <span>${t.name} (${t.duration})</span>
              <strong style="color: #0f172a;">₹${t.cost.toLocaleString()}</strong>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  document.getElementById('previewModal').style.display = 'flex';
}

function closePreviewModal() {
  document.getElementById('previewModal').style.display = 'none';
}
