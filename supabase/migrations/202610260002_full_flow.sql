-- Campo Acta: actualización sobre 202610260001_initial.sql.
-- Ejecutar TODO en SQL Editor. No volver a ejecutar la migración inicial.
reset role;
begin;

create or replace function public.campo_acta_member()
returns boolean language sql stable security definer set search_path = ''
as $$ select auth.uid() is not null $$;

create or replace function public.create_field_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,full_name,role,active)
  values(new.id,coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),new.email,'Usuario'),'campo',true)
  on conflict(id) do nothing;
  return new;
end $$;
drop trigger if exists campo_acta_new_user on auth.users;
create trigger campo_acta_new_user after insert on auth.users for each row execute function public.create_field_profile();
insert into public.profiles(id,full_name,role,active)
select id,coalesce(nullif(raw_user_meta_data->>'full_name',''),email,'Usuario'),'campo',true from auth.users
on conflict(id) do nothing;

alter table public.products add column if not exists sale_price numeric(16,4) not null default 0 check(sale_price>=0);
alter table public.products add column if not exists cost_price numeric(16,4) not null default 0 check(cost_price>=0);
alter table public.products add column if not exists currency text not null default 'USD' check(currency in ('USD','PEN'));

create table if not exists public.producers(
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name))>0), document text not null default '',
 predio text not null default '', details jsonb not null default '{}',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(name,document,predio)
);
create table if not exists public.field_operations(
 id uuid primary key, number bigint generated always as identity unique,
 kind text not null check(kind in ('delivery','historical','own_consumption','transfer','purchase')),
 status text not null default 'draft' check(status in ('draft','issued','signed','cancelled')),
 warehouse_id uuid not null references public.warehouses(id),
 destination_id uuid references public.warehouses(id),
 producer_id uuid references public.producers(id),
 occurred_on date not null, issued_at timestamptz,
 currency text not null check(currency in ('USD','PEN')),
 details jsonb not null default '{}', producer_snapshot jsonb,
 total numeric(18,2) not null default 0,
 signed_path text, nisira_reference text not null default '',
 cancellation_reason text, created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 version integer not null default 1
);
create table if not exists public.field_lines(
 id bigint generated always as identity primary key,
 operation_id uuid not null references public.field_operations(id) on delete cascade,
 product_id uuid not null references public.products(id),
 quantity numeric(16,4) not null check(quantity>0), price numeric(16,4) not null check(price>=0),
 product_name text not null, presentation text not null, unit text not null,
 unique(operation_id,product_id)
);
create table if not exists public.field_audit(
 id bigint generated always as identity primary key, operation_id uuid references public.field_operations(id),
 actor uuid not null references public.profiles(id), action text not null, details jsonb not null default '{}',
 created_at timestamptz not null default now()
);
create index if not exists field_lines_product_idx on public.field_lines(product_id);
create index if not exists field_operations_producer_idx on public.field_operations(producer_id);
create index if not exists field_operations_warehouse_idx on public.field_operations(warehouse_id);
create index if not exists field_operations_destination_idx on public.field_operations(destination_id);
create index if not exists field_operations_actor_idx on public.field_operations(created_by);
create index if not exists field_audit_operation_idx on public.field_audit(operation_id);
create index if not exists field_audit_actor_idx on public.field_audit(actor);
create unique index if not exists field_historical_source_unique on public.field_operations((details->>'import_key'))
where kind='historical' and status<>'cancelled' and coalesce(details->>'import_key','')<>'';

