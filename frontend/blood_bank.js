// Blood Bank, Emergency SOS & Voluntary Donor Network Module — MediGo Platform
import { escapeHtml } from './patient.js';

let bloodState = {
  inventory: [],
  requests: [],
  donors: [],
  selectedGroup: 'all',
  selectedComponent: 'all',
  selectedCity: 'all',
  searchQuery: ''
};

// Blood Compatibility Chart Data (Red Blood Cells)
const COMPATIBILITY_DATA = {
  'O-': { canDonateTo: ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'], canReceiveFrom: ['O-'], notes: 'Universal Red Cell Donor' },
  'O+': { canDonateTo: ['O+', 'A+', 'B+', 'AB+'], canReceiveFrom: ['O-', 'O+'], notes: 'Most Transfused Blood Type' },
  'A-': { canDonateTo: ['A-', 'A+', 'AB-', 'AB+'], canReceiveFrom: ['O-', 'A-'], notes: 'Rare & High Demand' },
  'A+': { canDonateTo: ['A+', 'AB+'], canReceiveFrom: ['O-', 'O+', 'A-', 'A+'], notes: 'Second Most Common' },
  'B-': { canDonateTo: ['B-', 'B+', 'AB-', 'AB+'], canReceiveFrom: ['O-', 'B-'], notes: 'Rare Rh-Negative Type' },
  'B+': { canDonateTo: ['B+', 'AB+'], canReceiveFrom: ['O-', 'O+', 'B-', 'B+'], notes: 'High Clinical Need' },
  'AB-': { canDonateTo: ['AB-', 'AB+'], canReceiveFrom: ['O-', 'A-', 'B-', 'AB-'], notes: 'Universal Platelet/Plasma Candidate' },
  'AB+': { canDonateTo: ['AB+'], canReceiveFrom: ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'], notes: 'Universal Red Cell Recipient' }
};

export function initBloodBankModule() {
  // Blood Group Filter Chips
  document.querySelectorAll('.blood-group-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      document.querySelectorAll('.blood-group-chip').forEach(c => c.classList.remove('active'));
      e.currentTarget.classList.add('active');
      bloodState.selectedGroup = e.currentTarget.dataset.group;
      filterAndRenderInventory();
    });
  });

  // Component Filter Dropdown
  const compFilter = document.getElementById('bloodComponentFilter');
  if (compFilter) {
    compFilter.addEventListener('change', (e) => {
      bloodState.selectedComponent = e.target.value;
      filterAndRenderInventory();
    });
  }

  // Hospital / City Search
  const bloodSearchInput = document.getElementById('bloodSearchInput');
  if (bloodSearchInput) {
    let timeout = null;
    bloodSearchInput.addEventListener('input', (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        bloodState.searchQuery = e.target.value.toLowerCase().trim();
        filterAndRenderInventory();
      }, 250);
    });
  }

  // Emergency SOS Request Modal Triggers
  const btnOpenSosModal = document.getElementById('btnOpenBloodRequestModal');
  const bloodReqModal = document.getElementById('bloodRequestModal');
  const btnCloseReqModal = document.getElementById('btnCloseBloodRequestModal');
  if (btnOpenSosModal && bloodReqModal) {
    btnOpenSosModal.addEventListener('click', () => bloodReqModal.classList.add('active'));
  }
  if (btnCloseReqModal && bloodReqModal) {
    btnCloseReqModal.addEventListener('click', () => bloodReqModal.classList.remove('active'));
  }

  // Donor Registration Modal Triggers
  const btnOpenDonorModal = document.getElementById('btnOpenDonorModal');
  const donorModal = document.getElementById('donorRegisterModal');
  const btnCloseDonorModal = document.getElementById('btnCloseDonorModal');
  if (btnOpenDonorModal && donorModal) {
    btnOpenDonorModal.addEventListener('click', () => donorModal.classList.add('active'));
  }
  if (btnCloseDonorModal && donorModal) {
    btnCloseDonorModal.addEventListener('click', () => donorModal.classList.remove('active'));
  }

  // Submit Emergency SOS Blood Request
  const bloodReqForm = document.getElementById('bloodRequestForm');
  if (bloodReqForm) {
    bloodReqForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        patientName: document.getElementById('reqPatientName')?.value,
        bloodGroup: document.getElementById('reqBloodGroup')?.value,
        component: document.getElementById('reqComponent')?.value,
        unitsNeeded: parseInt(document.getElementById('reqUnitsNeeded')?.value, 10),
        hospitalName: document.getElementById('reqHospitalName')?.value,
        city: document.getElementById('reqCity')?.value || 'New Delhi',
        contactPhone: document.getElementById('reqContactPhone')?.value,
        urgency: document.getElementById('reqUrgency')?.value
      };

      try {
        const res = await fetch('/api/blood/requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
          showToast('🚨 Emergency Blood Request broadcasted live to all donors & network!', 'success');
          bloodReqForm.reset();
          if (bloodReqModal) bloodReqModal.classList.remove('active');
          await loadBloodBankData();
        } else {
          showToast(data.error || 'Failed to broadcast blood request.', 'danger');
        }
      } catch (err) {
        console.error('Error broadcasting blood request:', err);
        showToast('Network error while broadcasting request.', 'danger');
      }
    });
  }

  // Submit Voluntary Donor Registration
  const donorForm = document.getElementById('donorRegisterForm');
  if (donorForm) {
    donorForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        name: document.getElementById('donorName')?.value,
        bloodGroup: document.getElementById('donorBloodGroup')?.value,
        city: document.getElementById('donorCity')?.value || 'New Delhi',
        contactPhone: document.getElementById('donorPhone')?.value,
        email: document.getElementById('donorEmail')?.value,
        lastDonationDate: document.getElementById('donorLastDate')?.value
      };

      try {
        const res = await fetch('/api/blood/donors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
          showToast('❤️ Thank you! You are enrolled in the verified donor network.', 'success');
          donorForm.reset();
          if (donorModal) donorModal.classList.remove('active');
          await loadBloodBankData();
        } else {
          showToast(data.error || 'Failed to register donor.', 'danger');
        }
      } catch (err) {
        console.error('Error enrolling donor:', err);
        showToast('Network error while registering donor.', 'danger');
      }
    });
  }

  // Interactive Blood Compatibility Selector
  const compatSelect = document.getElementById('compatBloodSelect');
  if (compatSelect) {
    compatSelect.addEventListener('change', (e) => {
      updateCompatibilityView(e.target.value);
    });
  }
}

