const crypto = require('crypto');
const sharp = require('sharp');
const { supabase } = require('../supabase');
const config = require('../config');

const PRODUCT_SELECT =
  '*, category:categories(id,name,slug), images:product_images(id,url,path,sort_order)';

function check({ data, error, count }) {
  if (error) throw new Error(error.message);
  return count === undefined ? data : { data, count };
}

function sortImages(product) {
  if (product && Array.isArray(product.images)) {
    product.images.sort((a, b) => a.sort_order - b.sort_order);
  }
  return product;
}

// ตัดอักขระที่มีความหมายพิเศษใน filter ของ PostgREST ออก
function cleanSearch(q) {
  return String(q || '')
    .replace(/[,()%*\\:"']/g, ' ')
    .trim()
    .slice(0, 80);
}

/* ---------------- หมวดหมู่ ---------------- */

async function listCategories() {
  return check(
    await supabase()
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
  );
}

async function getCategoryBySlug(slug) {
  return check(await supabase().from('categories').select('*').eq('slug', slug).maybeSingle());
}

async function createCategory({ name, slug, sort_order }) {
  return check(await supabase().from('categories').insert({ name, slug, sort_order }));
}

async function updateCategory(id, { name, slug, sort_order }) {
  return check(await supabase().from('categories').update({ name, slug, sort_order }).eq('id', id));
}

async function deleteCategory(id) {
  return check(await supabase().from('categories').delete().eq('id', id));
}

/* ---------------- สินค้า ---------------- */

/**
 * ดึงรายการสินค้าแบบแบ่งหน้า
 * @param {object} opts
 * @param {boolean} opts.admin  true = เห็นทุกรายการ (รวมที่ซ่อน / ขายแล้ว)
 */
async function listProducts({
  q = '',
  categoryId = null,
  sort = 'newest',
  status = '',
  featured = false,
  excludeId = null,
  page = 1,
  pageSize = 12,
  admin = false,
} = {}) {
  let query = supabase().from('products').select(PRODUCT_SELECT, { count: 'exact' });

  if (!admin) {
    query = query.eq('is_published', true);
    if (!status) query = query.neq('status', 'sold');
  }
  if (status) query = query.eq('status', status);
  if (categoryId) query = query.eq('category_id', categoryId);
  if (featured) query = query.eq('is_featured', true);
  if (excludeId) query = query.neq('id', excludeId);

  const term = cleanSearch(q);
  if (term) {
    const like = `%${term}%`;
    query = query.or(
      ['title', 'brand', 'compatible', 'part_number', 'description']
        .map((col) => `${col}.ilike.${like}`)
        .join(','),
    );
  }

  if (sort === 'price_asc') query = query.order('price', { ascending: true });
  else if (sort === 'price_desc') query = query.order('price', { ascending: false });
  query = query.order('created_at', { ascending: false });

  const from = (Math.max(1, page) - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data, count } = check(await query);
  const items = data.map(sortImages);
  return { items, total: count || 0, hasMore: from + items.length < (count || 0) };
}

async function getProduct(id, { admin = false } = {}) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id))) return null;
  let query = supabase().from('products').select(PRODUCT_SELECT).eq('id', id);
  if (!admin) query = query.eq('is_published', true);
  return sortImages(check(await query.maybeSingle()));
}

async function createProduct(fields) {
  return check(await supabase().from('products').insert(fields).select('id').single());
}

async function updateProduct(id, fields) {
  return check(await supabase().from('products').update(fields).eq('id', id));
}

async function deleteProduct(id) {
  const images = check(await supabase().from('product_images').select('path').eq('product_id', id));
  if (images.length) {
    await supabase().storage.from(config.supabase.bucket).remove(images.map((i) => i.path));
  }
  return check(await supabase().from('products').delete().eq('id', id));
}

async function countProducts() {
  const statuses = ['available', 'reserved', 'sold'];
  const results = await Promise.all(
    statuses.map((s) =>
      supabase().from('products').select('id', { count: 'exact', head: true }).eq('status', s),
    ),
  );
  return Object.fromEntries(statuses.map((s, i) => [s, check(results[i]).count || 0]));
}

/* ---------------- รูปภาพ ---------------- */

/**
 * ย่อรูปให้เหมาะกับเว็บ (กว้างไม่เกิน 1600px, แปลงเป็น WebP) แล้วอัปโหลดขึ้น Supabase Storage
 */
async function addImages(productId, files) {
  if (!files || !files.length) return;
  const bucket = supabase().storage.from(config.supabase.bucket);

  const existing = check(
    await supabase()
      .from('product_images')
      .select('sort_order')
      .eq('product_id', productId)
      .order('sort_order', { ascending: false })
      .limit(1),
  );
  let order = existing.length ? existing[0].sort_order + 1 : 0;

  for (const file of files) {
    const buffer = await sharp(file.buffer)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    const path = `${productId}/${crypto.randomUUID()}.webp`;
    const { error } = await bucket.upload(path, buffer, {
      contentType: 'image/webp',
      cacheControl: '31536000',
    });
    if (error) throw new Error(`อัปโหลดรูปไม่สำเร็จ: ${error.message}`);

    const { data } = bucket.getPublicUrl(path);
    check(
      await supabase()
        .from('product_images')
        .insert({ product_id: productId, path, url: data.publicUrl, sort_order: order++ }),
    );
  }
}

async function getImage(id) {
  return check(await supabase().from('product_images').select('*').eq('id', id).maybeSingle());
}

async function deleteImage(id) {
  const image = await getImage(id);
  if (!image) return null;
  await supabase().storage.from(config.supabase.bucket).remove([image.path]);
  check(await supabase().from('product_images').delete().eq('id', id));
  return image;
}

async function setCoverImage(id) {
  const image = await getImage(id);
  if (!image) return null;
  const images = check(
    await supabase()
      .from('product_images')
      .select('id')
      .eq('product_id', image.product_id)
      .order('sort_order', { ascending: true }),
  );
  const ordered = [image.id, ...images.map((i) => i.id).filter((i) => i !== image.id)];
  await Promise.all(
    ordered.map((imgId, index) =>
      supabase().from('product_images').update({ sort_order: index }).eq('id', imgId),
    ),
  );
  return image;
}

module.exports = {
  listCategories,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  countProducts,
  addImages,
  deleteImage,
  setCoverImage,
};
