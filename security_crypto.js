// Patient Data Privacy & Cryptography Engine - MediGo
// Implements AES-256-GCM Field-Level Encryption, SHA-256 Checksums, and Data Masking

import crypto from 'crypto';

// Master Vault Encryption Key (32 bytes = 256 bits)
// In production, load from process.env.PATIENT_DATA_ENCRYPTION_KEY
const ENCRYPTION_SECRET = process.env.PATIENT_DATA_ENCRYPTION_KEY || 'medigo_patient_vault_aes_256_key_2026_secure!';
const MASTER_KEY = crypto.createHash('sha256').update(String(ENCRYPTION_SECRET)).digest();

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt a plaintext string using AES-256-GCM
 * Output format: enc:<iv_hex>:<auth_tag_hex>:<ciphertext_hex>
 */
export function encryptField(plaintext) {
  if (plaintext === null || plaintext === undefined || plaintext === '') {
    return plaintext;
  }
  
  // If already encrypted, avoid double encryption
  if (typeof plaintext === 'string' && plaintext.startsWith('enc:')) {
    return plaintext;
  }

  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, MASTER_KEY, iv);
    
    let encrypted = cipher.update(String(plaintext), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return `enc:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (err) {
    console.error('Encryption error:', err);
    return plaintext;
  }
}

/**
 * Decrypt an AES-256-GCM encrypted string
 */
export function decryptField(ciphertext) {
  if (ciphertext === null || ciphertext === undefined || ciphertext === '') {
    return ciphertext;
  }

  if (typeof ciphertext !== 'string' || !ciphertext.startsWith('enc:')) {
    return ciphertext; // Plain text or unencrypted
  }

  try {
    const parts = ciphertext.split(':');
    if (parts.length !== 4) return ciphertext;

    const iv = Buffer.from(parts[1], 'hex');
    const authTag = Buffer.from(parts[2], 'hex');
    const encryptedText = parts[3];

    const decipher = crypto.createDecipheriv(ALGORITHM, MASTER_KEY, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    console.warn('Decryption failed or invalid key tag, returning fallback/original:', err.message);
    return ciphertext;
  }
}

/**
 * Mask sensitive phone number for privacy display
 * Example: +91 98123 45678 -> +91 98*** **678
 */
export function maskPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return phone || '';
  const clean = phone.trim();
  if (clean.length < 8) return clean;
  const start = clean.slice(0, 6);
  const end = clean.slice(-3);
  return `${start}****${end}`;
}

/**
 * Mask sensitive email address
 * Example: rahul.sharma@medigo.com -> r***a@medigo.com
 */
export function maskEmail(email) {
  if (!email || typeof email !== 'string') return email || '';
  const parts = email.split('@');
  if (parts.length !== 2) return email;
  const name = parts[0];
  if (name.length <= 2) return `${name[0]}*@${parts[1]}`;
  const maskedName = name[0] + '*'.repeat(Math.max(3, name.length - 2)) + name[name.length - 1];
  return `${maskedName}@${parts[1]}`;
}

/**
 * Generate SHA-256 cryptographic checksum for data integrity validation
 */
export function generateChecksum(data) {
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  return crypto.createHash('sha256').update(content).digest('hex');
}

export default {
  encryptField,
  decryptField,
  maskPhoneNumber,
  maskEmail,
  generateChecksum
};
