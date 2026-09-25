const express = require('express');
const multer = require('multer');
const db = require('../lib/db');
const auth = require('../lib/auth');
const { CONDITIONS, STATUSES, slugify } = require('../lib/format');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 12 },
  fileFilter(req, file, cb) {
    cb(null, /^image\/(jpeg|png|webp|gif|heic|heif|avif)$/.test(file.mimetype));
  },
});

router.use(auth.sameOrigin);
router.use((req, res, next) => {
  res.locals.CONDITIONS = CONDITIONS;
  res.locals.STATUSES = STATUSES;
  next();
});

function flash(req, type, text) {
  req.session.flash = { type, text };
}

function safeNext(value) {
  const next = String(value || '');
  return next.startsWith('/admin') && !next.startsWith('//') ? next : '/admin';
}

/* ---------------- เข้าสู่ระบบ ---------------- */

router.get('/login', (req, res) => {
  if (req.session.isAdmin) return res.redirect('/admin');
  res.render('admin/login', { title: 'เข้าสู่ระบบหลังบ้าน', next: safeNext(req.query.next), error: null });
});

router.post('/login', (req, res) => {
  const ip = req.ip;
  const next = safeNext(req.body.next);
  if (auth.isLocked(ip)) {
    return res.status(429).render('admin/login', {
      title: 'เข้าสู่ระบบหลังบ้าน',
      next,
      error: 'ลองผิดหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่',
    });
  }
  if (!auth.checkPassword(req.body.password || '')) {
    auth.recordFailure(ip);
    return res.status(401).render('admin/login', {
      title: 'เข้าสู่ระบบหลังบ้าน',
      next,
      error: 'รหัสผ่านไม่ถูกต้อง',
    });
  }
  auth.clearFailures(ip);
  req.session.isAdmin = true;
  res.redirect(next);
});

router.post('/logout', (req, res) => {
  req.session = null;
  res.redirect('/admin/login');
});

router.use(auth.requireAdmin);

/* ---------------- รายการสินค้า ---------------- */

router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const status = Object.keys(STATUSES).includes(req.query.status) ? req.query.status : '';
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const [result, counts] = await Promise.all([
      db.listProducts({ admin: true, q, status, page, pageSize: 30 }),
      db.countProducts(),
    ]);
    res.render('admin/products', { title: 'จัดการสินค้า', result, counts, q, status, page });
  } catch (err) {
    next(err);
  }
});

/* ---------------- เพิ่ม / แก้ไขสินค้า ---------------- */

