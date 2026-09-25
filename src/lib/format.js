const CONDITIONS = {
  like_new: 'สภาพเหมือนใหม่',
  good: 'สภาพดี',
  fair: 'สภาพพอใช้',
  for_parts: 'ขายเป็นอะไหล่ / ซาก',
};

const STATUSES = {
  available: 'พร้อมขาย',
  reserved: 'ติดจอง',
  sold: 'ขายแล้ว',
};

const priceFormatter = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 });

function formatPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 'สอบถามราคา';
  return `฿${priceFormatter.format(n)}`;
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function phoneHref(phone) {
  return `tel:${String(phone || '').replace(/[^\d+]/g, '')}`;
}

function lineHref(lineId) {
  const id = String(lineId || '').trim();
  if (!id) return '';
  return id.startsWith('@')
    ? `https://line.me/R/ti/p/${encodeURIComponent(id)}`
    : `https://line.me/ti/p/~${encodeURIComponent(id)}`;
}

function slugify(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

module.exports = { CONDITIONS, STATUSES, formatPrice, formatDate, phoneHref, lineHref, slugify };
