-- Datos compartidos de FRUGLOBE. Después de las migraciones 002 y 003.
reset role;
begin;
create table if not exists public.field_company_settings(
 id boolean primary key default true check(id),
 details jsonb not null default '{}',
 updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now()
);
alter table public.field_company_settings enable row level security;
revoke all on public.field_company_settings from public,anon,authenticated;
insert into public.field_company_settings(id,details)
values(true,'{}'::jsonb)
on conflict(id) do nothing;
create or replace function public.field_company_defaults()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Inicia sesión'; end if;
 return (select details from public.field_company_settings where id);
end $$;
create or replace function public.field_save_company_defaults(p jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare filtered jsonb; begin
 if not public.field_can_manage_catalog() then raise exception 'Esta cuenta no puede editar datos de empresa'; end if;
 select coalesce(jsonb_object_agg(key,value),'{}') into filtered from jsonb_each(p)
 where key in ('company_ruc','company_address','representative_name','representative_document','authority','bank','account','payment_channel','copy_channel') and jsonb_typeof(value)='string';
 if coalesce(trim(filtered->>'company_address'),'')='' then raise exception 'Completa la dirección de FRUGLOBE'; end if;
 if coalesce(filtered->>'company_ruc','') !~ '^[0-9]{11}$' then raise exception 'El RUC debe tener 11 dígitos'; end if;
 update public.field_company_settings set details=filtered,updated_by=auth.uid(),updated_at=now() where id;
end $$;
revoke all on function public.field_company_defaults(),public.field_save_company_defaults(jsonb) from public,anon;
grant execute on function public.field_company_defaults(),public.field_save_company_defaults(jsonb) to authenticated;
commit;
