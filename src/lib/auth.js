const crypto = require('crypto');
const config = require('../config');

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function checkPassword(input) {
  return Boolean(config.admin.password) && safeEqual(input, config.admin.password);
}

// จำกัดการเดารหัสผ่าน: 5 ครั้ง / 15 นาที ต่อ IP
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function isLocked(ip) {
  const entry = attempts.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) {
    attempts.delete(ip);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(ip) {
  const entry = attempts.get(ip);
  if (!entry || Date.now() - entry.first > WINDOW_MS) attempts.set(ip, { count: 1, first: Date.now() });
  else entry.count += 1;
}

function clearFailures(ip) {
  attempts.delete(ip);
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect(`/admin/login?next=${encodeURIComponent(req.originalUrl)}`);
}

// ป้องกันการส่งฟอร์มจากเว็บอื่น (CSRF) นอกเหนือจาก cookie แบบ SameSite=strict
function sameOrigin(req, res, next) {
  if (req.method !== 'POST') return next();
  const origin = req.get('origin') || req.get('referer');
  if (!origin) return next();
  try {
    if (new URL(origin).host === req.get('host')) return next();
  } catch {
    /* ตกไปด้านล่าง */
  }
  return res.status(403).send('Forbidden');
}

module.exports = { checkPassword, isLocked, recordFailure, clearFailures, requireAdmin, sameOrigin };
