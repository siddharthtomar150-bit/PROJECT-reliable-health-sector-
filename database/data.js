// Realistic Clinical Dataset for MediGo Healthcare Platform

export const INITIAL_HOSPITALS = [
  {
    id: "hosp-gov-1",
    name: "AIIMS New Delhi",
    tagline: "All India Institute of Medical Sciences — Apex National Medical Institute",
    badge: "Apex National Medical Institute",
    type: "government",
    rating: 4.9,
    reviewCount: 3840,
    distanceKm: 1.8,
    location: "Sri Aurobindo Marg, Ansari Nagar, New Delhi",
    lat: 28.5672,
    lng: 77.2100,
    phone: "+91 11 2658 8500",
    emergencyAvailable: true,
    estimatedAvgCost: 500,
    cover_image: "https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=800&auto=format&fit=crop&q=80",
    accreditation: "NABH & NABL Accredited • Apex Referral Institute",
    reg_number: "AIIMS-DEL-APEX-01",
    abdmCompliant: true,
    pmjayEmpanelled: true,
    cghsEmpanelled: true,
    echsEmpanelled: true,
    beds: {
      icu: { total: 140, available: 18 },
      emergency: { total: 280, available: 42 },
      general: { total: 2400, available: 210 }
    },
    bedBreakdown: {
      icuVentilator: { total: 90, available: 12 },
      ccu: { total: 30, available: 4 },
      hdu: { total: 50, available: 8 },
      nicu: { total: 25, available: 5 },
      general: { total: 2400, available: 210 }
    },
    emergencyStatus: {
      casualtyActive: true,
      triageWaitMins: 0,
      onDutyCmo: "Dr. Arvind Kumar (MD Emergency Medicine)",
      oxygenPressureBar: 4.3,
      bloodBankUnits: 412
    },
    opdWaitTimeMins: 35,
    treatments: [
      { id: "t1", name: "Emergency Trauma & Appendix Surgery", category: "General Surgery", cost: 2500, duration: "Subsidized Inpatient (2 Days)" },
      { id: "t2", name: "Cataract Phacoemulsification", category: "Ophthalmology", cost: 0, duration: "100% Cashless under PM-JAY" },
      { id: "t3", name: "Coronary Angioplasty (DES Stent)", category: "Cardiology", cost: 45000, duration: "NPPA Stent Capped (3 Days)" },
      { id: "t4", name: "Comprehensive Maternity Delivery", category: "Obstetrics", cost: 0, duration: "Free under Janani Suraksha" },
      { id: "t5", name: "Total Knee Replacement", category: "Orthopedics", cost: 60000, duration: "Govt Subsidized Implant" }
    ],
    doctors: [
      { name: "Dr. Randeep Guleria", spec: "Pulmonology & Critical Care", exp: "32 yrs", status: "In OPD" },
      { name: "Dr. Balram Bhargava", spec: "Chief Interventional Cardiologist", exp: "29 yrs", status: "Available" },
      { name: "Dr. Minu Bajpai", spec: "Pediatric & Neonatal Surgeon", exp: "24 yrs", status: "In Surgery" }
    ],
    facilities: ["Level 1 Apex Trauma Center", "Ayushman PM-JAY Cashless Desk", "24x7 Digital ABHA Integration", "Dual 3T MRI & 256-Slice CT", "Central Liquid O2 Manifold", "Jan Aushadhi Generic Pharmacy"],
    ambulanceUnits: [
      { id: "amb-501", type: "Govt ALS Ventilator Ambulance", vehicleNo: "DL 01 EM 1081", driver: "Satish Chand", phone: "+91 11 2658 9999", ratePerKm: 0, paramedic: "EMT Suresh Rawat" }
    ]
  },
  {
    id: "hosp-gov-2",
    name: "Safdarjung Hospital & VMMC",
    tagline: "Central Government Multi-Specialty Tertiary Hospital & Trauma Centre",
    badge: "Central Govt Tertiary Hospital",
    type: "government",
    rating: 4.7,
    reviewCount: 2190,
    distanceKm: 2.3,
    location: "Ring Road, Opposite AIIMS, New Delhi",
    lat: 28.5701,
    lng: 77.2065,
    phone: "+91 11 2616 5060",
    emergencyAvailable: true,
    estimatedAvgCost: 650,
    cover_image: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&auto=format&fit=crop&q=80",
    accreditation: "NABH Accredited Level 1 Trauma Center",
    reg_number: "SJH-DEL-CGHS-02",
    abdmCompliant: true,
    pmjayEmpanelled: true,
    cghsEmpanelled: true,
    echsEmpanelled: true,
    beds: {
      icu: { total: 95, available: 11 },
      emergency: { total: 180, available: 26 },
      general: { total: 1600, available: 140 }
    },
    bedBreakdown: {
      icuVentilator: { total: 60, available: 8 },
      ccu: { total: 20, available: 3 },
      hdu: { total: 35, available: 6 },
      nicu: { total: 18, available: 4 },
      general: { total: 1600, available: 140 }
    },
    emergencyStatus: {
      casualtyActive: true,
      triageWaitMins: 0,
      onDutyCmo: "Dr. Neha Kapoor (Casualty Medical Officer)",
      oxygenPressureBar: 4.2,
      bloodBankUnits: 280
    },
    opdWaitTimeMins: 30,
    treatments: [
      { id: "t1", name: "Emergency General Surgery", category: "General Surgery", cost: 2800, duration: "Govt Subsidized (2 Days)" },
      { id: "t2", name: "Coronary Care & Angiography", category: "Cardiology", cost: 8500, duration: "Central Govt Scheme" },
      { id: "t3", name: "Burns & Plastic Surgery Triage", category: "Super Specialty", cost: 0, duration: "100% Free Emergency Care" },
      { id: "t4", name: "Advanced Pediatric Inpatient", category: "Pediatrics", cost: 0, duration: "Cashless Govt Care" }
    ],
    doctors: [
      { name: "Dr. B. L. Sherwal", spec: "Medical Superintendent & Internal Medicine", exp: "28 yrs", status: "Available" },
      { name: "Dr. S. K. Jain", spec: "Head of Orthopedics & Trauma", exp: "22 yrs", status: "In OPD" }
    ],
    facilities: ["Dedicated Super-Specialty Trauma Block", "PM-JAY Gold Helpdesk", "24x7 Blood Component Center", "Free Emergency Diagnostics", "Specialized Burns ICU"],
    ambulanceUnits: [
      { id: "amb-502", type: "Govt Advanced Life Support (ALS)", vehicleNo: "DL 01 EM 1082", driver: "Pankaj Yadav", phone: "108", ratePerKm: 0, paramedic: "EMT Meena Devi" }
    ]
  },
  {
    id: "hosp-1",
    name: "Max Super Speciality Hospital",
    tagline: "NABH & JCI Accredited Quaternary Care & Robotic Surgery Center",
    badge: "NABH & JCI Accredited",
    type: "private",
    rating: 4.8,
    reviewCount: 1420,
    distanceKm: 3.5,
    location: "1, 2, Press Enclave Road, Saket, New Delhi",
    lat: 28.5284,
    lng: 77.2115,
    phone: "+91 11 2651 5050",
    emergencyAvailable: true,
    estimatedAvgCost: 65000,
    cover_image: "https://images.unsplash.com/photo-1516549655169-df83a0774514?w=800&auto=format&fit=crop&q=80",
    accreditation: "JCI International & NABH Full Accreditation",
    reg_number: "MAX-SAK-NABH-882",
    abdmCompliant: true,
    pmjayEmpanelled: true,
    cghsEmpanelled: true,
    echsEmpanelled: true,
    beds: {
      icu: { total: 75, available: 14 },
      emergency: { total: 40, available: 12 },
      general: { total: 450, available: 68 }
    },
    bedBreakdown: {
      icuVentilator: { total: 45, available: 9 },
      ccu: { total: 20, available: 3 },
      hdu: { total: 25, available: 7 },
      nicu: { total: 15, available: 4 },
      general: { total: 450, available: 68 }
    },
    emergencyStatus: {
      casualtyActive: true,
      triageWaitMins: 0,
      onDutyCmo: "Dr. Rohit Malhotra (FACEM Specialist)",
      oxygenPressureBar: 4.4,
      bloodBankUnits: 340
    },
    opdWaitTimeMins: 15,
    treatments: [
      { id: "t1", name: "Laparoscopic Cholecystectomy", category: "General Surgery", cost: 58000, duration: "Daycare / 1 Day Inpatient" },
      { id: "t2", name: "Primary Coronary Angioplasty", category: "Cardiology", cost: 165000, duration: "3 Days Stay • TPA Cashless" },
      { id: "t3", name: "Robotic Total Knee Replacement", category: "Orthopedics", cost: 195000, duration: "4 Days Stay • Physio Included" },
      { id: "t4", name: "Advanced Neuro-Trauma Surgery", category: "Neurosciences", cost: 240000, duration: "ICU Monitored" }
    ],
    doctors: [
      { name: "Dr. Vivek Raj", spec: "Chief Gastroenterologist", exp: "26 yrs", status: "Available" },
      { name: "Dr. Puneet Girdhar", spec: "Director of Spine & Ortho", exp: "20 yrs", status: "In OPD" }
    ],
    facilities: ["24x7 Stroke & Cardiac Code Blue", "Da Vinci Xi Robotic Surgical Suite", "Instant TPA Cashless Desk", "On-site MRI 3.0 Tesla", "Helipad Emergency Evacuation"],
    ambulanceUnits: [
      { id: "amb-101", type: "Cardiac Critical Care Ambulance", vehicleNo: "DL 01 CC 9021", driver: "Manoj Rawat", phone: "+91 98111 88990", ratePerKm: 45, paramedic: "EMT Rajesh Varma" }
    ]
  },
  {
    id: "hosp-2",
    name: "Fortis Escorts Heart Institute",
    tagline: "Dedicated Comprehensive Cardiac & Vascular Care Institute",
    badge: "Apex Cardiac Care Institute",
    type: "private",
    rating: 4.8,
    reviewCount: 980,
    distanceKm: 4.2,
    location: "Okhla Road, New Friends Colony, New Delhi",
    lat: 28.5606,
    lng: 77.2778,
    phone: "+91 11 4713 5000",
    emergencyAvailable: true,
    estimatedAvgCost: 72000,
    cover_image: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&auto=format&fit=crop&q=80",
    accreditation: "NABH Certified Centre of Excellence in Cardiology",
    reg_number: "FEHI-DEL-CARDIO-44",
    abdmCompliant: true,
    pmjayEmpanelled: true,
    cghsEmpanelled: true,
    echsEmpanelled: true,
    beds: {
      icu: { total: 80, available: 16 },
      emergency: { total: 30, available: 8 },
      general: { total: 310, available: 52 }
    },
    bedBreakdown: {
      icuVentilator: { total: 50, available: 10 },
      ccu: { total: 30, available: 6 },
      hdu: { total: 20, available: 5 },
      nicu: { total: 10, available: 2 },
      general: { total: 310, available: 52 }
    },
    emergencyStatus: {
      casualtyActive: true,
      triageWaitMins: 0,
      onDutyCmo: "Dr. Ananya Roy (Cardiology Emergency Specialist)",
      oxygenPressureBar: 4.5,
      bloodBankUnits: 210
    },
    opdWaitTimeMins: 20,
    treatments: [
      { id: "t1", name: "Primary PCI / Emergency Angioplasty", category: "Cardiology", cost: 155000, duration: "Door-to-Balloon < 60 mins" },
      { id: "t2", name: "Minimally Invasive CABG (Bypass)", category: "Cardiac Surgery", cost: 285000, duration: "5 Days Recovery" },
      { id: "t3", name: "Pacemaker & ICD Implantation", category: "Electrophysiology", cost: 135000, duration: "2 Days Inpatient" }
    ],
    doctors: [
      { name: "Dr. Ashok Seth", spec: "Chairman, Interventional Cardiology", exp: "34 yrs", status: "Available" },
      { name: "Dr. Z. S. Meharwal", spec: "Director, Heart Transplant & VAD", exp: "28 yrs", status: "In Surgery" }
    ],
    facilities: ["24x7 Cath Lab Activation", "ECMO & Heart Failure Intensive Unit", "ABDM Electronic Health Records", "Dedicated Chest Pain Center"],
    ambulanceUnits: [
      { id: "amb-201", type: "Cardiac Mobile Intensive Care Unit", vehicleNo: "DL 01 CV 4400", driver: "Dharam Singh", phone: "+91 98711 00223", ratePerKm: 50, paramedic: "EMT Vikas Sharma" }
    ]
  },
  {
    id: "hosp-gov-3",
    name: "Dr. Ram Manohar Lohia (RML) Hospital",
    tagline: "Central Government Multi-Specialty Teaching & Referral Hospital",
    badge: "Central Govt Multi-Specialty",
    type: "government",
    rating: 4.6,
    reviewCount: 1850,
    distanceKm: 3.8,
    location: "Baba Kharak Singh Marg, Connaught Place, New Delhi",
    lat: 28.6256,
    lng: 77.2090,
    phone: "+91 11 2336 5525",
    emergencyAvailable: true,
    estimatedAvgCost: 600,
    cover_image: "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=800&auto=format&fit=crop&q=80",
    accreditation: "NABH Accredited Central Govt Teaching Hospital",
    reg_number: "RML-DEL-GOV-03",
    abdmCompliant: true,
    pmjayEmpanelled: true,
    cghsEmpanelled: true,
    echsEmpanelled: true,
    beds: {
      icu: { total: 55, available: 9 },
      emergency: { total: 110, available: 20 },
      general: { total: 1450, available: 125 }
    },
    bedBreakdown: {
      icuVentilator: { total: 35, available: 6 },
      ccu: { total: 15, available: 3 },
      hdu: { total: 25, available: 5 },
      nicu: { total: 12, available: 3 },
      general: { total: 1450, available: 125 }
    },
    emergencyStatus: {
      casualtyActive: true,
      triageWaitMins: 0,
      onDutyCmo: "Dr. Pradeep Mishra (Senior CMO)",
      oxygenPressureBar: 4.2,
      bloodBankUnits: 195
    },
    opdWaitTimeMins: 30,
    treatments: [
      { id: "t1", name: "Emergency Appendix & Laparoscopy", category: "General Surgery", cost: 2800, duration: "Govt Subsidized" },
      { id: "t2", name: "Ophthalmic Cataract Daycare", category: "Ophthalmology", cost: 400, duration: "100% Cashless PM-JAY" },
      { id: "t3", name: "Cardiac Angioplasty", category: "Cardiology", cost: 42000, duration: "CGHS Package Rate" }
    ],
    doctors: [
      { name: "Dr. Ajay Shukla", spec: "Director Professor of Surgery", exp: "28 yrs", status: "Available" },
      { name: "Dr. Tarun Kumar", spec: "Senior Interventional Cardiologist", exp: "19 yrs", status: "In OPD" }
    ],
    facilities: ["24x7 Emergency Casualty Bay", "Central Govt Health Scheme (CGHS) Desk", "ABDM Digital Vault Integration", "24x7 Automated Laboratory"],
    ambulanceUnits: [
      { id: "amb-rml", type: "Govt Life Support Ambulance", vehicleNo: "DL 01 C 4455", driver: "Anil Kumar", phone: "+91 11 2336 0000", ratePerKm: 0, paramedic: "EMT Sunita Rao" }
    ]
  },
  {
    id: "hosp-4",
    name: "Medanta — The Medicity",
    tagline: "NABH & JCI Accredited Multi-Super Specialty Quaternary Care Institute",
    badge: "NABH & JCI Accredited",
    type: "private",
    rating: 4.9,
    reviewCount: 2640,
    distanceKm: 8.5,
    location: "CH Bakhtawar Singh Road, Sector 38, Gurugram, NCR",
    lat: 28.4390,
    lng: 77.0425,
    phone: "+91 124 414 1414",
    emergencyAvailable: true,
    estimatedAvgCost: 78000,
    cover_image: "https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=800&auto=format&fit=crop&q=80",
    accreditation: "JCI USA & NABH Full Accreditation",
    reg_number: "MED-GUR-JCI-901",
    abdmCompliant: true,
    pmjayEmpanelled: true,
    cghsEmpanelled: true,
    echsEmpanelled: true,
    beds: {
      icu: { total: 120, available: 22 },
      emergency: { total: 60, available: 16 },
      general: { total: 1100, available: 165 }
    },
    bedBreakdown: {
      icuVentilator: { total: 80, available: 15 },
      ccu: { total: 30, available: 5 },
      hdu: { total: 40, available: 9 },
      nicu: { total: 20, available: 4 },
      general: { total: 1100, available: 165 }
    },
    emergencyStatus: {
      casualtyActive: true,
      triageWaitMins: 0,
      onDutyCmo: "Dr. Sanjay Roy (Director of Emergency Services)",
      oxygenPressureBar: 4.5,
      bloodBankUnits: 510
    },
    opdWaitTimeMins: 15,
    treatments: [
      { id: "t1", name: "CyberKnife Robotic Radiosurgery", category: "Oncology", cost: 185000, duration: "Precision Daycare" },
      { id: "t2", name: "Liver & Kidney Transplant Assessment", category: "Organ Transplant", cost: 450000, duration: "Multidisciplinary Protocol" },
      { id: "t3", name: "Complex Brain & Spine Microneurosurgery", category: "Neurosciences", cost: 260000, duration: "Intraoperative MRI Guided" }
    ],
    doctors: [
      { name: "Dr. Naresh Trehan", spec: "Chairman & Chief Cardiac Surgeon", exp: "40 yrs", status: "Available" },
      { name: "Dr. A. S. Soin", spec: "Chairman, Liver Transplant Institute", exp: "30 yrs", status: "In Surgery" }
    ],
    facilities: ["Dedicated Level 1 Trauma ICU", "Air Ambulance Helipad Service", "Digital ABHA Health Locker", "Instant Cashless Pre-Auth with 40+ TPAs"],
    ambulanceUnits: [
      { id: "amb-medanta", type: "Air-Conditioned ALS Intensive Unit", vehicleNo: "HR 26 DQ 1001", driver: "Karan Singh", phone: "+91 124 414 1108", ratePerKm: 55, paramedic: "EMT Sandeep Verma" }
    ]
  },
  {
    id: "hosp-meerut-1",
    name: "Anand Hospital",
    tagline: "Premier Multi-Specialty Hospital & PM-JAY Cashless Network",
    badge: "🏥 PM-JAY Empanelled Multi-Specialty",
    type: "private",
    rating: 4.8,
    reviewCount: 1240,
    distanceKm: 2.1,
    location: "A-1, Damodar Colony, Garh Road, Near Medical College, Meerut - 250002",
    lat: 28.9845,
    lng: 77.7264,
    phone: "0121-4014800",
    state: "Uttar Pradesh",
    district: "Meerut",
    pincode: "250002",
    emergencyAvailable: true,
    estimatedAvgCost: 350,
    cover_image: "https://images.unsplash.com/photo-1516549655169-df83a0774514?w=800&auto=format&fit=crop&q=80",
    accreditation: "NABH Accredited Multi-Specialty Hospital",
    reg_number: "ANAND-MRT-250002",
    pmjayEmpanelled: true,
    cghsEmpanelled: true,
    beds: {
      icu: { total: 25, available: 6 },
      emergency: { total: 30, available: 9 },
      general: { total: 250, available: 42 }
    },
    opdWaitTimeMins: 15,
    workingHours: "11:00 AM - 2:00 PM (Mon-Sat)",
    treatments: [
      { id: "t1-anand", name: "Emergency Trauma Resuscitation", category: "Emergency", cost: 2500, duration: "Daycare" },
      { id: "t2-anand", name: "Cardiology & Cath Lab Angioplasty", category: "Cardiology", cost: 55000, duration: "Cashless PM-JAY" },
      { id: "t3-anand", name: "Laparoscopic Surgery", category: "General Surgery", cost: 32000, duration: "2 Days" }
    ],
    doctors: [
      { name: "Dr. Arvind Saxena", spec: "Chief of Emergency Medicine", exp: "22 yrs", status: "In Casualty" },
      { name: "Dr. Sunita Sharma", spec: "Senior Cardiologist", exp: "18 yrs", status: "Available in OPD" }
    ],
    facilities: ["24x7 Emergency Casualty", "PM-JAY Helpdesk", "Cath Lab", "ICU Ventilator", "Pharmacy"],
    ambulanceUnits: [
      { id: "amb-anand-1", type: "ALS Intensive Unit", vehicleNo: "UP 15 BT 1008", driver: "Sunil Kumar", phone: "0121-4014800", ratePerKm: 30 }
    ]
  },
  {
    id: "hosp-meerut-2",
    name: "P.L. Sharma District Hospital",
    tagline: "Apex District Government Hospital of Meerut",
    badge: "🏛️ UP State Govt Hospital (100% Free PM-JAY)",
    type: "government",
    rating: 4.5,
    reviewCount: 2150,
    distanceKm: 1.5,
    location: "Civil Lines, Near Commissioner Office, Meerut - 250001",
    lat: 28.9950,
    lng: 77.7120,
    phone: "9897496004",
    state: "Uttar Pradesh",
    district: "Meerut",
    pincode: "250001",
    emergencyAvailable: true,
    estimatedAvgCost: 0,
    cover_image: "https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=800&auto=format&fit=crop&q=80",
    accreditation: "Government District Apex Hospital",
    reg_number: "PLS-MRT-GOV-01",
    pmjayEmpanelled: true,
    cghsEmpanelled: true,
    beds: {
      icu: { total: 30, available: 8 },
      emergency: { total: 50, available: 14 },
      general: { total: 500, available: 65 }
    },
    opdWaitTimeMins: 25,
    workingHours: "8:00 AM - 2:00 PM (OPD)",
    treatments: [
      { id: "t1-pls", name: "100% Free OPD & Essential Medicines", category: "General", cost: 0, duration: "Free OPD" },
      { id: "t2-pls", name: "Trauma Resuscitation & Casualty", category: "Emergency", cost: 0, duration: "24x7 Free" },
      { id: "t3-pls", name: "General & Orthopedic Surgery", category: "Surgery", cost: 500, duration: "Free under PM-JAY" }
    ],
    doctors: [
      { name: "Dr. K. P. Singh", spec: "Chief Medical Superintendent", exp: "26 yrs", status: "In OPD" },
      { name: "Dr. Rakesh Gupta", spec: "Senior Consultant Orthopedics", exp: "20 yrs", status: "Available" }
    ],
    facilities: ["24x7 Trauma Casualty", "PM Jan Aushadhi Pharmacy", "Free Blood Bank", "Ayushman PM-JAY Kiosk"],
    ambulanceUnits: [
      { id: "amb-pls-108", type: "Govt 108 Emergency Ambulance", vehicleNo: "UP 15 G 0108", driver: "Ramesh Chand", phone: "108", ratePerKm: 0 }
    ]
  },
  {
    id: "hosp-meerut-4",
    name: "Svbp Hospital Medical College",
    tagline: "Sardar Vallabhbhai Patel Hospital & LLRM Government Medical College",
    badge: "🏛️ Government Teaching Medical College",
    type: "government",
    rating: 4.7,
    reviewCount: 3400,
    distanceKm: 2.8,
    location: "Garh Road, Panchli Khurd, Meerut - 250004",
    lat: 28.9845,
    lng: 77.7064,
    phone: "+91 121 276 0058",
    state: "Uttar Pradesh",
    district: "Meerut",
    pincode: "250004",
    emergencyAvailable: true,
    estimatedAvgCost: 0,
    cover_image: "https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=800&auto=format&fit=crop&q=80",
    accreditation: "MCI / NMC Recognized Tertiary Apex Medical College",
    reg_number: "SVBP-LLRM-MRT-01",
    pmjayEmpanelled: true,
    cghsEmpanelled: true,
    beds: {
      icu: { total: 60, available: 12 },
      emergency: { total: 80, available: 22 },
      general: { total: 1100, available: 145 }
    },
    opdWaitTimeMins: 30,
    workingHours: "8:30 AM - 2:00 PM (OPD)",
    treatments: [
      { id: "t1-svbp", name: "Tertiary Emergency Care & Code Blue", category: "Emergency", cost: 0, duration: "Free Casualty" },
      { id: "t2-svbp", name: "Cardiac Angioplasty & Stenting", category: "Cardiology", cost: 45000, duration: "Cashless PM-JAY" },
      { id: "t3-svbp", name: "Neurosurgery & Spine Trauma", category: "Neurosurgery", cost: 2000, duration: "Subsidized Govt" }
    ],
    doctors: [
      { name: "Dr. R. C. Gupta", spec: "Principal & Senior Physician", exp: "30 yrs", status: "In OPD" },
      { name: "Dr. Subhash Chand", spec: "Head of General Surgery", exp: "24 yrs", status: "In Surgery" }
    ],
    facilities: ["Level 1 Trauma Center", "24x7 PM-JAY Ayushman Mitra Counter", "Advanced MRI / CT 128 Slice", "Blood Bank & Component Separation"],
    ambulanceUnits: [
      { id: "amb-svbp-108", type: "State ALS Life Support Fleet", vehicleNo: "UP 15 G 4455", driver: "Devendra Pal", phone: "108", ratePerKm: 0 }
    ]
  }
];

