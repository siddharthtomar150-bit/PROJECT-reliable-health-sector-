// Production-Grade Security & Anti-Hacking Middleware for MediGo Platform
// Implements Rate Limiting, File Exfiltration Guard, XSS Sanitization, Input Validation, and PIN Brute-Force Lockout

import crypto from 'crypto';

// ==========================================================================
// 1. SENSITIVE FILE ACCESS GUARD (Blocks Database & Source Code Exfiltration)
// ==========================================================================

const BLOCKED_EXTENSIONS = [
  '.db', '.sqlite', '.sqlite3', '.env', '.json',
  '.lock', '.log', '.key', '.pem', '.cer', '.crt',
  '.sql', '.py', '.sh', '.bat', '.ps1', '.bak'
];

const BLOCKED_SPECIFIC_FILES = [
  'server.js',
  'database.js',
  'security_crypto.js',
  'security_middleware.js',
  'package.json',
  'package-lock.json',
  'hospital_finder.db',
  'hospital_finder.db-journal',
  'hospital_finder.db-wal',
  'hospital_finder.db-shm'
];

export function fileAccessGuard(req, res, next) {
  const urlPath = decodeURIComponent(req.path.toLowerCase().replace(/\\/g, '/'));

  // 1. Block directory traversal attempts
  if (urlPath.includes('..') || urlPath.includes('//') || urlPath.includes('%2e%2e')) {
    console.warn(`🚨 [SECURITY ALERT] Directory traversal blocked from ${req.ip}: ${req.path}`);
    return res.status(403).json({ error: 'Access Denied: Path traversal prohibited.' });
  }

  // 2. Block hidden files (.git, .env, etc.)
  if (urlPath.split('/').some(part => part.startsWith('.') && part !== '.' && part !== '..')) {
    console.warn(`🚨 [SECURITY ALERT] Hidden file access blocked from ${req.ip}: ${req.path}`);
    return res.status(403).json({ error: 'Access Denied: Hidden system files are restricted.' });
  }

  // 3. Block sensitive extensions (.db, .sqlite, .env, .json, etc.)
  for (const ext of BLOCKED_EXTENSIONS) {
    if (urlPath.endsWith(ext) || urlPath.includes(`${ext}/`) || urlPath.includes(`${ext}?`)) {
      console.warn(`🚨 [SECURITY ALERT] Blocked access to sensitive extension [${ext}] from ${req.ip}: ${req.path}`);
      return res.status(403).json({ error: 'Access Denied: Requested resource is protected.' });
    }
  }

  // 4. Block specific backend server files
  const baseName = urlPath.split('/').pop();
  if (BLOCKED_SPECIFIC_FILES.includes(baseName)) {
    console.warn(`🚨 [SECURITY ALERT] Blocked access to backend source file [${baseName}] from ${req.ip}: ${req.path}`);
    return res.status(403).json({ error: 'Access Denied: Backend source files cannot be retrieved.' });
  }

  next();
}

// ==========================================================================
// 2. IN-MEMORY SLIDING-WINDOW RATE LIMITER (Anti-DDoS & Credential Stuffing)
// ==========================================================================

class RateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60 * 1000; // default 1 minute
    this.max = options.max || 100; // default 100 requests per window
    this.message = options.message || 'Too many requests from this IP, please try again later.';
    this.hits = new Map();

    // Auto-cleanup stale entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.hits.entries()) {
        if (now - record.startTime > this.windowMs) {
          this.hits.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }

  middleware() {
    return (req, res, next) => {
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip || 'unknown';
      const now = Date.now();

      let record = this.hits.get(clientIp);
      if (!record || now - record.startTime > this.windowMs) {
        record = { count: 1, startTime: now };
        this.hits.set(clientIp, record);
      } else {
        record.count++;
      }

      // Append standard rate limit headers
      const remaining = Math.max(0, this.max - record.count);
      const resetTime = Math.ceil((record.startTime + this.windowMs - now) / 1000);
      res.setHeader('X-RateLimit-Limit', this.max);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', resetTime);

      if (record.count > this.max) {
        console.warn(`⚠️ [RATE LIMIT] Client ${clientIp} exceeded limit of ${this.max} requests on ${req.originalUrl}`);
        return res.status(429).json({
          error: this.message,
          retryAfterSeconds: resetTime
        });
      }

      next();
    };
  }
}

export const globalApiLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  max: 300,
  message: 'High traffic detected. Please slow down your requests.'
}).middleware();

export const authLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Too many authentication attempts. Please wait 15 minutes before trying again.'
}).middleware();

