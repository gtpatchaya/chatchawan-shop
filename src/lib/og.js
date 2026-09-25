const sharp = require('sharp');
const format = require('./format');

function escapeXml(unsafe) {
  return String(unsafe || '').replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}

function wrapText(text, maxCharsPerLine = 24) {
  const words = String(text || '').trim().split(/\s+/);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine ? currentLine + ' ' + word : word).length <= maxCharsPerLine) {
      currentLine = currentLine ? currentLine + ' ' + word : word;
    } else {
      if (currentLine) lines.push(currentLine);
      // If a single word is longer than maxCharsPerLine
      if (word.length > maxCharsPerLine) {
        lines.push(word.slice(0, maxCharsPerLine - 2) + '..');
        currentLine = '';
      } else {
        currentLine = word;
      }
    }
  }
  if (currentLine) lines.push(currentLine);
  if (lines.length > 2) {
    return [lines[0], lines[1].slice(0, maxCharsPerLine - 3) + '...'];
  }
  if (lines.length === 0) return [''];
  return lines;
}

async function createRoundedMask(width, height, radius = 16) {
  const maskSvg = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" fill="#ffffff"/>
    </svg>
  `);
  return sharp(maskSvg).png().toBuffer();
}

async function generateProductCard(product, shop = {}) {
  const shopName = shop.name || 'ชัชวาลเชียงกง';
  const shopTagline = shop.tagline || 'อะไหล่รถยนต์มือสอง คัดสภาพ';

  const priceText = product.price > 0 ? format.formatPrice(product.price) : 'ติดต่อสอบถาม';
  const hasDiscount =
    product.original_price && product.original_price > product.price && product.price > 0;
  const originalPriceText = hasDiscount ? format.formatPrice(product.original_price) : '';
  const discountPercent = hasDiscount
    ? Math.round((1 - product.price / product.original_price) * 100)
    : 0;

  const conditionText = format.CONDITIONS[product.condition]
    ? `สภาพ ${format.CONDITIONS[product.condition]}`
    : 'มือสองคัดเกรด';
  const compatText = product.compatible
    ? `รุ่น: ${product.compatible}`
    : product.category
      ? `หมวด: ${product.category.name}`
      : 'อะไหล่แท้';

  const titleLines = wrapText(product.title, 22);
  const titleSvg = titleLines
    .map(
      (line, idx) =>
        `<tspan x="0" dy="${idx === 0 ? 0 : 42}">${escapeXml(line)}</tspan>`,
    )
    .join('');

  // 1. Base Canvas
  const bg = await sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 4,
      background: { r: 241, g: 245, b: 249, alpha: 1 },
    },
  })
    .png()
    .toBuffer();

  // 2. Fetch and prepare product image or placeholder
  let productImgBuffer = null;
  const firstImage = product.images && product.images[0] && product.images[0].url;

  if (firstImage) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(firstImage, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const rawBuf = Buffer.from(arrayBuf);
        const mask = await createRoundedMask(500, 500, 16);

        productImgBuffer = await sharp(rawBuf)
          .resize(500, 500, { fit: 'cover', position: 'center' })
          .composite([{ input: mask, blend: 'dest-in' }])
          .png()
          .toBuffer();
      }
    } catch (e) {
      console.warn('OG image fetch failed, using fallback:', e.message);
    }
  }

  if (!productImgBuffer) {
    // Elegant fallback box
    const fallbackSvg = Buffer.from(`
      <svg width="500" height="500" viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
        <rect width="500" height="500" rx="16" fill="#16324f"/>
        <circle cx="250" cy="210" r="70" fill="#1e4063"/>
        <path d="M225 185 L275 235 M275 185 L225 235" stroke="#ffffff" stroke-width="8" stroke-linecap="round"/>
        <text x="250" y="320" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Thai', sans-serif" font-size="24" font-weight="700" fill="#ffffff" text-anchor="middle">${escapeXml(shopName)}</text>
        <text x="250" y="360" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Thai', sans-serif" font-size="18" font-weight="500" fill="#94a3b8" text-anchor="middle">อะไหล่มือสองคัดสภาพ</text>
      </svg>
    `);
    productImgBuffer = await sharp(fallbackSvg).png().toBuffer();
  }

  // 3. SVG Overlay with text, cards, pricing & branding
  const svgOverlay = Buffer.from(`
    <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          .brand { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Thai', sans-serif; font-size: 22px; font-weight: 700; fill: #16324f; }
          .subbrand { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Thai', sans-serif; font-size: 15px; font-weight: 500; fill: #64748b; }
          .title { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Thai', sans-serif; font-size: 34px; font-weight: 700; fill: #0f172a; }
          .compat-text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Thai', sans-serif; font-size: 16px; font-weight: 600; fill: #334155; }
          .cond-text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Thai', sans-serif; font-size: 16px; font-weight: 600; fill: #0369a1; }
          .price-label { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Thai', sans-serif; font-size: 17px; font-weight: 600; fill: #ea580c; }
          .price-val { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Thai', sans-serif; font-size: 52px; font-weight: 800; fill: #d9692b; }
          .orig-price { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Thai', sans-serif; font-size: 22px; font-weight: 500; fill: #94a3b8; text-decoration: line-through; }
          .disc-text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Thai', sans-serif; font-size: 15px; font-weight: 700; fill: #e11d48; }
          .trust-text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Thai', sans-serif; font-size: 16px; font-weight: 600; fill: #334155; }
        </style>
        <filter id="card-shadow" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#0f172a" flood-opacity="0.08"/>
        </filter>
        <filter id="img-shadow" x="-5%" y="-5%" width="110%" height="110%">
          <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="#0f172a" flood-opacity="0.06"/>
        </filter>
      </defs>

      <!-- Background Glow Orbs -->
      <rect width="1200" height="630" fill="#f8fafc"/>
      <circle cx="1100" cy="100" r="320" fill="#fed7aa" opacity="0.4"/>
      <circle cx="100" cy="550" r="280" fill="#bae6fd" opacity="0.45"/>

      <!-- Image Area Frame (Left) -->
      <rect x="40" y="40" width="540" height="550" rx="20" fill="#ffffff" stroke="#e2e8f0" stroke-width="2" filter="url(#img-shadow)"/>

      <!-- Content Card (Right) -->
      <rect x="610" y="40" width="550" height="550" rx="20" fill="#ffffff" stroke="#e2e8f0" stroke-width="2" filter="url(#card-shadow)"/>

      <!-- Header: Store Branding -->
      <g transform="translate(650, 85)">
        <rect x="0" y="-22" width="38" height="38" rx="10" fill="#16324f"/>
        <path d="M10 19 L19 10 M19 10 A4 4 0 0 0 25 4 A4 4 0 0 0 19 10 Z" stroke="#ffffff" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <text x="50" y="-2" class="brand">${escapeXml(shopName)}</text>
        <text x="50" y="22" class="subbrand">${escapeXml(shopTagline)}</text>
      </g>

      <line x1="650" y1="132" x2="1120" y2="132" stroke="#f1f5f9" stroke-width="2"/>

      <!-- Title -->
      <g transform="translate(650, 180)">
        <text x="0" y="0" class="title">${titleSvg}</text>
      </g>

      <!-- Badges -->
      <g transform="translate(650, 275)">
        <!-- Condition Badge -->
        <rect x="0" y="0" width="165" height="34" rx="8" fill="#e0f2fe"/>
        <text x="12" y="23" class="cond-text">${escapeXml(conditionText)}</text>

        <!-- Compat Badge -->
        <rect x="178" y="0" width="200" height="34" rx="8" fill="#f1f5f9"/>
        <text x="190" y="23" class="compat-text">${escapeXml(compatText)}</text>
      </g>

      <!-- Price Section (Shopee-like Highlighted Orange Banner) -->
      <g transform="translate(650, 345)">
        <rect x="0" y="0" width="470" height="120" rx="16" fill="#fff7ed" stroke="#fed7aa" stroke-width="1.5"/>
        <text x="24" y="32" class="price-label">ราคาพิเศษ</text>
        <text x="24" y="88" class="price-val">${escapeXml(priceText)}</text>

        ${
          hasDiscount
            ? `
          <text x="270" y="82" class="orig-price">${escapeXml(originalPriceText)}</text>
          <rect x="375" y="62" width="78" height="26" rx="6" fill="#ffe4e6"/>
          <text x="383" y="80" class="disc-text">ลด ${discountPercent}%</text>
        `
            : ''
        }
      </g>

      <!-- Bottom Trust / Contact -->
      <g transform="translate(650, 500)">
        <rect x="0" y="0" width="470" height="54" rx="12" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5"/>
        <text x="20" y="33" class="trust-text">✓ ตรวจสภาพก่อนส่งมอบ | สั่งซื้อทัก LINE หรือ โทรได้เลย</text>
      </g>
    </svg>
  `);

  // 4. Composite everything
  return sharp(bg)
    .composite([
      { input: productImgBuffer, top: 65, left: 60 },
      { input: svgOverlay, top: 0, left: 0 },
    ])
    .png({ quality: 90 })
    .toBuffer();
}

module.exports = {
  generateProductCard,
};
