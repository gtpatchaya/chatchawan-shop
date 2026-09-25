-- ร้านชัชวาลเชียงกง : โครงสร้างฐานข้อมูล
-- วิธีใช้: เปิด Supabase Dashboard > SQL Editor > วางไฟล์นี้ทั้งหมดแล้วกด Run

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm"; -- ช่วยให้ค้นหาข้อความ (ILIKE '%คำ%') ใช้ index ได้

-- หมวดหมู่สินค้า
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

-- สินค้า
create table if not exists public.products (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text not null default '',
  price           numeric(12,2) not null default 0,
  original_price  numeric(12,2),
  category_id     uuid references public.categories(id) on delete set null,
  brand           text not null default '',
  compatible      text not null default '',   -- ใช้กับรุ่นรถ
  part_number     text not null default '',
  condition       text not null default 'good', -- like_new | good | fair | for_parts
  quantity        int  not null default 1,
  status          text not null default 'available', -- available | reserved | sold
  is_featured     boolean not null default false,
  is_published    boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists products_category_idx on public.products(category_id);
create index if not exists products_created_idx  on public.products(created_at desc);
-- หน้าร้านดึงเฉพาะสินค้าที่เผยแพร่ เรียงตามใหม่สุด
create index if not exists products_published_created_idx on public.products(created_at desc) where is_published;
-- นับ/กรองตามสถานะ และดึงสินค้าแนะนำ
create index if not exists products_status_idx   on public.products(status);
create index if not exists products_featured_idx on public.products(is_featured) where is_featured;
-- ค้นหาข้อความเร็วขึ้น (ILIKE '%คำ%') ด้วย trigram GIN index
create index if not exists products_title_trgm      on public.products using gin (title gin_trgm_ops);
create index if not exists products_brand_trgm      on public.products using gin (brand gin_trgm_ops);
create index if not exists products_compatible_trgm on public.products using gin (compatible gin_trgm_ops);
create index if not exists products_partno_trgm     on public.products using gin (part_number gin_trgm_ops);
create index if not exists products_desc_trgm       on public.products using gin (description gin_trgm_ops);

-- รูปสินค้า (หลายรูปต่อสินค้า)
create table if not exists public.product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  path        text not null,   -- path ใน storage bucket
  url         text not null,   -- public url
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists product_images_product_idx on public.product_images(product_id, sort_order);

-- ตั้งค่าร้าน (แก้ได้จากหลังบ้าน) เก็บแบบ key-value
create table if not exists public.settings (
  key         text primary key,
  value       text not null default '',
  updated_at  timestamptz not null default now()
);

-- อัปเดต updated_at อัตโนมัติ
create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

drop trigger if exists settings_touch on public.settings;
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- เปิด Row Level Security
-- เว็บเซิร์ฟเวอร์ใช้ service role key (ข้าม RLS ได้) ส่วนคนทั่วไปอ่านได้เฉพาะข้อมูลที่เผยแพร่
alter table public.categories     enable row level security;
alter table public.products       enable row level security;
alter table public.product_images enable row level security;
alter table public.settings       enable row level security;

drop policy if exists "public read settings" on public.settings;
create policy "public read settings" on public.settings for select using (true);

drop policy if exists "public read categories" on public.categories;
create policy "public read categories" on public.categories for select using (true);

drop policy if exists "public read products" on public.products;
create policy "public read products" on public.products for select using (is_published);

drop policy if exists "public read images" on public.product_images;
create policy "public read images" on public.product_images for select using (true);

-- Storage bucket สำหรับรูปสินค้า (อ่านได้สาธารณะ)
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- หมวดหมู่ตัวอย่าง (ลบหรือแก้ได้จากหลังบ้าน)
insert into public.categories (name, slug, sort_order) values
  ('เครื่องยนต์', 'engine', 1),
  ('ช่วงล่าง', 'suspension', 2),
  ('ระบบไฟ', 'electrical', 3),
  ('ตัวถังและกระจก', 'body', 4),
  ('ไฟหน้า ไฟท้าย', 'lights', 5),
  ('ล้อและยาง', 'wheels', 6),
  ('ภายในห้องโดยสาร', 'interior', 7),
  ('อื่นๆ', 'others', 99)
on conflict (slug) do nothing;
