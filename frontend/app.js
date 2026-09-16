import { 
  renderPatientSearch, 
  toggleCompareHospital, 
  renderComparisonModal, 
  initLiveTrackingMap,
  renderHospitalsMap,
  focusHospitalOnMap,
  openHospitalDetailModal,
  openOpdTokenModal,
  openGoogleMapModal
} from './patient.js?v=2.1';
import { initBloodBankModule, loadBloodBankData } from './blood_bank.js?v=2.1';

let state = {
  hospitals: [],
  currentUser: null,
  activeRole: 'patient',
  searchKeyword: '',
  selectedState: 'all',
  selectedDistrict: 'all',
  selectedSchemeFilter: 'all',
  activeTreatmentFilter: 'all',
  activeHospType: 'all', // 'all' | 'government' | 'private'
  maxBudget: 200000,
  emergencyOnly: false,
  activeTabPatient: 'search', // 'search' | 'ambulance' | 'ai' | 'records' | 'privacy' | 'schemes'
  patientSchemes: [],
  schemesCatalog: [],
  favoritesList: [],
  showFavoritesOnly: false,
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

// Fetch State and District Metadata from backend
async function fetchHospitalMeta() {
  try {
    const res = await fetch('/api/hospitals/meta');
    if (res.ok) {
      state.metaData = await res.json();
      populateMetaDropdowns();
    }
  } catch (err) {
    console.error('Error fetching metadata:', err);
  }
}

function populateMetaDropdowns() {
  const stateSelect = document.getElementById('stateSelect');
  if (!stateSelect) return;

  stateSelect.innerHTML = '<option value="all">All States & UTs</option>' + 
    (state.metaData.states || []).map(s => `<option value="${s}">${s}</option>`).join('');

  updateDistrictDropdown();
}

function updateDistrictDropdown() {
  const districtSelect = document.getElementById('districtSelect');
  if (!districtSelect) return;

  if (state.selectedState === 'all' || !state.metaData.districtsByState || !state.metaData.districtsByState[state.selectedState]) {
    districtSelect.innerHTML = '<option value="all">All Districts</option>';
  } else {
    const dists = state.metaData.districtsByState[state.selectedState] || [];
    districtSelect.innerHTML = '<option value="all">All Districts</option>' + 
      dists.map(d => `<option value="${d}">${d}</option>`).join('');
  }
}

// Fetch hospitals from backend with search, schemes, and filters
async function fetchHospitals() {
  try {
    const params = new URLSearchParams();
    if (state.searchKeyword) params.append('search', state.searchKeyword);
    if (state.selectedState && state.selectedState !== 'all') params.append('state', state.selectedState);
    if (state.selectedDistrict && state.selectedDistrict !== 'all') params.append('district', state.selectedDistrict);
    if (state.activeHospType && state.activeHospType !== 'all') params.append('type', state.activeHospType);
    if (state.selectedSchemeFilter && state.selectedSchemeFilter !== 'all') params.append('scheme', state.selectedSchemeFilter);
    if (state.emergencyOnly) params.append('emergency', 'true');
    if (state.maxBudget) params.append('maxBudget', state.maxBudget);
    params.append('limit', '150');

    const res = await fetch(`/api/hospitals?${params.toString()}`);
    if (res.ok) {
      state.hospitals = await res.json();
    } else {
      showToast('Failed to fetch hospitals data', 'danger');
    }
  } catch (err) {
    console.error('Error fetching hospitals:', err);
    showToast('Server connection error', 'danger');
  }
}

// Update the DOM based on state
function updateViews() {
  const displayHospitals = state.showFavoritesOnly 
    ? state.hospitals.filter(h => (state.favoritesList || []).includes(h.id))
    : state.hospitals;

  // Update Patient View
  renderPatientSearch(displayHospitals, state.activeTreatmentFilter, state.maxBudget, state.emergencyOnly, state.activeHospType, state.favoritesList);
  renderHospitalsMap(displayHospitals);
}

// Load Patient Favorite Hospitals
async function loadFavorites() {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      const stored = localStorage.getItem('medigo_guest_favorites');
      state.favoritesList = stored ? JSON.parse(stored) : [];
      updateFavoritesBadge();
      return;
    }

    const res = await fetch('/api/user/favorites', { headers: getAuthHeaders() });
    if (res.ok) {
      state.favoritesList = await res.json();
      updateFavoritesBadge();
    }
  } catch (err) {
    console.error('Error loading favorites:', err);
  }
}

function updateFavoritesBadge() {
  const badge = document.getElementById('favCountBadge');
  if (badge) badge.textContent = (state.favoritesList || []).length;
}

// Toggle Favorite Hospital
async function toggleFavorite(hospitalId) {
  if (!hospitalId) return;

  try {
    const token = localStorage.getItem('token');
    if (!token) {
      // Guest localStorage fallback
      let favs = state.favoritesList || [];
      const idx = favs.indexOf(hospitalId);
      if (idx > -1) {
        favs.splice(idx, 1);
        showToast('Removed from favorites', 'info');
      } else {
        favs.push(hospitalId);
        showToast('❤️ Added to Favorites', 'success');
      }
      state.favoritesList = favs;
      localStorage.setItem('medigo_guest_favorites', JSON.stringify(favs));
      updateFavoritesBadge();
      updateViews();
      return;
    }

    const res = await fetch('/api/user/favorites/toggle', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ hospitalId })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.isFavorite) {
        if (!state.favoritesList.includes(hospitalId)) state.favoritesList.push(hospitalId);
        showToast('❤️ Added to Favorites!', 'success');
      } else {
        state.favoritesList = state.favoritesList.filter(id => id !== hospitalId);
        showToast('Removed from favorites', 'info');
      }
      updateFavoritesBadge();
      updateViews();
    }
  } catch (err) {
    console.error('Error toggling favorite:', err);
    showToast('Failed to update favorite', 'danger');
  }
}

