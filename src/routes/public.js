const express = require('express');
const db = require('../lib/db');

const router = express.Router();
const PAGE_SIZE = 12;
const SORTS = ['newest', 'price_asc', 'price_desc'];

// อ่านตัวกรองจาก query string
async function readFilters(query) {
  const q = String(query.q || '').trim().slice(0, 80);
  const sort = SORTS.includes(query.sort) ? query.sort : 'newest';
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const category = query.category ? await db.getCategoryBySlug(String(query.category)) : null;
  return { q, sort, page, category };
}

router.get('/', async (req, res, next) => {
  try {
    const [categories, featured, latest] = await Promise.all([
      db.listCategories(),
      db.listProducts({ featured: true, pageSize: 8 }),
      db.listProducts({ pageSize: PAGE_SIZE }),
    ]);
    res.render('home', {
      title: null,
      categories,
      featured: featured.items,
      latest,
      filters: { q: '', sort: 'newest', category: null },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/products', async (req, res, next) => {
  try {
    const filters = await readFilters(req.query);
    const [categories, result] = await Promise.all([
      db.listCategories(),
      db.listProducts({
        q: filters.q,
        sort: filters.sort,
        categoryId: filters.category && filters.category.id,
        page: 1,
        pageSize: PAGE_SIZE,
      }),
    ]);
    const title = filters.q
      ? `ค้นหา "${filters.q}"`
      : filters.category
        ? filters.category.name
        : 'สินค้าทั้งหมด';
    res.render('products', { title, categories, result, filters });
  } catch (err) {
    next(err);
  }
});

// ใช้สำหรับเลื่อนโหลดสินค้าเพิ่มอัตโนมัติ (infinite scroll)
router.get('/api/products', async (req, res, next) => {
  try {
    const filters = await readFilters(req.query);
    const result = await db.listProducts({
      q: filters.q,
      sort: filters.sort,
      categoryId: filters.category && filters.category.id,
      page: filters.page,
      pageSize: PAGE_SIZE,
    });
    res.render('partials/product-cards', { products: result.items }, (err, html) => {
      if (err) return next(err);
      res.json({ html, hasMore: result.hasMore, nextPage: filters.page + 1 });
    });
  } catch (err) {
    next(err);
  }
});

router.get('/product/:id', async (req, res, next) => {
  try {
    const product = await db.getProduct(req.params.id);
    if (!product) return next();
    const related = await db.listProducts({
      categoryId: product.category_id,
      excludeId: product.id,
      pageSize: 8,
    });
    res.render('product', { title: product.title, product, related: related.items });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
