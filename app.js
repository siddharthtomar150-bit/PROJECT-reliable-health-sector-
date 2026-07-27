// Main Application Controller - State & API Synchronization Manager

import { 
  renderPatientSearch, 
  toggleCompareHospital, 
  renderComparisonModal, 
  initLiveTrackingMap,
  renderHospitalsMap
} from './patient.js';
import { renderHospitalAdmin } from './hospital.js';

let state = {
  hospitals: [],
  currentUser: null,
  activeRole: 'patient', // 'patient' | 'admin' | 'driver'
  searchKeyword: '',
  selectedState: 'all',
  selectedDistrict: 'all',
  activeTreatmentFilter: 'all',
  activeHospType: 'all', // 'all' | 'government' | 'private'
  maxBudget: 200000,
  emergencyOnly: false,
  activeAdminHospitalId: null,
  activeTabPatient: 'search', // 'search' | 'ambulance' | 'ai' | 'records'
  metaData: { states: [], districtsByState: {} }
};

// Get Authorization headers for API calls
export function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return token 
    ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

export function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  if (type === 'success') toast.style.borderLeftColor = '#10b981';
  if (type === 'danger') toast.style.borderLeftColor = '#ef4444';
  if (type === 'warning') toast.style.borderLeftColor = '#f59e0b';

  toast.innerHTML = `<span>ℹ️</span> <div>${message}</div>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}

// Fetch State and District Metadata from FastAPI backend
async function fetchHospitalMeta() {
  try {
    const res = await fetch('http://localhost:8000/api/hospitals/meta');
    if (res.ok) {
      state.metaData = await res.json();
      populateMetaDropdowns();
    } else {
      // Fallback to local server if FastAPI loading
      const resLocal = await fetch('/api/hospitals/meta');
      if (resLocal.ok) {
        state.metaData = await resLocal.json();
        populateMetaDropdowns();
      }
    }
  } catch (err) {
    console.error('Error fetching metadata from FastAPI:', err);
    try {
      const resLocal = await fetch('/api/hospitals/meta');
      if (resLocal.ok) {
        state.metaData = await resLocal.json();
        populateMetaDropdowns();
      }
    } catch (e) {}
  }
}

function populateMetaDropdowns() {
  const stateSelect = document.getElementById('stateSelect');
  if (!stateSelect) return;

  stateSelect.innerHTML = '<option value="all">All States & UTs</option>' + 
    state.metaData.states.map(s => `<option value="${s}">${s}</option>`).join('');

  updateDistrictDropdown();
}

function updateDistrictDropdown() {
  const districtSelect = document.getElementById('districtSelect');
  if (!districtSelect) return;

  if (state.selectedState === 'all' || !state.metaData.districtsByState[state.selectedState]) {
    districtSelect.innerHTML = '<option value="all">All Districts</option>';
  } else {
    const dists = state.metaData.districtsByState[state.selectedState];
    districtSelect.innerHTML = '<option value="all">All Districts</option>' + 
      dists.map(d => `<option value="${d}">${d}</option>`).join('');
  }
}

// Fetch hospitals from FastAPI backend with search and filters
async function fetchHospitals() {
  try {
    const params = new URLSearchParams();
    if (state.searchKeyword) params.append('name', state.searchKeyword);
    if (state.selectedState && state.selectedState !== 'all') params.append('state', state.selectedState);
    if (state.selectedDistrict && state.selectedDistrict !== 'all') params.append('city', state.selectedDistrict);
    if (state.activeHospType && state.activeHospType !== 'all') params.append('type', state.activeHospType);
    if (state.emergencyOnly) params.append('emergency', 'true');
    if (state.maxBudget) params.append('maxBudget', state.maxBudget);
    params.append('limit', '150');

    let res = await fetch(`http://localhost:8000/api/hospitals?${params.toString()}`);
    if (!res.ok) {
      res = await fetch(`/api/hospitals?${params.toString()}`);
    }

    if (res.ok) {
      state.hospitals = await res.json();
    } else {
      showToast('Failed to fetch hospitals data', 'danger');
    }
  } catch (err) {
    console.error('Error fetching hospitals from FastAPI:', err);
    try {
      const params = new URLSearchParams();
      if (state.searchKeyword) params.append('search', state.searchKeyword);
      if (state.selectedState && state.selectedState !== 'all') params.append('state', state.selectedState);
      if (state.selectedDistrict && state.selectedDistrict !== 'all') params.append('district', state.selectedDistrict);
      if (state.activeHospType && state.activeHospType !== 'all') params.append('type', state.activeHospType);
      if (state.emergencyOnly) params.append('emergency', 'true');
      if (state.maxBudget) params.append('maxBudget', state.maxBudget);
      params.append('limit', '150');

      const res = await fetch(`/api/hospitals?${params.toString()}`);
      if (res.ok) {
        state.hospitals = await res.json();
      }
    } catch (e) {
      showToast('Server connection error', 'danger');
    }
  }
}