export async function loadBloodBankData() {
  try {
    const [invRes, statsRes, reqRes, donorRes] = await Promise.all([
      fetch('/api/blood/inventory'),
      fetch('/api/blood/stats'),
      fetch('/api/blood/requests'),
      fetch('/api/blood/donors')
    ]);

    if (invRes.ok) bloodState.inventory = await invRes.json();
    if (statsRes.ok) {
      const stats = await statsRes.json();
      renderBloodStats(stats);
    }
    if (reqRes.ok) {
      bloodState.requests = await reqRes.json();
      renderSosRequests(bloodState.requests);
    }
    if (donorRes.ok) {
      bloodState.donors = await donorRes.json();
      renderDonors(bloodState.donors);
    }

    filterAndRenderInventory();
    updateCompatibilityView('O-');
  } catch (err) {
    console.error('Error loading blood bank data:', err);
  }
}

function filterAndRenderInventory() {
  const container = document.getElementById('bloodInventoryContainer');
  if (!container) return;

  let filtered = bloodState.inventory.filter(item => {
    if (bloodState.selectedGroup !== 'all' && item.blood_group !== bloodState.selectedGroup) {
      return false;
    }
    if (bloodState.selectedComponent !== 'all' && !item.component.toLowerCase().includes(bloodState.selectedComponent.toLowerCase())) {
      return false;
    }
    if (bloodState.searchQuery) {
      const q = bloodState.searchQuery;
      const match = (item.hospital_name && item.hospital_name.toLowerCase().includes(q)) ||
                    (item.city && item.city.toLowerCase().includes(q)) ||
                    (item.blood_group && item.blood_group.toLowerCase().includes(q)) ||
                    (item.component && item.component.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  const countBadge = document.getElementById('bloodStockCountBadge');
  if (countBadge) {
    countBadge.textContent = `${filtered.length} Blood Units Verified`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="card-panel" style="text-align: center; padding: 3rem 1.5rem; grid-column: 1 / -1;">
        <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">🩸</div>
        <h4 style="color: var(--slate-800); font-size: 1.1rem; margin-bottom: 4px;">No Stock Found for Selected Criteria</h4>
        <p style="color: var(--slate-500); font-size: 0.85rem; max-width: 420px; margin: 0 auto 1.25rem;">
          No verified units match this specific blood group or component right now. You can broadcast an urgent SOS request directly to hospitals and donors.
        </p>
        <button class="btn btn-danger" onclick="document.getElementById('btnOpenBloodRequestModal').click();">
          🚨 Broadcast Emergency SOS Request
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(item => {
    const isCritical = item.units_available <= 5;
    const isLow = item.units_available > 5 && item.units_available < 12;
    const statusColor = isCritical ? '#ef4444' : (isLow ? '#d97706' : '#059669');
    const statusBg = isCritical ? '#fee2e2' : (isLow ? '#fef3c7' : '#dcfce7');
    const statusText = isCritical ? 'Critical Stock' : (isLow ? 'Moderate Stock' : 'Ready Stock');

    return `
      <div class="blood-card">
        <div class="blood-card-header">
          <div>
            <span class="blood-group-badge">${escapeHtml(item.blood_group)}</span>
            <span class="blood-comp-tag">${escapeHtml(item.component)}</span>
          </div>
          <span style="font-size: 0.75rem; font-weight: 700; padding: 3px 8px; border-radius: 6px; background: ${statusBg}; color: ${statusColor};">
            ${statusText}
          </span>
        </div>

        <div style="margin: 0.85rem 0;">
          <h4 style="font-size: 0.96rem; color: var(--slate-900); font-weight: 700; margin-bottom: 2px;">
            ${escapeHtml(item.hospital_name)}
          </h4>
          <div style="font-size: 0.8rem; color: var(--slate-500); display: flex; align-items: center; gap: 4px;">
            <span>📍 ${escapeHtml(item.city || 'New Delhi')}, ${escapeHtml(item.state || 'Delhi')}</span>
          </div>
        </div>

        <div style="display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 0.85rem; background: var(--slate-50); padding: 8px 12px; border-radius: 8px; border: 1px solid var(--slate-200);">
          <span style="font-size: 0.82rem; color: var(--slate-600); font-weight: 600;">Available Units:</span>
          <span style="font-size: 1.25rem; font-weight: 800; color: ${statusColor};">
            ${item.units_available} <span style="font-size: 0.78rem; font-weight: 600; color: var(--slate-500);">Bags</span>
          </span>
        </div>

        <div style="display: flex; gap: 8px; align-items: center;">
          <a href="tel:${escapeHtml(item.contact_phone || '+911126588500')}" class="btn btn-primary" style="flex: 1; padding: 7px 10px; font-size: 0.8rem; font-weight: 700; text-align: center; text-decoration: none;">
            📞 Call Blood Bank
          </a>
          <button class="btn btn-outline" style="padding: 7px 10px; font-size: 0.8rem; font-weight: 600;" onclick="prefillEmergencyRequest('${escapeHtml(item.blood_group)}', '${escapeHtml(item.hospital_name)}', '${escapeHtml(item.component)}')">
            Request
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function renderBloodStats(stats) {
  const elTotal = document.getElementById('statTotalBloodUnits');
  const elCritical = document.getElementById('statCriticalBloodAlerts');
  const elSos = document.getElementById('statActiveBloodSos');
  const elDonors = document.getElementById('statVerifiedDonors');

  if (elTotal) elTotal.textContent = stats.totalUnits || '0';
  if (elCritical) elCritical.textContent = stats.lowStockAlerts || '0';
  if (elSos) elSos.textContent = stats.activeSosRequests || '0';
  if (elDonors) elDonors.textContent = stats.verifiedDonors || '0';
}

function renderSosRequests(requests) {
  const container = document.getElementById('bloodSosTickerContainer');
  if (!container) return;

  if (requests.length === 0) {
    container.innerHTML = `
      <div style="padding: 1rem; text-align: center; color: var(--slate-500); font-size: 0.85rem;">
        No active critical emergency requests at this moment. Blood bank reserves are currently stable.
      </div>
    `;
    return;
  }

  container.innerHTML = requests.map(req => {
    const isCritical = req.urgency.includes('2 hrs');
    const badgeColor = isCritical ? '#dc2626' : '#d97706';
    const badgeBg = isCritical ? '#fee2e2' : '#fef3c7';

    return `
      <div class="sos-request-card">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="blood-group-badge" style="font-size: 0.92rem; padding: 2px 8px;">${escapeHtml(req.blood_group)}</span>
            <div>
              <strong style="color: var(--slate-900); font-size: 0.92rem;">${escapeHtml(req.patient_name)}</strong>
              <div style="font-size: 0.76rem; color: var(--slate-500);">${escapeHtml(req.component)} • <strong>${req.units_needed} Units Needed</strong></div>
            </div>
          </div>
          <span style="font-size: 0.72rem; font-weight: 700; background: ${badgeBg}; color: ${badgeColor}; padding: 2px 8px; border-radius: 12px;">
            ${escapeHtml(req.urgency)}
          </span>
        </div>

        <div style="font-size: 0.8rem; color: var(--slate-600); margin: 6px 0;">
          📍 <strong>Hospital:</strong> ${escapeHtml(req.hospital_name)} (${escapeHtml(req.city)})
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
          <a href="tel:${escapeHtml(req.contact_phone)}" class="btn btn-danger" style="padding: 5px 12px; font-size: 0.78rem; font-weight: 700; text-decoration: none;">
            🚨 Contact Attendant: ${escapeHtml(req.contact_phone)}
          </a>
          <button class="btn btn-outline" style="padding: 4px 10px; font-size: 0.75rem;" onclick="fulfillBloodRequest('${req.id}')">
            Mark Fulfilled
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function renderDonors(donors) {
  const container = document.getElementById('bloodDonorsGrid');
  if (!container) return;

  if (donors.length === 0) {
    container.innerHTML = `
      <div style="padding: 1.5rem; text-align: center; color: var(--slate-500); font-size: 0.85rem; grid-column: 1 / -1;">
        No registered voluntary donors in this district yet. Be the first to enroll!
      </div>
    `;
    return;
  }

  container.innerHTML = donors.map(d => {
    return `
      <div class="donor-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <div style="font-weight: 700; color: var(--slate-900); font-size: 0.92rem;">${escapeHtml(d.name)}</div>
          <span class="blood-group-badge" style="font-size: 0.8rem; padding: 2px 7px;">${escapeHtml(d.blood_group)}</span>
        </div>
        <div style="font-size: 0.78rem; color: var(--slate-500); margin-bottom: 6px;">
          📍 ${escapeHtml(d.city)} • Verified Citizen Donor
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem;">
          <span style="color: var(--slate-700); font-family: monospace; font-weight: 600;">📞 ${escapeHtml(d.maskedPhone || '+91 98****1234')}</span>
          <span style="color: #059669; font-weight: 700; font-size: 0.74rem;">Ready to Donate</span>
        </div>
      </div>
    `;
  }).join('');
}

function updateCompatibilityView(group) {
  const info = COMPATIBILITY_DATA[group];
  if (!info) return;

  const titleEl = document.getElementById('compatGroupTitle');
  const donateEl = document.getElementById('compatCanDonate');
  const receiveEl = document.getElementById('compatCanReceive');
  const notesEl = document.getElementById('compatNotes');

  if (titleEl) titleEl.textContent = `Blood Compatibility: Group ${group}`;
  if (notesEl) notesEl.textContent = info.notes;

  if (donateEl) {
    donateEl.innerHTML = info.canDonateTo.map(g => `<span class="compat-pill">${g}</span>`).join('');
  }
  if (receiveEl) {
    receiveEl.innerHTML = info.canReceiveFrom.map(g => `<span class="compat-pill">${g}</span>`).join('');
  }
}

window.prefillEmergencyRequest = (bloodGroup, hospitalName, component) => {
  const modal = document.getElementById('bloodRequestModal');
  if (!modal) return;
  modal.classList.add('active');

  const bgSelect = document.getElementById('reqBloodGroup');
  const hospInput = document.getElementById('reqHospitalName');
  const compSelect = document.getElementById('reqComponent');

  if (bgSelect) bgSelect.value = bloodGroup;
  if (hospInput) hospInput.value = hospitalName;
  if (compSelect) compSelect.value = component;
};

window.fulfillBloodRequest = async (id) => {
  if (!confirm('Has this emergency blood requirement been fulfilled?')) return;
  try {
    const res = await fetch(`/api/blood/requests/${id}/fulfill`, { method: 'PUT' });
    if (res.ok) {
      showToast('Blood request marked fulfilled. Thank you!', 'success');
      await loadBloodBankData();
    }
  } catch (err) {
    console.error('Error fulfilling request:', err);
  }
};

function showToast(msg, type = 'info') {
  if (window.showToast) window.showToast(msg, type);
  else alert(msg);
}