// Load Patient User Profile (Blood Group, Emergency Contact, Allergies)
async function loadUserProfile() {
  try {
    const res = await fetch('/api/user/profile', { headers: getAuthHeaders() });
    if (res.ok) {
      const user = await res.json();
      const bloodSelect = document.getElementById('profileBloodGroup');
      const contactInput = document.getElementById('profileEmergencyContact');
      const allergiesInput = document.getElementById('profileAllergies');
      const badgeBlood = document.getElementById('badgeProfileBloodGroup');

      if (bloodSelect && user.blood_group) bloodSelect.value = user.blood_group;
      if (contactInput && user.emergency_contact) contactInput.value = user.emergency_contact;
      if (allergiesInput && user.allergies) allergiesInput.value = user.allergies;
      if (badgeBlood) badgeBlood.textContent = `Blood Group: ${user.blood_group || 'O+'}`;

      // Update Medical ID pass card
      const passName = document.getElementById('passPatientName');
      const passBlood = document.getElementById('passBloodGroup');
      const passContact = document.getElementById('passEmergencyContact');
      const passAllergies = document.getElementById('passAllergies');

      if (passName) passName.textContent = user.name || 'Patient';
      if (passBlood) passBlood.textContent = user.blood_group || 'O+';
      if (passContact) {
        const raw = user.emergency_contact || '+91 98123 45678';
        passContact.textContent = raw.length >= 8 ? `${raw.slice(0, 6)}****${raw.slice(-3)}` : raw;
      }
      if (passAllergies) passAllergies.textContent = '••••••••••••';
    }
  } catch (err) {
    console.error('Error loading user profile:', err);
  }
}

// Load Patient Privacy & Consent Settings
async function loadPrivacySettings() {
  try {
    const res = await fetch('/api/privacy/settings', { headers: getAuthHeaders() });
    if (res.ok) {
      const data = await res.json();
      const toggleSos = document.getElementById('toggleEmergencySosShare');
      const toggleMask = document.getElementById('toggleMaskContact');
      const toggleResearch = document.getElementById('toggleResearchAnalytics');
      const pinInput = document.getElementById('settingEmergencyPin');

      if (toggleSos) toggleSos.checked = !!data.emergencySosAutoShare;
      if (toggleMask) toggleMask.checked = !!data.maskContactDetails;
      if (toggleResearch) toggleResearch.checked = !!data.allowResearchAnalytics;
      if (pinInput && data.emergencyPin) pinInput.value = data.emergencyPin;
    }
  } catch (err) {
    console.error('Error loading privacy settings:', err);
  }
}