// Clinical Emergency Triage & ICD-10 Decision Support Protocols
export const CLINICAL_TRIAGE_PROTOCOLS = [
  {
    id: "TRIAGE-CARDIO-RED",
    chiefComplaint: "Acute Central Chest Pain, Radiation to Jaw/Left Arm, Diaphoresis, Dyspnea",
    triageLevel: "ESI Level 1 (Resuscitation)",
    triageColor: "#dc2626",
    acuityTag: "CRITICAL RED FLAG",
    suspectedCondition: "Acute Coronary Syndrome (STEMI / NSTEMI)",
    targetDepartment: "Emergency Cardiology & Cath Lab",
    targetTreatment: "Emergency Angiography & Primary PCI",
    timeWindow: "Door-to-Balloon Goal < 60 minutes",
    immediateFirstAid: [
      "Keep patient in comfortable sitting position with back supported.",
      "Administer Chewable Aspirin 300mg immediately (if no known allergy / active bleeding).",
      "Do NOT allow patient to walk or exert physically.",
      "Initiate immediate 108 Emergency ALS Ambulance dispatch with Defibrillator."
    ],
    costRange: "Govt (PM-JAY/CGHS): 100% Cashless • Private: ₹1,10,000 - ₹1,65,000"
  },
  {
    id: "TRIAGE-NEURO-RED",
    chiefComplaint: "Sudden Facial Asymmetry, Arm Weakness, Slurred Speech (FAST Protocol)",
    triageLevel: "ESI Level 1 (Resuscitation)",
    triageColor: "#dc2626",
    acuityTag: "CRITICAL RED FLAG",
    suspectedCondition: "Acute Ischemic Stroke / Cerebrovascular Accident",
    targetDepartment: "Emergency Neurology & Comprehensive Stroke Center",
    targetTreatment: "Immediate Non-Contrast Brain CT + IV Thrombolysis (rtPA)",
    timeWindow: "Golden Window: Within 4.5 Hours of Symptom Onset",
    immediateFirstAid: [
      "Note exact time when patient was last seen normal.",
      "Keep patient lying flat with head elevated at 30 degrees.",
      "Do NOT give oral food, water, or blood pressure lowering pills.",
      "Ensure priority green corridor transport to nearest Stroke-ready hospital."
    ],
    costRange: "Govt: 100% Cashless Under PM-JAY • Private: ₹65,000 - ₹1,40,000"
  },
  {
    id: "TRIAGE-TRAUMA-YELLOW",
    chiefComplaint: "Severe Right Lower Quadrant Abdominal Rebound Tenderness, Low Grade Fever, Vomiting",
    triageLevel: "ESI Level 2 (Emergent)",
    triageColor: "#d97706",
    acuityTag: "HIGH URGENCY",
    suspectedCondition: "Acute Appendicitis with Peritoneal Irritation",
    targetDepartment: "Emergency General Surgery",
    targetTreatment: "Emergency Laparoscopic Appendectomy",
    timeWindow: "Urgent surgical evaluation within 2 hours",
    immediateFirstAid: [
      "Maintain strictly Nil by Mouth (NPO - no food or liquids).",
      "Avoid strong analgesics or heat pads on abdomen before surgeon review.",
      "Proceed to emergency triage registration."
    ],
    costRange: "Govt: Subsidized ₹2,500 / Free under PM-JAY • Private: ₹38,000 - ₹55,000"
  },
  {
    id: "TRIAGE-RESP-YELLOW",
    chiefComplaint: "Acute Exacerbation of Asthma, Wheezing, SpO2 < 92%, Stridor",
    triageLevel: "ESI Level 2 (Emergent)",
    triageColor: "#d97706",
    acuityTag: "HIGH URGENCY",
    suspectedCondition: "Severe Bronchospasm / COPD Exacerbation",
    targetDepartment: "Pulmonology & Respiratory Care",
    targetTreatment: "Nebulized Bronchodilators & Controlled Oxygen Therapy",
    timeWindow: "Immediate Nebulization in Casualty",
    immediateFirstAid: [
      "Sit upright in high Fowler's position.",
      "Administer 4-6 puffs of Salbutamol inhaler with spacer immediately.",
      "Loosen tight clothing around neck and chest."
    ],
    costRange: "Govt: Free Emergency Care • Private: ₹8,000 - ₹22,000"
  },
  {
    id: "TRIAGE-ORTHO-GREEN",
    chiefComplaint: "Chronic Bilateral Knee Joint Pain, Stiffness on Rising, Crepitus without Trauma",
    triageLevel: "ESI Level 4 (Non-Urgent Routine)",
    triageColor: "#059669",
    acuityTag: "ROUTINE OPD",
    suspectedCondition: "Grade 3-4 Osteoarthritis of Knee Joint",
    targetDepartment: "Orthopedic Surgery & Joint Replacement OPD",
    targetTreatment: "Total Knee Arthroplasty (TKR) / Joint Injections",
    timeWindow: "Elective OPD Consultation Slot",
    immediateFirstAid: [
      "Apply ice pack for 15 mins for active flare-up.",
      "Use supportive knee brace when mobilizing.",
      "Book scheduled specialist consultation slot."
    ],
    costRange: "Govt: Subsidized ₹55,000 (Implant Capped) • Private: ₹1,45,000 - ₹1,95,000"
  }
];

