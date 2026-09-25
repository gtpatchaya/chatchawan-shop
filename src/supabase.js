const { createClient } = require('@supabase/supabase-js');
const config = require('./config');

let client = null;

function supabase() {
  if (!client) {
    if (!config.supabase.url || !config.supabase.serviceKey) {
      throw new Error('ยังไม่ได้ตั้งค่า SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY ในไฟล์ .env');
    }
    client = createClient(config.supabase.url, config.supabase.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

module.exports = { supabase };
