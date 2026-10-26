-- Después de la migración 005. Control de stock por envase (UN) en todos los productos.
-- La carga inicial guardó cantidades de envases del Excel con unidad L/KG:
-- 40 envases x 5 L se mostraban como "40 L" y el precio quedó por litro.
-- Esta corrección convierte esos productos a envases sin duplicar movimientos.
-- Se puede volver a ejecutar: solo actúa sobre productos que sigan en L/KG.
reset role;
begin;
do $$
declare pr public.products; begin
 perform pg_advisory_xact_lock(260026);
 for pr in select * from public.products where unit in ('L','KG') for update loop
  -- Saldos del Excel ("Cantidades en envases"): el número ya era de envases y se conserva.
  -- Saldos ingresados en L/KG por otra vía se dividen entre el contenido del envase.
  update public.opening_balances set quantity=round(quantity/pr.package_size,4)
   where product_id=pr.id and quantity is not null and coalesce(notes,'') not like '%Cantidades en envases%';
  -- Movimientos registrados en L/KG pasan a envases; el acta emitida conserva su unidad original.
  if exists(select 1 from public.stock_movements where product_id=pr.id and round(quantity_delta/pr.package_size,4)=0) then
   raise exception 'Movimiento de % menor a 0.0001 envases; revisar antes de convertir',pr.name;
  end if;
  update public.stock_movements set quantity_delta=round(quantity_delta/pr.package_size,4) where product_id=pr.id;
  -- Borradores: misma cantidad física e importe, expresados por envase. Deben revisarse de nuevo.
  update public.field_operations set details=details-'reviewed',version=version+1,updated_at=now()
   where status='draft' and id in (select operation_id from public.field_lines where product_id=pr.id);
  update public.field_lines l set quantity=greatest(round(l.quantity/pr.package_size,4),0.0001),price=round(l.price*pr.package_size,4),unit='UN'
   from public.field_operations o where o.id=l.operation_id and o.status='draft' and l.product_id=pr.id;
  update public.products set unit='UN',sale_price=round(sale_price*package_size,4),cost_price=round(cost_price*package_size,4) where id=pr.id;
  insert into public.field_audit(actor,action,details)
  select id,'unit_to_packages',jsonb_build_object('product',pr.id,'name',pr.name,'from',pr.unit,'package_size',pr.package_size)
  from public.profiles order by created_at limit 1;
 end loop;
end $$;
commit;
