-- Primera instalación. Ejecutar una sola vez en SQL Editor de Supabase.
-- No carga datos reales ni registra salidas históricas.
begin;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) > 0),
  role text not null check (role in ('admin', 'campo', 'almacen', 'administracion')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create function public.campo_acta_member()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.profiles where id = (select auth.uid()) and active) $$;
revoke all on function public.campo_acta_member() from public, anon;
grant execute on function public.campo_acta_member() to authenticated;

create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  active boolean not null default true
);
insert into public.warehouses(code,name) values
  ('SUR','Sur · Cañete–San Luis'),
  ('NORTE','Norte · Nuevo Chimbote'),
  ('CHINCHA','Campo · Chincha');

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  presentation text not null check (length(trim(presentation)) > 0),
  unit text not null check (unit in ('L','KG','UN')),
  package_size numeric(16,4) not null check (package_size > 0),
  nisira_code text check (nisira_code ~ '^[0-9]{12}$'),
  active boolean not null default true,
  unique(name, presentation)
);

create table public.opening_balances (
  product_id uuid not null references public.products(id),
  warehouse_id uuid not null references public.warehouses(id),
  quantity numeric(16,4) check (quantity >= 0),
  as_of date not null,
  verified boolean not null default false,
  source_reference text not null,
  notes text,
  created_at timestamptz not null default now(),
  primary key(product_id, warehouse_id),
  check (not verified or quantity is not null)
);

-- Cantidades siempre en la unidad base del producto, nunca mezclar envases y L/KG.
-- Una regularización histórica no produce una fila en este libro.
-- La escritura del libro queda cerrada al navegador en esta primera versión.
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null,
  product_id uuid not null references public.products(id),
  warehouse_id uuid not null references public.warehouses(id),
  quantity_delta numeric(16,4) not null check (quantity_delta <> 0),
  movement_type text not null check (movement_type in ('purchase','producer_delivery','transfer','own_consumption','adjustment')),
  occurred_on date not null,
  reference text not null check (length(trim(reference)) > 0),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(operation_id, product_id, warehouse_id),
  foreign key(product_id, warehouse_id) references public.opening_balances(product_id, warehouse_id)
);
create index stock_movements_product_warehouse_idx on public.stock_movements(product_id, warehouse_id);
create index stock_movements_created_by_idx on public.stock_movements(created_by);
create index opening_balances_warehouse_idx on public.opening_balances(warehouse_id);

create view public.stock_current with (security_invoker = true) as
select p.id product_id, w.id warehouse_id, p.name product_name,
       p.presentation, p.unit, w.name warehouse_name,
       case when o.quantity is null then null else o.quantity + coalesce(m.delta,0) end quantity,
       o.verified, o.as_of
from public.opening_balances o
join public.products p on p.id = o.product_id
join public.warehouses w on w.id = o.warehouse_id
left join (
  select product_id, warehouse_id, sum(quantity_delta) delta
  from public.stock_movements group by product_id, warehouse_id
) m on m.product_id = o.product_id and m.warehouse_id = o.warehouse_id;

alter table public.profiles enable row level security;
alter table public.warehouses enable row level security;
alter table public.products enable row level security;
alter table public.opening_balances enable row level security;
alter table public.stock_movements enable row level security;

create policy own_profile on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy member_read on public.warehouses for select to authenticated using ((select public.campo_acta_member()));
create policy member_read on public.products for select to authenticated using ((select public.campo_acta_member()));
create policy member_read on public.opening_balances for select to authenticated using ((select public.campo_acta_member()));
create policy member_read on public.stock_movements for select to authenticated using ((select public.campo_acta_member()));

revoke all on public.profiles, public.warehouses, public.products, public.opening_balances, public.stock_movements, public.stock_current from anon, authenticated;
grant select on public.profiles, public.warehouses, public.products, public.opening_balances, public.stock_movements, public.stock_current to authenticated;

-- Archivo privado preparado para actas firmadas. No hay permisos de subida
-- hasta que las actas y la validación de sus propietarios estén implementadas.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('signed-actas','signed-actas',false,10485760,array['application/pdf','image/jpeg','image/png']);

commit;