export const INITIAL_BOOKINGS = [
  {
    id: "BK-9021",
    patientName: "Rahul Sharma",
    patientPhone: "+91 98123 45678",
    hospitalId: "hosp-gov-1",
    hospitalName: "AIIMS New Delhi",
    ambulanceType: "Govt ALS Ventilator Ambulance",
    pickupLocation: "H.No 45, Shastri Nagar, Meerut",
    dropLocation: "AIIMS Apex Trauma Center, Ansari Nagar, New Delhi",
    status: "En Route to Patient",
    etaMins: 7,
    fare: 0,
    vehicleNo: "DL 01 EM 1081",
    paramedic: "EMT Suresh Rawat",
    driver: "Satish Chand",
    timestamp: "2026-07-26 21:40"
  }
];

export const SAMPLE_HEALTH_RECORDS = [
  {
    id: "REC-101",
    date: "2026-06-12",
    title: "Complete Blood Count & Cardiac Lipid Profile",
    hospital: "AIIMS New Delhi",
    doctor: "Dr. Randeep Guleria",
    type: "Govt Diagnostic Report",
    summary: "Hemoglobin 14.2 g/dL (Normal). Cholesterol 195 mg/dL (Desirable). ABDM Health Locker ID: M492-DEL-9912.",
    fileRef: "report_aiims_cbc.pdf"
  },
  {
    id: "REC-102",
    date: "2026-05-04",
    title: "Comprehensive 12-Lead ECG & 2D Echo",
    hospital: "Safdarjung Hospital & VMMC",
    doctor: "Dr. B. L. Sherwal",
    type: "Cardiology Imaging",
    summary: "Sinus Rhythm with LVEF 62%. Normal left ventricular systolic function. No regional wall motion abnormality.",
    fileRef: "scan_sjh_echo.pdf"
  }
];

