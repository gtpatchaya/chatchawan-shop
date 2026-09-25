// Serverless entry สำหรับ Vercel — ใช้ Express app เดิมโดยไม่เรียก listen()
// (ฝั่ง local / โฮสต์ที่รัน server ค้างได้ ใช้ server.js ตามปกติ)
require('dotenv').config();
module.exports = require('../src/app');