// Update the DOM based on state
function updateViews() {
  // Update Patient View
  renderPatientSearch(state.hospitals, state.activeTreatmentFilter, state.maxBudget, state.emergencyOnly, state.activeHospType);
  
  // Update Hospital Admin View
  if (state.activeRole === 'admin' && state.activeAdminHospitalId) {
    renderHospitalAdmin(state.hospitals, state.activeAdminHospitalId, updateViews);
  }
}

// Render Health Records for logged-in user
async function loadHealthRecords() {
  const container = document.getElementById('healthRecordsContainer');
  if (!container) return;

  try {
    const res = await fetch('/api/records', {
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      container.innerHTML = `<p style="text-align: center; color: var(--text-muted);">Failed to load digital health vault.</p>`;
      return;
    }

    const records = await res.json();
    if (records.length === 0) {
      container.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 2rem;">No health records stored in your vault.</p>`;
      return;
    }

    container.innerHTML = records.map(rec => `
      <div class="card-panel" style="margin-bottom: 1rem; border-left: 4px solid var(--primary);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h4 style="font-size: 1.1rem; color: var(--text-main);">${rec.title}</h4>
            <p style="font-size: 0.85rem; color: var(--text-muted);">${rec.hospital} • ${rec.doctor} • 📅 ${rec.date}</p>
          </div>
          <span class="badge-tag">${rec.type}</span>
        </div>
        <p style="margin: 0.75rem 0; font-size: 0.9rem; color: var(--text-main);">${rec.summary}</p>
        <button class="btn btn-outline" style="padding: 4px 12px; font-size: 0.8rem;" onclick="alert('Downloading ${rec.file_ref} encrypted health record...')">
          📥 Download Digital Copy
        </button>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error fetching records:', err);
    container.innerHTML = `<p style="text-align: center; color: var(--text-muted);">Server connection error loading records.</p>`;
  }
}

// Check if user is authenticated and update visibility
async function checkAuth() {
  const token = localStorage.getItem('token');
  const userJson = localStorage.getItem('user');

  if (token && userJson) {
    state.currentUser = JSON.parse(userJson);
    state.activeRole = state.currentUser.role;
    if (state.currentUser.role === 'admin') {
      state.activeAdminHospitalId = state.currentUser.hospitalId;
    }

    // Update Profile UI in header
    document.getElementById('headerUserName').textContent = state.currentUser.name;
    document.getElementById('headerUserRole').textContent = 
      state.currentUser.role.toUpperCase() + 
      (state.currentUser.hospitalId ? ` (${state.currentUser.hospitalId.replace('hosp-', '').toUpperCase()})` : '');
    
    document.getElementById('userProfileHeader').style.display = 'flex';
    document.getElementById('authSection').style.display = 'none';

    // Show/Hide dashboards based on role
    document.getElementById('patientViewSection').classList.remove('active');
    document.getElementById('adminViewSection').classList.remove('active');
    document.getElementById('driverViewSection').classList.remove('active');

    if (state.activeRole === 'patient') {
      document.getElementById('patientViewSection').classList.add('active');
      document.getElementById('emergencyRibbon').style.display = 'flex';
      await loadDashboardData();
    } else if (state.activeRole === 'admin') {
      document.getElementById('adminViewSection').classList.add('active');
      document.getElementById('emergencyRibbon').style.display = 'none';
      await loadDashboardData();
    } else if (state.activeRole === 'driver') {
      document.getElementById('driverViewSection').classList.add('active');
      document.getElementById('emergencyRibbon').style.display = 'none';
      initLiveTrackingMap('driverLiveMapCanvas', 12);
      loadDriverBookings();
    }
  } else {
    // Show auth card and hide other modules
    document.getElementById('authSection').style.display = 'block';
    document.getElementById('authSection').classList.add('active');
    document.getElementById('userProfileHeader').style.display = 'none';
    document.getElementById('emergencyRibbon').style.display = 'none';
    
    document.getElementById('patientViewSection').classList.remove('active');
    document.getElementById('adminViewSection').classList.remove('active');
    document.getElementById('driverViewSection').classList.remove('active');
  }
}

// Fetch all bookings for drivers
async function loadDriverBookings() {
  try {
    const res = await fetch('/api/bookings', {
      headers: getAuthHeaders()
    });
    if (res.ok) {
      const bookings = await res.json();
      const activeBooking = bookings.find(b => b.status === 'En Route' || b.status === 'Pending');
      if (activeBooking) {
        // Render driver terminal metrics based on active dispatch
        showToast(`Active Dispatch Found! #${activeBooking.id}`, 'warning');
      }
    }
  } catch (err) {
    console.error('Error fetching driver bookings:', err);
  }
}