export const SYMPTOM_DATABASE = [
  {
    symptom: "Severe lower right abdominal pain, nausea, fever",
    suggestedDepartment: "General Surgery",
    suggestedTreatment: "Emergency Laparoscopic Appendectomy",
    urgency: "High",
    estimatedCostRange: "Govt: ₹2,500 | Private: ₹38,000 - ₹55,000"
  },
  {
    symptom: "Chest tightness, pain radiating to left arm, breathlessness",
    suggestedDepartment: "Cardiology & Cath Lab",
    suggestedTreatment: "Primary Coronary Angioplasty (PCI)",
    urgency: "Critical (Emergency SOS Required)",
    estimatedCostRange: "Govt: Cashless Under PM-JAY | Private: ₹1,10,000 - ₹1,65,000"
  }
];

export const DISEASE_DATABASE = [
  {
    disease: "Common Viral Coryza / Cold",
    symptoms: ["runny nose", "sneezing", "sore throat", "cough"],
    department: "General Medicine",
    severity: "Low",
    specialist: "Consultant Physician"
  },
  {
    disease: "Viral Influenza",
    symptoms: ["fever", "body pain", "cough", "fatigue"],
    department: "General Medicine",
    severity: "Moderate",
    specialist: "Internal Medicine Specialist"
  },
  {
    disease: "Dengue Fever with Thrombocytopenia",
    symptoms: ["fever", "body pain", "headache", "rash", "fever headache rash"],
    department: "Infectious Diseases & Emergency",
    severity: "High (Platelet Monitoring)",
    specialist: "Critical Care Physician"
  },
  {
    disease: "Plasmodium Vivax / Falciparum Malaria",
    symptoms: ["fever", "chills", "sweating", "fever chills sweating"],
    department: "General Medicine",
    severity: "High",
    specialist: "Infectious Disease Specialist"
  },
  {
    disease: "Enteric Fever / Typhoid",
    symptoms: ["high fever", "abdominal pain", "weakness", "high fever abdominal pain weakness"],
    department: "General Medicine",
    severity: "High",
    specialist: "Internal Medicine Physician"
  },
  {
    disease: "Diabetes Mellitus Type 2",
    symptoms: ["frequent urination", "increased thirst", "fatigue", "frequent urination increased thirst"],
    department: "Endocrinology & Diabetology",
    severity: "Moderate",
    specialist: "Endocrinologist"
  },
  {
    disease: "Systemic Hypertension",
    symptoms: ["headache", "dizziness", "blurred vision", "headache dizziness blurred vision"],
    department: "Cardiology",
    severity: "Moderate",
    specialist: "Cardiologist"
  },
  {
    disease: "Bronchial Asthma Acute Attack",
    symptoms: ["shortness of breath", "wheezing", "chest tightness", "shortness of breath wheezing"],
    department: "Pulmonology & Respiratory Care",
    severity: "High",
    specialist: "Pulmonologist"
  },
  {
    disease: "Neurological Migraine Cephalea",
    symptoms: ["headache", "nausea", "light sensitivity", "headache nausea light sensitivity"],
    department: "Neurology",
    severity: "Moderate",
    specialist: "Neurologist"
  },
  {
    disease: "Nephrolithiasis / Renal Calculus",
    symptoms: ["severe back pain", "painful urination", "blood in urine", "severe back pain painful urination"],
    department: "Urology",
    severity: "High",
    specialist: "Urologist"
  }
];
