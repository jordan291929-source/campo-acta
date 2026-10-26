-- Ejecutar completo después de 202610260002_full_flow.sql.
reset role;
begin;

create table if not exists public.field_account_restrictions (
 email text primary key check (email=lower(trim(email)) and length(email)>3),
 user_id uuid unique references auth.users(id) on delete set null,
 can_manage_catalog boolean not null default false
);
alter table public.field_account_restrictions enable row level security;
revoke all on public.field_account_restrictions from public, anon, authenticated;

create or replace function public.field_bind_restriction()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.user_id is null then select id into new.user_id from auth.users where lower(trim(email))=new.email; end if;
 return new;
end $$;
drop trigger if exists field_bind_restriction on public.field_account_restrictions;
create trigger field_bind_restriction before insert or update on public.field_account_restrictions for each row execute function public.field_bind_restriction();
create or replace function public.field_bind_new_account()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.field_account_restrictions set user_id=new.id where email=lower(trim(new.email)) and user_id is null;
 return new;
end $$;
drop trigger if exists field_bind_account on auth.users;
create trigger field_bind_account after insert on auth.users for each row execute function public.field_bind_new_account();
revoke all on function public.field_bind_restriction(),public.field_bind_new_account() from public,anon,authenticated;

create or replace function public.field_can_manage_catalog()
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and coalesce((
   select r.can_manage_catalog from public.field_account_restrictions r
   where r.user_id=auth.uid() or (r.user_id is null and r.email=(select lower(trim(email)) from auth.users where id=auth.uid()))
 ),true)
$$;
revoke all on function public.field_can_manage_catalog() from public, anon;
grant execute on function public.field_can_manage_catalog() to authenticated;

-- Las implementaciones originales quedan fuera de la API expuesta.
create schema if not exists campo_private;
revoke all on schema campo_private from public, anon, authenticated;
do $$ begin
 if to_regprocedure('campo_private.field_save_product(jsonb)') is null then
   alter function public.field_save_product(jsonb) set schema campo_private;
 end if;
 if to_regprocedure('campo_private.field_import_stock(jsonb,date,text)') is null then
   alter function public.field_import_stock(jsonb,date,text) set schema campo_private;
 end if;
 if to_regprocedure('campo_private.field_set_initial(uuid,uuid,numeric,date,text)') is null then
   alter function public.field_set_initial(uuid,uuid,numeric,date,text) set schema campo_private;
 end if;
end $$;
revoke all on all functions in schema campo_private from public, anon, authenticated;

create or replace function public.field_save_product(p jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 if not public.field_can_manage_catalog() then raise exception 'Esta cuenta no puede crear ni editar productos o precios'; end if;
 return campo_private.field_save_product(p);
end $$;
create or replace function public.field_import_stock(p_rows jsonb,p_date date,p_source text)
returns integer language plpgsql security definer set search_path='' as $$
begin
 if not public.field_can_manage_catalog() then raise exception 'Esta cuenta no puede realizar cargas iniciales'; end if;
 return campo_private.field_import_stock(p_rows,p_date,p_source);
end $$;
create or replace function public.field_set_initial(p_product uuid,p_warehouse uuid,p_quantity numeric,p_date date,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.field_can_manage_catalog() then raise exception 'Esta cuenta no puede modificar saldos iniciales'; end if;
 perform campo_private.field_set_initial(p_product,p_warehouse,p_quantity,p_date,p_reason);
end $$;
revoke all on function public.field_save_product(jsonb), public.field_import_stock(jsonb,date,text), public.field_set_initial(uuid,uuid,numeric,date,text) from public, anon;
grant execute on function public.field_save_product(jsonb), public.field_import_stock(jsonb,date,text), public.field_set_initial(uuid,uuid,numeric,date,text) to authenticated;

commit;
-- Configuración de una cuenta, desde SQL Editor (reemplazar correo):
-- insert into public.field_account_restrictions(email,can_manage_catalog)
-- values ('correo-campo@empresa.com',false)
-- on conflict(email) do update set can_manage_catalog=excluded.can_manage_catalog;
-- La regla también se aplica si el usuario crea la cuenta después.
