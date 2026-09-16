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
          <div class="number">${hospital.opdWaitTimeMins || 20} mins</div>
          <small style="color: var(--danger); font-weight:600;">Real-time Tracker</small>
        </div>
      </div>
    </div>

    <!-- Hospital Info & Operations Settings Bar -->
    <div class="card-panel" style="margin-bottom: 1.5rem; border-left: 4px solid var(--primary);">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem;">
        <div>
          <h3 style="font-size: 1.2rem; color: var(--text-main);">${hospital.name} Management Control</h3>
          <p style="font-size: 0.85rem; color: var(--text-muted);">${hospital.location || 'Hospital Location'} • Phone: ${hospital.phone || 'N/A'}</p>
        </div>
        <button class="btn btn-outline" id="btnToggleHospSettings" style="font-size: 0.85rem;">
          ⚙️ Edit Hospital Info & OPD Status
        </button>
      </div>

      <!-- Collapsible Settings Panel -->
      <div id="hospSettingsPanel" style="display: none; padding-top: 1rem; border-top: 1px solid var(--light-border);">
        <form id="formHospSettings" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem;">
          <div class="form-group">
            <label>Tagline / Description</label>
            <input type="text" id="settingTagline" class="form-control" value="${hospital.tagline || ''}">
          </div>
          <div class="form-group">
            <label>Contact Phone / Helpline</label>
            <input type="text" id="settingPhone" class="form-control" value="${hospital.phone || ''}">
          </div>
          <div class="form-group">
            <label>OPD Wait Time (Minutes)</label>
            <input type="number" id="settingOpdWait" class="form-control" value="${hospital.opdWaitTimeMins || 20}" min="0">
          </div>
          <div class="form-group" style="display: flex; align-items: center; margin-top: 1.5rem;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; text-transform: none; font-weight: 600;">
              <input type="checkbox" id="settingEmergency" ${hospital.emergencyAvailable ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--primary);">
              24x7 Emergency Trauma Center Active
            </label>
          </div>
          <div style="grid-column: 1 / -1; text-align: right;">
            <button type="submit" class="btn btn-primary" style="padding: 8px 20px;">Save Hospital Settings</button>
          </div>
        </form>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;" class="admin-layout-grid">
      
      <!-- Left Column: Bed Capacity & Treatment Tariff Manager -->
      <div>
        <!-- Live Bed Manager -->
        <div class="card-panel" style="margin-bottom: 1.5rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 1rem;">
            <h3>⚡ Live Bed Capacity Controller</h3>
            <span class="sync-badge"><span class="pulse-dot"></span> Sync Active</span>
          </div>

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
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3>🏷️ Treatment & Procedure Tariff List</h3>
            <button class="btn btn-primary" id="btnToggleAddTreatment" style="padding: 4px 12px; font-size: 0.8rem;">
              ➕ Add Procedure
            </button>
          </div>

          <!-- Add Treatment Form (Collapsible) -->
          <div id="addTreatmentPanel" style="display: none; background: var(--light-bg); padding: 1rem; border-radius: var(--radius-sm); margin-bottom: 1rem;">
            <h4 style="font-size: 0.95rem; margin-bottom: 0.75rem;">Add New Medical Treatment / Procedure</h4>
            <form id="formAddTreatment" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <div class="form-group">
                <label>Procedure Name</label>
                <input type="text" id="newTreatName" class="form-control" placeholder="e.g. Laparoscopic Cholecystectomy" required>
              </div>
              <div class="form-group">
                <label>Department / Category</label>
                <select id="newTreatCategory" class="form-select">
                  <option value="General Surgery">General Surgery</option>
                  <option value="Cardiology">Cardiology</option>
                  <option value="Ophthalmology">Ophthalmology</option>
                  <option value="Orthopedics">Orthopedics</option>
                  <option value="Maternity">Maternity</option>
                  <option value="Neurology">Neurology</option>
                  <option value="Urology">Urology</option>
                  <option value="Pulmonology">Pulmonology</option>
                  <option value="Endocrinology">Endocrinology</option>
                  <option value="General Medicine">General Medicine</option>
                </select>
              </div>
              <div class="form-group">
                <label>Cost (₹)</label>
                <input type="number" id="newTreatCost" class="form-control" placeholder="35000" required>
              </div>
              <div class="form-group">
                <label>Duration / Hospital Stay</label>
                <input type="text" id="newTreatDuration" class="form-control" placeholder="e.g. 2 Days stay">
              </div>
              <div style="grid-column: 1 / -1; display: flex; gap: 8px; justify-content: flex-end;">
                <button type="button" class="btn btn-outline" onclick="document.getElementById('addTreatmentPanel').style.display='none'">Cancel</button>
                <button type="submit" class="btn btn-primary">Save Procedure</button>
              </div>
            </form>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
            <thead>
              <tr style="border-bottom: 2px solid var(--light-border); text-align: left;">
                <th style="padding: 6px;">Procedure</th>
                <th style="padding: 6px;">Cost</th>
                <th style="padding: 6px; text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${hospital.treatments.map(t => `
                <tr style="border-bottom: 1px solid var(--light-border);">
                  <td style="padding: 8px 6px;">
                    <strong>${t.name}</strong><br/>
                    <small style="color: var(--text-muted);">${t.category} • ${t.duration || ''}</small>
                  </td>
                  <td style="padding: 8px 6px; font-weight: 700; color: var(--primary);">₹${t.cost.toLocaleString()}</td>
                  <td style="padding: 8px 6px; text-align: right;">
                    <button class="btn btn-outline btn-edit-price" style="padding: 2px 8px; font-size: 0.75rem;" data-hosp="${hospital.id}" data-treat="${t.id}" data-name="${t.name}" data-cost="${t.cost}">
                      ✏️ Edit
                    </button>
                    <button class="btn btn-outline btn-delete-treatment" style="padding: 2px 8px; font-size: 0.75rem; color: #ef4444; border-color: rgba(239,68,68,0.3);" data-hosp="${hospital.id}" data-treat="${t.id}">
                      🗑️
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Right Column: Doctor Roster & Incoming Emergency Console -->
      <div>
        <!-- Incoming Emergency SOS Alerts -->
        <div class="card-panel" style="margin-bottom: 1.5rem; border-top: 4px solid var(--danger);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3>🚨 Incoming Emergency SOS Console</h3>
            <span class="badge-tag" style="background: var(--danger-light); color: var(--danger);">Live Feeds</span>
          </div>

          <div id="adminEmergencyList">
            <div style="background: #fff5f5; border: 1.5px solid #fecaca; border-radius: var(--radius-sm); padding: 1rem; margin-bottom: 1rem;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
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
                  🚑 Dispatch Ambulance Unit
                </button>
                <button class="btn btn-outline btn-reserve-icu" style="padding: 4px 12px; font-size: 0.8rem;">
                  🏥 Reserve Emergency Bed
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- On-Duty Doctor Roster Manager -->
        <div class="card-panel">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3>👨‍⚕️ On-Duty Doctor Roster</h3>
            <button class="btn btn-primary" id="btnToggleAddDoctor" style="padding: 4px 12px; font-size: 0.8rem;">
              ➕ Add Doctor
            </button>
          </div>

          <!-- Add Doctor Panel -->
          <div id="addDoctorPanel" style="display: none; background: var(--light-bg); padding: 1rem; border-radius: var(--radius-sm); margin-bottom: 1rem;">
            <h4 style="font-size: 0.95rem; margin-bottom: 0.75rem;">Add Doctor to Hospital Roster</h4>
            <form id="formAddDoctor" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <div class="form-group">
                <label>Doctor Full Name</label>
                <input type="text" id="newDocName" class="form-control" placeholder="Dr. S. K. Verma" required>
              </div>
              <div class="form-group">
                <label>Specialty & Qualifications</label>
                <input type="text" id="newDocSpec" class="form-control" placeholder="Senior Cardiologist" required>
              </div>
              <div class="form-group">
                <label>Years of Experience</label>
                <input type="text" id="newDocExp" class="form-control" placeholder="15 yrs">
              </div>
              <div class="form-group">
                <label>Duty Status</label>
                <select id="newDocStatus" class="form-select">
                  <option value="Available">Available</option>
                  <option value="In OPD">In OPD</option>
                  <option value="In Surgery">In Surgery</option>
                  <option value="On Call">On Call</option>
                </select>
              </div>
              <div style="grid-column: 1 / -1; display: flex; gap: 8px; justify-content: flex-end;">
                <button type="button" class="btn btn-outline" onclick="document.getElementById('addDoctorPanel').style.display='none'">Cancel</button>
                <button type="submit" class="btn btn-primary">Add Doctor</button>
              </div>
            </form>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            ${hospital.doctors.map((d, index) => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--light-bg); border-radius: var(--radius-sm);">
                <div>
                  <strong>${d.name}</strong> <span style="font-size:0.8rem; color: var(--text-muted);">(${d.exp})</span><br/>
                  <small style="color: var(--text-muted);">${d.spec}</small>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="badge-tag" style="background: #dcfce7; color: #15803d;">${d.status}</span>
                  <button class="btn btn-outline btn-delete-doctor" style="padding: 2px 6px; font-size: 0.75rem; color: #ef4444; border-color: rgba(239,68,68,0.3);" data-hosp="${hospital.id}" data-doc="${d.id || index}">
                    🗑️
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

      </div>

    </div>
  `;
}
