// Initial Data Store for HealthRought Platform (Real Govt & Private Hospitals)

export const INITIAL_HOSPITALS = [
  {
    id: "hosp-gov-1",
    name: "AIIMS New Delhi",
    tagline: "All India Institute of Medical Sciences (Apex Govt Hospital)",
    badge: "🏛️ Central Govt Institution",
    type: "government",
    rating: 4.9,
    reviewCount: 2840,
    distanceKm: 1.5,
    location: "Sri Aurobindo Marg, Ansari Nagar, New Delhi",
    lat: 28.5672,
    lng: 77.2100,
    phone: "+91 11 2658 8500",
    emergencyAvailable: true,
    estimatedAvgCost: 500,
    beds: {
      icu: { total: 120, available: 14 },
      emergency: { total: 250, available: 35 },
      general: { total: 2200, available: 180 }
    },
    opdWaitTimeMins: 45,
    treatments: [
      { id: "t1", name: "Appendix Surgery", category: "General Surgery", cost: 2500, duration: "Govt Subsidized (2 Days stay)" },
      { id: "t2", name: "Cataract Operation", category: "Ophthalmology", cost: 0, duration: "Free under Ayushman Bharat" },
      { id: "t3", name: "Angioplasty", category: "Cardiology", cost: 45000, duration: "Govt Stent Price Capped (3 Days)" },
      { id: "t4", name: "Normal Delivery", category: "Maternity", cost: 0, duration: "Free Maternal Scheme (PM-JAY)" },
      { id: "t5", name: "Knee Replacement", category: "Orthopedics", cost: 60000, duration: "Govt Subsidized Implant" }
    ],
    doctors: [
      { name: "Dr. Randeep Guleria", spec: "Pulmonology & Internal Medicine", exp: "30 yrs", status: "In OPD" },
      { name: "Dr. Balram Bhargava", spec: "Cardiologist", exp: "28 yrs", status: "Available" },
      { name: "Dr. Minu Bajpai", spec: "Pediatric Surgeon", exp: "22 yrs", status: "In Surgery" }
    ],
    facilities: ["24x7 Trauma Center", "Ayushman Bharat PM-JAY Cashless", "100% Free OPD Registration", "Advanced CT/MRI 3T", "Central Blood Bank", "Jan Aushadhi PM Generic Pharmacy"],
    ambulanceUnits: [
      { id: "amb-501", type: "Govt ALS Ventilator Ambulance", vehicleNo: "DL 01 A 9999", driver: "Satish Chand", phone: "+91 11 2658 9999", ratePerKm: 0 }
    ]
  },
  {
    id: "hosp-gov-2",
    name: "LLRM Government Medical College & Hospital",
    tagline: "State Government Tertiary Hospital",
    badge: "🏛️ UP State Govt Hospital",
    type: "government",
    rating: 4.5,
    reviewCount: 940,
    distanceKm: 2.1,
    location: "Garh Road, Panchli Khurd, Meerut, Uttar Pradesh",
    lat: 28.9845,
    lng: 77.7064,
    phone: "+91 121 276 0058",
    emergencyAvailable: true,
    estimatedAvgCost: 800,
    beds: {
      icu: { total: 30, available: 6 },
      emergency: { total: 60, available: 12 },
      general: { total: 750, available: 95 }
    },
    opdWaitTimeMins: 30,
    treatments: [
      { id: "t1", name: "Appendix Surgery", category: "General Surgery", cost: 3000, duration: "Govt Fee (2 Days stay)" },
      { id: "t2", name: "Cataract Operation", category: "Ophthalmology", cost: 300, duration: "Day care" },
      { id: "t3", name: "Angioplasty", category: "Cardiology", cost: 50000, duration: "Subsidized Stent" },
      { id: "t4", name: "Normal Delivery", category: "Maternity", cost: 0, duration: "Free Janani Suraksha" },
      { id: "t5", name: "Knee Replacement", category: "Orthopedics", cost: 55000, duration: "Subsidized Implant" }
    ],
    doctors: [
      { name: "Dr. R. C. Gupta", spec: "Senior Physician", exp: "26 yrs", status: "In OPD" },
      { name: "Dr. Subhash Chand", spec: "General Surgeon", exp: "20 yrs", status: "Available" }
    ],
    facilities: ["24x7 Emergency Trauma", "Ayushman Bharat Cashless", "Free Essential Medicines", "State Blood Bank", "ART Center"],
    ambulanceUnits: [
      { id: "amb-108", type: "108 Govt Emergency Ambulance", vehicleNo: "UP 15 G 0108", driver: "Virendra Singh", phone: "108", ratePerKm: 0 }
    ]
  },
  {
    id: "hosp-gov-3",
    name: "Dr. Ram Manohar Lohia (RML) Hospital",
    tagline: "Central Government Multi-Specialty Hospital",
    badge: "🏛️ Central Govt Hospital",
    type: "government",
    rating: 4.6,
    reviewCount: 1650,
    distanceKm: 3.8,
    location: "Baba Kharak Singh Marg, Connaught Place, New Delhi",
    lat: 28.6256,
    lng: 77.2090,
    phone: "+91 11 2336 5525",
    emergencyAvailable: true,
    estimatedAvgCost: 600,
    beds: {
      icu: { total: 45, available: 8 },
      emergency: { total: 90, available: 18 },
      general: { total: 1400, available: 110 }
    },
    opdWaitTimeMins: 35,
    treatments: [
      { id: "t1", name: "Appendix Surgery", category: "General Surgery", cost: 2800, duration: "Govt Fee" },
      { id: "t2", name: "Cataract Operation", category: "Ophthalmology", cost: 400, duration: "Day care" },
      { id: "t3", name: "Angioplasty", category: "Cardiology", cost: 42000, duration: "CGHS Rate" },
      { id: "t4", name: "Normal Delivery", category: "Maternity", cost: 0, duration: "Free Care" },
      { id: "t5", name: "Knee Replacement", category: "Orthopedics", cost: 58000, duration: "Subsidized" }
    ],
    doctors: [
      { name: "Dr. Ajay Shukla", spec: "Director Professor", exp: "28 yrs", status: "Available" },
      { name: "Dr. Tarun Kumar", spec: "Cardiologist", exp: "19 yrs", status: "In OPD" }
    ],
    facilities: ["24x7 Emergency Bay", "Central Govt Health Scheme (CGHS)", "24x7 Free Diagnostics", "Super Specialty OPD"],
    ambulanceUnits: [
      { id: "amb-rml", type: "Govt Life Support Ambulance", vehicleNo: "DL 01 C 4455", driver: "Anil Kumar", phone: "+91 11 2336 0000", ratePerKm: 0 }
    ]
  },
  {
    id: "hosp-1",
    name: "City Care Hospital",
    tagline: "Multispeciality & Emergency Care",
    badge: "Government Approved",
    type: "private",
    rating: 4.6,
    reviewCount: 420,
    distanceKm: 3.2,
    location: "Central Avenue, Sector 14, Meerut",
    lat: 28.9720,
    lng: 77.7120,
    phone: "+91 98765 43210",
    emergencyAvailable: true,
    estimatedAvgCost: 45000,
    beds: {
      icu: { total: 15, available: 4 },
      emergency: { total: 20, available: 6 },
      general: { total: 80, available: 18 }
    },
    opdWaitTimeMins: 20,
    treatments: [
      { id: "t1", name: "Appendix Surgery", category: "General Surgery", cost: 45000, duration: "2 Days stay" },
      { id: "t2", name: "Cataract Operation", category: "Ophthalmology", cost: 18000, duration: "Day care" },
      { id: "t3", name: "Angioplasty", category: "Cardiology", cost: 135000, duration: "3 Days stay" },
      { id: "t4", name: "Normal Delivery", category: "Maternity", cost: 32000, duration: "2 Days stay" },
      { id: "t5", name: "Knee Replacement", category: "Orthopedics", cost: 160000, duration: "5 Days stay" }
    ],
    doctors: [
      { name: "Dr. Ananya Sharma", spec: "General Surgeon", exp: "14 yrs", status: "Available Today" },
      { name: "Dr. Rajesh Verma", spec: "Cardiologist", exp: "18 yrs", status: "In OPD" },
      { name: "Dr. S. K. Gupta", spec: "Orthopedic Specialist", exp: "12 yrs", status: "On Call" }
    ],
    facilities: ["24x7 ICU", "Blood Bank", "Cashless Insurance", "In-house Pharmacy", "Ventilator Support", "CT Scan"],
    ambulanceUnits: [
      { id: "amb-101", type: "Normal", vehicleNo: "UP 15 AB 1234", driver: "Ramesh Kumar", phone: "+91 91234 56789", ratePerKm: 25 },
      { id: "amb-102", type: "ICU Ventilator", vehicleNo: "UP 15 AB 5678", driver: "Suresh Singh", phone: "+91 91234 98765", ratePerKm: 55 }
    ]
  },
  {
    id: "hosp-2",
    name: "Life Line Hospital",
    tagline: "Advanced Cardiac & Trauma Care",
    badge: "NABH Accredited",
    type: "private",
    rating: 4.3,
    reviewCount: 310,
    distanceKm: 4.7,
    location: "Mall Road, Near Civil Lines, Meerut",
    lat: 28.9900,
    lng: 77.7000,
    phone: "+91 98765 11223",
    emergencyAvailable: true,
    estimatedAvgCost: 48000,
    beds: {
      icu: { total: 12, available: 2 },
      emergency: { total: 15, available: 3 },
      general: { total: 60, available: 12 }
    },
    opdWaitTimeMins: 35,
    treatments: [
      { id: "t1", name: "Appendix Surgery", category: "General Surgery", cost: 48000, duration: "2 Days stay" },
      { id: "t2", name: "Cataract Operation", category: "Ophthalmology", cost: 20000, duration: "Day care" },
      { id: "t3", name: "Angioplasty", category: "Cardiology", cost: 142000, duration: "3 Days stay" },
      { id: "t4", name: "Normal Delivery", category: "Maternity", cost: 35000, duration: "2 Days stay" },
      { id: "t5", name: "Knee Replacement", category: "Orthopedics", cost: 175000, duration: "5 Days stay" }
    ],
    doctors: [
      { name: "Dr. Vikram Sethi", spec: "Interventional Cardiologist", exp: "20 yrs", status: "Available" },
      { name: "Dr. Priya Nair", spec: "Gynecologist", exp: "10 yrs", status: "Available" }
    ],
    facilities: ["24x7 ICU", "Oxygen Plant", "Insurance Claim Support", "Advanced Lab", "MRI 1.5T"],
    ambulanceUnits: [
      { id: "amb-201", type: "Normal", vehicleNo: "UP 15 CD 4321", driver: "Mohan Lal", phone: "+91 98111 22334", ratePerKm: 28 },
      { id: "amb-202", type: "ICU Ventilator", vehicleNo: "UP 15 CD 8765", driver: "Dinesh Pal", phone: "+91 98111 55667", ratePerKm: 60 }
    ]
  },
  {
    id: "hosp-4",
    name: "Apex Heart & General Hospital",
    tagline: "Premier Cardiac & Vascular Institute",
    badge: "Tertiary Care Center",
    type: "private",
    rating: 4.8,
    reviewCount: 540,
    distanceKm: 2.8,
    location: "University Road, Meerut",
    lat: 28.9780,
    lng: 77.7250,
    phone: "+91 98765 33445",
    emergencyAvailable: true,
    estimatedAvgCost: 52000,
    beds: {
      icu: { total: 25, available: 8 },
      emergency: { total: 30, available: 10 },
      general: { total: 120, available: 45 }
    },
    opdWaitTimeMins: 25,
    treatments: [
      { id: "t1", name: "Appendix Surgery", category: "General Surgery", cost: 52000, duration: "2 Days stay" },
      { id: "t2", name: "Cataract Operation", category: "Ophthalmology", cost: 22000, duration: "Day care" },
      { id: "t3", name: "Angioplasty", category: "Cardiology", cost: 155000, duration: "3 Days stay" },
      { id: "t4", name: "Normal Delivery", category: "Maternity", cost: 40000, duration: "2 Days stay" },
      { id: "t5", name: "Knee Replacement", category: "Orthopedics", cost: 180000, duration: "5 Days stay" }
    ],
    doctors: [
      { name: "Dr. K. N. Kapoor", spec: "Chief Cardiac Surgeon", exp: "24 yrs", status: "In Surgery" },
      { name: "Dr. Meenakshi Joshi", spec: "Neurologist", exp: "16 yrs", status: "Available" }
    ],
    facilities: ["Cath Lab", "24x7 Cardiac Emergency", "ECMO", "Dialysis Center", "Helipad Access"],
    ambulanceUnits: [
      { id: "amb-401", type: "Cardiac Ambulance", vehicleNo: "UP 15 GH 3344", driver: "Deepak Sharma", phone: "+91 96666 44332", ratePerKm: 65 }
    ]
  }
];

