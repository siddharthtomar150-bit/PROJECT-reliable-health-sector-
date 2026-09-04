// Patient Experience & Hospital Discovery Module — MediGo Platform

let compareList = [];
let patientMapInstance = null;
let driverMapInstance = null;
let globalHospitalsMap = null;

export function renderPatientSearch(hospitals, activeTreatment = 'all', maxBudget = 200000, emergencyOnly = false, hospType = 'all', favoritesList = []) {
  const container = document.getElementById('hospitalListContainer');
  if (!container) return;

  let filtered = hospitals.filter(h => {
    if (hospType !== 'all' && h.type !== hospType) return false;
    if (emergencyOnly && !h.emergencyAvailable) return false;
    if (h.estimatedAvgCost > maxBudget) return false;
    if (activeTreatment !== 'all') {
      const query = activeTreatment.toLowerCase();
      const hasTreatment = (h.treatments && h.treatments.some(t => 
        (t.id && t.id.toLowerCase() === query) || 
        (t.name && t.name.toLowerCase().includes(query)) || 
        (t.category && t.category.toLowerCase().includes(query))
      )) || (h.specialties && h.specialties.toLowerCase().includes(query))
        || (h.tagline && h.tagline.toLowerCase().includes(query));
      if (!hasTreatment) return false;
    }
    return true;
  });

  const countBadge = document.getElementById('searchCountBadge');
  if (countBadge) countBadge.textContent = `${filtered.length} Hospitals Verified`;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="card-panel" style="text-align: center; padding: 3.5rem 1.5rem;">
        <div style="width: 48px; height: 48px; margin: 0 auto 1rem; border-radius: 50%; background: var(--slate-100); display: flex; align-items: center; justify-content: center; color: var(--slate-500);">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        </div>
        <h3 style="font-size: 1.15rem; color: var(--slate-800);">No Matching Hospitals Found</h3>
        <p style="color: var(--slate-500); font-size: 0.88rem; margin-top: 6px; max-width: 420px; margin-left: auto; margin-right: auto;">
          Try adjusting your search filters, budget slider, or selecting "All States & Districts".
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(h => {
    const isCompared = compareList.some(item => item.id === h.id);
    const isFavorite = (favoritesList || []).includes(h.id);
    const isGovt = h.type === 'government';
    const isPmjay = h.pmjayEmpanelled || isGovt || (h.badge && h.badge.includes('Govt'));
    const isCghs = h.cghsEmpanelled || isGovt || (h.name && (h.name.includes('AIIMS') || h.name.includes('Safdarjung') || h.name.includes('RML') || h.name.includes('Max') || h.name.includes('Fortis') || h.name.includes('Medanta')));
    const queryTarget = encodeURIComponent(`${h.name}, ${h.location || ''}`);
    const mapsDirLink = `https://www.google.com/maps/dir/?api=1&destination=${queryTarget}`;
    const mapsSearchLink = `https://www.google.com/maps/search/?api=1&query=${queryTarget}`;
    const coverImage = h.cover_image || (isGovt 
      ? 'https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=600&auto=format&fit=crop&q=80'
      : 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=600&auto=format&fit=crop&q=80');

    const icuTotal = (h.beds && h.beds.icu) ? h.beds.icu.total : 20;
    const icuAvail = (h.beds && h.beds.icu) ? h.beds.icu.available : 4;
    const emTotal = (h.beds && h.beds.emergency) ? h.beds.emergency.total : 30;
    const emAvail = (h.beds && h.beds.emergency) ? h.beds.emergency.available : 6;
    const genTotal = (h.beds && h.beds.general) ? h.beds.general.total : 200;
    const genAvail = (h.beds && h.beds.general) ? h.beds.general.available : 35;

    return `
      <div class="hospital-card" id="card-${h.id}">
        <div class="hospital-card-body">
          <div class="hospital-thumbnail-wrap">
            <img src="${coverImage}" alt="${h.name}" class="hospital-thumb-img" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=600&auto=format&fit=crop&q=80';">
            <span class="hospital-thumb-type-tag ${isGovt ? 'govt' : 'pvt'}">
              ${isGovt ? 'GOVERNMENT APEX' : 'PRIVATE MULTI-SPECIALTY'}
            </span>
          </div>

          <div class="hospital-main-content">
            <div class="hospital-header-row">
              <div class="hospital-title-area">
                <h3>
                  ${h.name}
                  <span class="badge-tag nabh">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                    NABH Accredited
                  </span>
                  ${isPmjay ? `<span class="badge-tag pmjay">Ayushman PM-JAY Cashless</span>` : ''}
                  ${isCghs ? `<span class="badge-tag cghs">CGHS Empanelled</span>` : ''}
                </h3>
                <div class="hospital-tagline">${h.tagline || 'Tertiary Medical Center & Emergency Services'}</div>
                <div style="font-size: 0.8rem; color: var(--slate-500); margin-top: 3px;">
                  <span style="display: inline-flex; align-items: center; gap: 4px;">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                    ${h.location}
                  </span>
                </div>
              </div>

              <div class="hospital-rating-box">
                <div class="rating-badge">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="#d97706" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  ${h.rating || 4.7} <span style="font-size: 0.72rem; color: #78350f; font-weight: 500;">(${h.reviewCount || 350})</span>
                </div>
                <div class="cost-estimate-label">
                  Est. Avg: ₹${(h.estimatedAvgCost || 500).toLocaleString()}
                </div>
              </div>
            </div>

            <!-- Live Bed Telemetry Strip -->
            <div class="bed-telemetry-grid">
              <div class="bed-telemetry-item">
                <span class="bed-telemetry-label">ICU (Ventilator)</span>
                <span class="bed-telemetry-count ${icuAvail > 0 ? 'available' : 'critical'}">
                  ${icuAvail} <span class="bed-telemetry-total">/ ${icuTotal} Beds</span>
                </span>
              </div>
              <div class="bed-telemetry-item">
                <span class="bed-telemetry-label">Emergency Bay</span>
                <span class="bed-telemetry-count ${emAvail > 0 ? 'available' : 'critical'}">
                  ${emAvail} <span class="bed-telemetry-total">/ ${emTotal} Beds</span>
                </span>
              </div>
              <div class="bed-telemetry-item">
                <span class="bed-telemetry-label">Inpatient Ward</span>
                <span class="bed-telemetry-count available">
                  ${genAvail} <span class="bed-telemetry-total">/ ${genTotal} Beds</span>
                </span>
              </div>
            </div>

            <!-- Metadata Strip -->
            <div class="hospital-quick-meta">
              <span class="meta-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                OPD Wait: <strong>~${h.opdWaitTimeMins || 25} mins</strong>
              </span>
              <span class="meta-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                ${h.phone || '+91 11 2658 8500'}
              </span>
              <span class="meta-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                Code Blue: <strong>24x7 Active</strong>
              </span>
            </div>
          </div>
        </div>

        <div class="hospital-card-footer">
          <div class="card-action-group">
            <button class="btn btn-danger btn-book-amb" data-id="${h.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
              Book 108 ALS Ambulance
            </button>
            <button class="btn btn-outline btn-open-google-map" data-id="${h.id}" style="font-weight: 700; color: #0284c7; border-color: #bae6fd; background: #f0f9ff;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              Exact Google Map
            </button>
            <a href="${mapsDirLink}" target="_blank" rel="noopener noreferrer" class="btn btn-outline" style="font-weight: 600;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
              GPS Route
            </a>
          </div>

          <div class="card-action-group">
            <button class="btn btn-outline btn-view-profile" data-id="${h.id}" style="font-weight: 700; color: var(--primary); border-color: var(--primary-border); background: var(--primary-subtle);">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><polyline points="17 11 19 13 23 9"></polyline></svg>
              Hospital Profile & OPD Doctors
            </button>
            <button class="btn ${isCompared ? 'btn-teal' : 'btn-outline'} btn-toggle-compare" data-id="${h.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
              ${isCompared ? 'Comparing (Active)' : 'Compare'}
            </button>
            <button class="btn btn-outline btn-view-treatments" data-id="${h.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              Tariff
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

export function openHospitalDetailModal(hosp) {
  const modal = document.getElementById('hospDetailModal');
  const title = document.getElementById('modalHospName');
  const badge = document.getElementById('modalHospBadge');
  const body = document.getElementById('hospDetailModalBody');
  if (!modal || !body) return;

  title.textContent = hosp.name;
  badge.textContent = hosp.badge || (hosp.type === 'government' ? 'Government Apex Institute' : 'NABH Multi-Specialty');

  const isGovt = hosp.type === 'government';
  const icuTotal = hosp.beds?.icu?.total || 20;
  const icuAvail = hosp.beds?.icu?.available || 4;
  const emTotal = hosp.beds?.emergency?.total || 30;
  const emAvail = hosp.beds?.emergency?.available || 6;
  const genTotal = hosp.beds?.general?.total || 200;
  const genAvail = hosp.beds?.general?.available || 35;

  const doctorsList = hosp.doctors && hosp.doctors.length > 0 ? hosp.doctors : [
    { name: "Dr. Arvind Saxena", spec: "Chief of Emergency Medicine", exp: "22 yrs", status: "In Casualty" },
    { name: "Dr. Sunita Sharma", spec: "Senior Cardiologist", exp: "18 yrs", status: "Available in OPD" }
  ];

  const treatmentsList = hosp.treatments && hosp.treatments.length > 0 ? hosp.treatments : [
    { name: "Emergency Trauma Resuscitation", cost: isGovt ? 500 : 4500, duration: "Daycare" },
    { name: "Cardiac Angioplasty", cost: isGovt ? 45000 : 155000, duration: "3 Days Inpatient" }
  ];
  const queryTarget = encodeURIComponent(`${hosp.name}, ${hosp.location || ''}`);
  const mapsDirLink = `https://www.google.com/maps/dir/?api=1&destination=${queryTarget}`;
  const mapsSearchLink = `https://www.google.com/maps/search/?api=1&query=${queryTarget}`;
  const embedUrl = `https://maps.google.com/maps?q=${queryTarget}&t=&z=16&ie=UTF8&iwloc=&output=embed`;

  body.innerHTML = `
    <!-- Top Hospital Meta Banner -->
    <div style="display: flex; gap: 1.25rem; margin-bottom: 1.25rem; flex-wrap: wrap; background: var(--slate-50); padding: 1.25rem; border-radius: 12px; border: 1px solid var(--slate-200);">
      <div style="flex: 1; min-width: 260px;">
        <h4 style="font-size: 1.1rem; color: var(--slate-900); margin-bottom: 4px;">${hosp.name}</h4>
        <p style="font-size: 0.85rem; color: var(--slate-600); margin-bottom: 8px;">${hosp.tagline || 'Apex Healthcare Institution'}</p>
        
        <div style="display: flex; flex-direction: column; gap: 4px; font-size: 0.82rem; color: var(--slate-700);">
          <div>📍 <strong>Address:</strong> ${hosp.location}</div>
          <div>📞 <strong>Telephone:</strong> ${hosp.phone}</div>
          <div>🛡️ <strong>Clinical Reg:</strong> <code>${hosp.reg_number || 'NABH-2026-REG-01'}</code></div>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between;">
        <div class="rating-badge" style="font-size: 0.95rem; padding: 4px 10px;">
          ★ ${hosp.rating || 4.8} (${hosp.reviewCount || 350} Patient Reviews)
        </div>
        <button class="btn btn-danger btn-book-amb" data-id="${hosp.id}" style="padding: 8px 16px; font-size: 0.85rem;">
          🚨 Dispatch 108 Ambulance
        </button>
      </div>
    </div>

    <!-- Ward Bed Capacity Breakdown -->
    <div style="margin-bottom: 1.5rem;">
      <h4 style="font-size: 0.98rem; color: var(--slate-900); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 6px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9"/></svg>
        Live Inpatient Ward Occupancy
      </h4>
      <div class="bed-telemetry-grid">
        <div class="bed-telemetry-item">
          <span class="bed-telemetry-label">ICU (Ventilator-Ready)</span>
          <span class="bed-telemetry-count ${icuAvail > 0 ? 'available' : 'critical'}">${icuAvail} / ${icuTotal} Beds</span>
        </div>
        <div class="bed-telemetry-item">
          <span class="bed-telemetry-label">Emergency Casualty Bay</span>
          <span class="bed-telemetry-count ${emAvail > 0 ? 'available' : 'critical'}">${emAvail} / ${emTotal} Beds</span>
        </div>
        <div class="bed-telemetry-item">
          <span class="bed-telemetry-label">General Ward</span>
          <span class="bed-telemetry-count available">${genAvail} / ${genTotal} Beds</span>
        </div>
        <div class="bed-telemetry-item">
          <span class="bed-telemetry-label">Liquid O2 Manifold</span>
          <span class="bed-telemetry-count available" style="font-size: 0.88rem;">4.3 Bar (Stable)</span>
        </div>
      </div>
    </div>

    <!-- Exact Google Map & Hospital Campus Navigation -->
    <div style="margin-bottom: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem; flex-wrap: wrap; gap: 8px;">
        <h4 style="font-size: 0.98rem; color: var(--slate-900); margin: 0; display: flex; align-items: center; gap: 6px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          Exact Google Map & Hospital Campus Navigation
        </h4>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <a href="${mapsDirLink}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="padding: 6px 14px; font-size: 0.8rem; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
            Google Maps Directions
          </a>
          <a href="${mapsSearchLink}" target="_blank" rel="noopener noreferrer" class="btn btn-outline" style="padding: 6px 12px; font-size: 0.8rem; font-weight: 600;">
            Street View / Satellite
          </a>
        </div>
      </div>

      <div style="width: 100%; height: 280px; border-radius: 12px; overflow: hidden; border: 1px solid var(--slate-200); box-shadow: 0 2px 8px rgba(0,0,0,0.05); background: #f8fafc;">
        <iframe
          title="Exact Location of ${hosp.name}"
          width="100%"
          height="100%"
          style="border: 0;"
          loading="lazy"
          allowfullscreen
          referrerpolicy="no-referrer-when-downgrade"
          src="${embedUrl}">
        </iframe>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; font-size: 0.8rem; color: var(--slate-600); flex-wrap: wrap; gap: 6px;">
        <span>🚑 <strong>Emergency Entrance:</strong> Gate 1 (24x7 Ambulance Priority Bay)</span>
        <span>📍 <strong>GPS Coordinates:</strong> <code>${hosp.lat ? hosp.lat.toFixed(4) : '28.5672'}° N, ${hosp.lng ? hosp.lng.toFixed(4) : '77.2100'}° E</code></span>
      </div>
    </div>

    <!-- OPD Specialist Doctor Roster -->
    <div style="margin-bottom: 1.5rem;">
      <h4 style="font-size: 0.98rem; color: var(--slate-900); margin-bottom: 0.75rem; display: flex; align-items: center; gap: 6px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        Specialist Doctor Roster & OPD Token Booking
      </h4>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px;">
        ${doctorsList.map((doc, idx) => `
          <div style="background: var(--surface-white); border: 1px solid var(--slate-200); padding: 12px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
            <div>
              <div style="font-weight: 700; color: var(--slate-900); font-size: 0.92rem;">${doc.name}</div>
              <div style="font-size: 0.78rem; color: var(--primary); font-weight: 600;">${doc.spec}</div>
              <div style="font-size: 0.75rem; color: var(--slate-500); margin-top: 2px;">Exp: ${doc.exp || '15 yrs'} • <span style="color: #059669; font-weight: 600;">${doc.status || 'Available in OPD'}</span></div>
            </div>
            <button class="btn btn-primary btn-book-opd-token" data-hosp="${hosp.name}" data-doc="${doc.name}" data-spec="${doc.spec}" data-fee="${isGovt ? 0 : 600}" style="padding: 6px 12px; font-size: 0.8rem; font-weight: 700;">
              Get OPD Token
            </button>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Transparent Tariff Breakdown Table -->
    <div>
      <h4 style="font-size: 0.98rem; color: var(--slate-900); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 6px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
        Transparent Clinical Tariff & Insurance Subsidies
      </h4>
      <table class="compare-table">
        <thead>
          <tr>
            <th>Procedure / Medical Package</th>
            <th>Standard Tariff</th>
            <th>Ayushman Bharat (PM-JAY)</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          ${treatmentsList.map(t => `
            <tr>
              <td><strong>${t.name}</strong></td>
              <td><strong style="color: var(--primary);">₹${t.cost.toLocaleString()}</strong></td>
              <td><span style="background: #ecfdf5; color: #047857; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 0.75rem;">100% Cashless</span></td>
              <td>${t.duration || '2 Days stay'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  modal.classList.add('active');
}

export function openOpdTokenModal(hospName, docName, spec, fee) {
  const modal = document.getElementById('opdTokenModal');
  const body = document.getElementById('opdTokenModalBody');
  if (!modal || !body) return;

  const tokenNo = `OPD-${Math.floor(100 + Math.random() * 900)}`;
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeSlot = '11:30 AM – 12:30 PM (Reporting)';

  body.innerHTML = `
    <div style="background: #ffffff; border: 2px dashed #0284c7; border-radius: 12px; padding: 1.5rem; text-align: center;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px;">
        <span style="font-size: 0.75rem; font-weight: 700; color: #0369a1; text-transform: uppercase;">Central OPD Appointment Registry</span>
        <span style="font-size: 0.75rem; color: #64748b;">Verified e-Pass</span>
      </div>

      <div style="font-size: 0.85rem; color: var(--slate-600); font-weight: 600;">${hospName}</div>
      
      <div style="margin: 12px 0;">
        <span style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 700;">Live Priority Token</span>
        <div style="font-size: 2.4rem; font-weight: 800; color: #0284c7; font-family: monospace; letter-spacing: 2px;">
          ${tokenNo}
        </div>
      </div>

      <div style="text-align: left; background: #f8fafc; padding: 10px 14px; border-radius: 8px; font-size: 0.85rem; margin-bottom: 14px;">
        <div>👨‍⚕️ <strong>Doctor:</strong> ${docName} (${spec})</div>
        <div style="margin-top: 3px;">📍 <strong>Consultation Wing:</strong> Room 104, OPD Block B</div>
        <div style="margin-top: 3px;">📅 <strong>Date & Slot:</strong> ${dateStr}, ${timeSlot}</div>
        <div style="margin-top: 3px;">💳 <strong>Registration Fee:</strong> ${fee === 0 ? 'FREE (Govt Subsidized)' : '₹' + fee}</div>
      </div>

      <div style="display: flex; justify-content: center; margin-bottom: 14px;">
        <div style="background: #e2e8f0; height: 32px; width: 75%; display: flex; align-items: center; justify-content: center; font-family: monospace; font-size: 0.7rem; letter-spacing: 4px; color: #334155;">
          ||||| | |||| || ||||| ||| ||||
        </div>
      </div>

      <button class="btn btn-primary" onclick="window.print()" style="width: 100%; padding: 10px; font-weight: 700;">
        🖨️ Print / Save OPD Slip
      </button>
    </div>
  `;

  modal.classList.add('active');
}

export function openGoogleMapModal(hosp) {
  const modal = document.getElementById('googleMapModal');
  const title = document.getElementById('googleMapHospName');
  const addr = document.getElementById('googleMapHospAddress');
  const body = document.getElementById('googleMapModalBody');
  if (!modal || !body) return;

  if (title) title.textContent = hosp.name;
  if (addr) addr.textContent = hosp.location || 'Verified Healthcare Campus';

  const queryTarget = encodeURIComponent(`${hosp.name}, ${hosp.location || ''}`);
  const mapsDirLink = `https://www.google.com/maps/dir/?api=1&destination=${queryTarget}`;
  const mapsSearchLink = `https://www.google.com/maps/search/?api=1&query=${queryTarget}`;
  const embedUrl = `https://maps.google.com/maps?q=${queryTarget}&t=&z=16&ie=UTF8&iwloc=&output=embed`;

  body.innerHTML = `
    <!-- Map Embed Container -->
    <div style="position: relative; width: 100%; height: 380px; border-radius: 12px; overflow: hidden; border: 1px solid var(--slate-200); box-shadow: 0 4px 12px rgba(0,0,0,0.06); background: #f1f5f9; margin-bottom: 1.25rem;">
      <iframe
        title="Exact Location of ${hosp.name}"
        width="100%"
        height="100%"
        style="border: 0;"
        loading="lazy"
        allowfullscreen
        referrerpolicy="no-referrer-when-downgrade"
        src="${embedUrl}">
      </iframe>
    </div>

    <!-- Campus & Coordinates Details Card -->
    <div style="background: var(--slate-50); border: 1px solid var(--slate-200); border-radius: 10px; padding: 1rem 1.25rem; margin-bottom: 1.25rem; display: flex; flex-direction: column; gap: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <span style="font-size: 0.95rem; font-weight: 700; color: var(--slate-800);">
          🏥 ${hosp.name}
        </span>
        <span class="badge-tag nabh" style="font-size: 0.75rem;">Verified Geocoded Campus</span>
      </div>
      <div style="font-size: 0.85rem; color: var(--slate-600);">
        📍 <strong>Full Street Address:</strong> ${hosp.location}
      </div>
      <div style="font-size: 0.82rem; color: var(--slate-600); display: flex; gap: 1.25rem; flex-wrap: wrap;">
        <span>🎯 <strong>GPS Pin:</strong> <code>${hosp.lat ? hosp.lat.toFixed(4) : '28.5672'}° N, ${hosp.lng ? hosp.lng.toFixed(4) : '77.2100'}° E</code></span>
        <span>🚑 <strong>Emergency Casualty Gate:</strong> Gate 1 (24x7 Ambulance Priority)</span>
      </div>
    </div>

    <!-- Direct Navigation CTAs -->
    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
      <a href="${mapsDirLink}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="flex: 1; min-width: 220px; justify-content: center; padding: 11px 18px; font-weight: 700; font-size: 0.9rem; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
        Turn-by-Turn in Google Maps App
      </a>
      <a href="${mapsSearchLink}" target="_blank" rel="noopener noreferrer" class="btn btn-outline" style="flex: 1; min-width: 200px; justify-content: center; padding: 11px 18px; font-weight: 600; font-size: 0.9rem; color: var(--slate-700); text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        Street View & Satellite Photo
      </a>
    </div>
  `;

  modal.classList.add('active');
}

export function toggleCompareHospital(hospital, updateCallback) {
  const index = compareList.findIndex(h => h.id === hospital.id);
  if (index > -1) {
    compareList.splice(index, 1);
  } else {
    if (compareList.length >= 3) {
      alert("You can compare up to 3 hospitals simultaneously.");
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
    body.innerHTML = `<p style="text-align: center; color: var(--slate-500); padding: 2rem 0;">Please select at least 1 hospital to compare.</p>`;
  } else {
    body.innerHTML = `
      <div style="overflow-x: auto;">
        <table class="compare-table">
          <thead>
            <tr>
              <th style="min-width: 180px;">Clinical Parameter</th>
              ${compareList.map(h => `<th>${h.name}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Accreditation & Sector</strong></td>
              ${compareList.map(h => `<td><span class="badge-tag nabh">${h.accreditation || 'NABH Verified'}</span></td>`).join('')}
            </tr>
            <tr>
              <td><strong>Est. Inpatient Procedure Cost</strong></td>
              ${compareList.map(h => `<td><strong style="color: var(--primary); font-size: 1.05rem;">₹${(h.estimatedAvgCost || 500).toLocaleString()}</strong></td>`).join('')}
            </tr>
            <tr>
              <td><strong>ICU (Ventilator) Availability</strong></td>
              ${compareList.map(h => `<td><strong style="color: #059669;">${h.beds?.icu?.available || 4} Available</strong> / ${h.beds?.icu?.total || 20} Total</td>`).join('')}
            </tr>
            <tr>
              <td><strong>Emergency Casualty Bay</strong></td>
              ${compareList.map(h => `<td>${h.beds?.emergency?.available || 6} / ${h.beds?.emergency?.total || 30} Available</td>`).join('')}
            </tr>
            <tr>
              <td><strong>Cashless Scheme Empanelment</strong></td>
              ${compareList.map(h => `<td>PM-JAY Gold • CGHS • ECHS</td>`).join('')}
            </tr>
            <tr>
              <td><strong>OPD Average Wait Time</strong></td>
              ${compareList.map(h => `<td>~${h.opdWaitTimeMins || 25} minutes</td>`).join('')}
            </tr>
            <tr>
              <td><strong>Specialty Medical Facilities</strong></td>
              ${compareList.map(h => `<td><ul style="padding-left: 1rem; font-size: 0.84rem; color: var(--slate-600);">${(h.facilities || ['24x7 Trauma', 'CT/MRI', 'Blood Bank']).map(f => `<li>${f}</li>`).join('')}</ul></td>`).join('')}
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }
  modal.classList.add('active');
}

export function renderHospitalsMap(hospitals) {
  const mapElement = document.getElementById('hospitalsMapCanvas');
  if (!mapElement || typeof L === 'undefined') return;

  if (globalHospitalsMap) {
    globalHospitalsMap.remove();
    globalHospitalsMap = null;
  }

  const defaultCenter = [28.5672, 77.2100]; // New Delhi AIIMS area
  const map = L.map('hospitalsMapCanvas').setView(defaultCenter, 11);
  globalHospitalsMap = map;

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  const hospMarkerGroup = L.featureGroup();

  hospitals.forEach(h => {
    if (!h.lat || !h.lng) return;
    const isGovt = h.type === 'government';

    const hospIcon = L.divIcon({
      className: 'custom-hosp-pin',
      html: `
        <div style="background: ${isGovt ? '#059669' : '#0284c7'}; color: white; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 800; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.25); font-size: 12px; font-family: sans-serif;">
          H
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    const queryTarget = encodeURIComponent(`${h.name}, ${h.location || ''}`);
    const mapsDirUrl = `https://www.google.com/maps/dir/?api=1&destination=${queryTarget}`;

    const marker = L.marker([h.lat, h.lng], { icon: hospIcon });
    marker.bindPopup(`
      <div style="font-family: 'Plus Jakarta Sans', sans-serif; padding: 4px; min-width: 220px;">
        <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 2px; color: #0f172a;">${h.name}</h4>
        <div style="font-size: 0.78rem; color: #475569; margin-bottom: 6px;">${h.location}</div>
        <div style="background: #f0fdf4; color: #166534; padding: 4px 8px; border-radius: 4px; font-size: 0.78rem; font-weight: 700; margin-bottom: 8px;">
          ICU Beds: ${h.beds?.icu?.available || 4} Available
        </div>
        <div style="display: flex; gap: 6px; margin-bottom: 6px;">
          <button onclick="window.openExactGoogleMap('${h.id}')" style="flex: 1; background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; padding: 5px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; cursor: pointer;">
            🗺️ Exact Map
          </button>
          <a href="${mapsDirUrl}" target="_blank" rel="noopener noreferrer" style="flex: 1; text-align: center; background: #0284c7; color: white; padding: 5px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; text-decoration: none;">
            🧭 Directions
          </a>
        </div>
        <button onclick="window.bookAmbulanceForHosp('${h.id}')" style="background: #dc2626; color: white; border: none; padding: 5px 10px; border-radius: 4px; font-size: 0.76rem; font-weight: 700; cursor: pointer; width: 100%;">
          Dispatch ALS Ambulance
        </button>
      </div>
    `);
    hospMarkerGroup.addLayer(marker);
  });

  hospMarkerGroup.addTo(map);
  if (hospitals.length > 0 && hospMarkerGroup.getBounds().isValid()) {
    map.fitBounds(hospMarkerGroup.getBounds(), { padding: [30, 30] });
  }
}

export function focusHospitalOnMap(lat, lng, name) {
  if (!globalHospitalsMap) return;
  globalHospitalsMap.setView([lat, lng], 15, { animate: true });
}

export function initLiveTrackingMap(containerId = 'liveMapCanvas', etaMins = 8) {
  const mapElement = document.getElementById(containerId);
  if (!mapElement || typeof L === 'undefined') return;

  if (containerId === 'liveMapCanvas' && patientMapInstance) {
    patientMapInstance.remove();
    patientMapInstance = null;
  }
  if (containerId === 'driverLiveMapCanvas' && driverMapInstance) {
    driverMapInstance.remove();
    driverMapInstance = null;
  }

  const pickupCoords = [28.5672, 77.2100];
  const patientLocation = [28.5520, 77.2250];

  const map = L.map(containerId, { zoomControl: true }).setView([28.5600, 77.2180], 14);

  if (containerId === 'liveMapCanvas') patientMapInstance = map;
  if (containerId === 'driverLiveMapCanvas') driverMapInstance = map;

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  const pickupIcon = L.divIcon({
    className: 'custom-map-marker pickup',
    html: `<div style="background: #dc2626; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); font-size: 11px;">P</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });

  const hospitalIcon = L.divIcon({
    className: 'custom-map-marker hospital',
    html: `<div style="background: #0284c7; color: white; width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 800; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); font-size: 12px;">H</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });

  const ambIcon = L.divIcon({
    className: 'custom-map-marker amb',
    html: `<div style="background: #059669; color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; border: 2px solid white; box-shadow: 0 3px 10px rgba(0,0,0,0.35); font-size: 14px;">🚑</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });

  L.marker(patientLocation, { icon: pickupIcon }).addTo(map).bindPopup('<strong>Patient Pickup Location</strong><br/>Defence Colony, New Delhi');
  L.marker(pickupCoords, { icon: hospitalIcon }).addTo(map).bindPopup('<strong>AIIMS New Delhi</strong><br/>Apex Trauma Center');

  const routePoints = [
    pickupCoords,
    [28.5630, 77.2140],
    [28.5580, 77.2190],
    patientLocation
  ];

  L.polyline(routePoints, { color: '#0284c7', weight: 5, opacity: 0.85, dashArray: '6, 6' }).addTo(map);

  const ambMarker = L.marker(routePoints[0], { icon: ambIcon }).addTo(map);
  let step = 0;
  setInterval(() => {
    step = (step + 1) % routePoints.length;
    ambMarker.setLatLng(routePoints[step]);
  }, 3000);
}
