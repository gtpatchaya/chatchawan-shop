const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieSession = require('cookie-session');
const config = require('./config');
const format = require('./lib/format');
const settings = require('./lib/settings');
const { icon } = require('./lib/icons');

const app = express();
const root = path.join(__dirname, '..');

app.set('view engine', 'ejs');
app.set('views', path.join(root, 'views'));
app.set('trust proxy', 1);
app.disable('x-powered-by');

const supabaseOrigin = config.supabase.url ? new URL(config.supabase.url).origin : '';

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:', supabaseOrigin].filter(Boolean),
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        scriptSrc: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: config.isProd ? [] : null,
      },
    },
    // no-referrer (ค่าเริ่มต้น) ทำให้เบราว์เซอร์ส่ง Origin: null ตอนส่งฟอร์ม ซึ่งจะไม่ผ่านการตรวจ same-origin ของหลังบ้าน
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }),
);

app.use(express.static(path.join(root, 'public'), { maxAge: config.isProd ? '7d' : 0 }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

if (!config.admin.sessionSecret && config.isProd) {
  throw new Error('กรุณาตั้งค่า SESSION_SECRET ในไฟล์ .env');
}

app.use(
  cookieSession({
    name: 'ccg_session',
    secret: config.admin.sessionSecret || 'dev-only-secret',
    httpOnly: true,
    sameSite: 'strict',
    secure: config.isProd,
    maxAge: 1000 * 60 * 60 * 12,
  }),
);

// ค่าที่ทุกหน้าใช้ร่วมกัน
app.use((req, res, next) => {
  res.locals.shop = settings.get();
  res.locals.fmt = format;
  res.locals.icon = icon;
  res.locals.currentPath = req.path;
  res.locals.isAdmin = Boolean(req.session && req.session.isAdmin);
  res.locals.flash = req.session.flash || null;
  if (req.session.flash) req.session.flash = null;
  next();
});

app.use('/admin', require('./routes/admin'));
app.use('/', require('./routes/public'));

app.use((req, res) => {
  res.status(404).render('error', { title: 'ไม่พบหน้าที่ต้องการ', code: 404, message: 'หน้าที่คุณค้นหาอาจถูกลบหรือย้ายไปแล้ว' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  const message =
    err.code === 'LIMIT_FILE_SIZE'
      ? 'ไฟล์รูปใหญ่เกินไป (สูงสุด 10MB ต่อรูป)'
      : config.isProd
        ? 'ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง'
        : err.message;
  res.status(err.status || 500).render('error', { title: 'เกิดข้อผิดพลาด', code: err.status || 500, message });
});

module.exports = app;
