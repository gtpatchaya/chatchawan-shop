require('dotenv').config();
const app = require('./src/app');
const config = require('./src/config');
const settings = require('./src/lib/settings');

// โหลดตั้งค่าร้านจาก DB ก่อน (ถ้าล้มเหลวก็ยังเปิดเซิร์ฟเวอร์ด้วยค่าจาก .env)
settings.load().finally(() => {
  app.listen(config.port, () => {
    console.log(`${config.shop.name} พร้อมใช้งานที่ http://localhost:${config.port}`);
  });
});