// Load Privacy & Access Audit Logs
async function loadAuditLogs() {
  const tbody = document.getElementById('auditLogsTableBody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/privacy/audit-logs', { headers: getAuthHeaders() });
    if (!res.ok) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">Failed to load audit logs.</td></tr>`;
      return;
    }

    const logs = await res.json();
    if (logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No access events recorded yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = logs.map(l => {
      let tagClass = 'success';
      if (l.status === 'FAILED') tagClass = 'failed';
      else if (l.action.includes('VIEW') || l.action.includes('ACCESS') || l.action.includes('VAULT')) tagClass = 'view';
      else if (l.action.includes('EXPORT')) tagClass = 'export';

      return `
        <tr>
          <td><strong style="font-family: monospace; font-size: 0.78rem;">${l.timestamp}</strong></td>
          <td><strong>${l.actor_name}</strong></td>
          <td><span style="font-size: 0.75rem; text-transform: uppercase; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${l.actor_role}</span></td>
          <td><code>${l.action}</code></td>
          <td style="max-width: 260px; font-size: 0.8rem; color: #475569;">${l.details || '-'}</td>
          <td><span style="font-family: monospace; font-size: 0.78rem;">${l.ip_address || '127.0.0.1'}</span></td>
          <td><span class="audit-tag ${tagClass}">${l.status}</span></td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading audit logs:', err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">Connection error loading audit logs.</td></tr>`;
  }
}

// Load Patient Verified Scheme KYC Cards
async function loadPatientSchemes() {
  const container = document.getElementById('patientSchemeCardsContainer');
  if (!container) return;

  try {
    const res = await fetch('/api/kyc/my-schemes', { headers: getAuthHeaders() });
    if (!res.ok) {
      container.innerHTML = `<p style="color: var(--text-muted); grid-column: 1 / -1; text-align: center;">Failed to load scheme cards.</p>`;
      return;
    }

    state.patientSchemes = await res.json();

    if (state.patientSchemes.length === 0) {
      container.innerHTML = `
        <div class="card-panel" style="grid-column: 1 / -1; text-align: center; padding: 2rem 1rem;">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">💳</div>
          <h4>No Scheme Cards Linked</h4>
          <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 4px;">Link your Ayushman Bharat PM-JAY, ABHA ID, or CGHS card to unlock 100% cashless medical care.</p>
          <button class="btn btn-primary" onclick="document.getElementById('addSchemeKycPanel').style.display='block'" style="margin-top: 1rem; font-size: 0.85rem;">
            ➕ Link Your First Scheme Card
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = state.patientSchemes.map(card => {
      let cardClass = 'pmjay';
      let emblem = '🇮🇳';
      let badgeLabel = 'GOLDEN BENEFICIARY CARD';
      let coverageLabel = `₹${(card.coverage_amount || 500000).toLocaleString()} Annual Cover`;

      if (card.scheme_type === 'abha') {
        cardClass = 'abha';
        emblem = '🪪';
        badgeLabel = 'ABDM HEALTH ACCOUNT';
        coverageLabel = 'Universal Digital Health ID';
      } else if (card.scheme_type === 'cghs') {
        cardClass = 'cghs';
        emblem = '🏛️';
        badgeLabel = 'CGHS BENEFICIARY PASS';
        coverageLabel = '100% Comprehensive Cashless';
      } else if (card.scheme_type === 'echs') {
        cardClass = 'cghs';
        emblem = '🎖️';
        badgeLabel = 'ECHS ARMED FORCES CARD';
        coverageLabel = 'Armed Forces Cashless Cover';
      } else if (card.scheme_type.startsWith('state_')) {
        cardClass = 'state';
        emblem = '🏛️';
        badgeLabel = 'STATE GOVT HEALTH SCHEME';
      } else if (card.scheme_type.startsWith('private_')) {
        cardClass = 'private';
        emblem = '🏥';
        badgeLabel = 'PRIVATE CASHLESS TPA';
      }

      return `
        <div class="digital-scheme-card ${cardClass}" id="card-${card.id}">
          <div class="scheme-card-header">
            <div class="scheme-card-emblem">
              <span style="font-size: 1.5rem;">${emblem}</span>
              <div>
                <div style="font-size: 0.72rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.85);">${badgeLabel}</div>
                <div style="font-size: 0.85rem; font-weight: 700; color: #ffffff;">${card.scheme_name}</div>
              </div>
            </div>
            <div class="hologram-chip"></div>
          </div>

          <div style="margin: 0.5rem 0;">
            <div style="font-size: 0.75rem; color: rgba(255,255,255,0.8);">CARD / ABHA ID NUMBER</div>
            <div class="scheme-card-number">${card.card_number}</div>
          </div>

          <div class="scheme-card-footer">
            <div>
              <div style="font-size: 0.72rem; color: rgba(255,255,255,0.75);">BENEFICIARY NAME</div>
              <div style="font-size: 0.95rem; font-weight: 700; color: #ffffff;">${card.beneficiary_name}</div>
              <div style="font-size: 0.75rem; color: rgba(255,255,255,0.9); margin-top: 2px;">
                👥 ${card.family_members_count || 1} Member(s) • 🛡️ ${coverageLabel}
              </div>
            </div>

            <div style="text-align: right;">
              <div style="background: rgba(255,255,255,0.2); backdrop-filter: blur(4px); padding: 2px 8px; border-radius: 12px; font-size: 0.72rem; font-weight: 800; margin-bottom: 6px; display: inline-flex; align-items: center; gap: 4px;">
                ✅ KYC VERIFIED
              </div>
              <br/>
              <button class="btn btn-outline btn-unlink-scheme" data-id="${card.id}" style="padding: 2px 8px; font-size: 0.72rem; color: white; border-color: rgba(255,255,255,0.4); background: rgba(0,0,0,0.2);">
                ✕ Unlink
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading patient schemes:', err);
  }
}

// Load National & State Schemes Catalog Directory
async function loadSchemesCatalog() {
  const container = document.getElementById('schemesCatalogDirectory');
  if (!container) return;

  try {
    const res = await fetch('/api/kyc/schemes/catalog');
    if (!res.ok) return;

    state.schemesCatalog = await res.json();

    container.innerHTML = state.schemesCatalog.map(s => `
      <div class="scheme-catalog-card">
        <div style="flex: 1; min-width: 260px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <h4 style="font-size: 0.98rem; color: var(--text-main); font-weight: 700;">${s.name}</h4>
            <span style="background: var(--primary-light); color: var(--primary); font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 4px;">${s.level}</span>
          </div>
          <p style="font-size: 0.82rem; color: #047857; font-weight: 700; margin-bottom: 6px;">🛡️ Coverage: ${s.coverageDisplay}</p>
          <ul style="font-size: 0.78rem; color: var(--text-muted); padding-left: 1.2rem; margin-bottom: 6px;">
            ${s.benefits.slice(0, 2).map(b => `<li>${b}</li>`).join('')}
          </ul>
          <div style="font-size: 0.75rem; color: #64748b;">
            <strong>Format:</strong> <code>${s.idFormatExample}</code> &nbsp;|&nbsp; <strong>Required ID:</strong> ${s.requiredProof.join(', ')}
          </div>
        </div>
        <div style="flex-shrink: 0; text-align: right;">
          <button class="btn btn-primary btn-select-catalog-scheme" data-id="${s.id}" data-name="${s.name}" data-example="${s.idFormatExample}" style="padding: 6px 14px; font-size: 0.8rem;">
            ⚡ Link &amp; Verify e-KYC
          </button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading schemes catalog:', err);
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
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <h4 style="font-size: 1.1rem; color: var(--text-main);">${rec.title}</h4>
            <p style="font-size: 0.85rem; color: var(--text-muted);">${rec.hospital} • ${rec.doctor} • 📅 ${rec.date}</p>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-weight: 700; font-size: 0.75rem; padding: 2px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px;">
              🔒 AES-256 Encrypted
            </span>
            <span style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; font-weight: 800; font-size: 0.78rem; padding: 2px 8px; border-radius: 4px;">
              🩸 ${rec.blood_group || 'O+'}
            </span>
            <span class="badge-tag">${rec.type}</span>
          </div>
        </div>
        <p style="margin: 0.75rem 0; font-size: 0.9rem; color: var(--text-main);">${rec.summary}</p>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.75rem;">
          <button class="btn btn-outline" style="padding: 4px 12px; font-size: 0.8rem;" onclick="alert('Downloading ${rec.file_ref || 'medical_report.pdf'} encrypted health record...')">
            📥 Download Digital Copy (${rec.file_ref || 'report.pdf'})
          </button>
          <button class="btn btn-outline btn-delete-record" style="padding: 4px 10px; font-size: 0.78rem; color: #ef4444; border-color: rgba(239,68,68,0.3);" data-id="${rec.id}">
            🗑️ Delete
          </button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error fetching records:', err);
    container.innerHTML = `<p style="text-align: center; color: var(--text-muted);">Server connection error loading records.</p>`;
  }
}

// Check if user is authenticated and update navigation
async function checkAuth() {
  const token = localStorage.getItem('token');
  const userJson = localStorage.getItem('user');

  const guestNav = document.getElementById('guestNavAction');
  const profileHeader = document.getElementById('userProfileHeader');
  const patientSec = document.getElementById('patientViewSection');
  const emergencyRib = document.getElementById('emergencyRibbon');

  // Keep patient search and discovery active for all visitors
  if (patientSec) patientSec.classList.add('active');
  if (emergencyRib) emergencyRib.style.display = 'flex';

  if (token && userJson) {
    state.currentUser = JSON.parse(userJson);
    state.activeRole = 'patient';

    const headerName = document.getElementById('headerUserName');
    const headerRole = document.getElementById('headerUserRole');
    if (headerName) headerName.textContent = state.currentUser.name;
    if (headerRole) headerRole.textContent = 'PATIENT';
    
    if (profileHeader) profileHeader.style.display = 'flex';
    if (guestNav) guestNav.style.display = 'none';
  } else {
    state.currentUser = null;
    if (profileHeader) profileHeader.style.display = 'none';
    if (guestNav) guestNav.style.display = 'flex';
  }

  await loadDashboardData();
}

function clearSearchInput() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    if (!state.searchKeyword) {
      searchInput.value = '';
    } else if (searchInput.value && searchInput.value.includes('@')) {
      // Browser dumped user email into search bar via autofill
      searchInput.value = '';
      state.searchKeyword = '';
      fetchHospitals().then(updateViews);
    }
  }
}

async function loadDashboardData() {
  clearSearchInput();
  await fetchHospitalMeta();
  await fetchHospitals();
  updateViews();
  loadUserProfile();
  loadHealthRecords();
  loadPrivacySettings();
  loadAuditLogs();
  loadPatientSchemes();
  loadSchemesCatalog();
  loadFavorites();

  // Guard against asynchronous browser autofill populating search bar
  [50, 150, 300, 600, 1000].forEach(delay => {
    setTimeout(clearSearchInput, delay);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  clearSearchInput();
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
          if (data.user.role !== 'patient') {
             showToast('This portal is for patients only.', 'danger');
             return;
          }
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          showToast('Logged in successfully', 'success');
          checkAuth();
        } else {
          showToast(data.error || 'Login failed', 'danger');
        }
      } catch (err) {
        console.error('Login error:', err);
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

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password, role: 'patient' })
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
  initBloodBankModule();

  // Search Input listener (with debounce and auto-clear on load)
  const searchInput = document.getElementById('searchInput');
  let searchTimeout = null;
  if (searchInput) {
    searchInput.value = '';
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      state.searchKeyword = e.target.value.trim();
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
        t.classList.remove('active');
        t.style.background = 'transparent';
        t.style.color = 'var(--text-muted)';
      });
      e.currentTarget.classList.add('active');
      e.currentTarget.style.background = 'var(--primary-light)';
      e.currentTarget.style.color = 'var(--primary-hover)';

      const tabTarget = e.currentTarget.dataset.tab;
      state.activeTabPatient = tabTarget;

      document.querySelectorAll('.patient-subview').forEach(sv => sv.style.display = 'none');
      const targetSub = document.getElementById(`subview-${tabTarget}`);
      if (targetSub) targetSub.style.display = 'block';

      if (tabTarget === 'ambulance') {
        initLiveTrackingMap('liveMapCanvas', 12);
      } else if (tabTarget === 'privacy') {
        loadPrivacySettings();
        loadAuditLogs();
        loadUserProfile();
      } else if (tabTarget === 'schemes') {
        loadPatientSchemes();
        loadSchemesCatalog();
      } else if (tabTarget === 'blood') {
        loadBloodBankData();
      }
    });
  });

  // Dynamic Mouse-Tracking Spotlight Effect for Cards
  document.addEventListener('mousemove', (e) => {
    const card = e.target.closest('.hospital-card, .digital-scheme-card, .crypto-status-card, .medical-id-card');
    if (!card) return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
    card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
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

  // Hero City Pills Click Handlers
  document.querySelectorAll('.city-pill').forEach(pill => {
    pill.addEventListener('click', async (e) => {
      document.querySelectorAll('.city-pill').forEach(p => p.classList.remove('active'));
      e.currentTarget.classList.add('active');
      const st = e.currentTarget.dataset.state;
      const dist = e.currentTarget.dataset.district;
      state.selectedState = st;
      state.selectedDistrict = dist;

      const stateSelect = document.getElementById('stateSelect');
      if (stateSelect) stateSelect.value = st;
      updateDistrictDropdown();
      const districtSelect = document.getElementById('districtSelect');
      if (districtSelect && dist !== 'all') districtSelect.value = dist;

      await fetchHospitals();
      updateViews();
      showToast(`Showing verified hospitals in ${e.currentTarget.textContent}`, 'info');
    });
  });

  // Hero Acuity Filter Chips Handlers
  const chipIcuOnly = document.getElementById('chipIcuOnly');
  if (chipIcuOnly) {
    chipIcuOnly.addEventListener('click', async () => {
      state.emergencyOnly = !state.emergencyOnly;
      chipIcuOnly.classList.toggle('active', state.emergencyOnly);
      const emergencyCheck = document.getElementById('emergencyFilterCheck');
      if (emergencyCheck) emergencyCheck.checked = state.emergencyOnly;
      await fetchHospitals();
      updateViews();
      showToast(state.emergencyOnly ? 'Filtering: Active ICU Beds Only' : 'Showing all hospital beds', 'info');
    });
  }

  const chipPmjayOnly = document.getElementById('chipPmjayOnly');
  if (chipPmjayOnly) {
    chipPmjayOnly.addEventListener('click', async () => {
      state.selectedSchemeFilter = state.selectedSchemeFilter === 'pmjay' ? 'all' : 'pmjay';
      chipPmjayOnly.classList.toggle('active', state.selectedSchemeFilter === 'pmjay');
      const schemeSelect = document.getElementById('schemeFilterSelect');
      if (schemeSelect) schemeSelect.value = state.selectedSchemeFilter;
      await fetchHospitals();
      updateViews();
      showToast(state.selectedSchemeFilter === 'pmjay' ? 'Filtering: Ayushman PM-JAY Cashless Network' : 'Showing all schemes', 'info');
    });
  }

  const chipGovtOnly = document.getElementById('chipGovtOnly');
  if (chipGovtOnly) {
    chipGovtOnly.addEventListener('click', async () => {
      state.activeHospType = state.activeHospType === 'government' ? 'all' : 'government';
      chipGovtOnly.classList.toggle('active', state.activeHospType === 'government');
      const typeSelect = document.getElementById('hospitalTypeSelect');
      if (typeSelect) typeSelect.value = state.activeHospType;
      await fetchHospitals();
      updateViews();
      showToast(state.activeHospType === 'government' ? 'Filtering: Government Apex Medical Colleges' : 'Showing all hospitals', 'info');
    });
  }

  const chipNabhOnly = document.getElementById('chipNabhOnly');
  if (chipNabhOnly) {
    chipNabhOnly.addEventListener('click', async () => {
      chipNabhOnly.classList.toggle('active');
      if (chipNabhOnly.classList.contains('active')) {
        state.searchKeyword = 'NABH';
        const searchInp = document.getElementById('searchInput');
        if (searchInp) searchInp.value = 'NABH';
      } else {
        state.searchKeyword = '';
        const searchInp = document.getElementById('searchInput');
        if (searchInp) searchInp.value = '';
      }
      await fetchHospitals();
      updateViews();
      showToast(chipNabhOnly.classList.contains('active') ? 'Filtering: NABH & JCI Accredited Centers' : 'Cleared accreditation filter', 'info');
    });
  }

  // Window Helper Callbacks for Leaflet Map Popups & Interactive Elements
  window.openExactGoogleMap = (hospId) => {
    const hosp = state.hospitals.find(h => h.id === hospId);
    if (hosp) openGoogleMapModal(hosp);
  };

  window.bookAmbulanceForHosp = (hospId) => {
    const hosp = state.hospitals.find(h => h.id === hospId);
    if (!hosp) return;
    const dropSelect = document.getElementById('ambDropHospitalSelect');
    if (dropSelect) {
      dropSelect.innerHTML = `<option value="${hosp.id}">${hosp.name} (${hosp.distanceKm || 4.2} km away)</option>`;
    }
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
    const targetSub = document.getElementById('subview-ambulance');
    if (targetSub) targetSub.style.display = 'block';
    initLiveTrackingMap('liveMapCanvas', 12);
    showToast(`Selected destination: ${hosp.name}`, 'warning');
  };

  // Global Dynamic Event Delegation (Card actions, compare, bed steppers)
  document.body.addEventListener('click', async (e) => {
    // Open Auth Modal
    if (e.target.closest('#btnOpenAuthModal')) {
      const authModal = document.getElementById('authModal');
      if (authModal) authModal.classList.add('active');
    }

    // View Full Hospital Profile & Doctors
    if (e.target.closest('.btn-view-profile')) {
      const hospId = e.target.closest('.btn-view-profile').dataset.id;
      const hosp = state.hospitals.find(h => h.id === hospId);
      if (hosp) {
        openHospitalDetailModal(hosp);
      }
    }

    // Open Exact Google Map Modal
    if (e.target.closest('.btn-open-google-map')) {
      const hospId = e.target.closest('.btn-open-google-map').dataset.id;
      const hosp = state.hospitals.find(h => h.id === hospId);
      if (hosp) {
        openGoogleMapModal(hosp);
      }
    }

    // Book Doctor OPD Token
    if (e.target.closest('.btn-book-opd-token')) {
      const btn = e.target.closest('.btn-book-opd-token');
      const hospName = btn.dataset.hosp;
      const docName = btn.dataset.doc;
      const docSpec = btn.dataset.spec;
      const fee = parseInt(btn.dataset.fee) || 0;
      openOpdTokenModal(hospName, docName, docSpec, fee);
    }

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

    // Modal Close Buttons
    if (e.target.closest('.modal-close') || e.target.classList.contains('modal-backdrop')) {
      document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('active'));
    }

    // Toggle Favorite Action
    if (e.target.closest('.btn-toggle-fav')) {
      const favBtn = e.target.closest('.btn-toggle-fav');
      const hospId = favBtn.dataset.id;
      if (hospId) toggleFavorite(hospId);
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

  // ==================== PATIENT PROFILE & HEALTH VAULT LISTENERS ====================

  // Toggle Add Record Panel
  const btnToggleAddRecord = document.getElementById('btnToggleAddRecord');
  const addRecordPanel = document.getElementById('addRecordPanel');
  if (btnToggleAddRecord && addRecordPanel) {
    btnToggleAddRecord.addEventListener('click', () => {
      addRecordPanel.style.display = addRecordPanel.style.display === 'none' ? 'block' : 'none';
    });
  }

  // Submit Patient Profile (Blood Group, Emergency Contact, Allergies)
  const formPatientProfile = document.getElementById('formPatientProfile');
  if (formPatientProfile) {
    formPatientProfile.addEventListener('submit', async (e) => {
      e.preventDefault();
      const bloodGroup = document.getElementById('profileBloodGroup').value;
      const emergencyContact = document.getElementById('profileEmergencyContact').value;
      const allergies = document.getElementById('profileAllergies').value;

      try {
        const res = await fetch('/api/user/profile', {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ bloodGroup, emergencyContact, allergies })
        });
        const data = await res.json();
        if (res.ok) {
          showToast('🩸 Patient Medical Profile & Blood Group updated!', 'success');
          const badgeBlood = document.getElementById('badgeProfileBloodGroup');
          if (badgeBlood) badgeBlood.textContent = `Blood Group: ${bloodGroup}`;
        } else {
          showToast(data.error || 'Failed to update profile', 'danger');
        }
      } catch (err) {
        console.error('Error updating profile:', err);
        showToast('Server communication error', 'danger');
      }
    });
  }

  // Submit New Health Record
  const formAddHealthRecord = document.getElementById('formAddHealthRecord');
  if (formAddHealthRecord) {
    formAddHealthRecord.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('recordTitle').value;
      const hospital = document.getElementById('recordHospital').value;
      const doctor = document.getElementById('recordDoctor').value;
      const date = document.getElementById('recordDate').value;
      const type = document.getElementById('recordType').value;
      const bloodGroup = document.getElementById('recordBloodGroup').value;
      const summary = document.getElementById('recordSummary').value;
      const fileRef = document.getElementById('recordFileRef').value;

      try {
        const res = await fetch('/api/records', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ title, hospital, doctor, date, type, bloodGroup, summary, fileRef })
        });

        if (res.ok) {
          showToast('📄 Medical record saved to digital vault!', 'success');
          formAddHealthRecord.reset();
          if (addRecordPanel) addRecordPanel.style.display = 'none';
          loadHealthRecords();
        } else {
          const data = await res.json();
          showToast(data.error || 'Failed to save record', 'danger');
        }
      } catch (err) {
        console.error('Error saving record:', err);
        showToast('Server communication error', 'danger');
      }
    });
  }

  // ==================== HOSPITAL ADMIN DASHBOARD LISTENERS ====================

  // Toggle Hospital Settings Panel
  document.body.addEventListener('click', async (e) => {
    if (e.target.closest('#btnToggleHospSettings')) {
      const panel = document.getElementById('hospSettingsPanel');
      if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }

    if (e.target.closest('#btnToggleAddTreatment')) {
      const panel = document.getElementById('addTreatmentPanel');
      if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }

    if (e.target.closest('#btnToggleAddDoctor')) {
      const panel = document.getElementById('addDoctorPanel');
      if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }

    // Delete Health Record
    if (e.target.closest('.btn-delete-record')) {
      const recId = e.target.closest('.btn-delete-record').dataset.id;
      if (confirm('Are you sure you want to delete this health record from your vault?')) {
        try {
          const res = await fetch(`/api/records/${recId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
          });
          if (res.ok) {
            showToast('Health record removed from vault', 'success');
            loadHealthRecords();
          } else {
            showToast('Failed to delete record', 'danger');
          }
        } catch (err) {
          showToast('Server error', 'danger');
        }
      }
    }

    // Delete Treatment (Admin)
    if (e.target.closest('.btn-delete-treatment')) {
      const btn = e.target.closest('.btn-delete-treatment');
      const hospId = btn.dataset.hosp;
      const treatId = btn.dataset.treat;

      if (confirm('Delete this procedure from hospital tariff list?')) {
        try {
          const res = await fetch(`/api/hospitals/${hospId}/treatments/${treatId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
          });
          if (res.ok) {
            showToast('Procedure deleted successfully', 'success');
            await fetchHospitals();
            updateViews();
          } else {
            showToast('Failed to delete treatment', 'danger');
          }
        } catch (err) {
          showToast('Server communication error', 'danger');
        }
      }
    }

    // Delete Doctor (Admin)
    if (e.target.closest('.btn-delete-doctor')) {
      const btn = e.target.closest('.btn-delete-doctor');
      const hospId = btn.dataset.hosp;
      const docId = btn.dataset.doc;

      if (confirm('Remove this doctor from hospital roster?')) {
        try {
          const res = await fetch(`/api/hospitals/${hospId}/doctors/${docId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
          });
          if (res.ok) {
            showToast('Doctor removed from roster', 'success');
            await fetchHospitals();
            updateViews();
          } else {
            showToast('Failed to remove doctor', 'danger');
          }
        } catch (err) {
          showToast('Server communication error', 'danger');
        }
      }
    }
  });

  // Submit Hospital Settings
  document.body.addEventListener('submit', async (e) => {
    if (e.target && e.target.id === 'formHospSettings') {
      e.preventDefault();
      const hospId = state.activeAdminHospitalId;
      const tagline = document.getElementById('settingTagline').value;
      const phone = document.getElementById('settingPhone').value;
      const opdWaitTimeMins = document.getElementById('settingOpdWait').value;
      const emergencyAvailable = document.getElementById('settingEmergency').checked;

      try {
        const res = await fetch(`/api/hospitals/${hospId}/settings`, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ tagline, phone, opdWaitTimeMins, emergencyAvailable })
        });
        if (res.ok) {
          showToast('Hospital settings & OPD status updated!', 'success');
          await fetchHospitals();
          updateViews();
        } else {
          showToast('Failed to update hospital settings', 'danger');
        }
      } catch (err) {
        showToast('Server communication error', 'danger');
      }
    }

    // Submit Add Treatment
    if (e.target && e.target.id === 'formAddTreatment') {
      e.preventDefault();
      const hospId = state.activeAdminHospitalId;
      const name = document.getElementById('newTreatName').value;
      const category = document.getElementById('newTreatCategory').value;
      const cost = document.getElementById('newTreatCost').value;
      const duration = document.getElementById('newTreatDuration').value;

      try {
        const res = await fetch(`/api/hospitals/${hospId}/treatments`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ name, category, cost, duration })
        });
        if (res.ok) {
          showToast(`Procedure "${name}" added to hospital tariff!`, 'success');
          document.getElementById('formAddTreatment').reset();
          document.getElementById('addTreatmentPanel').style.display = 'none';
          await fetchHospitals();
          updateViews();
        } else {
          const data = await res.json();
          showToast(data.error || 'Failed to add treatment', 'danger');
        }
      } catch (err) {
        showToast('Server communication error', 'danger');
      }
    }

    // Submit Add Doctor
    if (e.target && e.target.id === 'formAddDoctor') {
      e.preventDefault();
      const hospId = state.activeAdminHospitalId;
      const name = document.getElementById('newDocName').value;
      const spec = document.getElementById('newDocSpec').value;
      const exp = document.getElementById('newDocExp').value;
      const status = document.getElementById('newDocStatus').value;

      try {
        const res = await fetch(`/api/hospitals/${hospId}/doctors`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ name, spec, exp, status })
        });
        if (res.ok) {
          showToast(`${name} added to hospital roster!`, 'success');
          document.getElementById('formAddDoctor').reset();
          document.getElementById('addDoctorPanel').style.display = 'none';
          await fetchHospitals();
          updateViews();
        } else {
          const data = await res.json();
          showToast(data.error || 'Failed to add doctor', 'danger');
        }
      } catch (err) {
        showToast('Server communication error', 'danger');
      }
    }
  });

  // ==================== PATIENT PRIVACY & SECURITY HUB LISTENERS ====================

  // Submit Privacy & Consent Preferences
  const formPrivacy = document.getElementById('formPrivacySettings');
  if (formPrivacy) {
    formPrivacy.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emergencySosAutoShare = document.getElementById('toggleEmergencySosShare').checked;
      const maskContactDetails = document.getElementById('toggleMaskContact').checked;
      const allowResearchAnalytics = document.getElementById('toggleResearchAnalytics').checked;
      const emergencyPin = document.getElementById('settingEmergencyPin').value || '1234';

      try {
        const res = await fetch('/api/privacy/settings', {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ emergencySosAutoShare, maskContactDetails, allowResearchAnalytics, emergencyPin })
        });
        if (res.ok) {
          showToast('🛡️ Privacy preferences & consent rules saved successfully!', 'success');
          loadAuditLogs();
        } else {
          showToast('Failed to save privacy settings', 'danger');
        }
      } catch (err) {
        showToast('Server communication error', 'danger');
      }
    });
  }

  // Emergency Medical Pass PIN Unlock
  const btnUnlockPass = document.getElementById('btnUnlockMedicalPass');
  const btnLockPass = document.getElementById('btnLockMedicalPass');
  if (btnUnlockPass) {
    btnUnlockPass.addEventListener('click', async () => {
      const pin = document.getElementById('inputEmergencyPin').value;
      if (!pin || pin.length < 4) {
        showToast('Please enter your 4-digit emergency PIN', 'warning');
        return;
      }

      try {
        const res = await fetch('/api/emergency/verify-pin', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ emergencyPin: pin })
        });
        const data = await res.json();
        if (res.ok && data.unlocked) {
          const passContact = document.getElementById('passEmergencyContact');
          const passAllergies = document.getElementById('passAllergies');
          if (passContact) {
            passContact.textContent = data.emergencyContact;
            passContact.className = 'unmasked-data-field';
          }
          if (passAllergies) {
            passAllergies.textContent = data.allergies || 'None Reported';
            passAllergies.className = 'unmasked-data-field';
          }
          
          const badge = document.getElementById('medicalPassStatusBadge');
          if (badge) {
            badge.innerHTML = '🔓 Emergency Pass Unmasked';
            badge.style.background = '#fef3c7';
            badge.style.color = '#b45309';
            badge.style.borderColor = '#fde68a';
          }
          btnUnlockPass.style.display = 'none';
          if (btnLockPass) btnLockPass.style.display = 'inline-block';
          showToast('Emergency Medical ID unmasked for healthcare personnel!', 'success');
          loadAuditLogs();
        } else {
          showToast(data.error || 'Invalid Emergency PIN', 'danger');
          loadAuditLogs();
        }
      } catch (err) {
        showToast('Verification server error', 'danger');
      }
    });
  }

  // Emergency Medical Pass Lock / Re-mask
  if (btnLockPass) {
    btnLockPass.addEventListener('click', () => {
      loadUserProfile();
      const passContact = document.getElementById('passEmergencyContact');
      const passAllergies = document.getElementById('passAllergies');
      if (passContact) passContact.className = 'masked-data-field';
      if (passAllergies) passAllergies.className = 'masked-data-field';

      const badge = document.getElementById('medicalPassStatusBadge');
      if (badge) {
        badge.innerHTML = '🔒 Privacy Masking Active';
        badge.style.background = '#ecfdf5';
        badge.style.color = '#065f46';
        badge.style.borderColor = '#a7f3d0';
      }
      btnLockPass.style.display = 'none';
      if (btnUnlockPass) btnUnlockPass.style.display = 'inline-block';
      const pinInput = document.getElementById('inputEmergencyPin');
      if (pinInput) pinInput.value = '';
      showToast('Medical pass data re-masked for privacy', 'info');
    });
  }

  // Export Encrypted Health Vault (.JSON)
  const btnExportData = document.getElementById('btnExportData');
  if (btnExportData) {
    btnExportData.addEventListener('click', async () => {
      try {
        showToast('Generating encrypted health vault archive with SHA-256 integrity hash...', 'info');
        const res = await fetch('/api/privacy/export-data', {
          method: 'POST',
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `medigo_encrypted_health_vault_${Date.now()}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          showToast(`📦 Health vault exported with SHA-256 Checksum: ${data.exportMetadata?.integrityChecksumSha256?.slice(0, 10)}...`, 'success');
          loadAuditLogs();
        } else {
          showToast('Failed to generate export file', 'danger');
        }
      } catch (err) {
        showToast('Export error', 'danger');
      }
    });
  }

  // DPDP Right to Erasure / Purge Data
  const btnDataPurge = document.getElementById('btnTriggerDataPurge');
  if (btnDataPurge) {
    btnDataPurge.addEventListener('click', async () => {
      const pwd = prompt('⚠️ DPDP RIGHT TO ERASURE CONFIRMATION\n\nEnter your account password to permanently purge all personal health records, vault, and booking history:');
      if (!pwd) return;

      try {
        const res = await fetch('/api/privacy/purge-data', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ confirmationPassword: pwd })
        });
        const data = await res.json();
        if (res.ok) {
          showToast(data.message || 'Data securely purged under DPDP compliance.', 'success');
          loadHealthRecords();
          loadUserProfile();
          loadAuditLogs();
        } else {
          showToast(data.error || 'Data purge authorization failed', 'danger');
        }
      } catch (err) {
        showToast('Purge communication error', 'danger');
      }
    });
  }

  // Refresh Privacy Audit Logs
  const btnRefreshLogs = document.getElementById('btnRefreshAuditLogs');
  if (btnRefreshLogs) {
    btnRefreshLogs.addEventListener('click', () => {
      loadAuditLogs();
      showToast('Live privacy audit trail refreshed', 'info');
    });
  }

  // ==================== HEALTH SCHEMES & DIGITAL KYC LISTENERS ====================

  // Scheme Filter in Hospital Search Sidebar
  const schemeFilterSelect = document.getElementById('schemeFilterSelect');
  if (schemeFilterSelect) {
    schemeFilterSelect.addEventListener('change', async (e) => {
      state.selectedSchemeFilter = e.target.value;
      await fetchHospitals();
      updateViews();
    });
  }

  // Toggle Add Scheme Panel
  const btnToggleAddScheme = document.getElementById('btnToggleAddScheme');
  if (btnToggleAddScheme) {
    btnToggleAddScheme.addEventListener('click', () => {
      const panel = document.getElementById('addSchemeKycPanel');
      if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });
  }

  // Scheme Select Change Helper (Update format placeholder hint)
  const kycSchemeSelect = document.getElementById('kycSchemeSelect');
  const kycCardNumberInput = document.getElementById('kycCardNumber');
  const kycFormatHint = document.getElementById('kycFormatHint');

  const schemeHints = {
    pmjay: { placeholder: 'PMJAY-9842-7105-3318', hint: 'Format: PMJAY-XXXX-XXXX-XXXX' },
    abha: { placeholder: '91-4589-2314-8790', hint: 'Format: 14-digit ABHA ID (XX-XXXX-XXXX-XXXX)' },
    cghs: { placeholder: 'CGHS-7845123', hint: 'Format: CGHS-XXXXXXX (6 to 8 digits)' },
    echs: { placeholder: 'ECHS-DEL-458921', hint: 'Format: ECHS-CITY-XXXXXX' },
    esis: { placeholder: 'ESIC-3100589642', hint: 'Format: ESIC-XXXXXXXXXX' },
    state_up_pmjay: { placeholder: 'UPMJAY-5412-8963-7412', hint: 'Format: UPMJAY-XXXX-XXXX-XXXX' },
    state_delhi_dhas: { placeholder: 'DAK-DEL-984512', hint: 'Format: DAK-DEL-XXXXXX' },
    state_maha_mjpjay: { placeholder: 'MJPJAY-MH-584796', hint: 'Format: MJPJAY-MH-XXXXXX' },
    state_wb_swasthya: { placeholder: 'SS-WB-1904-8521-9630', hint: 'Format: SS-WB-XXXX-XXXX-XXXX' },
    state_ap_aarogyasri: { placeholder: 'YSR-AP-4512-8963', hint: 'Format: YSR-AP-XXXX-XXXX' },
    private_star_health: { placeholder: 'STAR-POL-2026-985412', hint: 'Format: STAR-POL-XXXX-XXXXXX' },
    private_hdfc_ergo: { placeholder: 'HDFC-POL-45892147', hint: 'Format: HDFC-POL-XXXXXXXX' }
  };

  if (kycSchemeSelect && kycCardNumberInput && kycFormatHint) {
    kycSchemeSelect.addEventListener('change', (e) => {
      const selected = e.target.value;
      const meta = schemeHints[selected] || { placeholder: 'Card / Policy Number', hint: 'Enter valid scheme ID number' };
      kycCardNumberInput.placeholder = meta.placeholder;
      kycFormatHint.textContent = meta.hint;
    });
  }

  // Form Submit: Instant Digital KYC Verification
  const formVerifyScheme = document.getElementById('formVerifySchemeKyc');
  if (formVerifyScheme) {
    formVerifyScheme.addEventListener('submit', async (e) => {
      e.preventDefault();
      const schemeId = document.getElementById('kycSchemeSelect').value;
      const cardNumber = document.getElementById('kycCardNumber').value;
      const beneficiaryName = document.getElementById('kycBeneficiaryName').value;
      const idProofType = document.getElementById('kycIdProofType').value;
      const idProofNumber = document.getElementById('kycIdProofNumber').value;
      const familyMembersCount = document.getElementById('kycFamilyMembers').value;

      try {
        showToast('⚡ Processing Digital e-KYC Verification with Government Gateway...', 'info');
        const res = await fetch('/api/kyc/verify-scheme', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ schemeId, cardNumber, beneficiaryName, idProofType, idProofNumber, familyMembersCount })
        });
        const data = await res.json();
        if (res.ok) {
          showToast(data.message || 'Scheme KYC Verified Successfully!', 'success');
          formVerifyScheme.reset();
          const panel = document.getElementById('addSchemeKycPanel');
          if (panel) panel.style.display = 'none';
          loadPatientSchemes();
          loadAuditLogs();
        } else {
          showToast(data.error || 'KYC verification failed', 'danger');
        }
      } catch (err) {
        showToast('Server communication error', 'danger');
      }
    });
  }

  // Global Dynamic Delegation for Schemes (Unlink & Catalog Apply)
  document.body.addEventListener('click', async (e) => {
    // Unlink Scheme Card
    if (e.target.closest('.btn-unlink-scheme')) {
      const cardId = e.target.closest('.btn-unlink-scheme').dataset.id;
      if (confirm('Are you sure you want to unlink this verified scheme card from your profile?')) {
        try {
          const res = await fetch(`/api/kyc/my-schemes/${cardId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
          });
          if (res.ok) {
            showToast('Scheme card unlinked successfully', 'info');
            loadPatientSchemes();
            loadAuditLogs();
          } else {
            showToast('Failed to unlink scheme card', 'danger');
          }
        } catch (err) {
          showToast('Server communication error', 'danger');
        }
      }
    }

    // Select Scheme from Catalog Directory
    if (e.target.closest('.btn-select-catalog-scheme')) {
      const btn = e.target.closest('.btn-select-catalog-scheme');
      const schemeId = btn.dataset.id;
      const panel = document.getElementById('addSchemeKycPanel');
      const select = document.getElementById('kycSchemeSelect');
      if (panel) panel.style.display = 'block';
      if (select) {
        select.value = schemeId;
        select.dispatchEvent(new Event('change'));
      }
      panel.scrollIntoView({ behavior: 'smooth' });
    }

    // Favorite Button Click
    if (e.target.closest('.btn-favorite-hospital')) {
      const hospId = e.target.closest('.btn-favorite-hospital').dataset.id;
      toggleFavorite(hospId);
    }

    // View Hospital on Map Click
    if (e.target.closest('.btn-locate-hosp')) {
      const btn = e.target.closest('.btn-locate-hosp');
      const lat = parseFloat(btn.dataset.lat) || 28.7500;
      const lng = parseFloat(btn.dataset.lng) || 77.4500;
      const name = btn.dataset.name;

      const btnViewMap = document.getElementById('btnViewMap');
      const btnViewList = document.getElementById('btnViewList');
      const hospitalListContainer = document.getElementById('hospitalListContainer');
      const allHospitalsMapCanvas = document.getElementById('allHospitalsMapCanvas');

      if (btnViewMap && btnViewList && hospitalListContainer && allHospitalsMapCanvas) {
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
        setTimeout(() => {
          focusHospitalOnMap(lat, lng, name);
        }, 350);

        allHospitalsMapCanvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  });

  // Favorite Filter Toggle Button
  const btnFilterFav = document.getElementById('btnFilterFavorites');
  if (btnFilterFav) {
    btnFilterFav.addEventListener('click', () => {
      state.showFavoritesOnly = !state.showFavoritesOnly;
      if (state.showFavoritesOnly) {
        btnFilterFav.classList.add('active');
        showToast(`Showing ${state.favoritesList.length} favorite hospitals`, 'info');
      } else {
        btnFilterFav.classList.remove('active');
      }
      updateViews();
    });
  }
});

