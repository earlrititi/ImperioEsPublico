create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  sku text not null unique,
  currency text not null check (currency ~ '^[a-z]{3}$'),
  stock integer check (stock is null or stock >= 0),
  status text not null default 'draft' check (status in ('draft', 'active', 'soldout', 'archived')),
  legal_status text not null default 'LEGAL_PRODUCT_DATA_INCOMPLETE' check (
    legal_status in ('LEGAL_PRODUCT_DATA_INCOMPLETE', 'LEGAL_PRODUCT_DATA_COMPLETE')
  ),
  stripe_price_id text,
  manufacturer_name text,
  manufacturer_address text,
  manufacturer_email text,
  eu_responsible_person text,
  safety_information text,
  shipping_information text,
  returns_information text,
  tax_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  sku text not null unique,
  stock integer not null default 0 check (stock >= 0),
  active boolean not null default true,
  unique (product_id, name)
);

create table if not exists public.product_composition (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  fibre text not null,
  percentage numeric(5,2) not null check (percentage > 0 and percentage <= 100),
  unique (product_id, fibre)
);

create table if not exists public.product_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  amount integer not null check (amount >= 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create index if not exists product_prices_product_period_idx
on public.product_prices(product_id, starts_at desc, ends_at);

grant select on table public.products to anon, authenticated;
grant select on table public.product_variants to anon, authenticated;
grant select on table public.product_composition to anon, authenticated;
grant select on table public.product_prices to anon, authenticated;
grant all on table public.products to service_role;
grant all on table public.product_variants to service_role;
grant all on table public.product_composition to service_role;
grant all on table public.product_prices to service_role;

alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_composition enable row level security;
alter table public.product_prices enable row level security;

drop policy if exists "Public can read sale-ready products" on public.products;
create policy "Public can read sale-ready products"
on public.products for select to anon, authenticated
using (status in ('active', 'soldout') and legal_status = 'LEGAL_PRODUCT_DATA_COMPLETE');

drop policy if exists "Public can read variants of sale-ready products" on public.product_variants;
create policy "Public can read variants of sale-ready products"
on public.product_variants for select to anon, authenticated
using (
  exists (
    select 1 from public.products
    where products.id = product_variants.product_id
      and products.status in ('active', 'soldout')
      and products.legal_status = 'LEGAL_PRODUCT_DATA_COMPLETE'
  )
);

drop policy if exists "Public can read composition of sale-ready products" on public.product_composition;
create policy "Public can read composition of sale-ready products"
on public.product_composition for select to anon, authenticated
using (
  exists (
    select 1 from public.products
    where products.id = product_composition.product_id
      and products.status in ('active', 'soldout')
      and products.legal_status = 'LEGAL_PRODUCT_DATA_COMPLETE'
  )
);

drop policy if exists "Public can read prices of sale-ready products" on public.product_prices;
create policy "Public can read prices of sale-ready products"
on public.product_prices for select to anon, authenticated
using (
  exists (
    select 1 from public.products
    where products.id = product_prices.product_id
      and products.status in ('active', 'soldout')
      and products.legal_status = 'LEGAL_PRODUCT_DATA_COMPLETE'
  )
);

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute procedure private.set_updated_at();

comment on table public.product_prices is
'Immutable price periods used to calculate legally applicable reference prices before displaying discounts.';
