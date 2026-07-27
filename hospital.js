// Hospital Admin Management Dashboard Module

export function renderHospitalAdmin(hospitals, activeHospitalId, stateUpdater) {
  const container = document.getElementById('hospitalAdminContainer');
  if (!container) return;

  const hospital = hospitals.find(h => h.id === activeHospitalId) || hospitals[0];

  container.innerHTML = `
    <!-- Top Stat Metrics Overview -->
    <div class="admin-grid-top">
      <div class="stat-metric-card">
        <div class="stat-icon teal">🚨</div>
        <div class="stat-meta">
          <h4>ICU Bed Occupancy</h4>
          <div class="number">${hospital.beds.icu.total - hospital.beds.icu.available} / ${hospital.beds.icu.total}</div>
          <small style="color: var(--primary); font-weight:600;">${hospital.beds.icu.available} Beds Available</small>
        </div>
      </div>

      <div class="stat-metric-card">
        <div class="stat-icon amber">🚑</div>
        <div class="stat-meta">
          <h4>Emergency Beds</h4>
          <div class="number">${hospital.beds.emergency.total - hospital.beds.emergency.available} / ${hospital.beds.emergency.total}</div>
          <small style="color: var(--warning); font-weight:600;">${hospital.beds.emergency.available} Beds Available</small>
        </div>
      </div>

      <div class="stat-metric-card">
        <div class="stat-icon blue">🛏️</div>
        <div class="stat-meta">
          <h4>General Ward Beds</h4>
          <div class="number">${hospital.beds.general.total - hospital.beds.general.available} / ${hospital.beds.general.total}</div>
          <small style="color: var(--secondary); font-weight:600;">${hospital.beds.general.available} Beds Available</small>
        </div>
      </div>

      <div class="stat-metric-card">
        <div class="stat-icon red">⚡</div>
        <div class="stat-meta">
          <h4>Live OPD Wait Time</h4>
          <div class="number">${hospital.opdWaitTimeMins} mins</div>
          <small style="color: var(--danger); font-weight:600;">Real-time Tracker</small>
        </div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;" class="admin-layout-grid">
      
      <!-- Left Column: Live Bed Availability Controller & Price List -->
      <div>
        <div class="card-panel" style="margin-bottom: 1.5rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem;">
            <h3>⚡ Live Bed Availability Manager</h3>
            <span class="sync-badge"><span class="pulse-dot"></span> Sync Active</span>
          </div>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.25rem;">
            Changes made here automatically update patient search results in real-time.
          </p>

          <div style="display: flex; flex-direction: column; gap: 1rem;">
            <!-- ICU Control -->
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--light-bg); border-radius: var(--radius-sm);">
              <div>
                <strong>🚨 ICU Beds Available</strong>
                <div style="font-size: 0.8rem; color: var(--text-muted);">Total capacity: ${hospital.beds.icu.total}</div>
              </div>
              <div class="bed-stepper-control">
                <button class="stepper-btn btn-icu-dec" data-id="${hospital.id}">-</button>
                <span style="font-weight: 800; font-size: 1.1rem; width: 28px; text-align: center;">${hospital.beds.icu.available}</span>
                <button class="stepper-btn btn-icu-inc" data-id="${hospital.id}">+</button>
              </div>
            </div>

            <!-- Emergency Control -->
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--light-bg); border-radius: var(--radius-sm);">
              <div>
                <strong>🚑 Emergency Beds Available</strong>
                <div style="font-size: 0.8rem; color: var(--text-muted);">Total capacity: ${hospital.beds.emergency.total}</div>
              </div>
              <div class="bed-stepper-control">
                <button class="stepper-btn btn-emerg-dec" data-id="${hospital.id}">-</button>
                <span style="font-weight: 800; font-size: 1.1rem; width: 28px; text-align: center;">${hospital.beds.emergency.available}</span>
                <button class="stepper-btn btn-emerg-inc" data-id="${hospital.id}">+</button>
              </div>
            </div>

            <!-- General Control -->
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--light-bg); border-radius: var(--radius-sm);">
              <div>
                <strong>🛏️ General Beds Available</strong>
                <div style="font-size: 0.8rem; color: var(--text-muted);">Total capacity: ${hospital.beds.general.total}</div>
              </div>
              <div class="bed-stepper-control">
                <button class="stepper-btn btn-gen-dec" data-id="${hospital.id}">-</button>
                <span style="font-weight: 800; font-size: 1.1rem; width: 28px; text-align: center;">${hospital.beds.general.available}</span>
                <button class="stepper-btn btn-gen-inc" data-id="${hospital.id}">+</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Treatment Cost Manager -->
        <div class="card-panel">
          <h3 style="margin-bottom: 1rem;">🏷️ Transparent Treatment Pricing List</h3>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">Update cost estimates displayed to patients.</p>

          <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
            <thead>
              <tr style="border-bottom: 2px solid var(--light-border); text-align: left;">
                <th style="padding: 6px;">Procedure</th>
                <th style="padding: 6px;">Current Cost</th>
                <th style="padding: 6px;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${hospital.treatments.map(t => `
                <tr style="border-bottom: 1px solid var(--light-border);">
                  <td style="padding: 8px 6px;">
                    <strong>${t.name}</strong><br/>
                    <small style="color: var(--text-muted);">${t.category}</small>
                  </td>
                  <td style="padding: 8px 6px; font-weight: 700; color: var(--primary);">₹${t.cost.toLocaleString()}</td>
                  <td style="padding: 8px 6px;">
                    <button class="btn btn-outline btn-edit-price" style="padding: 2px 8px; font-size: 0.75rem;" data-hosp="${hospital.id}" data-treat="${t.id}" data-name="${t.name}" data-cost="${t.cost}">
                      ✏️ Edit Price
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Right Column: Incoming Emergency Console & Ambulance Dispatch -->
      <div>
        <div class="card-panel" style="margin-bottom: 1.5rem; border-top: 4px solid var(--danger);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3>🚨 Incoming Emergency SOS Dispatch</h3>
            <span class="badge-tag" style="background: var(--danger-light); color: var(--danger);">Live Feeds</span>
          </div>

          <div id="adminEmergencyList">
            <div style="background: #fff5f5; border: 1.5px solid #fecaca; border-radius: var(--radius-sm); padding: 1rem; margin-bottom: 1rem;">
              <div style="display:flex; justify-size:space-between; align-items:center;">
                <strong style="color: #b91c1c;">⚡ SOS Alert #EM-8841</strong>
                <small style="color: #991b1b; font-weight:700;">2 mins ago</small>
              </div>
              <p style="margin: 0.5rem 0; font-size: 0.9rem;">
                <strong>Patient:</strong> Rahul Sharma (+91 98123 45678)<br/>
                <strong>Location:</strong> Shastri Nagar, Meerut (3.2 km away)<br/>
                <strong>Symptom:</strong> Severe Chest Pain / Cardiac Emergency
              </p>
              <div style="display: flex; gap: 8px; margin-top: 0.75rem;">
                <button class="btn btn-danger btn-dispatch-amb" style="padding: 4px 12px; font-size: 0.8rem;">
                  🚑 Dispatch Ambulance Unit #102
                </button>
                <button class="btn btn-outline btn-reserve-icu" style="padding: 4px 12px; font-size: 0.8rem;">
                  🏥 Hold ICU Bed
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Doctor Roster -->
        <div class="card-panel">
          <h3 style="margin-bottom: 1rem;">👨‍⚕️ On-Duty Doctor Roster</h3>
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            ${hospital.doctors.map(d => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--light-bg); border-radius: var(--radius-sm);">
                <div>
                  <strong>${d.name}</strong> (${d.exp})<br/>
                  <small style="color: var(--text-muted);">${d.spec}</small>
                </div>
                <span class="badge-tag" style="background: #dcfce7; color: #15803d;">${d.status}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

    </div>
  `;
}
