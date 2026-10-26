-- Después de la migración 010. Solo Administración elimina productos sin uso ni existencias.
reset role;
begin;
create or replace function public.field_delete_product(p_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare product public.products; balances jsonb; begin
 if not public.campo_acta_member() or not public.field_can_manage_catalog() then raise exception 'Solo administración puede eliminar productos'; end if;
 if length(trim(coalesce(p_reason,'')))<5 then raise exception 'Indica el motivo de eliminación (mínimo 5 caracteres)'; end if;
 perform pg_advisory_xact_lock(260026);
 select * into product from public.products where id=p_id for update;
 if product.id is null then raise exception 'Producto no encontrado. Actualiza la información'; end if;
 if exists(select 1 from public.field_lines where product_id=p_id) then raise exception 'El producto está asociado a un acta o borrador. No se puede eliminar'; end if;
 if exists(select 1 from public.stock_movements where product_id=p_id) then raise exception 'El producto tiene movimientos registrados. No se puede eliminar'; end if;
 if exists(select 1 from public.opening_balances where product_id=p_id and quantity is distinct from 0) then raise exception 'El producto tiene stock o saldos por confirmar. No se puede eliminar'; end if;
 select coalesce(jsonb_agg(to_jsonb(o)),'[]'::jsonb) into balances from public.opening_balances o where product_id=p_id;
 insert into public.field_audit(actor,action,details) values(auth.uid(),'delete_product',jsonb_build_object('reason',trim(p_reason),'product',to_jsonb(product),'opening_balances',balances));
 delete from public.opening_balances where product_id=p_id;
 delete from public.products where id=p_id;
end $$;
revoke all on function public.field_delete_product(uuid,text) from public,anon;
grant execute on function public.field_delete_product(uuid,text) to authenticated;
commit;
