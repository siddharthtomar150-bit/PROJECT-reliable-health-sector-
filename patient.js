// Patient Experience Module - MediGo Platform

let compareList = [];

export function renderPatientSearch(hospitals, activeTreatment = 'all', maxBudget = 200000, emergencyOnly = false, hospType = 'all') {
  const container = document.getElementById('hospitalListContainer');
  if (!container) return;

  let filtered = hospitals.filter(h => {
    if (hospType !== 'all' && h.type !== hospType) return false;
    if (emergencyOnly && !h.emergencyAvailable) return false;
    if (h.estimatedAvgCost > maxBudget) return false;
    if (activeTreatment !== 'all') {
      const query = activeTreatment.toLowerCase();
      const hasTreatment = h.treatments.some(t => 
        (t.id && t.id.toLowerCase() === query) || 
        (t.name && t.name.toLowerCase().includes(query)) || 
        (t.category && t.category.toLowerCase().includes(query))
      ) || (h.specialties && h.specialties.toLowerCase().includes(query))
        || (h.tagline && h.tagline.toLowerCase().includes(query));
      if (!hasTreatment) return false;
    }
    return true;
  });

  const countBadge = document.getElementById('searchCountBadge');
  if (countBadge) countBadge.textContent = `${filtered.length} Hospitals Available`;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="card-panel" style="text-align: center; padding: 3rem 1.5rem;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">🏥</div>
        <h3>No Hospitals Found</h3>
        <p style="color: var(--text-muted); margin-top: 0.5rem;">Try adjusting your budget limit or treatment filter to see more options.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(h => {
    const isCompared = compareList.some(item => item.id === h.id);
    const isGovt = h.type === 'government';
    const isVerified = h.verification_status === 'verified' || h.reg_number || h.type === 'government' || h.status === 'published';

    return `
      <div class="hospital-card" id="card-${h.id}">
        <div class="hospital-card-header">
          <div class="hospital-title-group">
            <h3>
              ${h.name} 
              <span class="badge-tag ${isGovt ? 'govt' : 'pvt'}">${h.badge}</span>
              ${isVerified ? `<span style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 12px; display: inline-flex; align-items: center; gap: 4px; margin-left: 4px;">🛡️ Verified Partner</span>` : ''}
            </h3>
            <p class="hospital-tagline">${h.tagline} • 📍 ${h.location}</p>
            ${h.specialties ? `<div style="font-size: 0.8rem; color: #475569; margin-top: 4px;"><strong>Specialties:</strong> ${h.specialties}</div>` : ''}
          </div>
          <div style="text-align: right;">
            <div style="font-size: 1.05rem; font-weight: 700; color: #d97706; display: flex; align-items: center; justify-content: flex-end; gap: 4px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#d97706" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              ${h.rating} <span style="font-size: 0.78rem; color: #64748b; font-weight: 500;">(${h.reviewCount})</span>
            </div>
            <div style="font-size: 0.85rem; font-weight: 700; color: var(--primary); margin-top: 2px;">Est. Cost: ₹${h.estimatedAvgCost.toLocaleString()}</div>
          </div>
        </div>

        <div class="bed-availability-pills">
          <div class="bed-pill icu">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>ICU Beds:</span> <strong>${h.beds.icu.available} / ${h.beds.icu.total} Available</strong>
          </div>
          <div class="bed-pill emergency">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            <span>Emergency:</span> <strong>${h.beds.emergency.available} / ${h.beds.emergency.total} Available</strong>
          </div>
          <div class="bed-pill general">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9"/></svg>
            <span>General:</span> <strong>${h.beds.general.available} / ${h.beds.general.total} Available</strong>
          </div>
        </div>

        <div class="hospital-meta-strip">
          <div>Distance: <strong>${h.distanceKm} km</strong></div>
          <div>OPD Wait: <strong>~${h.opdWaitTimeMins} mins</strong></div>
          <div>Phone: <strong>${h.phone}</strong></div>
          <div>Facilities: <strong>${h.facilities.slice(0, 3).join(' • ')}</strong></div>
        </div>

        <div class="hospital-card-actions">
          <button class="btn btn-primary btn-book-amb" data-id="${h.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
            Book Ambulance
          </button>
          <button class="btn ${isCompared ? 'btn-danger' : 'btn-outline'} btn-toggle-compare" data-id="${h.id}">
            ${isCompared ? '✓ Added to Compare' : '+ Add to Compare'}
          </button>
          <button class="btn btn-outline btn-view-treatments" data-id="${h.id}">
            View Tariff Breakdown
          </button>
        </div>
      </div>
    `;
  }).join('');
}

export function toggleCompareHospital(hospital, updateCallback) {
  const index = compareList.findIndex(h => h.id === hospital.id);
  if (index > -1) {
    compareList.splice(index, 1);
  } else {
    if (compareList.length >= 3) {
      alert("You can compare up to 3 hospitals side-by-side.");
      return;
    }
    compareList.push(hospital);
  }
  updateCallback();
}

export function renderComparisonModal() {
  const modal = document.getElementById('compareModal');
  const body = document.getElementById('compareModalBody');
  if (!modal || !body) return;

  if (compareList.length === 0) {
    body.innerHTML = `<p style="text-align: center; color: var(--text-muted);">Please select at least 1 hospital to compare.</p>`;
  } else {
    body.innerHTML = `
      <table class="compare-table">
        <thead>
          <tr>
            <th>Feature / Parameter</th>
            ${compareList.map(h => `<th>${h.name}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Estimated Avg. Cost</strong></td>
            ${compareList.map(h => `<td><strong style="color: var(--primary);">₹${h.estimatedAvgCost.toLocaleString()}</strong></td>`).join('')}
          </tr>
          <tr>
            <td><strong>Distance from Location</strong></td>
            ${compareList.map(h => `<td>${h.distanceKm} km away</td>`).join('')}
          </tr>
          <tr>
            <td><strong>ICU Beds Available</strong></td>
            ${compareList.map(h => `<td><span class="bed-pill icu">${h.beds.icu.available} Available</span></td>`).join('')}
          </tr>
          <tr>
            <td><strong>OPD Waiting Time</strong></td>
            ${compareList.map(h => `<td>~${h.opdWaitTimeMins} mins</td>`).join('')}
          </tr>
          <tr>
            <td><strong>User Rating</strong></td>
            ${compareList.map(h => `<td>★ ${h.rating} / 5.0</td>`).join('')}
          </tr>
          <tr>
            <td><strong>Key Facilities</strong></td>
            ${compareList.map(h => `<td><ul style="padding-left: 1.2rem;">${h.facilities.map(f => `<li>${f}</li>`).join('')}</ul></td>`).join('')}
          </tr>
        </tbody>
      </table>
    `;
  }
  modal.classList.add('active');
}

let patientMapInstance = null;
let driverMapInstance = null;

export function initLiveTrackingMap(containerId = 'liveMapCanvas', etaMins = 12) {
  const mapElement = document.getElementById(containerId);
  if (!mapElement || typeof L === 'undefined') return;

  // Cleanup existing map instance if already initialized on this canvas
  if (containerId === 'liveMapCanvas' && patientMapInstance) {
    patientMapInstance.remove();
    patientMapInstance = null;
  }
  if (containerId === 'driverLiveMapCanvas' && driverMapInstance) {
    driverMapInstance.remove();
    driverMapInstance = null;
  }

  const pickupCoords = [28.9610, 77.7020];
  const hospitalCoords = [28.9720, 77.7120];

  const map = L.map(containerId, { zoomControl: true }).setView([28.9665, 77.7070], 14);

  if (containerId === 'liveMapCanvas') patientMapInstance = map;
  if (containerId === 'driverLiveMapCanvas') driverMapInstance = map;

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  const pickupIcon = L.divIcon({
    className: 'custom-map-marker pickup',
    html: `<div style="background: #ef4444; color: white; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); font-size: 11px;">P</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  });

  const hospitalIcon = L.divIcon({
    className: 'custom-map-marker hospital',
    html: `<div style="background: #0284c7; color: white; width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 700; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); font-size: 11px;">H</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });

  const ambIcon = L.divIcon({
    className: 'custom-map-marker amb',
    html: `<div style="background: #10b981; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); font-size: 13px;">🚑</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });

  L.marker(pickupCoords, { icon: pickupIcon }).addTo(map).bindPopup('<strong>Pickup Location</strong><br/>Shastri Nagar, Meerut');
  L.marker(hospitalCoords, { icon: hospitalIcon }).addTo(map).bindPopup('<strong>City Care Hospital</strong><br/>Emergency Bay • 4 ICU Beds');

  const routePoints = [
    pickupCoords,
    [28.9640, 77.7050],
    [28.9680, 77.7080],
    hospitalCoords
  ];

  L.polyline(routePoints, { color: '#0284c7', weight: 4, opacity: 0.8, dashArray: '6, 6' }).addTo(map);

  const ambMarker = L.marker(routePoints[0], { icon: ambIcon }).addTo(map);
  let step = 0;
  setInterval(() => {
    step = (step + 1) % routePoints.length;
    ambMarker.setLatLng(routePoints[step]);
  }, 3500);

  // Trigger resize fix for dynamic tabs
  setTimeout(() => {
    map.invalidateSize();
  }, 300);
}

let allHospitalsMapInstance = null;

export function renderHospitalsMap(hospitals) {
  const container = document.getElementById('allHospitalsMapCanvas');
  if (!container || typeof L === 'undefined') return;

  if (allHospitalsMapInstance) {
    allHospitalsMapInstance.remove();
    allHospitalsMapInstance = null;
  }

  // Default center around Meerut / Delhi region
  const map = L.map('allHospitalsMapCanvas', { zoomControl: true }).setView([28.7500, 77.4500], 10);
  allHospitalsMapInstance = map;

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  const bounds = [];

  hospitals.forEach(h => {
    if (!h.lat || !h.lng) return;

    const isGovt = h.type === 'government';
    const markerBg = isGovt ? '#15803d' : '#0284c7';

    const customIcon = L.divIcon({
      className: 'custom-map-hosp-pin',
      html: `<div style="background: ${markerBg}; color: white; width: 30px; height: 30px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 700; border: 2px solid white; box-shadow: 0 3px 8px rgba(0,0,0,0.3); font-size: 11px;">H</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    const popupHtml = `
      <div style="font-family: inherit; width: 210px; padding: 2px;">
        <h4 style="font-size: 0.95rem; margin-bottom: 2px; color: #0f172a;">${h.name}</h4>
        <div style="font-size: 0.75rem; color: #64748b; margin-bottom: 6px;">${h.badge}</div>
        <div style="font-size: 0.8rem; margin-bottom: 4px;"><strong>ICU Beds:</strong> ${h.beds.icu.available} / ${h.beds.icu.total} Available</div>
        <div style="font-size: 0.8rem; margin-bottom: 6px;"><strong>Emergency:</strong> ${h.beds.emergency.available} / ${h.beds.emergency.total} Available</div>
        <div style="font-size: 0.8rem; font-weight: 700; color: #0284c7; margin-bottom: 8px;">Est. Cost: ₹${h.estimatedAvgCost.toLocaleString()}</div>
        <button class="btn btn-primary btn-book-amb" data-id="${h.id}" style="width: 100%; padding: 4px 8px; font-size: 0.78rem;">
          Book Ambulance
        </button>
      </div>
    `;

    L.marker([h.lat, h.lng], { icon: customIcon }).addTo(map).bindPopup(popupHtml);
    bounds.push([h.lat, h.lng]);
  });

  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [30, 30] });
  }

  setTimeout(() => {
    map.invalidateSize();
  }, 300);
}


