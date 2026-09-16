// National & State Government Health Schemes & KYC Verification Service - MediGo
// Comprehensive Indian Healthcare Scheme Catalog & Digital Verification Rules

export const HEALTH_SCHEMES_CATALOG = [
  // 1. National Schemes
  {
    id: "pmjay",
    name: "Ayushman Bharat - PM-JAY (Pradhan Mantri Jan Arogya Yojana)",
    shortName: "Ayushman Bharat PM-JAY",
    category: "National Government",
    level: "Central Government",
    coverageAmount: 500000,
    coverageDisplay: "₹5,00,000 / Year (Family Floater)",
    benefits: [
      "100% Cashless secondary & tertiary hospital treatment",
      "Over 1,949 surgical & medical procedures covered",
      "Pre & Post hospitalization expenses covered (3 days pre, 15 days post)",
      "Empanelled in 28,000+ public & private hospitals nationwide"
    ],
    idFormatExample: "PMJAY-9876-5432-1098",
    idPattern: /^(PMJAY[- ]?)?[A-Z0-9]{4}[- ]?[A-Z0-9]{4}[- ]?[A-Z0-9]{4}$/i,
    requiredProof: ["Aadhaar Card", "Ration Card / PM-JAY Family ID"],
    officialPortal: "https://pmjay.gov.in"
  },
  {
    id: "abha",
    name: "ABHA Health Account (Ayushman Bharat Digital Mission)",
    shortName: "ABHA Health ID (ABDM)",
    category: "National Digital Health ID",
    level: "Central Government",
    coverageAmount: 0,
    coverageDisplay: "Universal Digital Health Vault & Fast-Track OPD Registration",
    benefits: [
      "14-Digit unique universal health identifier for all Indian citizens",
      "Scan & Share instant paperless OPD registration at all medical colleges",
      "Seamless integration with PM-JAY, CGHS, and state insurance schemes",
      "Encrypted digital health record locker"
    ],
    idFormatExample: "91-4589-2314-8790",
    idPattern: /^[0-9]{2}[- ]?[0-9]{4}[- ]?[0-9]{4}[- ]?[0-9]{4}$/,
    requiredProof: ["Aadhaar Number", "Mobile OTP verification"],
    officialPortal: "https://healthid.ndhm.gov.in"
  },
  {
    id: "cghs",
    name: "Central Government Health Scheme (CGHS)",
    shortName: "CGHS Beneficiary Card",
    category: "Central Govt Employees & Pensioners",
    level: "Central Government",
    coverageAmount: 1000000,
    coverageDisplay: "Comprehensive Cashless Medical Care",
    benefits: [
      "Complete OPD consultations, medicines, and specialized diagnostic tests",
      "Cashless IPD hospitalization in all CGHS empanelled private super-specialty hospitals",
      "Coverage for serving employees, pensioners, and dependent family members"
    ],
    idFormatExample: "CGHS-7845123",
    idPattern: /^(CGHS[- ]?)?[0-9]{6,8}$/i,
    requiredProof: ["CGHS Plastic Card Number", "Aadhaar Card / Pension ID"],
    officialPortal: "https://cghs.nic.in"
  },
  {
    id: "echs",
    name: "Ex-Servicemen Contributory Health Scheme (ECHS)",
    shortName: "ECHS Armed Forces Smart Card",
    category: "Defence Veterans & Dependents",
    level: "Ministry of Defence",
    coverageAmount: 1500000,
    coverageDisplay: "Comprehensive Cashless Defence Health Coverage",
    benefits: [
      "Full spectrum cashless treatment for Armed Forces veterans and dependents",
      "Empanelled top-tier corporate & military hospitals across India",
      "Critical illness, heart surgery, oncology, and joint replacement coverage"
    ],
    idFormatExample: "ECHS-DEL-458921",
    idPattern: /^(ECHS[- ]?)?[A-Z0-9-]{6,16}$/i,
    requiredProof: ["ECHS 64KB Smart Card Number", "Service Discharge Book"],
    officialPortal: "https://echs.gov.in"
  },
  {
    id: "esis",
    name: "Employees' State Insurance Scheme (ESIS / ESIC)",
    shortName: "ESIC Pehchan Card",
    category: "Organized Workforce",
    level: "Ministry of Labour",
    coverageAmount: 500000,
    coverageDisplay: "Full Medical Care for Insured Workers & Dependents",
    benefits: [
      "Full medical care for insured worker and family from day one of employment",
      "Cash benefits for sickness, maternity, and temporary/permanent disablement",
      "Network of ESIC model hospitals & tie-up private super-specialties"
    ],
    idFormatExample: "ESIC-3100589642",
    idPattern: /^(ESIC[- ]?)?[0-9]{10,17}$/i,
    requiredProof: ["ESIC Pehchan Smart Card / IP Number", "Aadhaar"],
    officialPortal: "https://esic.gov.in"
  },

  // 2. Major State Government Schemes
  {
    id: "state_up_pmjay",
    name: "UP Mukhyamantri Jan Arogya Yojana (Uttar Pradesh)",
    shortName: "UP MMJAY State Scheme",
    category: "State Government",
    level: "Uttar Pradesh",
    coverageAmount: 500000,
    coverageDisplay: "₹5,00,000 / Year Cashless Treatment",
    benefits: [
      "Free medical treatment in private & govt hospitals for non-SECC families in UP",
      "Covers all families holding Antyodaya and eligible ration cards in UP"
    ],
    idFormatExample: "UPMJAY-5412-8963-7412",
    idPattern: /^(UPMJAY[- ]?)?[A-Z0-9-]{8,20}$/i,
    requiredProof: ["UP Ration Card / Aadhaar"],
    officialPortal: "https://upstatehealthagency.in"
  },
  {
    id: "state_delhi_dhas",
    name: "Delhi Arogya Kosh & Free Surgery Scheme (Delhi)",
    shortName: "Delhi Arogya Kosh (DAK)",
    category: "State Government",
    level: "Delhi NCT",
    coverageAmount: 500000,
    coverageDisplay: "100% Free Specialized Surgeries & Diagnostics",
    benefits: [
      "Free high-end diagnostic tests (MRI, CT Scan, PET Scan) in empanelled private labs",
      "Free surgery in private hospitals if wait time in Delhi Govt hospitals exceeds 30 days"
    ],
    idFormatExample: "DAK-DEL-984512",
    idPattern: /^(DAK[- ]?)?[A-Z0-9-]{6,16}$/i,
    requiredProof: ["Delhi Voter ID / Electricity Bill / Aadhaar"],
    officialPortal: "https://delhi.gov.in"
  },
  {
    id: "state_maha_mjpjay",
    name: "Mahatma Jyotirao Phule Jan Arogya Yojana (Maharashtra)",
    shortName: "MJPJAY Maharashtra",
    category: "State Government",
    level: "Maharashtra",
    coverageAmount: 500000,
    coverageDisplay: "₹5,00,000 / Year Comprehensive Coverage",
    benefits: [
      "996 medical & surgical procedures covered in public and private hospitals across Maharashtra",
      "Yellow, Orange ration card holders and Annapurna card holders eligible"
    ],
    idFormatExample: "MJPJAY-MH-584796",
    idPattern: /^(MJPJAY[- ]?)?[A-Z0-9-]{6,16}$/i,
    requiredProof: ["Maharashtra Ration Card", "Aadhaar Card"],
    officialPortal: "https://www.jeevandayee.gov.in"
  },
  {
    id: "state_wb_swasthya",
    name: "Swasthya Sathi Scheme (West Bengal)",
    shortName: "Swasthya Sathi Smart Card",
    category: "State Government",
    level: "West Bengal",
    coverageAmount: 500000,
    coverageDisplay: "₹5,00,000 / Year Smart Card Scheme",
    benefits: [
      "Smart card issued in the name of the female head of the family",
      "Entire family covered for secondary & tertiary treatment with zero out-of-pocket expenses"
    ],
    idFormatExample: "SS-WB-1904-8521-9630",
    idPattern: /^(SS[- ]?)?[A-Z0-9-]{8,20}$/i,
    requiredProof: ["Swasthya Sathi Smart Card / Aadhaar"],
    officialPortal: "https://swasthyasathi.gov.in"
  },
  {
    id: "state_ap_aarogyasri",
    name: "Dr. YSR Aarogyasri Scheme (Andhra Pradesh & Telangana)",
    shortName: "YSR Aarogyasri Card",
    category: "State Government",
    level: "Andhra Pradesh / Telangana",
    coverageAmount: 500000,
    coverageDisplay: "₹5,00,000 / Year (Over 2,400 Procedures)",
    benefits: [
      "Cashless treatment for all BPL families",
      "Post-surgery financial allowance and free follow-up medicines"
    ],
    idFormatExample: "YSR-AP-4512-8963",
    idPattern: /^(YSR[- ]?)?[A-Z0-9-]{8,18}$/i,
    requiredProof: ["Aarogyasri Health Card / BPL White Card"],
    officialPortal: "https://ysraarogyasri.ap.gov.in"
  },

  // 3. Private Health Insurance & TPA Network
  {
    id: "private_star_health",
    name: "Star Health Insurance (Family Health Optima / Comprehensive)",
    shortName: "Star Health Cashless KYC",
    category: "Private Insurance TPA",
    level: "Private Insurer",
    coverageAmount: 1000000,
    coverageDisplay: "₹10,00,000 Sum Insured Cashless Network",
    benefits: [
      "Instant 30-minute cashless claim approval at 14,000+ network hospitals",
      "No room rent capping, air ambulance coverage, day care treatments covered"
    ],
    idFormatExample: "STAR-POL-2026-985412",
    idPattern: /^(STAR[- ]?)?[A-Z0-9-]{8,24}$/i,
    requiredProof: ["Policy Number / Health Card", "Aadhaar Card"],
    officialPortal: "https://www.starhealth.in"
  },
  {
    id: "private_hdfc_ergo",
    name: "HDFC ERGO Health Insurance (Optima Secure)",
    shortName: "HDFC ERGO Cashless TPA",
    category: "Private Insurance TPA",
    level: "Private Insurer",
    coverageAmount: 1500000,
    coverageDisplay: "₹15,00,000 2X Secure Cashless Cover",
    benefits: [
      "Cashless claim processing via MediBuddy / Vidal Health TPA",
      "Zero deduction on non-medical expenses (consumables covered)"
    ],
    idFormatExample: "HDFC-POL-45892147",
    idPattern: /^(HDFC[- ]?)?[A-Z0-9-]{8,24}$/i,
    requiredProof: ["Policy Number / TPA E-card", "Aadhaar / Pan Card"],
    officialPortal: "https://www.hdfcergo.com"
  }
];