export const SYMPTOM_DATABASE = [
  {
    symptom: "Severe lower right abdominal pain, nausea, fever",
    suggestedDepartment: "General Surgery",
    suggestedTreatment: "Appendix Surgery",
    urgency: "High",
    estimatedCostRange: "Govt: ₹2,500 - ₹3,000 | Private: ₹38,000 - ₹52,000"
  },
  {
    symptom: "Chest tightness, pain radiating to left arm, breathlessness",
    suggestedDepartment: "Cardiology",
    suggestedTreatment: "Angioplasty",
    urgency: "Critical (Emergency SOS Recommended)",
    estimatedCostRange: "Govt: ₹42,000 - ₹50,000 | Private: ₹1,20,000 - ₹1,60,000"
  },
  {
    symptom: "Blurry vision, cloudy eye lens, difficulty reading",
    suggestedDepartment: "Ophthalmology",
    suggestedTreatment: "Cataract Operation",
    urgency: "Low",
    estimatedCostRange: "Govt: FREE (Ayushman Bharat) | Private: ₹15,000 - ₹22,000"
  },
  {
    symptom: "Severe knee joint pain, swelling, difficulty walking",
    suggestedDepartment: "Orthopedics",
    suggestedTreatment: "Knee Replacement",
    urgency: "Medium",
    estimatedCostRange: "Govt: ₹55,000 - ₹60,000 | Private: ₹1,45,000 - ₹1,80,000"
  }
];

