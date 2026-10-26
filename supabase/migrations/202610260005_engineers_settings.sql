-- Después de la migración 004. No contiene datos personales o bancarios.
reset role;
begin;
create or replace function public.field_save_company_defaults(p jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare filtered jsonb; begin
 if not public.field_can_manage_catalog() then raise exception 'Esta cuenta no puede editar datos de empresa'; end if;
 select coalesce(jsonb_object_agg(key,value),'{}') into filtered from jsonb_each(p)
 where key in ('company_ruc','company_address','representative_name','representative_document','authority','bank','account','payment_channel','copy_channel','engineers') and jsonb_typeof(value)='string';
 if coalesce(trim(filtered->>'company_address'),'')='' then raise exception 'Completa la dirección de FRUGLOBE'; end if;
 if coalesce(filtered->>'company_ruc','') !~ '^[0-9]{11}$' then raise exception 'El RUC debe tener 11 dígitos'; end if;
 update public.field_company_settings set details=filtered,updated_by=auth.uid(),updated_at=now() where id;
end $$;
revoke all on function public.field_save_company_defaults(jsonb) from public,anon;
grant execute on function public.field_save_company_defaults(jsonb) to authenticated;
commit;
