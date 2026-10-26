-- Después de la migración 008. Cuentas nuevas pendientes de aprobación y administración explícita.
-- Antes, cualquier cuenta registrada tenía acceso completo y permisos de catálogo.
-- Las cuentas existentes conservan su acceso actual: las no restringidas pasan a administración.
-- Se puede volver a ejecutar.
reset role;
begin;

-- Solo una cuenta aprobada (perfil activo) es miembro.
create or replace function public.campo_acta_member()
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.profiles where id=(select auth.uid()) and active) $$;

-- Las cuentas nuevas quedan pendientes, sin permisos de administración.
create or replace function public.create_field_profile()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,full_name,role,active)
 values(new.id,coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),new.email,'Usuario'),'campo',false)
 on conflict(id) do nothing;
 return new;
end $$;

-- Primera ejecución: las cuentas sin restricción de catálogo mantienen la administración que ya tenían.
do $$ begin
 if not exists(select 1 from public.profiles where role='admin') then
  update public.profiles p set role='admin' where active and not exists(
   select 1 from public.field_account_restrictions r
   where not r.can_manage_catalog and (r.user_id=p.id or (r.user_id is null and r.email=(select lower(trim(email)) from auth.users where id=p.id))));
 end if;
end $$;

create or replace function public.field_can_manage_catalog()
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and active and role='admin')
$$;

-- Lectura solo para cuentas aprobadas.
drop policy if exists own_profile on public.profiles;
create policy own_profile on public.profiles for select to authenticated using((select public.campo_acta_member()));
do $$ declare t text; begin
 foreach t in array array['producers','field_operations','field_lines','field_audit'] loop
  execute format('drop policy if exists field_read on public.%I',t);
  execute format('create policy field_read on public.%I for select to authenticated using ((select public.campo_acta_member()))',t);
 end loop;
end $$;
drop policy if exists field_signed_read on storage.objects;
drop policy if exists field_signed_insert on storage.objects;
create policy field_signed_read on storage.objects for select to authenticated using(bucket_id='signed-actas' and (select public.campo_acta_member()));
create policy field_signed_insert on storage.objects for insert to authenticated with check(
 bucket_id='signed-actas' and (select public.campo_acta_member()) and exists(
 select 1 from public.field_operations where id::text=split_part(name,'/',1) and status in ('issued','signed')));

-- Todas las funciones que solo pedían sesión ahora exigen una cuenta aprobada.
do $$ declare f record; begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','campo_private') and p.prosrc like '%if auth.uid() is null then raise exception ''Inicia sesión''%' loop
  execute replace(pg_get_functiondef(f.oid),'if auth.uid() is null then raise exception ''Inicia sesión''',
   'if not public.campo_acta_member() then raise exception ''Tu cuenta aún no está aprobada. Pide acceso a administración''');
 end loop;
end $$;

-- Estado de la cuenta actual, también para cuentas pendientes.
create or replace function public.field_my_access()
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('member',public.campo_acta_member(),'admin',public.field_can_manage_catalog())
$$;

create or replace function public.field_list_users()
returns table(id uuid,email text,full_name text,role text,active boolean,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.field_can_manage_catalog() then raise exception 'Solo administración puede ver las cuentas'; end if;
 return query select p.id,u.email::text,p.full_name,p.role,p.active,p.created_at
  from public.profiles p join auth.users u on u.id=p.id order by p.active,p.created_at desc;
end $$;

create or replace function public.field_set_user_access(p_id uuid,p_active boolean,p_admin boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.field_can_manage_catalog() then raise exception 'Solo administración puede aprobar cuentas'; end if;
 if p_id=auth.uid() then raise exception 'No puedes cambiar el acceso de tu propia cuenta'; end if;
 update public.profiles set active=p_active,role=case when p_admin and p_active then 'admin' else 'campo' end where id=p_id;
 if not found then raise exception 'Cuenta no encontrada'; end if;
 insert into public.field_audit(actor,action,details) values(auth.uid(),'user_access',jsonb_build_object('user',p_id,'active',p_active,'admin',p_admin and p_active));
end $$;

revoke all on function public.field_my_access(),public.field_list_users(),public.field_set_user_access(uuid,boolean,boolean) from public,anon;
grant execute on function public.field_my_access(),public.field_list_users(),public.field_set_user_access(uuid,boolean,boolean) to authenticated;
commit;
