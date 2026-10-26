-- Después de la migración 009. Familia compartida del catálogo; no altera cantidades ni precios.
reset role;
begin;
alter table public.products add column if not exists family text not null default 'unclassified';
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.products'::regclass and conname='products_family_check') then
  alter table public.products add constraint products_family_check check(family in ('agrochemical','oil','fertilizer','unclassified'));
 end if;
end $$;
create or replace function public.field_save_product(p jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v uuid; f text; begin
 if not public.campo_acta_member() or not public.field_can_manage_catalog() then raise exception 'Esta cuenta no puede crear ni editar productos o precios'; end if;
 if p ? 'family' then
  f=coalesce(nullif(trim(p->>'family'),''),'unclassified');
  if f not in ('agrochemical','oil','fertilizer','unclassified') then raise exception 'Familia de producto no válida'; end if;
 end if;
 v=campo_private.field_save_product(p);
 if p ? 'family' then update public.products set family=f where id=v; end if;
 return v;
end $$;
revoke all on function public.field_save_product(jsonb) from public,anon;
grant execute on function public.field_save_product(jsonb) to authenticated;
commit;