function readProductForm(body) {
  const toNumber = (v) => {
    const n = parseFloat(String(v || '').replace(/,/g, ''));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  return {
    title: String(body.title || '').trim().slice(0, 200),
    description: String(body.description || '').trim().slice(0, 5000),
    price: toNumber(body.price) || 0,
    original_price: toNumber(body.original_price),
    category_id: body.category_id || null,
    brand: String(body.brand || '').trim().slice(0, 100),
    compatible: String(body.compatible || '').trim().slice(0, 300),
    part_number: String(body.part_number || '').trim().slice(0, 100),
    condition: Object.keys(CONDITIONS).includes(body.condition) ? body.condition : 'good',
    quantity: Math.max(0, parseInt(body.quantity, 10) || 0),
    status: Object.keys(STATUSES).includes(body.status) ? body.status : 'available',
    is_featured: body.is_featured === 'on',
    is_published: body.is_published === 'on',
  };
}

router.get('/products/new', async (req, res, next) => {
  try {
    res.render('admin/product-form', {
      title: 'เพิ่มสินค้าใหม่',
      product: {
        condition: 'good',
        status: 'available',
        quantity: 1,
        is_published: true,
        images: [],
      },
      categories: await db.listCategories(),
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/products', upload.array('images', 12), async (req, res, next) => {
  const fields = readProductForm(req.body);
  try {
    if (!fields.title) {
      return res.status(400).render('admin/product-form', {
        title: 'เพิ่มสินค้าใหม่',
        product: { ...fields, images: [] },
        categories: await db.listCategories(),
        error: 'กรุณาใส่ชื่อสินค้า',
      });
    }
    const { id } = await db.createProduct(fields);
    await db.addImages(id, req.files);
    flash(req, 'success', 'เพิ่มสินค้าเรียบร้อยแล้ว');
    res.redirect(`/admin/products/${id}/edit`);
  } catch (err) {
    next(err);
  }
});

router.get('/products/:id/edit', async (req, res, next) => {
  try {
    const product = await db.getProduct(req.params.id, { admin: true });
    if (!product) return next();
    res.render('admin/product-form', {
      title: `แก้ไข: ${product.title}`,
      product,
      categories: await db.listCategories(),
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/products/:id', upload.array('images', 12), async (req, res, next) => {
  try {
    const product = await db.getProduct(req.params.id, { admin: true });
    if (!product) return next();
    const fields = readProductForm(req.body);
    if (!fields.title) {
      return res.status(400).render('admin/product-form', {
        title: `แก้ไข: ${product.title}`,
        product: { ...product, ...fields },
        categories: await db.listCategories(),
        error: 'กรุณาใส่ชื่อสินค้า',
      });
    }
    await db.updateProduct(product.id, fields);
    await db.addImages(product.id, req.files);
    flash(req, 'success', 'บันทึกการแก้ไขแล้ว');
    res.redirect(`/admin/products/${product.id}/edit`);
  } catch (err) {
    next(err);
  }
});

router.post('/products/:id/status', async (req, res, next) => {
  try {
    const status = Object.keys(STATUSES).includes(req.body.status) ? req.body.status : null;
    if (status) {
      await db.updateProduct(req.params.id, { status });
      flash(req, 'success', `เปลี่ยนสถานะเป็น "${STATUSES[status]}" แล้ว`);
    }
    res.redirect(safeNext(req.body.back));
  } catch (err) {
    next(err);
  }
});

router.post('/products/:id/delete', async (req, res, next) => {
  try {
    await db.deleteProduct(req.params.id);
    flash(req, 'success', 'ลบสินค้าแล้ว');
    res.redirect('/admin');
  } catch (err) {
    next(err);
  }
});

/* ---------------- รูปภาพ ---------------- */

router.post('/images/:id/delete', async (req, res, next) => {
  try {
    const image = await db.deleteImage(req.params.id);
    flash(req, 'success', 'ลบรูปแล้ว');
    res.redirect(image ? `/admin/products/${image.product_id}/edit` : '/admin');
  } catch (err) {
    next(err);
  }
});

router.post('/images/:id/cover', async (req, res, next) => {
  try {
    const image = await db.setCoverImage(req.params.id);
    flash(req, 'success', 'ตั้งเป็นรูปหน้าปกแล้ว');
    res.redirect(image ? `/admin/products/${image.product_id}/edit` : '/admin');
  } catch (err) {
    next(err);
  }
});

/* ---------------- หมวดหมู่ ---------------- */

function readCategoryForm(body) {
  const name = String(body.name || '').trim().slice(0, 100);
  return {
    name,
    slug: slugify(body.slug || name) || `cat-${Date.now()}`,
    sort_order: parseInt(body.sort_order, 10) || 0,
  };
}

router.get('/categories', async (req, res, next) => {
  try {
    res.render('admin/categories', { title: 'หมวดหมู่สินค้า', categories: await db.listCategories() });
  } catch (err) {
    next(err);
  }
});

router.post('/categories', async (req, res, next) => {
  try {
    const fields = readCategoryForm(req.body);
    if (fields.name) {
      await db.createCategory(fields);
      flash(req, 'success', 'เพิ่มหมวดหมู่แล้ว');
    }
    res.redirect('/admin/categories');
  } catch (err) {
    next(err);
  }
});

router.post('/categories/:id', async (req, res, next) => {
  try {
    const fields = readCategoryForm(req.body);
    if (fields.name) {
      await db.updateCategory(req.params.id, fields);
      flash(req, 'success', 'บันทึกหมวดหมู่แล้ว');
    }
    res.redirect('/admin/categories');
  } catch (err) {
    next(err);
  }
});

router.post('/categories/:id/delete', async (req, res, next) => {
  try {
    await db.deleteCategory(req.params.id);
    flash(req, 'success', 'ลบหมวดหมู่แล้ว (สินค้าในหมวดนี้จะไม่มีหมวดหมู่)');
    res.redirect('/admin/categories');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