export const INITIAL_BOOKINGS = [
  {
    id: "BK-9021",
    patientName: "Rahul Sharma",
    patientPhone: "+91 98123 45678",
    hospitalId: "hosp-gov-1",
    hospitalName: "AIIMS New Delhi",
    ambulanceType: "Govt ALS Ambulance",
    pickupLocation: "H.No 45, Shastri Nagar, Meerut",
    dropLocation: "AIIMS Emergency Trauma, Ansari Nagar, New Delhi",
    status: "En Route",
    etaMins: 12,
    fare: 0,
    timestamp: "2026-07-26 21:40"
  }
];

export const SAMPLE_HEALTH_RECORDS = [
  {
    id: "REC-101",
    date: "2026-06-12",
    title: "Complete Blood Count & Lipid Profile",
    hospital: "AIIMS New Delhi",
    doctor: "Dr. Randeep Guleria",
    type: "Govt Lab Report",
    summary: "Hemoglobin 14.2 g/dL (Normal). Cholesterol slightly elevated (210 mg/dL). Verified by AIIMS Central Lab.",
    fileRef: "report_aiims_cbc.pdf"
  },
  {
    id: "REC-102",
    date: "2026-05-04",
    title: "Abdominal Ultrasound Scan",
    hospital: "LLRM Govt Medical College",
    doctor: "Dr. Subhash Chand",
    type: "Imaging Scan",
    summary: "No inflammation found in gallbladder. Appendix normal.",
    fileRef: "scan_llrm_ultrasound.pdf"
  }
];