alter table public.producers enable row level security;
alter table public.field_operations enable row level security;
alter table public.field_lines enable row level security;
alter table public.field_audit enable row level security;
drop policy if exists own_profile on public.profiles;
create policy own_profile on public.profiles for select to authenticated using(auth.uid() is not null);
do $$ declare t text; begin
 foreach t in array array['producers','field_operations','field_lines','field_audit'] loop
 execute format('drop policy if exists field_read on public.%I',t);
 execute format('create policy field_read on public.%I for select to authenticated using (auth.uid() is not null)',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;

create or replace function public.field_save_producer(p jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v uuid; begin
 if auth.uid() is null then raise exception 'Inicia sesión'; end if;
 if p->>'id' is not null then
  update public.producers set name=trim(p->>'name'),document=trim(coalesce(p->>'document','')),predio=trim(coalesce(p->>'predio','')),details=coalesce(p->'details','{}'),updated_at=now()
  where id=(p->>'id')::uuid returning id into v;
  if v is null then raise exception 'Productor no encontrado'; end if;
 else
  insert into public.producers(name,document,predio,details)
  values(trim(p->>'name'),trim(coalesce(p->>'document','')),trim(coalesce(p->>'predio','')),coalesce(p->'details','{}'))
  on conflict(name,document,predio) do update set details=public.producers.details||excluded.details,updated_at=now() returning id into v;
 end if;
 return v;
end $$;

create or replace function public.field_save_product(p jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v uuid; old public.products; begin
 if auth.uid() is null then raise exception 'Inicia sesión'; end if;
 perform pg_advisory_xact_lock(260026);
 if p->>'id' is not null then
  select * into old from public.products where id=(p->>'id')::uuid for update;
  if old.id is null then raise exception 'Producto no encontrado'; end if;
  if exists(select 1 from public.opening_balances where product_id=old.id) and
    (old.unit<>p->>'unit' or old.package_size<>(p->>'package_size')::numeric) then
    raise exception 'El producto ya tiene stock. Crea otra presentación para cambiar la unidad o contenido.';
  end if;
  update public.products set name=trim(p->>'name'),presentation=trim(p->>'presentation'),unit=p->>'unit',package_size=(p->>'package_size')::numeric,
    sale_price=(p->>'sale_price')::numeric,cost_price=(p->>'cost_price')::numeric,currency=p->>'currency' where id=old.id returning id into v;
 else
  insert into public.products(name,presentation,unit,package_size,sale_price,cost_price,currency)
  values(trim(p->>'name'),trim(p->>'presentation'),p->>'unit',(p->>'package_size')::numeric,coalesce((p->>'sale_price')::numeric,0),coalesce((p->>'cost_price')::numeric,0),coalesce(p->>'currency','USD'))
  returning id into v;
 end if;
 return v;
end $$;

create or replace function public.field_import_stock(p_rows jsonb,p_date date,p_source text)
returns integer language plpgsql security definer set search_path='' as $$
declare r jsonb; v uuid; w uuid; n integer:=0; old public.products; begin
 if auth.uid() is null then raise exception 'Inicia sesión'; end if;
 if p_date is null or coalesce(trim(p_source),'')='' then raise exception 'Indica fecha de corte y fuente'; end if;
 if jsonb_array_length(p_rows)=0 then raise exception 'Sin filas para importar'; end if;
 perform pg_advisory_xact_lock(260026);
 for r in select * from jsonb_array_elements(p_rows) loop
  if r->>'unit' not in ('UN','L','KG') or r->>'unit' is null then raise exception 'Confirma la unidad de todos los productos'; end if;
  select * into old from public.products where name=trim(r->>'name') and presentation=trim(r->>'presentation');
  if old.id is null then
   insert into public.products(name,presentation,unit,package_size) values(trim(r->>'name'),trim(r->>'presentation'),r->>'unit',(r->>'package_size')::numeric) returning id into v;
  else
   v:=old.id;
   if old.unit<>r->>'unit' or old.package_size<>(r->>'package_size')::numeric then raise exception 'Unidad o presentación incompatible: %',old.name; end if;
  end if;
  select id into w from public.warehouses where code=r->>'warehouse';
  if w is null then raise exception 'Almacén desconocido'; end if;
  if exists(select 1 from public.opening_balances where product_id=v and warehouse_id=w) then
   raise exception 'Ya existe saldo inicial para % en %. La carga se canceló completa; no se duplicaron datos.',r->>'name',r->>'warehouse';
  end if;
  insert into public.opening_balances(product_id,warehouse_id,quantity,as_of,verified,source_reference,notes)
  values(v,w,(r->>'quantity')::numeric,p_date,(r->>'quantity') is not null,p_source,coalesce(r->>'notes',''));
  n:=n+1;
 end loop;
 insert into public.field_audit(actor,action,details) values(auth.uid(),'stock_initial',jsonb_build_object('rows',n,'source',p_source,'date',p_date));
 return n;
end $$;

create or replace function public.field_save_operation(p jsonb,p_lines jsonb,p_version integer default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v uuid:=(p->>'id')::uuid; old public.field_operations; line jsonb; pr public.products; begin
 if auth.uid() is null then raise exception 'Inicia sesión'; end if;
 perform pg_advisory_xact_lock(260026);
 select * into old from public.field_operations where id=v for update;
 if old.id is not null and (old.status<>'draft' or old.version is distinct from p_version) then raise exception 'El documento cambió o ya fue emitido. Actualiza antes de editar.'; end if;
 if jsonb_array_length(p_lines)=0 then raise exception 'Agrega al menos un insumo'; end if;
 if p->>'kind'='transfer' and (p->>'destination_id' is null or p->>'destination_id'=p->>'warehouse_id') then raise exception 'Selecciona un almacén de destino diferente'; end if;
 if (p->>'occurred_on')::date > (now() at time zone 'America/Lima')::date then raise exception 'La fecha física no puede ser futura'; end if;
 if old.id is null then
  insert into public.field_operations(id,kind,warehouse_id,destination_id,producer_id,occurred_on,currency,details,created_by)
  values(v,p->>'kind',(p->>'warehouse_id')::uuid,(p->>'destination_id')::uuid,(p->>'producer_id')::uuid,(p->>'occurred_on')::date,p->>'currency',coalesce(p->'details','{}'),auth.uid());
 else
  update public.field_operations set kind=p->>'kind',warehouse_id=(p->>'warehouse_id')::uuid,destination_id=(p->>'destination_id')::uuid,producer_id=(p->>'producer_id')::uuid,
   occurred_on=(p->>'occurred_on')::date,currency=p->>'currency',details=coalesce(p->'details','{}'),version=version+1,updated_at=now() where id=v;
  delete from public.field_lines where operation_id=v;
 end if;
 for line in select * from jsonb_array_elements(p_lines) loop
  select * into pr from public.products where id=(line->>'product_id')::uuid and active;
  if pr.id is null then raise exception 'Producto no disponible'; end if;
  insert into public.field_lines(operation_id,product_id,quantity,price,product_name,presentation,unit)
  values(v,pr.id,(line->>'quantity')::numeric,(line->>'price')::numeric,pr.name,pr.presentation,pr.unit);
 end loop;
 update public.field_operations set total=(select sum(round(quantity*price,2)) from public.field_lines where operation_id=v) where id=v;
 insert into public.field_audit(operation_id,actor,action) values(v,auth.uid(),'save_draft');
 return v;
end $$;

create or replace function public.field_issue_operation(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare op public.field_operations; line public.field_lines; b numeric; verified boolean; prod public.producers; typ text; begin
 if auth.uid() is null then raise exception 'Inicia sesión'; end if;
 perform pg_advisory_xact_lock(260026);
 select * into op from public.field_operations where id=p_id for update;
 if op.id is null then raise exception 'Documento no encontrado'; end if;
 if op.status in ('issued','signed') then return; end if;
 if op.status<>'draft' then raise exception 'Documento anulado'; end if;
 if op.kind in ('delivery','historical') then
  if op.details->>'reviewed' is distinct from 'yes' then raise exception 'Confirma la revisión del productor, unidades y precios'; end if;
  select * into prod from public.producers where id=op.producer_id;
  if prod.id is null or trim(prod.document)='' then raise exception 'Selecciona productor y completa su DNI/RUC antes de emitir'; end if;
  update public.field_operations set producer_snapshot=to_jsonb(prod) where id=p_id;
 end if;
 if coalesce(trim(op.details->>'responsible'),'')='' then raise exception 'Indica el responsable que entrega o registra'; end if;
 if not exists(select 1 from public.field_lines where operation_id=p_id) then raise exception 'Documento sin insumos'; end if;
 for line in select * from public.field_lines where operation_id=p_id loop
  if op.kind in ('delivery','own_consumption','transfer') then
   select s.quantity,s.verified into b,verified from public.stock_current s where product_id=line.product_id and warehouse_id=op.warehouse_id;
   if b is null or not coalesce(verified,false) then raise exception 'Confirma el saldo inicial de % en el almacén de origen',line.product_name; end if;
   if b<line.quantity then raise exception 'Stock insuficiente de %: disponible %, solicitado %',line.product_name,b,line.quantity; end if;
   if exists(select 1 from public.opening_balances where product_id=line.product_id and warehouse_id=op.warehouse_id and as_of>op.occurred_on) then raise exception 'La salida es anterior al corte inicial. Usa regularización histórica si ya estaba descontada.'; end if;
  end if;
  if op.kind<>'historical' then
   typ:=case op.kind when 'delivery' then 'producer_delivery' else op.kind end;
   if op.kind='purchase' then
    insert into public.opening_balances(product_id,warehouse_id,quantity,as_of,verified,source_reference) values(line.product_id,op.warehouse_id,0,op.occurred_on,true,'Inicio por ingreso') on conflict do nothing;
    if exists(select 1 from public.opening_balances where product_id=line.product_id and warehouse_id=op.warehouse_id and (quantity is null or not public.opening_balances.verified)) then raise exception 'Primero confirma el saldo inicial desconocido'; end if;
   end if;
   insert into public.stock_movements(operation_id,product_id,warehouse_id,quantity_delta,movement_type,occurred_on,reference,created_by)
   values(p_id,line.product_id,op.warehouse_id,case when op.kind='purchase' then line.quantity else -line.quantity end,typ,op.occurred_on,'ACT-'||lpad(op.number::text,6,'0'),auth.uid());
   if op.kind='transfer' then
    insert into public.opening_balances(product_id,warehouse_id,quantity,as_of,verified,source_reference) values(line.product_id,op.destination_id,0,op.occurred_on,true,'Inicio por transferencia') on conflict do nothing;
    if exists(select 1 from public.opening_balances where product_id=line.product_id and warehouse_id=op.destination_id and (quantity is null or not public.opening_balances.verified)) then raise exception 'Confirma primero el saldo desconocido en destino'; end if;
    insert into public.stock_movements(operation_id,product_id,warehouse_id,quantity_delta,movement_type,occurred_on,reference,created_by)
    values(p_id,line.product_id,op.destination_id,line.quantity,'transfer',op.occurred_on,'ACT-'||lpad(op.number::text,6,'0'),auth.uid());
   end if;
  end if;
 end loop;
 update public.field_operations set status='issued',issued_at=now(),version=version+1,updated_at=now() where id=p_id;
 insert into public.field_audit(operation_id,actor,action) values(p_id,auth.uid(),'issue');
end $$;

create or replace function public.field_cancel_operation(p_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare op public.field_operations; m public.stock_movements; b numeric; reversal uuid:=gen_random_uuid(); begin
 if auth.uid() is null then raise exception 'Inicia sesión'; end if;
 if length(trim(coalesce(p_reason,'')))<5 then raise exception 'Indica el motivo de anulación'; end if;
 perform pg_advisory_xact_lock(260026);
 select * into op from public.field_operations where id=p_id for update;
 if op.id is null then raise exception 'Documento no encontrado'; end if;
 if op.status='cancelled' then return; end if;
 for m in select * from public.stock_movements where operation_id=p_id loop
  if m.quantity_delta>0 then
   select quantity into b from public.stock_current where product_id=m.product_id and warehouse_id=m.warehouse_id;
   if b is null or b<m.quantity_delta then raise exception 'No se puede revertir: parte del ingreso o traslado ya se consumió'; end if;
  end if;
  insert into public.stock_movements(operation_id,product_id,warehouse_id,quantity_delta,movement_type,occurred_on,reference,created_by)
  values(reversal,m.product_id,m.warehouse_id,-m.quantity_delta,'adjustment',(now() at time zone 'America/Lima')::date,'Anulación ACT-'||lpad(op.number::text,6,'0')||': '||p_reason,auth.uid());
 end loop;
 update public.field_operations set status='cancelled',cancellation_reason=p_reason,version=version+1,updated_at=now() where id=p_id;
 insert into public.field_audit(operation_id,actor,action,details) values(p_id,auth.uid(),'cancel',jsonb_build_object('reason',p_reason,'reversal_id',reversal));
end $$;

create or replace function public.field_set_followup(p_id uuid,p_reference text,p_path text default null)
returns void language plpgsql security definer set search_path='' as $$
declare op public.field_operations; begin
 if auth.uid() is null then raise exception 'Inicia sesión'; end if;
 select * into op from public.field_operations where id=p_id for update;
 if op.id is null or op.status not in ('issued','signed') then raise exception 'Primero emite el documento'; end if;
 if p_path is not null and not exists(select 1 from storage.objects where bucket_id='signed-actas' and name=p_path and split_part(name,'/',1)=p_id::text) then raise exception 'Archivo firmado no encontrado'; end if;
 update public.field_operations set nisira_reference=coalesce(p_reference,''),signed_path=coalesce(p_path,signed_path),status=case when coalesce(p_path,signed_path) is not null then 'signed' else status end,updated_at=now(),version=version+1 where id=p_id;
 insert into public.field_audit(operation_id,actor,action) values(p_id,auth.uid(),'followup');
end $$;

create or replace function public.field_set_initial(p_product uuid,p_warehouse uuid,p_quantity numeric,p_date date,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare before_row jsonb; begin
 if auth.uid() is null then raise exception 'Inicia sesión'; end if;
 if p_quantity is null or p_quantity<0 or p_date is null or length(trim(coalesce(p_reason,'')))<5 then raise exception 'Completa cantidad, fecha y motivo'; end if;
 perform pg_advisory_xact_lock(260026);
 if exists(select 1 from public.stock_movements where product_id=p_product and warehouse_id=p_warehouse) then raise exception 'Ya existen movimientos. Registra un ingreso o ajuste, no modifiques el saldo inicial.'; end if;
 select to_jsonb(o) into before_row from public.opening_balances o where product_id=p_product and warehouse_id=p_warehouse;
 insert into public.opening_balances(product_id,warehouse_id,quantity,as_of,verified,source_reference,notes)
 values(p_product,p_warehouse,p_quantity,p_date,true,'Carga manual',p_reason)
 on conflict(product_id,warehouse_id) do update set quantity=excluded.quantity,as_of=excluded.as_of,verified=true,notes=p_reason;
 insert into public.field_audit(actor,action,details) values(auth.uid(),'set_initial',jsonb_build_object('before',before_row,'product',p_product,'warehouse',p_warehouse,'quantity',p_quantity,'reason',p_reason));
end $$;

-- Todos los usuarios registrados comparten las mismas funciones, sin roles operativos.
do $$ declare f record; begin
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.proname like 'field_%' or p.proname='create_field_profile') loop
 execute format('revoke all on function %s from public, anon, authenticated',f.sig);
 if f.sig::text not like '%create_field_profile%' then execute format('grant execute on function %s to authenticated',f.sig); end if;
 end loop;
end $$;
drop policy if exists field_signed_read on storage.objects;
drop policy if exists field_signed_insert on storage.objects;
create policy field_signed_read on storage.objects for select to authenticated using(bucket_id='signed-actas' and auth.uid() is not null);
create policy field_signed_insert on storage.objects for insert to authenticated with check(
 bucket_id='signed-actas' and auth.uid() is not null and exists(
 select 1 from public.field_operations where id::text=split_part(name,'/',1) and status in ('issued','signed')));
commit;
