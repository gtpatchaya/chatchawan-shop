// สั่งให้ Facebook ดึงข้อมูลแชร์ (รูป/ชื่อ) ของลิงก์ใหม่ทันที แทนการรอ cache ของ Facebook หมดอายุ
// ใช้ได้เมื่อตั้งค่า FACEBOOK_APP_ID และ FACEBOOK_APP_SECRET (สร้าง app ฟรีที่ developers.facebook.com)
// ถ้าไม่ได้ตั้งค่าไว้จะข้ามไปเงียบๆ ไม่กระทบการทำงานอื่น
const config = require('../config');

async function rescrape(urls) {
  const { appId, appSecret } = config.facebook;
  if (!appId || !appSecret) return;
  const token = `${appId}|${appSecret}`;
  await Promise.all(
    [...new Set(urls.filter(Boolean))].map(async (url) => {
      try {
        const body = new URLSearchParams({ id: url, scrape: 'true', access_token: token });
        const res = await fetch('https://graph.facebook.com/', {
          method: 'POST',
          body,
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) console.error(`Facebook re-scrape ${url} ไม่สำเร็จ: HTTP ${res.status}`);
      } catch (err) {
        console.error(`Facebook re-scrape ${url} ไม่สำเร็จ: ${err.message}`);
      }
    }),
  );
}

module.exports = { rescrape };