// ==========================================================================
// 3. EMERGENCY PIN BRUTE-FORCE LOCKOUT GUARD
// ==========================================================================

const pinAttempts = new Map(); // key: userId -> { failedCount, lockUntil }
const MAX_FAILED_PIN_ATTEMPTS = 5;
const PIN_LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout

export function checkPinLockout(userId) {
  const record = pinAttempts.get(userId);
  if (!record) return { isLocked: false, remainingAttempts: MAX_FAILED_PIN_ATTEMPTS };

  const now = Date.now();
  if (record.lockUntil && now < record.lockUntil) {
    const minutesRemaining = Math.ceil((record.lockUntil - now) / (60 * 1000));
    return {
      isLocked: true,
      minutesRemaining,
      remainingAttempts: 0
    };
  }

  if (record.lockUntil && now >= record.lockUntil) {
    // Lockout expired, reset counter
    pinAttempts.delete(userId);
    return { isLocked: false, remainingAttempts: MAX_FAILED_PIN_ATTEMPTS };
  }

  const remainingAttempts = Math.max(0, MAX_FAILED_PIN_ATTEMPTS - record.failedCount);
  return { isLocked: false, remainingAttempts };
}

export function recordPinFailure(userId) {
  let record = pinAttempts.get(userId);
  if (!record) {
    record = { failedCount: 1, lockUntil: null };
    pinAttempts.set(userId, record);
  } else {
    record.failedCount++;
  }

  if (record.failedCount >= MAX_FAILED_PIN_ATTEMPTS) {
    record.lockUntil = Date.now() + PIN_LOCKOUT_DURATION_MS;
    return { isLocked: true, minutesRemaining: 15, remainingAttempts: 0 };
  }

  return { isLocked: false, remainingAttempts: MAX_FAILED_PIN_ATTEMPTS - record.failedCount };
}

export function clearPinFailures(userId) {
  pinAttempts.delete(userId);
}

// ==========================================================================
// 4. XSS & HTML SANITIZATION UTILITIES
// ==========================================================================

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function sanitizeInput(value) {
  if (typeof value === 'string') {
    // Strip script tags and event handlers
    return value
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+\s*=\s*(['"]).*?\1/gi, '')
      .replace(/javascript:\s*/gi, '')
      .trim();
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeInput);
  }
  if (typeof value === 'object' && value !== null) {
    const clean = {};
    for (const [k, v] of Object.entries(value)) {
      // Prevent Prototype Pollution
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      clean[k] = sanitizeInput(v);
    }
    return clean;
  }
  return value;
}

export function xssSanitizerMiddleware(req, res, next) {
  if (req.body) {
    req.body = sanitizeInput(req.body);
  }
  if (req.query) {
    req.query = sanitizeInput(req.query);
  }
  if (req.params) {
    req.params = sanitizeInput(req.params);
  }
  next();
}

// ==========================================================================
// 5. INPUT VALIDATION HELPERS (Password Strength, Email, Numeric Bounds)
// ==========================================================================

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return EMAIL_REGEX.test(email.trim()) && email.length <= 120;
}

export function validatePassword(password) {
  if (!password || typeof password !== 'string') return { valid: false, message: 'Password is required.' };
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long.' };
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain both letters and numbers for security.' };
  }
  return { valid: true };
}

export function sanitizeNonNegativeInt(val, fallback = 0, max = 50000) {
  const num = parseInt(val, 10);
  if (isNaN(num) || num < 0) return fallback;
  return Math.min(num, max);
}

// ==========================================================================
// 6. ENHANCED HTTP SECURITY HEADERS (CSP, HSTS, No-Sniff, Frame-Guard)
// ==========================================================================

export function hardenedSecurityHeaders(req, res, next) {
  // Hide Express fingerprint
  res.removeHeader('X-Powered-By');

  // Strict MIME type sniffing protection
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Anti-Clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // Legacy XSS filter activation
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Cross-Origin policies
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

  // Granular Browser Permissions policy
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), payment=(), usb=(), geolocation=(self)');

  // Comprehensive Content Security Policy (CSP)
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https://*.tile.openstreetmap.org https://api.openrouteservice.org",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  );

  next();
}

export default {
  fileAccessGuard,
  globalApiLimiter,
  authLimiter,
  checkPinLockout,
  recordPinFailure,
  clearPinFailures,
  escapeHtml,
  sanitizeInput,
  xssSanitizerMiddleware,
  validateEmail,
  validatePassword,
  sanitizeNonNegativeInt,
  hardenedSecurityHeaders
};
