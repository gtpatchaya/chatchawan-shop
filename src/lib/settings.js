// ตั้งค่าร้านที่แก้ได้จากหลังบ้าน โหลดจากฐานข้อมูลแล้ว cache ไว้ในหน่วยความจำ
// ค่าใน DB จะทับค่าเริ่มต้นจาก .env (config.shop) เสมอเมื่อมีการบันทึกแล้ว
const db = require('./db');
const config = require('../config');

// map: ฟิลด์ที่ view ใช้ -> key ในตาราง settings
const KEYS = {
  name: 'shop_name',
  tagline: 'shop_tagline',
  phone: 'shop_phone',
  lineId: 'shop_line_id',
  facebookUrl: 'shop_facebook_url',
  address: 'shop_address',
  mapUrl: 'shop_map_url',
  openHours: 'shop_open_hours',
  heroImageUrl: 'hero_image_url',
  heroImagePath: 'hero_image_path',
};

function defaults() {
  return {
    ...config.shop, // name, tagline, phone, lineId, facebookUrl, address, mapUrl, openHours
    heroImageUrl: '',
    heroImagePath: '',
  };
}

let cache = null;
let loading = null;

async function load() {
  try {
    const rows = await db.getSettings();
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const merged = defaults();
    // มี row ใน DB (แม้ค่าว่าง) = ให้ DB เป็นตัวตัดสิน, ไม่มี row = ใช้ค่าจาก .env
    for (const [field, key] of Object.entries(KEYS)) {
      if (Object.prototype.hasOwnProperty.call(map, key)) merged[field] = map[key];
    }
    cache = merged;
  } catch (err) {
    console.error('โหลดการตั้งค่าร้านไม่สำเร็จ:', err.message);
    if (!cache) cache = defaults();
  }
  return cache;
}

// โหลด cache ครั้งเดียว (ใช้บน serverless เช่น Vercel ที่ไม่ได้เรียก load() ตอนสตาร์ท)
function ensureLoaded() {
  if (cache) return Promise.resolve(cache);
  if (!loading) loading = load().finally(() => { loading = null; });
  return loading;
}

function get() {
  return cache || defaults();
}

module.exports = { load, ensureLoaded, get, KEYS };