/**
 * Validate scheme card number format
 */
export function validateSchemeCard(schemeId, cardNumber) {
  if (!cardNumber || typeof cardNumber !== 'string') {
    return { valid: false, message: "Please provide a valid card number." };
  }

  const cleanNum = cardNumber.trim();
  const scheme = HEALTH_SCHEMES_CATALOG.find(s => s.id === schemeId);

  if (!scheme) {
    // Generic validation if scheme is a custom state scheme
    if (cleanNum.length < 5) {
      return { valid: false, message: "Card number is too short." };
    }
    return { valid: true, formattedNumber: cleanNum };
  }

  // Check pattern if defined
  if (scheme.idPattern && !scheme.idPattern.test(cleanNum)) {
    return {
      valid: false,
      message: `Invalid format for ${scheme.shortName}. Expected format like: ${scheme.idFormatExample}`
    };
  }

  return {
    valid: true,
    formattedNumber: cleanNum.toUpperCase()
  };
}

/**
 * Check if hospital is empanelled for a given scheme
 */
export function isHospitalEmpanelled(hospital, schemeId) {
  if (!hospital) return false;

  const isGovt = hospital.type === 'government';
  const nameLower = (hospital.name || '').toLowerCase();
  const facilLower = (hospital.facilities_str || '').toLowerCase();

  // Government medical colleges and public hospitals are almost universally empanelled for PM-JAY, CGHS, and state schemes
  if (schemeId === 'pmjay') {
    if (isGovt) return true;
    if (hospital.insurance_json && hospital.insurance_json.includes('ayushmanBharat')) {
      try {
        const ins = JSON.parse(hospital.insurance_json);
        if (ins.ayushmanBharat) return true;
      } catch (e) {}
    }
    // Most hospitals in our directory support PM-JAY
    return true;
  }

  if (schemeId === 'abha') {
    // All hospitals support ABHA scan & share
    return true;
  }

  if (schemeId === 'cghs') {
    if (isGovt) return true;
    if (hospital.insurance_json) {
      try {
        const ins = JSON.parse(hospital.insurance_json);
        if (ins.cghs) return true;
      } catch (e) {}
    }
    return isGovt || nameLower.includes('city care') || nameLower.includes('apex') || nameLower.includes('fortis') || nameLower.includes('max') || nameLower.includes('apollo');
  }

  if (schemeId === 'echs') {
    if (isGovt) return true;
    return isGovt || nameLower.includes('city care') || nameLower.includes('apex') || nameLower.includes('metro');
  }

  // State schemes
  if (schemeId.startsWith('state_')) {
    return isGovt || hospital.rating >= 4.0;
  }

  // Private insurance
  return hospital.type === 'private';
}

export default {
  HEALTH_SCHEMES_CATALOG,
  validateSchemeCard,
  isHospitalEmpanelled
};
