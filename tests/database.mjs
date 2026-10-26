import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const db = new PGlite();
try {
  // Emula únicamente los objetos de plataforma que aporta Supabase.
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/202610260001_initial.sql', import.meta.url), 'utf8'));
  const member = '00000000-0000-0000-0000-000000000001';
  const outsider = '00000000-0000-0000-0000-000000000002';
  const product = '00000000-0000-0000-0000-000000000003';
  await db.exec(`
    insert into auth.users values ('${member}'),('${outsider}');
    insert into public.profiles(id,full_name,role) values ('${member}','Usuario de prueba','almacen');
    insert into public.products(id,name,presentation,unit,package_size) values ('${product}','Insumo de prueba','Envase de prueba 5 L','L',5);
    insert into public.opening_balances(product_id,warehouse_id,quantity,as_of,verified,source_reference)
      select '${product}',id,25,'2026-10-26',true,'Prueba sintética' from public.warehouses where code='SUR';
    insert into public.opening_balances(product_id,warehouse_id,quantity,as_of,verified,source_reference)
      select '${product}',id,null,'2026-10-26',false,'Prueba de saldo desconocido' from public.warehouses where code='NORTE';
  `);
  await db.exec('set role anon');
  await assert.rejects(db.query('select * from public.stock_current'), /permission denied/);
  await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${outsider}',false)`);
  assert.equal((await db.query('select * from public.stock_current')).rows.length,0,'Usuario sin perfil no debe ver stock');
  await db.exec(`select set_config('request.jwt.claim.sub','${member}',false)`);
  const rows = (await db.query('select * from public.stock_current order by warehouse_name')).rows;
  assert.equal(rows.length,2);
  assert.equal(rows.filter(r => r.quantity === null).length,1,'Desconocido no debe convertirse en cero');
  assert.equal(rows.find(r => r.verified).quantity,'25.0000');
  await assert.rejects(db.exec("update public.profiles set role='admin'"),/permission denied/);
  await assert.rejects(db.exec('delete from public.opening_balances'),/permission denied/);
  await assert.rejects(db.exec('delete from public.stock_movements'),/permission denied/);
  await db.exec(`reset role; update public.profiles set active=false where id='${member}'; set role authenticated`);
  assert.equal((await db.query('select * from public.stock_current')).rows.length,0,'Un usuario deshabilitado pierde acceso');
  await db.exec('reset role');
  await assert.rejects(db.exec('update public.opening_balances set verified=true where quantity is null'), /check constraint/);
  assert.equal((await db.query('select public from storage.buckets')).rows[0].public,false);
  console.log('OK: migración, saldo desconocido, RLS, bloqueo de escritura y escalamiento, desactivación y almacenamiento privado.');
} finally { await db.close(); }
