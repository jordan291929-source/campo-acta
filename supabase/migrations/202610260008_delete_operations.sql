-- Después de la migración 007. La cuenta administradora puede eliminar borradores y documentos anulados.
-- Un documento emitido se anula primero: así el stock queda revertido antes de eliminarlo.
-- La auditoría conserva una copia del documento y sus líneas.
reset role;
begin;
create or replace function public.field_delete_operation(p_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare op public.field_operations; reversal uuid; snapshot jsonb; begin
 if auth.uid() is null then raise exception 'Inicia sesión'; end if;
 if not public.field_can_manage_catalog() then raise exception 'Solo la cuenta administradora puede eliminar documentos'; end if;
 if length(trim(coalesce(p_reason,'')))<5 then raise exception 'Indica el motivo de eliminación'; end if;
 perform pg_advisory_xact_lock(260026);
 select * into op from public.field_operations where id=p_id for update;
 if op.id is null then raise exception 'Documento no encontrado'; end if;
 if op.status not in ('draft','cancelled') then raise exception 'Anula el documento antes de eliminarlo'; end if;
 if op.status='cancelled' then
  select (details->>'reversal_id')::uuid into reversal from public.field_audit
   where operation_id=p_id and action='cancel' order by id desc limit 1;
  -- El movimiento original y su reverso suman cero; se eliminan juntos sin cambiar el stock.
  if exists(select 1 from public.stock_movements where operation_id in (p_id,reversal)
    group by product_id,warehouse_id having sum(quantity_delta)<>0) then
   raise exception 'Los movimientos de este documento no están revertidos por completo';
  end if;
  delete from public.stock_movements where operation_id in (p_id,reversal);
 end if;
 select jsonb_build_object('operation',to_jsonb(op),'lines',coalesce(jsonb_agg(to_jsonb(l)),'[]'),'reason',p_reason)
  into snapshot from public.field_lines l where l.operation_id=p_id;
 update public.field_audit set operation_id=null where operation_id=p_id;
 delete from public.field_operations where id=p_id;
 insert into public.field_audit(actor,action,details) values(auth.uid(),'delete',snapshot);
end $$;
revoke all on function public.field_delete_operation(uuid,text) from public,anon;
grant execute on function public.field_delete_operation(uuid,text) to authenticated;
commit;