async function loadDashboardData() {
  await fetchHospitalMeta();
  await fetchHospitals();
  updateViews();
  if (state.activeRole === 'patient') {
    loadHealthRecords();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();

  // ==================== AUTHENTICATION UI EVENT LISTENERS ====================

  // Auth tabs switching
  const tabLoginBtn = document.getElementById('tabLoginBtn');
  const tabSignupBtn = document.getElementById('tabSignupBtn');
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');

  if (tabLoginBtn && tabSignupBtn && loginForm && signupForm) {
    tabLoginBtn.addEventListener('click', () => {
      tabLoginBtn.classList.add('active');
      tabSignupBtn.classList.remove('active');
      loginForm.classList.add('active');
      signupForm.classList.remove('active');
    });

    tabSignupBtn.addEventListener('click', () => {
      tabSignupBtn.classList.add('active');
      tabLoginBtn.classList.remove('active');
      signupForm.classList.add('active');
      loginForm.classList.remove('active');
    });
  }

  // Show/Hide hospital selection based on signup role selection
  const signupRole = document.getElementById('signupRole');
  const signupHospitalGroup = document.getElementById('signupHospitalGroup');
  if (signupRole && signupHospitalGroup) {
    signupRole.addEventListener('change', (e) => {
      if (e.target.value === 'admin') {
        signupHospitalGroup.style.display = 'block';
      } else {
        signupHospitalGroup.style.display = 'none';
      }
    });
  }

  // Login submission
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        
        const data = await res.json();
        if (res.ok) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          showToast('Signed in successfully!', 'success');
          checkAuth();
        } else {
          showToast(data.error || 'Invalid credentials', 'danger');
        }
      } catch (err) {
        console.error('Login submit error:', err);
        showToast('Server connection error', 'danger');
      }
    });
  }

  // Signup submission
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('signupName').value;
      const email = document.getElementById('signupEmail').value;
      const password = document.getElementById('signupPassword').value;
      const role = signupRole.value;
      const hospitalId = role === 'admin' ? document.getElementById('signupHospital').value : null;

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password, role, hospitalId })
        });

        const data = await res.json();
        if (res.ok) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          showToast('Account registered successfully!', 'success');
          checkAuth();
        } else {
          showToast(data.error || 'Registration failed', 'danger');
        }
      } catch (err) {
        console.error('Signup submit error:', err);
        showToast('Server connection error', 'danger');
      }
    });
  }

  // Logout button
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      showToast('Logged out successfully', 'info');
      checkAuth();
    });
  }

  // ==================== FRONTEND DASHBOARD EVENT LISTENERS ====================

  // Search Input listener (with debounce)
  const searchInput = document.getElementById('searchInput');
  let searchTimeout = null;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      state.searchKeyword = e.target.value;
      searchTimeout = setTimeout(async () => {
        await fetchHospitals();
        updateViews();
      }, 300);
    });
  }

  // State Select listener
  const stateSelect = document.getElementById('stateSelect');
  if (stateSelect) {
    stateSelect.addEventListener('change', async (e) => {
      state.selectedState = e.target.value;
      state.selectedDistrict = 'all';
      updateDistrictDropdown();
      await fetchHospitals();
      updateViews();
    });
  }

  // District Select listener
  const districtSelect = document.getElementById('districtSelect');
  if (districtSelect) {
    districtSelect.addEventListener('change', async (e) => {
      state.selectedDistrict = e.target.value;
      await fetchHospitals();
      updateViews();
    });
  }

  // Patient Sub-nav Tabs (Search, Ambulance, AI Assistant, Health Records)
  document.querySelectorAll('.patient-nav-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.patient-nav-tab').forEach(t => {
        t.style.background = 'transparent';
        t.style.color = 'var(--text-muted)';
      });
      e.currentTarget.style.background = 'var(--primary-light)';
      e.currentTarget.style.color = 'var(--primary-hover)';

      const tabTarget = e.currentTarget.dataset.tab;
      state.activeTabPatient = tabTarget;

      document.querySelectorAll('.patient-subview').forEach(sv => sv.style.display = 'none');
      document.getElementById(`subview-${tabTarget}`).style.display = 'block';

      if (tabTarget === 'ambulance') {
        initLiveTrackingMap('liveMapCanvas', 12);
      }
    });
  });

  // List vs Map View Switcher
  const btnViewList = document.getElementById('btnViewList');
  const btnViewMap = document.getElementById('btnViewMap');
  const hospitalListContainer = document.getElementById('hospitalListContainer');
  const allHospitalsMapCanvas = document.getElementById('allHospitalsMapCanvas');

  if (btnViewList && btnViewMap && hospitalListContainer && allHospitalsMapCanvas) {
    btnViewList.addEventListener('click', () => {
      btnViewList.className = 'btn btn-primary';
      btnViewList.style.background = 'var(--primary)';
      btnViewList.style.color = 'white';
      
      btnViewMap.className = 'btn btn-outline';
      btnViewMap.style.background = 'transparent';
      btnViewMap.style.color = 'var(--text-muted)';
      btnViewMap.style.border = 'none';

      hospitalListContainer.style.display = 'flex';
      allHospitalsMapCanvas.style.display = 'none';
    });

    btnViewMap.addEventListener('click', () => {
      btnViewMap.className = 'btn btn-primary';
      btnViewMap.style.background = 'var(--primary)';
      btnViewMap.style.color = 'white';

      btnViewList.className = 'btn btn-outline';
      btnViewList.style.background = 'transparent';
      btnViewList.style.color = 'var(--text-muted)';
      btnViewList.style.border = 'none';

      hospitalListContainer.style.display = 'none';
      allHospitalsMapCanvas.style.display = 'block';
      renderHospitalsMap(state.hospitals);
    });
  }

  // Hospital Category (Govt / Private) Select
  const hospTypeSelect = document.getElementById('hospitalTypeSelect');
  if (hospTypeSelect) {
    hospTypeSelect.addEventListener('change', async (e) => {
      state.activeHospType = e.target.value;
      await fetchHospitals();
      updateViews();
    });
  }

  // Budget Filter Slider
  const budgetSlider = document.getElementById('budgetSlider');
  const budgetVal = document.getElementById('budgetValueDisplay');
  if (budgetSlider && budgetVal) {
    budgetSlider.addEventListener('input', async (e) => {
      const val = parseInt(e.target.value);
      state.maxBudget = val;
      budgetVal.textContent = `₹${val.toLocaleString()}`;
      await fetchHospitals();
      updateViews();
    });
  }

  // Treatment Filter Select
  const treatmentSelect = document.getElementById('treatmentFilterSelect');
  if (treatmentSelect) {
    treatmentSelect.addEventListener('change', (e) => {
      state.activeTreatmentFilter = e.target.value;
      updateViews();
    });
  }

  // Emergency Bed Only Checkbox
  const emergencyCheck = document.getElementById('emergencyFilterCheck');
  if (emergencyCheck) {
    emergencyCheck.addEventListener('change', async (e) => {
      state.emergencyOnly = e.target.checked;
      await fetchHospitals();
      updateViews();
    });
  }

  // Global Dynamic Event Delegation (Card actions, compare, bed steppers)
  document.body.addEventListener('click', async (e) => {
    // Compare Button
    if (e.target.closest('.btn-toggle-compare')) {
      const btn = e.target.closest('.btn-toggle-compare');
      const hospId = btn.dataset.id;
      const hosp = state.hospitals.find(h => h.id === hospId);
      if (hosp) {
        toggleCompareHospital(hosp, () => {
          updateViews();
          showToast(`Updated comparison list!`, 'success');
        });
      }
    }

    // View Comparison Modal Button
    if (e.target.closest('#btnOpenCompareModal')) {
      renderComparisonModal();
    }

    // Modal Close Button
    if (e.target.closest('.modal-close') || e.target.classList.contains('modal-backdrop')) {
      document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('active'));
    }

    // Book Ambulance Action (Switching to the Ambulance booking tab and selecting hospital)
    if (e.target.closest('.btn-book-amb')) {
      const btn = e.target.closest('.btn-book-amb');
      const hospId = btn.dataset.id;
      const hosp = state.hospitals.find(h => h.id === hospId);
      
      const dropSelect = document.getElementById('ambDropHospitalSelect');
      if (dropSelect && hosp) {
        dropSelect.innerHTML = `<option value="${hosp.id}">${hosp.name} (${hosp.distanceKm} km away)</option>`;
      }

      // Switch to Patient Ambulance Tab
      document.querySelectorAll('.patient-nav-tab').forEach(t => {
        t.style.background = 'transparent';
        t.style.color = 'var(--text-muted)';
      });
      const ambTabBtn = document.querySelector('.patient-nav-tab[data-tab="ambulance"]');
      if (ambTabBtn) {
        ambTabBtn.style.background = 'var(--primary-light)';
        ambTabBtn.style.color = 'var(--primary-hover)';
      }

      document.querySelectorAll('.patient-subview').forEach(sv => sv.style.display = 'none');
      document.getElementById('subview-ambulance').style.display = 'block';
      initLiveTrackingMap('liveMapCanvas', 12);
      showToast(`Selected destination: ${hosp.name}`, 'warning');
    }

    // Hospital Admin Bed Increment / Decrement Steppers
    if (e.target.closest('.stepper-btn')) {
      const btn = e.target.closest('.stepper-btn');
      const hospId = btn.dataset.id;
      const hosp = state.hospitals.find(h => h.id === hospId);
      if (!hosp) return;

      let icu = hosp.beds.icu.available;
      let emergency = hosp.beds.emergency.available;
      let general = hosp.beds.general.available;

      if (btn.classList.contains('btn-icu-inc')) icu++;
      if (btn.classList.contains('btn-icu-dec') && icu > 0) icu--;

      if (btn.classList.contains('btn-emerg-inc')) emergency++;
      if (btn.classList.contains('btn-emerg-dec') && emergency > 0) emergency--;

      if (btn.classList.contains('btn-gen-inc')) general++;
      if (btn.classList.contains('btn-gen-dec') && general > 0) general--;

      try {
        const res = await fetch(`/api/hospitals/${hospId}/beds`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ icu, emergency, general })
        });
        
        if (res.ok) {
          hosp.beds.icu.available = icu;
          hosp.beds.emergency.available = emergency;
          hosp.beds.general.available = general;
          updateViews();
          showToast(`⚡ Real-time Sync: Bed count updated for ${hosp.name}`, 'success');
        } else {
          const data = await res.json();
          showToast(data.error || 'Failed to update beds', 'danger');
        }
      } catch (err) {
        console.error('Error updating beds:', err);
        showToast('Server communication error', 'danger');
      }
    }

    // Hospital Admin Price Editor
    if (e.target.closest('.btn-edit-price')) {
      const btn = e.target.closest('.btn-edit-price');
      const hospId = btn.dataset.hosp;
      const treatId = btn.dataset.treat;
      const treatName = btn.dataset.name;
      const currentCost = parseInt(btn.dataset.cost);

      const newPriceStr = prompt(`Update transparent cost for procedure "${treatName}":`, currentCost);
      if (newPriceStr !== null) {
        const newPrice = parseInt(newPriceStr);
        if (!isNaN(newPrice) && newPrice > 0) {
          try {
            const res = await fetch(`/api/hospitals/${hospId}/treatments/${treatId}`, {
              method: 'PUT',
              headers: getAuthHeaders(),
              body: JSON.stringify({ cost: newPrice })
            });

            const data = await res.json();
            if (res.ok) {
              const hosp = state.hospitals.find(h => h.id === hospId);
              const treat = hosp.treatments.find(t => t.id === treatId);
              if (treat) {
                treat.cost = newPrice;
                hosp.estimatedAvgCost = data.newAverageCost;
                updateViews();
                showToast(`Procedure price updated to ₹${newPrice.toLocaleString()}`, 'success');
              }
            } else {
              showToast(data.error || 'Failed to update price', 'danger');
            }
          } catch (err) {
            console.error('Error updating price:', err);
            showToast('Server communication error', 'danger');
          }
        }
      }
    }

    // Emergency SOS Trigger Button
    if (e.target.closest('#btnGlobalSos')) {
      alert("🚨 EMERGENCY SOS ACTIVATED!\nSending high-priority location beacon to nearest ambulance fleet (City Care Hospital) & notifying family contacts...");
      showToast("🚨 SOS Beacon Dispatched to Emergency Services", "danger");
    }

    // View Treatment Details Modal Button
    if (e.target.closest('.btn-view-treatments')) {
      const btn = e.target.closest('.btn-view-treatments');
      const hospId = btn.dataset.id;
      const hosp = state.hospitals.find(h => h.id === hospId);
      if (hosp) {
        alert(`📋 Treatment Cost Transparency Breakdown for ${hosp.name}:\n\n` + 
          hosp.treatments.map(t => `• ${t.name}: ₹${t.cost.toLocaleString()} (${t.duration})`).join('\n')
        );
      }
    }

    // Dispatch Ambulance in Admin Console
    if (e.target.closest('.btn-dispatch-amb')) {
      showToast("🚑 Ambulance Driver Ramesh Kumar Dispatched to Shastri Nagar!", "success");
      e.target.closest('.btn-dispatch-amb').textContent = "✓ Dispatched";
      e.target.closest('.btn-dispatch-amb').disabled = true;
    }
  });

  // Confirm Ambulance Booking Submit
  const btnBookAmbulanceConfirm = document.getElementById('btnBookAmbulanceConfirm');
  if (btnBookAmbulanceConfirm) {
    btnBookAmbulanceConfirm.addEventListener('click', async () => {
      const ambType = document.getElementById('ambTypeSelect').value;
      const pickup = document.getElementById('ambPickupInput').value;
      const dropSelect = document.getElementById('ambDropHospitalSelect');
      const hospId = dropSelect.value;
      const hospName = dropSelect.options[dropSelect.selectedIndex]?.text || '';
      const baseFare = ambType === 'Normal' ? 799 : 2199;

      try {
        const res = await fetch('/api/bookings', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            hospitalId: hospId,
            hospitalName: hospName.split('(')[0].trim(),
            ambulanceType: ambType,
            pickupLocation: pickup,
            dropLocation: hospName.split('(')[0].trim(),
            fare: baseFare
          })
        });

        if (res.ok) {
          const booking = await res.json();
          alert(`Ambulance Booking Confirmed!\nBooking ID: ${booking.id}\nDriver: Ramesh Kumar assigned.\nFare: ₹${booking.fare}`);
          showToast(`Ambulance Dispatched! ID: ${booking.id}`, 'success');
          initLiveTrackingMap(12);
        } else {
          const data = await res.json();
          showToast(data.error || 'Failed to book ambulance', 'danger');
        }
      } catch (err) {
        console.error('Error booking ambulance:', err);
        showToast('Server communication error', 'danger');
      }
    });
  }

  // AI Assistant Chat Submit
  const aiSendBtn = document.getElementById('aiSendBtn');
  const aiInput = document.getElementById('aiInput');
  const aiBox = document.getElementById('aiMessagesBox');

  if (aiSendBtn && aiInput && aiBox) {
    const processQuery = async (q) => {
      if (!q.trim()) return;
      
      const userDiv = document.createElement('div');
      userDiv.className = 'ai-msg user';
      userDiv.textContent = q;
      aiBox.appendChild(userDiv);

      aiInput.value = '';
      aiBox.scrollTop = aiBox.scrollHeight;

      try {
        const res = await fetch('/api/symptoms/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q })
        });
        
        const data = await res.json();
        const botDiv = document.createElement('div');
        botDiv.className = 'ai-msg bot';
        botDiv.innerHTML = data.reply;
        aiBox.appendChild(botDiv);
        aiBox.scrollTop = aiBox.scrollHeight;
      } catch (err) {
        console.error('AI chat error:', err);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'ai-msg bot';
        errorDiv.textContent = 'Sorry, I am having trouble connecting right now.';
        aiBox.appendChild(errorDiv);
      }
    };

    aiSendBtn.addEventListener('click', () => processQuery(aiInput.value));
    aiInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') processQuery(aiInput.value);
    });

    // Preset Chip Clicks
    document.querySelectorAll('.ai-preset-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        processQuery(e.target.textContent);
      });
    });
  }
});
