const env = process.env;

module.exports = {
  port: Number(env.PORT) || 3000,
  isProd: env.NODE_ENV === 'production',
  shop: {
    name: env.SHOP_NAME || 'ชัชวาลเชียงกง',
    tagline: env.SHOP_TAGLINE || 'อะไหล่รถยนต์มือสอง คัดสภาพ ราคาเป็นกันเอง',
    phone: env.SHOP_PHONE || '',
    lineId: env.SHOP_LINE_ID || '',
    facebookUrl: env.SHOP_FACEBOOK_URL || '',
    address: env.SHOP_ADDRESS || '',
    mapUrl: env.SHOP_MAP_URL || '',
    openHours: env.SHOP_OPEN_HOURS || '',
  },
  supabase: {
    url: env.SUPABASE_URL || '',
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY || '',
    bucket: env.SUPABASE_BUCKET || 'product-images',
  },
  admin: {
    password: env.ADMIN_PASSWORD || '',
    sessionSecret: env.SESSION_SECRET || '',
  },
};
